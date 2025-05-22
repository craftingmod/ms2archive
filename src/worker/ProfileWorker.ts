import Path from "node:path"
import { mkdir } from "node:fs/promises"
import Bun from "bun"
import { LargeWorkerHelper } from "../worker/WorkerHelper.ts"
import { fetchBlob } from "../ms2/fetch/GenericFetch.ts"
import sharp from "sharp"

declare const self: Worker

export interface ProfileSaveRequest {
  url: string,
  characterId: bigint,
  profileId: bigint,
}

export interface ProfileSaveResponse {
  characterId: bigint,
  profileId: bigint,
  pngPath: string,
  avifPath: string,
}

function toHex(num: bigint) {
  return num.toString(16).toUpperCase().padStart(2, "0")
}

self.onmessage = LargeWorkerHelper.handleOnMessage<ProfileSaveRequest, ProfileSaveResponse>(async (data: ProfileSaveRequest) => {

  const dest = `./data/Profile/${toHex(data.characterId & 0xFFn)
    }/${toHex(data.characterId >> 8n & 0xFFn)
    }/${data.characterId
    }/${data.profileId}.png`

  // 디렉터리 생성
  await mkdir(Path.dirname(dest), { recursive: true })

  // 소스 가져오기
  const sourceBlob = await fetchBlob({
    url: data.url,
  })

  if (sourceBlob == null) {
    throw new Error("fetchBlob is null!")
  }

  const source = await sourceBlob.blob.arrayBuffer()

  const file = Bun.file(dest)
  if (!(await file.exists())) {
    await file.write(source)
  }

  // AVIF
  const avifPath = dest.replace(".png", ".avif")
  const avifFile = Bun.file(avifPath)
  if (!(await avifFile.exists())) {
    const avifBuf = await sharp(source).avif({
      quality: 90,
    }).toBuffer()
    await Bun.write(avifFile, avifBuf)
  }

  return {
    characterId: data.characterId,
    profileId: data.profileId,
    pngPath: dest,
    avifPath,
  }
})