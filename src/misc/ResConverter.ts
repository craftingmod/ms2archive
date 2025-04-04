import { readdir } from "node:fs/promises"
import Bun, { sleep } from "bun"
import Path from "node:path"
import { WorkerHelper } from "../worker/WorkerHelper.ts"
import { fetchArticle, writeImages } from "../ms2/fetch/ArticleFetch.ts"
import type { BoardCategory } from "../ms2/fetch/BoardRoute.ts"
import * as Bmp from "bmp-ts"
import sharp from "sharp"
import fs from "fs/promises"
import { fileURLToPath } from "node:url"

const brokenAvif = fileURLToPath(
  import.meta.resolve("../../res/broken.avif")
)

const orgPath = fileURLToPath(
  import.meta.resolve("../../data/images")
)

// const jxlPath = Path.resolve(orgPath, "../jxlImages")
// const avifPath = Path.resolve(orgPath, "../avifImages")

export async function convertImages(sourcePath: string, destPath:string) {
  const fileList = await readdir(sourcePath, { recursive: true })
  fileList.sort()

  const jpgFiles = [] as string[]
  const pngFiles = [] as string[]
  const gifFiles = [] as string[]
  const etcFiles = [] as string[]
  for (const file of fileList) {
    if (file.endsWith(".jpg") || file.endsWith(".jpeg")) {
      jpgFiles.push(file)
    } else if (file.endsWith(".png")) {
      pngFiles.push(file)
    } else if (file.endsWith(".gif")) {
      gifFiles.push(file)
    } else if (file.indexOf(".") >= 0) {
      etcFiles.push(file)
    }
  }

  console.log(`Files: ${fileList.length}, jpg: ${jpgFiles.length}, png: ${pngFiles.length}, gif: ${gifFiles.length}, etc: ${etcFiles.length}`)

  const queryPaths = [jpgFiles, pngFiles, gifFiles]

  for (const paths of queryPaths) {
    const relPath = {
      basePath: sourcePath,
      relPaths: paths,
    } satisfies RelPath

    const resDir = await readResourceDir(
      relPath, destPath
    )

    await convertToAVIF({
      basePath: relPath.basePath,
      relPaths: resDir.failPaths,
    }, destPath)
    await sleep(1000)
  }
}

export async function convertLefts(sourcePath: string, destPath:string) {
  const analyzedPaths = await validateResources(sourcePath, destPath)

  for (const binaryPath of analyzedPaths.failPaths) {
    const ext = extName(binaryPath)
    const absPath = Path.resolve(sourcePath, binaryPath)
    const destRawPath = Path.resolve(destPath, binaryPath)

    console.log(`Path: ${absPath}, dirname: ${Path.dirname(destRawPath)}`)

    await fs.mkdir(Path.dirname(destRawPath), {recursive: true})


    const extPath = (ext: string) => pathWithExt(destRawPath, ext)
    if (ext.length <= 0) {
      continue
    }
    console.log(`extpath: ${extPath("avif")}`)

    // Remove corrupted file
    const dummyFile = Bun.file(
      Path.resolve(destPath, binaryPath)
    )
    if (await dummyFile.exists()) {
      await dummyFile.delete()
    }

    if (ext === "bmp") {
      const bytes = await Bun.file(absPath).bytes()
      const decodedBmp = Bmp.decode(Buffer.from(bytes))
      await sharp(decodedBmp.data, {
        raw: {
          width: decodedBmp.width,
          height: decodedBmp.height,
          channels: 4,
        }
      }).avif().toFile(extPath("avif"))
      continue
    }
    if (ext === "webp" || ext === "jpeg;charset=UTF-8") {
      await sharp(absPath).avif()
        .toFile(extPath("avif"))
      continue
    }
    if (ext === "x-zip-compressed") {
      await fs.copyFile(
        absPath,
        extPath("zip")
      )
      continue
    }
    // Broken
    await fs.copyFile(
      brokenAvif,
      extPath("avif")
    )
    continue
  }
}

export async function validateResources(source: string, dest: string) {
  const result = await readResourceDir(
    await readDirFiles(source),
    dest,
  )
  return result
}

