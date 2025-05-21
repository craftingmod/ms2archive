import type { Cheerio } from "cheerio"
import { parseJobFromIcon } from "../struct/MS2Job.ts"
import { QnaAnswerPostfix, QnAPostfix } from "../util/MS2FetchUtil.ts"
import { extractNumber, parseDashTime, parseLevelWithName } from "../util/MS2ParseUtil.ts"
import { fetchMS2FormattedList } from "./MS2BaseFetch.ts"
import type { Element } from "domhandler"

export type UnpackArray<T> = T extends (infer U)[] ? U : T
export type QnAArticle = UnpackArray<Awaited<ReturnType<typeof fetchPlayQnA>>>

export async function fetchPlayQnA(page = 1) {
  return fetchMS2FormattedList({
    fetchOptions: {
      postfix: QnAPostfix,
      urlSearchParams: {
        page: String(page),
      },
    },
    listSelector: ".q_board_wrap > .q_board",
  }, async ($, $root) => {

    const questionId = extractNumber($.attr("id")) ?? -1

    const question = $.find(".question").text().trim()

    // 태그
    const tags = $.find(".tag a").map(
      (_, el) => $root(el).text().trim().substring(1)
    ).toArray()

    // 작성자 정보
    const writerJob = parseJobFromIcon(
      $.find("h3> .writer > .ico_job").attr("src") ?? ""
    )

    const writerLevelWithName = parseLevelWithName(
      $.find("h3 > .writer").text().trim()
    )

    const writerTimstamp = parseDashTime(
      $.find(".q_board > .about > .time").text().trim()
    )

    const answerCount = extractNumber(
      $.find(".bt_answer > .bt_a").text()
    ) ?? 0

    const answers = [] as Array<ReturnType<typeof parseAnswerPart>>

    if (answerCount >= 2) {
      let replyPage = 1
      while (answers.length < answerCount) {
        const replies = await fetchPlayQnaAnswer(questionId, replyPage++)
        answers.push(...replies)
      }
    } else if (answerCount === 1) {
      answers.push(
        parseAnswerPart(
          (str) => $.find(".answer_list > .default").find(str)
        )
      )
    }

    return {
      questionId,
      question: question,
      job: writerJob,
      level: writerLevelWithName.level,
      nickname: writerLevelWithName.name,
      // content: qInfo.content,
      tags,
      timestamp: writerTimstamp,
      answerCount,
      answers,
    }
  })
}

export async function fetchPlayQnaAnswer(requestId: number, seq = 1) {
  return fetchMS2FormattedList({
    fetchOptions: {
      postfix: QnaAnswerPostfix,
      urlSearchParams: {
        s: String(seq),
        so: String(requestId),
        tp: "open",
      },
    },
    listSelector: ".answer_li",
  }, ($) => {
    return parseAnswerPart((str) => $.find(str))
  })
}

function parseAnswerPart($: (str: string) => Cheerio<Element>) {

  const jobURL = $(".writer > img").attr("src")?.trim() ?? ""

  const writerJob = parseJobFromIcon(jobURL)

  const writerLevelWithName = parseLevelWithName(
    $(".writer").text().trim()
  )

  const timestamp = parseDashTime(
    $(".about > .time").text().trim()
  )

  const content = $(".answer").text().trim()

  const replyId = extractNumber($(".bt_like").attr("onclick")) ?? 0

  const replyLike = extractNumber(
    $(".bt_like span").text()
  ) ?? 0

  return {
    replyId,
    job: writerJob,
    level: writerLevelWithName.level,
    nickname: writerLevelWithName.name,
    content,
    replyLike,
    timestamp,
  }
}