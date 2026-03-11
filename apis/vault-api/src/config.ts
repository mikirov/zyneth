import { z } from 'zod'

const env = z
  .object({
    PORT: z.coerce.number().default(3003),
    PONDER_DATABASE_URL: z.string().min(1, 'PONDER_DATABASE_URL is required'),
    PONDER_SCHEMA_ID: z.string().default('zyneth-ponder'),
    CORS_ORIGIN: z.string().default('*'),
  })
  .parse(process.env)

export const { PORT, PONDER_DATABASE_URL, PONDER_SCHEMA_ID, CORS_ORIGIN } = env
