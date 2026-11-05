# Rootbound roadmap

The milestones below follow the [design proposal](PROPOSAL.md). M0 and M1 are
implemented; each remaining milestone has a focused GitHub issue with acceptance
criteria.

| Milestone | Deliverable | Status | Tracking |
| --- | --- | --- | --- |
| M0 | Grid, heightmap, camera, and one placeable tile | Complete | — |
| M1 | Connectivity, classification, modules, and zero-latency placement | Complete | — |
| M2 | Visible pressure propagation | Next | [#1](https://github.com/artistso/Rootbound/issues/1) |
| M3 | Threats spawned from pressure peaks | Planned | [#2](https://github.com/artistso/Rootbound/issues/2) |
| M4 | Modules harvest, defend, and attract | Planned | [#3](https://github.com/artistso/Rootbound/issues/3) |
| M5 | Organic resource display | Planned | [#4](https://github.com/artistso/Rootbound/issues/4) |
| M6 | Equation glyphs, cycle discovery, and field journal | Planned | [#5](https://github.com/artistso/Rootbound/issues/5) |
| M7 | Art manifest and `ART_TODO` export | Planned | [#6](https://github.com/artistso/Rootbound/issues/6) |
| M8 | Effects, splash, and itch.io release | Planned | [#7](https://github.com/artistso/Rootbound/issues/7) |

## Ordering principles

1. Build visible pressure before threats so players can understand cause and effect.
2. Establish threat behavior before balancing active modules against it.
3. Give modules mechanical roles before designing their resource visualization.
4. Add discovery after the core building and consequence loop is stable.
5. Keep placeholders until gameplay settles, then scale the art pipeline.
6. Treat effects and release packaging as a final integration pass, not a substitute
   for playtesting.

The order is a planning aid rather than a promise of fixed dates. Keep issues
updated when scope changes, and split large implementation work into focused
pull requests.
