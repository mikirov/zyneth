import { db } from 'ponder:api'
import schema, { vaultHolder } from 'ponder:schema'
import { and, count, desc, eq, gt } from 'drizzle-orm'
import { Hono } from 'hono'
import { graphql } from 'ponder'

const app = new Hono()

app.use('/', graphql({ db, schema }))
app.use('/graphql', graphql({ db, schema }))

app.get('/holders', async (c) => {
  const vault = c.req.query('vault')?.toLowerCase()
  const page = Math.max(0, Number(c.req.query('page') ?? 0))
  const size = Math.min(200, Math.max(1, Number(c.req.query('size') ?? 50)))

  if (!vault) return c.json({ error: 'vault param required' }, 400)

  const filter = and(
    eq(vaultHolder.vault, vault as `0x${string}`),
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

  return c.json({ items, total: totals[0]?.total ?? 0, page, size })
})

export default app
