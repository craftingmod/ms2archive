import type { Cheerio, CheerioAPI } from "cheerio"
import { Job, numberToJob } from "../struct/MS2CharInfo.ts"
import { MS2ItemTier, MS2Tradable } from "../ms2gatcha.ts"
import Debug from "debug"
import { WrongPageError } from "../fetch/FetchError.ts"

const verbose = Debug("ms2:verbose:ms2fetchutil")

export const ms2Domain = `maplestory2.nexon.com`
export const ms2BrowserHeader = {
  "User-Agent": "MapleStory2",
  "X-ms2-acc-sn": "0",
  "X-ms2-char-job": "0",
  "X-ms2-char-level": "10",
  "X-ms2-char-sn": "0",
  "X-ms2-char-name": "NAME",
  "X-ms2-char-world": "1",
  "X-ms2-guild-name": "",
  "X-ms2-guild-sn": "0",
  "X-ms2-window-type": "1",
}


// <type>Postfix: Relative by ms2Dmain
// <type>URLPrefix: Absolute URL prefix

// MS2 Server Routes
// =====================
export const trophyPostfix = `Rank/Character`
export const mainPostfix = `Main/Index`
export const bossClearedByDatePostfix = `Rank/Boss1`
export const bossClearedByRatePostfix = `Rank/Boss3`
export const bossClearedWithMemberPostfix = `Rank/Boss1Party`
export const starArchitectPostfix = `Rank/Architect`
export const guildTrophyPostfix = `Rank/Guild`
export const worldChatPostfix = `Now/GetMessage`
export const gatchaPostfix = `Probability/StoreView`
export const guestbookPostfix = `Guestbook`
export const darkStreamPostfix = `Rank/DarkStream`
export const pvpPostfix = `Rank/PVP`
export const guildPvPPostfix = `Rank/GuildPVP`
// ======================

const profileURLPrefix = `https://ua-maplestory2.nexon.com/`
const profileURLPrefixLong = `${profileURLPrefix}profile/`
const jobIconURLPrefix = `https://ssl.nexon.com/S2/Game/maplestory2/MAVIEW/ranking/`

/**
 * Binary search latest page by Gemini
 * @param queryFn query Function
 * @param startPage start page to search
 * @param fullPageItemCount 10 (MS2 uses fixed value)
 * @returns Latest page
 */
