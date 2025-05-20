import Debug from "debug"
import { watch } from "fs"
import Path from "node:path"
import fs from "fs/promises"
import { sleep } from "bun"

/* eslint-disable @typescript-eslint/no-unused-vars */
declare const self: Worker

const dfPath = "C:/Nexon/MapleStory2"

const Info = Debug("ms2socket:info:customSaveWorker")

const DLPath = Path.resolve(process.env.MS2DIR ?? dfPath, "Custom/Download")

const watcher = watch(
  DLPath,
  { recursive: true },
  async (event, filename) => {
    if (event !== "rename" || filename == null) {
      return
    }

    const srcPath = Path.join(DLPath, filename)
    const destPath = Path.join("./data/custom", filename)
    await fs.mkdir(
      Path.dirname(destPath),
      {recursive: true},
    )

    try {
      const srcStat = await fs.stat(srcPath)
      if (!srcStat.isFile()) {
        return
      }

      await sleep(2000)
      await fs.copyFile(srcPath, destPath)
      Info(`Resource ${filename} saved to "${destPath}"!`)
    } catch (err) {
      Info(`Resource ${filename} failed with "${err}"!`)
    }
  }
)