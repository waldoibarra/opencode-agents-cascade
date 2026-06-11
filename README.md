# opencode-agents-cascade

[![Code checks](https://github.com/waldoibarra/opencode-agents-cascade/actions/workflows/code-checks.yml/badge.svg)](https://github.com/waldoibarra/opencode-agents-cascade/actions/workflows/code-checks.yml)
[![Lint](https://github.com/waldoibarra/opencode-agents-cascade/actions/workflows/lint.yml/badge.svg)](https://github.com/waldoibarra/opencode-agents-cascade/actions/workflows/lint.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

OpenCode plugin that makes `AGENTS.md`/`CLAUDE.md` loading behave like Claude Code: every
ancestor directory is loaded, and the file closest to you wins.

## The problem

Say you keep layered instructions — personal rules in your home directory, conventions per
projects folder, specifics in each repo:

```text
/Users/
├── AGENTS.md
└── you/
    ├── AGENTS.md
    └── projects/
        ├── AGENTS.md
        └── my-repo/            ← git repo
            ├── AGENTS.md
            └── sub/            ← you run opencode here
                └── AGENTS.md
```

OpenCode loads only this, after your global config file:

1. `my-repo/sub/AGENTS.md`
2. `my-repo/AGENTS.md` — highest weight: the repo root beats the directory you are in

Everything above the git repo is silently skipped, and within the repo the precedence is
inverted — the outermost file wins. Claude Code does the opposite on both counts.

## What the plugin does

With the plugin, the same session loads:

1. `/Users/AGENTS.md`
2. `/Users/you/AGENTS.md`
3. `/Users/you/projects/AGENTS.md`
4. `my-repo/AGENTS.md`
5. `my-repo/sub/AGENTS.md` — highest weight: the closest file wins, like Claude Code

- **Injects missing ancestors** — walks from the worktree root's parent up to `/`, one file per
  directory, `AGENTS.md` preferred over `CLAUDE.md`.
- **Fixes precedence** — reorders all instruction blocks outermost-first, with or without a git
  repo in the hierarchy.
- **Stays out of the way** — the global config block is untouched, per-prompt custom system text
  keeps its position, and any failure degrades gracefully instead of breaking the chat request.

## Install

Add the plugin to `~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["opencode-agents-cascade@git+https://github.com/waldoibarra/opencode-agents-cascade.git"]
}
```

Pin to a tag or commit with `#v1.0.0` / `#<sha>` at the end of the spec. Verified against
OpenCode 1.17.

### Upgrading

OpenCode installs git-spec plugins once and never re-fetches them. To pick up a new version,
pin a different ref, or clear the cached install and start a new session:

```sh
rm -rf ~/.cache/opencode/packages/opencode-agents-cascade*
```

The cache lives under `$XDG_CACHE_HOME/opencode/packages/` when that variable is set.

## Use

Nothing to configure: start OpenCode inside any project and your ancestor instructions are
injected on every chat request. To see it working, ask the model:

> What "Instructions from:" headers are in your system prompt, in order?

## Docs

- [How it works and known limitations](docs/how-it-works.md)
- [Development guide](docs/development.md)
- [PRD: problem, research, and design](PRD.md)

## License

[MIT](LICENSE)
