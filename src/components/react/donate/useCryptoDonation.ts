//============================================================================
//EIP-1193 hook for MetaMask "Connect Wallet" + transaction sending. Ported from
//cloud-lord's useCryptoDonation.js (requirements §9.4) to TypeScript. No external
//web3 library — talks to the raw `window.ethereum` provider directly (MetaMask,
//Rabby, etc.). The QR-scan path needs no wallet at all; this hook only powers the
//optional one-click "send from MetaMask" affordance.
//============================================================================
import { useState } from 'react';

//Minimal EIP-1193 surface we use (avoids pulling in a wallet SDK just for types).
interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

interface ProviderRpcErrorish {
  code?: number;
  message?: string;
}

//Narrow an unknown catch value to the EIP-1193 error shape (code 4001 = user
//rejected, 4902 = chain not added).
function asRpcError(e: unknown): ProviderRpcErrorish {
  return typeof e === 'object' && e !== null ? (e as ProviderRpcErrorish) : {};
}

export interface SendResult {
  success: boolean;
  txHash?: string;
}

//Chain params for the wallet_addEthereumChain fallback (when the wallet doesn't
//yet know a chain we ask it to switch to). Keyed by numeric chain id.
const CHAIN_CONFIGS: Record<number, Record<string, unknown>> = {
  137: {
    chainId: '0x89',
    chainName: 'Polygon PoS',
    nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
    rpcUrls: ['https://polygon-rpc.com'],
    blockExplorerUrls: ['https://polygonscan.com'],
  },
  100: {
    chainId: '0x64',
    chainName: 'Gnosis Chain',
    nativeCurrency: { name: 'xDAI', symbol: 'xDAI', decimals: 18 },
    rpcUrls: ['https://rpc.gnosischain.com'],
    blockExplorerUrls: ['https://gnosisscan.io'],
  },
  8453: {
    chainId: '0x2105',
    chainName: 'Base',
    nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://base.publicrpc.com'],
    blockExplorerUrls: ['https://basescan.org'],
  },
  42161: {
    chainId: '0xa4b1',
    chainName: 'Arbitrum One',
    nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://arb1.arbitrum.io/rpc'],
    blockExplorerUrls: ['https://arbiscan.io'],
  },
  10: {
    chainId: '0xa',
    chainName: 'Optimism',
    nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://mainnet.optimism.io'],
    blockExplorerUrls: ['https://optimistic.etherscan.io'],
  },
  56: {
    chainId: '0x38',
    chainName: 'BNB Smart Chain',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    rpcUrls: ['https://bsc-dataseed1.bnbchain.org'],
    blockExplorerUrls: ['https://bscscan.com'],
  },
  43114: {
    chainId: '0xa86a',
    chainName: 'Avalanche C-Chain',
    nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
    rpcUrls: ['https://api.avax.network/ext/bc/C/rpc'],
    blockExplorerUrls: ['https://snowtrace.io'],
  },
  1: {
    chainId: '0x1',
    chainName: 'Ethereum Mainnet',
    nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://eth.llamarpc.com'],
    blockExplorerUrls: ['https://etherscan.io'],
  },
};

//Convert a human token/coin amount into integer base units as a BigInt, without
//float drift (the original multiplied a JS float then BigInt()'d it, which throws
//on any fractional product). We scale the decimal string by `decimals` exactly.
function toBaseUnits(amount: number, decimals: number): bigint {
  if (!Number.isFinite(amount) || amount <= 0) return 0n;
  const [whole = '0', frac = ''] = String(amount).split('.');
  const fracPadded = (frac + '0'.repeat(decimals)).slice(0, decimals);
  return BigInt(whole + fracPadded);
}

export interface UseCryptoDonation {
  isConnecting: boolean;
  error: string | null;
  setError: (e: string | null) => void;
  sendNativeTransaction: (chainId: number, toAddress: string, amount: number) => Promise<SendResult>;
  sendErc20Transaction: (
    chainId: number,
    tokenAddress: string,
    toAddress: string,
    amount: number,
    decimals: number,
  ) => Promise<SendResult>;
}

export function useCryptoDonation(): UseCryptoDonation {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchChain = async (chainId: number): Promise<void> => {
    if (!window.ethereum) throw new Error('No wallet provider');
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });
    } catch (e) {
      //Chain not added to the wallet — ask it to add the chain, then retry switch.
      if (asRpcError(e).code === 4902) {
        const chain = CHAIN_CONFIGS[chainId];
        if (!chain) throw new Error(`Chain ${chainId} not configured`);
        await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [chain] });
      } else {
        throw e;
      }
    }
  };

  const sendNativeTransaction = async (
    chainId: number,
    toAddress: string,
    amount: number,
  ): Promise<SendResult> => {
    if (!window.ethereum) {
      setError('No wallet detected. Use the QR code to send from any wallet instead.');
      return { success: false };
    }
    setIsConnecting(true);
    setError(null);
    try {
      const [from] = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[];
      await switchChain(chainId);
      const valueWei = toBaseUnits(amount, 18);
      const txHash = (await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{ from, to: toAddress, value: `0x${valueWei.toString(16)}` }],
      })) as string;
      return { success: true, txHash };
    } catch (e) {
      setError(asRpcError(e).code === 4001 ? 'Transaction rejected.' : asRpcError(e).message ?? 'Transaction failed.');
      return { success: false };
    } finally {
      setIsConnecting(false);
    }
  };

  const sendErc20Transaction = async (
    chainId: number,
    tokenAddress: string,
    toAddress: string,
    amount: number,
    decimals: number,
  ): Promise<SendResult> => {
    if (!window.ethereum) {
      setError('No wallet detected. Use the QR code to send from any wallet instead.');
      return { success: false };
    }
    setIsConnecting(true);
    setError(null);
    try {
      const [from] = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[];
      await switchChain(chainId);

      //ERC-20 transfer(address,uint256): selector 0xa9059cbb + recipient (32 bytes,
      //left-padded) + amount in base units (32 bytes, left-padded).
      const recipient = toAddress.slice(2).toLowerCase().padStart(64, '0');
      const value = toBaseUnits(amount, decimals).toString(16).padStart(64, '0');
      const calldata = `0xa9059cbb${recipient}${value}`;

      const txHash = (await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{ from, to: tokenAddress, data: calldata, value: '0x0' }],
      })) as string;
      return { success: true, txHash };
    } catch (e) {
      setError(asRpcError(e).code === 4001 ? 'Transaction rejected.' : asRpcError(e).message ?? 'Transaction failed.');
      return { success: false };
    } finally {
      setIsConnecting(false);
    }
  };

  return { isConnecting, error, setError, sendNativeTransaction, sendErc20Transaction };
}

export default useCryptoDonation;
