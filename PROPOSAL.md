# cepush — proposal

**Private, verifiable voting for communities on Midnight.**
Track: Governance · Idea list: Private Voting, Private Allowlist Access, Anonymous
Feedback / Survey.

---

## 1. The problem

Communities that decide things together (DAOs, clubs, student societies, open-source
projects, online groups) have two ways to vote today, and neither works well.

**Public on-chain voting** is verifiable, but every ballot is tied to a wallet forever.
People vote for what looks safe rather than what they think. Large holders can see how
others voted before they vote themselves, members can be pressured or bribed and the
buyer can check the result, and an uncomfortable proposal never gets an honest reading.

**Off-chain voting** (a form, a spreadsheet, a chat poll, a hosted voting service) keeps
ballots out of public view, but only because somebody else holds them. The organiser
can read every ballot, change the count, or let a non-member vote, and nobody else can
check.

What communities actually want is the secrecy of a ballot box and the checkability of a
public ledger at the same time. Until zero-knowledge smart contracts, that was not on
offer.

## 2. The solution

cepush is a voting contract and a web app. A member of a community:

1. connects their Lace wallet,
2. picks an option,
3. proves, in zero knowledge and on their own machine, that the ballot is a legal
   option, that they are a member of the poll's allowlist, and that they have not voted
   before, without revealing which option or which member,
4. submits the proof. The contract increments one public counter and records one
   anonymous nullifier.

Anyone can read the result straight from the chain and check that the counters add up
and that no nullifier was spent twice. Nobody (not the organiser, not the chain, not
cepush) can tell who voted for what.

## 3. Who it is for

| User | What they get |
|---|---|
| DAO and community organisers | A vote whose result nobody has to take on trust, without exposing members |
| Members | A ballot that cannot be seen, sold or used against them |
| Researchers and moderators | Anonymous surveys and feedback with one response per member (the multi-option mode) |
| Observers | A tally anyone can recompute from public state |

## 4. How it works

### Privacy model

| Data point | Where it lives | Who sees it |
|---|---|---|
| Poll title, options | Public ledger | Everyone |
| Allowlist Merkle root (L4) | Public ledger | Everyone: the root only, never the list |
| Per-option tally counters | Public ledger | Everyone |
| Nullifier set | Public ledger | Everyone, unlinkable to any wallet |
| Voter key, allowlist position | Private witness | No one |
| The ballot | Private witness | No one |

`disclose()` is used for exactly three things: poll metadata, the tally increment, and
the nullifier. Anything else reaching the ledger, a circuit's return value, or another
contract would be a bug, and the test suite checks for it.

### The nullifier (shipped at L3)

Each voter holds a **voter key**, 32 random bytes that never leave their device. When
they vote, the circuit computes

```
nullifier = persistentHash("cepush:nullifier:v1", pollAddress, voterKey)
```

publishes it, and refuses the transaction if that nullifier is already in the public
set. The key stays a private witness; only its hash is disclosed. Because the poll's
address is part of the hash, the same person voting in two polls produces two
unrelated nullifiers, so their participation cannot be linked across polls.
`nullifierOf` is exported as a pure circuit, so the app computes the same value
off-chain and tells a voter they have already voted before asking the wallet for
anything.

Wallet signatures on Midnight are randomised (BIP-340 with auxiliary randomness), so
the key cannot be derived from a signature. The app mints it once per wallet and keeps
it in the browser's local storage, keyed by a hash of the wallet's public key.

### The allowlist (L4)

At L4 the poll creator publishes the Merkle root of a list of **commitments to voter
keys**, `commit = persistentHash("cepush:member:v1", voterKey)`. The `vote` circuit then
additionally proves that the commitment of the key it derives the nullifier from is a
leaf under that root. That closes the gap L3 leaves open, where anyone can mint a fresh
key: after L4, only keys that were enrolled can vote, each exactly once, and the
organiser still cannot tell which member cast which ballot. The L3 voter key is already
the right shape for this, so nothing about the key changes when the allowlist arrives.

