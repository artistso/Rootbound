# Contributing to Rootbound

## Development setup

1. Install Node.js 22.12 or newer.
2. Run `npm install`.
3. Run `npm run check` to establish a clean baseline.
4. Start the game with `npm run dev`.

## Making changes

- Keep game constants in `src/game/config.ts` and rendering out of core logic.
- Add unit tests for changes to world storage, connectivity, classification, or ECS behavior.
- Update the README or design documentation when behavior or plans change.
- Keep pull requests focused; avoid mixing unrelated cleanup with gameplay work.
- Do not commit `node_modules/`, `dist/`, coverage output, or release ZIP files.

Before opening a pull request, run:

```bash
npm run check
```

Use the issue templates for bugs and feature proposals. Link the relevant issue
in your pull request and describe how you verified the change.
