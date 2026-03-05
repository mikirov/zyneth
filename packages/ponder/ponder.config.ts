import { createConfig } from 'ponder'
import type { HttpTransport } from 'viem'
import { ZynethVaultAbi } from './abis/ERC4626Abi'

export const getConfig = (rpc: HttpTransport) => {
  return createConfig({
    chains: {
      sepolia: {
        id: 11155111,
        rpc,
      },
    },
    contracts: {
      ZynethVault: {
        chain: 'sepolia',
        abi: ZynethVaultAbi,
        address: [
          '0xD97Bb459f9Bc3d002d5D85F523dDC17E5687A91d', // AI Vault
          '0x9980c5719B3df5c5b3414BE4fe3bc4aBb32B5e09', // RWA Vault
          '0x1A2AB9B00Bd14E26F522dDD475f22a7df6e46951', // DeFi Vault
        ],
        startBlock: 7726700,
      },
    },
  })
}
