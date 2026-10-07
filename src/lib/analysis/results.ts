import { z } from 'zod'
import { findEmails } from '../outreach'
import type { Post } from '../store'

// Every field is required and nullable instead of optional: strict
// structured outputs (OpenAI) reject optional keys
const job = z.object({
  title: z.string(),
  company: z.string().nullable(),
  seniority: z.string().nullable(),
  workModel: z.string().nullable(),
  location: z.string().nullable(),
})

export const matchOutput = z.object({
  results: z.array(
    z.object({
      postId: z.string(),
      match: z.boolean(),
      reason: z.string(),
      strength: z.number().nullable(),
      job: job.nullable(),
      fit: z.string().nullable(),
      applyUrl: z.string().nullable(),
    }),
  ),
})

export const emailOutput = z.object({
  results: z.array(
    z.object({
      postId: z.string(),
      match: z.boolean(),
      reason: z.string(),
      draft: z
        .object({
          job,
          fit: z.string(),
          to: z.string(),
          subject: z.string(),
          body: z.string(),
          cv: z.string(),
        })
        .nullable(),
    }),
  ),
})

export type MatchResult = z.infer<typeof matchOutput>['results'][number]
export type EmailResult = z.infer<typeof emailOutput>['results'][number]
export type JobResult = z.infer<typeof job>

// The model returns null for unknowns; the saved job leaves them out
export const toJobSummary = ({ title, ...rest }: JobResult) => ({
  title: title.trim(),
  ...Object.fromEntries(
    Object.entries(rest).flatMap(([key, value]) =>
      value?.trim() ? [[key, value.trim()]] : [],
    ),
  ),
})

// Links must come from the post itself, never from anywhere else
const appearsIn = (url: string, post: Post) =>
  post.content.includes(url) || post.attachment?.url === url

// What's wrong with a verdict, or null when it can be saved
export function matchProblem(result: MatchResult, post: Post) {
  if (!result.reason.trim()) return 'faltou o motivo (reason)'
  if (!result.match) return null
  if (!result.job?.title.trim() || !result.fit?.trim())
    return 'match sem job.title ou fit'
  if (![1, 2, 3].includes(result.strength ?? 0))
    return 'match sem strength 1, 2 ou 3'
  if (result.applyUrl && !appearsIn(result.applyUrl, post))
    return `o link ${result.applyUrl} não aparece no post: copie exatamente ou use null`
  return null
}

export function emailProblem(result: EmailResult, post: Post, cvs: string[]) {
  if (!result.reason.trim()) return 'faltou o motivo (reason)'
  if (!result.match) return null
  const { draft } = result
  if (!draft) return 'match sem draft'
  // Only addresses written in the post itself
  if (!findEmails(post.content).includes(draft.to.trim().toLowerCase()))
    return `${draft.to} não aparece no post: use um dos emails dele`
  if (!cvs.includes(draft.cv))
    return `currículo inexistente: ${draft.cv}. Use um da lista, exatamente`
  if (
    !draft.job.title.trim() ||
    !draft.fit.trim() ||
    !draft.subject.trim() ||
    !draft.body.trim()
  )
    return 'draft incompleto (job.title, fit, subject e body)'
  if (`${draft.subject}\n${draft.body}`.includes(';'))
    return 'o e-mail tem ponto e vírgula: reescreva sem'
  return null
}
