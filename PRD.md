# PRD: OpenCode Ancestor Instructions Plugin

## Problem

OpenCode loads `AGENTS.md` instruction files only up to the current git worktree root. Claude Code,
by contrast, walks from the filesystem root (`/`) all the way down to the cwd — loading `CLAUDE.md`
from every ancestor directory, outermost first, ignoring git boundaries entirely. This means a user
running OpenCode inside any git worktree misses instruction files that live in parent directories
above the worktree root.

OpenCode also injects within-worktree files in innermost-first order (cwd → worktree root), giving
the outermost file the highest LLM weight. Claude Code does the opposite: outermost first, so the
most specific file (cwd) has the highest precedence.

### Example

Directory structure:

```text
/Users/
  AGENTS.md
  waldoibarra/                             ← $HOME
    AGENTS.md
    projects/                              ← git repo
      AGENTS.md
      my-repo/                             ← nested git repo
        AGENTS.md
        sub-project/                       ← nested git repo (cwd)
          AGENTS.md
```

**Claude Code** loads (in order, outermost first):

1. `~/.claude/CLAUDE.md` (global)
2. `/Users/CLAUDE.md`
3. `~/CLAUDE.md`
4. `~/projects/CLAUDE.md`
5. `~/projects/my-repo/CLAUDE.md`
6. `~/projects/my-repo/sub-project/CLAUDE.md` (cwd, highest precedence)

**OpenCode today** loads:

1. `~/.config/opencode/AGENTS.md` (global)
2. `~/projects/my-repo/sub-project/AGENTS.md` (cwd, lowest precedence)
3. `~/projects/my-repo/AGENTS.md`
4. `~/projects/AGENTS.md` (worktree root, highest precedence — inverted)

Everything above the current git worktree root is silently skipped, and the within-worktree
precedence is inverted relative to Claude Code.

## Goal

A plugin that closes both gaps:

1. **Inject missing files** — when OpenCode starts inside a git worktree, also load every
    instruction file found in ancestor directories above the worktree root, all the way up to `/`.
2. **Correct the order** — reorder all instruction blocks (injected + native) so that the full
    set is outermost-first, matching Claude Code's precedence model (cwd = highest precedence,
    `/` = lowest).

Final load order after the plugin (same example):

1. `~/.config/opencode/AGENTS.md` (global — untouched)
2. `/Users/AGENTS.md` (plugin injects)
3. `~/AGENTS.md` (plugin injects)
4. `~/projects/AGENTS.md` (plugin injects)
5. `~/projects/my-repo/AGENTS.md` (plugin injects)
6. `~/projects/my-repo/sub-project/AGENTS.md` (cwd, highest precedence)

## Technical constraints

These are facts discovered during research — not design opinions.

### Plugin hook

OpenCode exposes `experimental.chat.system.transform(input, output)`:

```ts
input:  { sessionID?: string; model: Model }
output: { system: string[] }
```

### `output.system` is already merged

By the time the hook fires, all loaded instruction files have been joined into `output.system[0]`
as a single string. There are no structured objects or per-file metadata at the hook boundary.

### File block format

Each loaded file is prefixed with a consistent header — stable across 34 commits since
January 2026:

```text
Instructions from: /absolute/path/to/AGENTS.md
<file content>
```

This prefix is the only way to locate a specific file's contribution within `system[0]`.

### Reorder and inject strategy

Since the plugin must parse `system[0]` into blocks anyway (to find the insertion point), it can
reorder the full set at no meaningful extra cost:

1. Split `system[0]` into: base content (everything before the first `Instructions from:`) and an
    array of `{ path, content }` blocks.
2. Collect above-worktree instruction files (walk from parent of git worktree root up to `/`).
3. Merge native blocks + injected blocks into one array, sorted outermost-first by path depth.
4. Rebuild `system[0]`: base content + sorted blocks.

The global config block (`~/.config/opencode/AGENTS.md`) is not reordered — it stays at the
beginning of the instructions as OpenCode placed it.

Fallback: if parsing yields no blocks (no instruction files loaded at all, or the format changed),
append injected files to `system[0]` and do not attempt reordering. Degrading gracefully is more
important than erroring.

### Filename lookup (per directory)

For each ancestor directory, check in priority order:

1. `AGENTS.md` — preferred
2. `CLAUDE.md` — fallback if no `AGENTS.md` present

At most one file per directory is injected.

### Boundary

Walk from the parent of the current git worktree root up to `/`. Parent directories that are
themselves git worktrees are not treated specially — the walk is uniform.

### No git worktree

If the cwd is not inside a git worktree, OpenCode already walks to `/` natively. The plugin is a
no-op in this case.

## Testing

### Unit tests

The core logic should be extracted into pure functions so it can be tested without OpenCode,
git, or a real filesystem:

- **Parser** — given a `system[0]` string, returns `{ base, blocks }` where `blocks` is an array
  of `{ path, content }`. Test with strings that have zero, one, and many blocks.
- **Sorter** — given an array of blocks, returns them sorted outermost-first (longest path =
  innermost = last). Test ordering, ties, and empty input.
- **Reconstructor** — given `base` and sorted `blocks`, returns the rebuilt string. Test that the
  output round-trips through the parser.
- **Walker** — given a start directory and a root boundary, returns the instruction files found.
  Test against a real temp directory tree (create, assert, delete) or a mock filesystem.

### Hook integration test

Test the hook end-to-end by calling it with a fabricated `output.system` and a mocked git
subprocess, then asserting the resulting `output.system[0]` matches the expected order. No OpenCode
process required.

### Manual end-to-end verification

Start an OpenCode session in a directory with a known file tree and ask:
_"What AGENTS.md files were injected in your system prompt and in what order?"_

Set up files at several levels (including above and below git worktree boundaries) and confirm the
order matches the goal. This is how the behavior was verified throughout the research for this PRD.

### Local development

Reference the plugin as a local path in `opencode.json` to avoid push/reinstall cycles:

```json
{ "plugin": ["./path/to/local/plugin"] }
```

## Out of scope

- Configurable filename list or boundary via plugin options (keep it simple unless there is a clear
  reason to add options)
- In-repo subdirectory walking (OpenCode already handles that natively)

## Delivery

- Public GitHub repo
- A `package.json` at the repo root with `"type": "module"` and a `"main"` pointing to the plugin
  entry file — this is what makes the git-backed install spec work
- No npm publish required; OpenCode/Bun resolves it directly from git
- Installed in `~/.config/opencode/opencode.json` like any other plugin:

```json
{ "plugin": ["opencode-agents-cascade@git+https://github.com/<user>/opencode-agents-cascade.git"] }
```

- Supports version pinning via tag or commit hash:

```json
{ "plugin": ["opencode-agents-cascade@git+https://github.com/<user>/opencode-agents-cascade.git#v1.0.0"] }
```

## Reference

- [superpowers](https://github.com/obra/superpowers) — example of the git-backed plugin pattern
- [OpenCode plugin docs](https://opencode.ai/docs/plugins/)
