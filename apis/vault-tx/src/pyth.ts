import type { Address, Hex } from 'viem'
import { PYTH_HERMES_URL } from './config'
import { ALL_FEED_IDS, VAULT_FEEDS } from './feeds'
import { getMemoryCache } from './pyth-worker'
import { redis } from './redis'

const REDIS_KEY_UPDATE = 'pyth:update:all'
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 500

/** Get feed IDs for a vault from the hardcoded config. */
export function getVaultFeedIds(vault: Address): Hex[] {
  return VAULT_FEEDS[vault.toLowerCase()] ?? []
}

/**
 * Get fresh Pyth price update data.
 * Priority: Redis (from SSE worker) → in-memory cache → HTTP fallback
 */
export async function fetchPriceUpdate(_feedIds: Hex[]): Promise<Hex[]> {
  if (ALL_FEED_IDS.length === 0) return []

  // 1. Try Redis (populated by SSE worker)
  if (redis) {
    const cached = await redis.get(REDIS_KEY_UPDATE)
    if (cached) {
      return JSON.parse(cached) as Hex[]
    }
  }

  // 2. Try in-memory cache (also populated by SSE worker, or when Redis is unavailable)
  const mem = getMemoryCache()
  if (mem && Date.now() - mem.updatedAt < 60_000) {
    return mem.updateData
  }

  // 3. HTTP fallback (direct Hermes fetch)
  return fetchFromHermes(_feedIds.length > 0 ? _feedIds : ALL_FEED_IDS)
}

async function fetchFromHermes(feedIds: Hex[]): Promise<Hex[]> {
  const params = feedIds.map((id) => `ids[]=${id}`).join('&')
  const url = `${PYTH_HERMES_URL}/v2/updates/price/latest?${params}`

  let lastError: Error | undefined
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url)
      if (res.ok) {
        const json = (await res.json()) as { binary: { data: string[] } }
        return json.binary.data.map((hex: string) => `0x${hex}` as Hex)
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
