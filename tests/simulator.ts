/**
 * Test harness for the cepush contract.
 *
 * Drives the compiled circuits in-process, without a node or a proof server, so
 * the test suite stays fast. Requires `npm run compact` to have produced
 * `managed/cepush` first.
 */
import {
  type CircuitContext,
  QueryContext,
  constructorContext,
  emptyZswapLocalState,
  sampleContractAddress,
  type WitnessContext,
} from '@midnight-ntwrk/compact-runtime';

import {
  Contract,
  ledger,
  type Ledger,
} from '../managed/cepush/contract/index.cjs';

/**
 * Everything the voter keeps to themselves. This object never leaves the
 * local process: it feeds proof generation and nothing else.
 */
export type CepushPrivateState = {
  /** The chosen option index. Private. */
  readonly ballot: number;
};

/**
 * Witness implementations. The contract asks for `secretBallot()`; we answer
 * from private state. Note there is no path from here into the ledger except
 * through the circuit's own `disclose()`.
 */
export const witnesses = {
  secretBallot: ({
    privateState,
  }: WitnessContext<Ledger, CepushPrivateState>): [CepushPrivateState, bigint] => [
    privateState,
    BigInt(privateState.ballot),
  ],
};

const ZERO_NONCE = '0'.repeat(64);

export class CepushSimulator {
  readonly contract: Contract<CepushPrivateState, typeof witnesses>;
  circuitContext: CircuitContext<CepushPrivateState>;

  constructor(title: string, optionCount: number, ballot: number) {
    this.contract = new Contract<CepushPrivateState, typeof witnesses>(witnesses);

    const { currentPrivateState, currentContractState, currentZswapLocalState } =
      this.contract.initialState(
        constructorContext({ ballot }, ZERO_NONCE),
        title,
        BigInt(optionCount),
      );

    this.circuitContext = {
      currentPrivateState,
      currentZswapLocalState,
      originalState: currentContractState,
      transactionContext: new QueryContext(
        currentContractState.data,
        sampleContractAddress(),
      ),
    };
  }

  /** The public ledger, decoded. This is what the whole world can see. */
  public getLedger(): Ledger {
    return ledger(this.circuitContext.transactionContext.state);
  }

  /** The local private state. This is what nobody else can see. */
  public getPrivateState(): CepushPrivateState {
    return this.circuitContext.currentPrivateState;
  }

  /** Swap in a different ballot, i.e. simulate a different voter. */
  public withBallot(ballot: number): this {
    this.circuitContext = {
      ...this.circuitContext,
      currentPrivateState: { ballot },
      currentZswapLocalState: emptyZswapLocalState(0),
    };
    return this;
  }

  /** Cast one ballot and keep the resulting context. */
  public vote(): Ledger {
    const result = this.contract.impureCircuits.vote(this.circuitContext);
    this.circuitContext = result.context;
    return this.getLedger();
  }

  /** Cast one ballot and return the raw circuit result, transcript included. */
  public voteRaw() {
    const result = this.contract.impureCircuits.vote(this.circuitContext);
    this.circuitContext = result.context;
    return result;
  }

  /** Every tally, as plain numbers, indexed by option. */
  public tallies(optionCount: number): number[] {
    const state = this.getLedger();
    return Array.from({ length: optionCount }, (_, i) =>
      Number(state.tallies.lookup(BigInt(i))),
    );
  }
}
