import { MS2ItemTier, MS2Tradable, type MS2CapsuleItem } from "../struct/MS2Gatcha.ts"
import { fetchMS2Formatted, fetchMS2FormattedList, fetchMS2JSON } from "./MS2BaseFetch.ts"
import { findItemData, gatchaListPostfix, gatchaPostfix, getTierFromText, getTradableFromText } from "../util/MS2FetchUtil.ts"
import fs from "node:fs/promises"
import Debug from "debug"

const Verbose = Debug("ms2:verbose:MS2ProbFetch")

export async function fetchCapsuleInfo(capsuleId: number) {
  return fetchMS2Formatted({
    fetchOptions: {
      postfix: `${gatchaPostfix}/${capsuleId}`,
    },
  }, ($) => {
    // Row 
    const trs = $(".p_item2 > tbody").find("tr").get()
    const result: { [key in string]: MS2CapsuleItem[] } = {}
    let categoryName = "없음"
    for (const row of trs) {
      const $row = $(row)
      const tds = $row.find("td").get()
      // 아이템
      const item: MS2CapsuleItem = {
        itemName: "",
        itemTier: MS2ItemTier.NORMAL,
        itemTrade: MS2Tradable.ACCOUNT_BOUND,
        quantity: 0,
        chancePercent: 0,
      }
      let offset = 0
      for (let i = 0; i < tds.length; i += 1) {
        const $column = $(tds[i])
        if (i === 0 && Number($column.attr("rowspan") ?? "0") > 0) {
          // 분류
          categoryName = $column.text().trim()
          offset += 1
          continue
        }
        // 데이터 넣기
        const text = $column.text().trim()
        switch (i - offset) {
          case 0:
            item.itemName = text
            break
          case 1:
            item.itemTier = getTierFromText(text)
            break
          case 2:
            item.itemTrade = getTradableFromText(text)
            break
          case 3:
            item.quantity = Number.parseInt(text.substring(0, text.length - 2))
            break
          case 4:
            item.chancePercent = Number.parseFloat(text.substring(0, text.length - 1))
            break
          default:
            throw new Error("Unknown column")
        }
      }
      // Result에 넣기
      if (result[categoryName] === undefined) {
        result[categoryName] = []
      }
      result[categoryName]?.push(item)
    }
    return {
      capsuleId,
      capsuleName: $("h4.pt_1").text().trim(),
      capsuleInfo: result,
    }
  })
}

export async function fetchCapsuleList(page: number) {
  return fetchMS2FormattedList({
    fetchOptions: {
      postfix: `${gatchaListPostfix}/${page}`,
    },
    listSelector: ".p_item1 > tbody > tr",
  }, ($) => {
    const $el = $.find(".pil_t > a")

    const capsuleId = $el.attr("href")?.split("/").pop() ?? "0"
    const capsuleName = $el.text().trim()

    return {
      capsuleId: Number.parseInt(capsuleId),
      capsuleName,
    }
  })
}

export interface ItemDataRequest {
  equipType: "무기" | "방어구" | "장신구",
  subType?: string,
  level?: string,
}

export async function fetchItemData(request: ItemDataRequest) {
  const urlForm = new URLSearchParams(request as unknown as Record<string, string>)

  const resp = await fetchMS2JSON<string[]>({
    postfix: findItemData,
    method: "POST",
    body: urlForm.toString(),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  })

  return resp.body
}

export async function fetchItemDataAll() {
  const initKeys = ["무기", "방어구", "장신구"] as const
  const depthInfo: Array<string[]> = []

  for (const key1 of initKeys) {
    const keys2 = await fetchItemData({
      equipType: key1,
    })
    for (const key2 of keys2) {
      const keys3 = await fetchItemData({
        equipType: key1,
        subType: key2,
      })
      for (const key3 of keys3) {
        const itemNames = await fetchItemData({
          equipType: key1,
          subType: key2,
          level: String(key3),
        })
        for (const itemName of itemNames) {
          Verbose(`Adding depth: ${JSON.stringify([key1, key2, key3, itemName])}`)
          depthInfo.push([key1, key2, key3, itemName])
        }
      }
    }
  }

  await fs.writeFile("./data/itemPaths.json", JSON.stringify(depthInfo, null, 2))
}