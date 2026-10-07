'use client'

import { PencilLineIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Presence } from '@/lib/feed-filters'
import { jobRegions, regionLabels, type Region } from '@/lib/job'
import type { Draft, DraftStatus } from '@/lib/outreach'
import { CV_LANGUAGES, type CvLanguage } from '@/lib/profile-fields'
import type { Post } from '@/lib/store'
import { foldText, hasTerms, queryTerms } from '@/lib/text-search'
import { cn } from '@/lib/utils'
import { EmailCard, type CvOption } from './email-card'
import {
  FilterSelect,
  FilterSummary,
  PresenceFilter,
  SearchInput,
} from './filters'

export type EmailItem = {
  draft: Draft
  // Missing only if the post was removed from posts.json
  post?: Post
}

const STATUSES = [
  { value: 'pending', label: 'Para revisar', empty: '' },
  { value: 'sent', label: 'Enviados', empty: 'Nenhum e-mail enviado ainda.' },
  {
    value: 'discarded',
    label: 'Descartados',
    empty: 'Nenhum card descartado.',
  },
] as const

// Enviar refuses these until the gaps are filled in
const needsFilling = ({ subject, body }: Draft) =>
  `${subject}\n${body}`.includes('[PREENCHER')

type Filters = {
  q: string
  status: DraftStatus
  language: 'all' | CvLanguage
  region: 'all' | Region
  missing: Presence
}

const NO_FILTERS: Filters = {
  q: '',
  status: 'pending',
  language: 'all',
  region: 'all',
  missing: 'any',
}

// The status tab isn't a filter to clear: it's which list you're looking at
const isFiltered = (filters: Filters) =>
  (Object.keys(NO_FILTERS) as (keyof Filters)[]).some((key) =>
    key === 'q'
      ? filters.q.trim() !== ''
      : key !== 'status' && filters[key] !== NO_FILTERS[key],
  )

// Every card stays mounted and the filters only hide them, so an edit in
// progress survives typing in the search box
export function EmailList({
  items,
  cvs,
  city,
  localPlaces,
  emptyMessage,
}: {
  // Already in display order for each status
  items: EmailItem[]
  cvs: CvOption[]
  // From /perfil, for the "Onde" filter
  city: string
  localPlaces: string[]
  emptyMessage: string
}) {
  const [filters, setFilters] = useState(NO_FILTERS)
  const set = <K extends keyof Filters>(name: K, value: Filters[K]) =>
    setFilters((current) => ({ ...current, [name]: value }))
  const clear = () =>
    setFilters((current) => ({ ...NO_FILTERS, status: current.status }))

  const indexed = useMemo(
    () =>
      items.map((item) => {
        const { draft, post } = item
        return {
          ...item,
          text: foldText(
            [
              draft.job.title,
              draft.job.company,
              draft.job.location,
              draft.to,
              draft.subject,
              draft.body,
              draft.fit,
              post?.author.name,
              post?.content,
            ].join(' '),
          ),
          // The email is written in the attached résumé's language
          language: cvs.find(({ file }) => file === draft.cv)?.language ?? 'pt',
          regions: jobRegions(draft.job, localPlaces) as string[],
          missing: needsFilling(draft),
        }
      }),
    [items, cvs, localPlaces],
  )
  type Indexed = (typeof indexed)[number]

  const terms = queryTerms(filters.q)
  // Every filter but `skip`, so each option can show how many cards it leaves
  const passes = (item: Indexed, skip?: keyof Filters) =>
    (skip === 'q' || hasTerms(item.text, terms)) &&
    (skip === 'status' || item.draft.status === filters.status) &&
    (skip === 'language' ||
      filters.language === 'all' ||
      item.language === filters.language) &&
    (skip === 'region' ||
      filters.region === 'all' ||
      item.regions.includes(filters.region)) &&
    (skip === 'missing' ||
      filters.missing === 'any' ||
      (filters.missing === 'with') === item.missing)
  const count = (skip: keyof Filters, belongs: (item: Indexed) => boolean) =>
    indexed.filter((item) => passes(item, skip) && belongs(item)).length

  const shown = indexed.filter((item) => passes(item)).length
  const inStatus = indexed.filter(
    ({ draft }) => draft.status === filters.status,
  ).length
  const filtered = isFiltered(filters)
  const status = STATUSES.find(({ value }) => value === filters.status)!

  return (
    <>
      <div className="mt-6 flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            value={filters.status}
            onValueChange={(value) => set('status', value as DraftStatus)}
          >
            <TabsList>
              {STATUSES.map(({ value, label }) => (
                <TabsTrigger key={value} value={value}>
                  {label}{' '}
                  <span className="text-muted-foreground tabular-nums">
                    {count('status', ({ draft }) => draft.status === value)}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <SearchInput
            value={filters.q}
            onChange={(value) => set('q', value)}
            placeholder="Buscar cargo, empresa, e-mail"
            className="sm:w-72"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <FilterSelect
            label="Idioma"
            value={filters.language}
            onChange={(value) => set('language', value as Filters['language'])}
            options={[
              { value: 'all', label: 'Todos os idiomas' },
              ...CV_LANGUAGES.map(({ value, label }) => ({
                value,
                label: `${label} (${count('language', (item) => item.language === value)})`,
              })),
            ]}
          />
          <FilterSelect
            label="Onde"
            value={filters.region}
            onChange={(value) => set('region', value as Filters['region'])}
            options={[
              { value: 'all', label: 'Qualquer lugar' },
              ...(Object.entries(regionLabels(city)) as [Region, string][]).map(
                ([value, label]) => ({
                  value,
                  label: `${label} (${count('region', (item) => item.regions.includes(value))})`,
                }),
              ),
            ]}
          />
          <PresenceFilter
            label="Falta preencher"
            title="Trechos [PREENCHER: …] que só você sabe, como pretensão salarial"
            icon={PencilLineIcon}
            value={filters.missing}
            withCount={count('missing', (item) => item.missing)}
            withoutCount={count('missing', (item) => !item.missing)}
            onChange={(value) => set('missing', value)}
          />
        </div>

        <FilterSummary
          shown={shown}
          total={inStatus}
          noun={['card', 'cards']}
          filtered={filtered}
          onClear={clear}
        />
      </div>

      <section className="mt-4 flex flex-col gap-4">
        {indexed.map((item) => (
          <div
            key={item.draft.postId}
            className={cn(!passes(item) && 'hidden')}
          >
            <EmailCard draft={item.draft} post={item.post} cvs={cvs} />
          </div>
        ))}

        {shown === 0 && (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            {filtered ? (
              <>
                <p>Nenhum card com esses filtros.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={clear}
                >
                  Limpar filtros
                </Button>
              </>
            ) : (
              status.empty || emptyMessage
            )}
          </div>
        )}
      </section>
    </>
  )
}
