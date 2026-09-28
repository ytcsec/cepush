/**
 * Test harness for the cepush contract.
 *
 * Drives the compiled circuits in-process, without a node and without a proof
 * server, so the suite stays fast. Requires `npm run compact` to have produced
 * `managed/cepush` first.
 */
import { randomBytes } from 'node:crypto';

import {
  type CircuitContext,
  createCircuitContext,
  createConstructorContext,
  fromHex,
  sampleContractAddress,
  toHex,
  type WitnessContext,
} from '@midnight-ntwrk/compact-runtime';

import {
  Contract,
  ledger,
  pureCircuits,
  type Ledger,
} from '../managed/cepush/contract/index.js';

/**
 * Everything the voter keeps to themselves. This object never leaves the local
 * process: it feeds proof generation and nothing else.
 */
export type CepushPrivateState = {
  /** The chosen option index. Private. */
  readonly ballot: number;
  /** The voter key, 32 bytes as hex. Private. */
  readonly voterSecret: string;
};

/**
 * Witness implementations. The contract asks for `secretBallot()` and
 * `voterSecret()`; we answer from private state. There is no path from here
 * into the ledger except through the circuit's own `disclose()`.
 */
export const witnesses = {
  secretBallot: ({
    privateState,
  }: WitnessContext<Ledger, CepushPrivateState>): [CepushPrivateState, bigint] => [
    privateState,
    BigInt(privateState.ballot),
  ],
  voterSecret: ({
    privateState,
  }: WitnessContext<Ledger, CepushPrivateState>): [CepushPrivateState, Uint8Array] => [
    privateState,
    fromHex(privateState.voterSecret),
  ],
};

/** A fresh voter key, the same way the app mints one. */
export const newVoterSecret = (): string => randomBytes(32).toString('hex');

/** Any well-formed key will do: the contract never looks at who is submitting. */
const COIN_PUBLIC_KEY = '0'.repeat(64);

export class CepushSimulator {
  readonly contract: Contract<CepushPrivateState, typeof witnesses>;
  readonly address: string;
  circuitContext: CircuitContext<CepushPrivateState>;

  constructor(
    title: string,
    optionCount: number,
    ballot: number,
    voterSecret: string = newVoterSecret(),
    address: string = sampleContractAddress(),
  ) {
    this.contract = new Contract<CepushPrivateState, typeof witnesses>(witnesses);
    this.address = address;

    const { currentPrivateState, currentContractState } = this.contract.initialState(
      createConstructorContext<CepushPrivateState>({ ballot, voterSecret }, COIN_PUBLIC_KEY),
      title,
      BigInt(optionCount),
    );

    this.circuitContext = createCircuitContext<CepushPrivateState>(
      address,
      COIN_PUBLIC_KEY,
      currentContractState,
      currentPrivateState,
    );
  }

  /** The public ledger, decoded. This is what the whole world can see. */
  public getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  /** The local private state. This is what nobody else can see. */
  public getPrivateState(): CepushPrivateState {
    return this.circuitContext.currentPrivateState;
  }

  /** Same voter, different ballot. */
  public withBallot(ballot: number): this {
    return this.as({ ...this.getPrivateState(), ballot });
  }

  /** A different voter: a fresh key casting the given ballot. */
  public asNewVoter(ballot: number): this {
    return this.as({ ballot, voterSecret: newVoterSecret() });
  }

  /** Swap in a whole private state, i.e. act as a specific voter. */
  public as(privateState: CepushPrivateState): this {
    this.circuitContext = { ...this.circuitContext, currentPrivateState: privateState };
    return this;
  }

  /** Cast one ballot and keep the resulting context. */
  public vote(): Ledger {
    this.voteRaw();
    return this.getLedger();
  }

  /** Cast one ballot and return the raw circuit result, proof data included. */
  public voteRaw() {
    const result = this.contract.impureCircuits.vote(this.circuitContext);
    this.circuitContext = result.context;
    return result;
  }

  /** Every tally, as plain numbers, indexed by option. */
  public tallies(optionCount: number): number[] {
    const state = this.getLedger();
    return Array.from({ length: optionCount }, (_, i) =>
      Number(state.tallies.lookup(BigInt(i)).read()),
    );
  }

  /** Every spent nullifier, as hex. */
  public nullifiers(): string[] {
    return Array.from(this.getLedger().nullifiers, (n) => toHex(n));
  }

  /** The nullifier a voter key spends in this poll, computed off-chain. */
  public nullifierFor(voterSecret: string): string {
    return toHex(pureCircuits.nullifierOf(fromHex(this.address), fromHex(voterSecret)));
  }
}
