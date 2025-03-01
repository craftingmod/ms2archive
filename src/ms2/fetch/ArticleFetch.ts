import { load as loadDOM, type CheerioAPI } from "cheerio"
import { requestBlob, requestMS2Get } from "./BaseFetch.ts"
import { BoardRoute, type BoardCategory } from "./BoardRoute.ts"
import { extractNumber, extractQuoteNum, parseSimpleTime, parseTime } from "../Util.ts"
import { parseJobFromIcon } from "../base/MS2Job.ts"
import { parseLevel } from "../base/MS2Level.ts"
import type { MS2Author } from "../base/MS2Author.ts"
import { Element } from "domhandler"
import type { MS2Comment } from "../base/MS2Comment.ts"
import { replaceStyle } from "./StyleReplacer.ts"
import Bun from "bun"

export type MS2Article = NonNullable<Awaited<ReturnType<typeof fetchArticle>>>

/**
 * 게시글을 파싱합니다.
 * @param board 
 * @param articleId 
 * @returns 
 */
export async function fetchArticle(board: BoardCategory, articleId: number) {
  // Route마다 다른 파서
  const boardRoute = BoardRoute[board]  
  const rawHTML = await requestMS2Get(
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
  const writtenTime = parseTime(
    $(".board_info1 .time").text()
  )
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
    return $(el).attr("src")
  }).toArray()

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
  while (comments.length < commentCount) {
    const commentHTML = await requestMS2Get(
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

  return {
    articleId,
    title,
    content: replaceStyle(body.trim()),
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
  // Route마다 다른 파서
  const boardRoute = BoardRoute[board]  
  // 깡 HTML
  const rawHTML = await requestMS2Get(
    boardRoute.listRoute
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

  // 타입 오류 있음
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hrefs = $(boardRoute.hrefSelector as any).map((_:number, el:Element) => {
    const postfix = $(el).attr("href")
    if (postfix == null) {
      return -1
    }
    return extractNumber(postfix.match(/(s|sn)=\d+/)) ?? -1
  }).toArray()

  const mValue = Math.max(...hrefs)

  if (mValue === -1) {
    return null
  }
  if (plus1) {
    return mValue + 1
  }
  return mValue
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
    const url = article.attachments[i]

    let extension: string
    let binary: Blob | Uint8Array
    if (url.startsWith("data:")) {
      extension = url.substring(url.indexOf("/") + 1, url.indexOf(";"));
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        binary = (Uint8Array as any).fromBase64(url.substring(
          url.indexOf("base64") + 7,
        )) as Uint8Array
      } catch (err) {
        console.error(err)
        writtenPath.push(null)
        continue
      }
    } else if (url.startsWith("http")) {
      try {
        const req = await requestBlob(url)
        extension = req.extension
        binary = req.blob as Blob
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