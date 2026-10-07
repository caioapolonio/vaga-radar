import { connection } from 'next/server'
import { AnalysisPanel } from '@/components/analysis-panel'
import { FeedProvider } from '@/components/feed-provider'
import { MatchList } from '@/components/match-list'
import { analysisOverview } from '@/lib/analysis/overview'
import { buildLinkIndex } from '@/lib/links'
import { readMatches, untriagedForMatch } from '@/lib/matches'
import { readOutreach } from '@/lib/outreach'
import { localPlaces, readProfile } from '@/lib/profile'
import { readSearchConfig, searchLabels } from '@/lib/searches'
import { readSettings, triageCutoff } from '@/lib/settings'
import { triageWindowLabel } from '@/lib/settings-fields'
import { readStore, type Post } from '@/lib/store'

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

const UNKNOWN_COMPANY =
  /n[aã]o (informad|identificad|nomead|divulgad)|confidencial/i

export default async function ForYouPage() {
  // Always read the latest JSON files instead of a build-time snapshot
  await connection()
  const [store, matches, outreach, settings, profile, config] =
    await Promise.all([
      readStore(),
      readMatches(),
      readOutreach(),
      readSettings(),
      readProfile(),
      readSearchConfig(),
    ])

  const posts = new Map(store.posts.map((post) => [post.id, post]))
  const emailCards = new Set(outreach.drafts.map(({ postId }) => postId))
  const matched = Object.entries(matches.triaged)
    .flatMap(([postId, verdict]) => {
      const post = verdict.match && posts.get(postId)
      return post ? [{ post, verdict }] : []
    })
    .sort((a, b) => b.post.postedAt.localeCompare(a.post.postedAt))

  // The same job is often shared by several recruiters and lists: one card per
  // job (newest post), when the AI could tell the company apart
  const jobs = new Map<string, (typeof matched)[number] & { others: Post[] }>()
  for (const match of matched) {
    const { title, company } = match.verdict.job ?? { title: '' }
    const key =
      company && !UNKNOWN_COMPANY.test(company)
        ? `${normalize(title)}|${normalize(company)}`
        : match.post.id
    const job = jobs.get(key)
    if (job) job.others.push(match.post)
    else jobs.set(key, { ...match, others: [] })
  }
  const grouped = [...jobs.values()]
  // Applying through any of the posts counts for the job
  const isApplied = ({ post, others }: (typeof grouped)[number]) =>
    [post, ...others].some(({ status }) => status === 'applied')

  const open = grouped.filter((job) => !isApplied(job))
  const strong = open.filter(({ verdict }) => verdict.strength === 3).length
  const analyzed = Object.keys(matches.triaged).length
  const waiting = untriagedForMatch(
    store,
    matches,
    triageCutoff(settings),
  ).length

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-6 pb-8 sm:pb-12">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Vagas para você
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {open.length} para aplicar ({strong} fortes) · {analyzed} analisadas
        </p>
      </header>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        A IA lê os posts {triageWindowLabel(settings)} (mude em Ajustes), de
        todos os grupos, e deixa aqui só as vagas que combinam com o seu perfil.
        Rode depois de cada pesquisa.
      </p>
      <AnalysisPanel
        kind="matches"
        initial={await analysisOverview('matches')}
        actionLabel="Analisar com IA"
        found={['vaga combina', 'vagas combinam']}
      />

      {/* Keyed by the last search so local marks start fresh after one */}
      <FeedProvider
        key={store.lastSearchedAt ?? 'never'}
        linkIndex={buildLinkIndex(store.posts, store.openedLinks)}
        searchLabels={searchLabels(config)}
      >
        <MatchList
          jobs={grouped.map(({ post, verdict, others }) => ({
            post,
            verdict,
            others: others.length,
            hasEmailCard: emailCards.has(post.id),
            applied: isApplied({ post, verdict, others }),
          }))}
          city={profile.city}
          localPlaces={localPlaces(profile)}
          emptyMessage={`Nenhuma vaga filtrada ainda. ${
            waiting
              ? `Clique em Analisar com IA para ler os ${waiting} posts.`
              : 'Pesquise vagas para ter posts novos.'
          }`}
        />
      </FeedProvider>
    </main>
  )
}
