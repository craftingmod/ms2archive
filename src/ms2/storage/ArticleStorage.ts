import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite"
import Path from "node:path"
import { dataDir } from "../../Constants.ts"
import { Database } from "bun:sqlite"
import { sqliteTable, int, text } from "drizzle-orm/sqlite-core"
import type { BoardCategory } from "../fetch/BoardRoute"


export class ArticleStorage {
  protected database: BunSQLiteDatabase
  public constructor(
    protected filename: string,
  ) {
    const bunDB = new Database(Path.resolve(dataDir, `${filename}.db`), {
      create: true,
      safeIntegers: true,
    })
    bunDB.exec(`PRAGMA journal_mode = WAL;`)
    this.database = drizzle({
      client: bunDB,
    })
  }

  public createTable(board: BoardCategory) {
    
  }
}