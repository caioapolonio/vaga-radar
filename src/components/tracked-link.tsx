'use client'

import type { Post } from '@/lib/store'
import { useFeed } from './feed-provider'

// Opening any job link marks the post as seen and remembers the URL
export function TrackedLink({
  post,
  href,
  ...props
}: React.ComponentProps<'a'> & { post: Post; href: string }) {
  const { openLink } = useFeed()
  const track = () => openLink(post, href)

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={track}
      onAuxClick={track}
      {...props}
    />
  )
}
