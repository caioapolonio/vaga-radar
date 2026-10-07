import path from 'node:path'
import { providerInfo, type AiConfig } from './ai-fields'
import {
  isEmailTransport,
  secretHint,
  type EmailConfig,
  type PublicConfig,
} from './config-fields'
import { jsonUpdater, readJson } from './json-file'

export type AppConfig = {
  apifyToken?: string
  ai?: AiConfig
  // Where the résumé PDFs live; data/cvs unless set
  cvDir?: string
  email?: EmailConfig
}

// Keys and passwords stay on this machine: data/ is ignored by git
const CONFIG_PATH = path.join(process.cwd(), 'data', 'config.json')

const emptyConfig = (): AppConfig => ({})

export const updateAppConfig = jsonUpdater(CONFIG_PATH, emptyConfig)

// Key in .env.local for the chosen provider, e.g. ANTHROPIC_API_KEY
const envAiKey = (ai?: AiConfig) => {
  const envVar = ai && providerInfo(ai.provider).envVar
  return envVar ? process.env[envVar] : undefined
}

// Values from .env.local win over the ones saved on /ajustes
export async function readAppConfig(): Promise<AppConfig> {
  const saved = await readJson(CONFIG_PATH, emptyConfig)
  return {
    ...saved,
    // A transport this version no longer has needs setting up again
    email: isEmailTransport(saved.email?.transport) ? saved.email : undefined,
    apifyToken: process.env.APIFY_TOKEN || saved.apifyToken,
    cvDir: process.env.CV_DIR || saved.cvDir,
    ai: saved.ai && {
      ...saved.ai,
      apiKey: envAiKey(saved.ai) || saved.ai.apiKey,
    },
  }
}

export const CV_DIR_DEFAULT = path.join(process.cwd(), 'data', 'cvs')

// The folder is only known at runtime, so the build mustn't try to trace it
export const cvDirOf = (config: AppConfig) =>
  path.resolve(/* turbopackIgnore: true */ config.cvDir || CV_DIR_DEFAULT)

export async function readPublicConfig(): Promise<PublicConfig> {
  const config = await readAppConfig()
  const { password, ...email } = config.email ?? {}
  const { apiKey, ...ai } = config.ai ?? {}
  return {
    apify: {
      configured: !!config.apifyToken,
      fromEnv: !!process.env.APIFY_TOKEN,
      hint: config.apifyToken ? secretHint(config.apifyToken) : null,
    },
    ai: config.ai
      ? {
          ...(ai as Omit<AiConfig, 'apiKey'>),
          hasKey: !!apiKey,
          hint: apiKey ? secretHint(apiKey) : null,
          fromEnv: !!envAiKey(config.ai),
        }
      : null,
    email: config.email
      ? { ...(email as Omit<EmailConfig, 'password'>), hasPassword: !!password }
      : null,
  }
}
