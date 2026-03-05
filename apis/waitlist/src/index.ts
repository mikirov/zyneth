import { createDb, waitlist } from '@zyneth/database'
import { z } from 'zod'

const waitlistSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(255),
  lastName: z.string().min(1, 'Last name is required').max(255),
  email: z.string().email('Invalid email address').max(255),
  interests: z.string().optional(),
})

const db = createDb(process.env.DATABASE_URL!)

const server = Bun.serve({
  port: Number(process.env.PORT) || 3001,

  async fetch(req) {
    const url = new URL(req.url)

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    if (url.pathname === '/api/waitlist' && req.method === 'POST') {
      try {
        const body = await req.json()
        const parsed = waitlistSchema.safeParse(body)

        if (!parsed.success) {
          return Response.json(
            { error: 'Validation failed', issues: parsed.error.issues },
            { status: 400, headers: corsHeaders },
          )
        }

        const { firstName, lastName, email, interests } = parsed.data

        const result = await db
          .insert(waitlist)
          .values({ firstName, lastName, email, interests })
          .onConflictDoNothing({ target: waitlist.email })
          .returning()

        if (result.length === 0) {
          return Response.json(
            { message: 'Already on the waitlist' },
            { status: 200, headers: corsHeaders },
          )
        }

        return Response.json(
          { message: 'Added to waitlist', id: result[0].id },
          { status: 201, headers: corsHeaders },
        )
      } catch {
        return Response.json(
          { error: 'Internal server error' },
          { status: 500, headers: corsHeaders },
        )
      }
    }

    if (url.pathname === '/health') {
      return Response.json({ status: 'ok' }, { headers: corsHeaders })
    }

    return Response.json(
      { error: 'Not found' },
      { status: 404, headers: corsHeaders },
    )
  },
})

// biome-ignore lint/suspicious/noConsole: startup log
console.log(`Waitlist API running on port ${server.port}`)
