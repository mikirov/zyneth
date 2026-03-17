import { ponder } from 'ponder:registry'
import {
  basketUpdate,
  holderPoints,
  navReport,
  vaultDeposit,
  vaultHolder,
  vaultSnapshot,
  vaultTransfer,
  vaultWithdraw,
} from 'ponder:schema'
import { ZynethVaultAbi } from '@zyneth/ponder/abis'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

// Cache of pointsStartTimestamp per vault (read from contract on first Transfer)
const POINTS_START_CACHE: Record<string, bigint> = {}

// Points: 1 point per $100 USDC per day, scaled by 1e18
// USDC has 6 decimals, so $100 = 100_000_000 (100e6)
const POINTS_PRECISION = 10n ** 18n
const HUNDRED_USDC = 100_000_000n // 100 USDC in 6-decimal units
const SECONDS_PER_DAY = 86400n

/**
 * Calculate points earned over a time range, handling multiplier boundaries.
 * Splits the range at day 7 and day 28 boundaries to apply correct multipliers.
 */
function calculatePoints(
  assetsBalance: bigint,
  fromSeconds: bigint,
  toSeconds: bigint,
  launchTimestamp: bigint,
): bigint {
  if (assetsBalance <= 0n || toSeconds <= fromSeconds) return 0n

  // Multiplier boundaries in seconds since launch
  const boundary1 = 7n * SECONDS_PER_DAY // end of 3x
  const boundary2 = 28n * SECONDS_PER_DAY // end of 2x

  const fromSinceLaunch = fromSeconds - launchTimestamp
  const toSinceLaunch = toSeconds - launchTimestamp

  let totalPoints = 0n

  // Split time range across multiplier boundaries
  const ranges: { start: bigint; end: bigint; multiplier: bigint }[] = []

  let cursor = fromSinceLaunch < 0n ? 0n : fromSinceLaunch
  const endCursor = toSinceLaunch

  if (cursor < boundary1 && endCursor > cursor) {
    const rangeEnd = endCursor < boundary1 ? endCursor : boundary1
    ranges.push({ start: cursor, end: rangeEnd, multiplier: 3n })
    cursor = rangeEnd
  }
  if (cursor < boundary2 && endCursor > cursor) {
    const rangeEnd = endCursor < boundary2 ? endCursor : boundary2
    ranges.push({ start: cursor, end: rangeEnd, multiplier: 2n })
    cursor = rangeEnd
  }
  if (endCursor > cursor) {
    ranges.push({ start: cursor, end: endCursor, multiplier: 1n })
  }

  for (const range of ranges) {
    const elapsed = range.end - range.start
    // points = assetsBalance * elapsed * multiplier * 1e18 / (100 USDC * 86400)
    totalPoints +=
      (assetsBalance * elapsed * range.multiplier * POINTS_PRECISION) /
      (HUNDRED_USDC * SECONDS_PER_DAY)
  }

  return totalPoints
}

/**
 * Accrue points for a holder based on their current USDC-equivalent balance.
 * Called on each Transfer event for both sender and receiver.
 */
async function accruePoints(
  vault: `0x${string}`,
  holder: `0x${string}`,
  newAssetsBalance: bigint,
  eventTimestamp: bigint,
  launchTimestamp: bigint,
  // biome-ignore lint/suspicious/noExplicitAny: ponder db context type
  db: any,
) {
  const id = `${vault}-${holder}`
  const now = new Date(Number(eventTimestamp) * 1000)

  await db
    .insert(holderPoints)
    .values({
      id,
      vault,
      holder,
      accumulatedPoints: 0n,
      assetsBalance: newAssetsBalance,
      lastPointsTimestamp: now,
    })
    // biome-ignore lint/suspicious/noExplicitAny: ponder row type
    .onConflictDoUpdate((row: any) => {
      const lastTs = BigInt(
        Math.floor(row.lastPointsTimestamp.getTime() / 1000),
      )
      const earned = calculatePoints(
        row.assetsBalance,
        lastTs,
        eventTimestamp,
        launchTimestamp,
      )
      return {
        accumulatedPoints: row.accumulatedPoints + earned,
        assetsBalance: newAssetsBalance,
        lastPointsTimestamp: now,
      }
    })
}

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
  const eventTs = event.block.timestamp

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
      .onConflictDoUpdate((row) => ({
        shares: row.shares + value,
        lastUpdatedBlock: blockNumber,
        lastUpdatedTimestamp: timestamp,
      }))
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
      .onConflictDoUpdate((row) => ({
        shares: row.shares - value,
        lastUpdatedBlock: blockNumber,
        lastUpdatedTimestamp: timestamp,
      }))
  }

  // --- Points accrual ---
  // Read and cache pointsStartTimestamp from contract
  if (POINTS_START_CACHE[vault] === undefined) {
    POINTS_START_CACHE[vault] = await context.client.readContract({
      abi: ZynethVaultAbi,
      address: vault,
      functionName: 'pointsStartTimestamp',
    })
  }
  const pointsStart = POINTS_START_CACHE[vault]

  // Skip if not configured or event is before start
  if (pointsStart === 0n || eventTs < pointsStart) return

  // Read current vault state for shares→assets conversion
  const [totalAssets, totalSupply] = await Promise.all([
    context.client.readContract({
      abi: ZynethVaultAbi,
      address: vault,
      functionName: 'totalAssets',
    }),
    context.client.readContract({
      abi: ZynethVaultAbi,
      address: vault,
      functionName: 'totalSupply',
    }),
  ])

  // Accrue points for recipient (non-zero, non-mint)
  if (to !== ZERO_ADDRESS) {
    const toShares = await context.client.readContract({
      abi: ZynethVaultAbi,
      address: vault,
      functionName: 'balanceOf',
      args: [to],
    })
    const toAssets =
      totalSupply > 0n ? (toShares * totalAssets) / totalSupply : 0n
    await accruePoints(vault, to, toAssets, eventTs, pointsStart, context.db)
  }

  // Accrue points for sender (non-zero, non-burn)
  if (from !== ZERO_ADDRESS) {
    const fromShares = await context.client.readContract({
      abi: ZynethVaultAbi,
      address: vault,
      functionName: 'balanceOf',
      args: [from],
    })
    const fromAssets =
      totalSupply > 0n ? (fromShares * totalAssets) / totalSupply : 0n
    await accruePoints(
      vault,
      from,
      fromAssets,
      eventTs,
      pointsStart,
      context.db,
    )
  }
})
