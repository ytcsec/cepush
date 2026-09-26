import { useState } from 'react';

import { formatAmount, largestUnshielded, useBalances } from '../hooks/useBalances';
import { truncateAddress } from '../lib/wallet';
import type { useWallet } from '../hooks/useWallet';
import { Icon } from './Icon';

type Props = ReturnType<typeof useWallet>;

const LACE_URL = 'https://www.lace.io/';
const FAUCET_URL = 'https://midnight-tmnight-preprod.nethermind.dev/';

function Kicker() {
  return (
    <p className="card__kicker">
      <Icon name="wallet" size={14} /> Wallet
    </p>
  );
}

export function WalletConnect({ status, session, error, connect, disconnect, networkId }: Props) {
  const [copied, setCopied] = useState(false);
  const { balances, loading: loadingBalances, refresh } = useBalances(session);

  async function copyAddress() {
    if (!session) return;
    await navigator.clipboard.writeText(session.address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  if (status === 'detecting') {
    return (
      <section className="card" aria-busy="true">
        <Kicker />
        <p className="muted inline-status">
          <span className="spinner" aria-hidden="true" /> Looking for a Midnight wallet…
        </p>
      </section>
    );
  }

  if (status === 'unavailable') {
    return (
      <section className="card card--warn" aria-labelledby="wallet-title">
        <Kicker />
        <h2 className="card__title card__title--sm" id="wallet-title">
          No wallet detected
        </h2>
        <p className="muted card__text">
          cepush needs the Lace extension to prove anything. Install it, then reload this page.
        </p>
        <a className="button" href={LACE_URL} target="_blank" rel="noreferrer noopener">
          Get Lace <Icon name="external" size={16} />
        </a>
      </section>
    );
  }

  if (status === 'connected' && session) {
    const dustEmpty = balances !== null && balances.dust.balance === 0n;

    return (
      <section className="card" aria-label="Connected wallet">
        <Kicker />
        <div className="wallet-row">
          {/* Rendered as an image, and the name as a text node: both come from
              the extension and are untrusted. */}
          <img className="wallet-icon" src={session.icon} alt="" width={40} height={40} />
          <div className="wallet-meta">
            <strong>{session.name}</strong>
            <span>
              connector v{session.apiVersion} · {networkId}
            </span>
          </div>
          <button className="icon-button" onClick={disconnect} aria-label="Disconnect wallet" title="Disconnect">
            <Icon name="power" size={16} />
          </button>
        </div>

        <div className="address-box" title={session.address}>
          <code>{truncateAddress(session.address)}</code>
          <button
            className="icon-button"
            onClick={() => void copyAddress()}
            aria-label={copied ? 'Address copied' : 'Copy address'}
            title={copied ? 'Copied' : 'Copy address'}
          >
            <Icon name={copied ? 'check' : 'copy'} size={15} />
          </button>
        </div>

        <div className="balances">
          <div className="balance">
            <span>tNIGHT</span>
            <strong>{balances ? formatAmount(largestUnshielded(balances)) : '—'}</strong>
          </div>
          <div className="balance">
            <span>tDUST</span>
            <strong>{balances ? formatAmount(balances.dust.balance) : '—'}</strong>
          </div>
        </div>

        <div className="wallet-actions">
          <button
            className="button button--ghost button--sm"
            onClick={() => void refresh()}
            disabled={loadingBalances}
          >
            <Icon name="refresh" size={15} className={loadingBalances ? 'spinning' : undefined} />
            {loadingBalances ? 'Checking…' : 'Refresh balances'}
          </button>
        </div>

        {dustEmpty && (
          <div className="notice notice--not-deployed">
            <Icon name="alert" />
            <div className="notice__body">
              {largestUnshielded(balances) === 0n
                ? 'No tNIGHT yet. The faucet can take a minute; press Refresh.'
                : 'tNIGHT has arrived but no tDUST has been generated. In Lace the step is called designation: open the Midnight tokens page, find the "Your tNIGHT Designation" card, press "Generate tDUST", designate the amount to your own Dust address and send. It takes about three blocks, then press Refresh.'}
            </div>
          </div>
        )}

        <details className="disclosure" open={dustEmpty}>
          <summary>Funding this wallet on Preprod</summary>
          <div className="disclosure__body">
            <p>
              The address above is your <strong>unshielded</strong> address — the one the faucet
              wants. It rejects shielded and DUST addresses.
            </p>
            <p>
              The faucet sends <strong>tNIGHT</strong>, not tDUST. Fees are paid in tDUST, so
              afterwards use <strong>Generate tDUST</strong> in Lace to register the NIGHT —
              unregistered NIGHT generates nothing, and transactions will fail with no fees.
            </p>
            <a className="button button--ghost button--sm" href={FAUCET_URL} target="_blank" rel="noreferrer noopener">
              Open the faucet <Icon name="external" size={15} />
            </a>
          </div>
        </details>
      </section>
    );
  }

  return (
    <section className="card" aria-labelledby="wallet-title">
      <Kicker />
      <h2 className="card__title card__title--sm" id="wallet-title">
        Connect your wallet
      </h2>
      <p className="muted card__text">
        cepush talks to <strong>{networkId}</strong>. Connecting lets the app read your address and
        ask the wallet to prove and submit a ballot. It never asks for your ballot.
      </p>
      <button className="button" onClick={() => void connect()} disabled={status === 'connecting'}>
        {status === 'connecting' ? (
          <>
            <span className="spinner" aria-hidden="true" /> Waiting for the wallet…
          </>
        ) : (
          <>
            <Icon name="wallet" size={18} /> Connect Lace
          </>
        )}
      </button>

      {error && (
        <div className={`notice notice--${error.kind}`} role="alert">
          <Icon name="alert" />
          <div className="notice__body">{error.message}</div>
        </div>
      )}
    </section>
  );
}
