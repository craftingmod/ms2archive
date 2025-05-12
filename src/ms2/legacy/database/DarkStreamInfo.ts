import { DataTypesLite, type DefinedModelToJSObject, SequelizeLite } from "../sqliteorm/SequelizeLite.js"

/**
 * 다크스트림 정보 모델
 */
export type DarkStreamStoreInfo = DefinedModelToJSObject<ReturnType<typeof defineDarkStreamInfo>>

export function defineDarkStreamInfo(seq: SequelizeLite) {
  return seq.define("darkStreamStore", {
    season: DataTypesLite.INTEGER,
    job: DataTypesLite.INTEGER,
    rank: DataTypesLite.INTEGER,
    characterId: DataTypesLite.BIGINT,
    profileURL: DataTypesLite.STRING,
    nickname: DataTypesLite.STRING,
    rankYMD: DataTypesLite.INTEGER,
    score: DataTypesLite.INTEGER
  })
}