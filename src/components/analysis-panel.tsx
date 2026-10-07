'use client'

import { SparklesIcon, SquareIcon } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { AnalysisKind, JobState } from '@/lib/analysis/jobs'
import type { AnalysisOverview } from '@/lib/analysis/overview'
import { formatUsd } from '@/lib/format'

const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact' })

const cost = (usd: number | null) =>
  usd === null ? '' : usd < 0.01 ? 'menos de US$ 0,01' : `~${formatUsd(usd)}`

// Starts a run of the AI over the posts waiting, and follows its progress
export function AnalysisPanel({
  kind,
  initial,
  actionLabel,
  found,
}: {
  kind: AnalysisKind
  initial: AnalysisOverview
  actionLabel: string
  // What a match is called here: ['vaga que combina', 'vagas que combinam']
  found: [string, string]
}) {
  const router = useRouter()
  const [overview, setOverview] = useState(initial)
  const [starting, setStarting] = useState(false)
  // The status from the last poll, to notice a run finishing
  const lastStatus = useRef<JobState['status'] | null>(
    initial.job?.status ?? null,
  )

  const describe = (count: number) =>
    `${count} ${count === 1 ? found[0] : found[1]}`

  const poll = useEffectEvent(async () => {
    const response = await fetch(`/api/analysis?kind=${kind}`).catch(() => null)
    if (!response?.ok) return
    const next: AnalysisOverview = await response.json()
    const wasRunning = lastStatus.current === 'running'
    lastStatus.current = next.job?.status ?? null
    setOverview(next)
    if (wasRunning && next.job && next.job.status !== 'running') {
      const { status, matched, error } = next.job
      if (status === 'failed')
        toast.error('A análise parou', { description: error })
      else
        toast.success(
          `Análise ${status === 'canceled' ? 'interrompida' : 'concluída'}: ${describe(matched)}`,
        )
      router.refresh()
    }
  })

  const running = overview.job?.status === 'running'

  // Every 1.5 s while a run goes on, even one started in another tab
  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => void poll(), 1500)
    return () => clearInterval(timer)
  }, [running])

  const start = async () => {
    setStarting(true)
    try {
      const response = await fetch(`/api/analysis?kind=${kind}`, {
        method: 'POST',
      })
      const result = await response.json()
      if (!response.ok) toast.error(result.error)
      else {
        lastStatus.current = 'running'
        setOverview((current) => ({ ...current, job: result.job }))
      }
    } catch {
      toast.error('O servidor não respondeu')
    } finally {
      setStarting(false)
    }
  }

  const stop = () =>
    fetch(`/api/analysis?kind=${kind}`, { method: 'DELETE' }).catch(() => {})

  const { job } = overview
  return (
    <section className="mt-4 rounded-xl border bg-card p-4 shadow-xs">
      {!overview.aiReady ? (
        <p className="text-sm text-muted-foreground">
          Configure a IA em{' '}
          <Link href="/ajustes" className="underline underline-offset-4">
            Ajustes
          </Link>{' '}
          para ela ler{' '}
          {overview.pending
            ? `os ${overview.pending} posts que estão esperando.`
            : 'os posts novos depois de cada pesquisa.'}
        </p>
      ) : running && job ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              Analisando com {job.model}…{' '}
              <span className="text-muted-foreground tabular-nums">
                {job.done + job.skipped} de {job.total} posts ·{' '}
                {describe(job.matched)}
                {job.costUsd !== null && ` · ${cost(job.costUsd)}`}
              </span>
            </p>
            <Button variant="outline" size="sm" onClick={() => void stop()}>
              <SquareIcon data-icon="inline-start" />
              Parar
            </Button>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{
                width: `${job.total ? ((job.done + job.skipped) / job.total) * 100 : 0}%`,
              }}
            />
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <p>
              {overview.pending
                ? `${overview.pending} posts esperando a IA`
                : 'Nenhum post esperando a IA.'}
            </p>
            {overview.pending > 0 && (
              <p className="text-xs text-muted-foreground">
                Estimativa com {overview.model}: ~
                {compact.format(overview.inputTokens)} tokens de entrada e ~
                {compact.format(overview.outputTokens)} de saída
                {overview.costUsd !== null && ` (${cost(overview.costUsd)})`}
                {overview.subscription && ' · usa a cota da sua assinatura'}
              </p>
            )}
            {job && job.status !== 'running' && (
              <p
                className={
                  job.status === 'failed'
                    ? 'mt-1 text-xs text-destructive'
                    : 'mt-1 text-xs text-muted-foreground'
                }
              >
                {job.status === 'failed'
                  ? `A última análise parou: ${job.error}`
                  : `Última análise: ${describe(job.matched)} em ${job.done} posts${
                      job.skipped
                        ? ` · ${job.skipped} ficaram para a próxima`
                        : ''
                    }${job.costUsd !== null ? ` · ${cost(job.costUsd)}` : ''}`}
              </p>
            )}
          </div>
          <Button
            onClick={() => void start()}
            disabled={starting || !overview.pending}
          >
            <SparklesIcon data-icon="inline-start" />
            {starting ? 'Iniciando…' : actionLabel}
          </Button>
        </div>
      )}
    </section>
  )
}
