# Reproducible build environment for the cepush contract.
#
# The Midnight toolchain ships Linux and macOS binaries only, so on Windows the
# compiler needs a Linux userland. This image is that userland: Node 22 and the
# Compact compiler, pinned, with nothing else in it.
#
#   docker build -f docker/toolchain.Dockerfile -t cepush-toolchain .
#   docker run --rm -v "$PWD:/work" cepush-toolchain npm run compact
FROM node:22-bookworm

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      xz-utils \
 && rm -rf /var/lib/apt/lists/*

# The installer drops the toolchain manager here and expects it on PATH.
ENV PATH="/root/.local/bin:${PATH}"

# Pin the 0.31 compiler line. 0.34 targets ledger 9, which is not deployed on
# the public networks yet.
RUN curl --proto '=https' --tlsv1.2 -LsSf \
      https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh \
 && compact update 0.31 \
 && compact --version

WORKDIR /work
