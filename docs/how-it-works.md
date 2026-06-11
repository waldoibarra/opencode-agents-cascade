# How it works

OpenCode merges every loaded instruction file into a single system-prompt string, each prefixed
with `Instructions from: <absolute path>`. The plugin registers the
`experimental.chat.system.transform` hook and, on every chat request:

1. Parses the merged string into a base prompt plus one block per file.
2. Detects per-prompt custom system text appended after the last block (by re-reading that
    block's file and splitting off whatever follows its verbatim content).
3. Collects instruction files from directories above the git worktree root (one per directory,
    `AGENTS.md` preferred over `CLAUDE.md`).
4. Rebuilds the prompt: base, then non-chain blocks (global config, remote URLs, custom
    `instructions` entries) in their original order, then the full ancestor chain sorted
    outermost-first, then the custom system text back at the very end.

## Precedence model

The result matches Claude Code: the file closest to the cwd appears last and gets the highest
LLM weight; `/` is the outermost and weakest. The global config block
(`~/.config/opencode/AGENTS.md`) is left untouched at the start of the instructions.

If the cwd is not inside a git worktree, the plugin is a no-op — OpenCode already walks to `/`
natively in that case. If parsing finds no blocks (no instruction files loaded, or the upstream
format changed), the plugin appends the ancestor files without reordering. Any unexpected failure
degrades to a no-op; it never breaks the chat request.

## Runtime

The plugin ships as TypeScript sources with no build step: OpenCode executes plugins with Bun,
which transpiles TypeScript at import time. Bun strips types without checking them, so type
safety is enforced separately by `just typecheck`.

Git installs are cached under `~/.cache/opencode/packages/` and never auto-update — pin a new
tag or commit to upgrade. Path specs (absolute or `~/`-relative) resolve to the working tree
itself, so they always load the current code.

## Known limitations

- Blocks are recognized by their `Instructions from:` header line, so file content that itself
  contains such a line (pointing at an absolute path) splits a block in two.
- Per-prompt custom system text travels with the last block instead of staying at the end when
  the boundary cannot be recovered: the file changed on disk mid-request, or the last block is a
  remote URL.
