import {
  explainAiError,
  generateStructured,
  isFatalAiError,
  modelFor,
  modelLabel,
  readAiConfig,
  type ModelRole,
} from '../ai'
import { costUsd, isCliProvider } from '../ai-fields'
import {
  readMatches,
  untriagedForMatch,
  updateMatches,
  type MatchStrength,
  type MatchVerdict,
} from '../matches'
import {
  findEmails,
  listCvs,
  readOutreach,
  untriagedPosts,
  updateOutreach,
  type Draft,
} from '../outreach'
import { readProfile } from '../profile'
import { readSearchConfig, searchLabels } from '../searches'
import { readSettings, triageCutoff } from '../settings'
import { readStore, type Post } from '../store'
import { foldText } from '../text-search'
import {
  candidateBlock,
  EMAIL_INSTRUCTIONS,
  MATCH_INSTRUCTIONS,
} from './prompts'
import {
  emailOutput,
  emailProblem,
  matchOutput,
  matchProblem,
  toJobSummary,
  type EmailResult,
  type MatchResult,
} from './results'

// "matches" fills Para você; "emails" writes the cards on E-mails
export type AnalysisKind = 'matches' | 'emails'

export const isAnalysisKind = (value: unknown): value is AnalysisKind =>
  value === 'matches' || value === 'emails'

export type JobState = {
  kind: AnalysisKind
  status: 'running' | 'done' | 'failed' | 'canceled'
  model: string
  // Runs on a CLI's subscription, so there's no cost to show
  subscription: boolean
  total: number
  // Posts with a saved verdict
  done: number
  matched: number
  // Answers that failed the checks twice; they're retried on the next run
  skipped: number
  inputTokens: number
  outputTokens: number
  costUsd: number | null
  startedAt: string
  finishedAt?: string
  error?: string
}

const SETTINGS = {
  // Posts per call, and calls at once. Emails go one batch at a time so two
  // batches never write to the same recruiter
  matches: { batch: 15, concurrency: 3, outputPerPost: 110 },
  emails: { batch: 8, concurrency: 1, outputPerPost: 90 },
} as const

// Long posts are mostly hashtags and boilerplate after this
const MAX_CONTENT_CHARS = 6000
// Rough chars per token, for the estimate shown before running
const CHARS_PER_TOKEN = 3.5

type Job = { state: JobState; controller: AbortController }

// Survives the dev server's hot reloads, so a running job isn't lost
const globalJobs = globalThis as typeof globalThis & {
  analysisJobs?: Map<AnalysisKind, Job>
}
const jobs = (globalJobs.analysisJobs ??= new Map())

export const jobState = (kind: AnalysisKind) => jobs.get(kind)?.state ?? null

async function pendingPosts(kind: AnalysisKind) {
  const [store, settings, matches, outreach] = await Promise.all([
    readStore(),
    readSettings(),
    readMatches(),
    readOutreach(),
  ])
  const cutoff = triageCutoff(settings)
  return kind === 'matches'
    ? untriagedForMatch(store, matches, cutoff)
    : untriagedPosts(store, outreach, cutoff)
}

// Reposts share their text: judge one, copy the verdict to the rest
const fingerprint = (post: Post) =>
  foldText(post.content).replace(/\s+/g, ' ').trim().slice(0, 600)

function groupReposts(posts: Post[]) {
  const groups = new Map<string, Post[]>()
  for (const post of posts) {
    const key = fingerprint(post) || post.id
    groups.set(key, [...(groups.get(key) ?? []), post])
  }
  return [...groups.values()]
}

async function instructionsFor(kind: AnalysisKind) {
  const [profile, cvs] = await Promise.all([readProfile(), listCvs()])
  const task = kind === 'matches' ? MATCH_INSTRUCTIONS : EMAIL_INSTRUCTIONS
  return { instructions: `${task}\n\n${candidateBlock(profile, cvs)}`, cvs }
}

export async function analysisEstimate(kind: AnalysisKind) {
  const [posts, { instructions }] = await Promise.all([
    pendingPosts(kind),
    instructionsFor(kind),
  ])
  const groups = groupReposts(posts)
  const { batch, outputPerPost } = SETTINGS[kind]
  const chars =
    groups.reduce(
      (sum, [post]) =>
        sum + Math.min(post.content.length, MAX_CONTENT_CHARS) + 400,
      0,
    ) +
    Math.ceil(groups.length / batch) * instructions.length
  return {
    pending: posts.length,
    inputTokens: Math.round(chars / CHARS_PER_TOKEN),
    outputTokens: groups.length * outputPerPost,
  }
}

