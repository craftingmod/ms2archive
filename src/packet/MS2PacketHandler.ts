import Debug from "debug"
import { analyzeFirstMS2Packet, ByteReader, MapleCipherDecryptor, MapleCipherEncryptor } from "ms2packet.ts"
import { copyPacket, PacketHandlerMap } from "./PacketHandler.ts"
import { OpcodeInfoList } from "./defintion/OpcodeInfo.ts"
import { makeChatPacket } from "./defintion/UserChat.ts"
import { makeSearchCharPacket } from "./defintion/SearchChar.ts"
import { getInstrumentOpcode } from "./defintion/Instrument.ts"
import { readCharInfo } from "./defintion/CharInfo.ts"

const Verbose = Debug("ms2socket:verbose:MS2PacketHandler")

const Info = Debug("ms2socket:info:MS2PacketHandler")

export class MS2PacketHandler {
  protected readonly encryptor: {
    client: MapleCipherEncryptor,
    server: MapleCipherEncryptor,
  }
  /**
   * 서버 메세지: server decryptor 써야 함
   * 
   * 클라이언트 메세지: client decryptor 써야 함
   */
  protected readonly decryptor: {
    client: MapleCipherDecryptor,
    server: MapleCipherDecryptor,
  }
  public readonly handshakeInfo: ReturnType<typeof analyzeFirstMS2Packet>

  public constructor(
    protected rootInstance: PacketHandlerMap,
    protected firstPacket: Uint8Array,
  ) {
    this.handshakeInfo = analyzeFirstMS2Packet(firstPacket)
    const { version, blockIV, serverIV, clientIV } = this.handshakeInfo

    Verbose(`First packet: ${
      firstPacket.toHex()
    }\nInfo: ${
      JSON.stringify(this.handshakeInfo, null, 2)
    }`)

    const getEncryptor = (isServer: boolean) => new MapleCipherEncryptor(
      BigInt(version),
      BigInt(isServer ? serverIV : clientIV),
      BigInt(blockIV),
      false,
    )

    const getDecryptor = (isServer: boolean) => new MapleCipherDecryptor(
      BigInt(version),
      BigInt(isServer ? serverIV : clientIV),
      BigInt(blockIV),
      false,
    )

    this.encryptor = {
      client: getEncryptor(false),
      server: getEncryptor(true),
    }
    this.decryptor = {
      client: getDecryptor(false),
      server: getDecryptor(true),
    }

    this.encryptor.server.nextIV()
    this.decryptor.client.nextIV()

  }

  public get isKMS2() {
    return this.handshakeInfo.version >= 2000
  }

  public handlePacket(
    packet: Uint8Array,
    from: "server" | "client",
  ) {
    if (from === "server") {
      return this.handlePacketIncoming(packet)
    }
    return this.handlePacketOutgoing(packet)
  }

  protected handlePacketIncoming(
    packet: Uint8Array,
  ) {
    // Verbose(`[Server->Client] Original Packet: ${packet.toHex()}`)
    const decrpytedPacket = copyPacket(
      packet,
    )

    // Decrypt
    this.decryptor.client.decrypt(decrpytedPacket)

    Verbose(`[Server->Client] Decrypted packet: ${toHexSeperate(decrpytedPacket, 100)}`)

    const packetReader = new ByteReader(decrpytedPacket, 6)

    const opcode = packetReader.readShort()
    const opcodeInfo = OpcodeInfoList.inMap.get(opcode)

    if (opcodeInfo?.ignoreLog === false) {
      Verbose(`[Server->Client] Opcode: ${opcodeInfo.name}(${to16(opcode)})`)
    }

    if (opcode === 0x0078) {
      // Character Info
      const parsedPacket = readCharInfo(packetReader)
      if (this.rootInstance.lastReqCharId === parsedPacket.characterId) {
        this.rootInstance.trophyRankIndex += 1
      }
      this.rootInstance.charInfoWorker.postMessage(
        decrpytedPacket
      )
    }


    // server -> client
    this.encryptor.server.nextIV()
    this.decryptor.client.nextIV()

    // Verbose(`[Server->Client] Transfer Packet: ${packet.toHex()}`)
    return packet
  }

