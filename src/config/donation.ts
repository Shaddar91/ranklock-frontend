//Crypto + Ko-fi donation config, ported from cloud-lord's src/config/donation.js.
//Every address here is a PUBLIC receive address or an official token contract; no
//private key is involved. PUBLIC_DONATION_ADDRESS / PUBLIC_KOFI_URL env override the fallbacks.

//An unset or blank env value falls through to the fallback ('??' would keep '').
function envOr(value: string | undefined, fallback: string): string {
  const v = (value ?? '').trim();
  return v.length > 0 ? v : fallback;
}

//RankLock's public EVM receive address, identical across all EVM chains.
export const DONATION_ADDRESS: string = envOr(
  import.meta.env.PUBLIC_DONATION_ADDRESS,
  '0xf488Eb4bA84B7ba3CF34b59843852499BA05AbBa',
);

//RankLock's Ko-fi page (card / PayPal). Empty renders the "coming soon" state.
export const KOFI_URL: string = envOr(import.meta.env.PUBLIC_KOFI_URL, '');

export interface DonationToken {
  symbol: string;
  //ERC-20 contract address on this chain (public, official source).
  address: string;
  decimals: number;
}

export interface DonationChain {
  id: number;
  name: string;
  rpcUrl: string;
  explorerUrl: string;
  nativeSymbol: string;
  //true for low-gas L2s / sidechains — surfaced as a hint and used to pick the
  //cheapest default network.
  lowGas: boolean;
  tokens: DonationToken[];
}

//Receive-only non-EVM chains: any native coin or token can be sent to the single
//address — no contract address needed on receive, so there is no EIP-681 QR /
//Connect Wallet for these (shown as plain copyable addresses).
export interface NonEvmChain {
  family: string;
  name: string;
  address: string;
  nativeSymbol: string;
  note: string;
}

export const CHAINS: DonationChain[] = [
  {
    id: 137,
    name: 'Polygon PoS',
    rpcUrl: 'https://polygon-rpc.com',
    explorerUrl: 'https://polygonscan.com',
    nativeSymbol: 'POL',
    lowGas: true,
    tokens: [
      { symbol: 'USDC', address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6 },
      { symbol: 'USDT', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
      { symbol: 'DAI', address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023D60d98e97', decimals: 18 },
    ],
  },
  {
    id: 100,
    name: 'Gnosis Chain',
    rpcUrl: 'https://rpc.gnosischain.com',
    explorerUrl: 'https://gnosisscan.io',
    nativeSymbol: 'xDAI',
    lowGas: true,
    tokens: [
      { symbol: 'USDC', address: '0xDDAfbb505ad214D7b80b1f830af51453Ee1c642b', decimals: 6 },
      { symbol: 'USDT', address: '0x4ECaBa5870353805a9F068101A8e0e64fD7B6b91', decimals: 6 },
    ],
  },
  {
    id: 8453,
    name: 'Base',
    rpcUrl: 'https://base.publicrpc.com',
    explorerUrl: 'https://basescan.org',
    nativeSymbol: 'ETH',
    lowGas: true,
    tokens: [
      { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b1566dA57aD', decimals: 6 },
      { symbol: 'DAI', address: '0x50c5725949A6F0c72EC5D60caE4AA358c61fe4AC', decimals: 18 },
    ],
  },
  {
    id: 42161,
    name: 'Arbitrum One',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    explorerUrl: 'https://arbiscan.io',
    nativeSymbol: 'ETH',
    lowGas: true,
    tokens: [
      { symbol: 'USDC', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 },
      { symbol: 'USDT', address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6 },
      { symbol: 'DAI', address: '0xDA10009754f131d8bB9BA6981cAFc94c7ef07B11', decimals: 18 },
    ],
  },
  {
    id: 10,
    name: 'Optimism',
    rpcUrl: 'https://mainnet.optimism.io',
    explorerUrl: 'https://optimistic.etherscan.io',
    nativeSymbol: 'ETH',
    lowGas: true,
    tokens: [
      { symbol: 'USDC', address: '0x0b2C639c533813f4Aa9D7837CAf62653d1D3d957', decimals: 6 },
      { symbol: 'USDT', address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', decimals: 6 },
      { symbol: 'DAI', address: '0xDA10009754f131d8bB9BA6981cAFc94c7ef07B11', decimals: 18 },
    ],
  },
  {
    id: 56,
    name: 'BNB Smart Chain',
    rpcUrl: 'https://bsc-dataseed1.bnbchain.org',
    explorerUrl: 'https://bscscan.com',
    nativeSymbol: 'BNB',
    lowGas: true,
    tokens: [
      { symbol: 'USDT', address: '0x55d398326f99059fF775485246999027B3197955', decimals: 6 },
      { symbol: 'USDC', address: '0x8AC76a51cc950d9822D68b83FE1Ad97B32Cd580d', decimals: 6 },
    ],
  },
  {
    id: 43114,
    name: 'Avalanche C-Chain',
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    explorerUrl: 'https://snowtrace.io',
    nativeSymbol: 'AVAX',
    lowGas: true,
    tokens: [
      { symbol: 'USDC', address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', decimals: 6 },
      { symbol: 'USDT', address: '0x9702230A8657203E2f9166381F0be4181DEb6318', decimals: 6 },
    ],
  },
  {
    id: 1,
    name: 'Ethereum',
    rpcUrl: 'https://eth.llamarpc.com',
    explorerUrl: 'https://etherscan.io',
    nativeSymbol: 'ETH',
    lowGas: false,
    tokens: [
      { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
      { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
      { symbol: 'DAI', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18 },
    ],
  },
];

//Non-EVM chains are receive-only; each address is chain-family-specific, so each is set
//explicitly. Leave '' to hide an entry (the UI renders only configured chains).
export const NON_EVM_CHAINS: NonEvmChain[] = [
  {
    family: 'solana',
    name: 'Solana',
    address: 'CCdNtPQgfBiSyGVipj7wNfxh4NsLcr9LBQGu1j9nQtwf',
    nativeSymbol: 'SOL',
    note: 'send SOL or any SPL token (e.g., USDC), very cheap',
  },
  {
    family: 'tron',
    name: 'Tron',
    address: 'TPnCSwFEWNbgvK9ip7Sey3y9bu7LYL7Tzm',
    nativeSymbol: 'TRX',
    note: 'send TRX or USDT (TRC-20), very cheap',
  },
];

//Guard: false until a well-formed EVM receive address is set (placeholder-safe).
export function isConfigured(): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(DONATION_ADDRESS);
}

//Guard: false until a Ko-fi URL is set (placeholder-safe).
export function kofiConfigured(): boolean {
  return /^https:\/\/ko-fi\.com\/.+/i.test(KOFI_URL);
}

//Non-EVM chains with a configured address (the only ones the UI should render).
export function configuredNonEvmChains(): NonEvmChain[] {
  return NON_EVM_CHAINS.filter((c) => c.address.trim().length > 0);
}
