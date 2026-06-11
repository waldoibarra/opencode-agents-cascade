# Print available recipes
[private]
help:
  @just --list --unsorted

# Install all project dependencies and set up some symlinks.
[group("Setup")]
setup: install-tools install-hooks

# Install tools with Mise.
[group("Setup")]
install-tools:
  mise trust
  mise install

# Install Git Hooks.
[group("Setup")]
install-hooks:
  hk install

# Use committed to lint a commit message file.
[group("Linting")]
lint-commit msg_file:
  committed --config config/committed.toml --commit-file {{ msg_file }}

# Use editorconfig-checker to lint all files against .editorconfig rules.
[group("Linting")]
lint-ec:
  ec

# Use markdownlint-cli2 to lint Markdown files.
[group("Linting")]
lint-md:
  markdownlint-cli2 --config config/.markdownlint-cli2.yaml "**/*.md"
