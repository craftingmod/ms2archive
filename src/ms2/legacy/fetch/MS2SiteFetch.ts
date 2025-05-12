import type { RawGuestBookInfo } from "../database/GuestBookInfo.ts"
import { WorldChatType } from "../database/WorldChatInfo.ts"
import { MS2ItemTier, MS2Tradable, type MS2CapsuleItem } from "../ms2gatcha.ts"
import { gatchaPostfix, getTierFromText, getTradableFromText, guestbookPostfix, ms2BrowserHeader, postfixToURL, queryJobFromIcon, worldChatPostfix } from "../util/MS2FetchUtil.ts"
import { fetchMS2, fetchMS2Formatted } from "./MS2BaseFetch.ts"

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

export async function fetchCapsuleList(capsuleId: number) {
  return fetchMS2Formatted({
    fetchOptions: {
      postfix: `${gatchaPostfix}/${capsuleId}`,
    },
  }, ($) => {
    // Row 
    const trs = $(".p_item2 > tbody").find("tr").get()
    const result: { [key in string]?: MS2CapsuleItem[] } = {}
    let categoryName = "없음"
    for (const row of trs) {
      const $row = $(row)
      const tds = $row.find("td").get()
      // 아이템
      const item: MS2CapsuleItem = {
        itemName: "",
        itemTier: MS2ItemTier.NORMAL,
        itemTrade: MS2Tradable.ACCOUNT_BOUND,
        quantity: 0,
        chancePercent: 0,
      }
      let offset = 0
      for (let i = 0; i < tds.length; i += 1) {
        const $column = $(tds[i])
        if (i === 0 && Number($column.attr("rowspan") ?? "0") > 0) {
          // 분류
          categoryName = $column.text().trim()
          offset += 1
          continue
        }
        // 데이터 넣기
        const text = $column.text().trim()
        switch (i - offset) {
          case 0:
            item.itemName = text
            break
          case 1:
            item.itemTier = getTierFromText(text)
            break
          case 2:
            item.itemTrade = getTradableFromText(text)
            break
          case 3:
            item.quantity = Number.parseInt(text.substring(0, text.length - 2))
            break
          case 4:
            item.chancePercent = Number.parseFloat(text.substring(0, text.length - 1))
            break
          default:
            throw new Error("Unknown column")
        }
      }
      // Result에 넣기
      if (result[categoryName] === undefined) {
        result[categoryName] = []
      }
      result[categoryName]?.push(item)
    }
    return result
  })
}

export async function fetchGuestBook(token: string, aid: bigint, page = 1) {
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
      const commentDate = new Date(commentDateRaw.year, commentDateRaw.month - 1, commentDateRaw.day)
      // 댓글 ID
      const commentId = Number($el.find(".report > a > img").attr("data-seq") ?? "-1")
      // 집주인 댓글일 시에는 마지막 커맨트에 추가
      if ($el.attr("class") === "owner") {
        if (comments.length >= 1) {
          const prevComment = comments[comments.length - 1]
          prevComment.replyComment = comment
          prevComment.replyCommentDate = commentDate
          continue
        }
      }
      // 집주인 여부
      const isOwner = $el.find("h3 > strong > img").attr("alt") === "집주인"
      // 닉네임
      const nickname = $el.find("h3 > strong").text().trim()
      // 직업
      const job = queryJobFromIcon($el.find("h3 > span > img").attr("src") ?? "")
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
        commentDate,
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