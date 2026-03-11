import { index, onchainTable } from 'ponder'

export const vaultDeposit = onchainTable(
  'vault_deposit',
  (t) => ({
    id: t.text().primaryKey(),
    vault: t.hex().notNull(),
    sender: t.hex().notNull(),
    owner: t.hex().notNull(),
    assets: t.bigint().notNull(),
    shares: t.bigint().notNull(),
    chainId: t.integer().notNull(),
    blockNumber: t.integer().notNull(),
    timestamp: t.timestamp({ withTimezone: true }).notNull(),
    txnHash: t.hex().notNull(),
  }),
  (t) => ({
    vaultIdx: index('vault_deposit_vault_idx').on(t.vault),
    ownerIdx: index('vault_deposit_owner_idx').on(t.owner),
  }),
)

export const vaultWithdraw = onchainTable(
  'vault_withdraw',
  (t) => ({
    id: t.text().primaryKey(),
    vault: t.hex().notNull(),
    sender: t.hex().notNull(),
    receiver: t.hex().notNull(),
    owner: t.hex().notNull(),
    assets: t.bigint().notNull(),
    shares: t.bigint().notNull(),
    chainId: t.integer().notNull(),
    blockNumber: t.integer().notNull(),
    timestamp: t.timestamp({ withTimezone: true }).notNull(),
    txnHash: t.hex().notNull(),
  }),
  (t) => ({
    vaultIdx: index('vault_withdraw_vault_idx').on(t.vault),
    ownerIdx: index('vault_withdraw_owner_idx').on(t.owner),
  }),
)

export const vaultSnapshot = onchainTable(
  'vault_snapshot',
  (t) => ({
    id: t.text().primaryKey(),
    vault: t.hex().notNull(),
    totalAssets: t.bigint().notNull(),
    totalShares: t.bigint().notNull(),
    sharePrice: t.bigint().notNull(),
    blockNumber: t.integer().notNull(),
    timestamp: t.timestamp({ withTimezone: true }).notNull(),
  }),
  (t) => ({
    vaultIdx: index('vault_snapshot_vault_idx').on(t.vault),
  }),
)

export const navReport = onchainTable(
  'nav_report',
  (t) => ({
    id: t.text().primaryKey(),
    vault: t.hex().notNull(),
    newNav: t.bigint().notNull(),
    managementFee: t.bigint().notNull(),
    performanceFee: t.bigint().notNull(),
    chainId: t.integer().notNull(),
    blockNumber: t.integer().notNull(),
    timestamp: t.timestamp({ withTimezone: true }).notNull(),
    txnHash: t.hex().notNull(),
  }),
  (t) => ({
    vaultIdx: index('nav_report_vault_idx').on(t.vault),
  }),
)

export const basketUpdate = onchainTable(
  'basket_update',
  (t) => ({
    id: t.text().primaryKey(),
    vault: t.hex().notNull(),
    tokens: t.text().notNull(),
    weights: t.text().notNull(),
    chainId: t.integer().notNull(),
    blockNumber: t.integer().notNull(),
    timestamp: t.timestamp({ withTimezone: true }).notNull(),
    txnHash: t.hex().notNull(),
  }),
  (t) => ({
    vaultIdx: index('basket_update_vault_idx').on(t.vault),
  }),
)

export const vaultTransfer = onchainTable(
  'vault_transfer',
  (t) => ({
    id: t.text().primaryKey(),
    vault: t.hex().notNull(),
    from: t.hex().notNull(),
    to: t.hex().notNull(),
    value: t.bigint().notNull(),
    chainId: t.integer().notNull(),
    blockNumber: t.integer().notNull(),
    timestamp: t.timestamp({ withTimezone: true }).notNull(),
    txnHash: t.hex().notNull(),
  }),
  (t) => ({
    vaultIdx: index('vault_transfer_vault_idx').on(t.vault),
    fromIdx: index('vault_transfer_from_idx').on(t.from),
    toIdx: index('vault_transfer_to_idx').on(t.to),
  }),
)

export const vaultHolder = onchainTable(
  'vault_holder',
  (t) => ({
    id: t.text().primaryKey(), // `${vault}-${holder}`
    vault: t.hex().notNull(),
    holder: t.hex().notNull(),
    shares: t.bigint().notNull(),
    lastUpdatedBlock: t.integer().notNull(),
    lastUpdatedTimestamp: t.timestamp({ withTimezone: true }).notNull(),
  }),
  (t) => ({
    vaultIdx: index('vault_holder_vault_idx').on(t.vault),
    holderIdx: index('vault_holder_holder_idx').on(t.holder),
  }),
)
