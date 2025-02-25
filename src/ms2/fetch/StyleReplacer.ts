
import { unescape } from "html-escaper"

const allowedKey = [
  // "background-color",
  // "color",
  "font-size",
  // "font-weight",
  "text-align",
]


const skipValue:Record<string, string> = {
  "font-size": "14px",
  "text-align": "left",
}

export function replaceStyle(html: string) {
  // <b></b> 같은 거 제거
  html = shirinkTrash(html)
  // 이유없는 Raw Text 제거
  html = shirinkText(html)
  // p, span 메타데이터 모두 제거 (도저히 못 쓸 정도로 값이 이상함)
  html = shirinkP(html)
  // img 태그 정리
  html = shirinkImg(html)
  // font 태그 정리
  html = shirinkFont(html)

  return html
}

function getStyle(html: string) {
  const style:Record<string, string> = {}
  
  const queryArr = html.match(/style=".+?"/g)
  if (queryArr != null) {
    for (const value of queryArr) {
      // style 부분만 가져오기
      const styleRaw = unescape(
        value.substring(7, value.length - 1)
      )
      const styleArr = styleRaw.split(";")

      for (const styleLine of styleArr) {
        const anchor = styleLine.indexOf(":")
        if (anchor <= 0) {
          continue
        }
  
        const key = styleLine.substring(0, anchor).trim()
        const value = styleLine.substring(anchor + 1).trim()
  
        // 허용된 key 및 기본값이 아닌 value만 저장
        if (allowedKey.indexOf(key) >= 0
          && skipValue[key] !== value ) {
          style[key] = value
        }
      }
    }
  }

  return style
}

function getStyleStr(html: string) {
  const parsedStyle = getStyle(html)
  const styles = [] as string[]
  for (const [key, value] of Object.entries(parsedStyle)) {
    styles.push(`${key}: ${value};`)
  }
  if (styles.length <= 0) {
    return ""
  }
  return `style="${styles.join("")}"`
}

const shirinkTag = ["p", "span", "b", "i", "u", "sub", "sup", "strike"]
function shirinkTrash(html: string) {
  for (const tag of shirinkTag) {
    html = html.replaceAll(`<${tag}></${tag}>`, "")
  }
  return html
}

const shirinkTextRaw = [` color="#000000"`, / face=".+?"/g]
function shirinkText(html: string) {
  for (const color of shirinkTextRaw) {
    html = html.replaceAll(color, "")
  }
  return html
}

function shirinkP(html: string) {
  return html.replace(/<(span|p|b).*?>/ig, (pStr) => {
    let tag = "p"
    if (pStr.startsWith("<span")) {
      tag = "span"
    } else if (pStr.startsWith("<b")) {
      tag = "b"
    }
    
    const style = getStyleStr(pStr)

    if (style.length <= 0) {
      return `<${tag}>`
    } else {
      return `<${tag} ${style}">`
    }
  })
}

function shirinkImg(html: string) {
  return html.replace(/<img.*?>/ig, (imgStr) => {
    const srcAttr = getAttr(imgStr, "src")
    if (srcAttr.length <= 0) {
      return `<img>`
    }
    return `<img ${srcAttr}>`
  })
}

function shirinkFont(html: string) {
  return html.replace(/<font.*?>/ig, (fontStr) => {
    const attrs = [] as string[]
    attrs.push(getAttr(fontStr, "color"))
    attrs.push(getAttr(fontStr, "size"))
    attrs.push(getStyleStr(fontStr))

    const subStr = attrs.join(" ").trim()
    if (subStr.length <= 0) {
      return "<font>"
    }
    return `<font ${subStr}>`
  })
}

function getAttr(html: string, attrname: string) {
  const arr = html.match(new RegExp(`${attrname}=".*?"`, "i"))
  if (arr == null || arr.length <= 0) {
    return ""
  }
  return `${attrname}="${
    arr[0].substring(attrname.length + 2, arr[0].length - 1)
  }"`
}