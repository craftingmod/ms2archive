/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, no-case-declarations */
import sqlite3, { Database } from "bun:sqlite"

export enum DataTypesLite {
  INTEGER_NULLABLE,
  INTEGER,
  BIGINT_NULLABLE,
  BIGINT,
  STRING_NULLABLE,
  STRING,
  STRING_ARRAY,
  DATE_NULLABLE,
  DATE,
  BLOB_NULLABLE,
  BLOB,
}


// Gemini가 만들어 준 룩업 테이블
const DATA_TYPE_SCHEMA_PROPERTIES: Record<DataTypesLite, { baseSqlType: string; isNonNullVariant: boolean }> = {
  [DataTypesLite.INTEGER_NULLABLE]: { baseSqlType: "INTEGER", isNonNullVariant: false },
  [DataTypesLite.INTEGER]: { baseSqlType: "INTEGER", isNonNullVariant: true },
  [DataTypesLite.BIGINT_NULLABLE]: { baseSqlType: "BIGINT", isNonNullVariant: false },
  [DataTypesLite.BIGINT]: { baseSqlType: "BIGINT", isNonNullVariant: true },
  [DataTypesLite.STRING_NULLABLE]: { baseSqlType: "TEXT", isNonNullVariant: false },
  [DataTypesLite.STRING]: { baseSqlType: "TEXT", isNonNullVariant: true },
  [DataTypesLite.STRING_ARRAY]: { baseSqlType: "TEXT", isNonNullVariant: true }, // 스키마 상 non-nullable 문자열처럼 취급
  [DataTypesLite.DATE_NULLABLE]: { baseSqlType: "BIGINT", isNonNullVariant: false }, // UTC Timestamp
  [DataTypesLite.DATE]: { baseSqlType: "BIGINT", isNonNullVariant: true },  // UTC Timestamp
  [DataTypesLite.BLOB]: { baseSqlType: "BLOB", isNonNullVariant: true },
  [DataTypesLite.BLOB_NULLABLE]: { baseSqlType: "BLOB", isNonNullVariant: false }
}


export class SequelizeLite {
  public database: Database
  public constructor(
    protected readonly path: string,
    protected readonly useWAL = false,
  ) {
    this.database = new sqlite3(path, {
      create: true,
      safeIntegers: true,
    })
    if (useWAL) {
      this.database.exec("PRAGMA journal_mode = WAL;")
    }
  }
  public define<T extends ModelDefinition>(tableName: string, modelDef: T, additionalDef: Partial<ModelToAdditional<T>> = {}) {
    const model = new ModelLite<T>(this.database, tableName, modelDef, additionalDef)
    return model
  }
  public dropTable(tableName: string) {
    this.database.prepare(`DROP TABLE IF EXISTS ${tableName}`).run()
  }
}

export class ModelLite<T extends ModelDefinition> {

  protected insertColumns: string | null = null
  protected insertQuestions: string | null = null

