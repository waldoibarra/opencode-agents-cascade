# PRD: OpenCode Ancestor Instructions Plugin

This records the original problem, research assumptions, and design decisions.
For current behavior, read [how it works](docs/how-it-works.md).
For current installation, read [install and use](docs/install.md).
The comparisons below describe the original research scenario, not a verified host contract.

## Problem

The research scenario found OpenCode omitted instruction files above the current git worktree root.
It also observed innermost-first ordering for files inside the worktree.
Neither observation establishes current behavior across OpenCode versions or configurations.
The plugin targets these gaps by adding missing ancestors and sorting the directory chain.

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

**Original Claude Code comparison** assumed these files load outermost-first:

1. `~/.claude/CLAUDE.md` (global)
2. `/Users/CLAUDE.md`
3. `~/CLAUDE.md`
4. `~/projects/CLAUDE.md`
5. `~/projects/my-repo/CLAUDE.md`
6. `~/projects/my-repo/sub-project/CLAUDE.md` (cwd)

**Original OpenCode observation** listed:

1. `~/.config/opencode/AGENTS.md` (global)
2. `~/projects/my-repo/sub-project/AGENTS.md` (cwd)
3. `~/projects/my-repo/AGENTS.md`
4. `~/projects/AGENTS.md` (worktree root)

This comparison illustrates the original ordering problem, not how models resolve conflicts.

## Implemented design

The plugin addresses both gaps:

1. **Inject missing files:** Check ancestor directories above the worktree root through `/`.
2. **Order the chain:** Sort recognized directory-chain blocks outermost-first.
    Preserve non-chain blocks ahead of that chain in their original relative order.
    Prompt position alone does not establish instruction authority or model behavior.

Expected block order for the example (excluding other non-chain blocks):

1. `~/.config/opencode/AGENTS.md` (global non-chain block)
2. `/Users/AGENTS.md` (plugin injects)
3. `~/AGENTS.md` (plugin injects)
4. `~/projects/AGENTS.md` (plugin injects)
5. `~/projects/my-repo/AGENTS.md` (plugin injects)
6. `~/projects/my-repo/sub-project/AGENTS.md` (cwd)

## Technical constraints

These were research inputs. Check current host behavior before treating them as API guarantees.

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

The researched prompt contained a header for each loaded file:

```text
Instructions from: /absolute/path/to/AGENTS.md
<file content>
```

The parser uses this prefix to locate file blocks within `system[0]`.

### Reorder and inject strategy

The implemented transform uses the following steps:

1. Split `system[0]` into: base content (everything before the first `Instructions from:`) and an
    array of `{ path, content }` blocks.
2. Collect above-worktree instruction files (walk from parent of git worktree root up to `/`).
3. Keep non-chain blocks in relative order; sort only directory-chain blocks by path depth.
4. Rebuild `system[0]` with the base, non-chain blocks, and sorted chain.
    When file content permits, detach trailing custom text and append it after the blocks.

A global config block outside the current directory's chain stays with the non-chain blocks.

If parsing finds no blocks, the transform appends readable ancestor files only when `sessionID` exists.
It does not reorder the base text in that case.
The entry hook catches exceptions, but prior mutations may remain if an error occurs.

### Filename lookup (per directory)

For each ancestor directory, check in priority order:

1. `AGENTS.md` — preferred
2. `CLAUDE.md` — fallback if no `AGENTS.md` present

At most one file per directory is injected.

### Boundary

Walk from the parent of the current git worktree root up to `/`. Parent directories that are
themselves git worktrees are not treated specially — the walk is uniform.

### No git worktree

The implementation treats `/` as the non-git worktree sentinel and injects no files.
It still sorts parsed chain blocks, preserving the fix for a previously observed inverted order.
An earlier no-op proposal missed that case during manual testing.

## Verification design

### Unit tests

The core logic uses injected filesystem callbacks and can be tested without OpenCode:

- **Parser** — given a `system[0]` string, returns `{ base, blocks }` where `blocks` is an array
  of `{ path, content }`. Test with strings that have zero, one, and many blocks.
- **Sorter** — given an array of blocks, returns them sorted outermost-first (longest path =
  innermost = last). Test ordering, ties, and empty input.
- **Reconstructor** — given `base` and sorted `blocks`, returns the rebuilt string. Test that the
  output round-trips through the parser.
- **Walker** — given a start directory and boundary, returns instruction files found.
  Test with an in-memory filesystem; integration tests use temporary directories.

### Hook integration test

Tests call the hook with fabricated `output.system` and a real temporary filesystem.
The plugin receives a worktree path; these tests do not start OpenCode or mock git.

### Manual end-to-end verification

Start an OpenCode session in a directory with a known file tree and ask:
_"What AGENTS.md files were injected in your system prompt and in what order?"_

Set up files at several levels (including above and below git worktree boundaries) and confirm the
order matches the goal.
The original README reported verification against OpenCode 1.17.
That historical report does not reproduce or verify behavior on current OpenCode versions.

### Local development

Reference the plugin as a local path in `opencode.json` to avoid push/reinstall cycles:

```json
{ "plugin": ["./path/to/local/plugin"] }
```

## Out of scope

- Configurable filename list or boundary via plugin options (keep it simple unless there is a clear
  reason to add options)
- In-repo subdirectory walking (original scope assumption: OpenCode handled that natively)

## Original delivery design

- Public GitHub repo
- A `package.json` at the repo root with `"type": "module"` and a `"main"` pointing to the plugin
  entry file — this is what makes the git-backed install spec work
- No npm publish required; OpenCode/Bun resolves it directly from git
- Git-backed installation uses `~/.config/opencode/opencode.json`:

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
