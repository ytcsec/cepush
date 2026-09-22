import { describe, expect, it } from 'vitest';
import { CepushSimulator } from './simulator.js';

const TITLE = 'Should the DAO fund the summer meetup?';
const OPTIONS = 3; // 0 = yes, 1 = no, 2 = abstain

describe('cepush — circuit logic', () => {
  it('increments only the chosen option, by exactly one', () => {
    const poll = new CepushSimulator(TITLE, OPTIONS, 1);

    expect(poll.tallies(OPTIONS)).toEqual([0, 0, 0]);

    poll.vote();

    // Option 1 moved. Nothing else did.
    expect(poll.tallies(OPTIONS)).toEqual([0, 1, 0]);
    expect(Number(poll.getLedger().totalVotes)).toBe(1);
  });

  it('rejects a ballot outside the poll range', () => {
    // The poll has options 0..2; option 7 exists as a counter slot but is not
    // a legal ballot. The range check lives inside the circuit, so this must
    // fail at proof time rather than quietly land in the tally.
    const poll = new CepushSimulator(TITLE, OPTIONS, 7);

    expect(() => poll.vote()).toThrow();
    expect(poll.tallies(OPTIONS)).toEqual([0, 0, 0]);
    expect(Number(poll.getLedger().totalVotes)).toBe(0);
  });

  it('refuses to create a poll with fewer than two options', () => {
    expect(() => new CepushSimulator(TITLE, 1, 0)).toThrow();
  });
});

describe('cepush — state transition', () => {
  it('accumulates a sequence of ballots into the public tally', () => {
    const poll = new CepushSimulator(TITLE, OPTIONS, 0);

    poll.vote();                  // 0
    poll.withBallot(2).vote();    // 2
    poll.withBallot(0).vote();    // 0
    poll.withBallot(1).vote();    // 1
    poll.withBallot(0).vote();    // 0

    expect(poll.tallies(OPTIONS)).toEqual([3, 1, 1]);
    expect(Number(poll.getLedger().totalVotes)).toBe(5);
  });

  it('keeps poll metadata stable across votes', () => {
    const poll = new CepushSimulator(TITLE, OPTIONS, 1);
    const optionCountBefore = Number(poll.getLedger().optionCount);

    poll.vote();
    poll.withBallot(2).vote();

    expect(Number(poll.getLedger().optionCount)).toBe(optionCountBefore);
    expect(Number(poll.getLedger().optionCount)).toBe(OPTIONS);
  });

  it('keeps the per-option counters summing to totalVotes', () => {
    const poll = new CepushSimulator(TITLE, OPTIONS, 2);

    poll.vote();
    poll.withBallot(1).vote();
    poll.withBallot(1).vote();

    const sum = poll.tallies(OPTIONS).reduce((a, b) => a + b, 0);
    expect(sum).toBe(Number(poll.getLedger().totalVotes));
  });
});

describe('cepush — privacy', () => {
  it('never copies the private ballot into the public ledger', () => {
    // Use an option index that is easy to spot if it leaks verbatim.
    const poll = new CepushSimulator(TITLE, OPTIONS, 2);
    poll.vote();

    const snapshot = JSON.stringify(
      poll.getLedger(),
      (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
    );

    // The ledger must expose the poll and the aggregates, and nothing named
    // after the witness that produced the ballot.
    expect(snapshot).not.toMatch(/secretBallot/i);
    expect(snapshot).not.toMatch(/ballot/i);
  });

  it('returns nothing from the vote circuit', () => {
    // `vote()` is declared to return `[]`. A circuit that returned the choice,
    // or anything derived from it, would export private data to the caller.
    const poll = new CepushSimulator(TITLE, OPTIONS, 1);
    const raw = poll.voteRaw();

    const returned = (raw as { result?: unknown }).result;
    expect(returned === undefined || (Array.isArray(returned) && returned.length === 0)).toBe(true);
  });

  it('leaves the private state in the voter local state, not on chain', () => {
    const poll = new CepushSimulator(TITLE, OPTIONS, 2);
    poll.vote();

    // Still held locally, unchanged: the circuit consumed it without moving it.
    expect(poll.getPrivateState().ballot).toBe(2);

    // And the ledger has no field carrying it.
    const state = poll.getLedger();
    expect(Object.keys(state)).not.toContain('ballot');
    expect(Object.keys(state)).not.toContain('secretBallot');
  });

  it('hides the order in which ballots were cast', () => {
    // Two different voting orders over the same multiset of ballots must be
    // indistinguishable in the public state. The tally is an aggregate; it
    // carries no history.
    const forwards = new CepushSimulator(TITLE, OPTIONS, 0);
    forwards.vote();
    forwards.withBallot(1).vote();
    forwards.withBallot(2).vote();

    const backwards = new CepushSimulator(TITLE, OPTIONS, 2);
    backwards.vote();
    backwards.withBallot(1).vote();
    backwards.withBallot(0).vote();

    expect(forwards.tallies(OPTIONS)).toEqual(backwards.tallies(OPTIONS));
    expect(Number(forwards.getLedger().totalVotes)).toBe(
      Number(backwards.getLedger().totalVotes),
    );
  });
});
