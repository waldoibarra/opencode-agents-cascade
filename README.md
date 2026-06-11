# opencode-agents-cascade

[![Code checks](https://github.com/waldoibarra/opencode-agents-cascade/actions/workflows/code-checks.yml/badge.svg)](https://github.com/waldoibarra/opencode-agents-cascade/actions/workflows/code-checks.yml)
[![Lint](https://github.com/waldoibarra/opencode-agents-cascade/actions/workflows/lint.yml/badge.svg)](https://github.com/waldoibarra/opencode-agents-cascade/actions/workflows/lint.yml)

OpenCode plugin that makes instruction-file loading behave like Claude Code.

## Why

OpenCode stops collecting `AGENTS.md`/`CLAUDE.md` files at the git worktree root, so instructions
in parent directories (your home folder, a projects folder, an org-wide root) silently never reach
the model. It also weights the files it does load in the inverse order of Claude Code: the
outermost file wins instead of the most specific one. If you keep layered instructions — global
rules at home, team rules per folder, project rules in the repo — both behaviors break the
layering. See [PRD.md](PRD.md) for the full research.

## Features

- **Injects missing ancestors** — walks from the worktree root's parent up to `/` and loads every
  instruction file found (one per directory, `AGENTS.md` preferred over `CLAUDE.md`).
- **Fixes precedence** — reorders all instruction blocks outermost-first, with or without a git
  repo in the hierarchy, so the file closest to your cwd has the highest precedence, matching
  Claude Code.
- **Stays out of the way** — the global config block is untouched, per-prompt custom system text
  keeps its position, and any failure degrades gracefully instead of breaking the chat request.

## Install

Add the plugin to `~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["opencode-agents-cascade@git+https://github.com/waldoibarra/opencode-agents-cascade.git"]
}
```

Pin to a tag or commit with `#v1.0.0` / `#<sha>` at the end of the spec.

## Use

Nothing to configure: start OpenCode inside any git repo and the ancestor instructions are
injected on every chat request. To see it working, ask the model:

> What "Instructions from:" headers are in your system prompt, in order?

## Docs

- [How it works and known limitations](docs/how-it-works.md)
- [Development guide](docs/development.md)
- [PRD: problem, research, and design](PRD.md)
