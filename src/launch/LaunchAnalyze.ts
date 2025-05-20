/**
 * 던전 정보 파싱하는 index
 */
import { MS2Database } from "../ms2/database/MS2Database.ts";
import { MS2Analyzer } from "../ms2/ms2analyzer.ts";

const db = new MS2Database("./data/ms2query.db")

const ms2Analyzer = new MS2Analyzer(db)

ms2Analyzer.analyze(true)