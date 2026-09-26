import { useState } from 'react';

import { deployPoll, describe, isDeployed, POLL } from '../lib/contract';
import type { WalletSession } from '../lib/wallet';
import { Icon } from './Icon';

type Props = {
  readonly session: WalletSession | null;
};

type Phase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'deploying' }
  | { readonly kind: 'done'; readonly address: string }
  | { readonly kind: 'error'; readonly message: string };

/**
 * Only appears when the build has no contract address. Deploying is a one-time
 * bootstrap: it puts the poll on chain so the rest of the app has something to
 * talk to, and then this panel is never seen again.
 */
export function DeployPanel({ session }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });

  if (isDeployed()) return null;

  async function onDeploy() {
    if (session === null) return;
    setPhase({ kind: 'deploying' });
    try {
      const address = await deployPoll(session);
      setPhase({ kind: 'done', address });
    } catch (e) {
      // Show the whole cause chain: the outermost message names the asset that
      // could not be read, never the reason it could not be read. Keep the raw
      // object in the console too, for anything the formatter cannot reach.
      console.error('deploy failed', e);
      setPhase({ kind: 'error', message: describe(e) || 'The deploy failed, and threw nothing describable.' });
    }
  }

  return (
    <section className="card card--warn" aria-labelledby="deploy-title">
      <p className="card__kicker">
        <Icon name="cpu" size={14} /> Setup
      </p>
      <h2 className="card__title card__title--sm" id="deploy-title">
        No poll on chain yet
      </h2>
      <p className="muted card__text">
        This build has no contract address. Deploying publishes “{POLL.title}” with{' '}
        {POLL.options.length} options and returns the address to put in <code>.env</code>.
        The connected wallet pays the fee.
      </p>

      <button
        className="button"
        onClick={onDeploy}
        disabled={session === null || phase.kind === 'deploying'}
      >
        {phase.kind === 'deploying' ? (
          <>
            <span className="spinner" aria-hidden="true" /> Deploying…
          </>
        ) : (
          'Deploy the poll'
        )}
      </button>

      {session === null && <p className="faint hint">Connect a funded wallet first.</p>}

      {phase.kind === 'deploying' && (
        <div className="notice notice--busy" role="status">
          <span className="spinner" aria-hidden="true" />
          <div className="notice__body">Waiting for the network. Keep the proof server running.</div>
        </div>
      )}

      {phase.kind === 'done' && (
        <div className="notice notice--ok" role="status">
          <Icon name="check" />
          <div className="notice__body">
            Deployed. Put this in <code>.env</code> as <code>VITE_CONTRACT_ADDRESS</code> and
            rebuild:
            <br />
            <code>{phase.address}</code>
          </div>
        </div>
      )}

      {phase.kind === 'error' && (
        <div className="notice notice--proof" role="alert">
          <Icon name="alert" />
          <div className="notice__body">{phase.message}</div>
        </div>
      )}
    </section>
  );
}
