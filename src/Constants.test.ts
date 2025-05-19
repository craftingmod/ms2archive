import { test, expect } from "bun:test"
import { rootDir } from "./Constants.ts"
import fs from "node:fs/promises"
import Path from "node:path"
import pako from "pako"

// const inflateRaw = promisify(zlib.inflateRaw)

test("Is root directory correct?", () => {
  expect(
    rootDir.substring(rootDir.lastIndexOf(Path.sep) + 1)
  ).toBe("ms2archive")
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