import { fetchArticle, fetchShopItemList, writeImages } from "../fetch/ArticleFetch.ts"
import type { BoardCategory } from "../fetch/BoardRoute"
import { fetchArchitectRankList } from "../fetch/MS2RankFetch.ts"
import type { ArchiveStorage } from "../storage/ArchiveStorage.ts"
import fs from "node:fs/promises"
import { Database } from "bun:sqlite"

export class Fixer {
  public constructor(
    protected storage: ArchiveStorage,
  ) {
  }
  public async analyzeAttachments(board: BoardCategory) {
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

  public async fixArchitectScore() {
    for (let years = 2015; years <= 2025; years += 1) {
      for (let months = 1; months <= 12; months += 1) {
        if (years === 2015 && months <= 7) {
          continue
        }
        if (years === 2025 && months >= 6) {
          continue
        }

        await this.fixArchitectScorePart(years, months)
      }
    }
  }
  protected async fixArchitectScorePart(years: number, months: number) {
    console.log(`Fixing ${years}/${months}`)
    const database = new Database("./data/ms2rank.db", {
      safeIntegers: true,
      readwrite: true,
    })

    const architectInfo = await fetchArchitectRankList({
      year: years,
      month: months,
    }, 1)

    for (const info of architectInfo) {
      if (info.houseScore < 1000) {
        continue
      }
      console.log(`Update ${info.rank}/${info.nickname}`)
      database.prepare(
        `UPDATE architectRankStore SET houseScore = ? WHERE characterId = ? AND starDate = ?;`
      ).run(info.houseScore, info.characterId, (years * 100 + months))
    }
  }
}