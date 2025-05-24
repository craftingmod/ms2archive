import { profileURLPrefix } from "../ms2/util/MS2FetchUtil.ts"
import { CharacterInfoDB } from "../ms2/storage/CharacterInfoDB.ts"
import { decodeCharacterInfoPacket, extractUgcItemLook } from "../packet/defintion/charinfo/DefCharInfo.ts"
import { CustomReader } from "../packet/defintion/CustomReader.ts"
import Debug from "debug"
import fs from "node:fs/promises"
import { SmallWorkerHelper } from "../worker/WorkerHelper.ts"
import type { M2UMessage } from "../worker/M2UWorker.ts"
import { sleep } from "bun"
import { fetchBlob } from "../ms2/fetch/GenericFetch.ts"
import { } from "@supercharge/promise-pool"

const Verbose = Debug("ms2archive:verbose:ugc")

const workerFactory = new SmallWorkerHelper<M2UMessage>(
  new URL("../worker/M2UWorker.ts", import.meta.url),
  9
)

export async function runUGC() {
  const charInfo = new CharacterInfoDB("./data/ms2char.db", true)
  const ugcURL = charInfo.getPackets().flatMap((packet) => {
    const reader = new CustomReader(packet.rawPacket)
    reader.readShort() // opcode

    try {
      const info = decodeCharacterInfoPacket(reader)

      const ugcInfo = extractUgcItemLook(info)
      if (ugcInfo.length > 0) {
        return ugcInfo.map((v) => v.ugcUrl)
      }
    } catch {
      // console.error(err)
      errors += 1
      Verbose(`Parse error: ${packet.characterId}`)
      const decoder = new TextDecoder("utf-16")
      const atomicStr = decoder.decode(packet.rawPacket)
      const atomicM2U = atomicStr.match(/item[A-Za-z0-9/-]+\.m2u/g)
      if ((atomicM2U?.length ?? 0) > 0) {
        return atomicM2U!
      }
    }
  })

  let errors = 0

  Verbose(`Length: ${ugcURL.length}, error: ${errors}`)

  const itemPath = "./data/Custom/Item"
  const iconPath = "./data/Custom/Icon"
  await fs.mkdir("./data/Custom/Item", { recursive: true })
  await fs.mkdir("./data/Custom/Icon", { recursive: true })

  let processIndex = 0

  for (const url of ugcURL) {
    const fileName = url.substring(url.lastIndexOf("/") + 1, url.length)
    const pngFilename = fileName.replace(".m2u", ".png")

    if (
      await fs.exists(`${itemPath}/${pngFilename}`) &&
      await fs.exists(`${iconPath}/${pngFilename}`)
    ) {
      processIndex++;
      continue
    }

    Verbose(`Processing ${fileName} (${processIndex++}/${ugcURL.length})`)

    let itemBlob: { blob: Blob } | null = null

    try {
      itemBlob = await fetchBlob(
        `${profileURLPrefix}${url}`
      )
    } catch {
      continue
    }

    if (itemBlob == null) {
      Verbose(`${url} Image not found!`)
      continue
    }

    const itemBuffer = new Uint8Array(await itemBlob.blob.arrayBuffer())
    workerFactory.request([{
      ugcType: "Item",
      ugcFileName: fileName,
      ugcFileType: "m2u",
      ugcBytes: itemBuffer,
    }])

    const iconURL = url.replace("item/", "itemicon/").replace(".m2u", ".png")

    let iconBlob: { blob: Blob } | null = null

    try {
      iconBlob = await fetchBlob(
        `${profileURLPrefix}${iconURL}`
      )
    } catch {
      continue
    }

    if (iconBlob == null) {
      Verbose(`${url} Image not found!`)
      continue
    }

    const iconBuffer = new Uint8Array(await iconBlob.blob.arrayBuffer())
    workerFactory.request([{
      ugcType: "Icon",
      ugcFileName: fileName,
      ugcFileType: "png",
      ugcBytes: iconBuffer,
    }])

  }

  await sleep(10000)
  workerFactory.close()
}

runUGC()