import { AdditionalDef, DataTypesLite, type DefinedModelToJSObject, SequelizeLite } from "../sqliteorm/SequelizeLite.js"

/**
 * 캐릭터별 트로피 랭킹 정보를 저장하는 모델
 * 예시 데이터:
 * {
 *   characterId, // bigint
 *   nickname,    // string
 *   trophyCount, // number
 *   trophyRank,  // number
 *   profileURL,  // string
 * }
 */
export type TrophyRankStoreInfo = DefinedModelToJSObject<ReturnType<typeof defineTrophyRankInfo>>

export function defineTrophyRankInfo(seq: SequelizeLite) {
  return seq.define("trophyRankStore", {
    characterId: DataTypesLite.BIGINT,
    nickname: DataTypesLite.STRING,
    trophyCount: DataTypesLite.INTEGER,
    trophyRank: DataTypesLite.INTEGER,
    profileURL: DataTypesLite.STRING,
  }, {
    characterId: [AdditionalDef.PRIMARY_KEY], // characterId를 기본 키로 사용
  })
}