import { z } from 'zod'

const env = z
  .object({
    PORT: z.coerce.number().default(3004),
    RPC_URL: z.string().min(1, 'RPC_URL is required'),
    PYTH_HERMES_URL: z.string().default('https://hermes.pyth.network'),
    PONDER_DATABASE_URL: z.string().optional(),
    PONDER_SCHEMA_ID: z
      .string()
      .optional()
      .transform((v) => v || 'zyneth-ponder'),
  })
  .parse(process.env)

export const {
  PORT,
  RPC_URL,
  PYTH_HERMES_URL,
  PONDER_DATABASE_URL,
  PONDER_SCHEMA_ID,
} = env
