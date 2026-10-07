// The AI each user brings: an API key, or the subscription of an agent CLI
// already installed and logged in (client-safe)

type ProviderInfo = {
  value: string
  label: string
  // "api" needs a key; "cli" runs the installed command headless
  kind: 'api' | 'cli'
  // Empty runs the CLI's own default model
  defaults: { analyze: string; write: string }
  suggestions: readonly string[]
  keyUrl?: string
  keyPlaceholder?: string
  envVar?: string
  command?: string
  installUrl?: string
  loginHint?: string
}

export const AI_PROVIDERS = [
  {
    value: 'anthropic',
    label: 'Claude (Anthropic)',
    kind: 'api',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keyPlaceholder: 'sk-ant-…',
    envVar: 'ANTHROPIC_API_KEY',
    defaults: { analyze: 'claude-haiku-4-5', write: 'claude-sonnet-5-5' },
    suggestions: ['claude-haiku-4-5', 'claude-sonnet-5-5', 'claude-opus-5-5'],
  },
  {
    value: 'openai',
    label: 'OpenAI',
    kind: 'api',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyPlaceholder: 'sk-…',
    envVar: 'OPENAI_API_KEY',
    defaults: { analyze: 'gpt-5.4-mini', write: 'gpt-5.5' },
    suggestions: ['gpt-5.4-nano', 'gpt-5.4-mini', 'gpt-5.5'],
  },
  {
    value: 'google',
    label: 'Gemini (Google)',
    kind: 'api',
    keyUrl: 'https://aistudio.google.com/apikey',
    keyPlaceholder: 'AIza…',
    envVar: 'GOOGLE_GENERATIVE_AI_API_KEY',
    defaults: { analyze: 'gemini-flash-latest', write: 'gemini-flash-latest' },
    suggestions: [
      'gemini-flash-lite-latest',
      'gemini-flash-latest',
      'gemini-pro-latest',
    ],
  },
  {
    value: 'claude-code',
    label: 'Claude Code (assinatura Claude)',
    kind: 'cli',
    command: 'claude',
    installUrl: 'https://code.claude.com/docs',
    loginHint: 'Rode claude no terminal e entre com sua conta',
    defaults: { analyze: 'haiku', write: 'sonnet' },
    suggestions: ['haiku', 'sonnet', 'opus'],
  },
  {
    value: 'codex',
    label: 'Codex (assinatura ChatGPT)',
    kind: 'cli',
    command: 'codex',
    installUrl: 'https://developers.openai.com/codex/cli',
    loginHint: 'Rode codex login no terminal',
    defaults: { analyze: '', write: '' },
    suggestions: ['gpt-5.4-mini', 'gpt-5.5'],
  },
  {
    value: 'gemini-cli',
    label: 'Gemini CLI (conta Google)',
    kind: 'cli',
    command: 'gemini',
    installUrl: 'https://github.com/google-gemini/gemini-cli',
    loginHint: 'Rode gemini no terminal e entre com sua conta Google',
    defaults: { analyze: '', write: '' },
    suggestions: ['gemini-flash-latest', 'gemini-pro-latest'],
  },
] as const satisfies readonly ProviderInfo[]

export type AiProvider = (typeof AI_PROVIDERS)[number]['value']

export type AiConfig = {
  provider: AiProvider
  apiKey?: string
  // Reads every post: a fast, cheap model is enough
  analyzeModel: string
  // Writes the emails
  writeModel: string
}

export type PublicAiConfig = Omit<AiConfig, 'apiKey'> & {
  hasKey: boolean
  hint: string | null
  fromEnv: boolean
}

export const isAiProvider = (value: unknown): value is AiProvider =>
  AI_PROVIDERS.some((provider) => provider.value === value)

export const providerInfo = (provider: AiProvider): ProviderInfo =>
  AI_PROVIDERS.find(({ value }) => value === provider)!

export const isCliProvider = (provider: AiProvider) =>
  providerInfo(provider).kind === 'cli'

// What the AI's install and login look like, for a CLI provider
export type CliStatus = {
  installed: boolean
  version: string | null
  // null when the CLI has no way to tell
  loggedIn: boolean | null
  detail: string | null
}

// US$ per million tokens (input, output), for the cost estimate; other
// models show the token count only
export const MODEL_PRICES: Record<string, [number, number]> = {
  'claude-haiku-4-5': [1, 5],
  'claude-sonnet-5-5': [2, 10],
  'claude-opus-5-5': [4, 20],
}

export const costUsd = (
  model: string,
  inputTokens: number,
  outputTokens: number,
) => {
  const price = MODEL_PRICES[model]
  return price
    ? (inputTokens * price[0] + outputTokens * price[1]) / 1_000_000
    : null
}
