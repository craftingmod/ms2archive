import { SequelizeLite } from "../legacy/sqliteorm/SequelizeLite.ts"
import { defineGuildRankInfo } from "../legacy/database/GuildRankInfo.ts"
import { defineTrophyRankInfo } from "../legacy/database/TrophyRankInfo.ts"
import { defineDarkStreamInfo } from "../legacy/database/DarkStreamInfo.ts"

export class RankStorage extends SequelizeLite {
  public guildRankStore = defineGuildRankInfo(this)

  public trophyRankStore = defineTrophyRankInfo(this)

  public darkStreamStore = defineDarkStreamInfo(this)

  public constructor() {
    super(`./data/ms2rank.db`)
  }
}