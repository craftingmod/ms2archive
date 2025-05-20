import { SequelizeLite } from "../sqlite/SequelizeLite.ts"
import { defineGuildRankInfo } from "../legacy/database/GuildRankInfo.ts"
import { defineTrophyRankInfo } from "../legacy/database/TrophyRankInfo.ts"
import { defineDarkStreamInfo } from "../legacy/database/DarkStreamInfo.ts"
import { definePvPInfo, definePvPRawInfo } from "../legacy/database/PvPInfo.ts"
import { defineGuildPvPInfo } from "../legacy/database/GuildPvPInfo.ts"
import { defineArchitectRankInfo } from "../legacy/database/ArchitectInfo.ts"

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