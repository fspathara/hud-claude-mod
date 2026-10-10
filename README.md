# claude-hud-mod

A HUD pane for [Claude Code](https://claude.com/claude-code). The HUD is a mod: a plugin of hooks that reloads while you work.

The pane shows the state of your session at a glance: the model, the context, the tool calls, the cost, the rate limits, and the prompt cache.

## What the pane shows

The pane has four sections:

- **Character**: a figure for the model, and more figures for more effort. The pane also shows the effort level and the output style.
- **Load**: the context bar and the subagents that run now. The pane also counts the tool calls of the main loop and of the subagents. It shows the most used tools and the last 5 calls.
- **Treasury**: the cost of the session, and the rate-limit windows with exact values.
- **Cache**: an arrow that flies to a target. A hit of 100% puts the arrow next to the target. The pane also shows the time left for the cache.

Rate limits show only on a subscription. The cost shows only when the host keeps a cost ledger.

## Privacy and security

Nothing leaves your PC. The mod sends no data to any server.

- The mod has no network code. It makes no web request.
- The mod does not read or write files, run programs, or call a model.
- The mod reads only the data that Claude Code gives to its hooks: the model, the usage, the settings, and the tool names.
- The mod keeps its values in the memory of the session. It does not save them across sessions.
- The mod does not read your prompts, the content of your files, or the output of your tools.

All the code is in `session-hud/hooks/register.tsx`. You can read it before you install the mod.

## Install

1. Run `/plugin marketplace add fspathara/hud-claude-mod`. You can also use a local path.
2. Run `/plugin install session-hud@claude-hud-mod`.
3. Run `/hud` to open the pane.

At the start of a session, the pane opens by itself from 144 terminal columns. In a narrower terminal, run `/hud`.

## Options

| Option | Values | Default | Use |
|---|---|---|---|
| `characters` | `sonic`, `chess` | `sonic` | The figures for the model and the effort |
| `cacheTtl` | `5m`, `1h` | `1h` | The time that the prompt cache stays warm |

To change an option, run `/plugin` and open the configuration of `session-hud`.

The Sonic set uses emoji. Emoji have double width, so the row can look uneven in some terminals. The chess set uses single-width glyphs.

## Develop

1. Put the `session-hud` folder in your dev-mods folder, or start Claude Code with `claude --plugin-dir <path>/session-hud`.
2. Run `claude plugin validate session-hud`.
3. Run `claude plugin test session-hud`.

All logic is in `session-hud/hooks/register.tsx`. The tests are in `session-hud/tests/hud.test.ts`.

To add a character set, add a list of 4 figures to the `piece` function in `session-hud/hooks/register.tsx`. The order is by model power.

## Repository layout

- `.claude-plugin/marketplace.json`: the marketplace file.
- `session-hud/`: the plugin.

## License

This project uses the [MIT License](LICENSE).
