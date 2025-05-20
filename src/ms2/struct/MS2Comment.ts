import type { TZDate } from "@date-fns/tz"

export interface MS2Comment {
  commentIndex: number,
  authorName: string,
  content: string,
  createdAt: TZDate,
}