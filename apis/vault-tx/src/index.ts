import { cors } from '@elysiajs/cors'
import { Elysia, t } from 'elysia'
import type { Address, Hex } from 'viem'
import {
  encodeDeposit,
  encodeDepositWithPermit,
  encodeMint,
  encodeMintWithPermit,
  encodeRedeem,
  encodeRedeemInKind,
} from './calldata'
import { CORS_ORIGIN, PORT } from './config'
import { fetchPriceUpdate, getVaultFeedIds } from './pyth'
import {
  convertToAssets,
  previewDeposit,
  previewMint,
  simulateTx,
} from './simulate'

const hexString = t.String({ pattern: '^0x[0-9a-fA-F]+$' })

const app = new Elysia()
  .use(cors({ origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN }))
  .get('/health', () => ({ status: 'ok' }))

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
      const mode = body.mode

      const feedIds = await getVaultFeedIds(vault)
      const pythUpdateData = await fetchPriceUpdate(feedIds)

      const tx =
        mode === 'basket'
          ? encodeRedeemInKind(vault, shares, receiver, owner, pythUpdateData)
          : encodeRedeem(vault, shares, receiver, owner, pythUpdateData)

      const sim = await simulateTx(tx, owner)
      if (!sim.success) {
        return { tx, simulation: { error: sim.error }, preview: null }
      }

      const preview =
        mode === 'basket'
          ? { type: 'basket' as const }
          : { assetsOut: (await convertToAssets(vault, shares)).toString() }

      return { tx, simulation: 'ok', preview }
    },
    {
      body: t.Object({
        vault: hexString,
        shares: t.String(),
        receiver: hexString,
        owner: hexString,
        mode: t.Union([t.Literal('usdc'), t.Literal('basket')]),
      }),
    },
  )

  .listen(PORT)

export type App = typeof app
