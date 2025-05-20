import { test, expect } from "bun:test"
import fs from "node:fs/promises"
import pako from "pako"
import { decodeCharacterInfoPacket, extractUgcItemLook } from "./DefCharInfo.ts"
import { CustomReader } from "../CustomReader.ts"

test("Parsing charInfo Test", async () => {
  const charInfoPacket = await fs.readFile("./data/charinfo1.bin", {encoding: null})
  const charInfoReader = new CustomReader(charInfoPacket)
  charInfoReader.readShort() // opcode
  const parsedInfo = decodeCharacterInfoPacket(charInfoReader)

  await fs.writeFile("B:/output.json", JSON.stringify(
    parsedInfo, (k, v) => {
      if (typeof v === "bigint") {
        return String(v)
      }
      return v
    },  4))

  expect(
    parsedInfo
  ).toBeObject()
})

test("Parsing UGC Look", async () => {
  const charInfoPacket = await fs.readFile("./data/charinfo1.bin", {encoding: null})
  const charInfoReader = new CustomReader(charInfoPacket)
  charInfoReader.readShort() // opcode
  const parsedInfo = decodeCharacterInfoPacket(charInfoReader)

  const ugcInfo = extractUgcItemLook(parsedInfo)

  console.log(ugcInfo)

  expect(
    ugcInfo
  ).toBeArrayOfSize(3)
})

test("zlib test", async () => {
  const rootFolder = "G:/Nexon/MapleStory2/Custom/Download/Item"
  const destFolder = "./data/item"
  for (const filename of (await fs.readdir(rootFolder))) {
    const input = await fs.readFile(`${rootFolder}/${filename}`, {encoding: null})
    const output = pako.inflate(new Uint8Array(input.buffer))
    await fs.writeFile(`${destFolder}/${filename}.dds`, output)
  }


  expect(3).toBe(3)
})