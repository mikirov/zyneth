import { getConfig } from '@zyneth/ponder/config'
import { http } from 'viem'

const PONDER_RPC_URL_11155111 = process.env.PONDER_RPC_URL_11155111

if (!PONDER_RPC_URL_11155111) {
  throw new Error('PONDER_RPC_URL_11155111 env var is required')
}

export default getConfig(http(PONDER_RPC_URL_11155111))
