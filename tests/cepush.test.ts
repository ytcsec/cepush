import { describe, expect, it } from 'vitest';
import { CepushSimulator, newVoterSecret } from './simulator.js';

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
    poll.asNewVoter(2).vote();    // 2
    poll.asNewVoter(0).vote();    // 0
    poll.asNewVoter(1).vote();    // 1
    poll.asNewVoter(0).vote();    // 0

    expect(poll.tallies(OPTIONS)).toEqual([3, 1, 1]);
    expect(Number(poll.getLedger().totalVotes)).toBe(5);
  });

  it('keeps poll metadata stable across votes', () => {
    const poll = new CepushSimulator(TITLE, OPTIONS, 1);
    const optionCountBefore = Number(poll.getLedger().optionCount);

    poll.vote();
    poll.asNewVoter(2).vote();

    expect(Number(poll.getLedger().optionCount)).toBe(optionCountBefore);
    expect(Number(poll.getLedger().optionCount)).toBe(OPTIONS);
  });

  it('keeps the per-option counters summing to totalVotes', () => {
    const poll = new CepushSimulator(TITLE, OPTIONS, 2);

    poll.vote();
    poll.asNewVoter(1).vote();
    poll.asNewVoter(1).vote();

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
    forwards.asNewVoter(1).vote();
    forwards.asNewVoter(2).vote();

    const backwards = new CepushSimulator(TITLE, OPTIONS, 2);
    backwards.vote();
    backwards.asNewVoter(1).vote();
    backwards.asNewVoter(0).vote();

    expect(forwards.tallies(OPTIONS)).toEqual(backwards.tallies(OPTIONS));
    expect(Number(forwards.getLedger().totalVotes)).toBe(
      Number(backwards.getLedger().totalVotes),
    );
  });
});

describe('cepush — nullifier', () => {
  it('rejects a second ballot from the same voter key', () => {
    const poll = new CepushSimulator(TITLE, OPTIONS, 0);
    poll.vote();

    // Same key, even with a different choice: the nullifier is the same, so
    // the circuit refuses before any counter moves.
    expect(() => poll.withBallot(1).vote()).toThrow(/already voted/);
    expect(poll.tallies(OPTIONS)).toEqual([1, 0, 0]);
    expect(Number(poll.getLedger().totalVotes)).toBe(1);
  });

  it('accepts one ballot from each distinct voter key', () => {
    const poll = new CepushSimulator(TITLE, OPTIONS, 0);
    poll.vote();
    poll.asNewVoter(0).vote();
    poll.asNewVoter(2).vote();

    expect(poll.tallies(OPTIONS)).toEqual([2, 0, 1]);
    expect(poll.nullifiers()).toHaveLength(3);
    expect(new Set(poll.nullifiers()).size).toBe(3);
  });

  it('publishes exactly the nullifier the app computes off-chain', () => {
    // The app checks "have I voted already?" by computing the nullifier with
    // the exported pure circuit. That only works if it matches the one the
    // vote circuit writes.
    const secret = newVoterSecret();
    const poll = new CepushSimulator(TITLE, OPTIONS, 1, secret);
    poll.vote();

    expect(poll.nullifiers()).toEqual([poll.nullifierFor(secret)]);
  });

  it('keeps the nullifier set as large as the vote count', () => {
    const poll = new CepushSimulator(TITLE, OPTIONS, 2);
    poll.vote();
    poll.asNewVoter(1).vote();
    try {
      poll.vote(); // same key again, refused
    } catch {
      // expected
    }

    expect(BigInt(poll.nullifiers().length)).toBe(poll.getLedger().totalVotes);
  });
});

describe('cepush — nullifier privacy', () => {
  it('never publishes the voter key', () => {
    const secret = newVoterSecret();
    const poll = new CepushSimulator(TITLE, OPTIONS, 0, secret);
    poll.vote();

    const snapshot = JSON.stringify(
      { ledger: poll.getLedger(), nullifiers: poll.nullifiers() },
      (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
    );
    expect(snapshot).not.toContain(secret);
    expect(poll.nullifiers()[0]).not.toBe(secret);
  });

  it('gives the same voter key unrelated nullifiers in different polls', () => {
    // The poll id is part of the hash, so one person voting in two polls
    // cannot be matched across them from the public nullifier sets.
    const secret = newVoterSecret();
    const first = new CepushSimulator(TITLE, OPTIONS, 0, secret);
    const second = new CepushSimulator(TITLE, OPTIONS, 0, secret);
    expect(first.address).not.toBe(second.address);

    first.vote();
    second.vote();

    expect(first.nullifiers()[0]).not.toBe(second.nullifiers()[0]);
  });

  it('does not let the ballot influence the nullifier', () => {
    // If the choice were mixed into the nullifier, comparing nullifiers could
    // leak it. Two polls, same key and address, different ballots: same hash.
    const secret = newVoterSecret();
    const address = new CepushSimulator(TITLE, OPTIONS, 0).address;
    const yes = new CepushSimulator(TITLE, OPTIONS, 0, secret, address);
    const no = new CepushSimulator(TITLE, OPTIONS, 1, secret, address);

    yes.vote();
    no.vote();

    expect(yes.nullifiers()).toEqual(no.nullifiers());
  });
});
