import got, { HTTPError, TimeoutError } from "got"
import chalk from "chalk"
import { FetchError, InternalServerError, MaybeNotFoundError, MS2TimeoutError, NotFoundError, type FetchErrorInfo } from "./FetchError.ts"
import { Agent as HttpAgent } from "node:http"
import { Agent as HttpsAgent } from "node:https"
import type { Element } from "domhandler"
import Debug from "debug"
import { load as loadDOM, type Cheerio, type CheerioAPI } from "cheerio"
import { ms2Domain, postfixToURL, validateTableTitle } from "../util/MS2FetchUtil.ts"
import { maxRetry, ms2UserAgent, requestCooldown, retryCooldownSec } from "../Config.ts"
import { sleep } from "bun"

const verbose = Debug("ms2:verbose:ms2basefetch")
const ms2HttpAgent = new HttpAgent({ keepAlive: true, maxSockets: 50 })
const ms2HttpsAgent = new HttpsAgent({ keepAlive: true, maxSockets: 50 })

/**
 * 가장 마지막 요청 시간
 */
let lastMS2FetchTime = 0

export type AllowedFormatTypes = object | string | bigint | number | boolean

export interface FetchMS2Options {
  postfix: string,
  urlSearchParams?: Record<string, string>,
  userAgent?: string,
  headers?: Record<string, string>,
  noRetry302?: boolean,
}

// 위 MS2 서버가 한도 초과일 시에는 별 다른 태그 없이 단순히 302 오류로 return함.
// 302 오류는 실제로 사이트 주소가 없는 404랑 같은 오류로 취급됨.
// 404 오류를 따로 둔 이유는 혹시라도 서버가 404 응답을 할 수 있어서.
/**
 * MS2 서버로 요청을 보냅니다.
 * @param options 옵션
 * @returns 응답
 */
export async function fetchMS2(options: FetchMS2Options | string) {
  if (typeof options === "string") {
    options = { postfix: options }
  }

  const optionsWithDefault: Required<FetchMS2Options> = {
    urlSearchParams: {},
    userAgent: ms2UserAgent,
    headers: {},
    noRetry302: false,
    ...options,
  }

  const url = postfixToURL(optionsWithDefault.postfix)

  // 요청 지연 (MS2 서버는 1초당 3번만 받음)
  const timeDelta = Date.now() - lastMS2FetchTime
  if (lastMS2FetchTime > 0) {
    if (timeDelta < requestCooldown) {
      await sleep(requestCooldown - timeDelta)
    }
  }
  const ctime = Date.now()
  lastMS2FetchTime = ctime

  // GET 파라메터
  const searchParams = new URLSearchParams(optionsWithDefault.urlSearchParams)

  // 로깅
  const fetchRawURL = new URL(url)
  fetchRawURL.search = searchParams.toString()
  verbose(`[MS2Fetch] fetching ${chalk.green(fetchRawURL.toString())
    }`)

  try {
    for (let i = 0; i < maxRetry; i += 1) {
      // Request
      const response = await got(url, {
        searchParams,
        headers: {
          "User-Agent": optionsWithDefault.userAgent,
          "Referer": `https://${ms2Domain}`,
          ...optionsWithDefault.headers,
        },
        followRedirect: false,
        agent: {
          http: ms2HttpAgent,
          https: ms2HttpsAgent,
        },
        timeout: {
          request: 60000,
        },
      })

      const { body, statusCode, headers: responseHeaders } = response

      if (statusCode === 200) {
        return {
          body,
          statusCode,
          responseHeaders,
          response,
          fetchRawURL
        }
      }

      const fetchErrorInfo: FetchErrorInfo = {
        statusCode,
        statusMessage: response.statusMessage,
        body,
        url: fetchRawURL.toString(),
      }

      // 응답이 400~499일때
      if (statusCode >= 400 && statusCode < 500) {
        throw new NotFoundError({
          ...fetchErrorInfo,
          customMessage: "URL Resource was not found!",
        })
      }

      // 응답이 500 이상일 때
      if (statusCode >= 500 && statusCode < 600) {
        throw new InternalServerError({
          ...fetchErrorInfo,
          customMessage: `Unexpected server response.`,
        })
      }

      // 응답이 302 & NotFound로 이동이 아닌 경우 -> 모르는 오류로 처리
      if (
        statusCode !== 302 ||
        body.indexOf("Object moved") <= 0
      ) {
        throw new FetchError({
          ...fetchErrorInfo,
          customMessage: "Unknown status code error!",
        })
      }

      // 응답이 302일 시에 파싱 시도.
      const $ = loadDOM(body)
      const movedTo = $("body > h2 > a").attr("href")

      // movedTo가 없으면 100% 서버가 완벽히 고장난 거임.
      if (movedTo == null) {
        throw new InternalServerError({
          ...fetchErrorInfo,
          customMessage: `Unexpected server response. Check URL correctly.
          * URL: ${fetchRawURL.toString()}`,
        })
      }

      // aspxerrorpath가 있거나 Main/NotFound로 안 끝나면 404로 처리
      if (movedTo.indexOf("aspxerrorpath") >= 0 || movedTo.trim() !== "/Main/NotFound") {
        throw new NotFoundError({
          ...fetchErrorInfo,
          customMessage: `URL Resource was not found!`,
        })
      }

      // 요청 초과일 수도 있고 진짜 없을 수도 있음

      // 마지막 시도인 경우 결정하고 오류 반환
      if (optionsWithDefault.noRetry302 || i >= maxRetry - 1) {
        throw new MaybeNotFoundError({
          ...fetchErrorInfo,
          customMessage: `Server responded 302 as ${maxRetry} times. Treated as MaybeNotFoundError.`,
        })
      }

      // 리트라이

      verbose(`[MS2Fetch] Retrying after ${chalk.cyan(retryCooldownSec)
        } sec... (${chalk.yellowBright(i + 1)
        }/${chalk.blueBright(maxRetry)
        })`)

      await sleep(1000 * retryCooldownSec)
    }
  } catch (error) {
    // got에서 HTTPError가 발생할 수 있으므로 instanceof로 체크
    if (error instanceof HTTPError) {

      const fetchErrorInfo: FetchErrorInfo = {
        statusCode: error.response.statusCode,
        statusMessage: error.response.statusMessage,
        body: String(error.response.body),
        url: error.request.requestUrl?.toString() ?? fetchRawURL.toString(),
      }

      if (error.response.statusCode >= 400 && error.response.statusCode < 500) {
        throw new NotFoundError({
          ...fetchErrorInfo,
          customMessage: "Resource was not found (got HTTPError)!",
        })
      }
      throw new FetchError({
        ...fetchErrorInfo,
        customMessage: `got HTTPError: ${error.message}`,
      })

    }
    // Timeout 상태로 인한 에러일 시에는 TimeoutError를 대신 throw
    if (error instanceof TimeoutError) {
      verbose(`[MS2Fetch] Request timeout: ${fetchRawURL.toString()}`)

      throw new MS2TimeoutError({
        url: fetchRawURL.toString(),
      })
    }
    // 처리되지 않은 에러들은 그대로 throw
    throw error
  }

  // 여기 오류까지 오면 코드가 문제임.
  throw new Error(`${import.meta.path} 구현 오류.\n
    * 요청: ${JSON.stringify(optionsWithDefault, null, 2)}\n\n
    * URL: ${fetchRawURL.toString()}
  `)
}

