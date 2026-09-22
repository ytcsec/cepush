import { useState } from 'react';

import {
  castVote,
  ContractNotDeployedError,
  isDeployed,
  POLL,
  ProofFailedError,
} from '../lib/contract';
import type { WalletSession } from '../lib/wallet';

type Props = {
  readonly session: WalletSession | null;
};

type Phase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'proving' }
  | { readonly kind: 'submitted'; readonly txId: string }
  | { readonly kind: 'error'; readonly message: string; readonly variant: string };

export function CircuitCall({ session }: Props) {
  // The ballot lives here and nowhere else. It is never logged, never put in
  // storage, and is cleared the moment the proof is done with it.
  const [ballot, setBallot] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });

  const busy = phase.kind === 'proving';
  const canVote = session !== null && ballot !== null && !busy;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (session === null || ballot === null) return;

    setPhase({ kind: 'proving' });
    try {
      const { txId } = await castVote(session, ballot);
      setPhase({ kind: 'submitted', txId });
    } catch (e) {
      if (e instanceof ContractNotDeployedError) {
        setPhase({ kind: 'error', message: e.message, variant: 'not-deployed' });
      } else if (e instanceof ProofFailedError) {
        setPhase({ kind: 'error', message: e.message, variant: 'proof' });
      } else {
        setPhase({
          kind: 'error',
          message: e instanceof Error ? e.message : 'The wallet rejected the transaction.',
          variant: 'rejected',
        });
      }
    } finally {
      // Whatever happened, the app is done with the ballot.
      setBallot(null);
    }
  }

  return (
    <section className="panel">
      <h2>{POLL.title}</h2>

      <form onSubmit={onSubmit}>
        <fieldset disabled={session === null || busy}>
          <legend className="sr-only">Your ballot</legend>
          {POLL.options.map((label, index) => (
            <label className="option" key={label}>
              <input
                type="radio"
                name="ballot"
                value={index}
                checked={ballot === index}
                onChange={() => setBallot(index)}
              />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>

        <p className="proof-claim">
          <span aria-hidden="true">🛡</span> Proved without revealing your input — your choice
          stays on this device and is never sent to the contract.
        </p>

        <button className="button" type="submit" disabled={!canVote}>
          {busy ? 'Generating proof…' : 'Cast ballot'}
        </button>
      </form>

      {session === null && <p className="muted">Connect a wallet to vote.</p>}

      {!isDeployed() && session !== null && phase.kind === 'idle' && (
        <p className="notice notice--not-deployed">
          This build has no contract address yet, so the ballot cannot be submitted.
        </p>
      )}

      {busy && (
        <p className="notice notice--busy" role="status">
          Proving locally. This takes a few seconds and does not send your choice anywhere.
        </p>
      )}

      {phase.kind === 'submitted' && (
        <p className="notice notice--ok" role="status">
          Ballot counted. Transaction <code>{phase.txId}</code>
        </p>
      )}

      {phase.kind === 'error' && (
        <p className={`notice notice--${phase.variant}`} role="alert">
          {phase.message}
        </p>
      )}
    </section>
  );
}
