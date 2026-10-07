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
    }
  }
}
