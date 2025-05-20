import Pako from "pako"
import type { WorkerInput } from "./WorkerHelper.ts"
import { decodeDds, parseHeaders } from "dds-parser"
import Sharp from "sharp"
import fs from "node:fs/promises"
import Debug from "debug"

export interface M2UMessage {
  ugcType: "Item" | "Icon",
  ugcFileName: string,
  ugcFileType: "png" | "m2u",
  ugcBytes: Uint8Array,
}

const Verbose = Debug("ms2archive:verbose:M2UWorker")

declare const self: Worker

async function handleMessage(msg: WorkerInput<M2UMessage>) {
  const filePath = `./data/Custom/${msg.data.ugcType}/${msg.data.ugcFileName.replace(/\.m2u$/, ".png")}`

  if (msg.data.ugcFileType === "png") {
    await fs.writeFile(
      filePath,
      msg.data.ugcBytes,
    )
    return
  }

  const inflatedDDS = Pako.inflate(msg.data.ugcBytes)

  const ddsInfo = parseHeaders(inflatedDDS.buffer as ArrayBuffer)
  const ddsImageInfo = ddsInfo.images[0]
  const width = ddsImageInfo.shape.width
  const height = ddsImageInfo.shape.height

  const rgba = decodeDds(
    inflatedDDS.slice(ddsImageInfo.offset, ddsImageInfo.offset + ddsImageInfo.length),
    ddsInfo.format,
    width,
    height,
  )


  await Sharp(rgba, {
    raw: {
      width: width,
      height: height,
      channels: 4,
    },
  }).png().toFile(filePath)

  Verbose(`[M2UWorker] written file ${
    filePath.substring(filePath.lastIndexOf("/"))}`)
}

self.onmessage = async (ev) => {
  return handleMessage(ev.data as WorkerInput<M2UMessage>)
}

/*
handleMessage({
  workIndex: 0,
  data: {
    ugcType: "Item",
    ugcFileName: "test.m2u",
    ugcFileType: "m2u",
    ugcBytes: await fs.readFile("B:/test.m2u"),
  }
})
*/