  public constructor(
    protected database: Database,
    public readonly tableName: string,
    public modelDef: T,
    protected additionalDef: Partial<ModelToAdditional<T>> = {}
  ) {
    this.init()
  }
  protected init() {
    const columns = Object.entries(this.modelDef).map(([key, dataTypeValue]) => {
      // modelDef의 값이 undefined일 경우를 대비 (예: { field: undefined })
      // 이 경우 schemaProps가 undefined가 되어 아래의 !schemaProps 조건문에서 처리됩니다.
      const schemaProps = dataTypeValue !== undefined ? DATA_TYPE_SCHEMA_PROPERTIES[dataTypeValue as DataTypesLite] : undefined

      if (!schemaProps) {
        // 원래 switch문의 default 케이스와 동일한 역할
        throw new Error(`DataTypes ${dataTypeValue} not implemented or invalid!`)
      }

      const additionalInfo = this.additionalDef[key] ?? []
      let columnSpec = `${key} ${schemaProps.baseSqlType}`

      if (additionalInfo.includes(AdditionalDef.PRIMARY_KEY)) {
        columnSpec += " PRIMARY KEY"
      }

      // 타입 자체가 non-nullable variant인 경우 NOT NULL 추가 (원래 로직과 동일)
      if (schemaProps.isNonNullVariant) {
        columnSpec += " NOT NULL"
      }
      return columnSpec
    })
    const sql = /*sql*/`CREATE TABLE IF NOT EXISTS ${this.tableName} (
      ${columns.join(",")}
    )`
    this.database.prepare(sql).run()
  }
  /**
   * Find one element from database
   * @param condition Condition to find 
   * @param params Additional params for sqlite
   * @returns `Found element` or `null` if not found
   */
  public findOne<C extends Partial<T>>(condition: ModelToJSObject<C> | null = null, params: Partial<Omit<ManyParams<T>, "limit">> = {}) {
    const result = this.findMany(condition, { ...params, limit: 1 })
    if (result.length <= 0) {
      return null
    }
    return result[0] ?? null
  }
  /**
   * Find all elements from database with condition
   * @param condition Condition to find
   * @param params Additional params for sqlite
   * @returns `Found element`[]
   */
  public findMany<C extends Partial<T>>(condition: ModelToJSObject<C> | null = null, params: Partial<ManyParams<T>> = {}) {
    const postfix = this.makePostfixSQL(params)
    if (condition == null) {
      const result = this.database.prepare(/*sql*/`SELECT * FROM ${this.tableName}${postfix}`).all()
      return result.map((item) => this.convertDBToJS(item as any))
    }
    const queryCondition = this.convertRawJSToDB<C>(this.modelDef as unknown as C, condition)

    const query = Object.keys(queryCondition).map((key) => `${key} = ?`).join(` ${(params.queryAsOR ?? false) ? "OR" : "AND"} `)
    const result = this.database.prepare(/*sql*/`
      SELECT * FROM ${this.tableName} WHERE ${query}${postfix}
    `).all(...Object.values(queryCondition)) as ModelToDBObject<T>[]

    return result.map((item) => this.convertDBToJS(item))
  }
  public findManySQL(querySQL: string, sqlParams: unknown[], options: Partial<ManyParams<T>> = {}) {
    const postfix = this.makePostfixSQL(options)
    const result = this.database.prepare(/*sql*/`
      SELECT * FROM ${this.tableName} WHERE ${querySQL}${postfix}
    `).all(...sqlParams as any[]) as ModelToDBObject<T>[];

    return result.map((item) => this.convertDBToJS(item))
  }
  /**
   * Find all elements without condition
   * @param params Additional params for sqlite
   * @returns `Found element`[]
   */
  public findAll(params: Partial<ManyParams<T>> = {}) {
    return this.findMany(null, params)
  }
  public insertOne(data: ModelToJSObject<T>) {
    const insertData = this.convertJSToDB(data)

    let columns = this.insertColumns
    if (columns == null) {
      columns = Object.keys(insertData).join(",")
      this.insertColumns = columns
    }
    let values = this.insertQuestions
    if (values == null) {
      values = Object.keys(insertData).map(() => "?").join(",")
      this.insertQuestions = values
    }

    this.database.prepare(/*sql*/`
      INSERT OR REPLACE INTO ${this.tableName} (${columns}) VALUES (${values})
    `).run(...Object.values(insertData))
  }
  public insertMany(data: Array<ModelToJSObject<T>>) {
    if (data.length <= 0) {
      return
    }
    const firstData = this.convertJSToDB(data[0])
    let columns = this.insertColumns
    if (columns == null) {
      columns = Object.keys(firstData).join(",")
      this.insertColumns = columns
    }
    let values = this.insertQuestions
    if (values == null) {
      values = Object.keys(firstData).map(() => "?").join(",")
      this.insertQuestions = values
    }

    const insert = this.database.prepare(/*sql*/`
      INSERT OR REPLACE INTO ${this.tableName} (
        ${columns}
      ) VALUES (
        ${values}
      )
    `)
    const result = this.database.transaction((innerData: Array<ModelToJSObject<T>>) => {
      for (const item of innerData) {
        const insertItem = this.convertJSToDB(item)
        insert.run(...Object.values(insertItem))
      }
    })(data)
  }
  public updateOne<C extends Partial<T>, D extends Partial<T>>(condition: ModelToJSObject<C>, updateData: ModelToJSObject<D>) {
    if (Object.keys(condition).length <= 0) {
      throw new Error("Condition is empty!")
    }
    const queryCondition = this.convertRawJSToDB<C>(this.modelDef as unknown as C, condition)
    const queryUpdateData = this.convertRawJSToDB<D>(this.modelDef as unknown as D, updateData)

    const query = Object.keys(queryCondition).map((key) => `${key} = ?`).join(" AND ")
    const update = Object.keys(queryUpdateData).map((key) => `${key} = ?`).join(",")
    this.database.prepare(/*sql*/`
      UPDATE ${this.tableName} SET ${update} WHERE ${query}
    `).run(...Object.values(queryUpdateData).concat(Object.values(queryCondition)))
  }

