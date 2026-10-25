# Install and use the plugin

Add the Git-backed plugin to OpenCode, then start a new session to use it.
This guide covers installation, version selection, use, and upgrades.

## Install

Add the plugin to `~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["opencode-agents-cascade@git+https://github.com/waldoibarra/opencode-agents-cascade.git"]
}
```

You can pin a tag or commit by adding `#v1.0.0` or `#<sha>` to the spec.
The package entry points to TypeScript source.
This installation assumes your OpenCode version loads that entry with Bun; verify its current behavior.
See [how it works](how-it-works.md) for ordering and limitations.

## Use

Start OpenCode inside a project after configuring the plugin.
For a diagnostic prompt, ask:

> What "Instructions from:" headers are in your system prompt, in order?

The answer is a model report, not proof of which files the host loaded.
Avoid testing with private ancestor files when sharing prompt output.

## Upgrade

For a pinned installation, change the ref in the plugin spec and start a new session.
A previously installed Git ref may remain cached; changing the ref requests another installation.
For an unpinned installation, check OpenCode's current cache behavior before expecting updates.
If necessary, remove only this plugin's cached installation and restart OpenCode.
Earlier documentation reported `~/.cache/opencode/packages/`, with `$XDG_CACHE_HOME` overrides.
That location remains unverified against a running OpenCode version.
Check the exact installed path before deleting files.

For a live checkout during development, see [local plugin install](development.md#local-plugin-install).
