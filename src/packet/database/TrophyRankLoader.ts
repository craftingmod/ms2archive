import { Database } from "bun:sqlite"

type ElementType<T> = T extends Array<infer U> ? U : never

export type TrophyRankPartial = ElementType<ReturnType<typeof loadTrophyRanks>>

export function loadTrophyRanks() {
  const database = new Database("./data/ms2rank-readonly.db", {
    readonly: true,
    safeIntegers: true,
    strict: true,
  })

  const trophyRanks = database.prepare(
    `SELECT characterId, trophyRank
         FROM trophyRankStore
         WHERE trophyRank > 0
         ORDER BY trophyRank ASC;`
  ).all() as Array<{characterId: bigint, trophyRank: bigint}>

  return trophyRanks
}