# STATUS

**Current level: L1 — Toolchain, first contract, tests, README**
Last updated: 2026-09-22

---

## Requirements to pass — L1

| # | Requirement | State |
|---|-------------|-------|
| 1 | Toolchain installed, contract compiles via `compact compile` | ✗ blocked — no Linux toolchain on this machine |
| 2 | Passing test suite | ✗ blocked — 11 tests written, cannot run until (1) |
| 3 | `managed/` directory present (circuits + keys) | ✗ blocked — produced by (1) |
| 4 | Deployed to Preview or Preprod, address visible | ✗ blocked — needs (1) and a funded wallet |
| 5 | Initial product idea, one paragraph, in the README | ✓ done |
| 6 | Minimum 5 meaningful commits | ✓ done — 8 |

## Submission checklist — L1

| # | Item | State |
|---|------|-------|
| 1 | Public GitHub repository with a `README.md` | ✓ done |
| 2 | Setup instructions (how to run locally) | ✓ done — README *Running it* + `docs/SETUP-WINDOWS.md` |
| 3 | Screenshot: successful compile output, circuits listed | ✗ owner action — after (1) above |
| 4 | Screenshot: contract deployed, address shown | ✗ owner action — after (4) above |
| 5 | README section: public state vs private witness | ✓ done — *What is private and what is public* |
| 6 | Initial product idea paragraph | ✓ done — *The idea* |
| 7 | Minimum 5 meaningful commits | ✓ done — 8 |

**4 of 6 requirements and 2 of 7 checklist items are outstanding. All of them trace
back to one cause: there is no Linux toolchain on this machine yet.**

---

## The blocker

The Midnight toolchain has **no Windows build**. The `compact` release ships only
`x86_64-unknown-linux-musl`, `aarch64-unknown-linux-musl`, and the two Apple targets;
the installer is a POSIX shell script. Midnight's own Windows guide says to develop
inside WSL2 + Ubuntu.

This machine currently has **no Ubuntu WSL distro** (only the internal `docker-desktop`
distro) and **Node v21.0.0** on the Windows side, where v22 is required.

Unblocking starts with one command in an Administrator PowerShell:

```powershell
wsl --install -d Ubuntu
```

The rest is in [docs/SETUP-WINDOWS.md](docs/SETUP-WINDOWS.md).

---

## Once the toolchain is up

1. `npm install` — confirm the dependency versions below.
2. `npm run compact` — fixes the three open questions in one shot (see *Open questions*).
3. `npm test` — 11 tests across logic, state transition and privacy.
4. Screenshot the compile output into `docs/screenshots/compile.png`.
5. Fund the wallet at the Preprod faucet — https://midnight-tmnight-preprod.nethermind.dev/
6. Deploy, screenshot into `docs/screenshots/deploy.png`, paste the address into the
   README contract address table.

---

## Open questions, resolved by the first compile

| Question | Current guess | How it resolves |
|---|---|---|
| `pragma language_version` | `0.25` | Docs disagree across pages; the compiler names the version it wants in the error. |
| `@midnight-ntwrk/compact-runtime` pin | `0.16.0` | `0.19.0` shipped the same day as compiler 0.34 / ledger 9; our line is 0.31. |
| `tallies.lookup(k).increment(1)` | assumed valid | Docs say `lookup` "may return another ADT"; the compiler settles it. |

---

## Decisions log

- **2026-09-22** — Development happens inside WSL2/Ubuntu; the repository stays at
  `D:\Priv Proje\MUTFAK\cepush` and is reached from WSL as
  `/mnt/d/Priv\ Proje/MUTFAK/cepush`. Keeps git and the owner's editor on Windows,
  keeps the Linux-only toolchain where it can actually run.
- **2026-09-22** — Target compiler line is `compact update 0.31`. Compiler 0.34.0 exists
  but targets ledger 9, which is not deployed on public networks yet.
- **2026-09-22** — Compile output goes to `managed/` at the repository root, matching
  the required layout and the submission checklist. It is committed, never ignored.
