import path from 'node:path'
import { readJson, writeJson } from './json-file'
import { DEFAULT_SETTINGS, type Settings } from './settings-fields'

export type { Settings } from './settings-fields'

const SETTINGS_PATH = path.join(process.cwd(), 'data', 'settings.json')

// Keys missing from the file (never saved, or added later) use the defaults
export async function readSettings(): Promise<Settings> {
  const saved = await readJson<Partial<Settings>>(SETTINGS_PATH, () => ({}))
  return { ...DEFAULT_SETTINGS, ...saved }
}

export const writeSettings = (settings: Settings) =>
  writeJson(SETTINGS_PATH, settings)

// Oldest postedAt the AI still reads, or null for every post
export function triageCutoff(settings: Settings, now = new Date()) {
  return settings.triageMaxAgeDays === null
    ? null
    : now.getTime() - settings.triageMaxAgeDays * 86_400_000
}
