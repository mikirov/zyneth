import { desc, eq } from 'drizzle-orm'
import { type Address, createPublicClient, erc20Abi, http } from 'viem'
import { base } from 'viem/chains'
import { vaultAbi } from './abi'
import { RPC_URL } from './config'
import { db } from './db'
import { basketUpdate, vaultHolder, vaultSnapshot, vaultState } from './schema'

const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
})

export interface BasketToken {
  address: string
  weight: string
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
  user?: {
    shareBalance: string
    shareValue: string
    usdcBalance: string
    usdcAllowance: string
  }
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
  const [snapshot, state, basket, holder] = await Promise.all([
    // Latest snapshot for this vault
    db
      .select()
      .from(vaultSnapshot)
      .where(eq(vaultSnapshot.vault, vaultLower))
      .orderBy(desc(vaultSnapshot.blockNumber))
      .limit(1)
      .then((rows) => rows[0] ?? null),

    // Vault state (paused, fees)
    db
      .select()
      .from(vaultState)
      .where(eq(vaultState.id, vaultLower))
      .limit(1)
      .then((rows) => rows[0] ?? null),

    // Latest basket update
    db
      .select()
      .from(basketUpdate)
      .where(eq(basketUpdate.vault, vaultLower))
      .orderBy(desc(basketUpdate.blockNumber))
      .limit(1)
      .then((rows) => rows[0] ?? null),

    // User's share balance (if user provided)
    user
      ? db
          .select()
          .from(vaultHolder)
          .where(eq(vaultHolder.id, `${vaultLower}-${user.toLowerCase()}`))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
  ])

  // Parse basket tokens/weights from JSON
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

  // Compute share value from snapshot data
  const totalAssets = snapshot?.totalAssets ?? 0n
  const totalSupply = snapshot?.totalShares ?? 0n
  const sharePrice = snapshot?.sharePrice ?? 0n
  const userShares = holder?.shares ?? 0n
  const userShareValue =
    totalSupply > 0n ? (userShares * totalAssets) / totalSupply : 0n

  // RPC calls for data that can't be indexed (USDC balances + allowance)
  const asset = (await publicClient.readContract({
    address: vault,
    abi: vaultAbi,
    functionName: 'asset',
  })) as Address

  const rpcCalls = [
    publicClient.readContract({
      address: asset,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [vault],
    }),
  ]

  if (user) {
    rpcCalls.push(
      publicClient.readContract({
        address: asset,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [user],
      }),
      publicClient.readContract({
        address: asset,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [user, vault],
      }),
    )
  }

  const rpcResults = await Promise.all(rpcCalls)
  const vaultUsdcBalance = rpcResults[0] as bigint

  const userData = user
    ? {
        shareBalance: userShares.toString(),
        shareValue: userShareValue.toString(),
        usdcBalance: (rpcResults[1] as bigint).toString(),
        usdcAllowance: (rpcResults[2] as bigint).toString(),
      }
    : undefined

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
