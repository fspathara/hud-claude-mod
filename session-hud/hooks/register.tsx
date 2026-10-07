import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { HudAgent, HudCache, HudContext, HudLimit } from '../types'

const PANE = 'session-hud'
const TITLE = 'Session HUD'

const EMPTY_CACHE: HudCache = {
  lastRead: 0,
  lastWrite: 0,
  lastUncached: 0,
  totalRead: 0,
  totalWrite: 0,
  totalUncached: 0,
  lastResponseAt: null,
}

const model = atom({ plugin: 'session-hud', key: 'model' } as const, '')
const effort = atom({ plugin: 'session-hud', key: 'effort' } as const, '')
const outputStyle = atom({ plugin: 'session-hud', key: 'outputStyle' } as const, 'default')
const context = atom({ plugin: 'session-hud', key: 'context' } as const, {
  percent: null,
  tokens: null,
  window: null,
} as HudContext)
const cache = atom({ plugin: 'session-hud', key: 'cache' } as const, EMPTY_CACHE)
const now = atom({ plugin: 'session-hud', key: 'now' } as const, 0)
const cost = atom({ plugin: 'session-hud', key: 'cost' } as const, null as number | null)
const limits = atom({ plugin: 'session-hud', key: 'limits' } as const, [] as HudLimit[])

const agents = atom({ plugin: 'session-hud', key: 'agents' } as const, [] as HudAgent[])

const ACTIVE = ['pending', 'running', 'waiting']
const MAX_AGENT_ROWS = 4

/** The agents that still work: running, waiting for a tool, or not yet started. */
export function activeAgents(list: HudAgent[]): HudAgent[] {
  return list.filter(a => ACTIVE.includes(a.status))
}

const GOLD = '#f2c230'
const RINGS = 10

/** The rings left in a window: one ring for each 10 % not yet used, as many as `RINGS`. */
export function ringsLeft(percentUsed: number): number {
  const left = Math.round(((100 - Math.min(100, Math.max(0, percentUsed))) / 100) * RINGS)
  return Math.min(RINGS, Math.max(0, left))
}

/** Dollars with two decimals, or three under one cent so a small cost does not show as zero. */
export function dollars(usd: number): string {
  return usd > 0 && usd < 0.01 ? `$${usd.toFixed(3)}` : `$${usd.toFixed(2)}`
}

