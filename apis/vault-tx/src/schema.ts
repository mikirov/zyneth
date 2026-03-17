import {
  bigint,
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

// Mirrors of ponder tables. Column names must match ponder's snake_case output.

export const vaultSnapshot = pgTable('vault_snapshot', {
  id: text('id').primaryKey(),
  vault: text('vault').notNull(),
  totalAssets: bigint('total_assets', { mode: 'bigint' }).notNull(),
  totalShares: bigint('total_shares', { mode: 'bigint' }).notNull(),
  sharePrice: bigint('share_price', { mode: 'bigint' }).notNull(),
  blockNumber: integer('block_number').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
})

export const vaultState = pgTable('vault_state', {
  id: text('id').primaryKey(), // vault address
  paused: boolean('paused').notNull(),
  redemptionFeeBps: integer('redemption_fee_bps').notNull(),
  managementFeeBps: integer('management_fee_bps').notNull(),
  lastUpdatedBlock: integer('last_updated_block').notNull(),
  lastUpdatedTimestamp: timestamp('last_updated_timestamp', {
    withTimezone: true,
  }).notNull(),
})

export const basketUpdate = pgTable('basket_update', {
  id: text('id').primaryKey(),
  vault: text('vault').notNull(),
  tokens: text('tokens').notNull(),
  weights: text('weights').notNull(),
  blockNumber: integer('block_number').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
})

export const holderPoints = pgTable('holder_points', {
  id: text('id').primaryKey(), // `${vault}-${holder}`
  vault: text('vault').notNull(),
  holder: text('holder').notNull(),
  accumulatedPoints: bigint('accumulated_points', { mode: 'bigint' }).notNull(),
  assetsBalance: bigint('assets_balance', { mode: 'bigint' }).notNull(),
  lastPointsTimestamp: timestamp('last_points_timestamp', {
    withTimezone: true,
  }).notNull(),
})

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
