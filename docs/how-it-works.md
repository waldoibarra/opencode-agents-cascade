# How it works

The plugin transforms the first string in OpenCode's `output.system` array.
It relies on the experimental `experimental.chat.system.transform` hook and `Instructions from:` headers.
Those are integration assumptions, not a guarantee across future host versions.

For each hook call, the implementation:

1. Parses `system[0]` into base text and instruction blocks using absolute-path or URL headers.
2. Attempts to separate text appended after the last local block by rereading its file.
3. Looks above the worktree root for readable, nonempty files absent from native blocks.
4. Keeps non-chain blocks in relative order, then sorts the directory chain outermost-first.
5. Rebuilds `system[0]`, appending separated trailing text when available.

The walk checks `AGENTS.md` before `CLAUDE.md` in each ancestor directory.
Native `CONTEXT.md` blocks can join the sorted chain; the walker does not inject them.
The transform changes only `system[0]` and leaves other array entries alone.
For shared terms, see the [glossary](../GLOSSARY.md).

## Ordering and boundaries

A chain block must name `AGENTS.md`, `CLAUDE.md`, or `CONTEXT.md` at an ancestor directory.
Non-chain blocks stay ahead of the chain.
These include remote URLs and global configuration outside that path.
The code sorts chain blocks by path depth, then lexically at equal depth.
This determines prompt position, not which instructions a model obeys.
It does not reproduce every Claude Code loading rule.

With `/` as the non-git worktree sentinel, the plugin injects nothing.
It still sorts parsed native chain blocks.
If parsing finds no native blocks, it appends collected files only for a request with `sessionID`.
If nothing needs changing, the transform leaves the string as it was.

## Failure and format limits

- An `Instructions from:` line inside file content can be mistaken for another block.
- Trailing text remains attached to its block when the file changed, cannot be read, or names a URL.
- Other file content can resemble trailing text; the split relies on the last block's disk content.
- Empty or unreadable ancestor files are skipped; read errors do not reveal their contents.
- The entry hook catches thrown errors but does not undo mutations already made before an exception.
- Upstream prompt formats or hook behavior may change; tests use fabricated prompts, not a live host.

For installation and upgrade guidance, read [install and use](install.md).
For local development and verification, read [development](development.md).
