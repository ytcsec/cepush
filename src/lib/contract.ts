/**
 * Where the app meets the contract.
 *
 * The ballot never appears in this module's inputs as a circuit argument. It is
 * handed to the witness at proof time and dropped immediately afterwards.
 */
import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import * as CompiledContract from '@midnight-ntwrk/compact-js/effect/CompiledContract';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';

import { Contract, type Ledger } from '../../managed/cepush/contract/index.js';
import {
  createProviders,
  PRIVATE_STATE_ID,
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

export function describe(cause: unknown): string {
  const parts: string[] = [];
  let current: unknown = cause;
  for (let depth = 0; current instanceof Error && depth < 5; depth += 1) {
    if (current.message && !parts.includes(current.message)) parts.push(current.message);
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
