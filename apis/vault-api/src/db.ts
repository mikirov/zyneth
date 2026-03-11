import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { PONDER_DATABASE_URL, PONDER_SCHEMA_ID } from './config'
import * as schema from './schema'

const client = postgres(PONDER_DATABASE_URL, {
  prepare: false,
  // Search path ensures ponder tables are found in the correct PostgreSQL schema.
  // Locally ponder uses 'public'; on Railway it uses the value from --schema flag.
  connection: { search_path: PONDER_SCHEMA_ID },
})

export const db = drizzle(client, { schema })
