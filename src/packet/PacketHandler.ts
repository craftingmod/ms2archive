import { MS2PacketHandler } from "./MS2PacketHandler.ts"
import type { PacketData } from "./PacketServer.ts"
import Debug from "debug"


const Verbose = Debug("ms2socket:verbose:PacketHandler")
const handlerMap = new Map<string, MS2PacketHandler>()

export function handlePacketOld(packetData: PacketData): Uint8Array {
  const { socketUID, messageIndex } = splitSocketIdAndIndex(packetData)
  const packet = Uint8Array.fromBase64(packetData.content_base64)

  const handler = handlerMap.get(socketUID)
  Verbose(`SocketUID: ${socketUID}, Index: ${messageIndex}, PacketLength: ${packet.length}`)
  
  if (handler == null) {
    handlerMap.set(socketUID, new MS2PacketHandler(
      packet
    ))
    return packet
  }

  Verbose(`Packet: ${toHexSeperate(packetData.content_base64, 50)}`)

  const fromWhere = packetData.direction === "client_to_server" ? "client" : "server"
  return handler.handlePacket(packet, fromWhere)
}

export function copyPacket(packetBytes: Uint8Array) {
  return new Uint8Array(packetBytes)
}

function splitSocketIdAndIndex(packetData: PacketData) {
  const messageId = packetData.messageId
  const postfixPart = messageId.substring(messageId.indexOf("_") + 1)
  return {
    socketUID: messageId.substring(0, messageId.indexOf("_")),
    messageIndex: Number(
      (postfixPart.match(/(\d+)/) ?? ['-1'])[0]
    ),
  }
}

function toHexSeperate(base64: string, maxln = -1) {
  const rawPacket = Uint8Array.fromBase64(base64).toHex()
  let hexPacket = ""
  
  for (let i = 0; i < rawPacket.length; i += 2) {
    hexPacket += rawPacket.substring(i, i + 2).toUpperCase()
    hexPacket += "-"
    if (maxln > 0 && i >= maxln) {
      break
    }
  }
  hexPacket = hexPacket.substring(0, hexPacket.length - 1)
  return hexPacket
}

export interface TCPAddress {
  host: string
  port: number
}

export class PacketHandlerMap {
  protected readonly handlerMap = new Map<string, PacketHandler>()

  public handleEvent(
    packetEvent: FlowStartEvent | FlowMessageEvent | FlowEndEvent,
  ) {
    switch (packetEvent.event) {
      case "flow_start":
        return this.handleEventStart(packetEvent)
      case "flow_message":
        return this.handleEventMessage(packetEvent)
      case "flow_end":
        return this.handleEventEnd(packetEvent)
      default:
        throw new Error(`Unknown event: ${packetEvent}`)
    }
  }

  protected handleEventStart(packetEvent: FlowStartEvent) {
    this.handlerMap.set(packetEvent.flowId, new PacketHandler(
      packetEvent.flowId,
      tcpAddress(packetEvent.server_address),
      tcpAddress(packetEvent.client_address),
    ))

    return null
  }

  protected handleEventMessage(packetEvent: FlowMessageEvent) {
    const handler = this.handlerMap.get(packetEvent.flowId)
    if (handler == null) {
      Verbose(`[EventMessage] Handler not found for flowId: ${packetEvent.flowId}`)
      throw new Error(`Handler of ${packetEvent.flowId} not found`)
    }

    const encodedPackets = [] as Uint8Array[]
    for (const base64Packet of packetEvent.segments) {
      const bytesPacket = Uint8Array.fromBase64(base64Packet)
      encodedPackets.push(
        handler.handlePacket(
          bytesPacket,
          packetEvent.direction === "client_to_server" ? "client" : "server",
        )
      )
    }

    return encodedPackets
  }

  protected handleEventEnd(packetEvent: FlowEndEvent) {
    this.handlerMap.delete(packetEvent.flowId)

    return null
  }
}

function tcpAddress(param: [string, number]) {
  return {
    host: param[0],
    port: param[1],
  } satisfies TCPAddress
}

export function isMessageEvent(flowEvent: FlowEvent): flowEvent is FlowMessageEvent {
  return flowEvent.event === "flow_message"
}

export class PacketHandler {
  protected ms2Handler: MS2PacketHandler | null = null

  constructor(
    protected readonly flowId: string,
    protected readonly serverAddr: TCPAddress,
    protected readonly clientAddr: TCPAddress,
  ) {

  }

  public handlePacket(packet: Uint8Array, from: "server" | "client") {
    if (this.ms2Handler == null) {
      // init with first packet
      this.ms2Handler = new MS2PacketHandler(packet)
      return packet
    }
    return this.ms2Handler.handlePacket(packet, from)
  }
}

export type FlowEvent = FlowStartEvent | FlowMessageEvent | FlowEndEvent

export interface FlowStartEvent {
  event: "flow_start",
  flowId: string,
  client_address: [string, number],
  server_address: [string, number],
  timestamp: number,
}

export interface FlowMessageEvent {
  event: "flow_message",
  messageId: string,
  flowId: string,
  direction: "client_to_server" | "server_to_client",
  segments: string[], // base64 array
  timestamp: number,
}

export interface FlowEndEvent {
  event: "flow_end",
  flowId: string,
}