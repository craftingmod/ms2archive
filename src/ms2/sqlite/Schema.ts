
export type ColumnDataType = string | bigint | number | Uint8Array

export type ValueWithMeta<T extends ColumnDataType> = ValueWithMetaNotNull<T> | ValueWithMetaNullable<T>

interface ValueWithMetaNotNull<T extends ColumnDataType> {
  value: T,
  isPrimaryKey?: boolean,
  isUnique?: boolean,
  isNullable?: false,
}

interface ValueWithMetaNullable<T extends ColumnDataType> {
  value: T,
  isPrimaryKey?: false,
  isUnique?: boolean,
  isNullable: true,
}

export type NullableValue<T extends ColumnDataType> = [T, null]

export type SchemaType = {
  [key in string]: ValueType<ColumnDataType>
}

/**
 * ValueWithMeta<T>로 정의된 {} 타입
 */
type ValueType<T extends ColumnDataType> = T | ValueWithMeta<T> | NullableValue<T>

/**
 * ValueType에서 T 추출하기
 */
type ExtractValueType<T extends ValueType<ColumnDataType>> = 
  T extends ValueWithMetaNullable<infer V> ? V | null :
  T extends ValueWithMetaNotNull<infer V> ? V :
  T extends NullableValue<infer V> ? V | null :
  T

type RawValueType<T extends ColumnDataType | null> =
  T extends null ? null :
  T extends boolean ? (0 | 1) :
  T extends Date ? number :
  T

/**
 * Extract K-V data from SchemaType
 * for using Typescript
 */
export type InputType<S extends SchemaType> = {
  [K in keyof S]: ExtractValueType<S[K]>
}

export type RawInputType<S extends SchemaType> = {
  [K in keyof S]: RawValueType<ExtractValueType<S[K]>>
}

/**
 * CREATE TABLE schema builder
 * @param schema Schema
 * @returns CREATE TABLE table (`this part`)
 */
export function buildCreateSchema(schema: SchemaType) {
  
  const createEntryList = [] as string[]
  const schemaEntries = Object.entries(schema)
  for (const [key, value] of schemaEntries) {
    const elements = [] as string[]
    const schemaData = determineData(value)
    // column name
    if (key.indexOf(" ") >= 0) {
      throw new Error("Key must not have blank space!")
    }
    elements.push(key)
    // Type
    const valueType = determineValueType(schemaData.value)
    elements.push(valueType)
    // Not Null
    if (!schemaData.isNullable) {
      elements.push("NOT NULL")
    }
    // Unique
    if (!schemaData.isPrimaryKey && schemaData.isUnique) {
      elements.push("UNIQUE")
    }
    // Primary Key
    if (schemaData.isPrimaryKey) {
      elements.push("PRIMARY KEY")
    }
    createEntryList.push(elements.join(" "))
  }
  return createEntryList.join(", ")
}

function determineData(unknownData: ColumnDataType | ValueWithMeta<ColumnDataType> | NullableValue<ColumnDataType>) {
  const defaultValue = {
    isPrimaryKey: false,
    isUnique: false,
    isNullable: false,
    value: 0 as ColumnDataType,
  }
  // unknownData is primitive/byte[]
  if (
    unknownData instanceof Uint8Array ||
    typeof unknownData === "string" ||
    typeof unknownData === "number" ||
    typeof unknownData === "bigint"
  ) {
    defaultValue.value = unknownData
    return defaultValue
  }
  // unknownType is [T, null]
  if (Array.isArray(unknownData)) {
    defaultValue.isNullable = true
    defaultValue.value = unknownData[0]
    return defaultValue
  }
  // unknownType is ValueWithMeta {}
  defaultValue.isPrimaryKey = unknownData.isPrimaryKey ?? false
  defaultValue.isUnique = unknownData.isUnique ?? false
  defaultValue.isNullable = unknownData.isNullable ?? false
  defaultValue.value = unknownData.value
  return defaultValue
}

function determineValueType(unknownType: ColumnDataType) {
  if (unknownType instanceof Uint8Array) {
    return "BLOB"
  }
  if (typeof unknownType === "string") {
    return "TEXT"
  }
  if (typeof unknownType === "number") {
    const absValue= Math.abs(unknownType)
    if (absValue - Math.floor(absValue) >= 0.00001) {
      return "REAL"
    }
    return "INTEGER"
  }
  if (typeof unknownType === "bigint") {
    return "INTEGER"
  }
  throw new Error("Unknown Type!")
}


const useSample = {
  articleId: {
    value: 0,
    isPrimaryKey: true,
  },
  articleName: ["hi", null],
  articleUse: "aaa",
} satisfies SchemaType

type Test = InputType<typeof useSample>

