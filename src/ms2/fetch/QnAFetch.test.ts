import { expect, test } from "bun:test"
import { fetchPlayQnA } from "./QnAFetch.ts"

test("QnA 페이지 파싱 테스트", async () => {
  const qnaPage = await fetchPlayQnA(5)
  if (qnaPage != null) {
    console.log(JSON.stringify(qnaPage, null, 2))
  }

  expect(qnaPage.length).toBe(10)
})