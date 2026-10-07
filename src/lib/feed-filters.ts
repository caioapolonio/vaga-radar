// Filters of a tab's feed, shared by the page, the API and the filter bar
// (client-safe: no Node imports)

export type Presence = 'any' | 'with' | 'without'

export const PERIODS = [
  { value: 'any', label: 'Qualquer data' },
  { value: '1', label: 'Últimas 24 horas' },
  { value: '3', label: 'Últimos 3 dias' },
  { value: '7', label: 'Última semana' },
  { value: '30', label: 'Último mês' },
] as const

export type Period = (typeof PERIODS)[number]['value']

export type FeedFilters = {
  q: string
  // Id of the search that found the post, or 'all'
  search: string
  period: Period
  email: Presence
}

export const NO_FILTERS: FeedFilters = {
  q: '',
  search: 'all',
  period: 'any',
  email: 'any',
}

// Counts next to each option, each one with every other filter applied
export type FeedFacets = {
  searches: Record<string, number>
  periods: Record<Period, number>
  email: { with: number; without: number }
  // Posts in the tab before any filter
  unfiltered: number
  // Already seen or applied, with the same filters
  archived: number
}

export type FeedPage<T> = { posts: T[]; hasMore: boolean; total: number }

const isPeriod = (value: string | null): value is Period =>
  PERIODS.some((period) => period.value === value)

const isPresence = (value: string | null): value is Presence =>
  value === 'any' || value === 'with' || value === 'without'

export const isFiltered = (filters: FeedFilters) =>
  filters.q.trim() !== '' ||
  filters.search !== NO_FILTERS.search ||
  filters.period !== NO_FILTERS.period ||
  filters.email !== NO_FILTERS.email

// Only the filters in use, for the API's query string
export function filterParams(filters: FeedFilters) {
  return Object.entries(filters).flatMap(([key, value]) => {
    const trimmed = value.trim()
    return trimmed && trimmed !== NO_FILTERS[key as keyof FeedFilters]
      ? [[key, trimmed] as [string, string]]
      : []
  })
}

export function parseFilters(params: URLSearchParams): FeedFilters {
  const period = params.get('period')
  const email = params.get('email')
  return {
    q: params.get('q') ?? '',
    search: params.get('search') || NO_FILTERS.search,
    period: isPeriod(period) ? period : NO_FILTERS.period,
    email: isPresence(email) ? email : NO_FILTERS.email,
  }
}
