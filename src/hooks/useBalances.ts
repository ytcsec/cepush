import { useCallback, useEffect, useState } from 'react';

import type { WalletSession } from '../lib/wallet';

export type Balances = {
  /** Unshielded tokens, by token type. tNIGHT from the faucet lands here. */
  readonly unshielded: Record<string, bigint>;
  /** DUST pays the fees. Registered NIGHT generates it over time. */
  readonly dust: { readonly balance: bigint; readonly cap: bigint };
};

/**
 * Reads the balances the wallet is willing to report.
 *
 * Worth surfacing because the two failure modes look identical from the
 * outside: a wallet with no tNIGHT and a wallet whose tNIGHT was never
 * registered for DUST generation both simply cannot pay for a transaction.
 */
export function useBalances(session: WalletSession | null) {
  const [balances, setBalances] = useState<Balances | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (session === null) {
      setBalances(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [unshielded, dust] = await Promise.all([
        session.api.getUnshieldedBalances(),
        session.api.getDustBalance(),
      ]);
      setBalances({ unshielded, dust });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The wallet would not report its balances.');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { balances, error, loading, refresh } as const;
}

/** Largest unshielded holding, which on Preprod is the faucet's tNIGHT. */
export const largestUnshielded = (b: Balances | null): bigint =>
  b === null ? 0n : Object.values(b.unshielded).reduce((max, v) => (v > max ? v : max), 0n);

/** Both NIGHT and DUST are quoted in millionths. */
const DECIMALS = 6n;
const SCALE = 10n ** DECIMALS;

/**
 * Renders a base-unit amount as a readable figure. Showing the raw integer
 * makes 5,000 tokens look like five billion.
 */
export function formatAmount(raw: bigint): string {
  const whole = raw / SCALE;
  const fraction = raw % SCALE;
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (fraction === 0n) return grouped;
  const decimals = fraction.toString().padStart(Number(DECIMALS), '0').replace(/0+$/, '');
  return `${grouped}.${decimals}`;
}
