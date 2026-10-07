'use client'

import { MailIcon } from 'lucide-react'
import { useEffect, useEffectEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  filterParams,
  isFiltered,
  NO_FILTERS,
  PERIODS,
  type FeedFacets,
  type FeedFilters,
  type FeedPage,
} from '@/lib/feed-filters'
import { EMAIL_VIEW } from '@/lib/search-config'
import type { Post } from '@/lib/store'
import { cn } from '@/lib/utils'
import {
  FilterSelect,
  FilterSummary,
  PresenceFilter,
  SearchInput,
} from './filters'
import { InfinitePostList } from './infinite-post-list'

export type FirstPage = FeedPage<Post> & { facets: FeedFacets }

// Waits for a pause in typing before asking the server
const DEBOUNCE_MS = 250

// Extra spaces typed in the search box don't change the result
const keyOf = (filters: FeedFilters) =>
  JSON.stringify({ ...filters, q: filters.q.trim().replace(/\s+/g, ' ') })

// A tab's filter bar and lists; posts are filtered on the server, since the
// whole feed is too big to send to the browser
export function TabFeed({
  tab,
  searches,
  initial,
  emptyMessage,
}: {
  // Search group id, or EMAIL_VIEW
  tab: string
  searches: { id: string; label: string }[]
  initial: FirstPage
  emptyMessage: string
}) {
  const [filters, setFilters] = useState(NO_FILTERS)
  const [result, setResult] = useState({
    key: keyOf(NO_FILTERS),
    filters: NO_FILTERS,
    ...initial,
  })
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const key = keyOf(filters)
  const loading = key !== result.key && key !== failedKey
  const { facets } = result

  const set = <K extends keyof FeedFilters>(name: K, value: FeedFilters[K]) =>
    setFilters((current) => ({ ...current, [name]: value }))

  const load = useEffectEvent(async (signal: AbortSignal) => {
    const params = new URLSearchParams([
      ['tab', tab],
      ['section', 'active'],
      ...filterParams(filters),
    ])
    try {
      const response = await fetch(`/api/posts?${params}`, { signal })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const page: FirstPage = await response.json()
      setResult({ key, filters, ...page })
      setFailedKey(null)
    } catch {
      if (!signal.aborted) setFailedKey(key)
    }
  })

  useEffect(() => {
    if (key === result.key) return
    const controller = new AbortController()
    const timer = setTimeout(() => void load(controller.signal), DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [key, result.key, attempt])

  const clear = () => setFilters(NO_FILTERS)

  return (
    <>
      <div className="mb-4 flex flex-col gap-3">
        <SearchInput
          value={filters.q}
          onChange={(value) => set('q', value)}
          placeholder="Buscar no post: react remoto"
        />
        <div className="flex flex-wrap items-center gap-3">
          <FilterSelect
            label="Busca que achou o post"
            value={filters.search}
            onChange={(value) => set('search', value)}
            options={[
              { value: 'all', label: 'Todas as buscas' },
              ...searches.map(({ id, label }) => ({
                value: id,
                label: `${label} (${facets.searches[id] ?? 0})`,
              })),
            ]}
          />
          <FilterSelect
            label="Data do post"
            value={filters.period}
            onChange={(value) => set('period', value as FeedFilters['period'])}
            options={PERIODS.map(({ value, label }) => ({
              value,
              label: `${label} (${facets.periods[value]})`,
            }))}
          />
          {/* Every post in "Com e-mail" has one */}
          {tab !== EMAIL_VIEW && (
            <PresenceFilter
              label="E-mail"
              title="Endereço de e-mail escrito no post"
              icon={MailIcon}
              value={filters.email}
              withCount={facets.email.with}
              withoutCount={facets.email.without}
              onChange={(value) => set('email', value)}
            />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3">
          <FilterSummary
            shown={result.total}
            total={facets.unfiltered}
            noun={['post', 'posts']}
            filtered={isFiltered(result.filters)}
            onClear={clear}
          />
          {loading && (
            <span className="text-xs text-muted-foreground">Filtrando…</span>
          )}
          {failedKey === key && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                setFailedKey(null)
                setAttempt((current) => current + 1)
              }}
            >
              Erro ao filtrar. Tentar de novo
            </Button>
          )}
        </div>
      </div>

      <div
        aria-busy={loading}
        className={cn('transition-opacity', loading && 'opacity-60')}
      >
        {/* Keyed by the result so each filter change starts a fresh list */}
        <InfinitePostList
          key={result.key}
          tab={tab}
          section="active"
          initialPosts={result.posts}
          initialHasMore={result.hasMore}
          filters={result.filters}
          emptyMessage={
            isFiltered(result.filters) ? (
              <>
                <p>Nenhum post com esses filtros.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={clear}
                >
                  Limpar filtros
                </Button>
              </>
            ) : (
              emptyMessage
            )
          }
        />

        {facets.archived > 0 && (
          <details className="mt-10">
            <summary className="cursor-pointer text-sm text-muted-foreground select-none hover:text-foreground">
              Já vistas ou aplicadas ({facets.archived})
            </summary>
            <div className="mt-4">
              {/* Loads only once opened: the sentinel is hidden until then */}
              <InfinitePostList
                key={result.key}
                tab={tab}
                section="archived"
                initialPosts={[]}
                initialHasMore
                filters={result.filters}
              />
            </div>
          </details>
        )}
      </div>
    </>
  )
}
