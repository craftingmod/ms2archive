export type PacketDefintion<I, O> = {
  sendOpcode: number,
  recvOpcode: number,
  encodeSend: (data: O) => Uint8Array,
  decodeSend: (data: Uint8Array) => O,
  encodeRecv: (data: I) => Uint8Array,
  decodeRecv: (data: Uint8Array) => I,
}