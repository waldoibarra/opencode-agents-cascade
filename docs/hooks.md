# Git Hooks

Hooks are defined in `hk.pkl` and managed by `hk`.
`just setup` installs the toolchain, dependencies, and hooks; `just install-hooks` is a private recipe.

## Hook map

| Hook | Step | Trigger (glob) | Command |
| --- | --- | --- | --- |
| `pre-commit` | `editorconfig-checker` | all staged files | `just lint-ec` |
| `pre-commit` | `markdownlint-cli2` | `**/*.md`, `config/.markdownlint-cli2.yaml` | `just lint-md` |
| `pre-commit` | `typecheck` | `**/*.ts`, `tsconfig.json`, `package.json`, `bun.lock` | `just typecheck` |
| `pre-commit` | `test` | `src/**/*.ts`, `tests/**/*.ts`, `package.json`, `bun.lock` | `just test` |
| `commit-msg` | `committed` | — | `just lint-commit <msg_file>` |

The full test suite runs pre-commit when matching source, test, or manifest files are staged.
Integration tests create temporary files but may read paths above their temporary roots.
CI uses the same lint and test recipes with different event and path triggers.

## Reinstall hooks

```sh
just install-hooks   # private recipe: re-runs hk install
```

Run this after cloning or after modifying `hk.pkl`.
