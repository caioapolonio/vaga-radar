import { CheckCircle2Icon, CircleIcon } from 'lucide-react'
import Link from 'next/link'
import type { SetupStep } from '@/lib/setup'
import { cn } from '@/lib/utils'

// Shown until every step is done, so a fresh clone knows where to start
export function SetupChecklist({ steps }: { steps: SetupStep[] }) {
  const done = steps.filter((step) => step.done).length
  if (done === steps.length) return null

  return (
    <section className="mt-6 rounded-xl border bg-card p-4 shadow-xs">
      <h2 className="text-sm font-semibold">
        Primeiros passos{' '}
        <span className="font-normal text-muted-foreground tabular-nums">
          ({done} de {steps.length})
        </span>
      </h2>
      <ul className="mt-3 flex flex-col gap-2 text-sm">
        {steps.map(({ id, label, href, done }) => (
          <li key={id} className="flex items-start gap-2">
            {done ? (
              <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            ) : (
              <CircleIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            )}
            {done ? (
              <span className="text-muted-foreground line-through">
                {label}
              </span>
            ) : (
              <Link
                href={href}
                className={cn('underline-offset-4 hover:underline')}
              >
                {label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
