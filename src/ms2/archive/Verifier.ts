import { Database } from "bun:sqlite"


async function verifyPVPData(beforeSeason:number, afterSeason: number) {
  const database = new Database("./data/ms2rank-250515.db", {
    readonly: true,
    safeIntegers: true,
  })

  const getSeasonEntries = (season: number) => {
    const rawEntries = database.prepare(
      `SELECT characterId FROM pvpStoreRaw WHERE season = ?;`
    ).all(season) as Array<{ characterId: bigint }>

    const rawArray = rawEntries.map((value) => value.characterId)

    return new Set(rawArray)
  }

  const season1Entires = getSeasonEntries(beforeSeason)
  const season2Entires = getSeasonEntries(afterSeason)

  for (const s1Entry of season1Entires) {
    if (!season2Entires.has(s1Entry)) {
      throw new Error("Verification failed!")
    }
  }
  console.log("Verification success!")
}

for (let i = 1; i < 4; i += 1) {
  verifyPVPData(i, i+1)
}