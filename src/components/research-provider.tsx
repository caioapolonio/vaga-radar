'use client'

import { useRouter } from 'next/navigation'
import { createContext, use, useState } from 'react'
import { toast } from 'sonner'
import { formatUsd } from '@/lib/format'
import type { ResearchResult } from '@/lib/research'

type Group = { id: string; name: string }

type Research = {
  // Without a group, every enabled search
  isRunning: (groupId?: string) => boolean
  run: (group?: Group) => void
}

const ResearchContext = createContext<Research | null>(null)

export function useResearch() {
  const research = use(ResearchContext)
  if (!research)
    throw new Error('useResearch must be used inside <ResearchProvider>')
  return research
}

// Lives above the feed, which remounts after every search: a run still going
// in another tab keeps its spinner and its toast
export function ResearchProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  // Plain state, not a transition: React batches concurrent transitions, so a
  // minutes-long search would hold back every other update on the page
  const [running, setRunning] = useState<string[]>([])

  // The server joins a full search already running instead of starting another
  const isRunning = (groupId?: string) =>
    running.includes('all') || running.includes(groupId ?? 'all')

  const run = async (group?: Group) => {
    const scope = group?.id ?? 'all'
    const prefix = group ? `${group.name}: ` : ''
    setRunning((current) => [...current, scope])
    try {
      const response = await fetch(
        group
          ? `/api/research?group=${encodeURIComponent(group.id)}`
          : '/api/research',
        { method: 'POST' },
      )
      const result: ResearchResult = await response.json()
      if (!result.ok) {
        toast.error(`${prefix}Não foi possível pesquisar`, {
          description: result.error,
        })
        return
      }
      if (result.failedLabels.length)
        toast.warning(`Falharam: ${result.failedLabels.join(', ')}`, {
          description: 'As outras buscas foram salvas normalmente.',
        })
      toast.success(
        prefix +
          (result.newPosts
            ? `${result.newPosts} posts novos`
            : 'Nenhum post novo desde a última pesquisa'),
        { description: `Custo estimado: ${formatUsd(result.costUsd)}` },
      )
      router.refresh()
    } catch {
      toast.error(`${prefix}Não foi possível pesquisar`, {
        description: 'O servidor não respondeu.',
      })
    } finally {
      setRunning((current) => current.filter((value) => value !== scope))
    }
  }

  return (
    <ResearchContext value={{ isRunning, run }}>{children}</ResearchContext>
  )
}
