import { useState } from 'react';

import {
  castVote,
  ContractNotDeployedError,
  isDeployed,
  POLL,
  ProofFailedError,
} from '../lib/contract';
import type { WalletSession } from '../lib/wallet';
import { Icon } from './Icon';

type Props = {
  readonly session: WalletSession | null;
  /** Called once a ballot has been accepted, so the public tally can re-read. */
  readonly onVoted?: () => void;
};

type Phase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'proving' }
  | { readonly kind: 'submitted'; readonly txId: string }
  | { readonly kind: 'error'; readonly message: string; readonly variant: string };

export function CircuitCall({ session, onVoted }: Props) {
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
      onVoted?.();
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
    <section className="card card--feature" aria-labelledby="ballot-title">
      <div className="card__head">
        <div>
          <p className="card__kicker">
            <Icon name="lock" size={14} /> Open poll
          </p>
          <h2 className="card__title" id="ballot-title">
            {POLL.title}
          </h2>
        </div>
      </div>

      <form onSubmit={onSubmit}>
        <fieldset disabled={session === null || busy}>
          <legend className="sr-only">Your ballot</legend>
          <div className="options">
            {POLL.options.map((label, index) => (
              <label className="option" key={label}>
                <input
                  type="radio"
                  name="ballot"
                  value={index}
                  checked={ballot === index}
                  onChange={() => setBallot(index)}
                />
                <span className="option__mark" aria-hidden="true" />
                <span className="option__label">{label}</span>
                <span className="option__index" aria-hidden="true">
                  0{index + 1}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <p className="proof-claim">
          <Icon name="shield" size={20} />
          <span>
            <strong>Proved without revealing your input</strong>
            <span>Your choice stays on this device and is never sent to the contract.</span>
          </span>
        </p>

        <button className="button button--block" type="submit" disabled={!canVote} aria-busy={busy}>
          {busy ? (
            <>
              <span className="spinner" aria-hidden="true" /> Generating proof…
            </>
          ) : (
            <>
              <Icon name="send" size={18} /> Cast ballot
            </>
          )}
        </button>
      </form>

      {session === null && <p className="faint hint">Connect a wallet to vote.</p>}

      {!isDeployed() && session !== null && phase.kind === 'idle' && (
        <div className="notice notice--not-deployed">
          <Icon name="alert" />
          <div className="notice__body">
            This build has no contract address yet, so the ballot cannot be submitted.
          </div>
        </div>
      )}

      {busy && (
        <div className="notice notice--busy" role="status">
          <span className="spinner" aria-hidden="true" />
          <div className="notice__body">
            Proving locally. This takes a few seconds and does not send your choice anywhere.
          </div>
        </div>
      )}

      {phase.kind === 'submitted' && (
        <div className="notice notice--ok" role="status">
          <Icon name="check" />
          <div className="notice__body">
            <strong>Ballot counted.</strong>
            <dl className="receipt">
              <dt>Transaction</dt>
              <dd>
                <code>{phase.txId}</code>
              </dd>
              <dt>Circuit arguments</dt>
              <dd>
                none — <code>vote()</code> takes no parameters
              </dd>
              <dt>Your ballot</dt>
              <dd>not in the transaction; proved valid, never sent</dd>
            </dl>
          </div>
        </div>
      )}

      {phase.kind === 'error' && (
        <div className={`notice notice--${phase.variant}`} role="alert">
          <Icon name="alert" />
          <div className="notice__body">{phase.message}</div>
        </div>
      )}
    </section>
  );
}
