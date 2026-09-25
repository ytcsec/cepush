/**
 * Where the app meets the contract.
 *
 * The ballot never appears in this module's inputs as a circuit argument. It is
 * handed to the witness at proof time and dropped immediately afterwards.
 */
import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import * as CompiledContract from '@midnight-ntwrk/compact-js/effect/CompiledContract';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';

import { Contract, ledger, type Ledger } from '../../managed/cepush/contract/index.js';
import {
  createProviders,
  PRIVATE_STATE_ID,
  resetPrivateStore,
  type CepushPrivateState,
} from './providers';
import type { WalletSession } from './wallet';

/** Filled in after the Preprod deploy. Empty means "not wired up yet". */
export const CONTRACT_ADDRESS: string = import.meta.env.VITE_CONTRACT_ADDRESS ?? '';

/**
 * Where the compiled proving keys and zkir are served from.
 *
 * `FetchZkConfigProvider` calls `new URL(base)` in its constructor and rejects
 * anything that is not http(s), so a page-relative path throws before it is
 * ever fetched. Resolve against the page origin here: an absolute value in the
 * environment survives unchanged, a relative one becomes absolute.
 */
export const ZK_CONFIG_BASE: string = new URL(
  import.meta.env.VITE_ZK_CONFIG_BASE ?? '/managed/cepush',
  window.location.origin,
).toString();

export const isDeployed = (): boolean => CONTRACT_ADDRESS.trim().length > 0;

/** The poll this build points at. Public information, safe to hard-code. */
export const POLL = {
  title: 'Should the DAO fund the summer meetup?',
  options: ['Yes', 'No', 'Abstain'],
} as const;

export type VoteOutcome = {
  readonly txId: string;
};

/** Walks the cause chain, because the outermost message is rarely the useful one. */

function describeOne(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) {
    // Connector failures arrive as Errors carrying a code and a reason; the
    // plain message on its own is often empty.
    const api = value as { code?: string; reason?: string };
    const extra = [api.code, api.reason].filter(Boolean).join(': ');
    return [value.name, value.message, extra].filter(Boolean).join(' · ');
  }
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)).slice(0, 500);
    } catch {
      return Object.prototype.toString.call(value);
    }
  }
  return String(value);
}

export function describe(cause: unknown): string {
  const parts: string[] = [];
  let current: unknown = cause;
  for (let depth = 0; current !== null && current !== undefined && depth < 6; depth += 1) {
    const text = describeOne(current).trim();
    if (text && text !== 'Error' && !parts.includes(text)) parts.push(text);
    current = (current as { cause?: unknown }).cause;
  }
  return parts.join(' — ');
}

/** Raised when the proof itself could not be produced. */
export class ProofFailedError extends Error {
  constructor(cause?: unknown) {
    const detail = describe(cause);
    super(detail ? `The proof could not be produced: ${detail}` : 'The proof could not be produced.');
    this.name = 'ProofFailedError';
    this.cause = cause;
  }
}

/** Raised when the app is running against a build with no contract address. */
export class ContractNotDeployedError extends Error {
  constructor() {
    super('This build has no contract address yet. Set VITE_CONTRACT_ADDRESS and rebuild.');
    this.name = 'ContractNotDeployedError';
  }
}

/**
 * Casts one ballot.
 *
 * `option` is the private input. It is passed straight into proof generation
 * and is never logged, stored, or returned.
 */
/**
 * The witness the contract asks for. It reads the ballot out of private state
 * and hands it to the prover. Nothing here writes, logs or returns it.
 */
const witnesses = {
  secretBallot: ({
    privateState,
  }: WitnessContext<Ledger, CepushPrivateState>): [CepushPrivateState, bigint] => [
    privateState,
    BigInt(privateState.ballot),
  ],
};

// The assets path names the folder the compiled circuits live in. In the
// browser the artefacts are fetched over HTTP by the zk config provider, which
// already knows its own base URL, so this only has to identify the contract.
const compiledContract = CompiledContract.make('cepush', Contract).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets('cepush'),
);

export async function castVote(session: WalletSession, option: number): Promise<VoteOutcome> {
  if (!isDeployed()) throw new ContractNotDeployedError();
  if (!Number.isInteger(option) || option < 0 || option >= POLL.options.length) {
    // Mirrors the circuit's own range check, so an impossible ballot never
    // reaches the prover. The circuit remains the authority.
    throw new ProofFailedError(new Error('ballot is outside the poll range'));
  }

  const providers = createProviders(session);

  try {
    await resetPrivateStore(providers.privateStateProvider);
    const contract = await findDeployedContract(providers, {
      compiledContract,
      contractAddress: CONTRACT_ADDRESS,
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState: { ballot: option },
    });

    // `vote` takes no arguments: the ballot travels as a witness, so the call
    // itself carries nothing about the choice.
    const result = await contract.callTx.vote();
    return { txId: result.public.txId };
  } catch (e) {
    throw new ProofFailedError(e);
  } finally {
    // The ballot has served its purpose. Drop it, whatever happened.
    await providers.privateStateProvider.remove(PRIVATE_STATE_ID).catch(() => undefined);
  }
}

/**
 * Puts a fresh poll on chain.
 *
 * A one-shot bootstrap, not a feature: the app needs an address to point at,
 * and the connected wallet is already able to pay for it. Both constructor
 * arguments are public poll metadata.
 */
export async function deployPoll(session: WalletSession): Promise<string> {
  const providers = createProviders(session);
  await resetPrivateStore(providers.privateStateProvider);

  const deployed = await deployContract(providers, {
    compiledContract,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: { ballot: 0 },
    args: [POLL.title, BigInt(POLL.options.length)],
  });

  // The bootstrap ballot was never voted, but leave nothing behind regardless.
  await providers.privateStateProvider.remove(PRIVATE_STATE_ID).catch(() => undefined);

  return deployed.deployTxData.public.contractAddress;
}

/** The public side of the poll, exactly as anyone reading the chain sees it. */
export type PublicTally = {
  readonly title: string;
  readonly counts: readonly bigint[];
  readonly totalVotes: bigint;
};

/**
 * Reads the poll's public ledger state from the indexer.
 *
 * Everything returned here is public by design. There is no private input to
 * read and nothing about any individual ballot to find: the ledger holds the
 * per-option counters and the total, and that is all.
 */
export async function readTally(session: WalletSession): Promise<PublicTally | null> {
  if (!isDeployed()) throw new ContractNotDeployedError();

  const { publicDataProvider } = createProviders(session);
  const state = await publicDataProvider.queryContractState(CONTRACT_ADDRESS);
  if (state === null) return null;

  const view = ledger(state.data);
  const counts: bigint[] = [];
  for (let i = 0n; i < view.optionCount; i += 1n) {
    counts.push(view.tallies.member(i) ? view.tallies.lookup(i).read() : 0n);
  }
  return { title: view.title, counts, totalVotes: view.totalVotes };
}
