export interface FetchErrorInfo {
  statusCode: number,
  statusMessage?: string,
  customMessage?: string,
  body: string,
  url: string,
}

export class FetchError extends Error implements FetchErrorInfo {
  public statusCode
  public body
  public url
  public statusMessage
  public customMessage

  constructor(params: FetchErrorInfo) {
    const statusMessage = params.statusMessage ??
      `MS2Fetch fetch error with statusCode ${params.statusCode} happened!`
    super(statusMessage)

    this.name = "FetchError"
    this.statusCode = params.statusCode
    this.body = params.body
    this.url = params.url
    this.statusMessage = params.statusMessage ?? ""
    this.customMessage = params.customMessage ?? ""
  }

  public override get message() {
    return this.getErrorMessage()
  } 

  protected getErrorMessage() {
    return `[${this.name}] MS2Fetch fetch error was happened!
    * statusCode: ${this.statusCode}
    * statusMessage: ${this.statusMessage}
    * customMessage: ${this.customMessage}
    * url: ${this.url}
    * body: ${this.body}
    `.replace(/\s*\n\s/g, "\n")
  }
}

export class UserError extends Error {
  constructor(reason: string) {
    super(`Runtime Error: ${reason}`)
    this.name = "UserError"
  }
}

export class InternalServerError extends FetchError {
  constructor(params: FetchErrorInfo) {
    super(params)
    this.name = "InternalServerError"
  }
}

export class NotFoundError extends FetchError {
  constructor(params: FetchErrorInfo) {
    super(params)
    this.name = "NotFoundError"
  }
}

/**
 * Rate Limit or Not Found
 * Treated as Not Found.
 */
export class MaybeNotFoundError extends FetchError {
    constructor(params: FetchErrorInfo) {
    super(params)
    this.name = "MaybeNotFoundError"
  }
}

export class MS2TimeoutError extends FetchError {
  constructor(urlInfo: {url: string } | string) {
    super({
      statusCode: 408,
      statusMessage: "Request Timeout",
      body: "",
      url: typeof urlInfo === "string" ? urlInfo : urlInfo.url,
      customMessage: "The request to the MS2 server timed out.",
    })

    this.name = "MS2TimeoutError"
  }
}

export class WrongPageError extends FetchError {
  constructor(params: FetchErrorInfo) {
    super(params)
    this.name = "WrongPageError"
  }
}

export class InvalidParameterError extends UserError {
  public paramName: string
  constructor(message: string, paramName: string) {
    super(`${paramName} is invalid!`)
    this.name = "InvalidParameterError"
    this.paramName = paramName
  }
}

export class DungeonNotFoundError extends UserError {
  constructor(dungeon: string | number) {
    super(`${dungeon} is not found!`)
    this.name = "DungeonNotFoundError"
  }
}