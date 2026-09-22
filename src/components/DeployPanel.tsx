import { useState } from 'react';

import { deployPoll, describe, isDeployed, POLL } from '../lib/contract';
import type { WalletSession } from '../lib/wallet';

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
      // could not be read, never the reason it could not be read.
      setPhase({ kind: 'error', message: describe(e) || 'The deploy failed.' });
    }
  }

  return (
    <section className="panel panel--warn">
      <h2>No poll on chain yet</h2>
      <p className="muted">
        This build has no contract address. Deploying publishes “{POLL.title}” with{' '}
        {POLL.options.length} options and returns the address to put in <code>.env</code>.
        The connected wallet pays the fee.
      </p>

      <button
        className="button"
        onClick={onDeploy}
        disabled={session === null || phase.kind === 'deploying'}
      >
        {phase.kind === 'deploying' ? 'Deploying…' : 'Deploy the poll'}
      </button>

      {session === null && <p className="muted">Connect a funded wallet first.</p>}

      {phase.kind === 'deploying' && (
        <p className="notice notice--busy" role="status">
          Waiting for the network. Keep the proof server running.
        </p>
      )}

      {phase.kind === 'done' && (
        <p className="notice notice--ok" role="status">
          Deployed. Put this in <code>.env</code> as <code>VITE_CONTRACT_ADDRESS</code> and
          rebuild:
          <br />
          <code>{phase.address}</code>
        </p>
      )}

      {phase.kind === 'error' && (
        <p className="notice notice--proof" role="alert">
          {phase.message}
        </p>
      )}
    </section>
  );
}
