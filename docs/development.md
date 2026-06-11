# Development

## Setup and commands

```sh
just setup              # install toolchain (mise), js dev deps, and git hooks
just test               # run the full test suite with Bun
just test-unit          # hermetic unit tests (no disk I/O)
just test-integration   # integration tests (real filesystem)
just typecheck          # strict tsc over src and tests
```

Toolchain details live in [toolchain.md](toolchain.md); git hook triggers in [hooks.md](hooks.md).

## Architecture

The core logic lives in `src/cascade.ts` as pure functions (parser, sorter, walker, transform)
with all filesystem access injected as parameters; `src/index.ts` is the thin plugin entry that
wires in the real filesystem and shields the chat request from any failure.

## Tests

Unit tests run on an in-memory fake filesystem with machine-neutral paths (`/Users/me/...`);
integration tests build and destroy their own temp directory trees. Both suites pass on any
machine — they never start OpenCode and are unaffected by whichever plugin install (git, path,
or none) is active.

Git hooks run typecheck, the full test suite, and the lints on every commit. CI runs the same
`just` recipes: code checks on code-affecting paths, lints on every push and PR
(`.github/workflows/`).

## Local plugin install

Reference the checkout directly in `opencode.json` to develop against live code (path specs load
the working tree, no cache):

```json
{
  "plugin": ["~/path/to/opencode-agents-cascade"]
}
```
