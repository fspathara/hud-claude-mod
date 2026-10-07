# claude-hud-mod

A HUD pane for Claude Code. It is a mod: a plugin of hooks that reloads while you work.

## What the pane shows

The pane has four sections:

- **Character**: a figure for the model, and more figures for more effort. The pane also shows the effort level and the output style.
- **Load**: the context bar and the subagents that run now.
- **Treasury**: the cost of the session, and the rate-limit windows with exact values.
- **Cache**: an arrow that flies to a target. A hit of 100% puts the arrow next to the target. The pane also shows the time left for the cache.

Rate limits show only on a subscription. The cost shows only when the host keeps a cost ledger.

## Install

1. Run `/plugin marketplace add <path-or-owner/repo>`.
2. Run `/plugin install session-hud@claude-hud-mod`.
3. Run `/hud` to open the pane.

At the start of a session, the pane opens by itself from 144 terminal columns. In a narrower terminal, run `/hud`.

## Options

| Option | Values | Default | Use |
|---|---|---|---|
| `characters` | `sonic`, `chess` | `sonic` | The figures for the model and the effort |
| `cacheTtl` | `5m`, `1h` | `1h` | The time that the prompt cache stays warm |

The Sonic set uses emoji. Emoji have double width, so the row can look uneven in some terminals. The chess set uses single-width glyphs.

## Develop

1. Put the `session-hud` folder in your dev-mods folder, or start Claude Code with `claude --plugin-dir <path>/session-hud`.
2. Run `claude plugin validate session-hud`.
3. Run `claude plugin test session-hud`.

To add a character set, add a list of 4 figures to the `piece` function in `session-hud/hooks/register.tsx`. The order is by model power.
