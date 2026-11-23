import { expect, test } from 'claude-code/testing'

import type { HudPeer } from '../types'
import {
  ago,
  branchOf,
  folderName,
  gitDirOf,
  hudDir,
  livePeers,
  needsSummary,
  oneLine,
  parsePeer,
  peerLine,
  peerStats,
  peerTitle,
  STALE_MS,
  summaryPrompt,
} from '../hooks/sessions'

const PANE = {
  component: 'Pane',
  requestId: 'session-hud',
  props: {
    title: 'Session HUD',
    isFocused: false,
    bodyColumns: 30,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 60 },
    view: {},
  },
} as const

function peer(over: Partial<HudPeer> = {}): HudPeer {
  return {
    id: 'a',
    project: 'claude-mods',
    branch: 'develop',
    model: 'claude-opus-5-5',
    status: 'idle',
    context: 42,
    cost: 1.2,
    prompt: 'add a sessions list',
    summary: '',
    updatedAt: 1_000_000,
    ...over,
  }
}

test('the shared folder is next to the projects folder', () => {
  expect(hudDir('C:\\Users\\me\\.claude\\projects\\D--x\\abc.jsonl')).toBe('C:/Users/me/.claude/hud-sessions')
  expect(hudDir('/home/me/.claude/projects/-x/abc.jsonl')).toBe('/home/me/.claude/hud-sessions')
  expect(hudDir('')).toBe(null)
})

test('the git helpers read the branch, a detached HEAD and a worktree', () => {
  expect(branchOf('ref: refs/heads/feature/x\n')).toBe('feature/x')
  expect(branchOf('0123456789abcdef\n')).toBe('0123456')
  expect(branchOf('garbage')).toBe(null)
  expect(gitDirOf('gitdir: D:/repo/.git/worktrees/wt\n', 'D:/wt')).toBe('D:/repo/.git/worktrees/wt')
  expect(gitDirOf('gitdir: ../repo/.git/worktrees/wt', '/w/wt')).toBe('/w/wt/../repo/.git/worktrees/wt')
  expect(gitDirOf('nothing', '/w')).toBe(null)
  expect(folderName('D:\\Projects\\claude-mods\\')).toBe('claude-mods')
})

test('a line is cut with an ellipsis', () => {
  expect(oneLine('a\n  b', 10)).toBe('a b')
  expect(oneLine('abcdefghij', 5)).toBe('abcd…')
})

test('a record parses only with all fields of the right type', () => {
  expect(parsePeer(JSON.stringify(peer()))).toEqual(peer())
  expect(parsePeer('not json')).toBe(null)
  expect(parsePeer(JSON.stringify({ ...peer(), status: 'sleeping' }))).toBe(null)
  expect(parsePeer(JSON.stringify({ ...peer(), cost: '1' }))).toBe(null)
})

test('the live list hides this session, ended sessions and old files, busy first', () => {
  const now = 2_000_000
  const list = livePeers(
    [
      peer({ id: 'self', updatedAt: now }),
      peer({ id: 'old', updatedAt: now - STALE_MS - 1 }),
      peer({ id: 'ended', status: 'ended', updatedAt: now }),
      peer({ id: 'idle', updatedAt: now - 10 }),
      peer({ id: 'busy', status: 'busy', updatedAt: now - 100 }),
    ],
    'self',
    now,
  )
  expect(list.map(p => p.id)).toEqual(['busy', 'idle'])
})

test('a summary is due after the first turn, each 5 turns, and on an ask', () => {
  expect(needsSummary(0, 0, false)).toBe(false)
  expect(needsSummary(1, 0, false)).toBe(true)
  expect(needsSummary(5, 1, false)).toBe(false)
  expect(needsSummary(6, 1, false)).toBe(true)
  expect(needsSummary(2, 1, true)).toBe(true)
})

test('the summary prompt keeps the last messages on one line each', () => {
  const text = summaryPrompt([
    { role: 'user', text: 'first\nline' },
    { role: 'assistant', text: '' },
  ])
  expect(text).toContain('user: first line')
  expect(text).not.toContain('assistant:')
})

test('the row text shows the facts, the summary or the prompt', () => {
  expect(peerTitle(peer())).toBe('claude-mods · develop')
  expect(peerTitle(peer({ branch: null }))).toBe('claude-mods')
  expect(peerStats(peer(), 1_000_000 + 3 * 60_000)).toBe('idle  42%  $1.20  3m')
  expect(peerStats(peer({ context: null, cost: null }), 1_000_000)).toBe('idle  now')
  expect(peerLine(peer())).toBe('> add a sessions list')
  expect(peerLine(peer({ summary: 'Builds the sessions list' }))).toBe('Builds the sessions list')
  expect(peerLine(peer({ prompt: '' }))).toBe('no prompt yet')
  expect(ago(2 * 3_600_000)).toBe('2h')
})

test('the pane shows the Sessions section with no other session', async $ => {
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'session-hud', surface, ...PANE })
    expect(await ui.find({ type: 'Text', text: /Sessions/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /no other session open/ })).toBeDefined()
    await ui.unmount()
  }
})

test('the pane has no Sessions section when the option is off', { options: { otherSessions: 'off' } }, async $ => {
  const ui = await $.ui.mount({ plugin: 'session-hud', surface: 'terminal', ...PANE })
  expect(await ui.find({ type: 'Text', text: /no other session open/ })).toBeUndefined()
  await ui.unmount()
})
