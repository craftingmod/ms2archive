import { ByteReader } from "ms2packet.ts"
import { CharacterInfoDB } from "../ms2/storage/CharacterInfoDB.ts"
import { loadTrophyRanks } from "../packet/database/TrophyRankLoader.ts"
import { readCharInfo } from "../packet/defintion/internal/CharInfo.ts"
import Debug from "debug"


/* eslint-disable @typescript-eslint/no-unused-vars */
declare const self: Worker

const Info = Debug("ms2socket:info:charInfoWorker")

const charDB = new CharacterInfoDB(
  "./data/ms2char.db", false
)

const trophyRanks = loadTrophyRanks()

const trophyRankMap = new Map<bigint, number>()
for (const info of trophyRanks) {
  trophyRankMap.set(info.characterId, Number(info.trophyRank))
}

self.onmessage = (event: MessageEvent) => {
  const data = event.data as Uint8Array
  const reader = new ByteReader(data, 8)
  const decodedInfo = readCharInfo(reader)

  if (!decodedInfo.isFull) {
    return
  }
  const charId = decodedInfo.characterId
  charDB.insertMany([{
    characterId: charId,
    accountId: decodedInfo.accountId,
    nickname: decodedInfo.nickname,
    trophyRank: trophyRankMap.get(charId) ?? -1,
    timestamp: decodedInfo.timestamp,
    rawPacket: data.subarray(6),
  }])
  Info(`Inserted: ${charId} (accountId: ${decodedInfo.accountId})`)
}