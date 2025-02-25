import { expect, test } from "bun:test"
import { parseTime } from "./Util.ts"
import { TZDate } from "@date-fns/tz"
import { Timezone } from "./Config.ts"

test("Date Parsing is expected?", () => {
  const expectedDate = new TZDate(
    2025,
    1-1,
    12,
    12+3,
    51,
    Timezone,
  )

  const parsedTime = parseTime("2025년 1월 12일 오후 3시 51분")

  expect(
    {
      timeStr: parsedTime.toString(),
      timestamp: parsedTime.getTime(),
    }
  ).toEqual({
    timeStr: expectedDate.toString(),
    timestamp: expectedDate.getTime(),
  })
})