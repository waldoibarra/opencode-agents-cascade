# AGENTS.md

Navigation index for LLMs. Read this first; fetch linked docs on demand.

## Project

`opencode-agents-cascade` — OpenCode plugin that injects `AGENTS.md`/`CLAUDE.md` files from
directories above the git worktree root and reorders all instruction blocks outermost-first,
matching Claude Code precedence. Design and research → `PRD.md`. Core logic (pure functions) →
`src/cascade.ts`; plugin entry → `src/index.ts`; tests → `tests/`.

## Key commands

Before running any `just` recipe you haven't seen in this conversation, run `just help` to get the
current list of available commands.

## Deep reference

- Toolchain details → `docs/toolchain.md`
- Hook triggers and checks → `docs/hooks.md`

## Doc maintenance (mandatory)

You are responsible for keeping all documentation accurate. Apply these rules on every task:

- Modified `mise.toml` or added/removed a tool → update `docs/toolchain.md`
- Modified `hk.pkl`, `config/committed.toml`, or `config/.markdownlint-cli2.yaml` → update
  `docs/hooks.md`
- Added a `justfile` recipe → add a row to the key commands table in this file
- Prefer removing stale content over leaving it. A wrong doc is worse than no doc.
- Doc updates must be in the same commit as the change that made them necessary.
- Before committing a change, evaluate if the docs need updating.
