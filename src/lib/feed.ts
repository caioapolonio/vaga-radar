import {
  NO_FILTERS,
  PERIODS,
  type FeedFacets,
  type FeedFilters,
  type FeedPage,
  type Period,
} from './feed-filters'
import { findEmails } from './outreach'
import { EMAIL_VIEW, type SearchConfig } from './search-config'
import type { Post, Store } from './store'
import { foldText, hasTerms, queryTerms } from './text-search'

export const PAGE_SIZE = 30

export type Section = 'active' | 'archived'

// A tab of the feed: one of the user's search groups, or EMAIL_VIEW
export type View = string

export const isView = (
  { groups }: SearchConfig,
  view: string | null,
): view is View => view === EMAIL_VIEW || groups.some(({ id }) => id === view)

// Every search ever in the group, disabled ones too, so turning a search off
// doesn't hide the posts it already found
const groupSearchIds = ({ groups }: SearchConfig, view: View) =>
  new Set(
    groups.find(({ id }) => id === view)?.searches.map(({ id }) => id) ?? [],
  )

// Start of the tab's latest search; groups can be searched on their own
export function tabSearchedAt(store: Store, config: SearchConfig, view: View) {
  if (view === EMAIL_VIEW) return store.lastSearchedAt
  const ids = groupSearchIds(config, view)
  const dates = Object.entries(store.searchedAt ?? {}).flatMap(([id, at]) =>
    ids.has(id) ? [at] : [],
  )
  return dates.length ? dates.sort().at(-1)! : null
}

// Posts marked before the tab's last search leave its main list; the ones
// marked since stay visible so you can still flip "Já vi" to "Apliquei"
const isArchived = (post: Post, searchedAt: string | null) =>
  !!post.status && !!searchedAt && (post.statusAt ?? '') < searchedAt

export function selectPosts(
  store: Store,
  config: SearchConfig,
  view: View,
  section: Section,
) {
  const ids = groupSearchIds(config, view)
  const searchedAt = tabSearchedAt(store, config, view)
  return store.posts.filter(
    (post) =>
      (view === EMAIL_VIEW
        ? hasEmail(post)
        : post.searchIds.some((id) => ids.has(id))) &&
      isArchived(post, searchedAt) === (section === 'archived'),
  )
}

// Folding thousands of posts on every keystroke adds up, and a post's text
// never changes once saved
const searchableText = new Map<string, string>()
const textOf = (post: Post) => {
  let text = searchableText.get(post.id)
  if (text === undefined) {
    const { author, attachment, content } = post
    text = foldText(
      [author.name, author.headline, attachment?.title, content].join(' '),
    )
    searchableText.set(post.id, text)
  }
  return text
}

const withEmail = new Map<string, boolean>()
const hasEmail = (post: Post) => {
  let found = withEmail.get(post.id)
  if (found === undefined) {
    found = findEmails(post.content).length > 0
    withEmail.set(post.id, found)
  }
  return found
}

const DAY_MS = 86_400_000

const withinPeriod = (post: Post, period: Period, now: number) =>
  period === 'any' ||
  now - new Date(post.postedAt).getTime() <= Number(period) * DAY_MS

// The posts that pass every filter, except the one named in `skip` (so its
// options can show how many posts each would leave)
function filterPosts(
  posts: Post[],
  filters: FeedFilters,
  now: number,
  skip?: keyof FeedFilters,
) {
  const terms = queryTerms(filters.q)
  return posts.filter(
    (post) =>
      (skip === 'q' || hasTerms(textOf(post), terms)) &&
      (skip === 'search' ||
        filters.search === 'all' ||
        post.searchIds.includes(filters.search)) &&
      (skip === 'period' || withinPeriod(post, filters.period, now)) &&
      (skip === 'email' ||
        filters.email === 'any' ||
        (filters.email === 'with') === hasEmail(post)),
  )
}

export function feedPage(
  store: Store,
  config: SearchConfig,
  view: View,
  section: Section,
  filters: FeedFilters,
  offset = 0,
  now = Date.now(),
): FeedPage<Post> {
  const posts = filterPosts(
    selectPosts(store, config, view, section),
    filters,
    now,
  )
  return {
    posts: posts.slice(offset, offset + PAGE_SIZE),
    hasMore: offset + PAGE_SIZE < posts.length,
    total: posts.length,
  }
}

export function feedFacets(
  store: Store,
  config: SearchConfig,
  view: View,
  filters: FeedFilters,
  now = Date.now(),
): FeedFacets {
  const active = selectPosts(store, config, view, 'active')
  const count = <T>(
    skip: keyof FeedFilters,
    keys: readonly T[],
    belongs: (post: Post, key: T) => boolean,
  ) => {
    const posts = filterPosts(active, filters, now, skip)
    return keys.map((key) => posts.filter((post) => belongs(post, key)).length)
  }

  // "Com e-mail" mixes every group, so it offers every search
  const searchIds =
    view === EMAIL_VIEW
      ? config.groups.flatMap(({ searches }) => searches.map(({ id }) => id))
      : [...groupSearchIds(config, view)]
  const periods = PERIODS.map(({ value }) => value)
  const [emailYes, emailNo] = count(
    'email',
    [true, false],
    (post, wanted) => hasEmail(post) === wanted,
  )

  return {
    searches: Object.fromEntries(
      count('search', searchIds, (post, id) => post.searchIds.includes(id)).map(
        (total, index) => [searchIds[index], total],
      ),
    ),
    periods: Object.fromEntries(
      count('period', periods, (post, period) =>
        withinPeriod(post, period, now),
      ).map((total, index) => [periods[index], total]),
    ) as Record<Period, number>,
    email: { with: emailYes ?? 0, without: emailNo ?? 0 },
    unfiltered: active.length,
    archived: feedPage(store, config, view, 'archived', filters, 0, now).total,
  }
}

// The first page and the filter counts, as the page and the API send them
export const firstFeedPage = (
  store: Store,
  config: SearchConfig,
  view: View,
  filters = NO_FILTERS,
  now = Date.now(),
) => ({
  ...feedPage(store, config, view, 'active', filters, 0, now),
  facets: feedFacets(store, config, view, filters, now),
})
