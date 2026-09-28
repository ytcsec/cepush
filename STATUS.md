# STATUS

**Current level: L3 — nullifier, CI/CD, proposal**
Last updated: 2026-09-28

> L1 and L2 are closed. **The L3 contract is deployed to Preprod** at
> `ac616d0ed7625c97c6188df5253077ce140ac64d73390ae925631caf4e3533ba` (block 2748944, 2026-09-28), and the live demo points at it.
> The L2 contract at `b0f8fe543f922416660dabd54d9cf6ff3041dca2fcc9386ce6bd9fa9848a3c86` is retired.

---

## L3 — requirements to pass

| # | Requirement | State |
|---|-------------|-------|
| 1 | At least 3 tests, passing | ✓ 17/17 — logic, state, privacy, nullifier, nullifier privacy |
| 2 | CI/CD: compile and test on every push | ✓ `.github/workflows/ci.yml`, first run green ([36442219455](https://github.com/ytcsec/cepush/actions/runs/36442219455)) |
| 3 | Polished UI | ✓ already-voted state, nullifier in the receipt and the ledger panel, one-vote pillar, checked at 1280 / 900 / 390 px |
| 4 | `PROPOSAL.md` | ✓ |
| 5 | Idea submitted for approval | ✓ submitted on Rise In on 2026-09-28 (September Challenge, Private Voting), awaiting approval |
| 6 | Contract: nullifier, one vote per voter key | ✓ compiled, tested, deployed at block 2748944; on-chain state decodes with an empty `nullifiers` set |
| 7 | Minimum 10 meaningful commits | ✓ |

## L3 — submission checklist

| # | Item | State |
|---|------|-------|
| 1 | Public GitHub repository with complete README | ✓ |
| 2 | Live demo link | ✓ https://cepush.vercel.app, on the L3 contract |
| 3 | Screenshot: test output, 3+ tests passing | ✓ `docs/screenshots/tests.png`, 17 passing |
| 4 | CI/CD badge or workflow file with passing runs | ✓ badge in the README, runs green |
| 5 | Demo video (1 minute) showing full functionality | ✓ https://www.youtube.com/watch?v=x7eDJ8-1Jn0 |
| 6 | README "privacy model": what an observer can and cannot learn | ✓ |
| 7 | Product proposal from the idea list, submitted for approval | ✓ `PROPOSAL.md`, submitted on Rise In on 2026-09-28, awaiting approval |
| 8 | Minimum 10 meaningful commits | ✓ |

### What changed in the contract

- `witness voterSecret(): Bytes<32>` — a private voter key, never disclosed.
- `export pure circuit nullifierOf(pollId, secret)` —
  `persistentHash("cepush:nullifier:v1", pollId, secret)`.
- `export ledger nullifiers: Set<Bytes<32>>` — the public double-vote guard.
- `vote()` discloses `nullifierOf(kernel.self().bytes, voterSecret())`, refuses it if it
  is already in the set, inserts it, then counts the ballot as before.

### How far this is verified

| Layer | Evidence |
|---|---|
| Contract logic | 17 tests, passing, including double-vote refusal and cross-poll unlinkability |
| Off-chain nullifier = on-chain nullifier | test: the published value equals `pureCircuits.nullifierOf` |
| Compile is reproducible | a clean Linux checkout recompiles byte-identical `managed/`; CI enforces it |
| CI | green on GitHub Actions |
| App build | `tsc --noEmit` and `vite build` clean |
| Deployed state matches the compiled contract | ✓ indexer state decodes with the L3 `ledger()`: 3 options, 0 votes, 0 nullifiers, entry point `vote` |
| Live site on the new address | ✓ cepush.vercel.app bundle carries the new address and the nullifier code |
| Live vote against the new contract | ✓ block 2749236, tx `1a1b0e98…cf7f`; tally `[1, 0, 0]`, 1 ballot, 1 nullifier spent |

---

## L1 — carried over

| # | Requirement | State |
|---|-------------|-------|
| 1 | Toolchain installed, contract compiles | ✓ compiler 0.31.1 |
| 2 | Passing test suite | ✓ 10/10 |
| 3 | `managed/` directory (circuits + keys) | ✓ committed |
| 4 | Deployed to Preprod, address visible | ✓ block 2707858 |
| 5 | Initial product idea in the README | ✓ |
| 6 | Minimum 5 meaningful commits | ✓ |

## L2 — requirements to pass

| # | Requirement | State |
|---|-------------|-------|
| 1 | Lace connect / disconnect implemented | ✓ done |
| 2 | Circuit called successfully from the frontend | ✓ `vote` at block 2708080, from the browser through Lace |
| 3 | An observable privacy behaviour | ✓ done — the ballot is a witness, never an argument |
| 4 | Contract deployed to Preprod, verifiable address | ✓ verified against the indexer |
| 5 | Minimum 8 meaningful commits | ✓ |

## L2 — submission checklist

| # | Item | State |
|---|------|-------|
| 1 | Public GitHub repository with README | ✓ |
| 2 | Live demo link | ✓ https://cepush.vercel.app |
| 3 | Deployed Preprod address, verifiable on-chain | ✓ |
| 4 | Demo video: wallet connect + successful circuit call | ✓ https://www.youtube.com/watch?v=cn8_Vk-XAms |
| 5 | README documenting the privacy claim | ✓ |
| 6 | Minimum 8 meaningful commits | ✓ |

---

## What the frontend does

`npm run dev`, or `npm run build`. Both `tsc --noEmit` and `vite build` pass with zero
errors and no warnings.

- **Wallet discovery** — enumerates `window.midnight`, because connector v4 wallets
  register under a freshly minted UUID rather than a fixed key. Polls briefly, since
  extensions inject themselves after first render.
- **Connect** — `wallet.connect(networkId)`, then verifies `getConnectionStatus()`
  actually landed on the expected network.
- **Disconnect** — the connector exposes no revoke call, so the app forgets the session.
- **Error states** — no wallet, declined, network mismatch, proof failure, unknown.
- **Providers** — all six are built from the connected wallet. The wallet itself supplies
  the indexer and proof-server endpoints through `getConfiguration()`, so the app does
  not have to be configured with them separately.
- **The wallet bridge** — the connector speaks serialised transaction strings while
  Midnight.js speaks ledger `Transaction` objects, and the SDK ships no adapter. The
  translation is in `src/lib/providers.ts`.
- **Deploy** — a one-shot panel, shown only when the build has no contract address.
- **Vote** — first the wallet's nullifier is looked up in the public set; if it is
  there the ballot panel locks. Otherwise `findDeployedContract`, then `callTx.vote()`.
  The circuit takes no arguments: the ballot and the voter key travel as witnesses.
- **Voter key** — 32 random bytes per wallet, kept in local storage under a hash of the
  wallet's public key. Never rendered, logged or sent; only its nullifier leaves.
- **Receipt** — after a ballot is accepted: the transaction id, the spent nullifier, the
  circuit arguments (none), and where the ballot went (nowhere).
- **Public ledger panel** — reads the poll's whole public state from the indexer and
  re-reads after every ballot. This is the observable half of the privacy claim.
- **The ballot** — written to private state immediately before proving and deleted
  immediately after, under a password that exists only in memory for that page load.
  Never logged, never rendered back, never sent as an argument.

### How far L2 was verified

| Layer | Evidence |
|---|---|
| Contract logic | 10 tests, passing |
| Compile | exit 0, artefacts committed |
| Types across the whole SDK surface | `tsc --noEmit` clean |
| Bundle, WebAssembly included | `vite build` clean |
| Artefact URLs | provider expects `keys/<id>.prover` and `zkir/<id>.bzkir`; the build emits exactly that |
| Deploy from the browser | ✓ proved, balanced by Lace and accepted at block 2707858 |
| A live `vote` call | ✓ block 2708080, tx `4a465bbc…695c`; the public tally reads 1 |

---

## Remaining owner steps

None for L3. Every item on the submission checklist is met; the idea is waiting for
the committee's approval.

The first ballot on the L3 contract was cast from the live site through Lace and
checked by the owner.

---

## Verified toolchain

| Component | Version |
|---|---|
| Compact compiler | 0.31.1 |
| Compact language | 0.23.0 |
| Compact runtime | 0.16.0 |
| Midnight.js | 4.1.1 |
| DApp Connector API | 4.0.1 |
| Proof server | 8.1.0 |
| Node.js | 22 |

Matches the official support matrix for the 0.31.1 compiler line.

---

## Decisions log

- **2026-09-22** — The toolchain runs in Docker rather than WSL2. It pins the compiler,
  the language, the runtime and Node in one image definition, works the same on every
  platform, and needs no distro install.
- **2026-09-22** — Target compiler line is `compact update 0.31`. Compiler 0.34 exists
  but targets ledger 9, which is not deployed on public networks yet.
- **2026-09-22** — Compile output goes to `managed/` at the repository root, committed.
- **2026-09-22** — The wallet bridge is written against the SDK's own type definitions
  rather than from documentation, and the whole chain type-checks. That is evidence, not
  proof: it still has to meet a live network.
- **2026-09-22** — Deploying happens from the app through Lace rather than from a script
  with its own seed phrase. It reuses the provider bundle that already exists and keeps
  key material in the wallet, where it belongs.
- **2026-09-25** — The private state password is drawn from a mixed alphabet and checked
  against the SDK's own policy. Midnight.js 4.1.1 rejects passwords with fewer than three
  character classes, and the earlier hex password failed every deploy.
- **2026-09-25** — `onchain-runtime-v3` is pinned to 3.0.0 and hoisted to a single copy.
  Two copies in the bundle meant state read by Midnight.js failed the contract's own
  `instanceof` checks, so deploying worked and voting did not.
- **2026-09-28** — The voter key is minted once and stored, not derived from a wallet
  signature. Midnight signatures are BIP-340 with auxiliary randomness: signing the same
  message twice gave two different signatures in a direct test, so a derived key would
  change on every visit and allow a fresh vote each time.
- **2026-09-28** — The nullifier hashes in the poll's own address, so one voter key gives
  unrelated nullifiers in different polls. The L4 allowlist will commit to the same key,
  so nothing about the key changes when eligibility arrives.
- **2026-09-28** — CI recompiles the contract and fails on any diff in `managed/`.
  Compilation was checked to be byte-for-byte reproducible between the local toolchain
  image and a clean Linux checkout, so a diff can only mean stale artefacts.
