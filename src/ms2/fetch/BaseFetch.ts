import { sleep } from "bun"
import { baseURL, maxRetry, referrer, requestCooltime, userAgent } from "../Config.ts"
import Debug from "debug"
import Chalk from "chalk"

const debug = Debug("ms2archive:BaseFetch")

let lastSent = -1


/**
 * MS2 URL에서 text를 GET
 * @param postfix MS2 Postfix URL
 * @returns HTML Text
 */
export async function requestMS2Get(postfix: string) {
  const reqURL = `${baseURL}/${postfix}`
  for (let i = 0; i < maxRetry; i += 1) {
    const timeDelta = Date.now() - lastSent
    if (timeDelta < requestCooltime) {
      await sleep(requestCooltime - timeDelta)
    }
    debug(`${Chalk.green(reqURL)} 요청 (MS2Get)`)

    // 응답
    let resp:Response | null = null
    try {
      resp = await fetch(reqURL, {
        method: "GET",
        headers: {
          "User-Agent": userAgent,
        },
        redirect: "manual",
        referrer: referrer,
        signal: AbortSignal.timeout(10000),
      })
    } catch (err) {
      console.log(err)
    }
    lastSent = Date.now()

    // try catch 실패시 null
    if (resp == null) {
      break
    }

    // 302 체크 (서버 과부하 or 404)
    if (resp.status === 302) {
      // 1초 대기후 재시도
      // await sleep(3000)
      break
      // return null
    }
    // 404인 경우 null 반환
    if (resp.status === 404) {
      return null
    }
    // 200인 경우 값 반환
    if (resp.status === 200) {
      return resp.text()
    }
    // 아닌 경우에는 에러
    throw new Error(`Unknown Response! ${resp.status} / ${resp.url}`)
  }

  // throw new Error("Failed to fetch data.")
  return null // 응답이 없음
}

/**
 * 기타 URL에서 Blob을 GET
 * @param rawURL 아무 URL
 * @returns Blob
 */
export async function requestBlob(rawURL: string) {
  debug(`${Chalk.green(rawURL)} 요청 (Blob)`)

  const resp = await fetch(rawURL, {
    method: "GET",
    headers: {
      "User-Agent": userAgent,
      "Referer": referrer,
    },
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
  })

  if (resp.status !== 200) {
    return null
  }

  let extension = resp.headers.get("Content-Type") ?? "image/jpeg"
  extension = extension.substring(extension.lastIndexOf("/") + 1)
  if (extension === "jpeg") {
    extension = "jpg"
  }

  const blob = await resp.blob()

  return {
    extension,
    blob,
  }
}

export async function requestText(rawURL: string) {
  debug(`${Chalk.green(rawURL)} 요청 (Text)`)

  const resp = await fetch(rawURL, {
    method: "GET",
    headers: {
      "User-Agent": userAgent,
      "Referer": referrer,
    },
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
  })

  return resp.text()
}