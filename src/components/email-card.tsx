'use client'

import {
  ExternalLinkIcon,
  FileTextIcon,
  SendIcon,
  SparklesIcon,
  Undo2Icon,
  XIcon,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { saveDraft, sendDraft, setDraftStatus } from '@/app/emails/actions'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { formatDateTime, formatRelative } from '@/lib/format'
import { jobBadges } from '@/lib/job'
import type { Draft, DraftFields } from '@/lib/outreach'
import type { CvLanguage } from '@/lib/profile-fields'
import type { Post } from '@/lib/store'
import { cn } from '@/lib/utils'

export type CvOption = { file: string; label: string; language: CvLanguage }

const FIELD =
  'w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60'
const LABEL = 'grid gap-1 text-xs font-medium text-muted-foreground'

export function EmailCard({
  draft,
  post,
  cvs,
}: {
  draft: Draft
  // Missing only if the post was removed from posts.json
  post?: Post
  cvs: CvOption[]
}) {
  const [fields, setFields] = useState<DraftFields>({
    to: draft.to,
    subject: draft.subject,
    body: draft.body,
    cv: draft.cv,
  })
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const pending = draft.status === 'pending'
  const cvLabel = cvs.find(({ file }) => file === fields.cv)?.label ?? fields.cv

  const edit =
    (field: keyof DraftFields) =>
    (
      event: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
      setFields((current) => ({ ...current, [field]: event.target.value }))
      setConfirming(false)
    }

  const save = () =>
    saveDraft(draft.postId, fields).catch(() =>
      toast.error('Não foi possível salvar a edição', {
        description: 'Verifique se o servidor está rodando.',
      }),
    )

  const send = async () => {
    setBusy(true)
    try {
      const result = await sendDraft(draft.postId, fields)
      if (result.ok)
        toast.success(`E-mail enviado para ${fields.to}`, {
          description: result.warning,
        })
      else toast.error('Não foi possível enviar', { description: result.error })
    } catch {
      toast.error('Não foi possível enviar', {
        description: 'O servidor não respondeu.',
      })
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  const changeStatus = async (status: 'pending' | 'discarded') => {
    setBusy(true)
    try {
      await setDraftStatus(draft.postId, status)
    } catch {
      toast.error('Não foi possível salvar', {
        description: 'Verifique se o servidor está rodando.',
      })
    } finally {
      setBusy(false)
    }
  }

  const badges = jobBadges(draft.job)

  return (
    <article
      className={cn(
        'rounded-xl border bg-card p-4 shadow-xs',
        draft.status === 'sent' &&
          'border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20',
        draft.status === 'discarded' && 'opacity-75',
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold">{draft.job.title}</h2>
          {draft.job.company && (
            <p className="text-sm text-muted-foreground">{draft.job.company}</p>
          )}
        </div>
        {post && (
          <time
            dateTime={post.postedAt}
            title={formatDateTime(post.postedAt)}
            className="shrink-0 text-xs text-muted-foreground tabular-nums"
            suppressHydrationWarning
          >
            {formatRelative(post.postedAt)}
          </time>
        )}
      </header>

      {badges.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {badges.map(({ field, value }) => (
            <Badge key={field} variant="secondary">
              {value}
            </Badge>
          ))}
        </div>
      )}

      <p className="mt-3 flex gap-2 rounded-lg bg-sky-50 px-3 py-2 text-xs leading-relaxed text-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
        <SparklesIcon className="mt-0.5 size-3.5 shrink-0" />
        {draft.fit}
      </p>

      {post && (
        <div className="mt-3 rounded-lg border bg-muted/40 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <a
                href={post.author.url}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium hover:underline"
              >
                {post.author.name}
              </a>
              {post.author.headline && (
                <p className="truncate text-xs text-muted-foreground">
                  {post.author.headline}
                </p>
              )}
            </div>
            <a
              href={post.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-1 text-xs font-medium hover:underline"
            >
              Ver post
              <ExternalLinkIcon className="size-3" />
            </a>
          </div>
          <details className="mt-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none hover:text-foreground">
              Post original
            </summary>
            <p className="mt-2 text-sm leading-relaxed wrap-break-word whitespace-pre-line text-foreground">
              {post.content}
            </p>
          </details>
        </div>
      )}

      {pending ? (
        <div className="mt-4 grid gap-3">
          <label className={LABEL}>
            Para
            <input
              type="email"
              value={fields.to}
              onChange={edit('to')}
              onBlur={save}
              disabled={busy}
              className={FIELD}
            />
          </label>
          <label className={LABEL}>
            Assunto
            <input
              value={fields.subject}
              onChange={edit('subject')}
              onBlur={save}
              disabled={busy}
              className={FIELD}
            />
          </label>
          <label className={LABEL}>
            Mensagem
            <textarea
              value={fields.body}
              onChange={edit('body')}
              onBlur={save}
              disabled={busy}
              rows={12}
              className={cn(FIELD, 'resize-y leading-relaxed')}
            />
          </label>
          <div className="flex items-end gap-2">
            <label className={cn(LABEL, 'min-w-0 flex-1')}>
              CV anexado
              <select
                value={fields.cv}
                onChange={edit('cv')}
                onBlur={save}
                disabled={busy}
                className={FIELD}
              >
                {cvs.map(({ file, label }) => (
                  <option key={file} value={file}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <CvLink cv={fields.cv} />
          </div>
        </div>
      ) : (
        <details className="mt-3 text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none hover:text-foreground">
            {draft.status === 'sent' ? 'E-mail enviado' : 'E-mail'} para{' '}
            {draft.to} · {cvLabel}
          </summary>
          <div className="mt-2 rounded-lg border bg-background p-3 text-sm text-foreground">
            <p className="font-medium">{draft.subject}</p>
            <p className="mt-2 leading-relaxed wrap-break-word whitespace-pre-line">
              {draft.body}
            </p>
          </div>
        </details>
      )}

      <footer className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {pending && !confirming && (
          <>
            <Button
              variant="ghost"
              onClick={() => changeStatus('discarded')}
              disabled={busy}
            >
              <XIcon data-icon="inline-start" />
              Descartar
            </Button>
            <Button onClick={() => setConfirming(true)} disabled={busy}>
              <SendIcon data-icon="inline-start" />
              Enviar
            </Button>
          </>
        )}
        {pending && confirming && (
          <>
            <p className="mr-auto text-xs text-muted-foreground">
              Enviar para{' '}
              <strong className="text-foreground">{fields.to}</strong> com o CV{' '}
              {cvLabel}?
            </p>
            <Button
              variant="ghost"
              onClick={() => setConfirming(false)}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button onClick={send} disabled={busy}>
              <SendIcon data-icon="inline-start" />
              {busy ? 'Enviando…' : 'Confirmar envio'}
            </Button>
          </>
        )}
        {draft.status === 'sent' && draft.statusAt && (
          <p className="text-xs text-emerald-700 dark:text-emerald-400">
            Enviado em {formatDateTime(draft.statusAt)}
          </p>
        )}
        {draft.status === 'discarded' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => changeStatus('pending')}
            disabled={busy}
          >
            <Undo2Icon data-icon="inline-start" />
            Restaurar
          </Button>
        )}
      </footer>
    </article>
  )
}

function CvLink({ cv }: { cv: string }) {
  return (
    <a
      href={`/api/cv?file=${encodeURIComponent(cv)}`}
      target="_blank"
      rel="noreferrer"
      className={buttonVariants({ variant: 'outline', size: 'lg' })}
    >
      <FileTextIcon data-icon="inline-start" />
      Abrir PDF
    </a>
  )
}
