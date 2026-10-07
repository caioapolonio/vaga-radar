'use client'

import { RefreshCwIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useResearch } from './research-provider'

// Without a group, re-runs every enabled search
export function ResearchButton({
  group,
  label = 'Re-pesquisar',
  ...props
}: { group?: { id: string; name: string }; label?: string } & Pick<
  React.ComponentProps<typeof Button>,
  'size' | 'variant' | 'className' | 'disabled'
>) {
  const { isRunning, run } = useResearch()
  const running = isRunning(group?.id)

  return (
    <Button
      {...props}
      onClick={() => run(group)}
      disabled={running || props.disabled}
    >
      <RefreshCwIcon
        data-icon="inline-start"
        className={cn(running && 'animate-spin')}
      />
      {running ? 'Pesquisando… (alguns minutos)' : label}
    </Button>
  )
}
