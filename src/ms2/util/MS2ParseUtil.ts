import { TZDate } from "@date-fns/tz"
import { Timezone } from "../Config.ts"

function getFirstOrNull<T>(arr: T[] | T | null | undefined) {
  if (arr == null) {
    return null
  }
  if (!Array.isArray(arr)) {
    return arr
  }
  if (arr.length <= 0) {
    return null
  }
  return arr[0]
}

function parse12Hour(hour12: number) {
  if (hour12 === 12) {
    return 0
  }
  return hour12
}

/**
 * String에서 Number을 추출합니다.
 * @param arr string 혹은 string[]
 * @returns number 
 */
export function extractNumber(arr: string[] | string | null | undefined) {
  const first = getFirstOrNull(arr)
  const value = getFirstOrNull(first?.match(/\d+/))
  return value == null ? null : Number(value)
}

/**
 * '12345', '14678' 처럼 ''로 묶여진 string들을 number[]롤 바꿔줍니다.
 * @param arr 
 * @returns number[]
 */
export function extractQuoteNum(str: string | null | undefined) {
  if (str == null) {
    return []
  }
  const arr = str.match(/'\d+'/g)
  if (arr == null) {
    return []
  }
  return arr.map((v) => Number(v.substring(1, v.length - 1)))
}

/**
 * 게시글의 `2024년 1월 1일 오후 1시 30분`을 변환
 * @param timeStr 
 * @returns 
 */
export function parseTime(timeStr: string) {
  const year = extractNumber(timeStr.match(/\d+년/))
  const month = extractNumber(timeStr.match(/\d+월/))
  const day = extractNumber(timeStr.match(/\d+일/)) 

  const isAM = timeStr.indexOf("오전") >= 0
  const isPM = timeStr.indexOf("오후") >= 0
  if (isAM === isPM) {
    throw new Error("Date Parsing Error: No AM/PM")
  }

  const rawHour12 = extractNumber(timeStr.match(/\d+시/))
  const minute = extractNumber(timeStr.match(/\d+분/))

  // null 처리
  if (
    year == null || 
    month == null ||
    day == null ||
    rawHour12 == null ||
    minute == null
  ) {
    throw new Error("Date Parsing error: " + timeStr)
  }

  const hour = parse12Hour(rawHour12) + (isAM ? 0 : 12)

  const parsedDate = new TZDate(
    year,
    month - 1,
    day,
    hour,
    minute,
    Timezone,
  )

  return parsedDate
}

/**
 * 게시글의 `2024.11.17 23:05`를 파싱
 * @param timeStr 타임 String
 */
export function parseSimpleTime(timeStr: string) {
  let ymdSplitter = "."
  if (timeStr.indexOf("-") >= 0) {
    ymdSplitter = "-"
  }
  const ymd = timeStr.substring(0, timeStr.indexOf(" "))
  const hm = timeStr.substring(timeStr.lastIndexOf(" ") + 1)
  const ymdArr = ymd.split(ymdSplitter)
  const hmArr = hm.split(":")

  return new TZDate(
    Number(ymdArr[0]),
    Number(ymdArr[1]) - 1,
    Number(ymdArr[2]),
    Number(hmArr[0]),
    Number(hmArr[1]),
    Timezone,
  )
}

export function joinOrNull(arr: string[] | undefined | null) {
  if (arr == null) {
    return null
  }
  if (arr.length <= 0) {
    return null
  }
  return arr.join(",")
}

export function parseLevel(levelstr: string) {
  const level = extractNumber(levelstr.match(/Lv\.\d+/)) ?? -1
  return level
}