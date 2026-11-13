# Rootbound

A tile-assembly world-building game with an emergent defense layer, set on an
ever-expanding organic grid. You begin with a single tile in the void. Every tile
you place adds structure, draws pressure, and invites consequence.

> **Status: M1 complete.** Placement, camera controls, connectivity, and module
> classification are implemented. Pressure, threats, resources, and talents are
> still ahead.

## Quick start

Requirements: Node.js 22.12 or newer and npm.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. To create a production build:

```bash
npm run build
npm run preview
```

## Controls

| Input | Action |
| --- | --- |
| Click or tap | Place the selected tile |
| Drag | Pan the camera |
| Mouse wheel or pinch | Zoom |
| Shift + click | Place a raised tile |
| `1`–`5` | Select stem, leaf, root, bloom, or glyph |

The debug HUD shows the current zoom, tile count, and selected tile type.

## Rust engine (experimental)

There is a new, zero-dependency Rust engine in `engine/` — the seed of the
full Rust rewrite. It currently ports the world core (chunked tile storage,
8-connected union-find connectivity, module classification, the ECS, and the
module registry) and implements the M2 pressure model (visible pressure
propagation with threat-peak detection for M3). It is **not yet wired into the
web build**; the Phaser game remains the playable and shippable artifact. The
engine is tested in CI (`cargo test`). See [docs/ENGINE.md](docs/ENGINE.md)
for architecture, verification status, and the dependency policy.

## Development commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run typecheck` | Check TypeScript without emitting files |
| `npm test` | Run the unit tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run build` | Type-check and build into `dist/` |
| `npm run check` | Run all CI checks locally |
| `npm run package:itch` | Build and create `rootbound.zip` (requires `zip`) |

## Project structure

```text
src/
├── main.ts                         Phaser game configuration
├── core/ecs/
│   ├── types.ts                    Component, system, and entity types
│   └── world.ts                    Entity stores, queries, and systems
└── game/
    ├── components.ts               ECS component definitions
    ├── config.ts                   Shared tunable constants
    ├── input/CameraController.ts   Pan, zoom, and tap gestures
    ├── scenes/GameScene.ts         Game composition and placement flow
    ├── systems/ModuleRenderSystem.ts
    └── world/
        ├── types.ts                Tile data
        ├── TileWorld.ts            Chunked tile storage
        ├── ChunkManager.ts         Chunk rendering
        ├── Connectivity.ts         Eight-connected union-find
        ├── Classifier.ts           Component-to-module rules
        └── ModuleRegistry.ts       Module-to-ECS synchronization

docs/                              Design and roadmap
scripts/                           Release utilities
tests/                             Unit tests for core game logic
```

## Roadmap

- **M0–M1:** grid, camera, placement, connectivity, classification, and modules.
- **M2:** visible pressure.
- **M3:** threats that respond to pressure.
- **M4:** active modules.
- **M5:** organic resource display.
- **M6:** equation glyphs and the field journal.
- **M7:** art manifest and drawing-task export.
- **M8:** effects, splash screen, and itch.io release packaging.

See [the design proposal](docs/PROPOSAL.md) for the full creative and technical
direction and [the roadmap](docs/ROADMAP.md) for milestone ordering and links to
the tracked GitHub issues.

## Technology

TypeScript, Phaser 3, Vite, Vitest, and a small purpose-built ECS. The production
build uses relative asset URLs so it can be hosted on itch.io or another static
site.

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Remixed using [OMGithub.com](https://go.ondev.store/).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://go.ondev.store/artistso/Rootbound)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/artistso/Rootbound)

- 🎮 [Open the project](https://go.ondev.store/artistso/Rootbound).
- ✨ [Remix this project](https://go.ondev.store/artistso/Rootbound?remix=1).
- 💻 [Explore the source](https://github.com/artistso/Rootbound).
- 🛠️ [Check build runs](https://github.com/artistso/Rootbound/actions).
- 🐛 [Report an issue](https://github.com/artistso/Rootbound/issues).
- 👤 [Explore the creator's projects](https://go.ondev.store/artistso).
- 🌍 [Create with OMGithub](https://go.ondev.store/).
- 🧬 [Explore the remix source](https://github.com/artistso/Rootbound).
<!-- omgithub:readme:end -->
