'use client'

import { ExternalLinkIcon, HistoryIcon, LinkIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatDateTime, formatRelative } from '@/lib/format'
import type { Post } from '@/lib/store'
import { cn } from '@/lib/utils'
import { ExpandableText } from './expandable-text'
import { useFeed } from './feed-provider'
import { LinkifiedText } from './linkified-text'
import { PostActions } from './post-actions'
import { TrackedLink } from './tracked-link'

const COLLAPSE_AFTER_CHARS = 420
const COLLAPSE_AFTER_LINES = 6

export function PostCard({
  post,
  summary,
}: {
  post: Post
  // Shown above the author, e.g. the AI's read of the job on "Para você"
  summary?: React.ReactNode
}) {
  const { searchLabels, statusOf, noticeOf } = useFeed()
  const status = statusOf(post)
  const notice = noticeOf(post)
  // Searches deleted since have no label left
  const labels = post.searchIds.flatMap((id) =>
    searchLabels[id] ? [{ id, label: searchLabels[id] }] : [],
  )
  const collapsible =
    post.content.length > COLLAPSE_AFTER_CHARS ||
    post.content.split('\n').length > COLLAPSE_AFTER_LINES

  return (
    <article
      className={cn(
        'rounded-xl border bg-card p-4 shadow-xs transition-opacity',
        status === 'seen' && 'border-red-500/70 dark:border-red-500/60',
        status === 'applied' &&
          'border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20',
      )}
    >
      {summary}

      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <a
            href={post.author.url}
            target="_blank"
            rel="noreferrer"
            className="font-medium hover:underline"
          >
            {post.author.name}
          </a>
          {post.author.headline && (
            <p className="truncate text-xs text-muted-foreground">
              {post.author.headline}
            </p>
          )}
        </div>
        <time
          dateTime={post.postedAt}
          title={formatDateTime(post.postedAt)}
          className="shrink-0 text-xs text-muted-foreground tabular-nums"
          suppressHydrationWarning
        >
          {formatRelative(post.postedAt)}
        </time>
      </header>

      {notice && (
        <p className="mt-3 flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
          <HistoryIcon className="size-3.5 shrink-0" />
          {notice.kind === 'applied'
            ? `Você já aplicou nesse link por outro post (${formatDateTime(notice.at)})`
            : `Você já abriu esse link em ${formatDateTime(notice.at)}`}
        </p>
      )}

      <ExpandableText
        collapsible={collapsible}
        className="mt-3 text-sm leading-relaxed"
      >
        <LinkifiedText text={post.content} post={post} />
      </ExpandableText>

      {post.attachment && (
        <TrackedLink
          post={post}
          href={post.attachment.url}
          className="mt-3 flex items-center gap-3 rounded-lg border bg-muted/40 p-3 transition-colors hover:bg-muted"
        >
          <LinkIcon className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {post.attachment.title}
            </p>
            {post.attachment.subtitle && (
              <p className="truncate text-xs text-muted-foreground">
                {post.attachment.subtitle}
              </p>
            )}
          </div>
        </TrackedLink>
      )}

      <footer className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {status === 'applied' && (
            <Badge className="bg-emerald-600 text-white">Aplicada</Badge>
          )}
          {status === 'seen' && (
            <Badge
              variant="outline"
              className="border-red-500/70 text-red-600 dark:text-red-400"
            >
              Vista
            </Badge>
          )}
          {labels.map(({ id, label }) => (
            <Badge key={id} variant="secondary">
              {label}
            </Badge>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <PostActions post={post} />
          <TrackedLink
            post={post}
            href={post.url}
            className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
          >
            Abrir no LinkedIn
            <ExternalLinkIcon className="size-3" />
          </TrackedLink>
        </div>
      </footer>
    </article>
  )
}
