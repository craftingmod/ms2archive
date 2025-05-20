import type { ArchiveStorage } from "../storage/ArchiveStorage.ts"
import Debug from "debug"
import { RankStorage } from "../storage/RankStorage.ts";
import type { DataTypesLite, ModelLite, ModelToJSObject } from "../sqlite/SequelizeLite.ts";

const debug = Debug("ms2:archive:basearchiver")

export class BaseArchiver {

  public rankStorage = new RankStorage()

  public constructor(protected storage: ArchiveStorage) {

  }

  /**
   * 데이터베이스 스토어에서 rank 최댓값을 가져옵니다
   * @param storeName 스토어 이름
   * @param condition 쿼리 조건
   * @returns rank 최댓값
   */
  protected selectMaxRank(storeName: string, condition: Record<string, string | number | bigint | boolean>) {
    // no condition
    if (Object.keys(condition).length <= 0) {
      const highestNoCondition = this.rankStorage.database.prepare(
        `SELECT MAX(rank) FROM ${storeName};`
      ).get() as { ["MAX(rank)"]: bigint | undefined }

      return Number(highestNoCondition["MAX(rank)"] ?? 0n)
    }

    const whereParam = Object.keys(condition)
      .map((key) => `${key} = ?`)
      .join(" AND ")

    const highest = this.rankStorage.database.prepare(
      `SELECT MAX(rank) FROM ${storeName} WHERE ${whereParam};`
    ).get(...Object.values(condition)) as { ["MAX(rank)"]: bigint | undefined }

    return Number(highest["MAX(rank)"] ?? 0n)
  }

  /**
   * 특정 seasonCondition에 한정하여 모든 페이지를 아키이빙합니다.
   * @param options 설정들
   */
  protected async archiveRankData<T extends { rank: DataTypesLite.INTEGER }>(options: {
    name: string,
    store: ModelLite<T>,
    seasonCondition: Partial<ModelToJSObject<T>>,
    minPageSize?: number,
    fetchFn: (page: number) => Promise<Array<ModelToJSObject<T>>>,
    filterFn?: (data: ModelToJSObject<T>) => boolean,
    breakFn?: (data: ModelToJSObject<T>) => boolean,
  }) {
    const conditionStr = Object.entries(
      options.seasonCondition
    ).map(
      ([key, value]) => `${key} ${value}`
    ).join(", ")

    debug(`Fetching ${options.name} (${conditionStr})`)

    const localHighRank = this.selectMaxRank(options.store.tableName, options.seasonCondition as Record<string, string | number | bigint | boolean>)

    const startPage = Math.max(1, Math.floor(localHighRank / 10))

    for (let page = startPage; true; page += 1) {
      const fetchedList = await options.fetchFn(
        page);

      let shouldBreak = false
      const insertList: ModelToJSObject<T>[] = []

      for (const data of fetchedList) {
        if (data.rank <= localHighRank) {
          continue
        }
        if (options.breakFn != null && options.breakFn(data)) {
          shouldBreak = true
          break
        }
        if (options.filterFn != null && !options.filterFn(data)) {
          continue
        }
        insertList.push(data)
      }

      options.store.insertMany(insertList)

      // Break 조건이면 끝
      if (shouldBreak) {
        break
      }

      // 10개 or 1개(DB 서버가 이상함.) 미만이면 끝
      if (fetchedList.length < (options.minPageSize ?? 10)) {
        break
      }
    }
  }

}