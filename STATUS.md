# STATUS

**Current level: L1 — Toolchain, first contract, tests, README**
Last updated: 2026-09-22

---

## L1 checklist

| # | Item | State |
|---|------|-------|
| 1 | Repository scaffold, `.gitignore`, `.claude/settings.json` | ✓ done |
| 2 | WSL2 + Ubuntu development environment | ✗ blocked — owner action |
| 3 | Node.js v22 inside WSL | ✗ blocked — depends on 2 |
| 4 | Compact compiler installed, `compact --version` verified | ✗ blocked — depends on 2 |
| 5 | Proof server running (`docker run -p 6300:6300 …`) | ✗ blocked — depends on 2 |
| 6 | `contracts/cepush.compact` written | ◐ drafted, not compiled |
| 7 | `compact compile` succeeds, `contracts/managed/` committed | ✗ blocked — depends on 4 |
| 8 | 3 tests written and passing | ◐ drafted, not run |
| 9 | Wallet funded at Preprod faucet | ✗ owner action |
| 10 | Deployed to Preprod, contract address obtained | ✗ owner action |
| 11 | README with Contract Address table | ✗ waiting on 10 |
| 12 | Idea paragraph in README | ✗ |
| 13 | ≥ 5 commits | ◐ in progress |

---

## Blocker (as of 2026-09-22)

The Midnight toolchain has **no Windows build**. The `compact` release ships only
`x86_64-unknown-linux-musl`, `aarch64-unknown-linux-musl`, and the two Apple targets;
the installer is a POSIX shell script. Midnight's own Windows guide says to develop
inside WSL2 + Ubuntu.

This machine currently has **no Ubuntu WSL distro** (only the internal `docker-desktop`
distro) and **Node v21.0.0** on the Windows side, where v22 is required.

See `docs/SETUP-WINDOWS.md` for the exact commands the owner needs to run.

---

## Decisions log

- **2026-09-22** — Development happens inside WSL2/Ubuntu; the repository stays at
  `D:\Priv Proje\MUTFAK\cepush` and is reached from WSL as
  `/mnt/d/Priv\ Proje/MUTFAK/cepush`. Keeps git and the owner's editor on Windows,
  keeps the Linux-only toolchain where it can actually run.
- **2026-09-22** — Target compiler line is `compact update 0.31`. Compiler 0.34.0 exists
  but targets ledger 9, which is not deployed on public networks yet.
