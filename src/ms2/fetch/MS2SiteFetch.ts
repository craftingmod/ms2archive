import type { RawGuestBookInfo } from "../database/GuestBookInfo.ts"
import { WorldChatType } from "../database/WorldChatInfo.ts"
import { guestbookPostfix, ms2BrowserHeader, postfixToURL, worldChatPostfix } from "../util/MS2FetchUtil.ts"
import { fetchMS2, fetchMS2Formatted } from "./MS2BaseFetch.ts"
import { parseJobFromIcon } from "../struct/MS2Job.ts"
import { InvalidParameterError } from "./FetchError.ts"
import { TZDate } from "@date-fns/tz"
import { Timezone } from "../Config.ts"

/**
 * 월드 채팅을 파싱합니다.
 * @returns 
 */
export async function fetchWorldChat() {
  const { body, statusCode } = await fetchMS2({
    postfix: worldChatPostfix,
    noRetry302: true,
  })

  if (statusCode !== 200) {
    return []
  }

  const response = JSON.parse(body) as Array<{
    message: string,
    HHmm: string,
    time: string,
    ch_name: string,
    type: string,
  }>
  return response.map((v) => {
    let chatType = WorldChatType.Channel
    if (v.type.indexOf("channel") >= 0) {
      chatType = WorldChatType.Channel
    } else if (v.type.indexOf("world") >= 0) {
      chatType = WorldChatType.World
    }
    return {
      message: v.message,
      time: new Date(Number.parseInt(v.time) * 1000),
      nickname: v.ch_name,
      type: chatType,
    }
  })
}

export async function fetchGuestBook(token: string, aid: bigint, page = 1) {
  if (token.length <= 0) {
    throw new InvalidParameterError("Token is required!", "token")
  }
  return fetchMS2Formatted({
    fetchOptions: {
      postfix: guestbookPostfix,
      headers: {
        ...ms2BrowserHeader,
        "X-ms2-token": token,
        "Referer": postfixToURL(guestbookPostfix),
      },
      urlSearchParams: {
        s: String(aid),
        page: String(page),
      },
    }
  }, ($) => {
    // 방명록 응답 AID
    const guestBookAid = $("#hiddenOwner").attr("value")
    if (guestBookAid !== aid.toString()) {
      throw new Error(`Guestbook aid가 예상과 다릅니다. ${guestBookAid}`)
    }
    // 글 갯수
    const commentCountStr = $(".comment_section > .noti > strong").text().trim()
    const commentCount = Number((commentCountStr.match(/^\d+/i) ?? [0])[0])
    const commentsEl = $(".comment_section > div").get()
    const comments: RawGuestBookInfo[] = []
    for (let i = 0; i < commentsEl.length; i += 1) {
      const element = commentsEl[i]
      const $el = $(element)
      // 댓글 내용
      const comment = $el.find(".comment").text().trim()
      // 댓글 날짜
      const timeStr = $el.find(".time").text().trim().split("-")
      const commentDateRaw = {
        year: Number.parseInt(timeStr[0] ?? "1970"),
        month: Number.parseInt(timeStr[1] ?? "1"),
        day: Number.parseInt(timeStr[2] ?? "1"),
      }
      const commentDate = new TZDate(commentDateRaw.year, commentDateRaw.month - 1, commentDateRaw.day, Timezone)
      // 댓글 ID
      const commentId = Number($el.find(".report > a > img").attr("data-seq") ?? "-1")
      // 집주인 댓글일 시에는 마지막 커맨트에 추가
      if ($el.attr("class") === "owner") {
        if (comments.length >= 1) {
          const prevComment = comments[comments.length - 1]
          prevComment.replyComment = comment
          prevComment.replyCommentDate = commentDate.getTime()
          continue
        }
      }
      // 집주인 여부
      const isOwner = $el.find("h3 > strong > img").attr("alt") === "집주인"
      // 닉네임
      const nickname = $el.find("h3 > strong").text().trim()
      // 직업
      const job = parseJobFromIcon($el.find("h3 > span > img").attr("src") ?? "")
      // 레벨
      const level = Number($el.find("h3 > span").text().trim().substring(3))

      comments.push({
        commentId,
        ownerAccountId: BigInt(guestBookAid),
        nickname,
        comment,
        replyComment: null,
        replyCommentDate: null,
        job,
        level,
        commentDate: commentDate.getTime(),
        isOwner: isOwner ? 1 : 0,
      })
    }
    return {
      commentCount,
      page,
      comments,
    }
  })
}