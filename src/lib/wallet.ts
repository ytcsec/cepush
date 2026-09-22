/**
 * The Lace side of the app.
 *
 * Everything that talks to the DApp Connector lives here, so the React layer
 * never has to know how a wallet is discovered or what shape its errors take.
 */
import {
  ErrorCodes,
  type APIError,
  type ConnectedAPI,
  type Configuration,
  type InitialAPI,
} from '@midnight-ntwrk/dapp-connector-api';

/** The network this build talks to. Preprod unless told otherwise. */
export const NETWORK_ID: string = import.meta.env.VITE_NETWORK_ID ?? 'preprod';

/** No Midnight wallet is injected into the page at all. */
export class WalletNotFoundError extends Error {
  constructor() {
    super('No Midnight wallet found. Install the Lace extension and reload the page.');
    this.name = 'WalletNotFoundError';
  }
}

/** The user saw the prompt and said no. Not an error worth shouting about. */
export class WalletRejectedError extends Error {
  constructor() {
    super('Connection request was declined in the wallet.');
    this.name = 'WalletRejectedError';
  }
}

/**
 * The wallet is on a different network than this build targets.
 *
 * Lace raises this itself, as an `InvalidRequest` reading "Network ID mismatch",
 * without saying which network it is actually on — so `walletNetwork` is only
 * known when we got far enough to ask.
 */
export class NetworkMismatchError extends Error {
  constructor(
    readonly expected: string,
    readonly walletNetwork?: string,
  ) {
    super(
      (walletNetwork
        ? `Lace is on "${walletNetwork}", but this app talks to "${expected}". `
        : `Lace is not on "${expected}". `) +
        'Open Lace → Settings → Midnight, set Network to Preprod, then reconnect. ' +
        'While you are there, set Proof server to Local (http://localhost:6300).',
    );
    this.name = 'NetworkMismatchError';
  }
}

const isApiError = (e: unknown): e is APIError =>
  typeof e === 'object' && e !== null && (e as APIError).type === 'DAppConnectorAPIError';

/**
 * Wallets register under `window.midnight` keyed by a freshly minted UUID —
 * not under a fixed name — so the only correct way to find one is to enumerate.
 */
export function listWallets(): InitialAPI[] {
  const injected = window.midnight;
  return injected ? Object.values(injected) : [];
}

export type WalletSession = {
  readonly api: ConnectedAPI;
  readonly name: string;
  readonly icon: string;
  readonly apiVersion: string;
  readonly address: string;
  readonly configuration: Configuration;
  /**
   * Midnight.js asks for these synchronously, but the connector only hands them
   * over through a promise, so they are fetched once at connect time and cached.
   */
  readonly coinPublicKey: string;
  readonly encryptionPublicKey: string;
};

/**
 * Asks the first injected wallet to connect, then checks that it landed on the
 * network this build expects.
 */
export async function connectWallet(networkId: string = NETWORK_ID): Promise<WalletSession> {
  const [wallet] = listWallets();
  if (!wallet) throw new WalletNotFoundError();

  let api: ConnectedAPI;
  try {
    api = await wallet.connect(networkId);
  } catch (e) {
    if (isApiError(e)) {
      if (e.code === ErrorCodes.Rejected || e.code === ErrorCodes.PermissionRejected) {
        throw new WalletRejectedError();
      }
      // Lace refuses the connection outright when its active network is not the
      // one the DApp asked for. Without this the message lands in the generic
      // bucket and tells the user nothing they can act on.
      if (e.code === ErrorCodes.InvalidRequest && /network/i.test(e.message ?? '')) {
        throw new NetworkMismatchError(networkId);
      }
    }
    throw e;
  }

  const status = await api.getConnectionStatus();
  if (status.status !== 'connected') throw new WalletRejectedError();
  if (status.networkId !== networkId) throw new NetworkMismatchError(networkId, status.networkId);

  const [{ unshieldedAddress }, shielded, configuration] = await Promise.all([
    api.getUnshieldedAddress(),
    api.getShieldedAddresses(),
    api.getConfiguration(),
  ]);

  return {
    api,
    name: wallet.name,
    icon: wallet.icon,
    apiVersion: wallet.apiVersion,
    address: unshieldedAddress,
    configuration,
    coinPublicKey: shielded.shieldedCoinPublicKey,
    encryptionPublicKey: shielded.shieldedEncryptionPublicKey,
  };
}

/** Shortens an address for display without hiding which one it is. */
export const truncateAddress = (address: string, lead = 12, tail = 8): string =>
  address.length <= lead + tail ? address : `${address.slice(0, lead)}…${address.slice(-tail)}`;
