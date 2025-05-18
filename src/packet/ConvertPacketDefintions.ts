// res 폴더에 PacketDefinitions.xml을 넣고 실행하시오
import { load } from "cheerio"
import fs from "node:fs/promises"

const defineContent = await fs.readFile("./res/PacketDefinitions.xml", {encoding: "utf-8"})

const $ = load(defineContent, {
  xml: true,
})

const data = $("Definitions > Definition").map(
  (i, el) => {
    const $el = $(el)
    
    const isOutbound = $el.find("Outbound").text().trim() === "true"
    const opcode = Number(
      $el.find("Opcode").text().trim()
    )
    const name = $el.find("Name").text().trim()
    const ignoreLog = $el.find("Ignore").text().trim() === "true"

    return {
      isOutbound,
      opcode,
      name,
      ignoreLog,
    }
  }
).toArray()

await fs.writeFile("./res/PacketDefinitions.json", JSON.stringify(data, null, 2), {
  encoding: "utf8",
})