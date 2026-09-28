/**
 * The voter key: 32 random bytes that stand for "this voter" inside the proof.
 *
 * The contract never sees the key. It sees a nullifier, a one-way hash of the
 * key and the poll's address, and refuses any nullifier it has seen before.
 * That is what makes a second ballot from the same key fail on chain.
 *
 * Unlike the ballot, the key has to outlive the page: a key minted fresh on
 * every visit would give every visit a fresh vote. So it is kept in this
 * browser's local storage, one key per connected wallet. It is a credential in
 * the same sense a wallet key is, and it is handled like one — never rendered,
 * never logged, never sent anywhere. Only its nullifier leaves the device.
 *
 * What this does not stop, at L3: the same person voting again from another
 * browser, or after clearing site data, gets a new key. Tying keys to members
 * is the allowlist proof, which is L4 scope.
 */
import { toHex } from '@midnight-ntwrk/compact-runtime';

const STORAGE_PREFIX = 'cepush.voterKey.v1.';

/** Keys minted this page load, for browsers where storage is unavailable. */
const memoryFallback = new Map<string, string>();

/**
 * Local storage is keyed by a hash of the wallet's public key rather than the
 * key itself, so the storage entry does not name the wallet in the clear.
 */
async function storageSlot(coinPublicKey: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(coinPublicKey));
  return STORAGE_PREFIX + toHex(new Uint8Array(digest)).slice(0, 32);
}

const isKey = (value: string | null): value is string =>
  value !== null && /^[0-9a-f]{64}$/.test(value);

function mint(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

/** The voter key for this wallet, minted on first use. Hex, 64 characters. */
export async function voterKeyFor(coinPublicKey: string): Promise<string> {
  const slot = await storageSlot(coinPublicKey);

  try {
    const stored = window.localStorage.getItem(slot);
    if (isKey(stored)) return stored;
    const fresh = mint();
    window.localStorage.setItem(slot, fresh);
    return fresh;
  } catch {
    // Private windows and locked-down browsers can refuse storage outright.
    // Voting still works; the key just lasts until the page is closed.
    const existing = memoryFallback.get(slot);
    if (existing !== undefined) return existing;
    const fresh = mint();
    memoryFallback.set(slot, fresh);
    return fresh;
  }
}
