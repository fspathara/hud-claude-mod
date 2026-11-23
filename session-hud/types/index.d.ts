export type HudContext = { percent: number | null; tokens: number | null; window: number | null }

export type HudCache = {
  /** Input tokens of the last main-loop response, by kind. */
  lastRead: number
  lastWrite: number
  lastUncached: number
  /** Input tokens of all main-loop responses in this session, by kind. */
  totalRead: number
  totalWrite: number
  totalUncached: number
  /** Epoch milliseconds of the last main-loop response; null before the first. */
  lastResponseAt: number | null
}

export type HudLimit = {
  /** The window: `five_hour`, `seven_day`, `spend_limit`. */
  kind: string
  /** Share of the window used, 0 to 100. */
  percentUsed: number
  /** ISO 8601 reset time; null when the engine gives none. */
  resetsAt: string | null
}

export type HudAgent = {
  id: string
  /** The agent type: `general-purpose`, `Explore`, `teammate`. */
  type: string
  /** The few words the Agent call gave for the task. */
  description: string
  /** `pending`, `running`, `waiting`, `idle`, `completed`, `failed` or `killed`. */
  status: string
}

export type HudCalls = {
  /** Tool calls of the main loop. */
  main: { ok: number; failed: number }
  /** Tool calls of all subagents together. */
  sub: { ok: number; failed: number }
  /** Calls of each tool, main loop and subagents together. */
  tools: Record<string, number>
  /** The last calls, the newest last. */
  recent: HudRecentCall[]
}

export type HudRecentCall = { tool: string; ok: boolean; sub: boolean }

export type HudPeerStatus = 'busy' | 'idle' | 'ended'

/** One Claude Code session, as its file in the shared `hud-sessions` folder gives it. */
export type HudPeer = {
  /** The session ID; also the file name. */
  id: string
  /** The folder name of the working directory. */
  project: string
  /** The git branch, the short commit on a detached HEAD, or null outside a repository. */
  branch: string | null
  model: string
  /** `busy` while a turn runs, `idle` between turns, `ended` after the session stops. */
  status: HudPeerStatus
  /** Context used, 0 to 100; null before the first request. */
  context: number | null
  /** Session cost in US dollars; null when the host keeps no ledger. */
  cost: number | null
  /** The last prompt of the user, on one line. */
  prompt: string
  /** The model summary of the work; empty before the first summary or when summaries are off. */
  summary: string
  /** Epoch milliseconds of the last heartbeat. */
  updatedAt: number
}

export type HudSummary = {
  text: string
  /** The main-loop turn count when the summary was made; 0 before the first. */
  turn: number
}

declare module 'claude-code' {
  interface PluginState {
    'session-hud': {
      model: string
      /** The effort of the last main-loop request; empty before the first, or for a model without effort. */
      effort: string
      outputStyle: string
      context: HudContext
      cache: HudCache
      now: number
      /** Session cost in US dollars; null when the host keeps no ledger. */
      cost: number | null
      /** Rate-limit windows; empty off a subscription. */
      limits: HudLimit[]
      /** The agents of the session, subagents and teammates, as the last timer tick read them. */
      agents: HudAgent[]
      /** Tool calls, counted by who made them and by the result. */
      calls: HudCalls
      /** True while a main-loop turn runs. */
      busy: boolean
      /** The last prompt of the user, on one line. */
      lastPrompt: string
      /** The model summary of this session. */
      summary: HudSummary
      /** The other open sessions, as the last timer read gave them. */
      peers: HudPeer[]
    }
  }
}
