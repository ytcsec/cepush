# Screenshots

## `tests.png` — the test run

`npx vitest run --reporter=verbose` on the L3 contract: 17 tests across circuit logic,
state transition, privacy, the nullifier, and nullifier privacy, all passing. Linked
from the main README's Tests section.

To reproduce it:

```bash
npm run compact
npx vitest run --reporter=verbose
```

The same suite runs on every push in CI; see the badge at the top of the main README.
