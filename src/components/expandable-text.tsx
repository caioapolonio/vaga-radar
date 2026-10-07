'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

export function ExpandableText({
  children,
  collapsible,
  className,
}: {
  children: React.ReactNode
  collapsible: boolean
  className?: string
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={className}>
      <div
        className={cn(
          'wrap-break-word whitespace-pre-line',
          collapsible && !expanded && 'line-clamp-6',
        )}
      >
        {children}
      </div>
      {collapsible && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {expanded ? 'Ver menos' : 'Ver mais'}
        </button>
      )}
    </div>
  )
}
