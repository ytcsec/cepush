# STATUS

**Current level: L2 — frontend, Lace on Preprod**
Last updated: 2026-09-25

> **Deployed to Preprod on 2026-09-25** at `b0f8fe543f922416660dabd54d9cf6ff3041dca2fcc9386ce6bd9fa9848a3c86` (block 2707858). L1 is closed.

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
| 2 | Circuit called successfully from the frontend | ◐ deploy proved and submitted from the browser; a live `vote` still to run |
| 3 | An observable privacy behaviour | ✓ done — the ballot is a witness, never an argument |
| 4 | Contract deployed to Preprod, verifiable address | ✓ verified against the indexer |
| 5 | Minimum 8 meaningful commits | ✓ |

## L2 — submission checklist

| # | Item | State |
|---|------|-------|
| 1 | Public GitHub repository with README | ✓ |
| 2 | Live demo link | ◐ `vercel.json` ready — import the repo in Vercel once (4) lands |
| 3 | Deployed Preprod address, verifiable on-chain | ✓ |
| 4 | Demo video: wallet connect + successful circuit call | ✗ blocked — owner |
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
- **Vote** — `findDeployedContract`, then `callTx.vote()`. The circuit takes no
  arguments: the ballot travels as a witness.
- **Receipt** — after a ballot is accepted: the transaction id, the circuit arguments
  (none), and where the ballot went (nowhere).
- **Public ledger panel** — reads the poll's whole public state from the indexer and
  re-reads after every ballot. This is the observable half of the privacy claim.
- **The ballot** — written to private state immediately before proving and deleted
  immediately after, under a password that exists only in memory for that page load.
  Never logged, never rendered back, never sent as an argument.

### How far this is verified

| Layer | Evidence |
|---|---|
| Contract logic | 10 tests, passing |
| Compile | exit 0, artefacts committed |
| Types across the whole SDK surface | `tsc --noEmit` clean |
| Bundle, WebAssembly included | `vite build` clean |
| Artefact URLs | provider expects `keys/<id>.prover` and `zkir/<id>.bzkir`; the build emits exactly that |
| Deploy from the browser | ✓ proved, balanced by Lace and accepted at block 2707858 |
| **A live `vote` call** | **not yet** — the next owner step |

---

## Remaining owner steps

1. **Cast a ballot from the app** — connect Lace, pick an option, *Cast ballot*. The
   receipt and the public tally panel should both update. This closes L2 requirement 2.
   Keep Docker running: the proof server lives in it.
2. **Publish the live demo** — import the repository in Vercel with
   `VITE_NETWORK_ID=preprod` and
   `VITE_CONTRACT_ADDRESS=b0f8fe543f922416660dabd54d9cf6ff3041dca2fcc9386ce6bd9fa9848a3c86`,
   then put the URL in the README.
3. **Record the demo video** — connect Lace, cast a ballot, show the receipt and the
   tally moving. Link it in the README.

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
