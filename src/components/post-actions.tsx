'use client'

import { CheckIcon, EyeIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Post, PostStatus } from '@/lib/store'
import { useFeed } from './feed-provider'

const ACTIONS = [
  { status: 'seen', label: 'Já vi', Icon: EyeIcon },
  { status: 'applied', label: 'Apliquei', Icon: CheckIcon },
] satisfies { status: PostStatus; label: string; Icon: typeof EyeIcon }[]

export function PostActions({ post }: { post: Post }) {
  const { statusOf, setStatus } = useFeed()
  const status = statusOf(post)

  return (
    <div className="flex gap-1">
      {ACTIONS.map(({ status: action, label, Icon }) => {
        const active = status === action
        return (
          <Button
            key={action}
            size="sm"
            variant={active ? 'secondary' : 'ghost'}
            aria-pressed={active}
            onClick={() => setStatus(post, active ? null : action)}
          >
            <Icon data-icon="inline-start" />
            {label}
          </Button>
        )
      })}
    </div>
  )
}
