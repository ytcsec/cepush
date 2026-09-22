# Development environment on Windows

The Midnight toolchain is Linux-only. The `compact` compiler releases ship four targets —
`x86_64-unknown-linux-musl`, `aarch64-unknown-linux-musl`, `x86_64-apple-darwin`,
`aarch64-apple-darwin` — and no Windows target, and the installer is a POSIX shell script.
Midnight's own documentation says Windows development goes through WSL2.

So: **the repository lives on `D:\`, the toolchain lives in WSL2/Ubuntu.**

---

## 1. Install Ubuntu under WSL2

In an **Administrator PowerShell**:

```powershell
wsl --install -d Ubuntu
```

Ubuntu will ask for a UNIX username and password on first launch. A reboot may be
required. Confirm afterwards:

```powershell
wsl -l -v
```

`Ubuntu` must be listed with `VERSION 2`.

## 2. Let Docker Desktop see the new distro

Docker Desktop → *Settings* → *Resources* → *WSL integration* → enable **Ubuntu** → *Apply & restart*.

Verify from inside Ubuntu:

```bash
docker ps
```

## 3. Node.js 22 inside Ubuntu

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 22
nvm alias default 22
node -v            # must print v22.x
```

## 4. Compact compiler

```bash
curl --proto '=https' --tlsv1.2 -LsSf \
  https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
source ~/.bashrc
compact update 0.31
compact --version
```

Pin to the **0.31** line. The newer 0.34.0 compiler targets ledger 9, which is not yet
deployed on the public networks.

## 5. Proof server

The proof server needs at least 4 GB of RAM. Keep it running in its own terminal:

```bash
docker run -p 6300:6300 midnightntwrk/proof-server:8.1.0 -- midnight-proof-server -v
```

It listens on `http://localhost:6300`.

## 6. Reach the repository from Ubuntu

```bash
cd "/mnt/d/Priv Proje/MUTFAK/cepush"
```

Note the space in `Priv Proje` — always quote the path.

> Cross-filesystem access (`/mnt/d`) is slower than the native WSL filesystem. It is fine
> for compiling and testing. If `npm install` becomes painfully slow, the fallback is to
> clone into `~/cepush` inside Ubuntu and push from there.

---

## Verification

Everything is ready when all five print correctly inside Ubuntu:

```bash
wsl.exe -l -v          # Ubuntu, VERSION 2   (run from PowerShell)
node -v                # v22.x
compact --version      # 0.31.x
docker ps              # daemon reachable
curl -s localhost:6300 # proof server responds
```
