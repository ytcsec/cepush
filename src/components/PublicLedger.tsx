import { useCallback, useEffect, useState } from 'react';

import { describe, isDeployed, POLL, readTally, type PublicTally } from '../lib/contract';
import type { WalletSession } from '../lib/wallet';
import { Icon } from './Icon';

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

  const total = tally?.totalVotes ?? 0n;
  const share = (count: bigint): number => (total === 0n ? 0 : Number((count * 1000n) / total) / 10);

  return (
    <section className="card" aria-labelledby="ledger-title">
      <div className="card__head">
        <div>
          <p className="card__kicker">
            <Icon name="eye" size={14} /> Public ledger
          </p>
          <h2 className="card__title card__title--sm" id="ledger-title">
            What the chain can see
          </h2>
        </div>
        {session !== null && (
          <button
            className="icon-button"
            onClick={() => void refresh()}
            disabled={loading}
            aria-label={loading ? 'Reading the chain' : 'Refresh the public tally'}
            title="Refresh"
          >
            <Icon name="refresh" size={15} className={loading ? 'spinning' : undefined} />
          </button>
        )}
      </div>

      <p className="faint">
        Read live from the Preprod indexer. This is the entire public state of the poll.
      </p>

      {session === null && <p className="muted">Connect a wallet to read the public tally.</p>}

      {session !== null && tally === null && !loading && !error && (
        <div className="notice notice--not-found">
          <Icon name="alert" />
          <div className="notice__body">No contract state at this address yet.</div>
        </div>
      )}

      {tally !== null && (
        <>
          <ul className="tally" aria-label="Votes per option">
            {tally.counts.map((count, index) => (
              <li className="tally__row" key={index}>
                <div className="tally__top">
                  <span className="tally__label">{POLL.options[index] ?? `Option ${index}`}</span>
                  <span className="tally__value">
                    {count.toString()} <span>· {share(count)}%</span>
                  </span>
                </div>
                <div className="tally__bar" aria-hidden="true">
                  <div className="tally__fill" style={{ transform: `scaleX(${share(count) / 100})` }} />
                </div>
              </li>
            ))}
          </ul>

          <dl className="ledger-facts">
            <div>
              <dt>Total ballots</dt>
              <dd>{tally.totalVotes.toString()}</dd>
            </div>
            <div className="is-hidden">
              <dt>Who chose what</dt>
              <dd>
                <Icon name="lock" size={15} /> not stored
              </dd>
            </div>
          </dl>
        </>
      )}

      {error !== null && (
        <div className="notice notice--unknown" role="alert">
          <Icon name="alert" />
          <div className="notice__body">{error}</div>
        </div>
      )}
    </section>
  );
}
