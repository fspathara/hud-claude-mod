import { atom, read, update } from 'claude-code'
import type { EngineInterface as Engine, FsEntry } from 'claude-code'

import type { HudContext, HudPeer, HudPeerStatus, HudSummary } from '../types'
import { branchOf, folderName, gitDirOf, hudDir, livePeers, needsSummary, oneLine, parsePeer, STALE_MS, summaryPrompt, SUMMARY_MESSAGES } from './sessions'

const busy = atom({ plugin: 'session-hud', key: 'busy' } as const, false)
const lastPrompt = atom({ plugin: 'session-hud', key: 'lastPrompt' } as const, '')
const summary = atom({ plugin: 'session-hud', key: 'summary' } as const, { text: '', turn: 0 } as HudSummary)
const peers = atom({ plugin: 'session-hud', key: 'peers' } as const, [] as HudPeer[])

const model = atom({ plugin: 'session-hud', key: 'model' } as const, '')
const context = atom({ plugin: 'session-hud', key: 'context' } as const, {
  percent: null,
  tokens: null,
  window: null,
} as HudContext)
const cost = atom({ plugin: 'session-hud', key: 'cost' } as const, null as number | null)

/** Where this session writes its file, and which ask of the user it answered last. */
export type Registry = {
  dir: string | null
  selfId: string
  askHandled: number
  isSummarizing: boolean
}

export function newRegistry(): Registry {
  return { dir: null, selfId: '', askHandled: 0, isSummarizing: false }
}

/** Find the shared folder and the session ID. The folder stays null when the session keeps no transcript. */
export async function openRegistry($: Engine, reg: Registry): Promise<void> {
  reg.selfId = await $.session.id()
  // An ask written before this load is old: do not answer it.
  reg.askHandled = Date.now()
  const info = await $.session.info()
  reg.dir = hudDir(info.transcriptPath)
}

/** The branch of the working directory, from the git files. Null outside a repository or on a read error. */
async function readBranch($: Engine): Promise<string | null> {
  const cwd = await $.session.cwd()
  try {
    const dotGit = `${cwd}/.git`
    const stat = await $.fs.stat(dotGit)
    const gitDir = stat.kind === 'dir' ? dotGit : gitDirOf(await $.fs.read(dotGit), cwd)
    if (gitDir !== null) return branchOf(await $.fs.read(`${gitDir}/HEAD`))
  } catch {
    // The working directory is not the repository root: try the root.
  }
  try {
    const repo = await $.session.repo()
    return repo === null ? null : branchOf(await $.fs.read(`${repo.root}/.git/HEAD`))
  } catch {
    return null
  }
}

/** Write the file of this session. A failed write only skips one heartbeat. */
export async function publish($: Engine, reg: Registry, status?: HudPeerStatus): Promise<void> {
  if (reg.dir === null) return
  const ctx = await read($, context)
  const record: HudPeer = {
    id: reg.selfId,
    project: folderName(await $.session.cwd()),
    branch: await readBranch($),
    model: await read($, model),
    status: status ?? ((await read($, busy)) ? 'busy' : 'idle'),
    context: ctx.percent,
    cost: await read($, cost),
    prompt: await read($, lastPrompt),
    summary: (await read($, summary)).text,
    updatedAt: Date.now(),
  }
  await $.fs.write(`${reg.dir}/${reg.selfId}.json`, JSON.stringify(record)).catch(() => {})
}

/** Read the files of the other sessions into the `peers` atom. */
export async function readPeers($: Engine, reg: Registry): Promise<void> {
  if (reg.dir === null) return
  const now = Date.now()
  const entries = await $.fs.list(reg.dir).catch((): FsEntry[] => [])
  const fresh = entries.filter(
    f => f.kind === 'file' && f.name.endsWith('.json') && f.name !== `${reg.selfId}.json` && now - f.mtimeMs <= STALE_MS,
  )
  const found: HudPeer[] = []
  for (const f of fresh) {
    const p = parsePeer(await $.fs.read(`${reg.dir}/${f.name}`).catch(() => ''))
    if (p !== null) found.push(p)
  }
  await update($, peers, () => livePeers(found, reg.selfId, now))
}

/** Ask another session for a new summary: write the time to its `.ask` file. */
export async function askSummary($: Engine, reg: Registry, peerId: string): Promise<void> {
  if (reg.dir === null) return
  await $.fs.write(`${reg.dir}/${peerId}.ask`, String(Date.now())).catch(() => {})
}

/** True when the `.ask` file of this session has a time later than the last one answered. */
async function isAsked($: Engine, reg: Registry): Promise<boolean> {
  if (reg.dir === null) return false
  const path = `${reg.dir}/${reg.selfId}.ask`
  if (!(await $.fs.exists(path).catch(() => false))) return false
  const at = Number(await $.fs.read(path).catch(() => '0'))
  if (!(at > reg.askHandled)) return false
  reg.askHandled = at
  return true
}

/** Make a new model summary when one is due. Only one request runs at a time. */
export async function maybeSummarize($: Engine, reg: Registry, mustCheckAsk: boolean): Promise<void> {
  if (reg.isSummarizing) return
  const asked = mustCheckAsk && (await isAsked($, reg))
  const turns = await $.session.turns()
  const done = await read($, summary)
  if (!needsSummary(turns, done.turn, asked)) return
  reg.isSummarizing = true
  try {
    const messages = await $.session.messages({ last: SUMMARY_MESSAGES })
    if ('deny' in messages) return
    const r = await $.model.complete({
      model: 'haiku',
      prompt: summaryPrompt(messages),
      maxTokens: 60,
      effort: 'low',
      timeoutMs: 15_000,
    })
    if (r.isAnswered) await update($, summary, () => ({ text: oneLine(r.text, 100), turn: Math.max(1, turns) }))
  } finally {
    reg.isSummarizing = false
  }
}
