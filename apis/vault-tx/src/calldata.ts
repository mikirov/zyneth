import { type Address, encodeFunctionData, type Hex } from 'viem'
import { vaultAbi } from './abi'

/** ETH buffer for Pyth update fee. Contract refunds excess. */
const PYTH_FEE_BUFFER = 100_000_000_000_000n // 0.0001 ETH

export interface TxData {
  to: Address
  data: Hex
  value: string // bigint serialized as string for JSON
}

export function encodeDeposit(
  vault: Address,
  assets: bigint,
  receiver: Address,
  pythUpdateData: Hex[],
): TxData {
  return {
    to: vault,
    data: encodeFunctionData({
      abi: vaultAbi,
      functionName: 'deposit',
      args: [assets, receiver, pythUpdateData],
    }),
    value: PYTH_FEE_BUFFER.toString(),
  }
}

export function encodeMint(
  vault: Address,
  shares: bigint,
  receiver: Address,
  pythUpdateData: Hex[],
): TxData {
  return {
    to: vault,
    data: encodeFunctionData({
      abi: vaultAbi,
      functionName: 'mint',
      args: [shares, receiver, pythUpdateData],
    }),
    value: PYTH_FEE_BUFFER.toString(),
  }
}

export function encodeDepositWithPermit(
  vault: Address,
  assets: bigint,
  receiver: Address,
  pythUpdateData: Hex[],
  deadline: bigint,
  v: number,
  r: Hex,
  s: Hex,
): TxData {
  return {
    to: vault,
    data: encodeFunctionData({
      abi: vaultAbi,
      functionName: 'depositWithPermit',
      args: [assets, receiver, pythUpdateData, deadline, v, r, s],
    }),
    value: PYTH_FEE_BUFFER.toString(),
  }
}

export function encodeMintWithPermit(
  vault: Address,
  shares: bigint,
  receiver: Address,
  pythUpdateData: Hex[],
  deadline: bigint,
  v: number,
  r: Hex,
  s: Hex,
): TxData {
  return {
    to: vault,
    data: encodeFunctionData({
      abi: vaultAbi,
      functionName: 'mintWithPermit',
      args: [shares, receiver, pythUpdateData, deadline, v, r, s],
    }),
    value: PYTH_FEE_BUFFER.toString(),
  }
}

export function encodeRedeemInKind(
  vault: Address,
  shares: bigint,
  receiver: Address,
  owner: Address,
  pythUpdateData: Hex[],
): TxData {
  return {
    to: vault,
    data: encodeFunctionData({
      abi: vaultAbi,
      functionName: 'redeemInKind',
      args: [shares, receiver, owner, pythUpdateData],
    }),
    value: PYTH_FEE_BUFFER.toString(),
  }
}

export interface BatchOutputCheck {
  tokensOut: Address[]
  expectedAmountsOut: bigint[]
  slippageBps: bigint
}

export function encodeBatchExecute(
  vault: Address,
  targets: Address[],
  values: bigint[],
  calldatas: Hex[],
  tokensIn: Address[],
  outputCheck: BatchOutputCheck,
  pythUpdateData: Hex[],
  totalEthValue: bigint,
): TxData {
  return {
    to: vault,
    data: encodeFunctionData({
      abi: vaultAbi,
      functionName: 'batchExecute',
      args: [targets, values, calldatas, tokensIn, outputCheck, pythUpdateData],
    }),
    value: (totalEthValue + PYTH_FEE_BUFFER).toString(),
  }
}