const day = (iso: string) => iso.slice(0, 10)

// What the model reads about each post
async function payloadFor(kind: AnalysisKind, posts: Post[]) {
  if (kind === 'matches') {
    const [outreach, config] = await Promise.all([
      readOutreach(),
      readSearchConfig(),
    ])
    const labels = searchLabels(config)
    const drafts = new Map(
      outreach.drafts.map((draft) => [draft.postId, draft]),
    )
    return posts.map((post) => {
      const draft = drafts.get(post.id)
      return {
        postId: post.id,
        postedAt: day(post.postedAt),
        author: `${post.author.name} · ${post.author.headline}`,
        attachment: post.attachment ?? null,
        searches: post.searchIds.flatMap((id) => labels[id] ?? []),
        emailCard: draft ? { job: draft.job, fit: draft.fit } : null,
        content: post.content.slice(0, MAX_CONTENT_CHARS),
      }
    })
  }
  // Re-read for each batch, so cards from earlier batches count
  const { drafts } = await readOutreach()
  return posts.map((post) => {
    const emails = findEmails(post.content)
    return {
      postId: post.id,
      postedAt: day(post.postedAt),
      author: `${post.author.name} · ${post.author.headline}`,
      attachment: post.attachment ?? null,
      emails,
      earlierDrafts: drafts
        .filter((draft) => emails.includes(draft.to))
        .map(({ to, status, job }) => ({ to, status, job: job.title })),
      content: post.content.slice(0, MAX_CONTENT_CHARS),
    }
  })
}

async function saveMatches(verdicts: { result: MatchResult; posts: Post[] }[]) {
  const at = new Date().toISOString()
  const entries: [string, MatchVerdict][] = verdicts.flatMap(
    ({ result, posts }) =>
      posts.map((post) => {
        if (!result.match)
          return [post.id, { at, match: false, reason: result.reason }] as [
            string,
            MatchVerdict,
          ]
        // A copy for a repost keeps the link only if it's in that post too
        const applyUrl =
          result.applyUrl && !matchProblem(result, post)
            ? result.applyUrl
            : undefined
        return [
          post.id,
          {
            at,
            match: true,
            reason: result.reason,
            job: toJobSummary(result.job!),
            fit: result.fit!.trim(),
            strength: result.strength as MatchStrength,
            ...(applyUrl && { applyUrl }),
          },
        ] as [string, MatchVerdict]
      }),
  )
  await updateMatches((matches) => ({
    triaged: { ...matches.triaged, ...Object.fromEntries(entries) },
  }))
  return entries.filter(([, verdict]) => verdict.match).length
}

async function saveEmails(verdicts: { result: EmailResult; posts: Post[] }[]) {
  const at = new Date().toISOString()
  let created = 0
  await updateOutreach((outreach) => {
    const triaged = { ...outreach.triaged }
    const drafts = [...outreach.drafts]
    for (const { result, posts } of verdicts) {
      const [post, ...reposts] = posts
      const to = result.draft?.to.trim().toLowerCase()
      // One card per recruiter, even across batches and runs
      const repeated = to && drafts.some((draft) => draft.to === to)
      if (result.match && result.draft && !repeated) {
        const { job, fit, subject, body, cv } = result.draft
        drafts.push({
          postId: post.id,
          createdAt: at,
          job: toJobSummary(job),
          fit: fit.trim(),
          to: to!,
          subject: subject.trim(),
          body: body.trim(),
          cv,
          status: 'pending',
        } satisfies Draft)
        created++
        triaged[post.id] = { at, match: true, reason: result.reason }
      } else
        triaged[post.id] = {
          at,
          match: false,
          reason: repeated ? 'já existe card para este e-mail' : result.reason,
        }
      // The same post shared again would only repeat the card
      for (const repost of reposts)
        triaged[repost.id] = {
          at,
          match: false,
          reason: `mesmo post que ${post.id}`,
        }
    }
    return { triaged, drafts }
  })
  return created
}

