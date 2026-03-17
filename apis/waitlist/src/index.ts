import { corsHeaders } from '@zyneth/api-utils'
import { createDb, waitlist } from '@zyneth/database'
import { Elysia, t } from 'elysia'

const db = createDb(process.env.DATABASE_URL!)

new Elysia()
  .use(corsHeaders(process.env.CORS_ORIGIN))
  .get('/health', () => ({ status: 'ok' }))
  .post(
    '/api/waitlist',
    async ({ body }) => {
      const { firstName, lastName, email, interests } = body

      const result = await db
        .insert(waitlist)
        .values({ firstName, lastName, email, interests })
        .onConflictDoNothing({ target: waitlist.email })
        .returning()

      if (result.length === 0) {
        return { message: 'Already on the waitlist' }
      }

      return { message: 'Added to waitlist', id: result[0].id }
    },
    {
      body: t.Object({
        firstName: t.String({ minLength: 1, maxLength: 255 }),
        lastName: t.String({ minLength: 1, maxLength: 255 }),
        email: t.String({ format: 'email', maxLength: 255 }),
        interests: t.Optional(t.String()),
      }),
    },
  )
  .listen({
    hostname: '0.0.0.0',
    port: Number(process.env.PORT) || 3004,
  })
