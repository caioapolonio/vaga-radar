// Search groups the user creates on /buscas; each group is a tab of the feed
// (client-safe: no Node imports)

export type Search = {
  id: string
  label: string
  // LinkedIn post search syntax: "exact terms" joined by AND, OR, NOT
  query: string
  enabled: boolean
}

export type SearchGroup = {
  id: string
  name: string
  // The first run only goes back the shorter lookback from /ajustes, for
  // posts that go stale fast (asking for a CV by email, for instance)
  recentOnly: boolean
  searches: Search[]
}

export type SearchConfig = { groups: SearchGroup[] }

// A search as the Apify run needs it
export type RunnableSearch = Search & { recentOnly: boolean }

// The fixed tab with every post that has an email address in it
export const EMAIL_VIEW = 'com-email'

// The Apify Actor rejects queries with more than 5 AND/OR/NOT operators
// (it returns zero posts instead of failing the run)
export const MAX_OPERATORS = 5

export const operatorCount = (query: string) =>
  query.match(/\b(AND|OR|NOT)\b/g)?.length ?? 0

// What's wrong with a query, or null when it can run
export function queryProblem(query: string) {
  const trimmed = query.trim()
  if (!trimmed) return 'Escreva a busca'
  const operators = operatorCount(trimmed)
  if (operators > MAX_OPERATORS)
    return `A busca tem ${operators} operadores AND/OR/NOT: o máximo é ${MAX_OPERATORS}`
  if ((trimmed.match(/"/g)?.length ?? 0) % 2)
    return 'Feche as aspas que ficaram abertas'
  let depth = 0
  for (const char of trimmed) {
    depth += char === '(' ? 1 : char === ')' ? -1 : 0
    if (depth < 0) break
  }
  if (depth) return 'Os parênteses não fecham'
  return null
}

// Every enabled search, or only one group's
export const runnableSearches = (
  { groups }: SearchConfig,
  groupId?: string,
): RunnableSearch[] =>
  groups
    .filter((group) => !groupId || group.id === groupId)
    .flatMap(({ searches, recentOnly }) =>
      searches
        .filter(({ enabled }) => enabled)
        .map((search) => ({ ...search, recentOnly })),
    )

// Search id -> label, for the chips on each post
export const searchLabels = ({ groups }: SearchConfig) =>
  Object.fromEntries(
    groups.flatMap(({ searches }) =>
      searches.map(({ id, label }) => [id, label]),
    ),
  )

// "Dev remoto" -> "dev-remoto-k3x9", unique enough for a local list
export const newId = (name: string) =>
  `${
    name
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30) || 'busca'
  }-${Math.random().toString(36).slice(2, 6)}`
