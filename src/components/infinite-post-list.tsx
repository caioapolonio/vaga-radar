'use client'

import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { Section } from '@/lib/feed'
import { filterParams, NO_FILTERS, type FeedFilters } from '@/lib/feed-filters'
import { formatDayHeading } from '@/lib/format'
import type { Post } from '@/lib/store'
import { PostCard } from './post-card'

type Page = { posts: Post[]; hasMore: boolean }

// Posts arrive sorted newest first, so each day's group is contiguous
const groupByDay = (posts: Post[]) =>
  posts.reduce<{ heading: string; posts: Post[] }[]>((groups, post) => {
    const heading = formatDayHeading(post.postedAt)
    const last = groups.at(-1)
    if (last?.heading === heading) last.posts.push(post)
    else groups.push({ heading, posts: [post] })
    return groups
  }, [])

export function InfinitePostList({
  tab,
  section,
  initialPosts,
  initialHasMore,
  filters = NO_FILTERS,
  emptyMessage,
}: {
  // Search group id, or EMAIL_VIEW
  tab: string
  section: Section
  initialPosts: Post[]
  initialHasMore: boolean
  // Later pages keep the filters the first one was loaded with
  filters?: FeedFilters
  emptyMessage?: React.ReactNode
}) {
  const [posts, setPosts] = useState(initialPosts)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [isLoading, setIsLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const loadingRef = useRef(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const loadNextPage = async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    setIsLoading(true)
    setFailed(false)
    try {
      const params = new URLSearchParams([
        ['tab', tab],
        ['section', section],
        ['offset', String(posts.length)],
        ...filterParams(filters),
      ])
      const response = await fetch(`/api/posts?${params}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const page: Page = await response.json()
      setPosts((current) => {
        const loaded = new Set(current.map(({ id }) => id))
        return [...current, ...page.posts.filter(({ id }) => !loaded.has(id))]
      })
      setHasMore(page.hasMore)
    } catch {
      setFailed(true)
    } finally {
      loadingRef.current = false
      setIsLoading(false)
    }
  }

  const onSentinelVisible = useEffectEvent(() => void loadNextPage())

  // Re-observes after each page: if the sentinel is still on screen, keeps loading
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore || failed) return
    // Start loading well before the end, so scrolling rarely waits
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) onSentinelVisible()
      },
      { rootMargin: '800px 0px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [failed, hasMore, posts.length])

  if (!posts.length && !hasMore)
    return emptyMessage ? (
      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    ) : null

  return (
    <div className="flex flex-col gap-8">
      {groupByDay(posts).map(({ heading, posts }) => (
        <section key={heading} className="flex flex-col gap-3">
          <h2
            className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
            suppressHydrationWarning
          >
            {heading}
          </h2>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </section>
      ))}

      {hasMore && (
        // Also a button: works with the keyboard and when auto-loading fails
        <div ref={sentinelRef} className="flex justify-center py-4">
          <Button
            variant="ghost"
            size="sm"
            disabled={isLoading}
            onClick={() => void loadNextPage()}
          >
            {isLoading
              ? 'Carregando…'
              : failed
                ? 'Erro ao carregar. Tentar de novo'
                : 'Carregar mais'}
          </Button>
        </div>
      )}
    </div>
  )
}
