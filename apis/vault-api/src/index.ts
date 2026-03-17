import cors from '@elysiajs/cors'
import { and, count, desc, eq, gt, sql } from 'drizzle-orm'
import { Elysia, t } from 'elysia'
import { CORS_ORIGIN, PORT } from './config'
import { db } from './db'
import { basketUpdate, holderPoints, vaultHolder } from './schema'

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
  .get(
    '/points',
    async ({ query }) => {
      const holder = query.holder.toLowerCase() as `0x${string}`

      const rows = await db
        .select({
          vault: holderPoints.vault,
          accumulatedPoints: holderPoints.accumulatedPoints,
          assetsBalance: holderPoints.assetsBalance,
          lastPointsTimestamp: holderPoints.lastPointsTimestamp,
        })
        .from(holderPoints)
        .where(eq(holderPoints.holder, holder))

      // Calculate real-time pending points since last event
      const nowSeconds = BigInt(Math.floor(Date.now() / 1000))
      const POINTS_PRECISION = 10n ** 18n
      const HUNDRED_USDC = 100_000_000n
      const SECONDS_PER_DAY = 86400n

      let totalPoints = 0n
      const vaults = rows.map((row) => {
        const lastTs = BigInt(
          Math.floor(row.lastPointsTimestamp.getTime() / 1000),
        )
        const elapsed = nowSeconds > lastTs ? nowSeconds - lastTs : 0n
        // Pending uses 1x multiplier (current period is likely past week 5)
        const pending =
          row.assetsBalance > 0n && elapsed > 0n
            ? (row.assetsBalance * elapsed * POINTS_PRECISION) /
              (HUNDRED_USDC * SECONDS_PER_DAY)
            : 0n
        const total = row.accumulatedPoints + pending
        totalPoints += total
        return {
          vault: row.vault,
          accumulated: row.accumulatedPoints.toString(),
          pending: pending.toString(),
          total: total.toString(),
          assetsBalance: row.assetsBalance.toString(),
        }
      })

      return { holder, totalPoints: totalPoints.toString(), vaults }
    },
    {
      query: t.Object({
        holder: t.String({ pattern: '^0x[0-9a-fA-F]{40}$' }),
      }),
    },
  )
  .get(
    '/leaderboard',
    async ({ query }) => {
      const vault = query.vault?.toLowerCase() as `0x${string}` | undefined
      const page = query.page ?? 0
      const size = query.size ?? 50

      const filter = vault
        ? and(
            eq(holderPoints.vault, vault),
            gt(holderPoints.accumulatedPoints, 0n),
          )
        : gt(holderPoints.accumulatedPoints, 0n)

      // When no vault filter, aggregate across all vaults per holder
      if (!vault) {
        const items = await db
          .select({
            holder: holderPoints.holder,
            totalPoints: sql<string>`sum(${holderPoints.accumulatedPoints})::text`,
          })
          .from(holderPoints)
          .where(gt(holderPoints.accumulatedPoints, 0n))
          .groupBy(holderPoints.holder)
          .orderBy(desc(sql`sum(${holderPoints.accumulatedPoints})`))
          .limit(size)
          .offset(page * size)

        const totals = await db
          .select({
            total: sql<number>`count(distinct ${holderPoints.holder})::int`,
          })
          .from(holderPoints)
          .where(gt(holderPoints.accumulatedPoints, 0n))

        return {
          items: items.map((item, i) => ({
            rank: page * size + i + 1,
            holder: item.holder,
            points: item.totalPoints,
          })),
          total: totals[0]?.total ?? 0,
          page,
          size,
        }
      }

      const [items, totals] = await Promise.all([
        db
          .select({
            holder: holderPoints.holder,
            points: holderPoints.accumulatedPoints,
          })
          .from(holderPoints)
          .where(filter)
          .orderBy(desc(holderPoints.accumulatedPoints))
          .limit(size)
          .offset(page * size),
        db.select({ total: count() }).from(holderPoints).where(filter),
      ])

      return {
        items: items.map((item, i) => ({
          rank: page * size + i + 1,
          holder: item.holder,
          points: item.points.toString(),
        })),
        total: totals[0]?.total ?? 0,
        page,
        size,
      }
    },
    {
      query: t.Object({
        vault: t.Optional(t.String({ pattern: '^0x[0-9a-fA-F]{40}$' })),
        page: t.Optional(t.Number({ minimum: 0, default: 0 })),
        size: t.Optional(t.Number({ minimum: 1, maximum: 200, default: 50 })),
      }),
    },
  )
  .listen({
    hostname: '0.0.0.0',
    port: PORT,
  })
