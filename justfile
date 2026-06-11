# Print available recipes
[private]
help:
  @just --list --unsorted

# Install all project dependencies.
[group("Setup")]
setup: install-tools install-hooks

# Install tools with Mise.
[group("Setup")]
[private]
install-tools:
  mise trust
  mise install

# Install Git Hooks.
[group("Setup")]
[private]
install-hooks:
  hk install

# Run the plugin test suite with Bun.
[group("Testing")]
test:
  bun test

# Typecheck all TypeScript sources with tsc.
[group("Testing")]
typecheck:
  bunx tsc --noEmit

# Use committed to lint a commit message file.
[private]
[group("Linting")]
lint-commit msg_file:
  committed --config config/committed.toml --commit-file {{ msg_file }}

# Use editorconfig-checker to lint all files against .editorconfig rules.
[private]
[group("Linting")]
lint-ec:
  ec

# Use markdownlint-cli2 to lint Markdown files.
[private]
[group("Linting")]
lint-md:
  markdownlint-cli2 --config config/.markdownlint-cli2.yaml "**/*.md"
