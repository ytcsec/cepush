import { useState } from 'react';

import { CircuitCall } from './components/CircuitCall';
import { DeployPanel } from './components/DeployPanel';
import { BrandMark, Icon } from './components/Icon';
import { PublicLedger } from './components/PublicLedger';
import { WalletConnect } from './components/WalletConnect';
import { useWallet } from './hooks/useWallet';
import { CONTRACT_ADDRESS, isDeployed } from './lib/contract';

export default function App() {
  const wallet = useWallet();
  // Bumped after each accepted ballot so the public tally re-reads the chain.
  const [ballotsCast, setBallotsCast] = useState(0);
  const connected = wallet.status === 'connected';

  return (
    <>
      <header className="site-header">
        <div className="shell site-header__inner">
          <a className="brand" href="/" aria-label="cepush home">
            <BrandMark />
            <span className="brand__name">cepush</span>
          </a>
          <div className="header-meta">
            <span className="pill pill--network">Midnight · {wallet.networkId}</span>
            <span className="pill">
              <span className={connected ? 'dot dot--live' : 'dot'} aria-hidden="true" />
              {connected ? 'Wallet connected' : 'Not connected'}
            </span>
          </div>
        </div>
      </header>

      <main className="shell">
        <section className="hero" aria-labelledby="hero-title">
          <p className="eyebrow">Private voting on Midnight</p>
          <h1 className="hero__title" id="hero-title">
            Every vote counted. <em>No ballot sent.</em>
          </h1>
          <p className="hero__lede">
            cepush lets a community vote on-chain while the ballot itself stays on your device.
            Your choice is proved in zero knowledge locally; the contract receives a proof and
            publishes only the per-option totals.
          </p>

          <ul className="pillars">
            <li className="pillar">
              <Icon name="lock" size={22} />
              <h3>Private ballot</h3>
              <p>Your choice is a local witness. It is never a call argument and never stored.</p>
            </li>
            <li className="pillar">
              <Icon name="chart" size={22} />
              <h3>Public tally</h3>
              <p>Per-option counters live on the ledger, so anyone can check the result.</p>
            </li>
            <li className="pillar">
              <Icon name="shield" size={22} />
              <h3>Proved, not shown</h3>
              <p>The circuit proves your ballot is a valid option without revealing which.</p>
            </li>
          </ul>
        </section>

        <div className="workspace">
          <div className="stack">
            <DeployPanel session={wallet.session} />
            <CircuitCall session={wallet.session} onVoted={() => setBallotsCast((n) => n + 1)} />
          </div>
          <div className="stack">
            <WalletConnect {...wallet} />
            <PublicLedger session={wallet.session} refreshKey={ballotsCast} />
          </div>
        </div>

        <section className="section" aria-labelledby="how-title">
          <h2 className="section__title" id="how-title">
            How a ballot travels, and where it stops.
          </h2>
          <ol className="steps">
            <li className="step">
              <h3>You choose, locally</h3>
              <p>
                The option you pick is held in memory on this device, in a store that is wiped
                the moment the proof is done.
              </p>
            </li>
            <li className="step">
              <h3>Your device proves it</h3>
              <p>
                A zero-knowledge proof shows the choice is a legal option. The proof carries the
                fact, not the value.
              </p>
            </li>
            <li className="step">
              <h3>The chain counts it</h3>
              <p>
                Lace submits the proof, one counter moves by one, and the total grows. The ballot
                itself is never written anywhere.
              </p>
            </li>
          </ol>
        </section>
      </main>

      <footer className="site-footer">
        <div className="shell site-footer__inner">
          <div className="contract-ref">
            <Icon name="shield" size={16} />
            {isDeployed() ? (
              <span>
                Contract <code>{CONTRACT_ADDRESS}</code>
              </span>
            ) : (
              <span>Contract not deployed yet</span>
            )}
          </div>
          <span>The tally is public. The ballot never leaves your device.</span>
        </div>
      </footer>
    </>
  );
}
