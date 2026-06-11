# opencode-agents-cascade

OpenCode plugin that makes instruction-file loading behave like Claude Code:

1. **Injects missing ancestors** — OpenCode stops collecting `AGENTS.md`/`CLAUDE.md` at the git
    worktree root. This plugin walks from the worktree root's parent all the way up to `/` and
    injects every instruction file it finds (one per directory, `AGENTS.md` preferred over
    `CLAUDE.md`).
2. **Fixes precedence** — OpenCode places within-worktree files innermost-first, giving the
    outermost file the highest LLM weight. The plugin reorders all instruction blocks
    outermost-first, so the file closest to the cwd has the highest precedence — matching
    Claude Code.

The global config block (`~/.config/opencode/AGENTS.md`) is left untouched at the start of the
instructions. If the cwd is not inside a git worktree, the plugin is a no-op (OpenCode already
walks to `/` natively in that case).

See [PRD.md](PRD.md) for the full design and research notes.

## Install

Add the plugin to `~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["opencode-agents-cascade@git+https://github.com/waldoibarra/opencode-agents-cascade.git"]
}
```

Pin to a tag or commit with `#v1.0.0` / `#<sha>` at the end of the spec. Git installs are cached
under `~/.cache/opencode/packages/` and never auto-update — pin a new ref to upgrade. For local
development, reference the checkout directly (path specs load the working tree live, no cache):

```json
{
  "plugin": ["~/path/to/opencode-agents-cascade"]
}
```

The plugin ships as TypeScript sources with no build step: OpenCode executes plugins with Bun,
which transpiles TypeScript at import time. Bun strips types without checking them, so type
safety is enforced separately by `just typecheck`.

## How it works

OpenCode merges every loaded instruction file into a single system-prompt string, each prefixed
with `Instructions from: <absolute path>`. The plugin registers the
`experimental.chat.system.transform` hook and, on every chat request:

1. Parses the merged string into a base prompt plus one block per file.
2. Collects instruction files from directories above the git worktree root.
3. Rebuilds the prompt: base, then non-chain blocks (global config, remote URLs, custom
    `instructions` entries) in their original order, then the full ancestor chain sorted
    outermost-first.

If parsing finds no blocks (no instruction files loaded, or the upstream format changed), the
plugin appends the ancestor files without reordering. Any unexpected failure degrades to a no-op —
it never breaks the chat request.

### Known limitations

- Blocks are recognized by their `Instructions from:` header line, so file content that itself
  contains such a line (pointing at an absolute path) splits a block in two.
- Text OpenCode appends after the last block (e.g. a user-level system prompt) travels with that
  block when reordering.

## Development

```sh
just setup              # install toolchain (mise) and git hooks
just test               # run the full test suite with Bun
just test-unit          # hermetic unit tests (no disk I/O)
just test-integration   # integration tests (real filesystem)
just typecheck          # strict tsc over src and tests
```

The core logic lives in `src/cascade.ts` as pure functions (parser, sorter, walker, transform);
`src/index.ts` is the thin plugin entry that wires in the real filesystem. Unit tests run on an
in-memory fake filesystem with machine-neutral paths; integration tests build and destroy their
own temp directory trees, so both suites pass on any machine — they never start OpenCode and are
unaffected by whichever plugin install (git, path, or none) is active on the machine.

Git hooks run typecheck, the full test suite, and the lints on every commit; CI
(`.github/workflows/ci.yml`) runs the same `just` recipes on pushes to `main` and on PRs.

## Docs

- [Toolchain](docs/toolchain.md)
- [Git hooks](docs/hooks.md)
