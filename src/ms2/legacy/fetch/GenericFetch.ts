import MimeTypes from "mime-types"
import chalk from "chalk"
import Debug from "debug"
import type { FetchMS2Options } from "./MS2BaseFetch.ts"
import { commonUserAgent } from "../../Config.ts"
import { InternalServerError, NotFoundError, type FetchErrorInfo } from "./FetchError.ts"

const verbose = Debug("ms2:verbose:ms2basefetch")

export type FetchRawOptions = Omit<FetchMS2Options, "postfix" | "noRetry302"> & {
  url: string,
  referer?: string,
}

export async function fetchBlob(options: FetchRawOptions | string) {
  if (typeof options === "string") {
    options = { url: options }
  }

  const resp = await fetchInternal(options)

  if (resp == null) {
    return null
  }

  let mimeType = resp.headers.get("Content-Type") ?? ""

  let extension = ""


  if (mimeType.length > 0) {
    const mimeExt = MimeTypes.extension(mimeType)
    if (mimeExt != null && typeof mimeExt === "string") {
      extension = mimeExt
      mimeType = mimeExt
    }
  }
  if (extension.length <= 0) {
    const rawURL = options.url
    const urlPostfix = rawURL.substring(rawURL.lastIndexOf("/") + 1)
    if (urlPostfix.indexOf(".") >= 0) {
      extension = urlPostfix.substring(urlPostfix.lastIndexOf(".") + 1)
    }
  }
  if (extension === "jpeg") {
    extension = "jpg"
  }

  const blob = await resp.blob()

  return {
    extension,
    mimeType,
    blob,
  }
}

export async function fetchText(options: FetchRawOptions | string) {
  if (typeof options === "string") {
    options = { url: options }
  }
  const resp = await fetchInternal(options)

  if (resp == null) {
    return null
  }

  return resp.text()
}

async function fetchInternal(options: FetchRawOptions) {
  const rawURL = options.url
  verbose(`${chalk.green(rawURL)} 요청 (Blob)`)

  const useQuestion = (options.urlSearchParams == null) ? "" : "?"
  const searchParams = new URLSearchParams(options.urlSearchParams ?? {})

  const fullURL = `${rawURL}${useQuestion}${searchParams.toString()}`

  const resp = await fetch(fullURL, {
    method: "GET",
    headers: {
      "User-Agent": options.userAgent ?? commonUserAgent,
      "Referer": options.referer ?? "",
      ...(options.headers ?? {}),
    },
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
  })

  const statusCode = resp.status

  const fetchErrorInfo: FetchErrorInfo = {
    statusCode,
    statusMessage: resp.statusText,
    body: "",
    url: rawURL,
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

  return resp
}