  public updateMany(modifiers: Array<{ condition: ModelToJSObject<Partial<T>>, updateTo: ModelToJSObject<Partial<T>> }>) {
    this.database.transaction((innerData: Array<{ condition: ModelToJSObject<Partial<T>>, updateTo: ModelToJSObject<Partial<T>> }>) => {
      for (const { condition, updateTo } of innerData) {
        const queryCondition = this.convertRawJSToDB<Partial<T>>(this.modelDef as unknown as Partial<T>, condition)
        const queryUpdateData = this.convertRawJSToDB<Partial<T>>(this.modelDef as unknown as Partial<T>, updateTo)

        const query = Object.keys(queryCondition).map((key) => `${key} = ?`).join(" AND ")
        const update = Object.keys(queryUpdateData).map((key) => `${key} = ?`).join(",")

        const prepareFn = this.database.prepare(/*sql*/`
          UPDATE ${this.tableName} SET ${update} WHERE ${query}
        `)
        prepareFn.run(...Object.values(queryUpdateData).concat(Object.values(queryCondition)))
      }
    })(modifiers)
  }

  public deleteOne<C extends Partial<T>>(condition: ModelToJSObject<C>) {
    if (Object.keys(condition).length <= 0) {
      throw new Error("Condition is empty!")
    }
    const queryCondition = this.convertRawJSToDB<C>(this.modelDef as unknown as C, condition)

    const query = Object.keys(queryCondition).map((key) => `${key} = ?`).join(" AND ")
    this.database.prepare(/*sql*/`
      DELETE FROM ${this.tableName} WHERE ${query}
    `).run(...Object.values(queryCondition))
  }

  protected convertDBToJS(data: ModelToDBObject<T>) {
    const result: ModelToJSObject<T> = {} as any
    for (const entry of Object.entries(data)) {
      const key = entry[0] as keyof T
      const value = entry[1]
      if (value == null) {
        result[key] = null as any
        continue
      }

      switch (this.modelDef[key]) {
        case DataTypesLite.INTEGER:
        case DataTypesLite.INTEGER_NULLABLE:
          result[key] = Number(value) as any
          break
        case DataTypesLite.BIGINT:
        case DataTypesLite.BIGINT_NULLABLE:
          result[key] = BigInt(value) as any
          break
        case DataTypesLite.STRING:
        case DataTypesLite.STRING_NULLABLE:
          result[key] = value
          break
        case DataTypesLite.STRING_ARRAY:
          const valueStr = value as string | null
          if (valueStr == null || valueStr.length <= 0) {
            result[key] = [] as any
          } else if (valueStr.startsWith("[")) {
            result[key] = JSON.parse(value) as (any[] | null) ?? ([] as any)
          } else {
            result[key] = valueStr.split(",") as any
          }
          break
        case DataTypesLite.DATE:
        case DataTypesLite.DATE_NULLABLE:
          result[key] = new Date(Number(value)) as any
          break
        case DataTypesLite.BLOB:
        case DataTypesLite.BLOB_NULLABLE:
          result[key] = value as any
          break
        default:
          throw new Error(`DataTypes ${this.modelDef[key]} not implemented!`)
      }
    }
    return result
  }

