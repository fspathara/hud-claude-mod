import { expect, test } from 'claude-code/testing'

import { barColor, barText, clock, hitPercent, piece, troops, ringsLeft, dollars, until, activeAgents, heading, arrowTrack, addCall, topTools } from '../hooks/register'

const PANE = {
  component: 'Pane',
  requestId: 'session-hud',
  props: {
    title: 'Session HUD',
    isFocused: false,
    bodyColumns: 30,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

test('the bar color follows the context thresholds', async () => {
  expect(barColor(0)).toBe('#2e7d32')
  expect(barColor(39)).toBe('#2e7d32')
  expect(barColor(40)).toBe('#ef6c00')
  expect(barColor(64)).toBe('#ef6c00')
  expect(barColor(65)).toBe('#c62828')
  expect(barColor(100)).toBe('#c62828')
})

test('the hit percentage counts cache reads over all input', async () => {
  expect(hitPercent(0, 0, 0)).toBe(null)
  expect(hitPercent(90, 5, 5)).toBe(90)
  expect(hitPercent(0, 100, 0)).toBe(0)
})

test('the timer and the bar text have the expected form', async () => {
  expect(clock(65_000)).toBe('1:05')
  expect(clock(3_600_000)).toBe('1:00:00')
  expect(barText('50%', 9)).toBe('   50%   ')
})

test('the pane draws before the first request on each surface', async $ => {
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'session-hud', surface, ...PANE })
    expect(await ui.find({ type: 'Text', text: /Character/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /no request yet/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /no data/ })).toBeDefined()
    await ui.unmount()
  }
})

test('the piece follows the model family and the troops follow the effort', () => {
  expect(piece('claude-opus-5-5').name).toBe('Knuckles')
  expect(piece('claude-sonnet-5-5').name).toBe('Sonic')
  expect(piece('claude-haiku-4-5-20251001').name).toBe('Tails')
  expect(piece('').name).toBe('Tails')
  expect(piece('claude-opus-5-5', 'chess').name).toBe('Rook')
  expect(piece('claude-opus-5-5', 'chess').off).toBe('♖')
  expect(piece('claude-opus-5-5', 'sonic').off).toBe(null)
  expect(troops('low')).toBe(1)
  expect(troops('max')).toBe(5)
  expect(troops('')).toBe(0)
})

test('the rings, the cost and the reset time have the expected form', () => {
  expect(ringsLeft(0)).toBe(10)
  expect(ringsLeft(23.5)).toBe(8)
  expect(ringsLeft(100)).toBe(0)
  expect(ringsLeft(120)).toBe(0)
  expect(dollars(1.234)).toBe('$1.23')
  expect(dollars(0.004)).toBe('$0.004')
  expect(dollars(0)).toBe('$0.00')
  expect(until(45 * 60_000)).toBe('45m')
  expect(until(134 * 60_000)).toBe('2h 14m')
  expect(until(3 * 86_400_000 + 5 * 3_600_000)).toBe('3d 5h')
})

test('only the agents that still work count as active', () => {
  const a = (status: string) => ({ id: status, type: 'Explore', description: 'x', status })
  const list = [a('running'), a('waiting'), a('pending'), a('completed'), a('failed'), a('killed'), a('idle')]
  expect(activeAgents(list).map(x => x.status)).toEqual(['running', 'waiting', 'pending'])
})

test('the heading fills the line and the arrow flies to the target', () => {
  expect(heading('Load', 12)).toBe('── Load ────')
  expect(arrowTrack(0, 5)).toBe('➤···· 🎯')
  expect(arrowTrack(100, 5)).toBe('····➤ 🎯')
  expect(arrowTrack(null, 5)).toBe('····· 🎯')
})

test('a call goes to the main loop or the subagents, by its result', () => {
  const zero = { main: { ok: 0, failed: 0 }, sub: { ok: 0, failed: 0 }, tools: {}, recent: [] }
  const a = addCall(addCall(zero, false, true, 'Bash'), false, false, 'Edit')
  expect(a).toEqual({ main: { ok: 1, failed: 1 }, sub: { ok: 0, failed: 0 }, tools: { Bash: 1, Edit: 1 }, recent: [{ tool: 'Bash', ok: true, sub: false }, { tool: 'Edit', ok: false, sub: false }] })
  const b = addCall(a, true, true, 'Bash')
  expect(b.sub).toEqual({ ok: 1, failed: 0 })
  expect(b.recent[2]).toEqual({ tool: 'Bash', ok: true, sub: true })
  let many = zero
  for (let i = 0; i < 8; i++) many = addCall(many, false, true, `T${i}`)
  expect(many.recent.map(r => r.tool)).toEqual(['T3', 'T4', 'T5', 'T6', 'T7'])
  expect(addCall({ ...zero, recent: undefined } as never, false, true, 'Bash').recent).toHaveLength(1)
  expect(topTools(undefined)).toEqual([])
  expect(topTools(b.tools)).toEqual([['Bash', 2], ['Edit', 1]])
})
