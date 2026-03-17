import {
  type Address,
  type ContractFunctionRevertedError,
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

  // Walk the cause chain to find ContractFunctionRevertedError or revert data
  let current: Error | undefined = err
  while (current) {
    // viem's ContractFunctionRevertedError has structured data
    const revertErr = current as ContractFunctionRevertedError & {
      data?: { errorName?: string; args?: unknown[] }
    }
    if (
      revertErr.data?.errorName &&
      REVERT_MESSAGES[revertErr.data.errorName]
    ) {
      return REVERT_MESSAGES[revertErr.data.errorName]
    }

    // Try extracting hex revert data from message
    const hexMatch = current.message.match(/data:\s*"?(0x[0-9a-fA-F]{8,})"?/)
    if (hexMatch) {
      try {
        const decoded = decodeErrorResult({
          abi: vaultAbi,
          data: hexMatch[1] as Hex,
        })
        if (decoded.errorName && REVERT_MESSAGES[decoded.errorName]) {
          return REVERT_MESSAGES[decoded.errorName]
        }
        return `Contract error: ${decoded.errorName}`
      } catch {
        // Not a known error selector
      }
    }

    // Check for custom error pattern
    const customMatch = current.message.match(/custom error (\w+)\(\)/)
    if (customMatch && REVERT_MESSAGES[customMatch[1]]) {
      return REVERT_MESSAGES[customMatch[1]]
    }

    // Walk up the cause chain
    current = (current as Error & { cause?: Error }).cause as Error | undefined
  }

  // Fallback: extract from top-level message
  const msg = err.message

  // Detect "unknown reason" reverts that are likely ERC20 transferFrom failures
  if (msg.includes('unknown reason') || msg.includes('reverted')) {
    return 'Transaction would revert. Check your USDC balance and vault allowance.'
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
