import { SequelizeLite } from "../sqlite/SequelizeLite.ts"
import { defineProfileInfo } from "../database/ProfileInfo.ts"

export class ProfileStorage extends SequelizeLite {
  public profileInfoStore = defineProfileInfo(this)

  public constructor() {
    super(`./data/ms2profile.db`, true)
  }
  public getArchivedCharacterIds() {
    const query = this.database.prepare(
      `SELECT characterId FROM ${this.profileInfoStore.tableName};`
    ).all() as Array<{ characterId: bigint }>

    return query.map(row => row.characterId)
  }

  public getAVIFPaths() {
    const query = this.database.prepare(
      `SELECT profileId, avifPath FROM ${this.profileInfoStore.tableName} WHERE profileId > 0;`
    ).all() as Array<{ profileId: bigint, avifPath: string, avifData: Uint8Array | undefined }>

    return query
  }
}