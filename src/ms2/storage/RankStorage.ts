import { SequelizeLite } from "../sqlite/SequelizeLite.ts"
import { defineGuildRankInfo } from "../database/GuildRankInfo.ts"
import { defineTrophyRankInfo } from "../database/TrophyRankInfo.ts"
import { defineDarkStreamInfo } from "../database/DarkStreamInfo.ts"
import { definePvPInfo, definePvPRawInfo } from "../database/PvPInfo.ts"
import { defineGuildPvPInfo } from "../database/GuildPvPInfo.ts"
import { defineArchitectRankInfo } from "../database/ArchitectInfo.ts"

export class RankStorage extends SequelizeLite {
  public guildRankStore = defineGuildRankInfo(this)

  public trophyRankStore = defineTrophyRankInfo(this)

  public darkStreamStore = defineDarkStreamInfo(this)

  public pvpStore = definePvPInfo(this)

  public pvpRawStore = definePvPRawInfo(this)

  public guildPvPStore = defineGuildPvPInfo(this)

  public architectStore = defineArchitectRankInfo(this)

  public constructor() {
    super(`./data/ms2rank.db`)
  }
}