import cors from '@elysiajs/cors'
import { and, count, desc, eq, gt } from 'drizzle-orm'
import { Elysia, t } from 'elysia'
import { CORS_ORIGIN, PORT } from './config'
import { db } from './db'
import { basketUpdate, vaultHolder } from './schema'

// Elysia doesn't auto-serialize bigints — override globally
;(BigInt.prototype as unknown as { toJSON: () => string }).toJSON =
  function () {
    return this.toString()
  }

new Elysia()
  .use(cors({ origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN }))
  .get('/health', () => ({ status: 'ok' }))
  .get(
    '/holders',
    async ({ query }) => {
      const vault = query.vault.toLowerCase() as `0x${string}`
      const page = query.page ?? 0
      const size = query.size ?? 50

      const filter = and(
        eq(vaultHolder.vault, vault),
        gt(vaultHolder.shares, 0n),
      )

      const [items, totals] = await Promise.all([
        db
          .select({
            holder: vaultHolder.holder,
            shares: vaultHolder.shares,
            lastUpdatedBlock: vaultHolder.lastUpdatedBlock,
            lastUpdatedTimestamp: vaultHolder.lastUpdatedTimestamp,
          })
          .from(vaultHolder)
          .where(filter)
          .orderBy(desc(vaultHolder.shares))
          .limit(size)
          .offset(page * size),
        db.select({ total: count() }).from(vaultHolder).where(filter),
      ])

      return { items, total: totals[0]?.total ?? 0, page, size }
    },
    {
      query: t.Object({
        vault: t.String({ pattern: '^0x[0-9a-fA-F]{40}$' }),
        page: t.Optional(t.Number({ minimum: 0, default: 0 })),
        size: t.Optional(t.Number({ minimum: 1, maximum: 200, default: 50 })),
      }),
    },
  )
  .get(
    '/basket-tokens',
    async ({ query }) => {
      const vault = query.vault.toLowerCase() as `0x${string}`

      const rows = await db
        .select({ tokens: basketUpdate.tokens })
        .from(basketUpdate)
        .where(eq(basketUpdate.vault, vault))
        .orderBy(desc(basketUpdate.blockNumber))

      // Collect every token address that has ever appeared in any basket update
      const allTokens = new Set<string>()
      for (const row of rows) {
        const parsed = JSON.parse(row.tokens) as string[]
        for (const t of parsed) allTokens.add(t.toLowerCase())
      }

      // Current basket = most recent update's tokens
      const currentTokens = new Set<string>()
      if (rows.length > 0) {
        const latest = JSON.parse(rows[0].tokens) as string[]
        for (const t of latest) currentTokens.add(t.toLowerCase())
      }

      // Orphaned = appeared historically but not in current basket
      const orphaned = [...allTokens].filter((t) => !currentTokens.has(t))

      return { current: [...currentTokens], orphaned, all: [...allTokens] }
    },
    {
      query: t.Object({
        vault: t.String({ pattern: '^0x[0-9a-fA-F]{40}$' }),
      }),
    },
  )
  .listen({
    hostname: '0.0.0.0',
    port: PORT,
  })
