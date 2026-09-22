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
| 1 | Lace connect / disconnect implemented | ✓ done — connector v4.0.1, UUID discovery |
| 2 | Circuit called successfully from the frontend | ✗ **not implemented** — see below |
| 3 | An observable privacy behaviour | ◐ the UI claim and the private-ballot handling are in place; nothing is proved yet because (2) is open |
| 4 | Contract deployed to Preprod, verifiable address | ✗ **blocked — owner** |
| 5 | Minimum 8 meaningful commits | ✓ |

## L2 — submission checklist

| # | Item | State |
|---|------|-------|
| 1 | Public GitHub repository with README | ✓ |
| 2 | Live demo link | ✗ deploy the site once (2) and (4) land |
| 3 | Deployed Preprod address, verifiable on-chain | ✗ blocked — owner |
| 4 | Demo video: wallet connect + successful circuit call | ✗ blocked — owner, needs (2) |
| 5 | README documenting the privacy claim | ✓ |
| 6 | Minimum 8 meaningful commits | ✓ |

---

## What the frontend does today

`npm run dev`, or `npm run build` for a production bundle. The build is clean:
`tsc --noEmit` and `vite build` both pass with zero errors.

- **Wallet discovery** — enumerates `window.midnight`, because connector v4 wallets
  register under a freshly minted UUID rather than a fixed key. Polls briefly, since
  extensions inject themselves after first render.
- **Connect** — `wallet.connect(networkId)`, then verifies `getConnectionStatus()`
  actually landed on the expected network.
- **Disconnect** — the connector exposes no revoke call, so the app forgets the session
  it was handed. Permissions are managed inside the wallet.
- **Error states** — no wallet installed, request declined, network mismatch, and
  unknown wallet errors, each with its own message.
- **The ballot** — held in component state, never logged, never stored, cleared as soon
  as the submit handler is done with it.

## What it does not do yet

`castVote` in `src/lib/contract.ts` validates the ballot range and then refuses,
because there is no contract to call. Two things are missing, in this order:

1. **A deployed contract address.** Blocked on the faucet.
2. **The provider bundle.** Midnight.js needs six providers — private state, public
   data, zk config, proof, wallet and midnight. Five are straightforward factory calls.
   The sixth, the bridge from the DApp connector to `WalletProvider`/`MidnightProvider`,
   has no helper in the SDK: the connector speaks serialised transaction strings while
   midnight-js speaks `UnboundTransaction` objects, and that glue has to be written by
   hand. It cannot be verified without a deployed contract, a funded wallet, Lace, and a
   running proof server, so it is deliberately not guessed at yet.

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

1. Fund a wallet at the Preprod faucet — https://midnight-tmnight-preprod.nethermind.dev/
2. Start the proof server — `npm run proof-server`, keep the terminal open.
3. Deploy and capture the address.
4. Put the address in `.env` as `VITE_CONTRACT_ADDRESS` and in the README table.

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
- **2026-09-22** — The wallet bridge is left unwritten rather than guessed. Shipping
  unverifiable glue would read as progress while being untested code.
