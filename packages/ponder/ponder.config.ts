import { createConfig } from 'ponder'
import type { HttpTransport } from 'viem'
import { ZynethVaultAbi } from './abis/ERC4626Abi'

export const getConfig = (rpc: HttpTransport) => {
  return createConfig({
    chains: {
      base: {
        id: 8453,
        rpc,
      },
    },
    contracts: {
      ZynethVault: {
        chain: 'base',
        abi: ZynethVaultAbi,
        address: [
          '0x91507DEfbCD6c9317216Ae0eb6c332d73E0F24B9', // Mock AI
          '0xB7A31eF84B864eFaCf024bb7Aac0F0eb4f75A1E4', // Mock RWA
          '0xbb1A3Df33d6ABdb231584f767918a3cD1E317FB2', // Mock DeFi
          '0x612317226AE4F06953e7B33Fc9b304586f6C25b7', // Real AI
          '0x57A6F5beDB12BDeba4D5458893b92eA21363F9D3', // Real RWA
          '0x4c6b20938E885f4C535A94271826aaa7F4f52c9a', // Real DeFi
        ],
        startBlock: 43_127_516, // All 6 vaults deployed in this block
      },
    },
  })
}
