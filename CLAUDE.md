# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This repository is a Claude Code marketplace (`.claude-plugin/marketplace.json`). It has one plugin: `session-hud`. The plugin is a mod. It draws a HUD pane with the model, effort, output style, context, subagents, tool calls, cost, rate limits and prompt cache. The `README.md` describes the user options (`characters`, `cacheTtl`) and the install steps.

## Security rule

Nothing leaves the user PC. The mod has no network code, no file access, no process calls, and no model calls. Do not add any of these. The `README.md` makes this claim to users, so keep both files true.

## Commands

There is no `package.json`. The Claude Code CLI does the validation and the tests:

- `claude plugin validate session-hud` validates the plugin.
- `claude plugin test session-hud` runs the tests in `session-hud/tests/hud.test.ts`.
- `claude --plugin-dir <path>/session-hud` loads the plugin for a manual test. Run `/hud` to open the pane.

## Architecture

All logic is in one module: `session-hud/hooks/register.tsx`. `hooks/hooks.json` loads it. It exports a `register` function that subscribes to engine events with `on(...)`.

- **State**: each value is an `atom` with the key `{ plugin: 'session-hud', key }`. Hooks write with `update($, atom, fn)`. The `ui.render` hook reads with `read($, atom)`.
- **Event flow**:
  - `session.start` registers the `/hud` command, opens the pane, and starts a 1-second `$.clock.every` timer. The timer refreshes `now` and the subagent list.
  - `turn.step` runs for the main loop only (`e.agentId === undefined`). It records the cache usage, the cost, the rate limits and the context.
  - `tool.call` counts each call as ok or failed, for the main loop and for subagents.
  - `prompt.compose` tracks the output style.
  - `session.end` with reason `clear` resets the cache, calls and context.
  - `ui.render` (component `Pane`, request ID `session-hud`) draws the pane.
- **Pure helpers** (`barColor`, `hitPercent`, `clock`, `piece`, `addCall`, `topTools` and others) are exported from `register.tsx`. The tests import them directly. Put new logic in an exported pure function, and test it.
- **Saved state**: an atom value from an older load can lack newer fields (for example `calls.recent` and `calls.tools`). Code that reads these fields must handle `undefined`.
- **Types**: `session-hud/types/index.d.ts` has the `Hud*` types. The engine writes its own types to `session-hud/.claude-plugin/types/`. Git ignores this folder, and `tsconfig.json` extends it.
- **Plugin options**: `userConfig` in `session-hud/.claude-plugin/plugin.json` defines the options. The `register` function gets them as `options`. To add a character set, edit the `piece` function.
