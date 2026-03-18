import type { Hex } from 'viem'

// Pyth Hermes feed IDs for all basket tokens
const FEEDS = {
  // DeFi vault
  UNI: '0x78d185a741d07edb3412b09008b7c5cfb9bbbd7d568bf00ba737b456ba171501',
  AAVE: '0x2b9ab1e972a281585084148ba1389800799bd4be63b957507db1349314e47445',
  MORPHO: '0x5b2a4c542d4a74dd11784079ef337c0403685e3114ba0d9909b5c7a7e06fdc42',
  ENA: '0xb7910ba7322db020416fcac28b48c01212fd9cc8fbcbaf7d30477ed8605f6bd4',
  // AI vault
  VIRTUAL: '0x8132e3eb1dac3e56939a16ff83848d194345f6688bff97eb1c8bd462d558802b',
  AIXBT: '0x0fc54579a29ba60a08fdb5c28348f22fd3bec18e221dd6b90369950db638a5a7',
  DEGEN: '0x9c93e4a22c56885af427ac4277437e756e7ec403fbc892f975d497383bb33560',
  // RWA vault
  ONDO: '0xd40472610abe56d36d065a0cf889fc8f1dd9f3b7f2a478231a5fc6df07ea5ce3',
  PENDLE: '0x9a4df90b25497f66b1afb012467e316e801ca3d839456db028892fe8c70c8016',
  COMP: '0x4a8e42861cabc5ecb50996f92e7cfa2bce3fd0a2423b0c44c9b423fb2bd25478',
  RSR: '0xfb7565b77267ba3f6ef770bed5d7f9b22b8542db676dbd9b934a2fcf945f4371',
} as const satisfies Record<string, Hex>

// Vault address → feed IDs mapping
// Mock and real vaults share the same basket tokens
export const VAULT_FEEDS: Record<string, Hex[]> = {
  // Mock vaults
  '0x91507defbcd6c9317216ae0eb6c332d73e0f24b9': [
    FEEDS.VIRTUAL,
    FEEDS.AIXBT,
    FEEDS.DEGEN,
  ], // AI
  '0xb7a31ef84b864efacf024bb7aac0f0eb4f75a1e4': [
    FEEDS.ONDO,
    FEEDS.PENDLE,
    FEEDS.COMP,
    FEEDS.RSR,
  ], // RWA
  '0xbb1a3df33d6abdb231584f767918a3cd1e317fb2': [
    FEEDS.UNI,
    FEEDS.AAVE,
    FEEDS.MORPHO,
    FEEDS.ENA,
  ], // DeFi
  // Real vaults
  '0x612317226ae4f06953e7b33fc9b304586f6c25b7': [
    FEEDS.VIRTUAL,
    FEEDS.AIXBT,
    FEEDS.DEGEN,
  ], // AI
  '0x57a6f5bedb12bdeba4d5458893b92ea21363f9d3': [
    FEEDS.ONDO,
    FEEDS.PENDLE,
    FEEDS.COMP,
    FEEDS.RSR,
  ], // RWA
  '0x4c6b20938e885f4c535a94271826aaa7f4f52c9a': [
    FEEDS.UNI,
    FEEDS.AAVE,
    FEEDS.MORPHO,
    FEEDS.ENA,
  ], // DeFi
}

/** All unique feed IDs across all vaults (for the SSE stream subscription). */
export const ALL_FEED_IDS: Hex[] = [
  ...new Set(Object.values(VAULT_FEEDS).flat()),
]
