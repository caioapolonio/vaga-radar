import { fetchNewPosts } from './linkedin'
import { readSearchConfig, runnableSearches } from './searches'
import { readSettings } from './settings'
import { mergePosts, readStore, updateStore } from './store'

export type ResearchResult =
  | { ok: true; newPosts: number; costUsd: number; failedLabels: string[] }
  | { ok: false; error: string }

// A search group's id, or 'all' for every enabled search
type Scope = string

const inFlight = new Map<Scope, Promise<ResearchResult>>()
// Runs go one after another: in parallel they could pay twice for the same
// searches and go over the Apify free plan's concurrent run limit
let queue: Promise<unknown> = Promise.resolve()

export function research(group?: string) {
  const scope = group ?? 'all'
  // A second click (or tab) joins a running search that covers it instead of
  // paying for another
  const running = inFlight.get(scope) ?? inFlight.get('all')
  if (running) return running

  const run = queue
    .then(() => runResearch(group))
    .finally(() => inFlight.delete(scope))
  inFlight.set(scope, run)
  queue = run
  return run
}

async function runResearch(group?: string): Promise<ResearchResult> {
  const startedAt = new Date().toISOString()

  try {
    const [{ searchedAt = {} }, settings, config] = await Promise.all([
      readStore(),
      readSettings(),
      readSearchConfig(),
    ])
    const searches = runnableSearches(config, group)
    if (!searches.length)
      throw new Error('Nenhuma busca ativa. Crie ou ative buscas em Buscas.')
    const fetched = await fetchNewPosts(searches, searchedAt, settings)
    if (!fetched.searchedIds.length)
      throw new Error('Todas as buscas falharam, veja o terminal do servidor')

    let newPosts = 0
    // Re-read inside the update: statuses may have changed during the search
    await updateStore((store) => {
      const merged = mergePosts(store.posts, fetched.posts)
      newPosts = merged.newPosts
      return {
        ...store,
        lastSearchedAt: startedAt,
        searchedAt: {
          ...store.searchedAt,
          ...Object.fromEntries(
            fetched.searchedIds.map((id) => [id, startedAt]),
          ),
        },
        lastRun: {
          tab: group,
          newPosts,
          fetchedPosts: fetched.posts.length,
          costUsd: fetched.costUsd,
        },
        posts: merged.posts,
      }
    })
    return {
      ok: true,
      newPosts,
      costUsd: fetched.costUsd,
      failedLabels: fetched.failedLabels,
    }
  } catch (error) {
    console.error(error)
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }
  }
}
