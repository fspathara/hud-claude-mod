# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This repository is a Claude Code marketplace (`.claude-plugin/marketplace.json`). It has one plugin: `session-hud`. The plugin is a mod. It draws a HUD pane with the model, effort, output style, context, subagents, tool calls, cost, rate limits and prompt cache. It also lists the other open sessions on the PC, with a summary for each. The `README.md` describes the user options (`characters`, `cacheTtl`, `otherSessions`, `sessionSummary`) and the install steps.

## Security rule

The mod has no network code and no process calls. Do not add them.

Only the session list uses file access and model calls. Keep them in `hooks/registry.ts`:

- File access: the session files in `<config dir>/hud-sessions/`, and `.git/HEAD` for the branch. The option `otherSessions: off` stops all file access.
- Model calls: only the Haiku summary (`$.model.complete`). The option `sessionSummary: local` stops all model calls.

The "Privacy and security" section of `README.md` lists what the mod reads, writes, and sends. If you change this behavior, update that section in the same change.

## Commands

There is no `package.json`. The Claude Code CLI does the validation and the tests:

- `claude plugin validate session-hud` validates the plugin.
- `claude plugin test session-hud` runs the tests in `session-hud/tests/`.
- `claude --plugin-dir <path>/session-hud` loads the plugin for a manual test. Run `/hud` to open the pane.

## Architecture

`hooks/hooks.json` loads `session-hud/hooks/register.tsx`. It imports `registry.ts` (the session files and the summary calls) and `sessions.ts` (pure helpers for the session list). It exports a `register` function that subscribes to engine events with `on(...)`.

- **State**: each value is an `atom` with the key `{ plugin: 'session-hud', key }`. Hooks write with `update($, atom, fn)`. The `ui.render` hook reads with `read($, atom)`.
- **Event flow**:
  - `session.start` registers the `/hud` command, opens the pane, and starts a 1-second `$.clock.every` timer. The timer refreshes `now` and the subagent list.
  - `turn.step` runs for the main loop only (`e.agentId === undefined`). It records the cache usage, the cost, the rate limits and the context.
  - `tool.call` counts each call as ok or failed, for the main loop and for subagents.
  - `prompt.compose` tracks the output style.
  - `prompt.submit` keeps the last prompt. `turn.start` and `turn.complete` (main loop only) set the busy status and send a heartbeat. `turn.complete` also makes a Haiku summary when one is due.
  - Every 5 seconds, the timer reads the other sessions and answers a Summarize ask. Every 10 seconds, it sends a heartbeat.
  - `session.end` marks the session file as `ended`. With reason `clear`, it also resets the cache, calls, context, prompt and summary.
  - `ui.render` (component `Pane`, request ID `session-hud`) draws the pane.
- **Atoms in more than one file**: the validator reads only the atoms that a file declares itself. `registry.ts` declares the atoms it uses again, with the same keys.
- **Pure helpers** (`barColor`, `hitPercent`, `clock`, `piece`, `addCall`, `topTools` and others) are exported from `register.tsx`. The tests import them directly. Put new logic in an exported pure function, and test it.
- **Saved state**: an atom value from an older load can lack newer fields (for example `calls.recent` and `calls.tools`). Code that reads these fields must handle `undefined`.
- **Types**: `session-hud/types/index.d.ts` has the `Hud*` types. The engine writes its own types to `session-hud/.claude-plugin/types/`. Git ignores this folder, and `tsconfig.json` extends it.
- **Plugin options**: `userConfig` in `session-hud/.claude-plugin/plugin.json` defines the options. The `register` function gets them as `options`. To add a character set, edit the `piece` function.
