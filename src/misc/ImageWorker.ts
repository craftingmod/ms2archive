import Path from "node:path"
import { mkdir } from "node:fs/promises"
import Bun from "bun"
import fs from "node:fs/promises"
import type { WorkerInput, WorkerReturn } from "../worker/WorkerHelper.ts"
import { isAnimatedPath } from "./IsAnimated.ts"
import sharp from "sharp"
import { fileURLToPath } from "node:url"

declare const self: Worker

const dummyAvifPath = fileURLToPath(
  import.meta.resolve("../../res/1x1.avif")
)

self.onmessage = async (ev) => {
  const data = ev.data as WorkerInput<{
    source: string,
    dest: string,
  }>

  let dest = data.data.dest
  const source = data.data.source

  let errorStr = null as string | null

  try {
    // 디렉터리 생성
    await mkdir(Path.dirname(dest), { recursive: true })

    // 소스 유효성 검사
    const sourceFile = Bun.file(source)
    if (!(await sourceFile.exists())) {
      throw new Error("Source file not exist!")
    }
    if ((await sourceFile.stat()).size <= 0) {
      // 1x1 빈 파일로 처리
      await fs.copyFile(dummyAvifPath, dest)
      return
    }

    // 애니메이션 체크
    const isGifAnimated = await isAnimatedPath(
      source
    )

    const addParam = isGifAnimated ? [] : ["-frames:v", "1"]

    // 있으면 유효하지 않을 시만 삭제
    const file = Bun.file(dest)
    if (await file.exists()) {
      /*
      if (file.lastModified >= brokenTime && (await file.stat()).size > 0) {
        return
      }
        */
      if ((await file.stat()).size > 0) {
        return
      }
      await file.delete()
    }

    // 크기 체크
    let useAOM = false
    const imageInfo = await sharp(source).metadata()

    const imageWidth = imageInfo.width ?? 0
    const imageHeight = imageInfo.height ?? 0

    const toJXL = async () => {
      // JXL로 처리
      dest = pathWithExt(dest, "jxl")

      const jxlps = Bun.spawn({
        cmd: ["cjxl", source, dest, "--quiet"],
      })
      if (await jxlps.exited !== 0) {
        throw new Error("JXL Conversion failed!")
      }
    }

    // 하나라도 8704 넘으면 불가능
    if (imageWidth > 8704 || imageHeight > 8704) {
      if (isGifAnimated) {
        // 움직이는 건 실패
        throw new Error("No way to encode!")
      }
      await toJXL()
      return
    }

    // 움직이지 않는건 sharp로 시도
    if (!isGifAnimated) {
      try {
        await sharp(source)
          .withMetadata()
          .avif()
          .toFile(dest)
      } catch (err2) {
        console.error(err2)
        // cjxl로 처리
        await toJXL()
      }
      return
    }
    
    // AOM 사용여부 지정
    if (imageWidth < 64 || imageHeight < 64) {
      useAOM = true
    }

    // console.log(`Converting: AOM-${useAOM}, path-${source}`)

    const process = Bun.spawn({
      cmd: ["ffmpeg", "-i", source,
        "-c:v", useAOM ? "libaom-av1" : "libsvtav1",
        ...(useAOM ? ["-crf", "24"] : ["-preset", "4"]),
        "-fps_mode", "passthrough",
        ...(useAOM ? [] : ["-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2"]),
        ...addParam, dest
      ],
      stdout: "ignore",
      stderr: "pipe",
    })

    const ffmpegCode = await process.exited

    if (ffmpegCode !== 0) {
      const errText = await new Response(process.stderr).text()
      // Error!
      throw new Error(`ffmpeg exited with: ${ffmpegCode}, ${errText}`)
    }

    const addMeta = Bun.spawn({
      cmd: [
        "exiftool",
        "-charset",
        "utf8",
        "-tagsfromfile",
        source,
        dest
      ],
      stdout: "ignore",
      stderr: "ignore",
    })

    await addMeta.exited

    if (dest.endsWith(".avif")) {
      const backupPath = dest.replace(".avif", ".avif_original")
      if (await fs.exists(backupPath)) {
        await fs.rm(backupPath)
      }
    }
  } catch (err) {
    errorStr = `${String(err)}\n* Source:${source}`
  } finally {
    postMessage({
      result: dest,
      workIndex: data.workIndex,
      error: errorStr,
    } satisfies WorkerReturn<string>)
  }
}

function pathWithExt(path: string, ext: string) {
  return path.replace(
    /\.[A-Za-z-0-9]+$/ig, `.${ext}`)
}