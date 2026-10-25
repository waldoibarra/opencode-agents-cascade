# opencode-agents-cascade

[![Code checks](https://github.com/waldoibarra/opencode-agents-cascade/actions/workflows/code-checks.yml/badge.svg)](https://github.com/waldoibarra/opencode-agents-cascade/actions/workflows/code-checks.yml)
[![Lint](https://github.com/waldoibarra/opencode-agents-cascade/actions/workflows/lint.yml/badge.svg)](https://github.com/waldoibarra/opencode-agents-cascade/actions/workflows/lint.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Keep directory-specific instructions available when you work inside a git repository.
OpenCode may omit instruction files above its worktree root.
This plugin adds those files and places ancestor instruction blocks from outermost to innermost.

For example, consider a session inside `my-repo/sub`:

```text
/Users/
├── AGENTS.md
└── you/
    ├── AGENTS.md
    └── projects/
        ├── AGENTS.md
        └── my-repo/            ← git worktree
            ├── AGENTS.md
            └── sub/            ← current directory
                └── AGENTS.md
```

The plugin looks for missing files above `my-repo`, then orders the ancestor chain:
`/Users`, `/Users/you`, `/Users/you/projects`, `my-repo`, `my-repo/sub`.
It checks `AGENTS.md` first and falls back to `CLAUDE.md` in each directory.
Other prompt blocks may remain ahead of this chain.
The resulting order does not enforce instruction priority or guarantee model compliance.

The plugin depends on OpenCode's experimental system transform hook and instruction-header format.
A header inside file content can confuse parsing; some appended system text cannot be separated.
See [how it works and its limitations](docs/how-it-works.md) before relying on a specific order.

## Next steps

- [Install, use, or upgrade the plugin](docs/install.md).
- [Understand the plugin's behavior and limits](docs/how-it-works.md).
- [Develop or release the plugin](docs/development.md).
- [Look up project terminology](GLOSSARY.md).
- [Read the original problem and design research](PRD.md).

## License

[MIT](LICENSE)
