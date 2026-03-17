import { z } from 'zod'

const env = z
  .object({
    PORT: z.coerce.number().default(3004),
    RPC_URL: z.string().min(1, 'RPC_URL is required'),
    PYTH_HERMES_URL: z.string().default('https://hermes.pyth.network'),
    CORS_ORIGIN: z.string().default('*'),
  })
  .parse(process.env)

export const { PORT, RPC_URL, PYTH_HERMES_URL, CORS_ORIGIN } = env
