'use client'

import { LinkIcon, MailIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Presence } from '@/lib/feed-filters'
import {
  jobLevels,
  jobRegions,
  jobWorkModels,
  LEVELS,
  regionLabels,
  WORK_MODELS,
  type Region,
} from '@/lib/job'
import type { MatchVerdict } from '@/lib/matches'
import type { Post } from '@/lib/store'
import { foldText, hasTerms, queryTerms } from '@/lib/text-search'
import {
  FilterSelect,
  FilterSummary,
  PresenceFilter,
  SearchInput,
} from './filters'
import { MatchSummary } from './match-summary'
import { PostCard } from './post-card'

// One job, folded from every post about it
export type MatchJob = {
  post: Post
  verdict: MatchVerdict
  // Other posts about the same job
  others: number
  hasEmailCard: boolean
  applied: boolean
}

// Ordered best first; the AI rates each match
const SECTIONS = [
  {
    strength: 3,
    title: 'Combinam forte',
    tab: 'Fortes',
    hint: 'Nível e stack confirmados pelo post.',
  },
  {
    strength: 2,
    title: 'Boas, com uma ressalva',
    tab: 'Boas',
    hint: 'Falta um dado no post ou algum requisito fica no limite.',
  },
  {
    strength: 1,
    title: 'Na dúvida',
    tab: 'Na dúvida',
    hint: 'O post não diz a stack ou o nível: confira no link antes.',
  },
] as const

type Filters = {
  q: string
  status: 'open' | 'applied'
  strength: 'all' | '3' | '2' | '1'
  level: 'all' | keyof typeof LEVELS
  workModel: 'all' | keyof typeof WORK_MODELS
  region: 'all' | Region
  applyLink: Presence
  emailCard: Presence
}

const NO_FILTERS: Filters = {
  q: '',
  status: 'open',
  strength: 'all',
  level: 'all',
  workModel: 'all',
  region: 'all',
  applyLink: 'any',
  emailCard: 'any',
}

const presenceMatches = (presence: Presence, has: boolean) =>
  presence === 'any' || (presence === 'with') === has

// The status tab isn't a filter to clear: it's which list you're looking at
const isFiltered = (filters: Filters) =>
  (Object.keys(NO_FILTERS) as (keyof Filters)[]).some((key) =>
    key === 'q'
      ? filters.q.trim() !== ''
      : key !== 'status' && filters[key] !== NO_FILTERS[key],
  )

