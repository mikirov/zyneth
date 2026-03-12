import { bigint, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

// Mirror of packages/ponder/ponder.schema.ts vaultHolder table.
// Column names must match ponder's snake_case output.
export const vaultHolder = pgTable('vault_holder', {
  id: text('id').primaryKey(),
  vault: text('vault').notNull(),
  holder: text('holder').notNull(),
  shares: bigint('shares', { mode: 'bigint' }).notNull(),
  lastUpdatedBlock: integer('last_updated_block').notNull(),
  lastUpdatedTimestamp: timestamp('last_updated_timestamp', {
    withTimezone: true,
  }).notNull(),
})

// Mirror of packages/ponder/ponder.schema.ts basketUpdate table.
export const basketUpdate = pgTable('basket_update', {
  id: text('id').primaryKey(),
  vault: text('vault').notNull(),
  tokens: text('tokens').notNull(),
  weights: text('weights').notNull(),
  chainId: integer('chain_id').notNull(),
  blockNumber: integer('block_number').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
  txnHash: text('txn_hash').notNull(),
})
