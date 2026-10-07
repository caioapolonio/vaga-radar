import path from 'node:path'
import { readJson, writeJson } from './json-file'
import { EMPTY_PROFILE, type Profile } from './profile-fields'

export * from './profile-fields'

const PROFILE_PATH = path.join(process.cwd(), 'data', 'profile.json')

// Fields missing from the file (never saved, or added later) start empty
export async function readProfile(): Promise<Profile> {
  const saved = await readJson<Partial<Profile>>(PROFILE_PATH, () => ({}))
  return { ...EMPTY_PROFILE, ...saved }
}

export const writeProfile = (profile: Profile) =>
  writeJson(PROFILE_PATH, profile)