### Architecture

```
Browser (React + Vite)                         Midnight Preprod
┌──────────────────────────────┐               ┌──────────────────────────┐
│ ballot + voter key (private) │               │ cepush contract          │
│        │                     │   proof +     │  title, optionCount      │
│        ▼                     │   nullifier   │  tallies[0..7]           │
│ witnesses → local proof ─────┼──────────────▶│  totalVotes              │
│   (proof server :6300)       │   via Lace    │  nullifiers: Set<Bytes32>│
│                              │               └────────────┬─────────────┘
│ public tally panel ◀─────────┼──── indexer (GraphQL) ◀────┘
└──────────────────────────────┘
```

- **Contract:** Compact 0.23 (compiler 0.31.1), `contracts/cepush.compact`.
- **App:** React 18, Vite 5, Midnight.js 4.1.1, DApp Connector API 4.0.1.
- **Proofs** are produced locally against a proof server on the voter's machine, so
  the ballot and key never leave it.
- **CI** recompiles the contract on every push, fails if the committed circuits and keys
  differ from the source, runs the test suite, and builds the app.

## 5. Why Midnight

The product needs three things at once: private inputs to a computation, a public and
tamper-proof result of that computation, and a proof connecting the two. Midnight is
built for exactly that split. Compact makes the private/public boundary explicit, since
every value that reaches the ledger passes through a visible `disclose()`, which makes
the privacy claim reviewable line by line instead of being a promise in the docs.
Midnight's own Request for Startups lists a "Midnight Voting System".

On a transparent chain the same product needs a custom ZK stack, a relayer to hide the
submitter, and trust in an off-chain coordinator. Here it is one small contract whose logic fits on
a screen.

## 6. Roadmap

| Level | Deliverable | Contract scope | State |
|---|---|---|---|
| L1 | Toolchain, first deploy, tests, README | Single poll, private ballot witness, public tally | ✓ done |
| L2 | React app, Lace connect, circuit call from the browser, live demo, video | Same contract, wired to the UI | ✓ done |
| L3 | CI/CD, polished UI, this proposal | Nullifier: one vote per voter key | ✓ built, awaiting Preprod redeploy |
| L4 | MVP on Preprod, usage guide | Allowlist Merkle proof, multiple polls, poll creation | planned |
| L5 | 50 Preprod users, feedback, iteration | Feedback-driven changes | planned |
| L6 | Redeploy, 20 onboarded users, launch | Hardening, optimisation | planned |

## 7. Known limits, stated plainly

- **Until L4, a voter key is not tied to a member.** L3 guarantees one ballot per key,
  and the app keeps one key per wallet per browser. Someone who clears site data or
  switches browsers gets a new key and can vote again. The allowlist closes this.
- **The tally delta of a single transaction is visible.** The counters are plaintext,
  so diffing the ledger around one vote shows which counter moved, and the submitting
  wallet is visible on chain. Hiding the delta needs commit-then-reveal tallies
  (encrypted or committed counters opened after the deadline) and is a candidate for
  L6 hardening.
- **A counted ballot is final.** There is no way to change or withdraw it. Vote
  changing would need the circuit to reverse an earlier increment without learning
  which counter it was, which is out of scope until the tallies themselves are hidden.
- **No money moves.** The contract holds no balance and makes no transfers, which keeps
  the attack surface to the vote itself.

## 8. What success looks like

- L4: a community can create its own poll, enrol members and run a vote end to end on
  Preprod without touching the command line.
- L5: 50 people have voted on Preprod, and their feedback is recorded in
  `docs/FEEDBACK.md` and acted on.
- L6: 20 real communities onboarded, with a tally anybody can check and no ballot
  anybody can read.

## 9. Team

Built and maintained by Yusuf Taha Çimen.
Repository: https://github.com/ytcsec/cepush · Live demo: https://cepush.vercel.app
