# cepush

**Private, verifiable voting for communities on Midnight.**

[![ci](https://github.com/ytcsec/cepush/actions/workflows/ci.yml/badge.svg)](https://github.com/ytcsec/cepush/actions/workflows/ci.yml)

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

The full proposal (problem, users, design, roadmap and known limits) is in
[PROPOSAL.md](PROPOSAL.md).

---

## Contract address

| Network | Address | Deployed |
|---------|---------|----------|
| Preprod | `ac616d0ed7625c97c6188df5253077ce140ac64d73390ae925631caf4e3533ba` | 2026-09-28, block 2748944 |

Deploy transaction: `a520da081cf7683a29314635b622a9177b1521ed991cfc35abfcc11b4fa2049f`

This is the L3 contract, with the nullifier. The live demo points at it. Anyone can
check the address against the public Preprod indexer:

```bash
curl -s -X POST https://indexer.preprod.midnight.network/api/v3/graphql   -H 'content-type: application/json'   -d '{"query":"{ contractAction(address: \"ac616d0ed7625c97c6188df5253077ce140ac64d73390ae925631caf4e3533ba\") { __typename transaction { hash block { height } } } }"}'
```

Earlier deployments, kept for the record:

| Level | Address | Deployed | Notes |
|---|---|---|---|
| L1–L2 | `b0f8fe543f922416660dabd54d9cf6ff3041dca2fcc9386ce6bd9fa9848a3c86` | 2026-09-25, block 2707858 | no nullifier; first browser `vote` at block 2708080, tx `4a465bbc1e36afaf6b17bacda808a29486f27b2184c709340905da52d6e3695c` |
Progress against the level roadmap is tracked in [STATUS.md](STATUS.md).

## Live demo and video

| | Link |
|---|---|
| Live demo | https://cepush.vercel.app |
| Demo video — wallet connect and a circuit call | https://www.youtube.com/watch?v=cn8_Vk-XAms |

---

## What is private and what is public

| Data point | Where it lives | Who sees it |
|---|---|---|
| Poll title and option count | Public ledger | Everyone |
| Per-option tally counters | Public ledger | Everyone |
| Total ballots counted | Public ledger | Everyone |
| Nullifier set (double-vote guard) | Public ledger | Everyone, unlinkable to any wallet |
| The ballot (which option you picked) | Private witness | Never reaches the contract |
| Your voter key | Private witness | Never leaves your device |

The contract calls `disclose()` four times, for three purposes:

1. **Poll metadata** in the constructor — `title` and `optionCount`. A poll nobody can
   read is not a poll.
2. **The nullifier** in `vote` — a one-way hash of your voter key and the poll's
   address. It lets the contract refuse a second ballot from the same key without
   learning whose key it is.
3. **The tally increment** in `vote` — the option index, used as the counter key. A
   tally nobody can read is not verifiable.

Nothing else crosses from private into public. The ballot and the voter key reach the
circuit as witnesses, not as call arguments, so neither appears in the transaction.

### One vote each: the nullifier

Every wallet gets a **voter key**: 32 random bytes, minted the first time it votes and
kept in this browser. When you vote, the circuit computes

```
nullifier = persistentHash("cepush:nullifier:v1", pollAddress, voterKey)
```

and publishes it. If that nullifier is already on the ledger, the circuit refuses the
ballot, so the same key can never count twice. Nobody can work backwards from a
nullifier to a key, and because the poll's address is part of the hash, the same key
gives unrelated nullifiers in different polls.

The app computes the same nullifier locally with the contract's exported `nullifierOf`
circuit, so if this wallet has already voted it says so before asking Lace for anything.

The key cannot come from a wallet signature: Midnight signatures are randomised, so
signing the same message twice gives two different results. That is why it is minted
once and stored instead.

### What this level does not do yet

- **Voter keys are not tied to members yet.** The contract guarantees one ballot per
  key, and the app keeps one key per wallet in each browser. Someone who clears site
  data or switches browser gets a fresh key. The allowlist at L4 closes this: the poll
  will hold commitments to enrolled keys, and `vote` will prove its key is one of them.
- **No unlinkability of the tally delta.** The tallies are plaintext counters, so the
  state delta of a single vote transaction shows which counter moved, and the wallet
  that submitted it is visible on chain. The ballot is out of the proof and out of the
  call arguments, but not out of a ledger diff taken around one transaction.

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
export ledger nullifiers: Set<Bytes<32>>;

witness secretBallot(): Uint<8>;
witness voterSecret(): Bytes<32>;

export pure circuit nullifierOf(pollId: Bytes<32>, secret: Bytes<32>): Bytes<32> {
  return persistentHash<Vector<3, Bytes<32>>>([pad(32, "cepush:nullifier:v1"), pollId, secret]);
}

export circuit vote(): [] {
  const choice = secretBallot();
  assert(choice < optionCount, "ballot is outside the poll's option range");

  const spent = disclose(nullifierOf(kernel.self().bytes, voterSecret()));
  assert(!nullifiers.member(spent), "this voter key has already voted in this poll");
  nullifiers.insert(spent);

  tallies.lookup(disclose(choice)).increment(1);
  totalVotes.increment(1);
}
```

`vote` takes no parameters. That is the point: the choice and the voter key come from
the voter's local witnesses, so the transaction carries a proof, a nullifier, and
nothing else.

---

## The app

A React + Vite frontend talks to Lace through the DApp Connector API (v4.0.1).

The interface is dark, warm ink with a brass accent: Playfair Display for statements,
Inter for reading, JetBrains Mono for hashes and addresses. Icons are one inline SVG set,
focus rings are always visible, and motion is switched off for anyone who asks their
system for reduced motion. It is laid out for a phone first and widens to two columns.

```
src/
├── lib/wallet.ts          discovery, connect, typed errors
├── lib/providers.ts       the six Midnight.js providers, and the wallet bridge
├── lib/contract.ts        deploy, vote, the witnesses, the already-voted check
├── lib/voterKey.ts        one private voter key per wallet
├── hooks/useWallet.ts     connect / disconnect as React state
├── components/
│   ├── WalletConnect.tsx  wallet panel and every error state
│   ├── DeployPanel.tsx    one-shot deploy, only while there is no address
│   ├── CircuitCall.tsx    the ballot panel and its receipt
│   ├── PublicLedger.tsx   the poll's public state, charted from the indexer
│   └── Icon.tsx           the svg icon set and the brand mark
└── App.tsx
```

**Wallet discovery.** Connector v4 wallets register under `window.midnight` keyed by a
freshly minted UUID, not under a fixed name, so the app enumerates rather than
reaching for `window.midnight.mnLace`. Extensions inject themselves whenever they get
around to it, so discovery polls briefly instead of deciding on the first render that
no wallet exists.

**Connect and disconnect.** Connecting calls `wallet.connect(networkId)` and then checks
`getConnectionStatus()` really landed on the network this build targets. The connector
exposes no revoke call, so disconnecting means the app forgets the session it was
handed; permissions live in the wallet itself.

**Error states.** No wallet installed, request declined, network mismatch, proof
failure, and unknown wallet errors each get their own message rather than a generic
failure.

**Providers.** Midnight.js needs six: private state, public data, zk config, proof,
wallet and midnight. The wallet itself supplies the indexer and proof-server endpoints
through `getConfiguration()`, so the app is not separately configured with them. The
last two have no adapter in the SDK — the connector takes and returns serialised
transaction strings while Midnight.js works with ledger `Transaction` objects — so that
translation lives in `src/lib/providers.ts`.

**Voting.** First the app computes this wallet's nullifier and looks it up in the
public set; if it is there, the ballot panel locks and says why. Otherwise
`findDeployedContract`, then `callTx.vote()`. The circuit takes no arguments at all: the
ballot and the voter key reach it as witnesses.

### The privacy claim, in the UI

The ballot is held in component state, and in the private state store for exactly as
long as proving takes — written immediately before, deleted immediately after, under a
password that exists only in memory for that page load. It is never written to a log,
never rendered back, and never sent as a circuit argument. The panel says so, next to
the button that uses it:

> **Proved without revealing your input.** Your choice stays on this device and is never
> sent to the contract.

### Seeing it for yourself

The claim is not only a sentence on the page. Two things in the app let anyone check it:

1. **The receipt.** After a ballot is accepted, the app shows the transaction id, the
   nullifier it spent, the arguments the circuit was called with — none, `vote()` takes
   no parameters — and where the ballot went: nowhere outside the device.
2. **What the chain can see.** A second panel reads the poll's entire public state
   straight from the Preprod indexer: one counter per option, the total, and how many
   nullifiers have been spent. It re-reads after every ballot. There is no field that
   holds a ballot or a voter, because the contract has none.

Anyone can look the transaction up in a Preprod explorer and find the same thing: a
proof, and no ballot.

That claim is exactly as strong as the contract behind it, which means it is subject to
the limits in *What this level does not do yet* above: the ballot stays out of the proof
and out of the call arguments, but the tally counters are public, so a ledger diff taken
around a single transaction still shows which counter moved.

---

## Running it

The toolchain ships Linux and macOS binaries only, so the repository carries a Docker
image definition. The build is then identical on every platform, Windows included, and
Docker is the only prerequisite.

```bash
docker build -f docker/toolchain.Dockerfile -t cepush-toolchain .
docker run --rm -v "$PWD:/work" cepush-toolchain bash docker/verify.sh
```

`verify.sh` prints the compiler version, compiles the contract, lists the artefacts it
produced and runs the tests — everything below, in one command.

The build is pinned end to end:

| Component | Version |
|---|---|
| Compact compiler | 0.31.1 |
| Compact language | 0.23.0 |
| Compact runtime | 0.16.0 |
| Node.js | 22 |

### Native toolchain

On Linux, macOS, or WSL2:

```bash
curl --proto '=https' --tlsv1.2 -LsSf   https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
compact update 0.31
compact --version
```

> Pin to 0.31. The newer 0.34 compiler targets ledger 9, which is not deployed on the
> public networks yet.

Then, with Node 22 (`nvm use` picks it up from `.nvmrc`):

```bash
npm install
npm run compact             # compiles to managed/cepush
npm test                    # 17 tests across logic, state, nullifier and privacy
```

For the frontend:

```bash
cp .env.example .env        # set VITE_CONTRACT_ADDRESS once deployed
npm run dev                 # http://localhost:5173
npm run build               # tsc --noEmit && vite build, zero errors
```

### Publishing the live demo

The live demo runs at https://cepush.vercel.app. `vercel.json` holds the hosting
config; the Vercel project sets `VITE_NETWORK_ID=preprod` and
`VITE_CONTRACT_ADDRESS=<the Preprod address>` as environment variables. The build emits the proving keys and zkir under
`/managed/cepush`, so the site needs nothing else.

Voting from the live site still needs Lace on Preprod and a proof server the wallet can
reach — Lace's own setting, `http://localhost:6300` by default.

Windows has no native build of the toolchain — use the Docker route above, or WSL2.
See **[docs/SETUP-WINDOWS.md](docs/SETUP-WINDOWS.md)**.

### Proof server

Required for deploys and for voting. It runs as a background container that comes back
after a reboot, so this is a one-time command:

```bash
npm run proof-server         # start it, detached, on :6300
npm run proof-server:status  # {"status":"ok", ...}
npm run proof-server:stop    # remove it
```

### Funding a wallet on Preprod

1. Switch Lace to **Preprod** and copy the **unshielded** address — it starts
   `mn_addr_preprod1`. The app shows it with a copy button once connected.
   The faucet rejects shielded and DUST addresses.
2. Request tokens at the [Preprod faucet](https://midnight-tmnight-preprod.nethermind.dev/).
3. In Lace, use **Generate tDUST** to register the NIGHT you just received.

That third step is easy to miss. The faucet sends tNIGHT, fees are paid in tDUST, and
NIGHT that has not been registered generates no DUST — so an apparently funded wallet
still cannot pay for a transaction.

---

## Tests

Seventeen tests, all passing, driving the compiled circuits in-process — no node and no
proof server, so the suite finishes in seconds.

| Suite | Tests | Covers |
|---|---|---|
| circuit logic | 3 | only the chosen option increments, by one; out-of-range ballots are rejected; a poll needs at least two options |
| state transition | 3 | the ledger after a sequence of votes; metadata stays stable; counters always sum to `totalVotes` |
| privacy | 4 | the ballot never reaches the ledger, the circuit returns nothing, the private state stays local, vote order is unrecoverable |
| nullifier | 4 | a second ballot from the same key is refused; distinct keys each count once; the published nullifier matches the off-chain one; the set is as large as the vote count |
| nullifier privacy | 3 | the voter key never reaches public state; one key gives unrelated nullifiers in two polls; the ballot has no influence on the nullifier |

## Continuous integration

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push and pull
request:

1. installs the pinned 0.31 Compact compiler,
2. recompiles the contract from source and **fails if the committed `managed/`
   artefacts differ**. Compilation is deterministic, so a diff means the committed
   circuits or keys are stale,
3. runs the test suite,
4. type-checks and builds the app.

---

## Licence

MIT. See [LICENSE](LICENSE).
