import Link from 'next/link'
import { connection } from 'next/server'
import { AnalysisPanel } from '@/components/analysis-panel'
import { EmailList } from '@/components/email-list'
import { analysisOverview } from '@/lib/analysis/overview'
import {
  cvDir,
  cvLabel,
  listCvs,
  readOutreach,
  untriagedPosts,
  type Draft,
} from '@/lib/outreach'
import { guessCvInfo, localPlaces, readProfile } from '@/lib/profile'
import { readSettings, triageCutoff } from '@/lib/settings'
import { triageWindowLabel } from '@/lib/settings-fields'
import { readStore } from '@/lib/store'

export default async function EmailsPage() {
  // Always read the latest JSON files instead of a build-time snapshot
  await connection()
  const [store, outreach, cvFiles, settings, profile, dir] = await Promise.all([
    readStore(),
    readOutreach(),
    listCvs().catch(() => []),
    readSettings(),
    readProfile(),
    cvDir(),
  ])

  const posts = new Map(store.posts.map((post) => [post.id, post]))
  const cvs = cvFiles.map((file) => ({
    file,
    label: cvLabel(file, profile),
    language: (profile.cvs[file] ?? guessCvInfo(file)).language,
  }))
  const withStatus = (status: Draft['status']) =>
    outreach.drafts.filter((draft) => draft.status === status)

  const pending = withStatus('pending').sort((a, b) =>
    (posts.get(b.postId)?.postedAt ?? '').localeCompare(
      posts.get(a.postId)?.postedAt ?? '',
    ),
  )
  const byStatusDate = (a: Draft, b: Draft) =>
    (b.statusAt ?? '').localeCompare(a.statusAt ?? '')
  const sent = withStatus('sent').sort(byStatusDate)
  const discarded = withStatus('discarded').sort(byStatusDate)
  const waiting = untriagedPosts(store, outreach, triageCutoff(settings)).length

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-6 pb-8 sm:pb-12">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Candidaturas por e-mail
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {pending.length} para revisar · {sent.length} enviados
        </p>
      </header>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        A IA lê os posts com e-mail {triageWindowLabel(settings)} (mude em
        Ajustes), de todos os grupos, e escreve um card para cada vaga que
        combina, com o currículo certo anexado. Nada é enviado sem você clicar
        em Enviar.
      </p>
      <AnalysisPanel
        kind="emails"
        initial={await analysisOverview('emails')}
        actionLabel="Escrever e-mails com IA"
        found={['card novo', 'cards novos']}
      />

      {!cvs.length && (
        <p className="mt-4 rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
          Nenhum currículo em PDF em {dir}. Adicione em{' '}
          <Link href="/perfil" className="underline underline-offset-4">
            Perfil
          </Link>
          .
        </p>
      )}

      <EmailList
        // Newest post first while waiting; most recently sent first after
        items={[...pending, ...sent, ...discarded].map((draft) => ({
          draft,
          post: posts.get(draft.postId),
        }))}
        cvs={cvs}
        city={profile.city}
        localPlaces={localPlaces(profile)}
        emptyMessage={`Nenhum card para revisar. ${
          waiting
            ? `Clique em Escrever e-mails com IA para ler os ${waiting} posts novos.`
            : 'Re-pesquise para ter posts novos.'
        }`}
      />
    </main>
  )
}
