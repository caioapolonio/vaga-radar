import { ApifyClient } from 'apify-client'
import { formatUsd } from './format'
import { readAppConfig } from './config'
import type { RunnableSearch } from './search-config'
import type { Settings } from './settings'
import type { Post } from './store'

const POST_SEARCH_ACTOR = 'harvestapi/linkedin-post-search'
// Re-fetch a bit before the last search so late-indexed posts aren't missed
const OVERLAP_MS = 60 * 60 * 1000
// Apify's minimum allowed cap for pay-per-event Actors
const MIN_CHARGE_CAP_USD = 0.5
// Free tier price; the run's own usage figure lags behind for a while
export const PRICE_PER_POST_USD = 0.002

type RawPost = {
  id: string
  linkedinUrl: string
  content?: string
  postedAt?: { timestamp: number }
  author?: { name?: string; info?: string; linkedinUrl?: string }
  job?: { title: string; subtitle?: string; linkedinUrl: string }
  article?: { title: string; subtitle?: string; link: string }
  repost?: { content?: string }
  query?: { search?: string }
}

// The Actor escapes markdown characters, e.g. "São Paulo \(SP\)"
const unescapeMarkdown = (text: string) =>
  text.replace(/\\([\\`*_{}[\]()#+\-.!|~>])/g, '$1')

const toPost = (raw: RawPost, searchId: string): Post | null => {
  if (!raw.postedAt) return null

  const { job, article } = raw
  return {
    id: raw.id,
    url: raw.linkedinUrl,
    content: unescapeMarkdown(raw.content || raw.repost?.content || ''),
    postedAt: new Date(raw.postedAt.timestamp).toISOString(),
    author: {
      name: raw.author?.name ?? 'Desconhecido',
      headline: raw.author?.info ?? '',
      url: raw.author?.linkedinUrl ?? raw.linkedinUrl,
    },
    attachment: job
      ? { title: job.title, subtitle: job.subtitle, url: job.linkedinUrl }
      : article
        ? {
            title: article.title,
            subtitle: article.subtitle,
            url: article.link,
          }
        : undefined,
    searchIds: [searchId],
  }
}

type SearchPlan = {
  search: RunnableSearch
  // Fetch posts published from this moment on
  from: Date
  // Whether the search ran before (so it only needs what's new)
  isUpdate: boolean
}

// Each search continues from its previous run, capped at its lookback from
// /ajustes (never older than that, not even on a search's first run)
export function planSearches(
  searches: RunnableSearch[],
  searchedAt: Record<string, string>,
  settings: Settings,
  now = new Date(),
): SearchPlan[] {
  return searches.map((search) => {
    const oldest = new Date(now)
    oldest.setDate(
      oldest.getDate() -
        (search.recentOnly
          ? settings.emailSearchLookbackDays
          : settings.searchLookbackDays),
    )

    const lastRun = searchedAt[search.id]
    const from = lastRun
      ? new Date(
          Math.max(new Date(lastRun).getTime() - OVERLAP_MS, oldest.getTime()),
        )
      : oldest
    return { search, from, isUpdate: !!lastRun }
  })
}

type RunPlan = { plans: SearchPlan[]; maxPosts: number }

// Searches sharing a start date and limit run together: the Apify free plan
// allows only 5 concurrent runs, and one run accepts many queries
function groupIntoRuns(plans: SearchPlan[], maxPosts: number): RunPlan[] {
  const runs = new Map<string, SearchPlan[]>()
  for (const plan of plans) {
    const key = plan.from.toISOString()
    runs.set(key, [...(runs.get(key) ?? []), plan])
  }
  return [...runs.values()].map((plans) => ({ plans, maxPosts }))
}

async function runSearches(client: ApifyClient, { plans, maxPosts }: RunPlan) {
  const run = await client.actor(POST_SEARCH_ACTOR).call(
    {
      searchQueries: plans.map(({ search }) => search.query),
      maxPosts,
      sortBy: 'date',
      postedLimitDate: plans[0].from.toISOString(),
    },
    {
      maxTotalChargeUsd: Math.max(
        MIN_CHARGE_CAP_USD,
        plans.length * maxPosts * PRICE_PER_POST_USD,
      ),
    },
  )
  if (run.status !== 'SUCCEEDED')
    throw new Error(`A execução terminou com status ${run.status}`)

  const searchIdByQuery = new Map(
    plans.map(({ search }) => [search.query, search.id]),
  )
  const { items } = await client
    .dataset<RawPost>(run.defaultDatasetId)
    .listItems()
  return items.flatMap((raw) => {
    const searchId = searchIdByQuery.get(raw.query?.search ?? '')
    const post = searchId && toPost(raw, searchId)
    return post ? [post] : []
  })
}

// The token saved on /ajustes, or APIFY_TOKEN from .env.local
export async function apifyClient() {
  const { apifyToken } = await readAppConfig()
  if (!apifyToken)
    throw new Error('Configure o token da Apify em Ajustes > Conexões')
  return new ApifyClient({ token: apifyToken })
}

// This month's credit on the Apify account, for the connection test
export async function apifyCredit(client: ApifyClient) {
  const usage = await client.user().limits()
  if (!usage) throw new Error('Não foi possível ler o saldo da Apify')
  return {
    usedUsd: usage.current.monthlyUsageUsd,
    limitUsd: usage.limits.maxMonthlyUsageUsd,
  }
}

async function availableCreditUsd(client: ApifyClient, reserveUsd: number) {
  const { usedUsd, limitUsd } = await apifyCredit(client)
  return limitUsd - usedUsd - reserveUsd
}

// Runs one batch of searches within budget, lowering the per-search limit if needed
async function runBatch(
  client: ApifyClient,
  batch: SearchPlan[],
  budgetUsd: number,
  maxPostsPerSearch: number,
) {
  const maxPosts = Math.min(
    maxPostsPerSearch,
    Math.floor(budgetUsd / (batch.length * PRICE_PER_POST_USD)),
  )
  // Not even one post per search fits the budget
  if (!batch.length || maxPosts < 1)
    return { posts: [], failed: batch.map(({ search }) => search) }

  const runs = groupIntoRuns(batch, maxPosts)
  const results = await Promise.allSettled(
    runs.map((run) => runSearches(client, run)),
  )
  for (const result of results)
    if (result.status === 'rejected') console.error(result.reason)

  return {
    posts: results.flatMap((result) =>
      result.status === 'fulfilled' ? result.value : [],
    ),
    failed: runs
      .filter((_, i) => results[i].status === 'rejected')
      .flatMap(({ plans }) => plans.map(({ search }) => search)),
  }
}

// Searches that ran before go first (they only bring what's new, so they're
// cheap); searches running for the first time get what's left of the budget
export async function fetchNewPosts(
  searches: RunnableSearch[],
  searchedAt: Record<string, string>,
  settings: Settings,
) {
  const client = await apifyClient()

  const available = await availableCreditUsd(client, settings.creditReserveUsd)
  if (available < searches.length * PRICE_PER_POST_USD)
    throw new Error(
      `Crédito da Apify esgotado: sobrou só a reserva de ${formatUsd(settings.creditReserveUsd)}`,
    )

  const plans = planSearches(searches, searchedAt, settings)
  const updates = await runBatch(
    client,
    plans.filter(({ isUpdate }) => isUpdate),
    available,
    settings.maxPostsPerSearch,
  )
  // Apify's usage figure lags, so count the spend from the posts received
  const spentUsd = updates.posts.length * PRICE_PER_POST_USD
  const firstRuns = await runBatch(
    client,
    plans.filter(({ isUpdate }) => !isUpdate),
    available - spentUsd,
    settings.maxPostsPerSearch,
  )

  const posts = [...updates.posts, ...firstRuns.posts]
  const failed = [...updates.failed, ...firstRuns.failed]
  return {
    posts,
    searchedIds: searches
      .filter((search) => !failed.includes(search))
      .map(({ id }) => id),
    failedLabels: failed.map(({ label }) => label),
    costUsd: posts.length * PRICE_PER_POST_USD,
  }
}