/**
 * 레거시용
 */
export async function fetchMS2Text(url: string) {
  const response = await fetchMS2(url)
  return response.body
}

/**
 * MS2 서버로 요청을 보내고 `formatter`를 적용시켜 반환합니다.
 * @param options 
 * @param formatter 
 * @returns 
 */
export async function fetchMS2Formatted<T extends AllowedFormatTypes | AllowedFormatTypes[]>(options: {
  fetchOptions: FetchMS2Options | string,
  validateTitle?: string,
}, formatter: ($: CheerioAPI) => Promise<T> | Promise<T | null> | T | null,
) {
  try {
    const response = await fetchMS2(options.fetchOptions)
    const { body, fetchRawURL } = response

    const $ = loadDOM(body)

    if (options.validateTitle != null) {
      validateTableTitle($, options.validateTitle)
    }

    if ($(".no_data").length >= 1) {
      // 요청하신 페이지를 찾을 수 없습니다.
      verbose(`[MS2Fetch] Not found resource: ${fetchRawURL}`)

      return null
    }

    return formatter($)
  } catch (error) {
    // 페이지가 없다고 처리
    if (error instanceof MaybeNotFoundError) {
      verbose(`[MS2Fetch] Maybe not found resource.`)
      return null
    }
    // 이 페이지는 서버가 응답을 안 하는 페이지니 생략
    if (error instanceof MS2TimeoutError) {
      verbose(`[MS2Fetch] URL fetch was timed out.`)
      return null
    }

    throw error
  }
}

/**
 * MS2 서버로 요청을 보내고 `formatter`를 적용시켜 반환합니다.
 * `formatter`는 `listSelector`로 쿼리된 모든 요소들이 들어갑니다.
 * @param options 
 * @param formatter 
 * @returns 
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function fetchMS2FormattedList<T extends AllowedFormatTypes>(options: {
  fetchOptions: FetchMS2Options | string,
  listSelector: string,
  validateTitle?: string,
}, formatter: ($: Cheerio<Element>, $root: CheerioAPI, index: number) => Promise<T> | T | Promise<T | null> | null,
) {
  return (await fetchMS2Formatted<T[]>({
    ...options,
  }, async ($) => {
    const $root:Cheerio<Element> = $<Element, string>(options.listSelector)
    const formattedResults:T[] = []
    for (let i = 0; i < $root.length; i += 1) {
      const element = $root[i]
      const result = await formatter($(element), $, i)
      if (result != null) {
        formattedResults.push(result)
      }
    }
    return formattedResults
  })) ?? ([] as T[])
}
/* eslint-enable @typescript-eslint/no-explicit-any */
