#!/usr/bin/env bash
#
# One command that proves the contract builds and behaves. Run it inside the
# toolchain image; see the README for the docker invocation.
set -euo pipefail

rule() { printf '\n\033[1m$ %s\033[0m\n' "$1"; }

rule "compact --version"
compact --version

rule "compactc --language-version"
compact compile --language-version

if [ ! -d node_modules ]; then
  rule "npm install"
  npm install --no-audit --no-fund
fi

rule "npm run compact"
rm -rf managed
npm run compact

rule "compiled artefacts"
find managed -type f | sort

rule "npm test"
npm test
