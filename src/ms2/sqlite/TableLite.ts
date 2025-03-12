import { Database } from "bun:sqlite"
import { buildCreateSchema, type ColumnDataType, type InputType, type SchemaType } from "./Schema.ts"

export class TableLite<T extends SchemaType> {
  protected columnNames: Array<keyof T>
  protected columnNamesStr: string
  protected columnNames$Str: string

  protected replaceOnConflict = true
  public constructor(
    protected database:Database,
    protected tableName: string,
    protected schema: T,
  ) {
    this.ensureTableExists()
    // set column names
    this.columnNames = Object.keys(this.schema)
    this.columnNamesStr = this.columnNames.join(", ")
    this.columnNames$Str = this.columnNames.map((v) => `$${String(v)}`).join(", ")
  }
  /**
   * Ensure table is exist.
   */
  protected ensureTableExists() {
    this.database.query(`CREATE TABLE IF NOT EXISTS ${this.tableName} (
      ${buildCreateSchema(this.schema)}
    );`).run()
  }

  public insert(...values:InputType<T>[]) {
    if (values.length <= 0) {
      return -1
    }
    const query = this.database.query(
      `INSERT INTO ${values} (${this.columnNamesStr})
      VALUES (${this.columnNames$Str})
      ON CONFLICT ${this.replaceOnConflict ? "REPLACE" : "IGNORE"};`
    )

    if (values.length === 1) {
      return query.run(
        values[0]
      ).changes
    }
    // transaction
    this.database.transaction((elements: Record<string, ColumnDataType>[]) => {
      /*
      for (const el of elements) {
        // query.
      }
        */
    })
  }
}