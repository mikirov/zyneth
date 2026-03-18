import type { Hex } from 'viem'
import { PYTH_HERMES_URL } from './config'
import { ALL_FEED_IDS } from './feeds'
import { log } from './log'
import { redis } from './redis'

const RECONNECT_DELAY_MS = 3_000
const REDIS_KEY_UPDATE = 'pyth:update:all'
const REDIS_KEY_META = 'pyth:meta:lastUpdate'

/** In-memory fallback when Redis is not configured */
let memoryCache: { updateData: Hex[]; updatedAt: number } | null = null

export function getMemoryCache() {
  return memoryCache
}

/**
 * Connect to Pyth Hermes SSE stream and store price updates in Redis.
 * Auto-reconnects on disconnect.
 */
export function startPythWorker() {
  if (ALL_FEED_IDS.length === 0) {
    log.warn('[pyth-worker] No feed IDs configured, skipping')
    return
  }

  log.info(`[pyth-worker] Starting SSE stream for ${ALL_FEED_IDS.length} feeds`)
  connectStream()
}

async function connectStream() {
  const params = ALL_FEED_IDS.map((id) => `ids[]=${id}`).join('&')
  const url = `${PYTH_HERMES_URL}/v2/updates/price/stream?${params}&encoding=hex&parsed=true`

  try {
    const res = await fetch(url)
    if (!res.ok || !res.body) {
      log.error(`[pyth-worker] SSE connection failed: ${res.status}`)
      scheduleReconnect()
      return
    }

    log.info('[pyth-worker] Connected to Hermes SSE stream')

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Process complete SSE events (separated by double newlines)
      const events = buffer.split('\n\n')
      buffer = events.pop() ?? '' // Keep incomplete event in buffer

      for (const event of events) {
        const dataLine = event
          .split('\n')
          .find((line) => line.startsWith('data:'))
        if (!dataLine) continue

        try {
          const json = JSON.parse(dataLine.slice(5).trim()) as {
            binary: { data: string[] }
          }
          const updateData: Hex[] = json.binary.data.map(
            (hex) => `0x${hex}` as Hex,
          )

          // Store in Redis
          if (redis) {
            await redis.set(REDIS_KEY_UPDATE, JSON.stringify(updateData))
            await redis.set(REDIS_KEY_META, Date.now().toString())
          }

          // Always update in-memory fallback
          memoryCache = { updateData, updatedAt: Date.now() }
        } catch {
          // Skip malformed events
        }
      }
    }

    // Stream ended — reconnect
    log.warn('[pyth-worker] SSE stream ended, reconnecting...')
    scheduleReconnect()
  } catch (err) {
    log.error(
      `[pyth-worker] SSE error: ${err instanceof Error ? err.message : err}`,
    )
    scheduleReconnect()
  }
}

function scheduleReconnect() {
  setTimeout(connectStream, RECONNECT_DELAY_MS)
}
