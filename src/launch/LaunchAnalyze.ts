/**
 * 던전 정보 파싱하는 index
 */
import { MS2Database } from "../ms2/database/MS2Database.ts"
import { MS2Analyzer } from "../ms2/MS2analyzer.ts"
import { queryDungeons } from "../ms2/struct/MS2DungeonId.ts"

const db = new MS2Database("./data/ms2query.db")

for (let i = 1; i < queryDungeons.length; i += 1) {
  const ms2Analyzer = new MS2Analyzer(db, queryDungeons[i])
  await ms2Analyzer.analyze(false)
}