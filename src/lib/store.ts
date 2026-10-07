import path from 'node:path'
import { jsonUpdater, readJson } from './json-file'

export type PostStatus = 'seen' | 'applied'

export type Post = {
  id: string
  url: string
  content: string
  postedAt: string
  author: { name: string; headline: string; url: string }
  // Job or article attached to the post, usually the application page
  attachment?: { title: string; subtitle?: string; url: string }
  searchIds: string[]
  status?: PostStatus
  statusAt?: string
}

export type Store = {
  lastSearchedAt: string | null
  // Search id -> start of its last successful run
  searchedAt?: Record<string, string>
  // Search group the run covered; without one, every enabled search
  lastRun?: {
    tab?: string
    newPosts: number
    fetchedPosts: number
    costUsd: number
  }
  posts: Post[]
  // Normalized URL -> when it was first opened from this app
  openedLinks?: Record<string, string>
}

const STORE_PATH = path.join(process.cwd(), 'data', 'posts.json')

const emptyStore = (): Store => ({ lastSearchedAt: null, posts: [] })

export const readStore = () => readJson(STORE_PATH, emptyStore)

export const updateStore = jsonUpdater(STORE_PATH, emptyStore)

export function mergePosts(existing: Post[], incoming: Post[]) {
  const byId = new Map(existing.map((post) => [post.id, post]))
  let newPosts = 0

  for (const post of incoming) {
    const saved = byId.get(post.id)
    if (saved) {
      saved.searchIds = [...new Set([...saved.searchIds, ...post.searchIds])]
    } else {
      byId.set(post.id, post)
      newPosts++
    }
  }

  const posts = [...byId.values()].sort((a, b) =>
    b.postedAt.localeCompare(a.postedAt),
  )
  return { posts, newPosts }
}