  protected logPacketIncoming() {

  }

  protected handlePacketOutgoing(
    packet: Uint8Array,
  ) {
    // Verbose(`[Client->Server] Original Packet: ${packet.toHex()}`)

    const decrpytedPacket = copyPacket(
      packet,
    )

    // Decrypt
    this.decryptor.server.decrypt(decrpytedPacket)

    const packetPreview = toHexSeperate(decrpytedPacket, 100)

    Verbose(`[Client->Server] Decrypted packet: ${packetPreview}`)

    const packetReader = new ByteReader(decrpytedPacket, 6)

    const opcode = packetReader.readShort()
    const opcodeInfo = OpcodeInfoList.outMap.get(opcode)

    if (opcodeInfo?.ignoreLog === false) {
      Verbose(`[Client->Server] Opcode: ${opcodeInfo.name}(${to16(opcode)})`)
    }

    let modifyPacket: Uint8Array | null = null
    
    const instrumentOpcode = getInstrumentOpcode(this.isKMS2)

    if (opcode === 0x0011) {
      packetReader.readUInt() // 00000000
      const text = packetReader.readUnicodeString()
      Info(`[Client->Server] Chat: ${text}`)

      // const modifyText = `[Steve]: ${text}`
      const modifyText = text

      modifyPacket = makeChatPacket(decrpytedPacket, modifyText, this.isKMS2)
    } else if (opcode === instrumentOpcode) {
      const trophyRanks = this.rootInstance.trophyRanks
      const trophyIndex = this.rootInstance.trophyRankIndex
      if (trophyIndex < trophyRanks.length) {
        // 인덱스가 적은 경우에만 조회
        const cid = trophyRanks[trophyIndex].characterId
        if (cid !== this.rootInstance.lastReqCharId) {
          modifyPacket = makeSearchCharPacket(decrpytedPacket, cid)
          this.rootInstance.lastReqCharId = cid
        }
      }

    } else if (opcode === 0x001E) {
      const readerTemp = new DataView(decrpytedPacket.buffer)
      const requestUID = readerTemp.getBigUint64(6, true)

      Info(`[Client->Server] OPCODE: ${opcode}, UID: ${requestUID}`)
    }
    

    if (modifyPacket != null) {
      const encryptor = new MapleCipherEncryptor(
        BigInt(this.handshakeInfo.version),
        this.decryptor.server.currentIV,
        BigInt(this.handshakeInfo.blockIV),
        false,
      )

      Info(`[Chat] orginal packet: ${toHexSeperate(packet, 100)}`)

      packet = encryptor.encryptRawPacket(modifyPacket)

      Info(`[Chat] modified packet: ${toHexSeperate(packet, 100)}`)
    }



    Info(`[Client->Server] OPCODE: ${opcode}, Content: ${packetPreview}`)


    // client -> server
    this.encryptor.client.nextIV()
    this.decryptor.server.nextIV()

    // Verbose(`[Client->Server] Transfer Packet: ${packet.toHex()}`)
    return packet
  }

  public toString() {
    return `[MS2PacketHandler(serverIV="${this.handshakeInfo.serverIV}", clientIV="${this.handshakeInfo.clientIV}", blockIV="${this.handshakeInfo.blockIV}")]`
  }
}

function toHexSeperate(bytes: Uint8Array, maxln = -1) {
  let hexPacket = ""

  for (let i = 0; i < bytes.length; i += 2) {
    hexPacket += bytes
      .subarray(i, i + 2)
      .toHex()
      .toUpperCase()
    hexPacket += "-"
    if (maxln > 0 && i >= maxln) {
      break
    }
  }
  if (maxln <= 0) {
    return hexPacket
  }

  hexPacket = hexPacket.substring(0, hexPacket.length - 1)
  return hexPacket
}

function to16(num: number) {
  return num.toString(16).padStart(2, "0")
}

