# Development environment on Windows

The Midnight toolchain is Linux and macOS only. The `compact` release ships
`x86_64-unknown-linux-musl`, `aarch64-unknown-linux-musl` and the two Apple targets —
no Windows target — and the installer is a POSIX shell script. So the compiler needs a
Linux userland.

There are two ways to give it one. **Docker is the recommended route**: it is a single
image build, it pins the whole toolchain, and it produces byte-identical output on any
machine.

---

## Route 1 — Docker (recommended)

The only prerequisite is Docker Desktop, running.

```bash
docker build -f docker/toolchain.Dockerfile -t cepush-toolchain .
docker run --rm -v "$PWD:/work" cepush-toolchain bash docker/verify.sh
```

That compiles the contract into `managed/` and runs the test suite. The repository is
mounted, so the compiled artefacts land in your working tree and are ready to commit.

From PowerShell, use `${PWD}` instead of `$PWD`:

```powershell
docker run --rm -v "${PWD}:/work" cepush-toolchain bash docker/verify.sh
```

To work inside the container instead of running one command:

```bash
docker run --rm -it -v "$PWD:/work" cepush-toolchain bash
```

### What the image pins

| Component | Version |
|---|---|
| Compact compiler | 0.31.1 |
| Compact language | 0.23.0 |
| Compact runtime | 0.16.0 |
| Node.js | 22 |

The compiler line is pinned to **0.31** on purpose. The newer 0.34 targets ledger 9,
which is not deployed on the public networks yet.

---

## Route 2 — WSL2 + Ubuntu

Useful if you would rather have the toolchain on the host than in a container.

### 1. Install Ubuntu

In an **Administrator PowerShell**:

```powershell
wsl --install -d Ubuntu
```

Ubuntu asks for a UNIX username and password on first launch. A reboot may be required.
Confirm afterwards with `wsl -l -v`; `Ubuntu` must be listed with `VERSION 2`.

### 2. Let Docker Desktop see the distro

Docker Desktop → *Settings* → *Resources* → *WSL integration* → enable **Ubuntu** →
*Apply & restart*. Verify from inside Ubuntu with `docker ps`.

### 3. Node.js 22

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 22
nvm alias default 22
node -v            # must print v22.x
```

### 4. Compact compiler

```bash
curl --proto '=https' --tlsv1.2 -LsSf \
  https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
source ~/.bashrc
compact update 0.31
compact --version
```

The installer puts the toolchain manager in `~/.local/bin`, so that directory has to be
on `PATH`. The installer writes the line into `~/.bashrc` for you; a login shell can
still override it, in which case `source ~/.local/bin/env` fixes it.

### 5. Reach the repository from Ubuntu

```bash
cd "/mnt/d/Priv Proje/MUTFAK/cepush"
```

Note the space in `Priv Proje` — always quote the path.

> Cross-filesystem access (`/mnt/d`) is slower than the native WSL filesystem. It is
> fine for compiling and testing.

---

## Proof server

Needed for deploys, not for compiling or testing. It wants at least 4 GB of RAM and
occupies its terminal while running:

```bash
docker run -p 6300:6300 midnightntwrk/proof-server:8.1.0 -- midnight-proof-server -v
```

It listens on `http://localhost:6300`.
