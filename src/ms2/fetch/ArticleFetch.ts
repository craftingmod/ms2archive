import { load as loadDOM, type CheerioAPI } from "cheerio"
import { BoardRoute, BoardCategory } from "./BoardRoute.ts"
import { extractNumber, extractQuoteNum, parseSimpleTime, parseTime } from "../Util.ts"
import { parseJobFromIcon } from "../struct/MS2Job.ts"
import { parseLevel } from "../struct/MS2Level.ts"
import type { MS2Author } from "../struct/MS2Author.ts"
import type { Element } from "domhandler"
import type { MS2Comment } from "../struct/MS2Comment.ts"
import { replaceStyle } from "./StyleReplacer.ts"
import Bun from "bun"
import { TZDate } from "@date-fns/tz"
import { Timezone } from "../Config.ts"
import Path from "node:path"
import type { EventComment } from "../storage/ArchiveStorage.ts"
import { fetchMS2Text } from "./MS2BaseFetch.ts"
import { fetchBlob } from "./GenericFetch.ts"

export const UnknownTime = new TZDate(2025, 6, 7, 7, 7, Timezone)

export type MS2Article = NonNullable<Awaited<ReturnType<typeof fetchArticle>>>

const resourceExt = [
  "png", "jpg", "jpeg", "gif", "avif", "webp", "bmp",
  "mp4", "m4v", "webm",
  "m4a", "mp3", "ogg", "wma",
  "zip", "7z", "rar",
]

/**
 * 게시글을 파싱합니다.
 * @param board 
 * @param articleId 
 * @returns 
 */
