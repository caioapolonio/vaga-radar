import { connection } from 'next/server'
import { SearchGroupsEditor } from '@/components/search-groups-editor'
import { formatUsd } from '@/lib/format'
import { PRICE_PER_POST_USD } from '@/lib/linkedin'
import { readSearchConfig } from '@/lib/searches'
import { readSettings } from '@/lib/settings'
import { readStore } from '@/lib/store'

export default async function SearchesPage() {
  // Always read the saved files instead of a build-time snapshot
  await connection()
  const [config, store, settings] = await Promise.all([
    readSearchConfig(),
    readStore(),
    readSettings(),
  ])

  const postCounts: Record<string, number> = {}
  for (const post of store.posts)
    for (const id of post.searchIds) postCounts[id] = (postCounts[id] ?? 0) + 1

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-6 pb-8 sm:pb-12">
      <h1 className="text-2xl font-semibold tracking-tight">Buscas</h1>
      <div className="mt-1 flex flex-col gap-2 text-sm text-muted-foreground">
        <p>
          Cada grupo vira uma aba na página Vagas e pode ser re-pesquisado
          sozinho. As buscas usam a pesquisa de posts do LinkedIn, pela sua
          conta da Apify.
        </p>
        <p className="text-xs">
          Na primeira pesquisa, cada busca traz até {settings.maxPostsPerSearch}{' '}
          posts (~{formatUsd(settings.maxPostsPerSearch * PRICE_PER_POST_USD)}
          ). Depois, só o que saiu desde a anterior. A aba “Com e-mail” é fixa e
          junta os posts de todos os grupos que têm um e-mail no texto.
        </p>
      </div>
      <SearchGroupsEditor groups={config.groups} postCounts={postCounts} />
    </main>
  )
}
