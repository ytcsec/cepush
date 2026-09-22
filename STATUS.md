# STATUS

**Current level: L2 — frontend, Lace on Preprod**
Last updated: 2026-09-22

> **L1 is not closed yet.** Its deploy requirement is still open, and L2 needs the same
> deploy. Only the highest *unbroken* level is rewarded, so the deploy is the single
> most valuable thing left to do. See *The one blocker* below.

---

## L1 — carried over

| # | Requirement | State |
|---|-------------|-------|
| 1 | Toolchain installed, contract compiles | ✓ compiler 0.31.1 |
| 2 | Passing test suite | ✓ 10/10 |
| 3 | `managed/` directory (circuits + keys) | ✓ committed |
| 4 | Deployed to Preprod, address visible | ✗ **blocked — owner** |
| 5 | Initial product idea in the README | ✓ |
| 6 | Minimum 5 meaningful commits | ✓ |

## L2 — requirements to pass

| # | Requirement | State |
|---|-------------|-------|
| 1 | Lace connect / disconnect implemented | ✓ done |
| 2 | Circuit called successfully from the frontend | ◐ **written and type-checked, not yet run live** |
| 3 | An observable privacy behaviour | ✓ done — the ballot is a witness, never an argument |
| 4 | Contract deployed to Preprod, verifiable address | ✗ **blocked — needs a funded wallet** |
| 5 | Minimum 8 meaningful commits | ✓ |

## L2 — submission checklist

| # | Item | State |
|---|------|-------|
| 1 | Public GitHub repository with README | ✓ |
| 2 | Live demo link | ✗ deploy the site once (4) lands |
| 3 | Deployed Preprod address, verifiable on-chain | ✗ blocked — owner |
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
| **A real circuit call** | **not yet** — needs a deployed contract, a funded wallet, Lace and a running proof server |

---

## The one blocker

Everything outstanding at both levels traces back to the deploy:

```
faucet → funded wallet → deploy → address
                                    ├── L1 requirement 4
                                    ├── L2 requirement 4
                                    ├── unblocks the circuit call (L2 requirement 2)
                                    ├── unblocks the demo video
                                    └── unblocks the live demo link
```

Owner actions, in order:

1. **Switch Lace to Preprod** and copy the **unshielded** address — it starts
   `mn_addr_preprod1`. The app shows it with a copy button once connected. The faucet
   rejects shielded and DUST addresses.
2. **Request tokens** at the Preprod faucet —
   https://midnight-tmnight-preprod.nethermind.dev/ (1,000 tNIGHT per request).
3. **Register the NIGHT for DUST generation** — *Generate tDUST* in Lace. Fees are paid
   in tDUST, and NIGHT that has not been registered generates none. Skipping this looks
   like a funded wallet that still cannot pay for anything.
4. Start the proof server — `npm run proof-server`, keep the terminal open.
5. Run the app (`npm run dev`), connect Lace, and press **Deploy the poll**. The panel
   only appears while the build has no address, and the connected wallet pays the fee.
6. Put the address it returns in `.env` as `VITE_CONTRACT_ADDRESS` and in the README
   table, then rebuild.

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
