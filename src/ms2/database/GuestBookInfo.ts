import { AdditionalDef, DataTypesLite, type DefinedModelToJSObject, SequelizeLite } from "../sqlite/SequelizeLite.js"

/**
 * 방명록 정보 모델
 */
export type GuestBookInfo = DefinedModelToJSObject<ReturnType<typeof defineGuestBookInfo>>
export type RawGuestBookInfo = Omit<GuestBookInfo, "characterId">

export function defineGuestBookInfo(seq: SequelizeLite) {
  return seq.define("guestBookStore", {
    commentId: DataTypesLite.INTEGER,
    ownerAccountId: DataTypesLite.BIGINT,
    nickname: DataTypesLite.STRING,
    comment: DataTypesLite.STRING,
    replyComment: DataTypesLite.STRING_NULLABLE,
    replyCommentDate: DataTypesLite.INTEGER_NULLABLE,
    job: DataTypesLite.INTEGER,
    level: DataTypesLite.INTEGER,
    isOwner: DataTypesLite.INTEGER,
    commentDate: DataTypesLite.INTEGER,
  }, {
    commentId: [AdditionalDef.PRIMARY_KEY],
  })
}

export type GuestBookExistInfo = DefinedModelToJSObject<ReturnType<typeof defineGuestBookExistInfo>>

export function defineGuestBookExistInfo(seq: SequelizeLite) {
  return seq.define("guestBookExist", {
    ownerAccountId: DataTypesLite.BIGINT,
    commentCount: DataTypesLite.INTEGER,
  }, {
    ownerAccountId: [AdditionalDef.PRIMARY_KEY],
  })
}

export function shirinkPartyId(partyId: string) {
  return BigInt(partyId.substring(2, partyId.length - 2))
}