/** Milliseconds as `Xd Yh`, `Xh Ym` or `Xm`. */
export function until(ms: number): string {
  const m = Math.max(0, Math.ceil(ms / 60_000))
  const d = Math.floor(m / 1440)
  const h = Math.floor((m % 1440) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m % 60}m`
  return `${m}m`
}

function limitName(kind: string): string {
  if (kind === 'five_hour') return '5-hour limit'
  if (kind === 'seven_day') return '7-day limit'
  if (kind === 'spend_limit') return 'Spend limit'
  return kind
}

const GREEN = '#2e7d32'
const ORANGE = '#ef6c00'
const RED = '#c62828'
const TRACK = '#3a3a3a'

/** Green under 40 %, orange under 65 %, red after. */
export function barColor(percent: number): string {
  if (percent < 40) return GREEN
  if (percent < 65) return ORANGE
  return RED
}

/** Cache reads over all input tokens, as a whole percentage; null with no input. */
export function hitPercent(read: number, write: number, uncached: number): number | null {
  const total = read + write + uncached
  return total === 0 ? null : Math.round((read / total) * 100)
}

/** Milliseconds as `m:ss`, or `h:mm:ss` from one hour. */
export function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

function tokens(n: number | null): string {
  if (n === null) return '?'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return String(n)
}

/** The bar's text: the label put in the middle of `width` cells. */
export function barText(label: string, width: number): string {
  const w = Math.max(label.length, width)
  const left = Math.floor((w - label.length) / 2)
  return ' '.repeat(left) + label + ' '.repeat(w - left - label.length)
}

const LEVELS = ['low', 'medium', 'high', 'xhigh', 'max']
const LEVEL_COLORS = ['#7a8b99', '#8fb573', '#e0b84a', '#e07a3a', '#d64545']
const SLOTS = LEVELS.length

export type Theme = 'sonic' | 'chess'

type Figure = { on: string; off: string | null; name: string }

/**
 * The figure of the model family, by power. Sonic: Tails, Sonic, Knuckles, Super Sonic.
 * Chess: pawn, knight, rook, queen, with an outline glyph for the empty slots.
 */
export function piece(model: string, theme: Theme = 'sonic'): Figure {
  const m = model.toLowerCase()
  const rank = m.includes('fable') ? 3 : m.includes('opus') ? 2 : m.includes('sonnet') ? 1 : 0
  if (theme === 'chess') {
    return [
      { on: '♟', off: '♙', name: 'Pawn' },
      { on: '♞', off: '♘', name: 'Knight' },
      { on: '♜', off: '♖', name: 'Rook' },
      { on: '♛', off: '♕', name: 'Queen' },
    ][rank]
  }
  return [
    { on: '🦊', off: null, name: 'Tails' },
    { on: '🦔', off: null, name: 'Sonic' },
    { on: '🥊', off: null, name: 'Knuckles' },
    { on: '⭐', off: null, name: 'Super Sonic' },
  ][rank]
}

/** Filled slots for an effort level (1 to 5); 0 when the effort is unknown or a plain number. */
export function troops(effort: string): number {
  return LEVELS.indexOf(effort) + 1
}

/** A section title with a rule that fills the line: `── Load ─────`. */
export function heading(title: string, width: number): string {
  const head = `── ${title} `
  return head + '─'.repeat(Math.max(0, width - head.length))
}

/** An arrow that flies toward the target: the closer the hit share is to 100, the closer the arrow. */
export function arrowTrack(hit: number | null, cells: number): string {
  const n = Math.max(3, cells)
  if (hit === null) return '·'.repeat(n) + ' 🎯'
  const pos = Math.round((Math.min(100, Math.max(0, hit)) / 100) * (n - 1))
  return '·'.repeat(pos) + '➤' + '·'.repeat(n - 1 - pos) + ' 🎯'
}

export const register: Register = (on, options) => {
  const theme: Theme = options.characters === 'chess' ? 'chess' : 'sonic'
  const ttlMs = options.cacheTtl === '5m' ? 5 * 60_000 : 60 * 60_000

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'hud',
      description: 'Show the session HUD pane (model, output style, context, cache)',
    })
    await update($, model, () => '')
    const settings = await $.settings.read()
    const style = typeof settings.outputStyle === 'string' ? settings.outputStyle : 'default'
    await update($, outputStyle, () => style)
    void $.session.model().then(m => update($, model, () => m))

    // Redraw the expiry timer one time each second.
    $.clock.every(1000, () => {
      void update($, now, () => Date.now())
      void $.agent.list().then(list =>
        update($, agents, () =>
          list.map(a => ({ id: a.id, type: a.type, description: a.description, status: a.status })),
        ),
      )
    })
    void $.ui.open({ id: PANE, title: TITLE })

    return next(e)
  })

  on('command.run', { command: 'hud' }, async $ => {
    // Read the cost and the limits now: no request may have happened since the load.
    const usage = await $.session.usage()
    await update($, cost, () => usage.cost?.usd ?? null)
    await update($, limits, () =>
      usage.rateLimits.map(r => ({ kind: r.kind, percentUsed: r.percentUsed, resetsAt: r.resetsAt ?? null })),
    )
    await $.ui.open({ id: PANE, title: TITLE })

    return {
      text:
        usage.rateLimits.length === 0
          ? 'Session HUD pane opened. The engine gives no rate limits yet.'
          : 'Session HUD pane opened.',
    }
  })

  // The output style can change during the session; each request composes it again.
  on('prompt.compose', async ($, e, next) => {
    const result = await next(e)
    const style = e.outputStyle?.name ?? 'default'
    await update($, outputStyle, () => style)

    return result
  })

  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined) await update($, effort, () => (e.effort === undefined ? '' : String(e.effort)))
    const result = yield* next(e)
    // Subagents have their own cache prefix; count the main loop only.
    if (e.agentId !== undefined || result.usage === null) return result

    const u = result.usage
    const at = Date.now()
    await update($, model, () => u.model || e.model)
    await update($, cache, c => ({
      lastRead: u.cache_read_input_tokens,
      lastWrite: u.cache_creation_input_tokens,
      lastUncached: u.input_tokens,
      totalRead: (c ?? EMPTY_CACHE).totalRead + u.cache_read_input_tokens,
      totalWrite: (c ?? EMPTY_CACHE).totalWrite + u.cache_creation_input_tokens,
      totalUncached: (c ?? EMPTY_CACHE).totalUncached + u.input_tokens,
      lastResponseAt: at,
    }))
    const usage = await $.session.usage()
    await update($, cost, () => usage.cost?.usd ?? null)
    await update($, limits, () =>
      usage.rateLimits.map(r => ({ kind: r.kind, percentUsed: r.percentUsed, resetsAt: r.resetsAt ?? null })),
    )
    await update($, context, () => ({
      percent: usage.context.percent ?? null,
      tokens: usage.context.tokens ?? null,
      window: usage.context.window,
    }))

    return result
  })

  // A /clear starts a new conversation: the old cache prefix and context are gone.
  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      await update($, cache, () => EMPTY_CACHE)
      await update($, context, () => ({ percent: null, tokens: null, window: null }))
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const width = Math.max(10, e.props.bodyColumns)

    const m = await read($, model)
    const eff = await read($, effort)
    const all = await read($, agents)
    const busy = activeAgents(all)
    const spent = await read($, cost)
    const windows = await read($, limits)
    const n = troops(eff)
    const army = piece(m, theme)
    const rule = '─'.repeat(width)
    const style = await read($, outputStyle)
    const ctx = await read($, context)
    const c = await read($, cache)
    const t = (await read($, now)) || Date.now()

    // Context bar: the filled part in the level color, the rest dark; white text on both.
    const pct = ctx.percent
    const label = pct === null ? 'no data' : `${pct}%  ${tokens(ctx.tokens)}/${tokens(ctx.window)}`
    const text = barText(label, width)
    const filled = pct === null ? 0 : Math.min(width, Math.round((Math.min(pct, 100) / 100) * width))
    const color = barColor(pct ?? 0)

    const lastHit = hitPercent(c.lastRead, c.lastWrite, c.lastUncached)
    const totalHit = hitPercent(c.totalRead, c.totalWrite, c.totalUncached)
    const fmtHit = (p: number | null) => (p === null ? '-' : `${p}% hit / ${100 - p}% miss`)

    let expiry = 'no request yet'
    let expiryColor: string = 'inactive'
    if (c.lastResponseAt !== null) {
      const left = c.lastResponseAt + ttlMs - t
      if (left > 0) {
        expiry = `${clock(left)} left (${options.cacheTtl})`
        expiryColor = left < 60_000 ? 'warning' : 'success'
      } else {
        expiry = 'expired'
        expiryColor = 'error'
      }
    }

    const lastTrack = arrowTrack(lastHit, Math.min(14, width - 4))
    const totalTrack = arrowTrack(totalHit, Math.min(14, width - 4))
    const hitColor = (p: number | null) => (p === null ? 'inactive' : p >= 80 ? 'success' : p >= 50 ? 'warning' : 'error')

    return (
      <Box flexDirection="column">
        <Text bold color={GOLD}>{heading('Character', width)}</Text>
        <Text>
          {Array.from({ length: SLOTS }, (_, i) => (
            <Text key={i} color={TRACK}>
              {i < n ? army.on + ' ' : army.off === null ? ' · ' : army.off + ' '}
            </Text>
          ))}
        </Text>
        <Text wrap="truncate-end">
          <Text bold>{army.name}</Text>
          <Text dimColor>{`  ${m || '?'}`}</Text>
        </Text>
        <Text wrap="truncate-end">
          <Text dimColor>{'Effort  '}</Text>
          <Text color={n > 0 ? LEVEL_COLORS[n - 1] : 'inactive'}>{eff === '' ? 'none' : eff}</Text>
        </Text>
        <Text wrap="truncate-end">
          <Text dimColor>{'Style   '}</Text>
          <Text>{style}</Text>
        </Text>
        <Text> </Text>
        <Text bold color={GOLD}>{heading('Load', width)}</Text>
        <Box flexDirection="row">
          {filled > 0 && (
            <Text color="white" backgroundColor={color} bold>
              {text.slice(0, filled)}
            </Text>
          )}
          {filled < text.length && (
            <Text color="white" backgroundColor={TRACK}>
              {text.slice(filled)}
            </Text>
          )}
        </Box>
        <Text wrap="truncate-end" color={busy.length > 0 ? 'success' : 'inactive'}>
          {'Subagents  '}
          {busy.length > 0 ? `${busy.length} running` : 'none running'}
          {all.length > busy.length ? `, ${all.length - busy.length} done` : ''}
        </Text>
        {busy.slice(0, MAX_AGENT_ROWS).map(a => (
          <Text key={a.id} wrap="truncate-end" dimColor>
            {`${a.type}: ${a.description}`}
          </Text>
        ))}
        {busy.length > MAX_AGENT_ROWS && <Text dimColor>{`and ${busy.length - MAX_AGENT_ROWS} more`}</Text>}
        <Text> </Text>
        <Text bold color={GOLD}>{heading('Treasury', width)}</Text>
        {spent !== null && (
          <Text wrap="truncate-end">
            <Text color={GOLD}>{'● '}</Text>
            <Text bold color={GOLD}>{dollars(spent)}</Text>
            <Text dimColor>{'  this session'}</Text>
          </Text>
        )}
        {windows.map(w => {
          const left = ringsLeft(w.percentUsed)
          const reset = w.resetsAt === null ? null : Date.parse(w.resetsAt) - t
          return (
            <Box key={w.kind} flexDirection="column">
              <Text dimColor>{limitName(w.kind)}</Text>
              <Text>
                <Text color={GOLD}>{'● '.repeat(left)}</Text>
                <Text color={TRACK}>{'○ '.repeat(RINGS - left)}</Text>
              </Text>
              <Text wrap="truncate-end">
                {`${w.percentUsed}% used`}
                {reset !== null && reset > 0 ? `, resets in ${until(reset)}` : ''}
              </Text>
            </Box>
          )
        })}
        {spent === null && windows.length === 0 && <Text dimColor>no data yet</Text>}
        <Text> </Text>
        <Text bold color={GOLD}>{heading('Cache', width)}</Text>
        <Text dimColor>Last request</Text>
        <Text wrap="truncate-end">{lastTrack}</Text>
        <Text color={hitColor(lastHit)} wrap="truncate-end">{fmtHit(lastHit)}</Text>
        <Text dimColor>Session</Text>
        <Text wrap="truncate-end">{totalTrack}</Text>
        <Text color={hitColor(totalHit)} wrap="truncate-end">{fmtHit(totalHit)}</Text>
        <Text wrap="truncate-end">
          <Text dimColor>{'Expires  '}</Text>
          <Text color={expiryColor}>{expiry}</Text>
        </Text>
      </Box>
    )
  })
}
