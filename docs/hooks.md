# Git Hooks

Hooks are defined in `hk.pkl` and managed by `hk`. Install with `just install-hooks`.

## Hook map

| Hook | Step | Trigger (glob) | Command |
| --- | --- | --- | --- |
| `pre-commit` | `editorconfig-checker` | all staged files | `just lint-ec` |
| `pre-commit` | `markdownlint-cli2` | `**/*.md`, `config/.markdownlint-cli2.yaml` | `just lint-md` |
| `pre-commit` | `typecheck` | `**/*.ts`, `tsconfig.json`, `package.json`, `bun.lock` | `just typecheck` |
| `pre-commit` | `test-unit` | `src/**/*.ts`, `tests/**/*.ts`, `package.json`, `bun.lock` | `just test-unit` |
| `commit-msg` | `committed` | — | `just lint-commit <msg_file>` |

Integration tests (`just test-integration`) are intentionally not hooked: they touch the real
filesystem and are meant for CI and explicit local runs.

## Reinstall hooks

```sh
just install-hooks   # re-runs hk install
```

Run this after cloning or after modifying `hk.pkl`.
