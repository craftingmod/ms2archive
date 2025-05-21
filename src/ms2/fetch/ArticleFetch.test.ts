import { expect, test } from "bun:test"
import { fetchArticle, fetchArticleList, fetchLatestArticleId } from "./ArticleFetch.ts"
import { BoardCategory } from "./BoardRoute.ts"
import { Job, parseJobFromIcon } from "../struct/MS2Job.ts"
import fs from "node:fs/promises"

test.skip("기본 게시글 파싱", async () => {
  const parsedArticle =  await fetchArticle(
    BoardCategory.Free,
    193158,
  )
  console.log(parsedArticle)

  expect({
    author: parsedArticle?.author,
    title: parsedArticle?.title,
    commentCount: parsedArticle?.commentCount,
  }).toEqual({
    author: {
      job: Job.Berserker,
      level: 88,
      nickname: "선택",
    },
    title: "지스타 가서 절 하고 왔읍니다..",
    commentCount: 22,
  })
}, 3000)

test.skip("공략 게시판 및 태그 파싱", async () => {
  const parsedArticle = await fetchArticle(
    BoardCategory.Knowhow,
    17767,
  )
  console.log(parsedArticle)

  expect({
    tags: parsedArticle?.tags,
    commentCount: parsedArticle?.commentCount,
  }).toEqual({
    tags: ["기타", "섭종", "서비스종료", "썹종", "메2망함"],
    commentCount: 9,
  })
})

test.skip("GM 댓글 오류 체크", async () => {
  const parsedArticle = await fetchArticle(
    BoardCategory.Free,
    179454,
  )
  console.log(parsedArticle)

  if (parsedArticle == null) {
    throw new Error("Article MUST NOT BE NULL")
  }

  const GMComment = parsedArticle.comments[5]

  await fs.writeFile("./test.txt", parsedArticle.content)

  expect({
    authorName: GMComment.authorName,
    id: GMComment.commentIndex,
  }).toEqual({
    authorName: "ico_gm_pe.png",
    id: 9,
  })
})

test.skip("가장 마지막 게시글 번호 TEST", async () => {
  const lastArticleId = await fetchLatestArticleId(
    BoardCategory.News
  )
  if (lastArticleId == null) {
    throw new Error("Parser should be not null!")
  }
  expect(lastArticleId).toBeGreaterThan(620000)
})

test.skip("가장 마지막 게시글 번호 TEST2 (ARTWORK)", async () => {
  const lastArticleId = await fetchLatestArticleId(
    BoardCategory.Artwork
  )
  expect(lastArticleId).toBeGreaterThan(30000)
})

test.skip("게시글 목록 파싱 테스트", async () => {
  const articles = await fetchArticleList(BoardCategory.News, 114)
  console.log(articles)

  expect(articles?.length ?? -1).toEqual(2)
})

test.skip("게시글 a 첨부 테스트", async () => {
  const article = await fetchArticle(
    BoardCategory.News,
    583707,
  )
  console.log(article)

  expect(article?.attachments ?? []).toBeArrayOfSize(5)
}, 20000)

test.skip("패치노트 파싱 테스트", async () => {
  const article = await fetchArticle(
    BoardCategory.Patchnote,
    208,
  )
  console.log(article)

  expect(article?.title ?? "").toBe("2/20(목) 패치노트 - 서비스 종료 안내")
})

test.skip("상점 목록 파싱 테스트", async () => {
  const articleList = await fetchArticleList(BoardCategory.Cashshop, 1)
  console.log(articleList)

  expect(articleList).toBeArrayOfSize(8)
})

test.skip("상점 게시글 파싱 테스트", async () => {
  const article = await fetchArticle(BoardCategory.Cashshop, 28)
  console.log(article)

  expect(article?.title).toBe("3월 23일 새롭게 출시되는 아이템을 소개합니다.")
}, 20000)

test("이벤트 게시글 파싱 테스트", async () => {
  const article = await fetchArticleList(BoardCategory.Events, 4)
  console.log(article)

  expect(article?.length).toBe(8)
}, 20000)

test.skip("타임아웃 테스트", async () => {
  const request = await fetchArticle(BoardCategory.Notice, 262)

  expect({
    title: request?.title
  }).toEqual({
    title: "4월 3주차 작업장 제재자 리스트",
  })
}, 20000)

test.skip("없는 게시글 처리", async () => {
  const noArticle = await fetchArticle(
    BoardCategory.Free,
    999999,
  )
  expect(noArticle).toBeNull()
})

test("직업 구별 테스트", () => {
  const jobURL = "https://ssl.nexon.com/S2/Game/maplestory2/MAVIEW/ranking/ico_priest.png"

  expect(parseJobFromIcon(jobURL)).toBe(Job.Priest)
})