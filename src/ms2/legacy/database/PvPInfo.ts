import { DataTypesLite, type DefinedModelToJSObject, type SequelizeLite } from "../sqliteorm/SequelizeLite.ts"

/*
    return {
      season,
      rank: getRankFromElement($),
      characterId: queryCIDFromImageURL(profileURL),
      profileURL,
      nickname: $.find(".character").text().trim(),
      tier: pvpTier,
      score: parseCommaNumber(
        $.find(".last_child").text()
      ),
    }
*/

/**
 * PvP (투기장) 정보 모델
 */
export type PvPStoreInfo = DefinedModelToJSObject<ReturnType<typeof definePvPInfo>>

export function definePvPInfo(seq: SequelizeLite) {
  return seq.define("pvpStore", {
    season: DataTypesLite.INTEGER,
    rank: DataTypesLite.INTEGER,
    characterId: DataTypesLite.BIGINT,
    profileURL: DataTypesLite.STRING,
    nickname: DataTypesLite.STRING,
    tier: DataTypesLite.STRING,
    score: DataTypesLite.INTEGER
  })
}

export function definePvPRawInfo(seq: SequelizeLite) {
  return seq.define("pvpStoreRaw", {
    season: DataTypesLite.INTEGER,
    rank: DataTypesLite.INTEGER,
    characterId: DataTypesLite.BIGINT,
    profileURL: DataTypesLite.STRING,
    nickname: DataTypesLite.STRING,
    tier: DataTypesLite.STRING,
    score: DataTypesLite.INTEGER
  })
}