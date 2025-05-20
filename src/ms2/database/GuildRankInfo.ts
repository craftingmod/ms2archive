import { DataTypesLite, type DefinedModelToJSObject, SequelizeLite } from "../sqlite/SequelizeLite.js"

/**
 * 길드 정보 모델
 * fetchGuildRank 함수의 결과값을 저장합니다.
 */
export type GuildRankStoreInfo = DefinedModelToJSObject<ReturnType<typeof defineGuildRankInfo>>

export function defineGuildRankInfo(seq: SequelizeLite) {
  return seq.define("guildRankStore", {
    guildId: DataTypesLite.BIGINT,
    guildName: DataTypesLite.STRING,
    guildProfileURL: DataTypesLite.STRING_NULLABLE,
    leaderName: DataTypesLite.STRING,
    /** leaderInfo?.characterId 를 저장합니다. leaderInfo가 null이거나 characterId가 없으면 null이 됩니다. */
    leaderCharacterId: DataTypesLite.BIGINT_NULLABLE,
    trophyCount: DataTypesLite.INTEGER,
    rank: DataTypesLite.INTEGER,
  })
}