export async function fixInvalidImages() {
  const fileList = await readDirStat(orgPath)

  const fileStats = fileList.relStats.filter((stat) => {
    const path = stat.relPath
    if (path.endsWith(".png") || path.endsWith(".jpg") || path.endsWith(".jpeg")) {
      return stat.size <= 0
    }
    return false
  })

  const articleInfoes = fileStats.map((stat) => {
    const splitPath = stat.relPath.split(/[/\\]/)
    const articleId = splitPath[splitPath.length - 2]
    const articleCat = splitPath[splitPath.length - 3]
    return {
      articleId,
      articleCat,
    }
  })

  for (const articleInfo of articleInfoes) {
    console.log(`Fetching: ${articleInfo.articleCat}/${articleInfo.articleId}`)

    const article = await fetchArticle(
      toUpperCaseFirst(articleInfo.articleCat) as BoardCategory,
      Number(articleInfo.articleId)
    )
    if (article == null) {
      continue
    }

    await writeImages(article)
  }
}

export async function convertToAVIF(sourcePaths: RelPath, destBasePath: string) {
  const { basePath, relPaths } = await readDirStat(sourcePaths)

  const worker = new WorkerHelper<{source: string, dest: string}, string>(
    new URL("./ImageWorker.ts", import.meta.url) as URL,
    8,
  )
  worker.onCompleteOne = (value, done) => {
    console.log(`Processed: ${value} (${done} / ${relPaths.length})`)
  }
  const convertFiles = relPaths.map((path) => ({
    source: Path.resolve(basePath, path),
    dest: Path.resolve(destBasePath, pathWithExt(path, "avif")),
  }))

  await worker.request(convertFiles)
  await sleep(3000)
  worker.close()
}

interface RelPath {
  basePath: string,
  relPaths: string[],
}

interface RelStat {
  relPath: string,
  size: number,
  isDirectory: boolean,
}

const acceptableExt = ["avif", "jxl", "zip"]

async function readResourceDir(sourcePath: RelPath, destDirPath: string) {

  const existPaths = [] as string[]
  const failPaths = [] as string[]

  const distStats = await readDirStat(destDirPath)

  const distSet = new Set<string>()
  for (const stat of distStats.relStats) {
    if (!stat.isDirectory && stat.size > 0) {
      distSet.add(stat.relPath)
    }
  }

  for (const relPath of sourcePath.relPaths) {
    let added = false
    for (const ext of acceptableExt) {
      if (distSet.has(
        pathWithExt(relPath, ext)
      )) {
        added = true
        existPaths.push(relPath)
        break
      }
    }
    if (!added) {
      failPaths.push(relPath)
    }
  }

  return {
    basePath: sourcePath.basePath,
    existPaths,
    failPaths,
  }
}

/**
 * List all files in directory with relative path
 */
async function readDir(dirPath: string) {
  return {
    basePath: dirPath,
    relPaths: await readdir(dirPath, { recursive: true }),
  } satisfies RelPath
}

async function readDirFiles(dirPath: string) {
  const stats = await readDirStat(dirPath)
  return {
    basePath: dirPath,
    relPaths: stats.relStats.filter((stat) => stat.size > 0 && !stat.isDirectory).map((f) => f.relPath),
  } satisfies RelPath
}

/**
 * List all files in directory with stats
 */
async function readDirStat(dirPath: string | RelPath) {

  let dirRelPaths:RelPath
  if (typeof dirPath === "string") {
    dirRelPaths = await readDir(dirPath)
  } else {
    dirRelPaths = dirPath
  }
  const {basePath, relPaths} = dirRelPaths
  
  const relStats = [] as Array<{
    relPath: string,
    size: number,
    isDirectory: boolean,
  }>

  for (const relPath of relPaths) {
    const file = Bun.file(
      Path.resolve(basePath, relPath)
    )
    const stat = await file.stat()
    relStats.push({
      relPath,
      size: stat.size,
      isDirectory: stat.isDirectory(),
    })
  }

  return {
    basePath,
    relPaths,
    relStats,
  } satisfies RelPath & {relStats: RelStat[]}
}

/**
 * Path -> Path with ext
 */
function pathWithExt(path: string, ext: string) {
  return path.replace(
    /\..+$/i, `.${ext}`)
}

function extName(path: string) {
  const query = path.match(/\..+$/i)
  if (query == null) {
    return ""
  }
  return query[0].substring(1)
}

function toUpperCaseFirst(str: string) {
  if (str.length <= 1) {
    return str.toUpperCase()
  }
  return `${str.charAt(0).toUpperCase()}${str.substring(1)}`
}
