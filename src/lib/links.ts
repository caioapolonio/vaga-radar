import type { Post } from './store'

export const URL_PATTERN = /(https?:\/\/[^\s)]+)/g

const TRACKING_PARAM = /^(utm_|trk|tracking|ref|fbclid|gclid)/i
// Recruiters often link their own profile, which says nothing about the job
const PROFILE_LINK = /linkedin\.com\/(in|company)\//i

const EMAIL_ADDRESS = /^[^\s@/:]+@[^\s@/]+\.[a-z]{2,}$/i
// "nerdin.com.br/vaga/1", "www.empresa.com": a domain, maybe with a path
const BARE_DOMAIN = /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}([/?#]|$)/i

// A link as a post writes it, ready for an href. Posts often leave out
// "https://", which browsers would read as a path on this site; anything
// other than a web page or an email address gets no link at all
export function toHref(raw: string) {
  const link = raw.trim()
  if (/^https?:\/\//i.test(link) || /^mailto:/i.test(link)) return link
  if (EMAIL_ADDRESS.test(link)) return `mailto:${link}`
  // javascript:, data: and other schemes
  if (/^[a-z][a-z0-9+.-]*:/i.test(link)) return null
  if (BARE_DOMAIN.test(link)) return `https://${link}`
  return null
}

// Same job shared by different posts should map to the same key
export function normalizeUrl(raw: string) {
  try {
    const url = new URL(raw)
    for (const key of [...url.searchParams.keys()])
      if (TRACKING_PARAM.test(key)) url.searchParams.delete(key)
    const path = url.pathname.replace(/\/+$/, '')
    return `${url.host.toLowerCase()}${path}${url.search}`
  } catch {
    return raw
  }
}

export const jobLinks = (post: Post) =>
  [post.attachment?.url, ...(post.content.match(URL_PATTERN) ?? [])]
    .filter((link): link is string => !!link && !PROFILE_LINK.test(link))
    .map(normalizeUrl)

export type LinkNotice = { kind: 'applied' | 'opened'; at: string }

// Normalized URL -> when it was first opened / which post applied through it
export type LinkIndex = {
  opened: Record<string, string>
  applied: Record<string, { postId: string; at: string }>
}

export function buildLinkIndex(
  posts: Post[],
  opened: Record<string, string> = {},
): LinkIndex {
  const applied: LinkIndex['applied'] = {}
  for (const post of posts)
    if (post.status === 'applied')
      for (const link of jobLinks(post))
        applied[link] ??= { postId: post.id, at: post.statusAt ?? '' }
  return { opened, applied }
}

// Flags a post pointing to a job link already opened, or applied to via another post
export function noticeFor(
  post: Post,
  { opened, applied }: LinkIndex,
): LinkNotice | undefined {
  const links = jobLinks(post)
  const appliedVia = links
    .map((link) => applied[link])
    .find((entry) => entry && entry.postId !== post.id)
  if (appliedVia) return { kind: 'applied', at: appliedVia.at }
  const openedAt = links.map((link) => opened[link]).find(Boolean)
  if (openedAt) return { kind: 'opened', at: openedAt }
}
