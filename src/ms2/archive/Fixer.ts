import { fetchArticle, fetchShopItemList, writeImages } from "../fetch/ArticleFetch.ts"
import type { BoardCategory } from "../fetch/BoardRoute"
import type { ArchiveStorage } from "../storage/ArchiveStorage.ts"
import fs from "node:fs/promises"

export class Fixer {
  public constructor(
    protected storage: ArchiveStorage,
  ) {
  }
  public async analyzeAttachments(board:BoardCategory) {
    const attaches = this.storage.database.query(
      `SELECT articleId, attachments FROM ${board}Board;`
    ).all() as Array<{
      articleId: bigint,
      attachments: string,
    }>

    const nullAttaches = attaches.filter((v) => v.attachments.indexOf("null") >= 0 || v.attachments.indexOf(",,") >= 0)

    for (const articleInfo of nullAttaches) {
      const fetchedArticle = await fetchArticle(board, Number(articleInfo.articleId), true)
      if (fetchedArticle == null) {
        continue
      }
      await fs.rm(`./data/images/${board.toLowerCase()}/${articleInfo.articleId}`, {
        force: true,
        recursive: true,
      })
      const images = await writeImages(fetchedArticle)
      for (let i = 0; i < images.length; i += 1) {
        const image = images[i]
        if (image == null) {
          continue
        }
        fetchedArticle.content = fetchedArticle.content.replaceAll(fetchedArticle.attachments[i], image)
      }
      this.storage.database.query(
        `UPDATE ${board}Board
          SET attachments = $attachments, content = $content
          WHERE articleId = $articleId;
        `
      ).run({
        articleId: fetchedArticle.articleId,
        attachments: fetchedArticle.attachments.join(","),
        content: fetchedArticle.content,
      })
    }
  }
  public async addShopSummary(board: BoardCategory) {
    // const shopHeaders:Map<number, ArticleHeader> = new Map()
    
    // eslint-disable-next-line no-constant-condition
    for (let i = 1; true; i += 1) {
      const shopInfos = await fetchShopItemList(i)
      if (shopInfos == null || shopInfos.length <= 0) {
        break
      }
      for (const info of shopInfos) {
        this.storage.database.query(
          `UPDATE ${board}Board
            SET summary = $summary
            WHERE articleId = $articleId;
          `
        ).run({
          articleId: info.articleId,
          summary: info.summary,
        })
      }
    }
  }
}