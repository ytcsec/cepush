/**
 * The six providers Midnight.js needs, assembled from a connected wallet.
 *
 * Five of them are straightforward factory calls. The sixth — the bridge from
 * the DApp Connector to `WalletProvider` and `MidnightProvider` — has no helper
 * in the SDK, because the two sides speak different languages: the connector
 * takes and returns serialised transactions as strings, while Midnight.js works
 * with ledger `Transaction` objects. The translation lives here.
 */
import { fromHex, toHex } from '@midnight-ntwrk/compact-runtime';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { validatePassword } from '@midnight-ntwrk/midnight-js-utils';
import { Transaction } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import type { FinalizedTransaction } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import type {
  MidnightProvider,
  PrivateStateProvider,
  ProofProvider,
  PublicDataProvider,
  UnboundTransaction,
  WalletProvider,
} from '@midnight-ntwrk/midnight-js-types';

import { ZK_CONFIG_BASE } from './contract';
import type { WalletSession } from './wallet';

/** The circuits this app can prove. One, for now. */
export type CepushCircuitId = 'vote';

/** Key under which the ballot is handed to the witness. */
export const PRIVATE_STATE_ID = 'cepush-ballot';

/** The ballot, as the witness expects to find it. */
export type CepushPrivateState = { readonly ballot: number };

/**
 * The private state store is deliberately throwaway. The ballot is written just
 * before proving and deleted straight after, and the store is keyed with a
 * password that only exists in memory for this page load — so nothing readable
 * survives a refresh, let alone reaches disk in a durable form.
 */
const PASSWORD_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&*+-=?@^_~';

/**
 * The store rejects weak passwords: it wants three character classes and no
 * runs or sequences, and a plain hex string fails the first rule outright. Draw
 * from a mixed alphabet and keep drawing until the SDK's own policy accepts the
 * result, so the check can never fail at proof time.
 */
function generateSessionPassword(): string {
  for (;;) {
    const bytes = new Uint8Array(40);
    crypto.getRandomValues(bytes);
    // The modulo bias over 75 symbols is negligible for a password that only
    // lives for one page load.
    const candidate = Array.from(bytes, (b) => PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length]).join('');
    try {
      validatePassword(candidate);
      return candidate;
    } catch {
      // Rejected by the policy; draw again.
    }
  }
}

const sessionPassword = generateSessionPassword();

/**
 * Empties the store before an operation.
 *
 * The password dies with the page, so anything a previous page load left
 * behind is unreadable ciphertext — and Midnight.js reads it: finding a
 * deployed contract first looks up the contract's signing key, and decrypting
 * one written under an old password fails with a bare `OperationError`.
 * Clearing is safe because nothing here is meant to outlive the page. The
 * signing key only authorises verifier-key maintenance, which this contract
 * never uses, and a fresh one is sampled on the next lookup.
 */
export async function resetPrivateStore(provider: CepushProviders['privateStateProvider']): Promise<void> {
  await provider.clear();
  await provider.clearSigningKeys();
}

export type CepushProviders = {
  readonly privateStateProvider: PrivateStateProvider<typeof PRIVATE_STATE_ID, CepushPrivateState>;
  readonly publicDataProvider: PublicDataProvider;
  readonly zkConfigProvider: FetchZkConfigProvider<CepushCircuitId>;
  readonly proofProvider: ProofProvider;
  readonly walletProvider: WalletProvider;
  readonly midnightProvider: MidnightProvider;
};

/**
 * `balanceUnsealedTransaction` expects a `Transaction<SignatureEnabled, Proof,
 * PreBinding>` — which is exactly what `UnboundTransaction` is — and hands back
 * a bound one.
 */
function createWalletProvider(session: WalletSession): WalletProvider {
  return {
    async balanceTx(tx: UnboundTransaction): Promise<FinalizedTransaction> {
      const { tx: balanced } = await session.api.balanceUnsealedTransaction(
        toHex(tx.serialize()),
      );
      return Transaction.deserialize('signature', 'proof', 'binding', fromHex(balanced));
    },
    getCoinPublicKey: () => session.coinPublicKey,
    getEncryptionPublicKey: () => session.encryptionPublicKey,
  };
}

/**
 * The connector's `submitTransaction` resolves to nothing, so the identifier is
 * read off the transaction we submitted rather than returned by the wallet.
 */
function createMidnightProvider(session: WalletSession): MidnightProvider {
  return {
    async submitTx(tx: FinalizedTransaction): Promise<string> {
      await session.api.submitTransaction(toHex(tx.serialize()));
      const [identifier] = tx.identifiers();
      return identifier ?? tx.transactionHash();
    },
  };
}

/**
 * Builds the bundle. The wallet tells us where the indexer and the proof server
 * live, so the app does not have to be configured with them separately.
 */
export function createProviders(session: WalletSession): CepushProviders {
  const { indexerUri, indexerWsUri, proverServerUri, networkId } = session.configuration;

  // Midnight.js keeps the network id in module state; addresses are encoded
  // against it, so it has to be set before anything else is built.
  setNetworkId(networkId);

  // Pass the platform's fetch explicitly. The provider otherwise defaults to
  // cross-fetch, and that package resolves to a build that does not work in the
  // bundle — the artefact request then fails before it is ever made, and the
  // only symptom is "Failed to read verifier key".
  const zkConfigProvider = new FetchZkConfigProvider<CepushCircuitId>(
    ZK_CONFIG_BASE,
    (input, init) => globalThis.fetch(input as RequestInfo, init),
  );

  return {
    privateStateProvider: levelPrivateStateProvider<typeof PRIVATE_STATE_ID, CepushPrivateState>({
      accountId: session.coinPublicKey,
      privateStoragePasswordProvider: () => sessionPassword,
    }),
    publicDataProvider: indexerPublicDataProvider(indexerUri, indexerWsUri),
    zkConfigProvider,
    proofProvider: httpClientProofProvider<CepushCircuitId>(
      proverServerUri ?? 'http://localhost:6300',
      zkConfigProvider,
    ),
    walletProvider: createWalletProvider(session),
    midnightProvider: createMidnightProvider(session),
  };
}
