import { ProfileStorage } from "../ms2/storage/ProfileStorage.ts"
import { RankStorage } from "../ms2/storage/RankStorage.ts"
import type { TrophyRankInfo } from "../ms2/struct/MS2RankInfo.ts"
import { getProfileId, shrinkProfileURL } from "../ms2/util/MS2FetchUtil.ts"
import type { ProfileSaveRequest, ProfileSaveResponse } from "../worker/ProfileWorker.ts"
import { LargeWorkerHelper } from "../worker/WorkerHelper.ts"
import Debug from "debug"

const Verbose = Debug("ms2archive:verbose:profile")

const rankDB = new RankStorage()
const profileDB = new ProfileStorage()

const profileWorker = new LargeWorkerHelper<ProfileSaveRequest, ProfileSaveResponse>(
  new URL("../worker/ProfileWorker.ts", import.meta.url),
  8
)

const trophyInfos = rankDB.database.prepare(
  `SELECT * FROM trophyRankStore
      ORDER BY trophyRank ASC;`
).all() as Array<TrophyRankInfo>


const trophyRanks = new Map<bigint, TrophyRankInfo>()
for (const info of trophyInfos) {
  trophyRanks.set(info.characterId, info)
}

const doneCids = new Set(profileDB.getArchivedCharacterIds())

profileWorker.onResult = (value, input) => {
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
  })
}

const requestInfos = trophyInfos.filter(
  (info) => (!doneCids.has(info.characterId)) && info.profileURL.length >= 40
).map<ProfileSaveRequest>((info) => ({
  url: info.profileURL,
  characterId: info.characterId,
  profileId: getProfileId(info.profileURL),
}))

Verbose(`RequestInfos length: ${requestInfos.length}`)

profileWorker.request(requestInfos)