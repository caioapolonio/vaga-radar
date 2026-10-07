'use client'

import { SearchIcon, XIcon } from 'lucide-react'
import type { ComponentType } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Presence } from '@/lib/feed-filters'
import { cn } from '@/lib/utils'

// Filter bar pieces, the same kinds as the prospecção site's

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  className?: string
}) {
  return (
    <div className={cn('relative', className)}>
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label="Buscar"
        className="bg-background pl-8"
      />
    </div>
  )
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-8 max-w-full rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

// "E-mail [Tem 320] [Não tem 243]"; pressing the active side clears it
export function PresenceFilter({
  label,
  title,
  icon: Icon,
  value,
  withCount,
  withoutCount,
  onChange,
}: {
  label: string
  title?: string
  icon: ComponentType<{ className?: string }>
  value: Presence
  withCount: number
  withoutCount: number
  onChange: (value: Presence) => void
}) {
  const options = [
    { value: 'with', label: 'Tem', count: withCount },
    { value: 'without', label: 'Não tem', count: withoutCount },
  ] as const

  return (
    <div
      role="group"
      aria-label={label}
      title={title}
      className="inline-flex h-8 items-stretch overflow-hidden rounded-lg border border-input bg-background text-sm"
    >
      <span className="flex items-center gap-1.5 px-2.5 text-muted-foreground">
        <Icon className="size-4" />
        {label}
      </span>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() =>
            onChange(value === option.value ? 'any' : option.value)
          }
          className="border-l border-input px-2.5 tabular-nums transition-colors outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset aria-pressed:bg-sky-50 aria-pressed:font-medium aria-pressed:text-sky-900 dark:aria-pressed:bg-sky-950/50 dark:aria-pressed:text-sky-200"
        >
          {option.label} {option.count}
        </button>
      ))}
    </div>
  )
}

// "12 de 310 posts · Limpar filtros"
export function FilterSummary({
  shown,
  total,
  noun,
  filtered,
  onClear,
}: {
  shown: number
  total: number
  noun: [singular: string, plural: string]
  filtered: boolean
  onClear: () => void
}) {
  const word = (filtered ? total : shown) === 1 ? noun[0] : noun[1]
  return (
    <div className="flex min-h-8 items-center gap-2 text-xs text-muted-foreground">
      <span className="tabular-nums">
        {filtered ? `${shown} de ${total} ${word}` : `${shown} ${word}`}
      </span>
      {filtered && (
        <Button variant="ghost" size="xs" onClick={onClear}>
          <XIcon data-icon="inline-start" />
          Limpar filtros
        </Button>
      )}
    </div>
  )
}
