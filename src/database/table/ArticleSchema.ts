import { int, sqliteTable, text } from "drizzle-orm/sqlite-core"
import type { BoardCategory } from "../../ms2/fetch/BoardRoute.ts"

function createBoardTable<T extends BoardCategory>(board: T) {
  return sqliteTable(`${board}Board`, {
    articleId: int().primaryKey(),
    title: text().notNull(),
    authorName: text().notNull(),
    authorIcon: text(),
    viewCount: int().notNull(),
    likeCount: int().notNull(),
    createdAt: int().notNull(),
    commentCount: int().notNull(),
    tags: text(),
    content: text().notNull(),
    attachments: text(),
  })
}