export async function fetchArticle(board: BoardCategory, articleId: number, skipComment = false) {
  // Route마다 다른 파서
  const boardRoute = BoardRoute[board]  
  const rawHTML = await fetchMS2Text(
    boardRoute.detailRoute(articleId)
  )
  
  // 404
  if (rawHTML == null) {
    return null
  }

  const $ = loadDOM(rawHTML)

  // 게시글을 찾을 수 없음
  if ($(".not_found").length > 0) {
    return null
  }

  // 말도 안되는 게시글은 파싱 포기
  // https://maplestory2.nexon.com/Board/Proposal/DetailView?sn=67949
  if ($(".board_view_body > .board_view_header").length > 0) {
    return null
  }

  // 글 제목
  const title = $(".board_view_header .title").text().trim()
  // 글 작성시간
  const writtenTimeRaw = ($(".board_info1 .time").text() ?? "").trim()
  let writtenTime = UnknownTime
  if (writtenTimeRaw.length > 0) {
    writtenTime = parseTime(writtenTimeRaw)
  }
  // 글 조회수
  const viewed = extractNumber($(".board_info1 .hit").text()) ?? -1
  // 글 추천
  const liked = extractNumber($("#btnRecommendCount").text()) ?? -1

  // 작성자 직업
  const job = parseJobFromIcon(
    $(".board_info1 .writer .job").attr("src") ?? ""
  )
  // Lv.xx 사람
  const writerPart = $(".board_info1 .writer").text().trim()
  // GM 여부 (예외 처리)
  const isGM = writerPart.length <= 0
  // 작성자 레벨
  const level = isGM ? -1 : parseLevel(writerPart)
  // 작성자 이름
  let charName:string = "GM"
  // GM 아이콘 (예외 처리)
  let icon:string | undefined = undefined
  if (!isGM) {
    charName = writerPart.substring(writerPart.indexOf(" ") + 1).trim()
  } else {
    const imageIcon = $(".board_info1 .writer img").attr("src")
    if (imageIcon != null) {
      charName = "GM " + imageIcon.substring(imageIcon.lastIndexOf("/") + 1, imageIcon.lastIndexOf("."))
      icon = imageIcon
    }
  }

  // 태그
  const tags = $(".board_info1 .tag a").map((_: number, el: Element)=> {
    return $(el).text().trim().substring(1)
  }).toArray()


  // 글 내용
  const body = $(".board_view_body").html() ?? ""
  // 글 이미지 첨부파일 URL들
  const attachments = $(".board_view_body img").map((_:number, el:Element) => {
    return ($(el).attr("src") ?? "").trim()
  }).toArray().filter((v) => v.length > 0)

  // a로 링크한 리소스 백업
  const linkAttachments = $(".board_view_body a").map((_:number, el:Element) => {
    return ($(el).attr("href") ?? "").trim()
  }).toArray().filter((href) => {
    if (href == null || href.length <= 0) {
      return false
    }
    if (href.indexOf("file.nexon.com/") >= 0) {
      return true
    }
    if (href.indexOf(".") < 0) {
      return false
    }
    // a href가 확장자가 아는 확장자면
    const ext = href.substring(href.lastIndexOf(".") + 1)
    if (resourceExt.indexOf(ext) >= 0) {
      return true
    }

    return false
  })

  attachments.push(...linkAttachments)

  // 댓글 수
  let commentCount = extractNumber(
    $("#mv_comment .all").text()
  ) ?? -1
  // 댓글 페이지
  let commentPage = 2
  // 댓글 목록 
  const comments = [] as MS2Comment[]
  // 댓글 정보가 아예 없을 시 1페이지 직접 파싱
  if (commentCount === -1) {
    commentPage = 1
    commentCount = 999
  } else if (commentCount >= 1) {
    const cmt$ = loadDOM($("#mv_comment").html() ?? "<p></p>")
    comments.push(...parseComments(cmt$).comments)
  }

  // 댓글 더 불러오기
  while (comments.length < commentCount && !skipComment) {
    const commentHTML = await fetchMS2Text(
      boardRoute.commentRoute(articleId, commentPage)
    )
    if (commentHTML == null) {
      continue
    }

    // 댓글 불러오기
    const cmt$ = loadDOM(commentHTML)
    const subCmts = parseComments(cmt$)
    // 댓글 수 갱신
    commentCount = Math.min(commentCount, subCmts.commentCount)
    comments.push(...subCmts.comments)
    // 중단 조건
    if (subCmts.comments.length <= 0) {
      break
    }
    commentPage += 1
  }

  // 댓글 ID Fix
  for (let i = 0; i < comments.length; i += 1) {
    const cmt = comments[i]
    if (cmt.commentIndex !== -1) {
      continue
    }
    if (i === 0) {
      cmt.commentIndex = comments.length
      continue
    }
    // pseudo index
    cmt.commentIndex = comments[i-1].commentIndex - 1
  }

  // Content DOM 정리 유무
  let content = body.trim()
  if ((boardRoute.cleanupDOM ?? true)) {
    content = replaceStyle(content)
  }

  return {
    articleId,
    title,
    content,
    attachments,

    viewed,
    liked,
    tags,
    createdAt: writtenTime,

    author: {
      job,
      level,
      nickname: charName,
      icon,
    } as MS2Author,

    commentCount,
    comments,
    boardName: board,
  }
}

/**
 * Comment DOM으로부터 댓글을 파싱합니다.
 * @param $ DOM
 * @returns Comment[]
 */
export function parseComments($: CheerioAPI) {
  const comments:MS2Comment[] = $(".comment_list > li").map((_: number, el: Element) => {
    const subEl = $(el)

    let writer = subEl.find(".writer").text().trim()

    if (writer.length <= 0) {
      // GM
      const writerImage = subEl.find(".writer img").attr("src")
      if (writerImage == null) {
        writer = "GM"
      } else {
        writer = writerImage.substring(writerImage.lastIndexOf("/") + 1)
      }
    }

    const content = subEl.find(".comment").text().trim().replace(/\s+/g, " ")

    const createdAt = parseSimpleTime(
      subEl.find(".time").text().trim()
    )

    let commentIndex = -1

    const reportInfo = extractQuoteNum(
      subEl.find(".report_cb").attr("onclick")
    )

    if (reportInfo.length >= 2) {
      commentIndex = reportInfo[1]
    }

    return {
      authorName: writer,
      content,
      createdAt,
      commentIndex,
    }
  }).toArray()

  return {
    commentCount: extractNumber($(".all").text()) ?? -1,
    comments,
  }
}