export async function searchLatestPage(
  queryFn: (page: number) => Promise<unknown[] | unknown | null>,
  startPage: number = 1,
  fullPageItemCount: number = 10,
) {
  const currentProbePage = Math.max(1, startPage)
  let lowerBoundAnchor = 0 // Highest page known to have a full list or any content if startPage wasn't full.
  let upperBoundEmptyPage: number | null = null // First page known to be empty.
  let anchor = 0 // Highest page confirmed to have any content.

  // --- 1페이지 확인 ---
  const page1Result = await queryFn(1)
  if (!pageHasActualContent(page1Result)) {
    return 0 // 1페이지에도 없음
  }

  // 1부터 시작
  anchor = 1
  lowerBoundAnchor = 1

  // 1페이지가 끝인지 검사
  if (isLikelyFullListPage(page1Result, fullPageItemCount) === false) {
    return 1
  }

  if (currentProbePage > 1) {
    const startPageResult = await queryFn(currentProbePage)
    if (pageHasActualContent(startPageResult)) {
      anchor = currentProbePage
      lowerBoundAnchor = currentProbePage
      if (isLikelyFullListPage(startPageResult,fullPageItemCount) === false) {
        return currentProbePage // 시작 페이지가 끝 페이지
      }
      // 최소 검색 설정
    } else {
      // 시작 페이지에 없어서 여기서부터 검색
      upperBoundEmptyPage = currentProbePage
      // lowerBoundAnchor remains 1 (page 1 was full). anchor remains 1.
      // Proceed to binary search with range [1, startPage - 1].
    }
  }

  // --- 상한값 찾기 ---
  if (upperBoundEmptyPage == null) {
    // 가장 마지막 페이지는 currentProbePage 보다 큼
    let expProbe = currentProbePage
    while (true) {
      lowerBoundAnchor = expProbe
      anchor = expProbe

      let nextExpProbe = expProbe * 2
      // 최소한 진행되게 예외 처리
      if (nextExpProbe <= expProbe) {
        nextExpProbe = expProbe + 1
      }

      if (nextExpProbe > Number.MAX_SAFE_INTEGER / 2) {
        upperBoundEmptyPage = nextExpProbe
        break
      }

      const result = await queryFn(nextExpProbe)
      if (pageHasActualContent(result)) {
        // 다음 검사 페이지
        anchor = nextExpProbe
        if (isLikelyFullListPage(result, fullPageItemCount) === false) {
          return nextExpProbe // 다음 검사 페이지 반환
        }
        expProbe = nextExpProbe
      } else {
        // 현재 페이지가 최대 페이지
        upperBoundEmptyPage = nextExpProbe
        break
      }
    }
  }

  // --- 바이너리 서치 ---
  // `anchor` holds the highest page found with content so far (could be from initial checks or exponential phase).
  // `lowerBoundAnchor` is the highest page from exponential phase known to be full (or 1).
  // `upperBoundEmptyPage` is the first page known to be empty.
  // The search range for binary search is effectively [lowerBoundAnchor, upperBoundEmptyPage - 1].
  // `anchor` will be refined during binary search.

  let low = lowerBoundAnchor
  let high = (upperBoundEmptyPage != null) ? upperBoundEmptyPage - 1 : anchor * 2

  if (anchor > high) {
    high = anchor
  }

  // Ensure low is not greater than high before starting binary search.
  if (low > high) {
    if (anchor > 0) {
      return anchor
    }
    if (anchor === 0) {
      return 0
    }
  }

  while (low <= high) {
    const mid = low + Math.floor((high - low) / 2)
    if (mid === 0) break

    if (mid > Number.MAX_SAFE_INTEGER) {
      high = mid - 1
      continue
    }

    const midResult = await queryFn(mid)
    if (pageHasActualContent(midResult)) {
      anchor = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }

  return anchor
}

/**
 * searchLatestPage - page has content?
 */
function pageHasActualContent(result: unknown[] | unknown | null): boolean {
  if (result === null) {
    return false
  }
  if (Array.isArray(result)) {
    return result.length > 0
  }

  return true
}

/**
 * searchLatestPage - is likely 10 elements page?
 */
function isLikelyFullListPage(
  result: unknown[] | unknown | null,
  fullListThreshold: number = 10
) {
  if (!Array.isArray(result)) {
    return null
  }
  return result.length === fullListThreshold
}

export async function searchLatestPageOld(queryFn: (page: number) => Promise<unknown[] | null>, startPage: number = 1) {
  let minPage = Math.max(startPage, 1)
  let maxPage = Math.max(startPage, 1)
  let determined = false
  // 1. Check the point of no query (결과가 없는 지점을 빠르게 탐색하여 대략적인 상한선 설정)
  while (true) {
      const queryInfo = await queryFn(minPage)
      if (queryInfo == null) {
        maxPage = minPage
        minPage /= 2
        break
      }
      if (queryInfo.length === 10) { // 페이지가 꽉 찼으면 (10개 항목 가정)
        minPage *= 2 // 탐색 범위를 두 배로 늘림
      } else if (queryInfo.length === 0) { // 페이지에 결과가 없으면
        maxPage = minPage // 현재 minPage를 상한선으로 설정
        minPage /= 2     // 이전 minPage (결과가 있었을 수 있는)로 돌아감
        break
      } else { // 페이지가 꽉 차지 않았지만 결과가 있으면 (0 < length < 10)
        determined = true // 마지막 페이지를 찾았다고 간주
        break
      }
  }
  if (!determined) {
    // 2. min-max binary search (이진 탐색으로 정확한 마지막 페이지 찾기)
    while (minPage < maxPage) {
      const midPage = Math.floor((minPage + maxPage) / 2)
      const clearedParties = await queryFn(midPage)
      // 반환값이 null이면 = 서버 에러면 값을 확신할 수 없으므로 종료
      if (clearedParties == null) {
        throw new Error("파싱값에 오류가 있습니다!")
      }

      if (clearedParties.length === 10) { // 중간 페이지가 꽉 찼으면
        minPage = midPage // 최소 범위를 중간 페이지로 올림 (중간 페이지 또는 그 이상에 답이 있음)
        if (minPage + 1 === maxPage) { // minPage와 maxPage가 인접하면 탐색 종료
          break
        }
      } else if (clearedParties.length === 0) { // 중간 페이지에 결과가 없으면
        maxPage = midPage // 최대 범위를 중간 페이지로 내림 (중간 페이지 미만에 답이 있음)
      } else { // 중간 페이지가 꽉 차지 않았지만 결과가 있으면 (0 < length < 10)
        minPage = midPage // 이 페이지가 마지막 페이지임
        maxPage = midPage
        break
      }
    }
  }
  // 3. Final Check (최종 확인)
  // 이진 탐색 후 minPage는 마지막 페이지이거나 그 직전 페이지일 수 있음
  const lastParties = await queryFn(minPage + 1)
  // 반환값이 null이면 = 서버 에러면 값을 확신할 수 없으므로 종료
  if (lastParties == null) {
    throw new Error("파싱값에 오류가 있습니다!")
  }

  if (lastParties.length >= 1) { // minPage + 1 에도 결과가 있으면
    return minPage + 1 // minPage + 1이 마지막 페이지
  } else {
    return minPage // minPage가 마지막 페이지
  }
}

/**
 * Construct postfix to MS2 URL string
 * @param postfix postfix
 * @returns Full URL string
 */
export function postfixToURL(postfix: string) {
  return `https://${ms2Domain}/${postfix}`
}

/**
 * Extract CharacterId from character profile image url
 * @param imageURL Image URL
 */
export function queryCIDFromImageURL(imageURL: string) {
  if (imageURL.length > 0 && imageURL.startsWith(profileURLPrefix)) {
    const queryURL = imageURL.substring(profileURLPrefix.length)
    const query = queryURL.split("/")
    if (query.length >= 4) {
      return BigInt(query[3] ?? "0")
    }
  }
  return -1n
}

/**
 * Construct star architect SearchParams from yyyymm (Ex. 202007) 
 * @param yyyymm yyyymm
 * @param nickname character query nickname
 * @returns SearchParam-like Record<string, string>
 */
export function constructHouseRankParams(yyyymm: number, nickname?: string | null) {
  const year = Math.floor(yyyymm / 100)
  const month = yyyymm % 100
  const monthPad = month.toString().padStart(2, "0")

  if (year < 2015 || year > 2026 || month > 12) {
    throw new Error(`Invalid date format: ${yyyymm}`)
  }

  const baseParam = {
    tp: "monthly",
    d: `${year}-${monthPad}-01`,
  }
  if (nickname == null) {
    return baseParam
  }
  return {
    ...baseParam,
    k: nickname,
  }
}

/**
 * Extract Job from character job icon url
 * @param iconURL Icon URL
 */
export function queryJobFromIcon(iconURL: string) {
  if (iconURL.startsWith(jobIconURLPrefix)) {
    let postfix = iconURL.substring(jobIconURLPrefix.length)
    postfix = postfix.substring(4)
    postfix = postfix.substring(0, postfix.indexOf(".png")).toLowerCase()
    return numberToJob(Number(postfix))
  } else {
    return Job.UNKNOWN
  }
}

/**
 * Query Level from Lv.xx
 * @param lvtext Lv.xx
 */
export function queryLevelFromText(lvtext: string) {
  if (lvtext.startsWith("Lv.") && lvtext.length >= 4) {
    return Number.parseInt(lvtext.substring(3))
  } else {
    return -1
  }
}

/**
 * Extract rank from DOM
 * @param $i DOM
 * @returns rank
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getRankFromElement($i: Cheerio<any>) {
  const rankStr = $i.find(".first_child").text().trim()
  let rank = -1
  if (rankStr.length <= 0) {
    rank = Number.parseInt(($i.find(".first_child > img").attr("alt")?.match(/\d+/) ?? ["0"])[0] ?? "0")
    if (Number.isNaN(rank)) {
      rank = -1
    }
  } else {
    rank = Number.parseInt(rankStr)
  }
  return rank
}


/**
 * Get tier from `item tier text`.
 * @param text item tier text
 * @returns MS2ItemTier
 */
export function getTierFromText(text: string) {
  const textMap: { [key in string]?: MS2ItemTier } = {
    "노멀": MS2ItemTier.NORMAL,
    "레어": MS2ItemTier.RARE,
    "엘리트": MS2ItemTier.EXCEPTIONAL,
    "엑설런트": MS2ItemTier.EPIC,
    "레전더리": MS2ItemTier.LEGENDARY,
    "에픽": MS2ItemTier.ASCENDENT,
  }
  return textMap[text] ?? MS2ItemTier.NORMAL
}

/**
 * Get tradable value from `tradable text`.
 * @param text tradable text
 * @returns MS2Tradable
 */
export function getTradableFromText(text: string) {
  const textMap: { [key in string]?: MS2Tradable } = {
    "거래가능": MS2Tradable.TRADEABLE,
    "계정 귀속": MS2Tradable.ACCOUNT_BOUND,
    "캐릭터 귀속": MS2Tradable.CHARACTER_BOUND,
  }
  return textMap[text] ?? MS2Tradable.ACCOUNT_BOUND
}

/**
 * validate table title from response
 * @param $ Cheerio DOM 
 * @param title contains title
 */
export function validateTableTitle($: CheerioAPI, title: string) {
  if (
    $(".table_info").length <= 0 ||
    !$(".table_info").text().includes(title)
  ) {
    verbose(`Title: ${$(".table_info").text().trim()
      }`)
    throw new WrongPageError(`Cannot find ${title} title.`)
  }
}

/**
 * Make postfix from profile URL
 * @param url Profile URL
 * @returns shirinked postfix
 */
export function shrinkProfileURL(url: string) {
  if (url.startsWith(profileURLPrefixLong)) {
    return url.substring(profileURLPrefixLong.length)
  } else {
    return url
  }
}

/**
 * Parse `2020년 01월 01일` to `20200101`
 * @param ymdString yyyymmdd string
 * @returns `yyyymmdd` integer 
 */
export function parseYMDString(ymdString: string) {
  if (ymdString.length <= 0) {
    return 0
  }
  ymdString = ymdString.trim()

  const getValueInt = (regexpMatch: RegExpMatchArray | null) => {
    if (regexpMatch == null) {
      return 0
    }
    const str = regexpMatch[0]
    return Number.parseInt(str.substring(0, str.length - 1))
  }

  const year = getValueInt(
    ymdString.match(/\d{4}년/i)
  )

  const month = getValueInt(
    ymdString.match(/\d{1,2}월/i)
  )

  const day = getValueInt(
    ymdString.match(/\d{1,2}일/i)
  )

  return year * 10000 + month * 100 + day
}

/**
 * Parse `12,345,678` to `12345678`
 * @param commaNumber comma number
 * @returns integer
 */
export function parseCommaNumber(commaNumber: string) {
  if (commaNumber.length <= 0) {
    return 0
  }
  commaNumber = commaNumber.trim()
  
  return Number.parseInt(commaNumber.replaceAll(",", ""))
}