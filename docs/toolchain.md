# Toolchain

All tools are managed by mise and pinned to `latest` in `mise.toml`.

## Tools

| Tool | Role | Config | Installed via |
| --- | --- | --- | --- |
| [mise](https://mise.jdx.dev) | Tool version manager | `mise.toml` | system |
| [bun](https://bun.sh) | Plugin runtime and test runner (`bun test`) | `package.json` | mise |
| [typescript](https://www.typescriptlang.org) | Typechecker (`just typecheck`) | `tsconfig.json` | bun (devDependency) |
| [just](https://just.systems) | Task runner | `justfile` | system |
| [hk](https://github.com/jdx/hk) | Git hooks manager | `hk.pkl` | mise |
| [committed](https://github.com/crate-ci/committed) | Commit message linter | `config/committed.toml` | mise |
| [editorconfig-checker](https://editorconfig-checker.github.io) (`ec`) | Validates files against `.editorconfig` | `.editorconfig` | mise |
| [markdownlint-cli2](https://github.com/DavidAnson/markdownlint-cli2) | Markdown linter | `config/.markdownlint-cli2.yaml` | mise |
| [pkl](https://pkl-lang.org) | Config language runtime (used by hk) | — | mise |

## Commit message rules (`config/committed.toml`)

- Style: conventional commits (`feat:`, `fix:`, `chore:`, etc.)
- Subject capitalization: off (lowercase subject required)
- Subject length: 50
- Body and footer length: 72

> This is not a linted rule, but use the commit header to explain the what, the body for the why and
> the footer for breaking changes and refs.

## Markdown rules (`config/.markdownlint-cli2.yaml`)

- Line length: 100 chars (tables and code blocks exempt)
- Emphasis: `_underscores_`, bold: `**asterisks**`
- Unordered lists: `-` dashes
- No multiple consecutive blank lines
- Single H1 per file; frontmatter `title:` not counted as H1
