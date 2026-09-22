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

/** The wallet is connected, but to a different network than this build targets. */
export class NetworkMismatchError extends Error {
  constructor(
    readonly walletNetwork: string,
    readonly expected: string,
  ) {
    super(`Wallet is on "${walletNetwork}", but this app talks to "${expected}". Switch networks in Lace and reconnect.`);
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
    if (isApiError(e) && (e.code === ErrorCodes.Rejected || e.code === ErrorCodes.PermissionRejected)) {
      throw new WalletRejectedError();
    }
    throw e;
  }

  const status = await api.getConnectionStatus();
  if (status.status !== 'connected') throw new WalletRejectedError();
  if (status.networkId !== networkId) throw new NetworkMismatchError(status.networkId, networkId);

  const [{ unshieldedAddress }, configuration] = await Promise.all([
    api.getUnshieldedAddress(),
    api.getConfiguration(),
  ]);

  return {
    api,
    name: wallet.name,
    icon: wallet.icon,
    apiVersion: wallet.apiVersion,
    address: unshieldedAddress,
    configuration,
  };
}

/** Shortens an address for display without hiding which one it is. */
export const truncateAddress = (address: string, lead = 12, tail = 8): string =>
  address.length <= lead + tail ? address : `${address.slice(0, lead)}…${address.slice(-tail)}`;
