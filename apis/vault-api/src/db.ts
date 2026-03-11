import { is, Table } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { PONDER_DATABASE_URL, PONDER_SCHEMA_ID } from './config'
import * as schema from './schema'

const setDatabaseSchema = <T extends { [name: string]: unknown }>(
  s: T,
  schemaName: string,
): T => {
  for (const table of Object.values(s)) {
    if (is(table, Table)) {
      // @ts-expect-error solution from https://github.com/ponder-sh/ponder/issues/1674
      table[Symbol.for('drizzle:Schema')] = schemaName
    }
  }
  return s
}

setDatabaseSchema(schema, PONDER_SCHEMA_ID)

export const db = drizzle(PONDER_DATABASE_URL, {
  schema,
  casing: 'snake_case',
})
