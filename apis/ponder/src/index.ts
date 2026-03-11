import { ponder } from 'ponder:registry'
import {
  basketUpdate,
  navReport,
  vaultDeposit,
  vaultHolder,
  vaultSnapshot,
  vaultTransfer,
  vaultWithdraw,
} from 'ponder:schema'
import { ZynethVaultAbi } from '@zyneth/ponder/abis'
import { sql } from 'drizzle-orm'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

ponder.on('ZynethVault:Deposit', async ({ event, context }) => {
  await context.db
    .insert(vaultDeposit)
    .values({
      id: event.id,
      vault: event.log.address,
      sender: event.args.sender,
      owner: event.args.owner,
      assets: event.args.assets,
      shares: event.args.shares,
      chainId: context.chain.id,
      blockNumber: Number(event.block.number),
      timestamp: new Date(Number(event.block.timestamp) * 1000),
      txnHash: event.transaction.hash,
    })
    .onConflictDoNothing()

  // Take a snapshot of vault state after deposit
  const totalAssets = await context.client.readContract({
    abi: ZynethVaultAbi,
    address: event.log.address,
    functionName: 'totalAssets',
  })
  const totalShares = await context.client.readContract({
    abi: ZynethVaultAbi,
    address: event.log.address,
    functionName: 'totalSupply',
  })
  const sharePrice =
    totalShares > 0n ? (totalAssets * 10n ** 18n) / totalShares : 10n ** 18n

  await context.db
    .insert(vaultSnapshot)
    .values({
      id: `${event.log.address}-${event.block.number}`,
      vault: event.log.address,
      totalAssets,
      totalShares,
      sharePrice,
      blockNumber: Number(event.block.number),
      timestamp: new Date(Number(event.block.timestamp) * 1000),
    })
    .onConflictDoNothing()
})

ponder.on('ZynethVault:Withdraw', async ({ event, context }) => {
  await context.db
    .insert(vaultWithdraw)
    .values({
      id: event.id,
      vault: event.log.address,
      sender: event.args.sender,
      receiver: event.args.receiver,
      owner: event.args.owner,
      assets: event.args.assets,
      shares: event.args.shares,
      chainId: context.chain.id,
      blockNumber: Number(event.block.number),
      timestamp: new Date(Number(event.block.timestamp) * 1000),
      txnHash: event.transaction.hash,
    })
    .onConflictDoNothing()

  // Take a snapshot of vault state after withdraw
  const totalAssets = await context.client.readContract({
    abi: ZynethVaultAbi,
    address: event.log.address,
    functionName: 'totalAssets',
  })
  const totalShares = await context.client.readContract({
    abi: ZynethVaultAbi,
    address: event.log.address,
    functionName: 'totalSupply',
  })
  const sharePrice =
    totalShares > 0n ? (totalAssets * 10n ** 18n) / totalShares : 10n ** 18n

  await context.db
    .insert(vaultSnapshot)
    .values({
      id: `${event.log.address}-${event.block.number}`,
      vault: event.log.address,
      totalAssets,
      totalShares,
      sharePrice,
      blockNumber: Number(event.block.number),
      timestamp: new Date(Number(event.block.timestamp) * 1000),
    })
    .onConflictDoNothing()
})

ponder.on('ZynethVault:NavReported', async ({ event, context }) => {
  await context.db
    .insert(navReport)
    .values({
      id: event.id,
      vault: event.log.address,
      newNav: event.args.newNav,
      managementFee: event.args.managementFee,
      performanceFee: event.args.performanceFee,
      chainId: context.chain.id,
      blockNumber: Number(event.block.number),
      timestamp: new Date(Number(event.block.timestamp) * 1000),
      txnHash: event.transaction.hash,
    })
    .onConflictDoNothing()

  // Take a snapshot after NAV report
  const totalShares = await context.client.readContract({
    abi: ZynethVaultAbi,
    address: event.log.address,
    functionName: 'totalSupply',
  })
  const sharePrice =
    totalShares > 0n
      ? (event.args.newNav * 10n ** 18n) / totalShares
      : 10n ** 18n

  await context.db
    .insert(vaultSnapshot)
    .values({
      id: `${event.log.address}-${event.block.number}`,
      vault: event.log.address,
      totalAssets: event.args.newNav,
      totalShares,
      sharePrice,
      blockNumber: Number(event.block.number),
      timestamp: new Date(Number(event.block.timestamp) * 1000),
    })
    .onConflictDoNothing()
})

ponder.on('ZynethVault:BasketUpdated', async ({ event, context }) => {
  await context.db
    .insert(basketUpdate)
    .values({
      id: event.id,
      vault: event.log.address,
      tokens: JSON.stringify(event.args.tokens),
      weights: JSON.stringify(event.args.weights.map(String)),
      chainId: context.chain.id,
      blockNumber: Number(event.block.number),
      timestamp: new Date(Number(event.block.timestamp) * 1000),
      txnHash: event.transaction.hash,
    })
    .onConflictDoNothing()
})

ponder.on('ZynethVault:Transfer', async ({ event, context }) => {
  const { from, to, value } = event.args
  const vault = event.log.address
  const blockNumber = Number(event.block.number)
  const timestamp = new Date(Number(event.block.timestamp) * 1000)

  await context.db
    .insert(vaultTransfer)
    .values({
      id: event.id,
      vault,
      from,
      to,
      value,
      chainId: context.chain.id,
      blockNumber,
      timestamp,
      txnHash: event.transaction.hash,
    })
    .onConflictDoNothing()

  // Recipient gains shares
  if (to !== ZERO_ADDRESS) {
    await context.db
      .insert(vaultHolder)
      .values({
        id: `${vault}-${to}`,
        vault,
        holder: to,
        shares: value,
        lastUpdatedBlock: blockNumber,
        lastUpdatedTimestamp: timestamp,
      })
      .onConflictDoUpdate({
        target: vaultHolder.id,
        set: {
          shares: sql`${vaultHolder.shares} + ${value}`,
          lastUpdatedBlock: blockNumber,
          lastUpdatedTimestamp: timestamp,
        },
      })
  }

  // Sender loses shares (skip zero-address = mint events)
  if (from !== ZERO_ADDRESS) {
    await context.db
      .insert(vaultHolder)
      .values({
        id: `${vault}-${from}`,
        vault,
        holder: from,
        shares: 0n,
        lastUpdatedBlock: blockNumber,
        lastUpdatedTimestamp: timestamp,
      })
      .onConflictDoUpdate({
        target: vaultHolder.id,
        set: {
          shares: sql`${vaultHolder.shares} - ${value}`,
          lastUpdatedBlock: blockNumber,
          lastUpdatedTimestamp: timestamp,
        },
      })
  }
})
