import { useCallback, useEffect, useState } from 'react';

import { describe, isDeployed, POLL, readTally, type PublicTally } from '../lib/contract';
import type { WalletSession } from '../lib/wallet';

type Props = {
  readonly session: WalletSession | null;
  /** Bumped after every successful ballot, so the panel re-reads the chain. */
  readonly refreshKey: number;
};

/**
 * The other half of the privacy claim: what anyone reading the chain can see.
 *
 * The ballot panel says the choice stays on the device. This panel shows the
 * public side of the same poll, read straight from the indexer, so the claim
 * can be checked rather than taken on trust — the ledger holds counters and a
 * total, and no field anywhere holds a ballot.
 */
export function PublicLedger({ session, refreshKey }: Props) {
  const [tally, setTally] = useState<PublicTally | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (session === null || !isDeployed()) return;
    setLoading(true);
    setError(null);
    try {
      setTally(await readTally(session));
    } catch (e) {
      setError(describe(e) || 'The indexer could not be read.');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  if (!isDeployed()) return null;

  return (
    <section className="panel">
      <h2>What the chain can see</h2>
      <p className="muted">
        Read live from the Preprod indexer. This is the entire public state of the poll.
      </p>

      {session === null && <p className="muted">Connect a wallet to read the public tally.</p>}

      {session !== null && tally === null && !loading && !error && (
        <p className="notice notice--not-found">No contract state at this address yet.</p>
      )}

      {tally !== null && (
        <table className="ledger">
          <tbody>
            {tally.counts.map((count, index) => (
              <tr key={index}>
                <th scope="row">{POLL.options[index] ?? `Option ${index}`}</th>
                <td>{count.toString()}</td>
              </tr>
            ))}
            <tr className="ledger__total">
              <th scope="row">Total ballots</th>
              <td>{tally.totalVotes.toString()}</td>
            </tr>
            <tr className="ledger__hidden">
              <th scope="row">Who chose what</th>
              <td>not stored</td>
            </tr>
          </tbody>
        </table>
      )}

      {error !== null && (
        <p className="notice notice--unknown" role="alert">
          {error}
        </p>
      )}

      {session !== null && (
        <button className="button button--ghost" onClick={() => void refresh()} disabled={loading}>
          {loading ? 'Reading the chain…' : 'Refresh'}
        </button>
      )}
    </section>
  );
}