  protected convertRawJSToDB<V extends Partial<T>>(modelDef: V, data: ModelToJSObject<V>) {
    const result: ModelToDBObject<V> = {} as any
    for (const entry of Object.entries(data)) {
      const key = entry[0] as keyof V
      const value = entry[1] as any
      if (value == null) {
        result[key] = null as any // Force-put
        continue
      }

      switch (modelDef[key]) {
        case DataTypesLite.INTEGER:
        case DataTypesLite.INTEGER_NULLABLE:
          result[key] = Number(value) as any
          break
        case DataTypesLite.BIGINT:
        case DataTypesLite.BIGINT_NULLABLE:
          result[key] = BigInt(value) as any
          break
        case DataTypesLite.STRING:
        case DataTypesLite.STRING_NULLABLE:
          result[key] = value
          break
        case DataTypesLite.STRING_ARRAY:
          result[key] = (value as string[]).join(",") as any
          break
        case DataTypesLite.DATE:
        case DataTypesLite.DATE_NULLABLE:
          result[key] = Number(value) as any
          break
        case DataTypesLite.BLOB:
        case DataTypesLite.BLOB_NULLABLE:
          result[key] = value as any
          break
        default:
          throw new Error(`DataTypes ${modelDef[key]} not implemented!`)
      }
    }
    return result
  }

  protected convertJSToDB(data: ModelToJSObject<T>) {
    return this.convertRawJSToDB(this.modelDef, data)
  }

  protected makePostfixSQL(params: Partial<ManyParams<T>>) {
    let result = ""
    if (params.orderBy != null && params.orderBy.length > 0) {
      const orderQuery = params.orderBy.map((item) => `${String(item.columnName)} ${item.order ?? "ASC"}`).join(",")
      result += ` ORDER BY ${orderQuery}`
    }
    if (params.limit != null && params.limit >= 1) {
      result += ` LIMIT ${params.limit}`
    }
    return result
  }
}

export enum AdditionalDef {
  PRIMARY_KEY,
}

export type ModelDefinition = {
  [key: string]: DataTypesLite | undefined
}

export interface ManyParams<T extends ModelDefinition> {
  limit: number,
  orderBy: Array<{ columnName: keyof T, order?: "ASC" | "DESC" }>,
  queryAsOR: boolean,
}

type ModelToAdditional<T extends ModelDefinition> = Partial<{ [key in keyof T]: AdditionalDef[] }>

export type ModelToJSObject<T extends ModelDefinition> = { [key in keyof T]: DataTypeToJSType<T[key]> }

export type ModelToDBObject<T extends ModelDefinition> = { [key in keyof T]: DataTypeToDBType<T[key]> }

export type DefinedModelToJSObject<T> = T extends ModelLite<infer U> ? ModelToJSObject<U> : never

type DataTypeToJSType<T> =
  T extends undefined ? never :
  T extends DataTypesLite.INTEGER_NULLABLE ? number | null :
  T extends DataTypesLite.INTEGER ? number :
  T extends DataTypesLite.BIGINT_NULLABLE ? bigint | null :
  T extends DataTypesLite.BIGINT ? bigint :
  T extends DataTypesLite.STRING_NULLABLE ? string | null :
  T extends DataTypesLite.STRING ? string :
  T extends DataTypesLite.STRING_ARRAY ? string[] :
  T extends DataTypesLite.DATE_NULLABLE ? Date | null :
  T extends DataTypesLite.DATE ? Date :
  T extends DataTypesLite.BLOB_NULLABLE ? Uint8Array | null :
  T extends DataTypesLite.BLOB ? Uint8Array : never

type DataTypeToDBType<T> =
  T extends undefined ? never :
  T extends DataTypesLite.INTEGER_NULLABLE ? bigint | null :
  T extends DataTypesLite.INTEGER ? bigint :
  T extends DataTypesLite.BIGINT_NULLABLE ? bigint | null :
  T extends DataTypesLite.BIGINT ? bigint :
  T extends DataTypesLite.STRING_NULLABLE ? string | null :
  T extends DataTypesLite.STRING ? string :
  T extends DataTypesLite.DATE_NULLABLE ? bigint | null :
  T extends DataTypesLite.DATE ? bigint :
  T extends DataTypesLite.BLOB_NULLABLE ? Uint8Array | null :
  T extends DataTypesLite.BLOB ? Uint8Array : never

type JSTypeToDBType<T> =
  T extends undefined ? never :
  T extends string[] ? string :
  T extends number | null ? bigint | null :
  T extends number ? bigint :
  T extends Date | null ? bigint | null :
  T extends Date ? bigint :
  T extends Uint8Array | null ? Uint8Array | null :
  T extends Uint8Array ? Uint8Array : never


type StrongPartial<T> = Pick<T, keyof T>