/**
 * 게시판의 가장 마지막 글 번호를 가져옵니다.
 * @param board 게시판 종류
 * @returns 마지막 글 번호
 */
export async function fetchLatestArticleId(board: BoardCategory, plus1 = false) {
  const articleList = await fetchArticleList(board, 1)

  if (articleList == null || articleList.length <= 0) {
    return null
  }
  const mValue = Math.max(...articleList.map((v) => v.articleId))

  if (mValue === -1) {
    return null
  }
  if (plus1) {
    return mValue + 1
  }
  return mValue
}

/**
 * 게시글 목록에서 하나의 게시글
 */
export interface ArticleHeader {
  title: string,
  summary: string,
  articleId: number,
  likeCount: number,
  visitCount: number,
  thumbnail: string,
  rawHref: string,
}

export async function fetchArticleList(board: BoardCategory, page = 1) {
  // 상점은 다른 파서 리다이렉트
  if (board === BoardCategory.Cashshop) {
    return fetchShopItemList(page)
  }
  if (board === BoardCategory.Events) {
    return fetchEventsList(page)
  }


  // Route마다 다른 파서
  const boardRoute = BoardRoute[board]  
  // 깡 HTML
  const rawHTML = await fetchMS2Text(
    boardRoute.listRoute(page)
  )
  
  // 404
  if (rawHTML == null) {
    return null
  }

  const $ = loadDOM(rawHTML)

  // 게시글을 찾을 수 없음
  if ($(".not_found").length > 0) {
    return null
  }

  const articlesDOM = $(boardRoute.articleSelector).toArray()
  const articles:ArticleHeader[] = []
  
  for (const article of articlesDOM) {
    const $article = loadDOM(article)

    const hrefURL = $article("a").attr("href") ?? ""
    const articleId = extractNumber(hrefURL.match(/(s|sn)=\d+/)) ?? -1

    const likeCount = extractNumber(
      ($article(".like").text() ?? "").trim()
    ) ?? -1

    const visitCount = extractNumber(
      ($article(".hit").text() ?? "").trim()
    ) ?? -1

    const titleRaw = ($article(".title").text() ?? "").trim()
    let title = titleRaw
    if (titleRaw.indexOf("\n") >= 0) {
      title = titleRaw.substring(0, titleRaw.indexOf("\n")).trim()
    }

    const summary = ($article(".desc").text() ?? "").trim()

    // 섬네일 추출 (섬네일만 필요하면 raw img 쿼리)
    let thumb = $article(".thumb img").attr("src") ?? ""
    if ((boardRoute.listAsThumb ?? false) && (thumb.length <= 0)) {
      thumb = $article("img").attr("src") ?? ""
    }

    articles.push({
      title,
      summary,
      articleId,
      likeCount,
      visitCount,
      thumbnail: thumb,
      rawHref: hrefURL,
    })
  }

  return articles
}

export async function fetchShopItemList(page = 1) {
  // Route마다 다른 파서
  const boardRoute = BoardRoute[BoardCategory.Cashshop]  
  // 깡 HTML
  const rawHTML = await fetchMS2Text(
    boardRoute.listRoute(page)
  )
  
  // 404
  if (rawHTML == null) {
    return null
  }

  const $ = loadDOM(rawHTML)

  // 게시글을 찾을 수 없음
  if ($(".not_found").length > 0) {
    return null
  }

  const articlesDOM = $(boardRoute.articleSelector).toArray()
  const articles:ArticleHeader[] = []

  for (const article of articlesDOM) {
    const $article = loadDOM(article)

    const hrefURL = $article("dt > a").attr("href") ?? ""
    const articleId = extractNumber(hrefURL.match(/(s|sn)=\d+/)) ?? -1

    const title = ($article("dd > .con_center > h1").text() ?? "").trim()

    const summary = ($article("dd > .con_center > div").text() ?? "").trim()

    // 섬네일 추출 (섬네일만 필요하면 raw img 쿼리)
    const thumb = $article("dt img").attr("src") ?? ""

    articles.push({
      title,
      summary,
      articleId,
      likeCount: -1,
      visitCount: -1,
      thumbnail: thumb,
      rawHref: hrefURL,
    })
  }

  return articles
}

