import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { cvDirOf, readAppConfig } from './config'
import type { JobSummary } from './job'
import { jsonUpdater, readJson } from './json-file'
import { fallbackCvLabel, type Profile } from './profile-fields'
import type { Store } from './store'

export type DraftStatus = 'pending' | 'sent' | 'discarded'

// An application email written by the AI, waiting for you to review and send
export type Draft = {
  postId: string
  createdAt: string
  job: JobSummary
  // Why the job fits, shown on the card
  fit: string
  to: string
  subject: string
  body: string
  // Path inside the CV folder, e.g. front-end/cv-frontend-en.pdf
  cv: string
  status: DraftStatus
  statusAt?: string
}

export type DraftFields = Pick<Draft, 'to' | 'subject' | 'body' | 'cv'>

export type Outreach = {
  // Post id -> the AI's verdict; rejected posts stay here so they're read once
  triaged: Record<string, { at: string; match: boolean; reason: string }>
  drafts: Draft[]
}

const OUTREACH_PATH = path.join(process.cwd(), 'data', 'outreach.json')

const emptyOutreach = (): Outreach => ({ triaged: {}, drafts: [] })

export const readOutreach = () => readJson(OUTREACH_PATH, emptyOutreach)

export const updateOutreach = jsonUpdater(OUTREACH_PATH, emptyOutreach)

const EMAIL_PATTERN = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g
// Image names like "logo@2x.png" look like addresses
const IMAGE_FILE = /\.(png|jpe?g|gif|svg|webp)$/i

export function findEmails(text: string) {
  const emails = (text.match(EMAIL_PATTERN) ?? [])
    .map((email) => email.toLowerCase())
    .filter((email) => !IMAGE_FILE.test(email))
  return [...new Set(emails)]
}

// Posts with an email address that the AI hasn't read yet, within the triage
// window from /ajustes (cutoff: oldest postedAt, null for every post)
export function untriagedPosts(
  { posts }: Store,
  { triaged }: Outreach,
  cutoff: number | null,
) {
  return posts.filter(
    (post) =>
      !(post.id in triaged) &&
      // Already applied through the job's website
      post.status !== 'applied' &&
      (cutoff === null || new Date(post.postedAt).getTime() >= cutoff) &&
      findEmails(post.content).length > 0,
  )
}

// The folder set on /perfil (or CV_DIR in .env.local), data/cvs by default
export const cvDir = async () => cvDirOf(await readAppConfig())

const HIDDEN = /(^|\/)(\.|node_modules\/)/

// Every PDF in the CV folder, by its path inside it
export async function listCvs() {
  try {
    const files = await readdir(await cvDir(), { recursive: true })
    return files
      .map((file) => file.split(path.sep).join('/'))
      .filter((file) => /\.pdf$/i.test(file) && !HIDDEN.test(file))
      .sort()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

// The name given on /perfil, or the file name until then
export const cvLabel = (cv: string, { cvs }: Profile) =>
  cvs[cv]?.label || fallbackCvLabel(cv)

// Absolute path of a listed résumé; anything else is refused
export async function cvPath(cv: string) {
  if (!(await listCvs()).includes(cv))
    throw new Error(`CV não encontrado: ${cv}`)
  return path.join(await cvDir(), cv)
}