export function MatchList({
  jobs,
  city,
  localPlaces,
  emptyMessage,
}: {
  jobs: MatchJob[]
  // From /perfil, for the "Onde" filter
  city: string
  localPlaces: string[]
  emptyMessage: string
}) {
  const [filters, setFilters] = useState(NO_FILTERS)
  const set = <K extends keyof Filters>(name: K, value: Filters[K]) =>
    setFilters((current) => ({ ...current, [name]: value }))

  // Everything the filters look at, worked out once
  const indexed = useMemo(
    () =>
      jobs.map((job) => {
        const summary = job.verdict.job ?? { title: '' }
        return {
          ...job,
          text: foldText(
            [
              summary.title,
              summary.company,
              summary.seniority,
              summary.workModel,
              summary.location,
              job.verdict.fit,
              job.verdict.reason,
              job.post.author.name,
              job.post.content,
            ].join(' '),
          ),
          // A match saved before ratings existed counts as "na dúvida"
          strength: String(job.verdict.strength ?? 1),
          levels: jobLevels(summary) as string[],
          workModels: jobWorkModels(summary) as string[],
          regions: jobRegions(summary, localPlaces) as string[],
        }
      }),
    [jobs, localPlaces],
  )
  type Indexed = (typeof indexed)[number]

  const terms = queryTerms(filters.q)
  // Every filter but `skip`, so each option can show how many jobs it leaves
  const passes = (job: Indexed, skip?: keyof Filters) =>
    (skip === 'q' || hasTerms(job.text, terms)) &&
    (skip === 'status' || job.applied === (filters.status === 'applied')) &&
    (skip === 'strength' ||
      filters.strength === 'all' ||
      job.strength === filters.strength) &&
    (skip === 'level' ||
      filters.level === 'all' ||
      job.levels.includes(filters.level)) &&
    (skip === 'workModel' ||
      filters.workModel === 'all' ||
      job.workModels.includes(filters.workModel)) &&
    (skip === 'region' ||
      filters.region === 'all' ||
      job.regions.includes(filters.region)) &&
    (skip === 'applyLink' ||
      presenceMatches(filters.applyLink, !!job.verdict.applyUrl)) &&
    (skip === 'emailCard' ||
      presenceMatches(filters.emailCard, job.hasEmailCard))
  const count = (skip: keyof Filters, belongs: (job: Indexed) => boolean) =>
    indexed.filter((job) => passes(job, skip) && belongs(job)).length

  const visible = indexed.filter((job) => passes(job))
  const inStatus = indexed.filter(
    (job) => job.applied === (filters.status === 'applied'),
  ).length
  const filtered = isFiltered(filters)

  const options = <K extends string>(
    name: 'level' | 'workModel' | 'region',
    labels: Partial<Record<K, string>>,
    all: string,
    of: (job: Indexed) => string[],
  ) => [
    { value: 'all', label: all },
    ...(Object.entries(labels) as [K, string][]).map(([value, label]) => ({
      value,
      label: `${label} (${count(name, (job) => of(job).includes(value))})`,
    })),
  ]

  const cards = (list: Indexed[]) =>
    list.map(({ post, verdict, others, hasEmailCard }) => (
      <PostCard
        key={post.id}
        post={post}
        summary={
          <MatchSummary
            post={post}
            verdict={verdict}
            hasEmailCard={hasEmailCard}
            otherPosts={others}
          />
        }
      />
    ))

  const sections = SECTIONS.flatMap((section) => {
    const list = visible.filter(
      ({ strength }) => strength === String(section.strength),
    )
    return list.length ? [{ ...section, list }] : []
  })

  return (
    <>
      <div className="mt-6 flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            value={filters.status}
            onValueChange={(value) => set('status', value as Filters['status'])}
          >
            <TabsList>
              <TabsTrigger value="open">
                Para aplicar{' '}
                <span className="text-muted-foreground tabular-nums">
                  {count('status', (job) => !job.applied)}
                </span>
              </TabsTrigger>
              <TabsTrigger value="applied">
                Já aplicadas{' '}
                <span className="text-muted-foreground tabular-nums">
                  {count('status', (job) => job.applied)}
                </span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <SearchInput
            value={filters.q}
            onChange={(value) => set('q', value)}
            placeholder="Buscar cargo, empresa, stack"
            className="sm:w-72"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Tabs
            value={filters.strength}
            onValueChange={(value) =>
              set('strength', value as Filters['strength'])
            }
          >
            <TabsList aria-label="Quanto combina">
              <TabsTrigger value="all">Todas</TabsTrigger>
              {SECTIONS.map(({ strength, tab }) => (
                <TabsTrigger key={strength} value={String(strength)}>
                  {tab}{' '}
                  <span className="text-muted-foreground tabular-nums">
                    {count(
                      'strength',
                      (job) => job.strength === String(strength),
                    )}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <FilterSelect
            label="Nível"
            value={filters.level}
            onChange={(value) => set('level', value as Filters['level'])}
            options={options(
              'level',
              LEVELS,
              'Todos os níveis',
              (job) => job.levels,
            )}
          />
          <FilterSelect
            label="Modalidade"
            value={filters.workModel}
            onChange={(value) =>
              set('workModel', value as Filters['workModel'])
            }
            options={options(
              'workModel',
              WORK_MODELS,
              'Todas as modalidades',
              (job) => job.workModels,
            )}
          />
          <FilterSelect
            label="Onde"
            value={filters.region}
            onChange={(value) => set('region', value as Filters['region'])}
            options={options(
              'region',
              regionLabels(city),
              'Qualquer lugar',
              (job) => job.regions,
            )}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <PresenceFilter
            label="Link para aplicar"
            title="O post traz o link da vaga (botão Candidatar-se)"
            icon={LinkIcon}
            value={filters.applyLink}
            withCount={count('applyLink', (job) => !!job.verdict.applyUrl)}
            withoutCount={count('applyLink', (job) => !job.verdict.applyUrl)}
            onChange={(value) => set('applyLink', value)}
          />
          <PresenceFilter
            label="Card de e-mail"
            title="A IA já escreveu um e-mail para esta vaga"
            icon={MailIcon}
            value={filters.emailCard}
            withCount={count('emailCard', (job) => job.hasEmailCard)}
            withoutCount={count('emailCard', (job) => !job.hasEmailCard)}
            onChange={(value) => set('emailCard', value)}
          />
        </div>

        <FilterSummary
          shown={visible.length}
          total={inStatus}
          noun={['vaga', 'vagas']}
          filtered={filtered}
          onClear={() =>
            setFilters((current) => ({ ...NO_FILTERS, status: current.status }))
          }
        />
      </div>

      {sections.length ? (
        sections.map(({ strength, title, hint, list }) => (
          <section key={strength} className="mt-8">
            <h2 className="text-sm font-semibold">
              {title}{' '}
              <span className="font-normal text-muted-foreground tabular-nums">
                ({list.length})
              </span>
            </h2>
            <p className="text-xs text-muted-foreground">{hint}</p>
            <div className="mt-4 flex flex-col gap-4">{cards(list)}</div>
          </section>
        ))
      ) : (
        <div className="mt-6 rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          {filtered ? (
            <>
              <p>Nenhuma vaga com esses filtros.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() =>
                  setFilters((current) => ({
                    ...NO_FILTERS,
                    status: current.status,
                  }))
                }
              >
                Limpar filtros
              </Button>
            </>
          ) : filters.status === 'applied' ? (
            'Nenhuma vaga aplicada ainda.'
          ) : (
            emptyMessage
          )}
        </div>
      )}
    </>
  )
}
