import { URL_PATTERN } from '@/lib/links'
import type { Post } from '@/lib/store'
import { TrackedLink } from './tracked-link'

export function LinkifiedText({ text, post }: { text: string; post: Post }) {
  // split() with a capture group alternates plain text and URLs
  return text.split(URL_PATTERN).map((part, index) =>
    index % 2 === 1 ? (
      <TrackedLink
        key={index}
        post={post}
        href={part}
        className="break-all text-sky-700 underline underline-offset-2 hover:text-sky-900 dark:text-sky-400 dark:hover:text-sky-300"
      >
        {part}
      </TrackedLink>
    ) : (
      part
    ),
  )
}
