import { MS2Database } from "ms2/database/MS2Database.ts"
import { ProfileStorage } from "../ms2/storage/ProfileStorage.ts"
import { getProfileId, shrinkProfileURL } from "../ms2/util/MS2FetchUtil.ts"
import type { ProfileSaveRequest, ProfileSaveResponse } from "../worker/ProfileWorker.ts"
import { LargeWorkerHelper } from "../worker/WorkerHelper.ts"
import Debug from "debug"
import fs from "node:fs/promises"

const Verbose = Debug("ms2archive:verbose:profile")

const dungeonDB = new MS2Database("./data/ms2query.db")
const profileDB = new ProfileStorage()

const profileWorker = new LargeWorkerHelper<ProfileSaveRequest, ProfileSaveResponse>(
  new URL("../worker/ProfileWorker.ts", import.meta.url),
  8
)

const trophyInfos = dungeonDB.database.prepare(
  `SELECT characterId, nickname, profileURL FROM characterStore WHERE characterId > 0;`
).all() as Array<{ characterId: bigint, profileURL: string | null, nickname: string }>


const trophyRanks = new Map<bigint, { characterId: bigint, profileURL: string, nickname: string }>()
for (const info of trophyInfos) {
  if (info.profileURL != null) {
    info.profileURL = `https://ua-maplestory2.nexon.com/profile/${info.profileURL}`

    trophyRanks.set(info.characterId, info as any)
  }
}

const doneCids = new Set(profileDB.getArchivedCharacterIds())

profileWorker.onResult = async (value, input) => {
  if (value == null) {
    Verbose(`Fetching failed! (${input.url})`)
    return
  }
  Verbose(`${input.characterId} done!`)

  const userInfo = trophyRanks.get(value.characterId)
  if (userInfo == null) {
    throw new Error("userInfo should be exist!")
  }
  profileDB.profileInfoStore.insertOne({
    characterId: value.characterId,
    nickname: userInfo.nickname,
    profileId: value.profileId,
    originalURL: shrinkProfileURL(userInfo.profileURL),
    pngPath: value.pngPath,
    avifPath: value.avifPath,
    avifData: await fs.readFile(value.avifPath),
  })
}

const requestInfos = [...trophyRanks.values()].filter(
  (info) => (!doneCids.has(info.characterId)) && info.profileURL.length >= 40
).map<ProfileSaveRequest>((info) => ({
  url: info.profileURL,
  characterId: info.characterId,
  profileId: getProfileId(info.profileURL)!,
}))

Verbose(`RequestInfos length: ${requestInfos.length}`)

profileWorker.request(requestInfos)