const roleOf = (kind: AnalysisKind): ModelRole =>
  kind === 'matches' ? 'analyze' : 'write'

async function run(job: Job) {
  const { state, controller } = job
  const { signal } = controller
  const { kind } = state
  const ai = await readAiConfig()
  const role = roleOf(kind)
  const subscription = isCliProvider(ai.provider)
  const { instructions, cvs } = await instructionsFor(kind)
  const settings = SETTINGS[kind]
  // A subscription's rate limit is lower than an API key's
  const concurrency = subscription
    ? Math.min(settings.concurrency, 2)
    : settings.concurrency

  const posts = await pendingPosts(kind)
  state.total = posts.length
  const queue = groupReposts(posts)
  // First failure of each post: it goes back to the queue once, with the reason
  const retried = new Map<string, string>()

  const runBatch = async (groups: Post[][]) => {
    const representatives = groups.map(([post]) => post)
    const payload = (await payloadFor(kind, representatives)).map((item) => ({
      ...item,
      ...(retried.has(item.postId) && {
        previousAttemptProblem: retried.get(item.postId),
      }),
    }))

    const call = {
      ai,
      role,
      instructions,
      prompt: `Posts:\n${JSON.stringify(payload, null, 1)}`,
      signal,
    }
    const { output, usage } =
      kind === 'matches'
        ? await generateStructured({ ...call, schema: matchOutput })
        : await generateStructured({ ...call, schema: emailOutput })
    state.inputTokens += usage.inputTokens
    state.outputTokens += usage.outputTokens
    state.costUsd = subscription
      ? null
      : costUsd(modelFor(ai, role), state.inputTokens, state.outputTokens)

    const byId = new Map(
      (output.results as (MatchResult | EmailResult)[]).map((result) => [
        result.postId,
        result,
      ]),
    )
    const valid: { result: MatchResult & EmailResult; posts: Post[] }[] = []
    for (const group of groups) {
      const [post] = group
      const result = byId.get(post.id) as
        (MatchResult & EmailResult) | undefined
      const problem = !result
        ? 'faltou o resultado deste post'
        : kind === 'matches'
          ? matchProblem(result, post)
          : emailProblem(result, post, cvs)
      if (!problem) valid.push({ result: result!, posts: group })
      else if (!retried.has(post.id)) {
        retried.set(post.id, problem)
        queue.push(group)
      } else state.skipped += group.length
    }

    if (kind === 'matches') state.matched += await saveMatches(valid)
    else state.matched += await saveEmails(valid)
    state.done += valid.reduce((sum, { posts }) => sum + posts.length, 0)
  }

  const worker = async () => {
    while (queue.length && !signal.aborted) {
      const groups = queue.splice(0, settings.batch)
      try {
        await runBatch(groups)
      } catch (error) {
        if (signal.aborted) return
        if (isFatalAiError(error)) {
          state.error = explainAiError(error)
          controller.abort()
          return
        }
        console.error(error)
        // A bad answer for the whole batch: each post gets one more chance
        for (const group of groups)
          if (!retried.has(group[0].id)) {
            retried.set(group[0].id, 'a resposta anterior veio inválida')
            queue.push(group)
          } else state.skipped += group.length
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))
}

export async function startAnalysis(kind: AnalysisKind) {
  const running = jobs.get(kind)
  if (running?.state.status === 'running') return running.state

  // Fails here, before starting, when the AI isn't set up
  const ai = await readAiConfig()
  const job: Job = {
    controller: new AbortController(),
    state: {
      kind,
      status: 'running',
      model: modelLabel(ai, roleOf(kind)),
      subscription: isCliProvider(ai.provider),
      total: 0,
      done: 0,
      matched: 0,
      skipped: 0,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: null,
      startedAt: new Date().toISOString(),
    },
  }
  jobs.set(kind, job)

  run(job)
    .catch((error) => {
      console.error(error)
      job.state.error = explainAiError(error)
    })
    .finally(() => {
      const { state, controller } = job
      state.finishedAt = new Date().toISOString()
      state.status = state.error
        ? 'failed'
        : controller.signal.aborted
          ? 'canceled'
          : 'done'
    })
  return job.state
}

export function cancelAnalysis(kind: AnalysisKind) {
  jobs.get(kind)?.controller.abort()
}
