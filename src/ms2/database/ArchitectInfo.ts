import { DataTypesLite, type DefinedModelToJSObject, SequelizeLite } from "../sqlite/SequelizeLite.js"

/**
 * 길드 정보 모델
 * fetchGuildRank 함수의 결과값을 저장합니다.
 */
export type ArchitectStoreInfo = DefinedModelToJSObject<ReturnType<typeof defineArchitectRankInfo>>

export function defineArchitectRankInfo(seq: SequelizeLite) {
  return seq.define("architectRankStore", {
    starDate: DataTypesLite.INTEGER,
    rank: DataTypesLite.INTEGER,
    characterId: DataTypesLite.BIGINT,
    profileURL: DataTypesLite.STRING,
    nickname: DataTypesLite.STRING,
    accountId: DataTypesLite.BIGINT,
    houseName: DataTypesLite.STRING,
    houseScore: DataTypesLite.INTEGER,
  })
}