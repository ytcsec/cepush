import { useCallback, useEffect, useState } from 'react';

import {
  connectWallet,
  listWallets,
  NETWORK_ID,
  NetworkMismatchError,
  WalletNotFoundError,
  WalletRejectedError,
  type WalletSession,
} from '../lib/wallet';

export type WalletStatus = 'detecting' | 'unavailable' | 'disconnected' | 'connecting' | 'connected';

export type WalletError = {
  readonly kind: 'not-found' | 'rejected' | 'network-mismatch' | 'unknown';
  readonly message: string;
};

const classify = (e: unknown): WalletError => {
  if (e instanceof WalletNotFoundError) return { kind: 'not-found', message: e.message };
  if (e instanceof WalletRejectedError) return { kind: 'rejected', message: e.message };
  if (e instanceof NetworkMismatchError) return { kind: 'network-mismatch', message: e.message };
  return { kind: 'unknown', message: e instanceof Error ? e.message : 'The wallet returned an unexpected error.' };
};

/**
 * Browser extensions inject themselves whenever they get around to it, which is
 * often after the first render. Poll briefly rather than deciding on frame one
 * that no wallet exists.
 */
const DETECT_INTERVAL_MS = 250;
const DETECT_ATTEMPTS = 12;

export function useWallet() {
  const [status, setStatus] = useState<WalletStatus>('detecting');
  const [session, setSession] = useState<WalletSession | null>(null);
  const [error, setError] = useState<WalletError | null>(null);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const tick = () => {
      if (cancelled) return;
      if (listWallets().length > 0) {
        setStatus((s) => (s === 'detecting' ? 'disconnected' : s));
        return;
      }
      if (++attempts >= DETECT_ATTEMPTS) {
        setStatus((s) => (s === 'detecting' ? 'unavailable' : s));
        return;
      }
      window.setTimeout(tick, DETECT_INTERVAL_MS);
    };

    tick();
    return () => {
      cancelled = true;
    };
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    setStatus('connecting');
    try {
      const next = await connectWallet();
      setSession(next);
      setStatus('connected');
    } catch (e) {
      setSession(null);
      const classified = classify(e);
      setError(classified);
      setStatus(classified.kind === 'not-found' ? 'unavailable' : 'disconnected');
    }
  }, []);

  /**
   * The connector exposes no revoke call: a DApp disconnects by forgetting the
   * session it was handed. Permissions are managed in the wallet itself.
   */
  const disconnect = useCallback(() => {
    setSession(null);
    setError(null);
    setStatus(listWallets().length > 0 ? 'disconnected' : 'unavailable');
  }, []);

  return { status, session, error, connect, disconnect, networkId: NETWORK_ID } as const;
}
