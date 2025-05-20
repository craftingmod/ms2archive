import type { ByteReader } from "ms2packet.ts"

export type CharInfo = {
  characterId: bigint,
  isExist: boolean,
  isFull: false,
} | {
  characterId: bigint,
  accountId: bigint,
  nickname: string,
  timestamp: number,
  isExist: boolean,
  isFull: true,
}

export function readCharInfo(reader: ByteReader): CharInfo {
  const characterId = reader.readULong()
  const isExist = reader.readBoolean()
  if (!isExist) {
    return {
      characterId,
      isExist,
      isFull: false,
    }
  }

  reader.readULong() // unknown
  reader.readULong() // characterId
  const timestamp = reader.readULong() // timestamp

  const buffer1Size = reader.readUInt() // buffer1 size
  if (buffer1Size <= 28) {
    return {
      characterId,
      isExist,
      isFull: false,
    }
  }
  const accountId = reader.readULong()
  reader.readULong() // characterId
  const nickname = reader.readUnicodeString()

  return {
    characterId,
    accountId,
    nickname,
    timestamp: Number(timestamp),
    isExist,
    isFull: true,
  }
}