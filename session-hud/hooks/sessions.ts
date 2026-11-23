import type { HudPeer, HudPeerStatus } from '../types'

/** A session with no heartbeat for this time is gone (closed, or it crashed). */
export const STALE_MS = 2 * 60_000

/** The model summary of a session is made again after this many main-loop turns. */
export const SUMMARY_EVERY = 5

/** The most messages that go into one summary request. */
export const SUMMARY_MESSAGES = 12

const STATUSES: HudPeerStatus[] = ['busy', 'idle', 'ended']

/**
 * The shared folder of the session files: `<config dir>/hud-sessions`.
 * The config dir is the parent of `projects/` in the transcript path. Null when the path has no `projects/`.
 */
export function hudDir(transcriptPath: string): string | null {
  const p = transcriptPath.replace(/\\/g, '/')
  const i = p.lastIndexOf('/projects/')
  return i < 0 ? null : `${p.slice(0, i)}/hud-sessions`
}

/** The text on one line, cut to `max` characters with an ellipsis. */
export function oneLine(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, Math.max(0, max - 1))}…` : t
}

/** The last part of a path: the folder name of the project. */
export function folderName(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/').filter(Boolean)
  return parts.at(-1) ?? path
}

/** The branch from the text of `.git/HEAD`, or the short commit on a detached HEAD; null for other text. */
export function branchOf(head: string): string | null {
  const t = head.trim()
  const ref = /^ref: refs\/heads\/(.+)$/.exec(t)
  if (ref) return ref[1] ?? null
  return /^[0-9a-f]{7,}$/.test(t) ? t.slice(0, 7) : null
}

/** The git dir that a `.git` file of a worktree points to, or null when the text is not a `gitdir:` line. */
export function gitDirOf(dotGitFile: string, cwd: string): string | null {
  const m = /^gitdir: (.+)$/m.exec(dotGitFile.trim())
  if (!m?.[1]) return null
  const dir = m[1].trim().replace(/\\/g, '/')
  return /^([a-zA-Z]:)?\//.test(dir) ? dir : `${cwd.replace(/\\/g, '/')}/${dir}`
}

function isNumberOrNull(v: unknown): v is number | null {
  return v === null || typeof v === 'number'
}

/** A session record from the text of its file, or null when the text is not a valid record. */
export function parsePeer(text: string): HudPeer | null {
  let v: unknown
  try {
    v = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof v !== 'object' || v === null) return null
  const r = v as Record<string, unknown>
  const ok =
    typeof r.id === 'string' &&
    typeof r.project === 'string' &&
    (r.branch === null || typeof r.branch === 'string') &&
    typeof r.model === 'string' &&
    STATUSES.includes(r.status as HudPeerStatus) &&
    isNumberOrNull(r.context) &&
    isNumberOrNull(r.cost) &&
    typeof r.prompt === 'string' &&
    typeof r.summary === 'string' &&
    typeof r.updatedAt === 'number'
  return ok ? (r as HudPeer) : null
}

/** The other sessions that are open now: busy sessions first, then the most recent. */
export function livePeers(peers: HudPeer[], selfId: string, now: number): HudPeer[] {
  return peers
    .filter(p => p.id !== selfId && p.status !== 'ended' && now - p.updatedAt <= STALE_MS)
    .sort((a, b) => Number(b.status === 'busy') - Number(a.status === 'busy') || b.updatedAt - a.updatedAt)
}

/**
 * True when the session must make a new model summary:
 * the user asked for one, the first turn ended, or `SUMMARY_EVERY` turns passed since the last summary.
 */
export function needsSummary(turns: number, summaryTurn: number, asked: boolean): boolean {
  if (asked) return true
  if (turns < 1) return false
  return summaryTurn === 0 || turns - summaryTurn >= SUMMARY_EVERY
}

/** The request text for the summary model, from the last messages of the session. */
export function summaryPrompt(messages: { role: string; text: string }[]): string {
  const lines = messages
    .slice(-SUMMARY_MESSAGES)
    .filter(m => m.text.trim() !== '')
    .map(m => `${m.role}: ${oneLine(m.text, 400)}`)
  return [
    'Below are the last messages of a Claude Code session.',
    'In 12 words or fewer, say what task the session works on now.',
    'Reply with that one line only. Do not use quotes.',
    '',
    ...lines,
  ].join('\n')
}

/** The time since `at`, as `now`, `Xm` or `Xh`. */
export function ago(ms: number): string {
  const m = Math.floor(Math.max(0, ms) / 60_000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h`
}

/** The first line of a session row: the project and the branch. */
export function peerTitle(p: HudPeer): string {
  return p.branch === null ? p.project : `${p.project} · ${p.branch}`
}

/** The facts of a session row: status, context, cost, and the time since the last prompt or turn. */
export function peerStats(p: HudPeer, now: number): string {
  const parts: string[] = [p.status]
  if (p.context !== null) parts.push(`${p.context}%`)
  if (p.cost !== null) parts.push(`$${p.cost.toFixed(2)}`)
  parts.push(ago(now - p.updatedAt))
  return parts.join('  ')
}

/** The summary line of a session row: the model summary, else the last prompt. */
export function peerLine(p: HudPeer): string {
  if (p.summary !== '') return p.summary
  return p.prompt === '' ? 'no prompt yet' : `> ${p.prompt}`
}

/** True for a prompt that the user wrote: typed, sent from a phone, or from an SDK host. Not a notification or a peer message. */
export function isUserPrompt(origin: string, isMeta: boolean): boolean {
  return !isMeta && (origin === 'composer' || origin === 'bridge' || origin === 'sdk')
}
