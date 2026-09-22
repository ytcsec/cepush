# cepush

**Private, verifiable voting for communities on Midnight.**

A DAO, a club or an online community can run a vote where the ballots stay secret
forever and the result is something anybody can check for themselves.

---

## The idea

Communities that vote on-chain today have to choose between two bad options. Either
the vote is public, and then people vote for what looks safe instead of what they
think — an uncomfortable proposal never gets an honest reading. Or the vote is run
off-chain in a spreadsheet somebody controls, and then nobody can verify the count.
cepush removes the choice. A member proves, in zero knowledge, that they are entitled
to vote and that their ballot is a legal option, without revealing which option they
picked and without revealing which member they are. The contract publishes only the
running totals. The ballots are never recorded anywhere, on-chain or off. Anyone can
recompute the result from public state; nobody can recompute who voted for what.

This maps to three items on the program's idea list — **Private Voting** as the core,
**Private Allowlist Access** for eligibility, and **Anonymous Feedback / Survey** for
the multi-option mode. Track: **Governance**.

---

## Contract address

| Network | Address | Deployed |
|---------|---------|----------|
| Preprod | `not yet deployed` | — |

> The address lands here with the first Preprod deploy. Progress against the level
> roadmap is tracked in [STATUS.md](STATUS.md).

---

## What is private and what is public

| Data point | Where it lives | Who sees it |
|---|---|---|
| Poll title and option count | Public ledger | Everyone |
| Per-option tally counters | Public ledger | Everyone |
| Total ballots counted | Public ledger | Everyone |
| The ballot (which option you picked) | Private witness | No one |
| Voter identity | Never submitted | No one |

The contract calls `disclose()` in exactly two places, and both are deliberate:

1. **Poll metadata** in the constructor — a poll nobody can read is not a poll.
2. **The tally increment** in `vote` — a tally nobody can read is not verifiable.

Nothing else crosses from private into public. The ballot reaches the circuit as a
witness, not as a call argument, so it never appears in the transaction.

**Known limitation at this level.** The tallies are plaintext counters, so the state
delta of a single vote transaction shows which counter moved. The ballot is out of the
proof and out of the call arguments, but not out of a ledger diff taken around one
transaction. Breaking the wallet↔ballot link is what the nullifier (L3) and the
allowlist membership proof (L4) are for.

This product moves no money. There is no fund handling and no token transfer anywhere
in the contract, by design.

---

## The contract

`contracts/cepush.compact`

```compact
export ledger title: Opaque<"string">;
export ledger optionCount: Uint<8>;
export ledger tallies: Map<Uint<8>, Counter>;
export ledger totalVotes: Counter;

witness secretBallot(): Uint<8>;

export circuit vote(): [] {
  const choice = secretBallot();
  assert(choice < optionCount, "ballot is outside the poll's option range");
  tallies.lookup(disclose(choice)).increment(1);
  totalVotes.increment(1);
}
```

`vote` takes no parameters. That is the point: the choice comes from the voter's local
witness, so the transaction carries a proof and nothing else.

---

## Running it

### Prerequisites

- **Node.js 22** — pinned in `.nvmrc`, so `nvm use` picks it up
- **Docker**, running
- **Compact compiler**, on the 0.31 line:

```bash
curl --proto '=https' --tlsv1.2 -LsSf   https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
compact update 0.31
compact --version           # 0.31.x
```

> Pin to 0.31. The newer 0.34 compiler targets ledger 9, which is not deployed on the
> public networks yet.

On Windows there is no native build of the toolchain — it runs inside WSL2/Ubuntu.
Full steps: **[docs/SETUP-WINDOWS.md](docs/SETUP-WINDOWS.md)**.

### Build and test

```bash
npm install
npm run compact             # compiles to managed/cepush
npm test                    # 11 tests across logic, state and privacy
```

### Proof server

Required for deploys. Keep it running in its own terminal:

```bash
npm run proof-server        # docker, listens on :6300
```

---

## Tests

| Suite | Covers |
|---|---|
| circuit logic | only the chosen option increments, by one; out-of-range ballots are rejected |
| state transition | the ledger after a sequence of votes; counters always sum to `totalVotes` |
| privacy | the ballot never reaches the ledger, the circuit returns nothing, vote order is unrecoverable |

---

## Licence

MIT. See [LICENSE](LICENSE).
