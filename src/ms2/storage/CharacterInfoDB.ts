import { Database } from "bun:sqlite"

export interface CharacterStoreInfo {
  characterId: bigint,
  nickname: string,
  trophyRank: number,
  accountId: bigint,
  timestamp: number,
  rawPacket: Uint8Array,
}

export class CharacterInfoDB {
  public database: Database

  constructor(
    protected path = "./data/ms2char.db",
    protected isReadonly = false,
  ) {
    this.database = new Database(this.path, {
      readonly: isReadonly,
      safeIntegers: true,
      create: true,
      strict: true,
    })
    if (!isReadonly) {
      this.ensureTables()
    }
    this.database.exec("PRAGMA journal_mode = WAL;")
  }
  protected ensureTables() {
    this.database.run(
      `CREATE TABLE IF NOT EXISTS characterStore (
        characterId BIGINT NOT NULL PRIMARY KEY,
        nickname TEXT NOT NULL,
        trophyRank INTEGER NOT NULL,
        accountId BIGINT NOT NULL,
        timestamp INTEGER NOT NULL,
        rawPacket BLOB NOT NULL
      );`
    )
  }

  public insertMany(data: CharacterStoreInfo[]) {
    const insertStatement = this.database.prepare(`
      INSERT OR REPLACE INTO characterStore (characterId, nickname, trophyRank, accountId, timestamp, rawPacket)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    const insertCharacterStoreInfos = this.database.transaction(
      (infos: CharacterStoreInfo[]) => {
        for (const info of infos) {
          insertStatement.run(
            info.characterId,
            info.nickname,
            info.trophyRank,
            info.accountId,
            info.timestamp,
            info.rawPacket
          );
        }
      }
    )

    insertCharacterStoreInfos(data)
  }

  public getCids() {
    const exec = this.database.prepare(
      `SELECT characterId, trophyRank FROM characterStore
      ORDER BY trophyRank ASC;`
    ).all() as Array<{characterId: bigint, trophyRank: bigint}>
    return exec.map((cidInfo) => cidInfo.characterId)
  }

  public getAids() {
    const exec = this.database.prepare(
      `SELECT accountId, MIN(trophyRank) AS min_trophyRank
      FROM characterStore
      GROUP BY accountId
      ORDER BY min_trophyRank ASC;`
    ).all() as Array<{accountId: bigint, min_trophyRank: bigint}>
    return exec.map((cidInfo) => cidInfo.accountId)
  }

  public getMaxRank() {
    const exec = this.database.prepare(
      `SELECT MAX(trophyRank) AS maxTrophyRank FROM characterStore;`
    ).get() as {maxTrophyRank: bigint} | undefined

    return Number(exec?.maxTrophyRank ?? -1)
  }

  public getPackets() {
    const exec = this.database.prepare(
      `SELECT characterId, rawPacket FROM characterStore;`
    ).all() as Array<{rawPacket: Uint8Array, characterId: bigint}>
    return exec
  }

  public close() {
    this.database.close(false)
  }
}