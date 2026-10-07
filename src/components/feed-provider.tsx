'use client'

import { createContext, use, useState } from 'react'
import { toast } from 'sonner'
import { markLinkOpened, setPostStatus } from '@/app/actions'
import {
  jobLinks,
  normalizeUrl,
  noticeFor,
  type LinkIndex,
  type LinkNotice,
} from '@/lib/links'
import type { Post, PostStatus } from '@/lib/store'

type Feed = {
  // Search id -> label, for the chips on each post
  searchLabels: Record<string, string>
  statusOf: (post: Post) => PostStatus | undefined
  noticeOf: (post: Post) => LinkNotice | undefined
  setStatus: (post: Post, status: PostStatus | null) => void
  openLink: (post: Post, url: string) => void
}

const FeedContext = createContext<Feed | null>(null)

export function useFeed() {
  const feed = use(FeedContext)
  if (!feed) throw new Error('useFeed must be used inside <FeedProvider>')
  return feed
}

const warnNotSaved = () =>
  toast.error('Não foi possível salvar', {
    description: 'Verifique se o servidor está rodando.',
  })

// Marks live here too, so they show instantly on every loaded page of posts
export function FeedProvider({
  linkIndex,
  searchLabels,
  children,
}: {
  linkIndex: LinkIndex
  searchLabels: Record<string, string>
  children: React.ReactNode
}) {
  const [statuses, setStatuses] = useState<Record<string, PostStatus | null>>(
    {},
  )
  const [links, setLinks] = useState(linkIndex)

  const statusOf = (post: Post) =>
    post.id in statuses ? (statuses[post.id] ?? undefined) : post.status

  const setStatus = (post: Post, status: PostStatus | null) => {
    const at = new Date().toISOString()
    setStatuses((current) => ({ ...current, [post.id]: status }))
    setLinks((current) => {
      const applied = Object.fromEntries(
        Object.entries(current.applied).filter(
          ([, entry]) => entry.postId !== post.id,
        ),
      )
      if (status === 'applied')
        for (const link of jobLinks(post))
          applied[link] ??= { postId: post.id, at }
      return { ...current, applied }
    })
    setPostStatus(post.id, status).catch(warnNotSaved)
  }

  const openLink = (post: Post, url: string) => {
    const at = new Date().toISOString()
    // Keep the first time a link was opened
    setLinks((current) => ({
      ...current,
      opened: { [normalizeUrl(url)]: at, ...current.opened },
    }))
    if (!statusOf(post))
      setStatuses((current) => ({ ...current, [post.id]: 'seen' }))
    markLinkOpened(post.id, url).catch(warnNotSaved)
  }

  const noticeOf = (post: Post) =>
    statusOf(post) ? undefined : noticeFor(post, links)

  return (
    <FeedContext
      value={{ searchLabels, statusOf, noticeOf, setStatus, openLink }}
    >
      {children}
    </FeedContext>
  )
}
