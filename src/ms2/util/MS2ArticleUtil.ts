import type { MS2Article } from "../fetch/ArticleFetch.ts"
import { fetchBlob } from "../fetch/GenericFetch.ts"

/**
 * MS2Article의 이미지를 씁니다.
 * @param article 게시글
 * @returns 이미지 경로
 */
export async function writeArticleImages(article: MS2Article) {
  if (article.attachments.length <= 0) {
    return []
  }

  const writtenPath = [] as Array<string | null>

  for (let i = 0; i < article.attachments.length; i += 1) {
    let url = article.attachments[i]
    // 공백 예외처리
    url = url.trim()
    // `//` 예외처리
    if (url.startsWith("//")) {
      url = `https:${url}`
    }

    let extension: string
    let binary: Blob | Uint8Array
    if (url.startsWith("data:")) {
      extension = url.substring(url.indexOf("/") + 1, url.indexOf(";"));
      try {
        binary = Uint8Array.fromBase64(url.substring(
          url.indexOf("base64") + 7,
        )) as Uint8Array
      } catch (err) {
        console.error(err)
        writtenPath.push(null)
        continue
      }
    } else if (url.startsWith("http")) {
      try {
        const req = await fetchBlob(url)
        if (req == null) {
          throw new Error(`${url} is null!`)
        }
        extension = req.extension
        binary = req.blob as unknown as Blob
      } catch (err) {
        console.error(err)
        writtenPath.push(null)
        continue
      }
    } else {
      // blob??
      console.error(`Unknown URL Schema: ${url}`)
      writtenPath.push(null)
      continue
    }



    const filename = `${article.articleId}_${(i + 1).toString().padStart(3, "0")}.${extension}`
    const parentPath = `data/images/${article.boardName.toLowerCase()}/${article.articleId}`

    const imgFile = Bun.file(`./${parentPath}/${filename}`, {
      type: `image/${extension}`
    })

    if (!(await imgFile.exists())) {
      try {
        await Bun.write(imgFile, binary, {
          createPath: true,
        })
      } catch (err) {
        console.error(err)
      }
    }

    writtenPath.push(`${parentPath}/${filename}`)
  }

  return writtenPath
}