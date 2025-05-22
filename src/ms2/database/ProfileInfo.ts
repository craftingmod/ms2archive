import { AdditionalDef, DataTypesLite, type DefinedModelToJSObject, SequelizeLite } from "../sqlite/SequelizeLite.ts"

/**
 * 닉네임 정보 모델
 */
export type ProfileInfo = DefinedModelToJSObject<ReturnType<typeof defineProfileInfo>>

export function defineProfileInfo(seq: SequelizeLite) {
  return seq.define("profileInfoStore", {
    characterId: DataTypesLite.BIGINT,
    nickname: DataTypesLite.STRING,
    profileId: DataTypesLite.BIGINT,
    originalURL: DataTypesLite.STRING,
    pngPath: DataTypesLite.STRING,
    avifPath: DataTypesLite.STRING,
  }, {
    profileId: [AdditionalDef.PRIMARY_KEY],
  })
}