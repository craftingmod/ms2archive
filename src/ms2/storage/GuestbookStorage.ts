import { SequelizeLite } from "../sqlite/SequelizeLite.ts"
import { defineGuestBookExistInfo, defineGuestBookInfo } from "../database/GuestBookInfo.ts"

export class GuestbookStorage extends SequelizeLite {
  public guestbookStore = defineGuestBookInfo(this)

  public guestbookExistStore = defineGuestBookExistInfo(this)

  public constructor() {
    super(`./data/ms2guestbook.db`, true)
  }
  public getArchivedAccountIds() {
    const query = this.database.prepare(
      `SELECT ownerAccountId FROM guestBookExist;`
    ).all() as Array<{ownerAccountId: bigint}>

    return query.map(row => row.ownerAccountId)
  }
}