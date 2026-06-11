# Git Hooks

Hooks are defined in `hk.pkl` and managed by `hk`. Install with `just install-hooks`.

## Hook map

| Hook | Step | Trigger (glob) | Command |
| --- | --- | --- | --- |
| `pre-commit` | `editorconfig-checker` | all staged files | `just lint-ec` |
| `pre-commit` | `markdownlint-cli2` | `**/*.md`, `config/.markdownlint-cli2.yaml` | `just lint-md` |
| `pre-commit` | `typecheck` | `**/*.ts`, `tsconfig.json`, `package.json`, `bun.lock` | `just typecheck` |
| `pre-commit` | `test` | `src/**/*.ts`, `tests/**/*.ts`, `package.json`, `bun.lock` | `just test` |
| `commit-msg` | `committed` | — | `just lint-commit <msg_file>` |

The full suite (unit + integration) runs pre-commit: it completes in well under a second and the
integration tests only touch self-created temp directories, so there is no environmental flake to
protect the hook from. CI runs the same recipes on a clean machine.

## Reinstall hooks

```sh
just install-hooks   # re-runs hk install
```

Run this after cloning or after modifying `hk.pkl`.
