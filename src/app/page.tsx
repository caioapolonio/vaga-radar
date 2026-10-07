import { PencilIcon } from 'lucide-react'
import Link from 'next/link'
import { connection } from 'next/server'
import { FeedProvider } from '@/components/feed-provider'
import { ResearchButton } from '@/components/research-button'
import { ResearchProvider } from '@/components/research-provider'
import { SetupChecklist } from '@/components/setup-checklist'
import { TabFeed } from '@/components/tab-feed'
import { buttonVariants } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { firstFeedPage, selectPosts, tabSearchedAt } from '@/lib/feed'
import { formatDateTime, formatRelative, formatUsd } from '@/lib/format'
import { buildLinkIndex } from '@/lib/links'
import {
  EMAIL_VIEW,
  readSearchConfig,
  runnableSearches,
  searchLabels,
  type SearchGroup,
} from '@/lib/searches'
import { setupSteps } from '@/lib/setup'
import { readStore } from '@/lib/store'

export default async function Home() {
  // Always read the latest files instead of a build-time snapshot
  await connection()
  const [store, config, steps] = await Promise.all([
    readStore(),
    readSearchConfig(),
    setupSteps(),
  ])
  const { lastSearchedAt, lastRun } = store
  const lastRunGroup = config.groups.find(({ id }) => id === lastRun?.tab)

  // The user's groups, then the fixed "Com e-mail" tab
  const views: { value: string; label: string; group?: SearchGroup }[] = [
    ...config.groups.map((group) => ({
      value: group.id,
      label: group.name,
      group,
    })),
    { value: EMAIL_VIEW, label: 'Com e-mail' },
  ]
  const feeds = views.map((view) => ({
    ...view,
    searchedAt: tabSearchedAt(store, config, view.value),
    firstPage: firstFeedPage(store, config, view.value),
    newCount: selectPosts(store, config, view.value, 'active').filter(
      (post) => !post.status,
    ).length,
  }))

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-6 pb-8 sm:pb-12">
      <ResearchProvider>
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Vaga Radar
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {lastSearchedAt ? (
                <>
                  Última pesquisa {formatRelative(lastSearchedAt)} (
                  {formatDateTime(lastSearchedAt)})
                  {lastRunGroup && ` · só ${lastRunGroup.name}`}
                  {lastRun &&
                    ` · ${lastRun.newPosts} novos · ~${formatUsd(lastRun.costUsd)}`}
                </>
              ) : (
                'Nenhuma pesquisa ainda'
              )}
            </p>
          </div>
          <ResearchButton
            size="lg"
            label="Re-pesquisar tudo"
            disabled={!runnableSearches(config).length}
          />
        </header>
        <p className="mt-3 text-xs text-muted-foreground">
          Posts que você abrir ou marcar saem da aba na próxima pesquisa dela.
        </p>

        <SetupChecklist steps={steps} />

        {/* Outside the keyed feed so the selected tab survives a search */}
        <Tabs defaultValue={feeds[0].value} className="mt-6">
          <TabsList className="max-w-full justify-start overflow-x-auto">
            {feeds.map(({ value, label, newCount }) => (
              <TabsTrigger key={value} value={value} className="flex-none px-3">
                {label}
                <span className="text-muted-foreground tabular-nums">
                  {newCount}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Keyed by the last search so lists and local marks start fresh after one */}
          <FeedProvider
            key={lastSearchedAt ?? 'never'}
            linkIndex={buildLinkIndex(store.posts, store.openedLinks)}
            searchLabels={searchLabels(config)}
          >
            {feeds.map(({ value, label, group, searchedAt, firstPage }) => (
              // keepMounted preserves each tab's scroll progress when switching
              <TabsContent
                key={value}
                value={value}
                keepMounted
                className="mt-4"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-muted-foreground">
                    {!group && (
                      <p className="mb-0.5 text-foreground">
                        Posts de todos os grupos com um endereço de e-mail no
                        texto, achado por código, sem IA.
                      </p>
                    )}
                    <p>
                      {searchedAt
                        ? `${group ? 'Grupo pesquisado' : 'Última pesquisa'} ${formatRelative(searchedAt)} (${formatDateTime(searchedAt)})`
                        : 'Ainda não pesquisado'}
                    </p>
                  </div>
                  {group && (
                    <ResearchButton
                      group={{ id: group.id, name: group.name }}
                      label={`Re-pesquisar ${label}`}
                      size="sm"
                      variant="outline"
                      disabled={!runnableSearches(config, group.id).length}
                    />
                  )}
                </div>

                {group && (
                  <details className="mb-6 text-xs text-muted-foreground">
                    <summary className="cursor-pointer select-none hover:text-foreground">
                      Buscas deste grupo ({group.searches.length})
                    </summary>
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {group.searches.map(({ id, label, query, enabled }) => (
                        <li key={id} className={enabled ? '' : 'opacity-60'}>
                          <span className="font-medium text-foreground">
                            {label}
                            {!enabled && ' (desligada)'}:
                          </span>{' '}
                          <code className="font-mono">{query}</code>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/buscas"
                      className={buttonVariants({
                        variant: 'ghost',
                        size: 'xs',
                        className: 'mt-2',
                      })}
                    >
                      <PencilIcon data-icon="inline-start" />
                      Editar buscas
                    </Link>
                  </details>
                )}

                <TabFeed
                  tab={value}
                  searches={(group
                    ? group.searches
                    : config.groups.flatMap(({ searches }) => searches)
                  ).map(({ id, label }) => ({ id, label }))}
                  initial={firstPage}
                  emptyMessage={
                    !config.groups.length
                      ? 'Crie seu primeiro grupo de busca em Buscas para começar.'
                      : searchedAt
                        ? 'Nada novo por aqui. Clique em Re-pesquisar para buscar mais.'
                        : 'Nenhum post ainda. Clique em Re-pesquisar para buscar.'
                  }
                />
              </TabsContent>
            ))}
          </FeedProvider>
        </Tabs>
      </ResearchProvider>
    </main>
  )
}
