import { ProfileStorage } from "ms2/storage/ProfileStorage.ts"
import Debug from "debug"

const Verbose = Debug("ms2archive:verbose:profileMerge")

const profileStorage = new ProfileStorage()

const tableName = profileStorage.profileInfoStore.tableName

const avifPaths = profileStorage.getAVIFPaths()

const insertQuery = profileStorage.database.prepare(
  `UPDATE ${tableName} SET avifData = ? WHERE profileId = ?;`
)

let deleteCount = 0
for (const avifInfo of avifPaths) {
  if ((deleteCount++) % 1000 === 1) {
    Verbose(`Deleting AVIF: ${deleteCount} / ${avifPaths.length}`)
  }
  try {
    const file = Bun.file(avifInfo.avifPath)

    await file.delete()

  } catch (err) {
    console.error(err)
  }
}

/*
for (let i = 0; i < avifPaths.length; i += 1) {
  const avifInfo = avifPaths[i]

  if (i % 1000 === 1) {
    Verbose(`Reading AVIF: ${i} / ${avifPaths.length}`)
  }

  try {
    const file = Bun.file(avifInfo.avifPath)

    const fileData = await file.bytes()
    avifInfo.avifData = fileData
  } catch (err) {
    console.error(err)
  }
}

let writeCount = 0
const transaction = profileStorage.database.transaction((info: typeof avifPaths) => {
  for (const avifInfo of info) {
    if ((writeCount++ % 1000) === 1) {
      Verbose(`Writing AVIF: ${writeCount} / ${avifPaths.length}`)
    }
    if (avifInfo.avifData == null) {
      continue
    }

    insertQuery.run(avifInfo.avifData, avifInfo.profileId)
  }
})

transaction(avifPaths)
*/