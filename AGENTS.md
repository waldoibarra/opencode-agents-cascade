# AGENTS.md

Navigation index for LLMs. Read this first; fetch linked docs on demand.

## Project

`opencode-agents-cascade` injects missing ancestor instruction files above the git worktree root.
It sorts directory-chain blocks outermost-first; this does not guarantee model instruction priority.
Read `PRD.md` for original research, `src/cascade.ts` for core logic, and `src/index.ts` for wiring.
Tests live under `tests/`. Read `GLOSSARY.md` before changing domain terminology.

## Key commands

Before running any `just` recipe you haven't seen in this conversation, run `just help` to get the
current list of available commands.

| Command | Purpose |
| --- | --- |
| `just setup` | Install toolchain (mise), JS dev deps, and git hooks |
| `just test` | Run the full plugin test suite with Bun |
| `just test-unit` | Run hermetic unit tests (no disk I/O) |
| `just test-integration` | Run integration tests (real filesystem) |
| `just typecheck` | Typecheck all TypeScript sources with tsc |

## Deep reference

- Installation, use, and upgrades → `docs/install.md`
- Plugin mechanism and limitations → `docs/how-it-works.md`
- Development guide (commands, architecture, tests) → `docs/development.md`
- Release procedure (version bump, tag, push) → `docs/development.md`
- Toolchain details → `docs/toolchain.md`
- Hook triggers and checks → `docs/hooks.md`
- CI pipelines (same recipes as the hooks) → `.github/workflows/`

## Doc maintenance (mandatory)

You are responsible for keeping all documentation accurate. Apply these rules on every task:

- Modified `mise.toml` or added/removed a tool → update `docs/toolchain.md`
- Modified `hk.pkl`, `config/committed.toml`, or `config/.markdownlint-cli2.yaml` → update
  `docs/hooks.md`
- Added a `justfile` recipe → add a row to the key commands table in this file
- Bumping the plugin version → follow the release steps in `docs/development.md`; never retag
- Prefer removing stale content over leaving it. A wrong doc is worse than no doc.
- Doc updates must be in the same commit as the change that made them necessary.
- Before committing a change, evaluate if the docs need updating.
