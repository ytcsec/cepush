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
const sessionPassword = (() => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
})();

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

  const zkConfigProvider = new FetchZkConfigProvider<CepushCircuitId>(ZK_CONFIG_BASE);

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
