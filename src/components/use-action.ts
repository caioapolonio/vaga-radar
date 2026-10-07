'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'

type Result = { ok: true; message?: string } | { ok: false; error: string }

// Runs a Server Action with a pending flag and toasts for the outcome
export function useAction() {
  const [pending, startTransition] = useTransition()

  const run = (
    action: () => Promise<Result>,
    { success, onDone }: { success?: string; onDone?: () => void } = {},
  ) =>
    startTransition(async () => {
      try {
        const result = await action()
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        const message = result.message ?? success
        if (message) toast.success(message)
        onDone?.()
      } catch {
        toast.error('Não foi possível salvar', {
          description: 'Verifique se o servidor está rodando.',
        })
      }
    })

  return [pending, run] as const
}
