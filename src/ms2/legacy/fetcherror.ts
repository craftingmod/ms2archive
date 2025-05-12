export class DungeonNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "NotFoundError"
  }
}

export class InvalidParameterError extends Error {
  public paramName: string
  constructor(message: string, paramName: string) {
    super(message)
    this.name = "InvalidParameterError"
    this.paramName = paramName
  }
}