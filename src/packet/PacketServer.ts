import Bun from "bun"
import Debug from "debug"
import { isMessageEvent, PacketHandlerMap, type FlowEvent } from "./PacketHandler.ts"
import { loadTrophyRanks } from "./database/TrophyRankLoader.ts"
import { CharacterInfoDB } from "./database/CharacterInfoDB.ts"

export interface PacketData {
  messageId: string
  direction: "client_to_server" | "server_to_client"
  content_base64: string
  timestamp: number
}

const Verbose = Debug("ms2socket:verbose:PacketServer")
const Info = Debug("ms2socket:info:PacketServer")

export class PacketServer {
  protected readonly packetHandlerMap:PacketHandlerMap

  protected readonly customSaveWorker = new Worker(
    new URL("../worker/CustomSaveWorker.ts", import.meta.url), {
      type: "module",
    }
  )

  constructor(
    protected readonly port: number,
  ) {
    const charDB = new CharacterInfoDB(
      "./data/ms2char.db",
      false,
    )

    const storeCids = new Set(charDB.getCids())

    const storeMaxTrophy = charDB.getMaxRank()

    const trophyRanks = loadTrophyRanks()

    const trophyCids = trophyRanks.filter((value) => (!storeCids.has(value.characterId) && value.trophyRank > storeMaxTrophy))

    this.packetHandlerMap = new PacketHandlerMap(
      trophyCids, 
    )

    Verbose(trophyCids.length)

    charDB.close()
  }

  public listen() {
    Bun.serve({
      port: this.port,
      fetch(req, server) {
        // WebSocket 업그레이드 시도
        if (server.upgrade(req)) {
          return; // 성공 시 응답 없음
        }
        // 업그레이드 실패 시 일반 HTTP 응답
        return new Response("WebSocket upgrade failed", { status: 500 });
      },
      websocket: {
        open: (ws) => {
          return this.onOpen(ws)
        },
        message: (ws, message) => {
          return this.onMessage(ws, message)
        },
        close: (ws, code, reason) => {
          return this.onClose(ws, code, reason)
        },
        maxPayloadLength: 1024 * 1024 * 16, // 16MB
      },
      error: (error) => {
        return this.onError(error)
      },
    })

    Info(`[WebSocket] Starting WebSocket server on port ${this.port}...`)
  }

  protected onOpen(ws: Bun.ServerWebSocket<unknown>) {
    Info(`[WebSocket] Client connected: ${ws.remoteAddress}`);
  }

  protected async onMessage(ws: Bun.ServerWebSocket<unknown>, message: string | Uint8Array) {
    Verbose(`[WebSocket] Received message from ${ws.remoteAddress}`)

    let messageString: string
    if (message instanceof Uint8Array) {
      messageString = message.toString()
    } else {
      messageString = message
    }

    const packetData = JSON.parse(messageString) as FlowEvent


    try {
      const handleResult = this.packetHandlerMap.handleEvent(packetData)

      if (handleResult == null || !isMessageEvent(packetData)) {
        return
      }

      const resultAsBase64 = handleResult.map((packet) => packet.toBase64())

      const responseString = JSON.stringify({
        messageId: packetData.messageId,
        modified_segments_base64: resultAsBase64,
      })
      ws.send(responseString)

      Verbose(`[WebSocket] Sent echo response for messageId: ${packetData.messageId}`)

    } catch (error) {
      console.error(`[WebSocket] Error processing message from ${ws.remoteAddress}: ${error}`)
      console.error(`[WebSocket] Original message: ${messageString}`)
      if (isMessageEvent(packetData)) {
        // 오류 응답
        ws.send(JSON.stringify({
          messageId: packetData.messageId,
          modified_segments_base64: [],
          error: `Failed to parse message: ${error}`,
        }))
      }
    }

  }

  protected onClose(ws: Bun.ServerWebSocket<unknown>, exitCode: number, reason: string) {
    Info(`[WebSocket] Client disconnected: ${ws.remoteAddress} code: ${exitCode}, reason: ${reason}`)
  }

  protected onError(error: Bun.ErrorLike) {
    Verbose(`[WebSocket] WebSocket error: ${error}`);
  }
}