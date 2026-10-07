import path from 'node:path'
import type { JobSummary } from './job'
import { jsonUpdater, readJson } from './json-file'
import type { Store } from './store'

// How well a match fits: 3 strong, 2 good with a caveat, 1 accepted in doubt
export type MatchStrength = 1 | 2 | 3

export const isStrength = (value: unknown): value is MatchStrength =>
  value === 1 || value === 2 || value === 3

// The AI's verdict on whether a job post fits the résumé
export type MatchVerdict = {
  at: string
  match: boolean
  reason: string
  // Only on matches
  job?: JobSummary
  fit?: string
  strength?: MatchStrength
  // Where to apply, exactly as written in the post
  applyUrl?: string
}

export type Matches = {
  // Post id -> verdict; rejected posts stay here so they're read once
  triaged: Record<string, MatchVerdict>
}

const MATCHES_PATH = path.join(process.cwd(), 'data', 'matches.json')

const emptyMatches = (): Matches => ({ triaged: {} })

export const readMatches = () => readJson(MATCHES_PATH, emptyMatches)

export const updateMatches = jsonUpdater(MATCHES_PATH, emptyMatches)

// Posts the AI hasn't judged yet within the triage window from /ajustes
// (cutoff: oldest postedAt, null for every post); applied ones need no verdict
export function untriagedForMatch(
  { posts }: Store,
  { triaged }: Matches,
  cutoff: number | null,
) {
  return posts.filter(
    (post) =>
      !(post.id in triaged) &&
      post.status !== 'applied' &&
      (cutoff === null || new Date(post.postedAt).getTime() >= cutoff),
  )
}
