import {
  ArrowUpRightIcon,
  MailCheckIcon,
  MailIcon,
  MailMinusIcon,
  MailXIcon,
  SparklesIcon,
} from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { formatDateTime } from '@/lib/format'
import { jobBadges } from '@/lib/job'
import { toHref } from '@/lib/links'
import { strengthInfo } from '@/lib/match-strength'
import type { MatchVerdict } from '@/lib/matches'
import type { DraftStatus } from '@/lib/outreach'
import type { Post } from '@/lib/store'
import { cn } from '@/lib/utils'
import { TrackedLink } from './tracked-link'

// The job's card on E-mails, or the one already written to its address
export type JobEmailCard = {
  postId: string
  status: DraftStatus
  to: string
  // When it was sent or discarded
  at?: string
  // Set when the card was written for another post at the same address
  otherJob?: string
}

// What happened on E-mails, in one line under the badges
function emailNote(card: JobEmailCard | null, noCard: string | null) {
  if (!card)
    return (
      noCard && {
        Icon: MailMinusIcon,
        text: `Sem card de e-mail: ${noCard}`,
        className: 'text-muted-foreground',
      }
    )
  const at = card.at ? ` em ${formatDateTime(card.at)}` : ''
  const job = card.otherJob ? ` (vaga ${card.otherJob})` : ''
  if (card.status === 'sent')
    return {
      Icon: MailCheckIcon,
      text: `E-mail enviado para ${card.to}${at}${job}`,
      className: 'text-emerald-700 dark:text-emerald-400',
    }
  if (card.status === 'discarded')
    return {
      Icon: MailXIcon,
      text: `Card de e-mail para ${card.to} descartado${at}${job}`,
      className: 'text-muted-foreground',
    }
  // The job's own waiting card needs no line: the button says it
  return (
    card.otherJob && {
      Icon: MailIcon,
      text: `Já existe card para ${card.to}${job}, esperando revisão`,
      className: 'text-muted-foreground',
    }
  )
}

// The AI's read of the job, on top of the post card
export function MatchSummary({
  post,
  verdict,
  emailCard,
  noEmailCard,
  otherPosts,
}: {
  post: Post
  verdict: MatchVerdict
  emailCard: JobEmailCard | null
  // Why E-mails wrote no card for a post with an address
  noEmailCard: string | null
  // Other posts about the same job, folded into this card
  otherPosts: number
}) {
  const job = verdict.job ?? { title: 'Vaga' }
  const strength = strengthInfo(verdict.strength)
  const applyHref = verdict.applyUrl && toHref(verdict.applyUrl)
  const note = emailNote(emailCard, noEmailCard)

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
          {emailCard?.status === 'pending' && (
            <Link
              href={`/emails#card-${emailCard.postId}`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <MailIcon data-icon="inline-start" />
              Card de e-mail
            </Link>
          )}
          {applyHref && (
            <TrackedLink
              post={post}
              href={applyHref}
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

      {note && (
        <p className={cn('mt-2 flex gap-2 text-xs', note.className)}>
          <note.Icon className="mt-px size-3.5 shrink-0" />
          {note.text}
        </p>
      )}

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
