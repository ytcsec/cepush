/**
 * Where the app meets the contract.
 *
 * The ballot never appears in this module's inputs as a circuit argument. It is
 * handed to the witness at proof time and dropped immediately afterwards.
 */
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';

/** Filled in after the Preprod deploy. Empty means "not wired up yet". */
export const CONTRACT_ADDRESS: string = import.meta.env.VITE_CONTRACT_ADDRESS ?? '';

/** Where the compiled proving keys and zkir are served from. */
export const ZK_CONFIG_BASE: string = import.meta.env.VITE_ZK_CONFIG_BASE ?? '/managed/cepush';

export const isDeployed = (): boolean => CONTRACT_ADDRESS.trim().length > 0;

/** The poll this build points at. Public information, safe to hard-code. */
export const POLL = {
  title: 'Should the DAO fund the summer meetup?',
  options: ['Yes', 'No', 'Abstain'],
} as const;

export type VoteOutcome = {
  readonly txId: string;
};

/** Raised when the proof itself could not be produced. */
export class ProofFailedError extends Error {
  constructor(cause?: unknown) {
    super(
      cause instanceof Error
        ? `The proof could not be produced: ${cause.message}`
        : 'The proof could not be produced.',
    );
    this.name = 'ProofFailedError';
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
export async function castVote(_api: ConnectedAPI, option: number): Promise<VoteOutcome> {
  if (!isDeployed()) throw new ContractNotDeployedError();
  if (!Number.isInteger(option) || option < 0 || option >= POLL.options.length) {
    // Mirrors the circuit's own range check, so an impossible ballot never
    // reaches the prover. The circuit remains the authority.
    throw new ProofFailedError(new Error('ballot is outside the poll range'));
  }

  throw new ContractNotDeployedError();
}
