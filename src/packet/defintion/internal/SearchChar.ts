import { ByteWriter } from "ms2packet.ts"

export function makeSearchCharPacket(orgPacket: Uint8Array, characterID: bigint | string) {
  const totalLength = 16
  const contentPacketLength = totalLength - 6 // 6바이트 빼기 (컨텐츠 내용)
  const writer = new ByteWriter
  (totalLength)
  writer.writeBytes(orgPacket, 0, 2) // 2바이트 헤더
  writer.writeUInt(contentPacketLength) // 총 패킷 길이 (4바이트)
  writer.writeUShort(0x001E) // OPCODE (2바이트)
  writer.writeULong(BigInt(characterID))
  return writer.toArray()
}