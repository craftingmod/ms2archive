import { fetchCapsuleInfo, fetchCapsuleList } from "ms2/fetch/MS2ProbFetch.ts"
import fs from "node:fs/promises"

const probPath = `./data/Probability`

// 1. 캡슐 리스트 백업
async function fetchCapsule() {
  const capsuleDirPath = `${probPath}/Capsule`
  await fs.mkdir(capsuleDirPath, { recursive: true })
  for (let page = 0; true; page += 1) {
    const capsuleList = await fetchCapsuleList(page)

    for (const { capsuleId, capsuleName } of capsuleList) {
      const capsuleInfo = await fetchCapsuleInfo(capsuleId)
      if (capsuleInfo == null) {
        throw new Error("Info must not be null!")
      }

      const capsuleNameSafe = capsuleName.replace(/[():]/g, "").replace(/\s+/g, "_")
      await fs.writeFile(
        `${capsuleDirPath}/${capsuleNameSafe}.json`,
        JSON.stringify(capsuleInfo, null, 2)
      )
    }

    if (capsuleList.length <= 0) {
      break
    }
  }
}

fetchCapsule()