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

The core logic lives in `src/cascade.ts` and accepts injected filesystem callbacks.
`src/index.ts` wires in the filesystem and catches thrown hook errors.
The catch does not roll back changes already made to a prompt.

## Tests

Unit tests use an in-memory filesystem with synthetic paths (`/Users/me/...`).
Integration tests create temporary directory trees and do not start OpenCode.
They may also encounter actual files above their temporary roots; assertions check ordered subsequences.
An installed plugin is not needed to run these suites.

Pre-commit hooks select checks by staged-file glob.
Editorconfig always runs; Markdown, types, and tests run conditionally.
The commit-message hook checks commit text separately.
CI runs code checks on code-affecting paths; lint runs on every push to `main` and every PR.
See [hook triggers](hooks.md) and `.github/workflows/` for their precise scope.

## Releasing

Never move a published tag; existing installations may keep the cached revision.
For a docs-only release, use a new patch version instead of moving an existing tag.

1. Bump `version` in `package.json` following semver: patch for fixes and docs, minor for new
    behavior, major for breaking changes.
2. Commit it as `chore: release vX.Y.Z`.
3. Tag that commit: `git tag -a vX.Y.Z -m "<one-line summary>"`.
4. Push both: `git push && git push origin vX.Y.Z`.
5. Confirm CI is green on the tagged commit before pinning to it or announcing it.
6. Publish a GitHub Release for the tag with short notes: what changed and whether upgrading
    needs any action. Tags alone notify nobody — Releases reach watchers and the repo's
    `releases.atom` feed.

Consumers on a pinned spec upgrade by changing its ref.
See [upgrade instructions](install.md#upgrade) for cache limitations and unpinned installations.

## Local plugin install

Tests do not require an OpenCode plugin installation.
To inspect local changes during development, reference the checkout through a path spec.
Check the active session before assuming it has reloaded code from disk.

Reference the checkout in `~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["/absolute/path/to/opencode-agents-cascade"]
}
```

For ordinary use, see the [Git-backed installation](install.md#install).
A pinned ref identifies a revision; a path spec points at your changing checkout.
