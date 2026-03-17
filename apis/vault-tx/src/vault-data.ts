import { desc, eq } from 'drizzle-orm'
import { type Address, createPublicClient, erc20Abi, http } from 'viem'
import { base } from 'viem/chains'
import { vaultAbi } from './abi'
import { RPC_URL } from './config'
import { db } from './db'
import {
  basketUpdate,
  holderPoints,
  vaultHolder,
  vaultSnapshot,
  vaultState,
} from './schema'

const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
})

// Points: 1 point per $100 USDC per day, scaled by 1e18
const POINTS_PRECISION = 10n ** 18n
const HUNDRED_USDC = 100_000_000n
const SECONDS_PER_DAY = 86400n

export interface BasketToken {
  address: string
  weight: string
}

export interface UserData {
  shareBalance: string
  shareValue: string
  usdcBalance: string
  usdcAllowance: string
  points: {
    accumulated: string
    pending: string
    total: string
  }
}

export interface VaultData {
  totalAssets: string
  totalSupply: string
  sharePrice: string
  paused: boolean
  redemptionFeeBps: number
  managementFeeBps: number
  basket: BasketToken[]
  vaultUsdcBalance: string
  user?: UserData
}

export async function getVaultData(
  vault: Address,
  user?: Address,
): Promise<VaultData> {
  if (!db) {
    throw new Error('PONDER_DATABASE_URL not configured')
  }

  const vaultLower = vault.toLowerCase()

  // Parallel DB queries
  const [snapshot, state, basket, holder, points] = await Promise.all([
    db
      .select()
      .from(vaultSnapshot)
      .where(eq(vaultSnapshot.vault, vaultLower))
      .orderBy(desc(vaultSnapshot.blockNumber))
      .limit(1)
      .then((rows) => rows[0] ?? null),

    db
      .select()
      .from(vaultState)
      .where(eq(vaultState.id, vaultLower))
      .limit(1)
      .then((rows) => rows[0] ?? null),

    db
      .select()
      .from(basketUpdate)
      .where(eq(basketUpdate.vault, vaultLower))
      .orderBy(desc(basketUpdate.blockNumber))
      .limit(1)
      .then((rows) => rows[0] ?? null),

    user
      ? db
          .select()
          .from(vaultHolder)
          .where(eq(vaultHolder.id, `${vaultLower}-${user.toLowerCase()}`))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),

    user
      ? db
          .select()
          .from(holderPoints)
          .where(eq(holderPoints.id, `${vaultLower}-${user.toLowerCase()}`))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
  ])

  const basketTokens: BasketToken[] = basket
    ? (() => {
        const tokens: string[] = JSON.parse(basket.tokens)
        const weights: string[] = JSON.parse(basket.weights)
        return tokens.map((addr, i) => ({
          address: addr,
          weight: weights[i] ?? '0',
        }))
      })()
    : []

  const totalAssets = snapshot?.totalAssets ?? 0n
  const totalSupply = snapshot?.totalShares ?? 0n
  const sharePrice = snapshot?.sharePrice ?? 0n
  const userShares = holder?.shares ?? 0n
  const userShareValue =
    totalSupply > 0n ? (userShares * totalAssets) / totalSupply : 0n

  // Single multicall for all RPC reads (USDC balances + allowance + asset address)
  const asset = (await publicClient.readContract({
    address: vault,
    abi: vaultAbi,
    functionName: 'asset',
  })) as Address

  const multicallContracts = [
    {
      address: asset,
      abi: erc20Abi,
      functionName: 'balanceOf' as const,
      args: [vault] as const,
    },
    ...(user
      ? [
          {
            address: asset,
            abi: erc20Abi,
            functionName: 'balanceOf' as const,
            args: [user] as const,
          },
          {
            address: asset,
            abi: erc20Abi,
            functionName: 'allowance' as const,
            args: [user, vault] as const,
          },
        ]
      : []),
  ]

  const rpcResults = await publicClient.multicall({
    contracts: multicallContracts,
    allowFailure: true,
  })

  const vaultUsdcBalance =
    rpcResults[0].status === 'success' ? (rpcResults[0].result as bigint) : 0n

  let userData: UserData | undefined
  if (user) {
    const usdcBalance =
      rpcResults[1]?.status === 'success'
        ? (rpcResults[1].result as bigint)
        : 0n
    const usdcAllowance =
      rpcResults[2]?.status === 'success'
        ? (rpcResults[2].result as bigint)
        : 0n

    // Calculate pending points
    const accumulated = points?.accumulatedPoints ?? 0n
    let pending = 0n
    if (points && points.assetsBalance > 0n) {
      const lastTs = BigInt(
        Math.floor(points.lastPointsTimestamp.getTime() / 1000),
      )
      const nowTs = BigInt(Math.floor(Date.now() / 1000))
      const elapsed = nowTs - lastTs
      if (elapsed > 0n) {
        pending =
          (points.assetsBalance * elapsed * POINTS_PRECISION) /
          (HUNDRED_USDC * SECONDS_PER_DAY)
      }
    }

    userData = {
      shareBalance: userShares.toString(),
      shareValue: userShareValue.toString(),
      usdcBalance: usdcBalance.toString(),
      usdcAllowance: usdcAllowance.toString(),
      points: {
        accumulated: accumulated.toString(),
        pending: pending.toString(),
        total: (accumulated + pending).toString(),
      },
    }
  }

  return {
    totalAssets: totalAssets.toString(),
    totalSupply: totalSupply.toString(),
    sharePrice: sharePrice.toString(),
    paused: state?.paused ?? false,
    redemptionFeeBps: state?.redemptionFeeBps ?? 5,
    managementFeeBps: state?.managementFeeBps ?? 100,
    basket: basketTokens,
    vaultUsdcBalance: vaultUsdcBalance.toString(),
    user: userData,
  }
}
