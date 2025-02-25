import { expect, test } from "bun:test"
import { fetchArticle, fetchLatestArticleId } from "./ArticleFetch.ts"
import { BoardCategory } from "../base/BoardRoute.ts"
import { Job } from "../base/MS2Job.ts"
import fs from "node:fs/promises"

test("기본 게시글 파싱", async () => {
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

test("공략 게시판 및 태그 파싱", async () => {
  const parsedArticle = await fetchArticle(
    BoardCategory.Knowhow,
    17774,
  )
  console.log(parsedArticle)

  expect({
    tags: parsedArticle?.tags,
    commentCount: parsedArticle?.commentCount,
  }).toEqual({
    tags: ["직업", "프리스트", "스킬"],
    commentCount: 2,
  })
})

test("GM 댓글 오류 체크", async () => {
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

test("가장 마지막 게시글 번호 TEST", async () => {
  const lastArticleId = await fetchLatestArticleId(
    BoardCategory.Free
  )
  expect(lastArticleId).toBeGreaterThan(193610)
})

/*
test("없는 게시글 처리", async () => {
  const noArticle = await fetchArticle(
    BoardCategory.Free,
    999999,
  )
  expect(noArticle).toBeNull()
})
*/