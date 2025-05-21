import { load as loadDOM } from "cheerio"
import type { Element } from "domhandler"
import { extractNumber, parseSimpleTime } from "../util/MS2ParseUtil.ts"
import Path from "node:path/posix"
import Bun from "bun"
import fs from "fs/promises"
import { fetchBlob, fetchText } from "./GenericFetch.ts"
import { fetchMS2Text } from "./MS2BaseFetch.ts"
import { parseJobFromIcon } from "../struct/MS2Job.ts"
import type { EventComment } from "../storage/ArchiveStorage.ts"

type FullscreenEventData = Awaited<ReturnType<typeof fetchFullScreenEvent>>

const archiveDir = "./data/fse"


// 20220609 : svelte 스크립트 태그에 `defer` attribute 추가
// 20191024: head에 <script>$(() => bg_effect())</script> 추가

export async function fetchFullScreenEvent(url: string, idOverride: string | null = null) {
  if (!url.startsWith("https://maplestory2.nexon.com/")) {
    throw new Error("URL must start with maplestory2.nexon.com!")
  }
  const response = await fetchMS2Text(url.substring(30))
  if (response == null) {
    throw new Error("Response must be not null!")
  }

  const $ = loadDOM(response)

  //  ---------------- //
  // attachments
  const imageResources:string[] = []

  const favicon = $(`head > link[rel='icon']`).attr("href") ?? null

  const getOGMeta = (property: string) => $(`meta[property='og:${property}']`).attr("content") ?? null

  const getMeta = (name: string) => $(`meta[name='${name}']`).attr("content") ?? null

  const metaTitle = getMeta("title") ?? $("title").text().trim()

  const metaDescription = getMeta("description")

  const metaKeyword = getMeta("keywords")

  const metaThumbnail = getOGMeta("image")
  if (metaThumbnail != null) {
    imageResources.push(metaThumbnail)
  }

  const selectElement = (query: string, attribute: string) => $<Element, string>(query).map((_: number, el: Element) => {
    return $(el).attr(attribute) ?? ""
  }).toArray().filter((v) => {
    return (v.indexOf("maplestory2") >= 0) || (v.indexOf("ms2") >= 0)
  })

  const headScripts = selectElement("head > script", "src")
  const bodyScripts = selectElement("body > script", "src")

  const headStyles = selectElement("head > link[rel='stylesheet']", "href")

  // 이벤트 ID 생성
  const eventIdNumeric = extractNumber(/\/\d+?\//i.exec(url)) ?? 0
  const eventIdString = url.substring(url.lastIndexOf("/") + 1)

  const bodyDivs = $("body > div").map((i: number, el: Element) => $(el).prop("outerHTML")).toArray()

  return {
    eventId: (idOverride != null ? idOverride : `${eventIdNumeric}_${eventIdString}`),
    metaData: {
      favicon,
      title: metaTitle,
      description: metaDescription,
      keyword: metaKeyword,
      thumbnail: metaThumbnail,
    },
    scripts: {
      head: headScripts,
      body: bodyScripts,
    },
    styles: {
      head: headStyles,
    },
    images: [
      ...queryImageResources(response),
    ],
    content: bodyDivs.filter((html) => html != null && html.indexOf("gnbWrapper") < 0).join("\n\n"),
  }
}

function isCommonResources(url: string) {
  return /\/\d+\//i.exec(url) == null
}

function string2Base64(str: string) {
  const utf8Bytes = new TextEncoder().encode(str)

  return utf8Bytes.toBase64() as string
}

export function queryImageResources(content: string) {
  const regex = /https?:\/\/[^"]+?\.(?:png|jpg|gif|svg)/ig
  const matches = content.match(regex)
  if (matches == null) {
    return [] as string[]
  }
  return matches
}

export function relative(from: string, to: string) {
  const relativePath = Path.relative(from, to)
  if (from.indexOf("/") < 0) {
    return relativePath.replaceAll("\\", "/")
  }

  const filename = from.substring(from.lastIndexOf("/") + 1)
  if (filename.indexOf(".") >= 0) {
    return Path.relative(from.substring(0, from.lastIndexOf("/") + 1), to).replaceAll("\\", "/")
  }

  return relativePath.replaceAll("\\", "/") 
}

export class FSEFetcher {
  public fseList = [] as FullscreenEventData[]
  /**
   * CSS, Script, Image를 모두 포함한 Link -> Local Resource Map
   */
  protected resMap = new Map<string, string>()

  protected commonName: string | null = "common"

  private readonly fetchOver = true
  private readonly useExist = true

  public constructor(
    protected forceCommon = false,
  ) {

  }

  public async fetchFSE(url: string, idOverride: string | null = null, commonOverride?:string) {
    if (commonOverride !== undefined) {
      this.commonName = commonOverride
    }
    // 위 파싱된 데이터
    const fseData = await fetchFullScreenEvent(url, idOverride)
    // 이벤트 코드
    const eventId = fseData.eventId

    if (eventId == null || fseData.content == null) {
      throw new Error("EventId must not be null!")
    }

    const toLocal = async (arr: string[], skipImageCheck: boolean) => {

      const localRes = await this.toLocalTextResource(
        arr,
        eventId,
        skipImageCheck
      )
      if (fseData.content == null) {
        return [] as string[]
      }
      for (let i = 0; i < localRes.length; i += 1) {
        const relativePath = relative(archiveDir, localRes[i])
        fseData.content = fseData.content.replaceAll(arr[i], relativePath)
      }
      return localRes
    }

    fseData.scripts.head = await toLocal(fseData.scripts.head, true)
    fseData.scripts.body = await toLocal(fseData.scripts.body, true)

    fseData.styles.head = await toLocal(fseData.styles.head, false)

    const toLocalImage = async (imageUrl: string) => {
      try {
        const localURL = await this.fetchResource(
          imageUrl, eventId
        )
        if (fseData.content != null) {
          const relativePath = relative(archiveDir, localURL)
          fseData.content = fseData.content.replaceAll(imageUrl, relativePath)
        }
        return localURL
      } catch (err) {
        console.error(err)
        return ""
      }
    }
    // MetaData 로컬화
    if (fseData.metaData.favicon != null) {
      fseData.metaData.favicon = await toLocalImage(fseData.metaData.favicon)
    }
    // 섬네일 로컬화
    if (fseData.metaData.thumbnail != null) {
      fseData.metaData.thumbnail = await toLocalImage(fseData.metaData.thumbnail)
    }
    // 이미지 로컬화
    for (let i = 0; i < fseData.images.length; i += 1) {
      fseData.images[i] = await toLocalImage(fseData.images[i])
    }

    this.fseList.push(fseData)

    await this.writeFile(
      Path.resolve(archiveDir, `${eventId}.html`),
      this.buildHTML(fseData)
    )
  }

  protected async writeFile(path: string, input: Blob | string | Uint8Array) {
    if (this.useExist && await fs.exists(path)) {
      return 0
    }
    return Bun.write(path, input, {
      createPath: true,
    })
  }

  protected async toLocalTextResource(resArr: string[], eventId: string, skipImageCheck: boolean) {
    const localResArr = new Array<string>(resArr.length)
    for (let i = 0; i < resArr.length; i += 1) {
      if (this.resMap.has(resArr[i])) {
        localResArr[i] = this.resMap.get(resArr[i])!
        continue
      }
      const localPath = await this.fetchTextResource(resArr[i], eventId, skipImageCheck)
      localResArr[i] = localPath
    }

    return localResArr
  }

  protected async fetchTextResource(url: string, eventId: string, skipImageCheck: boolean) {

    if (this.resMap.has(url)) {
      return this.resMap.get(url)!
    }

    // css/js 내용
    let content = await fetchText(url)
    if (content == null) {
      throw new Error("응답이 NULL입니다!")
    }
    // Path 확정
    const localPath = await this.getLocalPathSafety(url, eventId, Bun.hash(content))

    // js면 스킵
    if (skipImageCheck) {
      await this.writeFile(localPath,content)
      this.resMap.set(url, localPath)
      return localPath
    }

    // css 안 이미지 로컬화
    const images = queryImageResources(content)
    for (const imageURL of images) {
      try {
        const localURL = await this.fetchResource(imageURL, eventId)
        content = content.replaceAll(imageURL, relative(localPath, localURL))
      } catch (err) {
        console.error(err)
        content = content.replaceAll(imageURL, "")
      }
    }

    // css 저장
    await this.writeFile(localPath, content)

    this.resMap.set(url, localPath)
    return localPath
  }

  /**
   * URL 리소스를 로컬 리소스로 변환합니다.
   * @param url URL
   * @param eventId local 리소스 그룹
   * @returns 로컬 리소스 경로
   */
  protected async fetchResource(url: string, eventId: string) {
    const localPath = await this.fetchResourceInternal(url, eventId)

    // Javascript로 ON/OFF 하는 경우가 너무 많아서 하드코딩
    if (url.indexOf("_on.") >= 0) {
      try {
        await this.fetchResourceInternal(url.replace("_on.", "_off."), eventId)
      } catch (err) {
        console.error(err)
      }
    }

    // Javascript로 ON/OFF 하는 경우가 너무 많아서 하드코딩
    if (url.indexOf("_off.") >= 0) {
      try {
        await this.fetchResourceInternal(url.replace("_off.", "_on."), eventId)
      } catch (err) {
        console.error(err)
      }
    }

    // over도 하드코딩
    if (this.fetchOver && url.indexOf(".png") >= 0) {
      try {
        await this.fetchResourceInternal(url.replace(".png", "_over.png"), eventId)
      } catch (err) {
        console.error(err)
      }
    }


    return localPath
  }

  protected async fetchResourceInternal(url: string, eventId: string) {

    if (this.resMap.has(url)) {
      return this.resMap.get(url)!
    }

    // 리소스 다운로드
    const resource = await fetchBlob(url)

    if (resource == null) {
      throw new Error(`${url} is null!`)
    }

    const localPath = await this.getLocalPathSafety(url, eventId, Bun.hash(await resource.blob.arrayBuffer()))

    await this.writeFile(
      localPath,
      resource.blob as unknown as Blob,
    )

    this.resMap.set(url, localPath)

    return localPath
  }

  protected getLocalPath(url: string, eventId: string, hash: bigint | number) {
    if (url.indexOf("?") >= 0) {
      url = url.substring(0, url.indexOf("?"))
    }
    const isCommonRes = (this.commonName != null) && (isCommonResources(url) || this.forceCommon)
    const divide2byte = (typeof hash === "bigint") ? Number(hash % 65536n) : (hash % 65536)
    const hexPostfix = divide2byte.toString(16).toUpperCase().padStart(4, "0")
    const filenameExt = url.substring(url.lastIndexOf("/") + 1)
    const ext = filenameExt.substring(filenameExt.lastIndexOf("."))
    const filename = filenameExt.substring(0, filenameExt.lastIndexOf("."))

    const filenameWithHash = `${filename}_${hexPostfix}${ext}`

    const localPath = [
      archiveDir,
      "res",
      isCommonRes ? (this.commonName ?? "common") : String(eventId),
    ]


    return {
      isCommonRes,
      localPath: [...localPath, filenameExt].join("/"),
      hashedPath: [...localPath, filenameWithHash].join("/"),
    }
  }

  protected async getLocalPathSafety(url: string, eventId: string, hash: bigint | number) {
    const { localPath, hashedPath } = this.getLocalPath(url, eventId, hash)
    if (!this.useExist && (await fs.exists(localPath))) {
      return hashedPath
    }
    return localPath
  }

  protected buildHTML(data: FullscreenEventData) {
    return `
<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta content="text/html; charset=utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.metaData.title}</title>
    <meta name="title" content="${data.metaData.title}">
    <meta name="description" content="${data.metaData.description}">
    <meta name="keywords" content="${data.metaData.keyword}">
    <meta property="og:image" content="${relative(archiveDir, data.metaData.thumbnail ?? "")}">
    <meta property="og:title" content="${data.metaData.title}">
    <meta property="og:description" content="${data.metaData.description}">
    <link rel="icon" href="${relative(archiveDir, data.metaData.favicon ?? "")}">

    ${data.styles.head.map((v) => `<link rel="stylesheet" type="text/css" href="${relative(archiveDir, v)}">`).join("\n    ")}

    ${data.scripts.head.map((v) => `<script src="${relative(archiveDir, v)}" type="text/javascript"></script>`).join("\n    ")}
  </head>
  <body>
    ${data.content}

    ${data.scripts.body.map((v) => `<script src="${relative(archiveDir, v)}" type="text/javascript"></script>`).join("\n    ")}

    <script>
      document.querySelector("#btnGameStart").addEventListener("click", () => alert("서비스 종료."))
      var socialPlugin = () => alert("구현되지 않음.")
    </script>
    <script>
      const rawData = "${string2Base64(data.content)}";
    </script>
  </body>
</html>
    `
  }
}


export async function fetchEventComments(eventIndex: number, page = 1) {
  const rawHTML = await fetchMS2Text(
    `Events/_20190725/_PartialCommentList?pn=${page}&id=${eventIndex}&ls=30&bn=commentevents`
  )

  // 404
  if (rawHTML == null) {
    return null
  }

  const root$ = loadDOM(rawHTML)

  const commentsDOM = root$("ul > li").toArray()

  const eventComments = [] as EventComment[]

  for (const singleDOM of commentsDOM) {
    const $ = loadDOM(singleDOM)

    const charImage = $(".char_img img").attr("src") ?? ""

    let charId = -1n
    let imagePath = ""
    if (charImage.length > 0 && charImage.indexOf("/profile/") >= 0) {
      const imagePart1 = charImage.substring(charImage.indexOf("/profile/") + 9)
      const imagePart2 = imagePart1.split("/")
      charId = BigInt(imagePart2[2])

      const imageBlob = await fetchBlob(charImage)

      if (imageBlob != null) {
        imagePath = `data/images/fullevents/${eventIndex}/${charId}_${imagePart2[3]}`

        await Bun.write(Path.resolve(imagePath), imageBlob.blob as unknown as Blob, {
          createPath: true,
        })
      }
    }

    const charJob = parseJobFromIcon($(".char_info .job").attr("src") ?? "")

    const charName = $(".char_info .nickname").text().trim()

    const createdAt = parseSimpleTime(
      $(".char_info .date").text().trim()
    )

    const content = $(".comment").text().trim()

    eventComments.push({
      eventIndex,
      commentIndex: -1,
      content,
      authorId: charId,
      authorName: charName,
      authorJob: charJob,
      authorThumb: charImage,
      createdAt: createdAt.getTime(),
    } satisfies EventComment)
  }

  return eventComments
}
