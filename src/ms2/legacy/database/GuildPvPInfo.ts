import { DataTypesLite, type DefinedModelToJSObject, type SequelizeLite } from "../sqliteorm/SequelizeLite.ts"

/*
    return {
      season,
      rank: getRankFromElement($),
      guildId: queryCIDFromImageURL(guildProfileURL),
      guildProfileURL,
      guildName,
      leaderName,
      tier: pvpTier,
      score: parseCommaNumber(
        $.find(".last_child").text()
      ),
    }
*/

/**
 * Guild PvP (길드 챔이언십) 정보 모델
 */
export type GuildPvPStoreInfo = DefinedModelToJSObject<ReturnType<typeof defineGuildPvPInfo>>

export function defineGuildPvPInfo(seq: SequelizeLite) {
  return seq.define("guildPvPStore", {
    season: DataTypesLite.INTEGER,
    rank: DataTypesLite.INTEGER,
    guildId: DataTypesLite.BIGINT,
    guildProfileURL: DataTypesLite.STRING,
    guildName: DataTypesLite.STRING,
    leaderName: DataTypesLite.STRING,
    tier: DataTypesLite.STRING,
    score: DataTypesLite.INTEGER
  })
}