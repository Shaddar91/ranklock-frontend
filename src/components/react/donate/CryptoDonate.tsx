//============================================================================
//Crypto donation island — ported from cloud-lord's CryptoDonate (requirements
//§9.4) and RE-SKINNED off MUI to the RankLock gaslamp system (classes in
//styles/components.css → theme-driven, recolors with the foundry/arcane switch).
//
//Donors pick a chain + coin/token, scan the EIP-681 QR from any wallet, or use the
//one-click MetaMask send (useCryptoDonation). Fully client-side: no backend, no
//payment processor, no secret — the receive address is PUBLIC by design. Until a
//valid DONATION_ADDRESS is configured the widget renders a clear "not configured"
//state instead of a wrong address (config/donation, never-invent rule).
//============================================================================
import { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Icon from '../ui/Icon';
import {
  CHAINS,
  DONATION_ADDRESS,
  isConfigured,
  configuredNonEvmChains,
  type DonationChain,
} from '../../../config/donation';
import { useCryptoDonation } from './useCryptoDonation';

//The active selection: an ERC-20 token (address set) or the chain's native coin
//(address null). decimals drives both the EIP-681 amount and the transfer calldata.
interface SelectedToken {
  address: string | null;
  symbol: string;
  decimals: number;
}

//Guaranteed-present fallback so TS narrows under noUncheckedIndexedAccess; CHAINS
//is a non-empty literal in practice, this only satisfies the type checker.
const FALLBACK_CHAIN: DonationChain = CHAINS[0] ?? {
  id: 1,
  name: 'Ethereum',
  rpcUrl: '',
  explorerUrl: '',
  nativeSymbol: 'ETH',
  lowGas: false,
  tokens: [],
};

function nativeOf(chain: DonationChain): SelectedToken {
  return { address: null, symbol: chain.nativeSymbol, decimals: 18 };
}

export default function CryptoDonate() {
  //Default to the first low-gas network (cheapest for the donor).
  const defaultChain = useMemo(() => CHAINS.find((c) => c.lowGas) ?? FALLBACK_CHAIN, []);
  const [selectedChain, setSelectedChain] = useState<DonationChain>(defaultChain);
  const [selectedToken, setSelectedToken] = useState<SelectedToken>(() => nativeOf(defaultChain));
  const [amount, setAmount] = useState('10');
  const [copied, setCopied] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const { isConnecting, error: walletError, setError: setWalletError, sendNativeTransaction, sendErc20Transaction } =
    useCryptoDonation();

  const altChains = useMemo(() => configuredNonEvmChains(), []);
  const amountNum = Number.parseFloat(amount);
  const validAmount = Number.isFinite(amountNum) && amountNum > 0;

  //The EIP-681 payment URI for the current selection — what the QR encodes and what
  //MetaMask deep-links consume. Pure derivation (no effect) so it renders on first
  //paint / SSR with no flash, and recomputes synchronously as the selection changes.
  const qrValue = useMemo(() => {
    if (!validAmount) return '';
    const chainId = selectedChain.id;
    if (selectedToken.address) {
      //ERC-20: ethereum:<token>@<chainId>/transfer?address=<to>&uint256=<baseUnits>
      const base = (amountNum * 10 ** selectedToken.decimals).toFixed(0);
      return `ethereum:${selectedToken.address}@${chainId}/transfer?address=${DONATION_ADDRESS}&uint256=${base}`;
    }
    //Native: ethereum:<to>@<chainId>?value=<wei>
    const wei = (amountNum * 1e18).toFixed(0);
    return `ethereum:${DONATION_ADDRESS}@${chainId}?value=${wei}`;
  }, [selectedChain, selectedToken, amountNum, validAmount]);

  if (!isConfigured()) {
    return (
      <div className="donate">
        <div className="donate-msg err" role="alert">
          <Icon name="lock" size={15} />
          <span>
            Crypto donations aren’t configured yet — the receive address is unset. (Set{' '}
            <code>PUBLIC_DONATION_ADDRESS</code> or <code>DONATION_ADDRESS</code> in{' '}
            <code>src/config/donation.ts</code>.)
          </span>
        </div>
      </div>
    );
  }

  const selectChain = (id: number) => {
    const chain = CHAINS.find((c) => c.id === id);
    if (!chain) return;
    setSelectedChain(chain);
    setSelectedToken(nativeOf(chain));
    setTxHash(null);
  };

  const selectToken = (symbol: string | null) => {
    setTxHash(null);
    if (symbol === null) {
      setSelectedToken(nativeOf(selectedChain));
      return;
    }
    const token = selectedChain.tokens.find((t) => t.symbol === symbol);
    if (token) setSelectedToken({ address: token.address, symbol: token.symbol, decimals: token.decimals });
  };

  const copyAddress = () => {
    try {
      void navigator.clipboard?.writeText(DONATION_ADDRESS);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      //clipboard unavailable (insecure context) — the address is shown for manual copy.
    }
  };

  const connectAndSend = async () => {
    if (!validAmount) return;
    setWalletError(null);
    setTxHash(null);
    const result = selectedToken.address
      ? await sendErc20Transaction(selectedChain.id, selectedToken.address, DONATION_ADDRESS, amountNum, selectedToken.decimals)
      : await sendNativeTransaction(selectedChain.id, DONATION_ADDRESS, amountNum);
    if (result.success && result.txHash) setTxHash(result.txHash);
  };

  const isNative = selectedToken.address === null;

  return (
    <div className="donate">
      {/* network select */}
      <div className="donate-field">
        <div className="label-xs">Network</div>
        <div className="donate-nets">
          {CHAINS.map((chain) => {
            const active = chain.id === selectedChain.id;
            return (
              <button
                key={chain.id}
                type="button"
                className={'netbtn' + (active ? ' is-active' : '')}
                aria-pressed={active}
                onClick={() => selectChain(chain.id)}
              >
                <span className="netbtn-name">{chain.name}</span>
                <span className="netbtn-hint">{chain.lowGas ? 'low gas' : 'higher fees'}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* coin / token select */}
      <div className="donate-field">
        <div className="label-xs">Coin or token</div>
        <div className="donate-toks">
          <button
            type="button"
            className={'tokbtn' + (isNative ? ' is-active' : '')}
            aria-pressed={isNative}
            onClick={() => selectToken(null)}
          >
            {selectedChain.nativeSymbol}
          </button>
          {selectedChain.tokens.map((token) => {
            const active = selectedToken.symbol === token.symbol && !isNative;
            return (
              <button
                key={token.symbol}
                type="button"
                className={'tokbtn' + (active ? ' is-active' : '')}
                aria-pressed={active}
                onClick={() => selectToken(token.symbol)}
              >
                {token.symbol}
              </button>
            );
          })}
        </div>
      </div>

      {/* amount */}
      <div className="donate-field">
        <label className="label-xs" htmlFor="donate-amount">
          Amount ({selectedToken.symbol}) · optional
        </label>
        <input
          id="donate-amount"
          className="field tnum"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="10"
        />
      </div>

      {/* QR */}
      <div className="tile panel-pad donate-qr">
        <div className="label-xs" style={{ marginBottom: 12 }}>
          Scan with your wallet
        </div>
        {qrValue ? (
          <div className="qr-frame">
            <QRCodeSVG value={qrValue} size={196} level="M" marginSize={1} bgColor="#f4e9d4" fgColor="#0a0e17" />
          </div>
        ) : (
          <div className="muted" style={{ fontSize: 13 }}>
            Enter an amount above to generate a payment QR.
          </div>
        )}
      </div>

      {/* receive address */}
      <div className="tile panel-pad donate-addr">
        <div className="label-xs" style={{ marginBottom: 10 }}>
          Receive address
        </div>
        <div className="donate-addr-val">{DONATION_ADDRESS}</div>
        <button type="button" className="btn btn-ghost donate-copy" onClick={copyAddress}>
          <Icon name={copied ? 'up' : 'coins'} size={14} />
          {copied ? 'Copied' : 'Copy address'}
        </button>
      </div>

      {/* status */}
      {walletError && (
        <div className="donate-msg err" role="alert">
          <Icon name="bolt" size={15} />
          <span>{walletError}</span>
        </div>
      )}
      {txHash && (
        <div className="donate-msg ok" role="status">
          <Icon name="up" size={15} />
          <span>
            Transaction sent — thank you! Hash <code>{txHash.slice(0, 10)}…{txHash.slice(-6)}</code>
          </span>
        </div>
      )}

      {/* connect wallet */}
      <button
        type="button"
        className="btn btn-primary donate-cta"
        onClick={connectAndSend}
        disabled={isConnecting || !validAmount}
      >
        <Icon name="bolt" size={15} />
        {isConnecting ? 'Confirm in your wallet…' : 'Connect wallet & send'}
      </button>
      <div className="donate-note">
        <Icon name="shield" size={12} /> MetaMask or QR scan · no account or signup · funds go straight to the address
      </div>

      {/* non-EVM (receive-only), shown only when an address is configured */}
      {altChains.length > 0 && (
        <div className="tile panel-pad donate-alt">
          <div className="label-xs" style={{ marginBottom: 12 }}>
            Other blockchains
          </div>
          {altChains.map((chain) => (
            <div key={chain.family} className="donate-alt-row">
              <div className="donate-alt-name">{chain.name}</div>
              <div className="donate-addr-val">{chain.address}</div>
              <div className="muted" style={{ fontSize: 11 }}>
                {chain.note}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
