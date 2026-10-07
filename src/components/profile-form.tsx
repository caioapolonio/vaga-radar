'use client'

import {
  ExternalLinkIcon,
  FileUpIcon,
  SaveIcon,
  SparklesIcon,
  Trash2Icon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { draftAboutFromCvs, saveCvDir, saveProfile } from '@/app/perfil/actions'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  CV_LANGUAGES,
  guessCvInfo,
  TARGET_LEVELS,
  WORK_MODES,
  type CvInfo,
  type CvLanguage,
  type Profile,
} from '@/lib/profile-fields'
import { useAction } from './use-action'

const LABEL = 'flex flex-col gap-1.5 text-sm font-medium'
const HINT = 'text-xs font-normal text-muted-foreground'
const CARD = 'rounded-xl border bg-card p-4 shadow-xs'

export function ProfileForm({
  initial,
  cvFiles,
  cvDir,
  defaultCvDir,
}: {
  initial: Profile
  // PDFs found in the CV folder
  cvFiles: string[]
  cvDir: string
  defaultCvDir: string
}) {
  const [profile, setProfile] = useState(initial)
  const [pending, run] = useAction()
  const set = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    setProfile((current) => ({ ...current, [key]: value }))

  const toggle = <K extends 'levels' | 'workModes'>(
    key: K,
    value: Profile[K][number],
  ) =>
    setProfile((current) => {
      const list = current[key] as string[]
      return {
        ...current,
        [key]: list.includes(value)
          ? list.filter((item) => item !== value)
          : [...list, value],
      }
    })

  // Files new to the folder get guesses until they're named
  const cvOf = (file: string): CvInfo => profile.cvs[file] ?? guessCvInfo(file)
  const setCv = (file: string, change: Partial<CvInfo>) =>
    set('cvs', { ...profile.cvs, [file]: { ...cvOf(file), ...change } })

  const [drafting, startDrafting] = useTransition()
  const draftAbout = () =>
    startDrafting(async () => {
      const previous = profile.about
      const result = await draftAboutFromCvs().catch(() => null)
      if (!result) toast.error('O servidor não respondeu')
      else if (!result.ok) toast.error(result.error)
      else {
        set('about', result.text)
        toast.success('Resumo escrito. Revise e salve o perfil.', {
          action: { label: 'Desfazer', onClick: () => set('about', previous) },
        })
      }
    })

  const save = () =>
    run(
      () =>
        saveProfile({
          ...profile,
          // Saves the guesses too, and drops files no longer in the folder
          cvs: Object.fromEntries(cvFiles.map((file) => [file, cvOf(file)])),
        }),
      { success: 'Perfil salvo' },
    )

  return (
    <div className="mt-6 flex flex-col gap-4">
      <section className={CARD}>
        <h2 className="text-sm font-semibold">Quem é você</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className={LABEL}>
            Nome
            <Input
              value={profile.name}
              onChange={(event) => set('name', event.target.value)}
              placeholder="Seu nome completo"
              className="bg-background"
            />
            <span className={HINT}>Vai como remetente dos e-mails.</span>
          </label>
          <label className={LABEL}>
            Cidade
            <Input
              value={profile.city}
              onChange={(event) => set('city', event.target.value)}
              placeholder="Ex.: Rio de Janeiro"
              className="bg-background"
            />
            <span className={HINT}>
              Para vagas presenciais e o filtro “Onde”.
            </span>
          </label>
          <label className={`${LABEL} sm:col-span-2`}>
            Cidades da região
            <Input
              value={profile.nearbyCities}
              onChange={(event) => set('nearbyCities', event.target.value)}
              placeholder="Separadas por vírgula, ex.: Niterói, São Gonçalo"
              className="bg-background"
            />
          </label>
          <label className={`${LABEL} sm:col-span-2`}>
            Assinatura dos e-mails
            <Textarea
              value={profile.signature}
              onChange={(event) => set('signature', event.target.value)}
              placeholder={
                'Seu Nome\n+55 (11) 99999-9999\nlinkedin.com/in/voce · github.com/voce'
              }
              rows={3}
              className="bg-background"
            />
            <span className={HINT}>Fecha todo e-mail, exatamente assim.</span>
          </label>
        </div>
      </section>

      <section className={CARD}>
        <h2 className="text-sm font-semibold">Que vagas você quer</h2>
        <fieldset className="mt-3">
          <legend className="text-sm font-medium">Níveis</legend>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
            {TARGET_LEVELS.map(({ value, label }) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={profile.levels.includes(value)}
                  onChange={() => toggle('levels', value)}
                  className="size-4 accent-primary"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="mt-4">
          <legend className="text-sm font-medium">Modalidades</legend>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
            {WORK_MODES.map(({ value, label }) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={profile.workModes.includes(value)}
                  onChange={() => toggle('workModes', value)}
                  className="size-4 accent-primary"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className={`${LABEL} mt-4`}>
          Pretensão salarial
          <Textarea
            value={profile.salary}
            onChange={(event) => set('salary', event.target.value)}
            placeholder={
              'Ex.: Júnior entre R$ 3.000 e R$ 4.500 · Pleno a partir de R$ 5.000 · Em dólar, a partir de US$ 2.000 por mês'
            }
            rows={3}
            className="bg-background"
          />
          <span className={HINT}>
            Usada só quando a vaga pedir, por moeda e nível.
          </span>
        </label>
      </section>

      <section className={CARD}>
        <h2 className="text-sm font-semibold">Para a IA</h2>
        <p className={HINT}>
          A IA lê isto junto com seus currículos para decidir quais vagas
          combinam e escrever os e-mails.
        </p>
        <div className={`${LABEL} mt-3`}>
          <span className="flex flex-wrap items-center justify-between gap-2">
            Sobre você
            <Button
              type="button"
              variant="outline"
              size="xs"
              disabled={drafting || !cvFiles.length}
              title={
                cvFiles.length
                  ? 'A IA lê seus currículos e escreve um resumo para você revisar'
                  : 'Adicione um currículo antes'
              }
              onClick={draftAbout}
            >
              <SparklesIcon data-icon="inline-start" />
              {drafting ? 'Lendo os currículos…' : 'Escrever com IA'}
            </Button>
          </span>
          <Textarea
            value={profile.about}
            aria-label="Sobre você"
            onChange={(event) => set('about', event.target.value)}
            placeholder={
              'Experiência, tecnologias fortes e fracas, o que não quer fazer, idiomas…'
            }
            rows={6}
            className="max-h-80 bg-background"
          />
        </div>
        <label className={`${LABEL} mt-4`}>
          Regras para os e-mails
          <Textarea
            value={profile.rules}
            onChange={(event) => set('rules', event.target.value)}
            placeholder={
              'Ex.: nunca usar ponto e vírgula · disponibilidade imediata · não citar o projeto X'
            }
            rows={3}
            className="bg-background"
          />
        </label>
      </section>

      <CvSection
        cvFiles={cvFiles}
        cvOf={cvOf}
        setCv={setCv}
        cvDir={cvDir}
        defaultCvDir={defaultCvDir}
      />

      <div className="flex justify-end">
        <Button onClick={save} disabled={pending}>
          <SaveIcon data-icon="inline-start" />
          {pending ? 'Salvando…' : 'Salvar perfil'}
        </Button>
      </div>
    </div>
  )
}

function CvSection({
  cvFiles,
  cvOf,
  setCv,
  cvDir,
  defaultCvDir,
}: {
  cvFiles: string[]
  cvOf: (file: string) => CvInfo
  setCv: (file: string, change: Partial<CvInfo>) => void
  cvDir: string
  defaultCvDir: string
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [dir, setDir] = useState(cvDir === defaultCvDir ? '' : cvDir)
  const [pending, run] = useAction()

  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    try {
      for (const file of files) {
        const body = new FormData()
        body.set('file', file)
        const response = await fetch('/api/cv', { method: 'POST', body })
        const result = await response.json()
        if (!response.ok) toast.error(`${file.name}: ${result.error}`)
        else toast.success(`${file.name} adicionado`)
      }
      router.refresh()
    } catch {
      toast.error('Não foi possível enviar o PDF')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const remove = async (file: string) => {
    const response = await fetch(`/api/cv?file=${encodeURIComponent(file)}`, {
      method: 'DELETE',
    }).catch(() => null)
    if (response?.ok) {
      toast.success('Currículo removido')
      router.refresh()
    } else toast.error('Não foi possível remover')
    setConfirming(null)
  }

  return (
    <section className={CARD}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Currículos</h2>
          <p className={HINT}>
            Um PDF por versão (front-end, back-end, inglês…). A IA escolhe qual
            anexar em cada e-mail pelo “Quando usar”.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <FileUpIcon data-icon="inline-start" />
          {uploading ? 'Enviando…' : 'Adicionar PDF'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          onChange={(event) => void upload(event.target.files)}
        />
      </div>

      {cvFiles.length ? (
        <ul className="mt-4 flex flex-col divide-y border-y">
          {cvFiles.map((file) => {
            const cv = cvOf(file)
            return (
              <li
                key={file}
                className="grid gap-2 py-3 sm:grid-cols-[1fr_8rem_1.4fr_auto] sm:items-center"
              >
                <Input
                  value={cv.label}
                  onChange={(event) =>
                    setCv(file, { label: event.target.value })
                  }
                  aria-label={`Nome de ${file}`}
                  title={file}
                  className="bg-background"
                />
                <select
                  value={cv.language}
                  onChange={(event) =>
                    setCv(file, { language: event.target.value as CvLanguage })
                  }
                  aria-label={`Idioma de ${file}`}
                  className="h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {CV_LANGUAGES.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <Input
                  value={cv.useFor}
                  onChange={(event) =>
                    setCv(file, { useFor: event.target.value })
                  }
                  placeholder="Quando usar, ex.: vagas front-end React"
                  aria-label={`Quando usar ${file}`}
                  className="bg-background"
                />
                <div className="flex items-center gap-1">
                  <a
                    href={`/api/cv?file=${encodeURIComponent(file)}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Abrir ${file}`}
                    className={buttonVariants({
                      variant: 'ghost',
                      size: 'icon-sm',
                    })}
                  >
                    <ExternalLinkIcon />
                  </a>
                  {confirming === file ? (
                    <Button
                      variant="destructive"
                      size="xs"
                      onClick={() => void remove(file)}
                    >
                      Remover
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remover ${file}`}
                      onClick={() => setConfirming(file)}
                    >
                      <Trash2Icon />
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nenhum PDF ainda. Adicione pelo menos um currículo.
        </p>
      )}
      <p className={`${HINT} mt-3`}>
        Os nomes e o “Quando usar” são salvos com o botão Salvar perfil.
      </p>

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-xs text-muted-foreground select-none hover:text-foreground">
          Pasta dos currículos
        </summary>
        <form
          className="mt-2 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault()
            run(() => saveCvDir(dir), { success: 'Pasta salva' })
          }}
        >
          <Input
            value={dir}
            onChange={(event) => setDir(event.target.value)}
            placeholder={defaultCvDir}
            aria-label="Pasta dos currículos"
            className="bg-background font-mono text-xs"
          />
          <Button type="submit" variant="outline" size="sm" disabled={pending}>
            Usar esta pasta
          </Button>
        </form>
        <p className={`${HINT} mt-1`}>
          Os PDFs ficam em {cvDir}. Troque se você gera seus currículos em outra
          pasta. Vazio volta para o padrão.
        </p>
      </details>
    </section>
  )
}
