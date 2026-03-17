import { type Address, createPublicClient, type Hex, http } from 'viem'
import { base } from 'viem/chains'
import { vaultAbi } from './abi'
import { PYTH_HERMES_URL, RPC_URL } from './config'

const CACHE_TTL_MS = 5_000
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 500

interface CachedUpdate {
  updateData: Hex[]
  fetchedAt: number
}

// Cache keyed by sorted feed IDs
const cache = new Map<string, CachedUpdate>()

const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
})

/** Read basket feed IDs from a vault contract. */
export async function getVaultFeedIds(vault: Address): Promise<Hex[]> {
  const length = await publicClient.readContract({
    address: vault,
    abi: vaultAbi,
    functionName: 'basketLength',
  })

  const feedIds: Hex[] = []
  for (let i = 0; i < Number(length); i++) {
    const token = await publicClient.readContract({
      address: vault,
      abi: vaultAbi,
      functionName: 'basketTokens',
      args: [BigInt(i)],
    })
    const feedId = await publicClient.readContract({
      address: vault,
      abi: vaultAbi,
      functionName: 'tokenPriceFeedId',
      args: [token as Address],
    })
    if (
      feedId &&
      feedId !==
        '0x0000000000000000000000000000000000000000000000000000000000000000'
    ) {
      feedIds.push(feedId as Hex)
    }
  }
  return feedIds
}

/** Fetch Pyth price update data from Hermes with retry and caching. */
export async function fetchPriceUpdate(feedIds: Hex[]): Promise<Hex[]> {
  if (feedIds.length === 0) return []

  const cacheKey = feedIds.sort().join(',')
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.updateData
  }

  const params = feedIds.map((id) => `ids[]=${id}`).join('&')
  const url = `${PYTH_HERMES_URL}/v2/updates/price/latest?${params}`

  let lastError: Error | undefined
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url)
      if (res.ok) {
        const json = (await res.json()) as { binary: { data: string[] } }
        const updateData: Hex[] = json.binary.data.map(
          (hex: string) => `0x${hex}` as Hex,
        )
        cache.set(cacheKey, { updateData, fetchedAt: Date.now() })
        return updateData
      }
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`Hermes ${res.status}`)
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)))
        continue
      }
      throw new Error(`Hermes error: ${res.status}`)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)))
      }
    }
  }
  throw lastError ?? new Error('Failed to fetch Pyth price update')
}
