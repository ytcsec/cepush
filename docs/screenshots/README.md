# Screenshots

Two images belong here for the L1 submission.

## `compile.png` — the build

Run the verify script and capture the terminal. It prints the compiler version, the
language version, the compile itself, the artefacts it produced, and the test run:

```bash
docker run --rm -v "$PWD:/work" cepush-toolchain bash docker/verify.sh
```

Build the image first if you have not already:

```bash
docker build -f docker/toolchain.Dockerfile -t cepush-toolchain .
```

## `deploy.png` — the deployed contract

Capture the terminal showing the deploy finishing with the contract address visible.
The proof server has to be running first (`npm run proof-server`) and the wallet has to
be funded at the Preprod faucet.

Once both images exist, link them from the main README next to the contract address
table.
