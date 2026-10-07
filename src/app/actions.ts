'use server'

import { revalidatePath } from 'next/cache'
import { normalizeUrl } from '@/lib/links'
import { updateStore, type Post, type PostStatus } from '@/lib/store'

// undefined fields are dropped when the store is serialized
const withStatus = (post: Post, status: PostStatus | null): Post => ({
  ...post,
  status: status ?? undefined,
  statusAt: status ? new Date().toISOString() : undefined,
})

export async function setPostStatus(postId: string, status: PostStatus | null) {
  await updateStore((store) => ({
    ...store,
    posts: store.posts.map((post) =>
      post.id === postId ? withStatus(post, status) : post,
    ),
  }))
  revalidatePath('/')
}

export async function markLinkOpened(postId: string, url: string) {
  const openedAt = new Date().toISOString()
  await updateStore((store) => ({
    ...store,
    // Keep the first time a link was opened
    openedLinks: { [normalizeUrl(url)]: openedAt, ...store.openedLinks },
    posts: store.posts.map((post) =>
      post.id === postId && !post.status
        ? { ...post, status: 'seen', statusAt: openedAt }
        : post,
    ),
  }))
  revalidatePath('/')
}
