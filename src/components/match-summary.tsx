import { ArrowUpRightIcon, MailIcon, SparklesIcon } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { jobBadges } from '@/lib/job'
import { strengthInfo } from '@/lib/match-strength'
import type { MatchVerdict } from '@/lib/matches'
import type { Post } from '@/lib/store'
import { TrackedLink } from './tracked-link'

// The AI's read of the job, on top of the post card
export function MatchSummary({
  post,
  verdict,
  hasEmailCard,
  otherPosts,
}: {
  post: Post
  verdict: MatchVerdict
  hasEmailCard: boolean
  // Other posts about the same job, folded into this card
  otherPosts: number
}) {
  const job = verdict.job ?? { title: 'Vaga' }
  const strength = strengthInfo(verdict.strength)

  return (
    <div className="mb-4 border-b pb-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold">{job.title}</h2>
          {job.company && (
            <p className="text-sm text-muted-foreground">{job.company}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {hasEmailCard && (
            <Link
              href="/emails"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <MailIcon data-icon="inline-start" />
              Card de e-mail
            </Link>
          )}
          {verdict.applyUrl && (
            <TrackedLink
              post={post}
              href={verdict.applyUrl}
              className={buttonVariants({ size: 'sm' })}
            >
              Candidatar-se
              <ArrowUpRightIcon data-icon="inline-end" />
            </TrackedLink>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        <Badge title={strength.hint} className={strength.className}>
          {strength.badge}
        </Badge>
        {jobBadges(job).map(({ field, value }) => (
          <Badge key={field} variant="secondary">
            {value}
          </Badge>
        ))}
      </div>

      {otherPosts > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Também em {otherPosts}{' '}
          {otherPosts === 1 ? 'outro post' : 'outros posts'}
        </p>
      )}

      {verdict.fit && (
        <p className="mt-3 flex gap-2 rounded-lg bg-sky-50 px-3 py-2 text-xs leading-relaxed text-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
          <SparklesIcon className="mt-0.5 size-3.5 shrink-0" />
          {verdict.fit}
        </p>
      )}
    </div>
  )
}