export async function fetchEventsList(page = 1) {
   // Route마다 다른 파서
   const boardRoute = BoardRoute[BoardCategory.Events]  
   // 깡 HTML
   const rawHTML = await fetchMS2Text(
     boardRoute.listRoute(page)
   )
   
   // 404
   if (rawHTML == null) {
     return null
   }
 
   const $ = loadDOM(rawHTML)
 
   // 게시글을 찾을 수 없음
   if ($(".not_found").length > 0) {
     return null
   }
 
   const articlesDOM = $(boardRoute.articleSelector).toArray()
   const articles:ArticleHeader[] = []
 
   for (const article of articlesDOM) {
     const $article = loadDOM(article)
 
     const hrefURL = $article("li > a").attr("href") ?? ""
     const articleId = extractNumber(hrefURL.match(/(s|sn)=\d+/)) ?? -1
 
     const title = ($article("li .info .title").text() ?? "").trim()
 
     const summary = ($article("li .info .desc").text() ?? "").trim()
 
     // 섬네일 추출 (섬네일만 필요하면 raw img 쿼리)
     const thumb = $article("li .thumb img").attr("src") ?? ""
 
     articles.push({
       title,
       summary,
       articleId,
       likeCount: -1,
       visitCount: -1,
       thumbnail: thumb,
       rawHref: hrefURL,
     })
   }
 
   return articles
}

export async function fetchEventComments(eventIndex:number, page = 1) {
  const rawHTML = await fetchMS2Text(
    `Events/_20190725/_PartialCommentList?pn=${
        page}&id=${eventIndex}&ls=30&bn=commentevents`
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

/**
 * MS2Article의 이미지를 씁니다.
 * @param article 게시글
 * @returns 이미지 경로
 */
export async function writeImages(article: MS2Article) {
  if (article.attachments.length <= 0) {
    return []
  }

  const writtenPath = [] as Array<string | null>

  for (let i = 0; i < article.attachments.length; i += 1) {
    let url = article.attachments[i]
    // 공백 예외처리
    url = url.trim()
    // `//` 예외처리
    if (url.startsWith("//")) {
      url = `https:${url}`
    }

    let extension: string
    let binary: Blob | Uint8Array
    if (url.startsWith("data:")) {
      extension = url.substring(url.indexOf("/") + 1, url.indexOf(";"));
      try {
        binary = Uint8Array.fromBase64(url.substring(
          url.indexOf("base64") + 7,
        )) as Uint8Array
      } catch (err) {
        console.error(err)
        writtenPath.push(null)
        continue
      }
    } else if (url.startsWith("http")) {
      try {
        const req = await fetchBlob(url)
        if (req == null) {
          throw new Error(`${url} is null!`)
        }
        extension = req.extension
        binary = req.blob as unknown as Blob
      } catch (err) {
        console.error(err)
        writtenPath.push(null)
        continue
      }
    } else {
      // blob??
      console.error(`Unknown URL Schema: ${url}`)
      writtenPath.push(null)
      continue
    }



    const filename = `${article.articleId}_${(i+1).toString().padStart(3, "0")}.${extension}`
    const parentPath = `data/images/${article.boardName.toLowerCase()}/${article.articleId}`

    const imgFile = Bun.file(`./${parentPath}/${filename}`, {
      type: `image/${extension}`
    })

    if (!(await imgFile.exists())) {
      try {
        await Bun.write(imgFile, binary, {
          createPath: true,
        })
      } catch (err) {
        console.error(err)
      }
    }

    writtenPath.push(`${parentPath}/${filename}`)
  }

  return writtenPath
}