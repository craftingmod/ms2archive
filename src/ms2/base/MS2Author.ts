import type { Job } from "./MS2Job.ts"

export interface MS2Author {
  job: Job,
  level: number,
  nickname: string,
  icon?: string,
}