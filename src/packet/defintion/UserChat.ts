import { ByteWriter } from "ms2packet.ts"

export interface UserChatSend {
  message: string,
}

export interface UserChatRecv {
  accountId: bigint,
  characterId: bigint,
  username: string,
  useStringId: false,
  message: string,
  type: 0,
  unknown1?: unknown,
  channel: number,
  isMentorRelated: false,
}

// 6개 글자: 36바이트
// 24 + 2n
export function makeChatPacket(orgPacket: Uint8Array, text: string, isKMS2: boolean) {
  const totalLength = (isKMS2 ? 26 : 24) + (2 * text.length)
  const contentPacketLength = totalLength - 6 // 6바이트 빼기 (컨텐츠 내용)
  const writer = new ByteWriter(totalLength)
  writer.writeBytes(orgPacket, 0, 2) // 2바이트 헤더
  writer.writeUInt(contentPacketLength) // 총 패킷 길이 (4바이트)
  writer.writeUShort(0x11) // OPCODE (2바이트)
  writer.writeUInt(0) // PADDING (4바이트)
  writer.writeUnicodeString(text) // 2 * 텍스트길이 + 2(길이 표시)
  writer.writeZero(isKMS2 ? 12 : 10) // 10바이트 패딩 (8바이트 패딩 + 2바이트 트레일)
  // KMS2 클라는 2바이트 패딩이 더 있음
  // 2+4+2+4+1+10
  return writer.toArray()
}