import { truncateAddress } from '../lib/wallet';
import type { useWallet } from '../hooks/useWallet';

type Props = ReturnType<typeof useWallet>;

const LACE_URL = 'https://www.lace.io/';

export function WalletConnect({ status, session, error, connect, disconnect, networkId }: Props) {
  if (status === 'detecting') {
    return (
      <section className="panel" aria-busy="true">
        <p className="muted">Looking for a Midnight wallet…</p>
      </section>
    );
  }

  if (status === 'unavailable') {
    return (
      <section className="panel panel--warn">
        <h2>No wallet detected</h2>
        <p>
          cepush needs the Lace extension to prove anything. Install it, then reload this page.
        </p>
        <a className="button" href={LACE_URL} target="_blank" rel="noreferrer noopener">
          Get Lace
        </a>
      </section>
    );
  }

  if (status === 'connected' && session) {
    return (
      <section className="panel panel--ok">
        <div className="wallet-row">
          {/* Rendered as an image, and the name as a text node: both come from
              the extension and are untrusted. */}
          <img className="wallet-icon" src={session.icon} alt="" width={28} height={28} />
          <div className="wallet-meta">
            <strong>{session.name}</strong>
            <span className="muted">connector v{session.apiVersion} · {networkId}</span>
          </div>
          <button className="button button--ghost" onClick={disconnect}>
            Disconnect
          </button>
        </div>
        <p className="address" title={session.address}>
          {truncateAddress(session.address)}
        </p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>Connect your wallet</h2>
      <p className="muted">
        cepush talks to <strong>{networkId}</strong>. Connecting lets the app read your address and
        ask the wallet to prove and submit a ballot. It never asks for your ballot.
      </p>
      <button className="button" onClick={connect} disabled={status === 'connecting'}>
        {status === 'connecting' ? 'Waiting for the wallet…' : 'Connect Lace'}
      </button>

      {error && (
        <p className={`notice notice--${error.kind}`} role="alert">
          {error.message}
        </p>
      )}
    </section>
  );
}
