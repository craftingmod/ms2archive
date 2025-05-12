import { SequelizeLite } from "../legacy/sqliteorm/SequelizeLite.ts"
import { defineGuildRankInfo } from "../legacy/database/GuildRankInfo.ts"
import { defineTrophyRankInfo } from "../legacy/database/TrophyRankInfo.ts"

export class RankStorage extends SequelizeLite {
  public guildRankStore = defineGuildRankInfo(this)

  public trophyRankStore = defineTrophyRankInfo(this)

  public constructor() {
    super(`./data/ms2rank.db`)
  }
}