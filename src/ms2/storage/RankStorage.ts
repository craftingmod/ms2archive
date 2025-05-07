import { SequelizeLite } from "../legacy/sqliteorm/SequelizeLite.ts"
import { defineGuildRankInfo } from "../legacy/database/GuildRankInfo.ts"

export class RankStorage extends SequelizeLite {
  public guildRankStore = defineGuildRankInfo(this)

  public constructor() {
    super(`./data/ms2rank.db`)
  }
}