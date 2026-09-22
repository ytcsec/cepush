# STATUS

**Current level: L1 — Toolchain, first contract, tests, README**
Last updated: 2026-09-22

---

## Requirements to pass — L1

| # | Requirement | State |
|---|-------------|-------|
| 1 | Toolchain installed, contract compiles via `compact compile` | ✓ done — compiler 0.31.1, exit 0 |
| 2 | Passing test suite | ✓ done — 10/10 |
| 3 | `managed/` directory present (circuits + keys) | ✓ done — committed |
| 4 | Deployed to Preview or Preprod, address visible | ✗ owner action — faucet, then deploy |
| 5 | Initial product idea, one paragraph, in the README | ✓ done |
| 6 | Minimum 5 meaningful commits | ✓ done |

## Submission checklist — L1

| # | Item | State |
|---|------|-------|
| 1 | Public GitHub repository with a `README.md` | ✓ done |
| 2 | Setup instructions (how to run locally) | ✓ done — README *Running it* + `docs/SETUP-WINDOWS.md` |
| 3 | Screenshot: successful compile output, circuits listed | ✗ owner action — one command, see below |
| 4 | Screenshot: contract deployed, address shown | ✗ owner action — after (4) above |
| 5 | README section: public state vs private witness | ✓ done — *What is private and what is public* |
| 6 | Initial product idea paragraph | ✓ done — *The idea* |
| 7 | Minimum 5 meaningful commits | ✓ done |

**Outstanding: the deploy, and the two screenshots.** Everything that can be done
without a funded wallet is done.

---

## What the build produces

`docker run --rm -v "$PWD:/work" cepush-toolchain bash docker/verify.sh`

```
managed/cepush/compiler/contract-info.json
managed/cepush/contract/index.d.ts
managed/cepush/contract/index.js
managed/cepush/contract/index.js.map
managed/cepush/keys/vote.prover
managed/cepush/keys/vote.verifier
managed/cepush/zkir/vote.bzkir
managed/cepush/zkir/vote.zkir
```

One circuit, `vote`, with its proving and verifying keys. The compiler prints
`Compiling 1 circuits:` and does not name them; the circuit names are visible in the
artefact filenames above and in `contract-info.json`.

| Component | Version |
|---|---|
| Compact compiler | 0.31.1 |
| Compact language | 0.23.0 |
| Compact runtime | 0.16.0 |
| Node.js | 22.23.2 |

---

## Owner actions to close L1

1. **Screenshot the compile.** Run the verify command above and capture the terminal.
   Save as `docs/screenshots/compile.png`.
2. **Fund a wallet** at the Preprod faucet — https://midnight-tmnight-preprod.nethermind.dev/
3. **Start the proof server** — `npm run proof-server`, keep the terminal open.
4. **Deploy** to Preprod and capture the terminal showing the contract address.
   Save as `docs/screenshots/deploy.png`.
5. **Paste the address** into the README contract address table.

---

## Resolved during the first build

| Question | Answer |
|---|---|
| `pragma language_version` | **0.23** — the compiler rejected 0.25 outright. Docs pages disagreed; the compiler settled it. |
| `@midnight-ntwrk/compact-runtime` pin | **0.16.0** — confirmed by `contract-info.json`. The 0.16.0 guess was right. |
| `tallies.lookup(k).increment(1)` | **Valid.** A `Counter` stored as a `Map` value is reachable through `lookup`. |
| Top-level `const` | **Not a program element** in language 0.23. The option bound is a literal in the loop instead. |
| Test harness API | `constructorContext` / `emptyZswapLocalState` do not exist in runtime 0.16. The factories are `createConstructorContext` and `createCircuitContext`, and the context field is `currentQueryContext`. |
| Compile output filename | `contract/index.js`, not `index.cjs`. |

---

## Decisions log

- **2026-09-22** — The toolchain runs in Docker rather than WSL2. It pins the compiler,
  the language, the runtime and Node in one image definition, works the same on every
  platform, and needs no distro install. WSL2 stays documented as an alternative.
- **2026-09-22** — Target compiler line is `compact update 0.31`. Compiler 0.34 exists
  but targets ledger 9, which is not deployed on public networks yet.
- **2026-09-22** — Compile output goes to `managed/` at the repository root, matching
  the required layout and the submission checklist. It is committed, never ignored.
