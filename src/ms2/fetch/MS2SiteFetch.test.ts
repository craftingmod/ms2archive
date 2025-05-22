import { expect, test } from "bun:test"
import { fetchGuestBook } from "./MS2SiteFetch.ts"

test("방명록 파싱 테스트", async () => {
  const guestbookFetch = await fetchGuestBook(process.env.MS2TOKEN ?? "", 318663n, 1)

  console.log(guestbookFetch)

  expect(guestbookFetch?.commentCount).toBeGreaterThan(0)
}, 10000)