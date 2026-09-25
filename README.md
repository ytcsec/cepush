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
| Preprod | `b0f8fe543f922416660dabd54d9cf6ff3041dca2fcc9386ce6bd9fa9848a3c86` | 2026-09-25, block 2707858 |

Deploy transaction: `7d7b663fc1840747da6e0454edb47b8b178e8a3e9221a50a70f7511c69ee86f6`

Anyone can check the address against the public Preprod indexer:

```bash
curl -s -X POST https://indexer.preprod.midnight.network/api/v3/graphql   -H 'content-type: application/json'   -d '{"query":"{ contractAction(address: \"b0f8fe543f922416660dabd54d9cf6ff3041dca2fcc9386ce6bd9fa9848a3c86\") { __typename transaction { hash block { height } } } }"}'
```

It answers with a `ContractDeploy` at block 2707858. Progress against the level roadmap
is tracked in [STATUS.md](STATUS.md).

## Live demo and video

| | Link |
|---|---|
| Live demo | `not yet published` |
| Demo video — wallet connect and a circuit call | `not yet recorded` |

---

## What is private and what is public

| Data point | Where it lives | Who sees it |
|---|---|---|
| Poll title and option count | Public ledger | Everyone |
| Per-option tally counters | Public ledger | Everyone |
| Total ballots counted | Public ledger | Everyone |
| The ballot (which option you picked) | Private witness | Never reaches the contract |

The contract calls `disclose()` three times, for two purposes:

1. **Poll metadata** in the constructor — `title` and `optionCount`. A poll nobody can
   read is not a poll.
2. **The tally increment** in `vote` — the option index, used as the counter key. A
   tally nobody can read is not verifiable.

Nothing else crosses from private into public. The ballot reaches the circuit as a
witness, not as a call argument, so it never appears in the transaction's arguments.

### What this level does not do yet

The contract is deliberately small at L1, so it is worth being precise about what is
still missing:

- **No eligibility check.** Any caller can run `vote()`, as often as they like. The
  one-vote-per-member nullifier lands at L3, the allowlist membership proof at L4.
- **No unlinkability.** The tallies are plaintext counters, so the state delta of a
  single vote transaction shows which counter moved, and the wallet that submitted it
  is visible on chain. The ballot is out of the proof and out of the call arguments,
  but not out of a ledger diff taken around one transaction.

What L1 does establish is the shape the rest builds on: the ballot lives in a witness,
the range check runs inside the circuit against the private value, and only the
aggregate is ever published.

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

## The app

A React + Vite frontend talks to Lace through the DApp Connector API (v4.0.1).

```
src/
├── lib/wallet.ts          discovery, connect, typed errors
├── lib/providers.ts       the six Midnight.js providers, and the wallet bridge
├── lib/contract.ts        deploy, vote, and the witness
├── hooks/useWallet.ts     connect / disconnect as React state
├── components/
│   ├── WalletConnect.tsx  wallet panel and every error state
│   ├── DeployPanel.tsx    one-shot deploy, only while there is no address
│   ├── CircuitCall.tsx    the ballot panel and its receipt
│   └── PublicLedger.tsx   the poll's public state, read from the indexer
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

**Voting.** `findDeployedContract`, then `callTx.vote()`. The circuit takes no
arguments at all: the ballot reaches it as a witness, so the transaction carries a proof
and nothing else.

### The privacy claim, in the UI

The ballot is held in component state, and in the private state store for exactly as
long as proving takes — written immediately before, deleted immediately after, under a
password that exists only in memory for that page load. It is never written to a log,
never rendered back, and never sent as a circuit argument. The panel says so, next to
the button that uses it:

> 🛡 Proved without revealing your input — your choice stays on this device and is never
> sent to the contract.

### Seeing it for yourself

The claim is not only a sentence on the page. Two things in the app let anyone check it:

1. **The receipt.** After a ballot is accepted, the app shows the transaction id, the
   arguments the circuit was called with — none, `vote()` takes no parameters — and
   where the ballot went: nowhere outside the device.
2. **What the chain can see.** A second panel reads the poll's entire public state
   straight from the Preprod indexer: one counter per option and the total. It re-reads
   after every ballot. There is no field that holds a ballot, because the contract has
   none.

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
npm test                    # 10 tests across logic, state and privacy
```

For the frontend:

```bash
cp .env.example .env        # set VITE_CONTRACT_ADDRESS once deployed
npm run dev                 # http://localhost:5173
npm run build               # tsc --noEmit && vite build, zero errors
```

### Publishing the live demo

`vercel.json` holds the hosting config. Import the repository in Vercel, set
`VITE_NETWORK_ID=preprod` and `VITE_CONTRACT_ADDRESS=<the Preprod address>` as
environment variables, and deploy. The build emits the proving keys and zkir under
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

Ten tests, all passing, driving the compiled circuits in-process — no node and no
proof server, so the suite finishes in seconds.

| Suite | Tests | Covers |
|---|---|---|
| circuit logic | 3 | only the chosen option increments, by one; out-of-range ballots are rejected; a poll needs at least two options |
| state transition | 3 | the ledger after a sequence of votes; metadata stays stable; counters always sum to `totalVotes` |
| privacy | 4 | the ballot never reaches the ledger, the circuit returns nothing, the private state stays local, vote order is unrecoverable |

---

## Licence

MIT. See [LICENSE](LICENSE).
