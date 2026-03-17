import {
  type Address,
  createPublicClient,
  decodeErrorResult,
  type Hex,
  http,
} from 'viem'
import { base } from 'viem/chains'
import { vaultAbi } from './abi'
import type { TxData } from './calldata'
import { RPC_URL } from './config'
import { REVERT_MESSAGES } from './errors'

const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
})

export interface SimulationResult {
  success: boolean
  error?: string
  returnData?: Hex
}

/** Simulate a vault transaction via eth_call. Returns decoded error on revert. */
export async function simulateTx(
  tx: TxData,
  from: Address,
): Promise<SimulationResult> {
  try {
    const result = await publicClient.call({
      to: tx.to,
      data: tx.data as Hex,
      value: BigInt(tx.value),
      account: from,
    })
    return { success: true, returnData: result.data }
  } catch (err: unknown) {
    return { success: false, error: decodeRevertError(err) }
  }
}

function decodeRevertError(err: unknown): string {
  if (!(err instanceof Error)) return String(err)

  // Try to extract revert data from the error
  const msg = err.message

  // viem includes hex data in errors — try to decode it
  const dataMatch = msg.match(/data:\s*"?(0x[0-9a-fA-F]+)"?/)
  if (dataMatch) {
    try {
      const decoded = decodeErrorResult({
        abi: vaultAbi,
        data: dataMatch[1] as Hex,
      })
      if (decoded.errorName && REVERT_MESSAGES[decoded.errorName]) {
        return REVERT_MESSAGES[decoded.errorName]
      }
      return `Contract error: ${decoded.errorName}`
    } catch {
      // Selector not in ABI
    }
  }

  // Try viem's structured error
  const errWithData = err as Error & { data?: { errorName?: string } }
  if (
    errWithData.data?.errorName &&
    REVERT_MESSAGES[errWithData.data.errorName]
  ) {
    return REVERT_MESSAGES[errWithData.data.errorName]
  }

  // Fallback to message parsing
  const customMatch = msg.match(/custom error (\w+)\(\)/)
  if (customMatch && REVERT_MESSAGES[customMatch[1]]) {
    return REVERT_MESSAGES[customMatch[1]]
  }

  const reasonMatch = msg.match(/reason:\s*(.+?)(?:\n|$)/)
  if (reasonMatch) return reasonMatch[1].trim()

  const shortMatch = msg.match(/shortMessage:\s*"(.+?)"/)
  if (shortMatch) return shortMatch[1]

  return msg.length > 200 ? `${msg.slice(0, 200)}...` : msg
}

/** Read preview values from the vault. */
export async function previewDeposit(
  vault: Address,
  assets: bigint,
): Promise<bigint> {
  return publicClient.readContract({
    address: vault,
    abi: vaultAbi,
    functionName: 'previewDeposit',
    args: [assets],
  }) as Promise<bigint>
}

export async function previewMint(
  vault: Address,
  shares: bigint,
): Promise<bigint> {
  return publicClient.readContract({
    address: vault,
    abi: vaultAbi,
    functionName: 'previewMint',
    args: [shares],
  }) as Promise<bigint>
}

export async function convertToAssets(
  vault: Address,
  shares: bigint,
): Promise<bigint> {
  return publicClient.readContract({
    address: vault,
    abi: vaultAbi,
    functionName: 'convertToAssets',
    args: [shares],
  }) as Promise<bigint>
}
