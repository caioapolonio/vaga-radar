import { connection } from 'next/server'
import { AnalysisPanel } from '@/components/analysis-panel'
import { FeedProvider } from '@/components/feed-provider'
import { MatchList, type MatchJob } from '@/components/match-list'
import { analysisOverview } from '@/lib/analysis/overview'
import { applyButtonUrl, buildLinkIndex } from '@/lib/links'
import { readMatches, untriagedForMatch } from '@/lib/matches'
import { cardForJob, findEmails, readOutreach } from '@/lib/outreach'
import { localPlaces, readProfile } from '@/lib/profile'
import { readSearchConfig, searchLabels } from '@/lib/searches'
import { readSettings, triageCutoff } from '@/lib/settings'
import { triageWindowLabel } from '@/lib/settings-fields'
import { readStore, type Post, type PostStatus } from '@/lib/store'

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

  // The job shares its card with E-mails: sending or discarding it there
  // moves the job here too
  const emailOf = (
    jobPosts: Post[],
  ): Pick<MatchJob, 'emailCard' | 'noEmailCard'> => {
    const card = cardForJob(jobPosts, outreach.drafts)
    if (card) {
      const own = jobPosts.some(({ id }) => id === card.postId)
      return {
        emailCard: {
          postId: card.postId,
          status: card.status,
          to: card.to,
          at: card.statusAt,
          ...(!own && { otherJob: card.job.title }),
        },
        noEmailCard: null,
      }
    }
    const passed = jobPosts.find(
      (post) =>
        outreach.triaged[post.id]?.match === false &&
        findEmails(post.content).length > 0,
    )
    return {
      emailCard: null,
      noEmailCard: passed ? outreach.triaged[passed.id].reason : null,
    }
  }
  const grouped = [...jobs.values()].map((job) => ({
    ...job,
    ...emailOf([job.post, ...job.others]),
  }))
  // Marking any of the posts counts for the job; applied wins over seen
  const postStatusOf = ({
    post,
    others,
  }: (typeof grouped)[number]): PostStatus | undefined => {
    const statuses = [post, ...others].map(({ status }) => status)
    return statuses.includes('applied') ? 'applied' : statuses.find(Boolean)
  }

  const analyzed = Object.keys(matches.triaged).length
  const waiting = untriagedForMatch(
    store,
    matches,
    triageCutoff(settings),
  ).length

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-6 pb-8 sm:pb-12">
      {/* Keyed by the last search so local marks start fresh after one */}
      <FeedProvider
        key={store.lastSearchedAt ?? 'never'}
        linkIndex={buildLinkIndex(store.posts, store.openedLinks)}
        searchLabels={searchLabels(config)}
        jobPosts={Object.fromEntries(
          grouped
            .filter(({ others }) => others.length)
            .map(({ post, others }) => [
              post.id,
              [post.id, ...others.map(({ id }) => id)],
            ]),
        )}
        jobEmailStatuses={Object.fromEntries(
          grouped.flatMap<[string, PostStatus]>(({ post, emailCard }) => {
            if (emailCard?.status === 'sent') return [[post.id, 'applied']]
            if (emailCard?.status === 'discarded') return [[post.id, 'seen']]
            return []
          }),
        )}
      >
        <MatchList
          jobs={grouped.map((job) => ({
            post: { ...job.post, status: postStatusOf(job) },
            // Candidatar-se only for a post with a single link
            verdict: {
              ...job.verdict,
              applyUrl: applyButtonUrl(job.post, job.verdict.applyUrl),
            },
            others: job.others.length,
            emailCard: job.emailCard,
            noEmailCard: job.noEmailCard,
          }))}
          analyzed={analyzed}
          city={profile.city}
          localPlaces={localPlaces(profile)}
          emptyMessage={`Nenhuma vaga filtrada ainda. ${
            waiting
              ? `Clique em Analisar com IA para ler os ${waiting} posts.`
              : 'Pesquise vagas para ter posts novos.'
          }`}
        >
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            A IA lê os posts {triageWindowLabel(settings)} (mude em Ajustes),
            de todos os grupos, e deixa aqui só as vagas que combinam com o seu
            perfil. Rode depois de cada pesquisa. Ao abrir ou marcar uma vaga,
            ela muda de aba na hora.
          </p>
          <AnalysisPanel
            kind="matches"
            initial={await analysisOverview('matches')}
            actionLabel="Analisar com IA"
            found={['vaga combina', 'vagas combinam']}
          />
        </MatchList>
      </FeedProvider>
    </main>
  )
}
