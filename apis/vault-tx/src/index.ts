import { corsHeaders } from '@zyneth/api-utils'
import { Elysia, t } from 'elysia'
import type { Address, Hex } from 'viem'
import {
  type BatchOutputCheck,
  encodeBatchExecute,
  encodeDeposit,
  encodeDepositWithPermit,
  encodeMint,
  encodeMintWithPermit,
  encodeRedeemInKind,
} from './calldata'
import { PORT } from './config'
import { fetchPriceUpdate, getVaultFeedIds } from './pyth'
import { startPythWorker } from './pyth-worker'
import { previewDeposit, previewMint, simulateTx } from './simulate'
import { getVaultData } from './vault-data'

const hexString = t.String({ pattern: '^0x[0-9a-fA-F]+$' })

const app = new Elysia()
  .use(corsHeaders(process.env.CORS_ORIGIN))
  .get('/health', () => ({ status: 'ok' }))

  // ─── Vault Data (replaces ~20 frontend RPC calls with 1 API call) ───────────
  .get(
    '/vault/:address',
    async ({ params, query }) => {
      const vault = params.address as Address
      const user = query.user as Address | undefined
      return getVaultData(vault, user)
    },
    {
      params: t.Object({ address: hexString }),
      query: t.Object({ user: t.Optional(hexString) }),
    },
  )

  // ─── Deposit / Mint ─────────────────────────────────────────────────────────
  .post(
    '/tx/deposit',
    async ({ body }) => {
      const vault = body.vault as Address
      const receiver = body.receiver as Address
      const amount = BigInt(body.amount)
      const mode = body.mode

      // 1. Fetch Pyth prices
      const feedIds = await getVaultFeedIds(vault)
      const pythUpdateData = await fetchPriceUpdate(feedIds)

      // 2. Encode calldata
      const tx =
        mode === 'exact-shares'
          ? encodeMint(vault, amount, receiver, pythUpdateData)
          : encodeDeposit(vault, amount, receiver, pythUpdateData)

      // 3. Simulate
      const sim = await simulateTx(tx, receiver)
      if (!sim.success) {
        return { tx, simulation: { error: sim.error }, preview: null }
      }

      // 4. Preview
      const preview =
        mode === 'exact-shares'
          ? { usdcCost: (await previewMint(vault, amount)).toString() }
          : { sharesOut: (await previewDeposit(vault, amount)).toString() }

      return { tx, simulation: 'ok', preview }
    },
    {
      body: t.Object({
        vault: hexString,
        amount: t.String(),
        receiver: hexString,
        mode: t.Union([t.Literal('exact-usdc'), t.Literal('exact-shares')]),
      }),
    },
  )

  // ─── Deposit / Mint with Permit ─────────────────────────────────────────────
  .post(
    '/tx/deposit-with-permit',
    async ({ body }) => {
      const vault = body.vault as Address
      const receiver = body.receiver as Address
      const amount = BigInt(body.amount)
      const mode = body.mode
      const deadline = BigInt(body.deadline)
      const v = Number(body.v)
      const r = body.r as Hex
      const s = body.s as Hex

      const feedIds = await getVaultFeedIds(vault)
      const pythUpdateData = await fetchPriceUpdate(feedIds)

      const tx =
        mode === 'exact-shares'
          ? encodeMintWithPermit(
              vault,
              amount,
              receiver,
              pythUpdateData,
              deadline,
              v,
              r,
              s,
            )
          : encodeDepositWithPermit(
              vault,
              amount,
              receiver,
              pythUpdateData,
              deadline,
              v,
              r,
              s,
            )

      const sim = await simulateTx(tx, receiver)
      if (!sim.success) {
        return { tx, simulation: { error: sim.error }, preview: null }
      }

      const preview =
        mode === 'exact-shares'
          ? { usdcCost: (await previewMint(vault, amount)).toString() }
          : { sharesOut: (await previewDeposit(vault, amount)).toString() }

      return { tx, simulation: 'ok', preview }
    },
    {
      body: t.Object({
        vault: hexString,
        amount: t.String(),
        receiver: hexString,
        mode: t.Union([t.Literal('exact-usdc'), t.Literal('exact-shares')]),
        deadline: t.String(),
        v: t.String(),
        r: hexString,
        s: hexString,
      }),
    },
  )

  // ─── Redeem ─────────────────────────────────────────────────────────────────
  .post(
    '/tx/redeem',
    async ({ body }) => {
      const vault = body.vault as Address
      const shares = BigInt(body.shares)
      const receiver = body.receiver as Address
      const owner = body.owner as Address

      const feedIds = await getVaultFeedIds(vault)
      const pythUpdateData = await fetchPriceUpdate(feedIds)

      const tx = encodeRedeemInKind(
        vault,
        shares,
        receiver,
        owner,
        pythUpdateData,
      )

      const sim = await simulateTx(tx, owner)
      if (!sim.success) {
        return { tx, simulation: { error: sim.error }, preview: null }
      }

      return { tx, simulation: 'ok', preview: { type: 'basket' as const } }
    },
    {
      body: t.Object({
        vault: hexString,
        shares: t.String(),
        receiver: hexString,
        owner: hexString,
      }),
    },
  )

  // ─── Rebalance (admin batchExecute) ──────────────────────────────────────
  .post(
    '/tx/rebalance',
    async ({ body }) => {
      const vault = body.vault as Address
      const targets = body.targets.map((t) => t as Address)
      const values = body.values.map((v) => BigInt(v))
      const calldatas = body.calldatas as Hex[]
      const tokensIn = body.tokensIn.map((t) => t as Address)
      const outputCheck: BatchOutputCheck = {
        tokensOut: body.outputCheck.tokensOut.map((t) => t as Address),
        expectedAmountsOut: body.outputCheck.expectedAmountsOut.map((a) =>
          BigInt(a),
        ),
        slippageBps: BigInt(body.outputCheck.slippageBps),
      }
      const owner = body.owner as Address

      // Fetch Pyth prices
      const feedIds = getVaultFeedIds(vault)
      const pythUpdateData = await fetchPriceUpdate(feedIds)

      // Total ETH value for swap calls (sum of values)
      const totalEthValue = values.reduce((sum, v) => sum + v, 0n)

      const tx = encodeBatchExecute(
        vault,
        targets,
        values,
        calldatas,
        tokensIn,
        outputCheck,
        pythUpdateData,
        totalEthValue,
      )

      // Simulate with owner address
      const sim = await simulateTx(tx, owner)
      if (!sim.success) {
        return { tx, simulation: { error: sim.error } }
      }

      return { tx, simulation: 'ok' }
    },
    {
      body: t.Object({
        vault: hexString,
        owner: hexString,
        targets: t.Array(hexString),
        values: t.Array(t.String()),
        calldatas: t.Array(hexString),
        tokensIn: t.Array(hexString),
        outputCheck: t.Object({
          tokensOut: t.Array(hexString),
          expectedAmountsOut: t.Array(t.String()),
          slippageBps: t.String(),
        }),
      }),
    },
  )

  .listen({ hostname: '0.0.0.0', port: PORT })

// Start background Pyth SSE price streaming worker
startPythWorker()

export type App = typeof app
