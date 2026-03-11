import { and, count, desc, eq, gt } from 'drizzle-orm'
import { z } from 'zod'
import { CORS_ORIGIN, PORT } from './config'
import { db } from './db'
import { vaultHolder } from './schema'

const holdersQuerySchema = z.object({
  vault: z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'Invalid vault address'),
  page: z.coerce.number().int().min(0).default(0),
  size: z.coerce.number().int().min(1).max(200).default(50),
})

const corsHeaders = {
  'Access-Control-Allow-Origin': CORS_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function jsonBig(
  data: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
) {
  const body = JSON.stringify(data, (_, v) =>
    typeof v === 'bigint' ? v.toString() : v,
  )
  return new Response(body, {
    status: init.status ?? 200,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
      ...init.headers,
    },
  })
}

const server = Bun.serve({
  hostname: '0.0.0.0',
  port: PORT,

  async fetch(req) {
    const url = new URL(req.url)

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    if (url.pathname === '/health') {
      return Response.json({ status: 'ok' }, { headers: corsHeaders })
    }

    if (url.pathname === '/holders' && req.method === 'GET') {
      const parsed = holdersQuerySchema.safeParse({
        vault: url.searchParams.get('vault'),
        page: url.searchParams.get('page') ?? undefined,
        size: url.searchParams.get('size') ?? undefined,
      })

      if (!parsed.success) {
        return jsonBig(
          { error: 'Invalid query params', issues: parsed.error.issues },
          { status: 400 },
        )
      }

      const { vault, page, size } = parsed.data
      const filter = and(
        eq(vaultHolder.vault, vault.toLowerCase() as `0x${string}`),
        gt(vaultHolder.shares, 0n),
      )

      try {
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

        return jsonBig({ items, total: totals[0]?.total ?? 0, page, size })
      } catch (err) {
        process.stderr.write(`holders query error: ${String(err)}\n`)
        return jsonBig({ error: String(err) }, { status: 500 })
      }
    }

    return jsonBig({ error: 'Not found' }, { status: 404 })
  },
})

process.stdout.write(`Vault API running on port ${server.port}\n`)
