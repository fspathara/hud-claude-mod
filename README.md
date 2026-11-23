# claude-hud-mod

A HUD pane for [Claude Code](https://claude.com/claude-code). The HUD is a mod: a plugin of hooks that reloads while you work.

The pane shows the state of your session at a glance: the model, the context, the tool calls, the cost, the rate limits, and the prompt cache. It also shows the other Claude Code sessions that are open on your PC.

## What the pane shows

The pane has five sections:

- **Character**: a figure for the model, and more figures for more effort. The pane also shows the effort level and the output style.
- **Load**: the context bar and the subagents that run now. The pane also counts the tool calls of the main loop and of the subagents. It shows the most used tools and the last 5 calls.
- **Treasury**: the cost of the session, and the rate-limit windows with exact values.
- **Cache**: an arrow that flies to a target. A hit of 100% puts the arrow next to the target. The pane also shows the time left for the cache.
- **Sessions**: the other open sessions on this PC. Each row shows the project, the branch, the status (busy or idle), the context, the cost, and the time since the last update. Each row also has a summary line. The section also shows the summary of this session.

Rate limits show only on a subscription. The cost shows only when the host keeps a cost ledger.

## How the session list works

Each session writes one small JSON file to `<Claude config folder>/hud-sessions/<session ID>.json`. The file has the project folder name, the branch, the model, the status, the context, the cost, the last prompt, and the summary. The session writes the file at the start and at the end of each turn, and every 10 seconds. Every 5 seconds, the pane reads the files of the other sessions.

- The pane hides a session when its file has no update for 2 minutes, for example after a crash.
- At the end of a session, its file gets the status `ended`. The pane then hides the session at once.
- The mod cannot delete files, so old files stay in the folder. Each file is smaller than 1 KB. You can delete the folder at any time.
- Only sessions that load this mod show in the list. Cloud sessions and sessions on other PCs do not show.

The summary line has two parts (the `mixed` mode):

- **The last prompt.** This part is free. It shows until the first model summary is ready.
- **A Haiku summary.** The session sends its last 12 messages to Haiku and gets one short line about its task. This occurs after the first turn, and then every 5 turns. The **Summarize** button under a row asks that session for a new summary now.

With `sessionSummary` set to `local`, the pane shows only the last prompt, and the mod makes no model calls.

## Privacy and security

> **Warning:** This version changes the privacy promise of the earlier versions. The earlier README said: "Nothing leaves your PC". It also said that the mod does not read prompts, write files, or call a model. With the default options, these statements are no longer true. Read this section before you install or update the mod.

With the default options (`otherSessions: on`, `sessionSummary: mixed`):

- **Model calls.** The mixed summary sends the last 12 messages of each session to Haiku through the API client of Claude Code (`$.model.complete`). This is the same Anthropic API that your session already uses. Each summary adds a small cost to the session. The cost shows in `/cost`.
- **Prompts and messages.** The mod reads your last prompt and the last 12 messages of the session to make the summary line.
- **Files.** The mod writes one small file for each session to the `hud-sessions` folder in your Claude config folder. The file has your last prompt and the summary as plain text. Other programs on your PC that can read that folder can also read these files.
- **Git files.** The mod reads `.git/HEAD` in the working directory to show the branch.

What stays the same:

- The mod has no network code of its own. It makes no web request. The only data that leaves your PC is the Haiku summary request.
- The mod does not run programs.
- The mod does not read your project files or the output of your tools. The only exception is the text in the last 12 messages.

To make the mod local only again:

- Set `sessionSummary` to `local`. Then nothing leaves your PC. The mod still writes the session files.
- Set `otherSessions` to `off`. Then the mod writes and reads no files, and it does not read your prompts.

All the code is in `session-hud/hooks/`. You can read it before you install the mod.

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
| `otherSessions` | `on`, `off` | `on` | Show the other open sessions. `off` removes the Sessions section and all file access |
| `sessionSummary` | `mixed`, `local` | `mixed` | `mixed`: the last prompt and a Haiku summary. `local`: only the last prompt, with no model calls |

To change an option, run `/plugin` and open the configuration of `session-hud`.

The Sonic set uses emoji. Emoji have double width, so the row can look uneven in some terminals. The chess set uses single-width glyphs.

## Develop

1. Put the `session-hud` folder in your dev-mods folder, or start Claude Code with `claude --plugin-dir <path>/session-hud`.
2. Run `claude plugin validate session-hud`.
3. Run `claude plugin test session-hud`.

The hooks are in `session-hud/hooks/register.tsx`. The session list is in `session-hud/hooks/registry.ts` (file access and model calls) and in `session-hud/hooks/sessions.ts` (pure helpers). The tests are in `session-hud/tests/`.

To add a character set, add a list of 4 figures to the `piece` function in `session-hud/hooks/register.tsx`. The order is by model power.

## Repository layout

- `.claude-plugin/marketplace.json`: the marketplace file.
- `session-hud/`: the plugin.

## License

This project uses the [MIT License](LICENSE).
