'use server'

import { revalidatePath } from 'next/cache'
import { sendMail } from '@/lib/mail'
import {
  cvPath,
  listCvs,
  readOutreach,
  updateOutreach,
  type Draft,
  type DraftFields,
} from '@/lib/outreach'
import { updateStore } from '@/lib/store'

export type SendResult =
  { ok: true; warning?: string } | { ok: false; error: string }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Guards against a double click or a second tab sending the same email twice
const sending = new Set<string>()

const withFields = (postId: string, update: Partial<Draft>) =>
  updateOutreach((outreach) => ({
    ...outreach,
    drafts: outreach.drafts.map((draft) =>
      draft.postId === postId ? { ...draft, ...update } : draft,
    ),
  }))

async function problemWith({ to, subject, body, cv }: DraftFields) {
  if (!EMAIL.test(to.trim())) return 'E-mail do destinatário inválido'
  if (!subject.trim() || !body.trim())
    return 'Assunto e mensagem não podem ficar vazios'
  // The AI marks what only you know (salary, start date) this way
  if (`${subject}\n${body}`.includes('[PREENCHER'))
    return 'Preencha os trechos [PREENCHER: …] antes de enviar'
  if (!(await listCvs()).includes(cv)) return 'Escolha um CV da lista'
  return null
}

export async function sendDraft(
  postId: string,
  fields: DraftFields,
): Promise<SendResult> {
  const problem = await problemWith(fields)
  if (problem) return { ok: false, error: problem }
  if (sending.has(postId))
    return { ok: false, error: 'Esse e-mail já está sendo enviado' }

  sending.add(postId)
  try {
    const { drafts } = await readOutreach()
    const draft = drafts.find((draft) => draft.postId === postId)
    if (!draft) return { ok: false, error: 'Card não encontrado' }
    if (draft.status === 'sent')
      return { ok: false, error: 'Esse e-mail já foi enviado' }

    const to = fields.to.trim()
    const copy = await sendMail({
      to,
      subject: fields.subject.trim(),
      body: fields.body,
      attachment: await cvPath(fields.cv),
    })

    const at = new Date().toISOString()
    await withFields(postId, {
      ...fields,
      to,
      status: 'sent',
      statusAt: at,
    })
    // The post shows as applied in the feed too
    await updateStore((store) => ({
      ...store,
      posts: store.posts.map((post) =>
        post.id === postId
          ? { ...post, status: 'applied', statusAt: at }
          : post,
      ),
    }))
    revalidatePath('/emails')
    revalidatePath('/')
    return copy === 'failed'
      ? {
          ok: true,
          warning:
            'Enviado, mas não deu para salvar a cópia na pasta Enviados. Confira o IMAP em Ajustes.',
        }
      : { ok: true }
  } catch (error) {
    console.error(error)
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }
  } finally {
    sending.delete(postId)
  }
}

// Keeps edits made on a card across reloads
export async function saveDraft(postId: string, fields: DraftFields) {
  await updateOutreach((outreach) => ({
    ...outreach,
    drafts: outreach.drafts.map((draft) =>
      draft.postId === postId && draft.status === 'pending'
        ? { ...draft, ...fields }
        : draft,
    ),
  }))
}

export async function setDraftStatus(
  postId: string,
  status: 'pending' | 'discarded',
) {
  await withFields(postId, {
    status,
    statusAt: status === 'discarded' ? new Date().toISOString() : undefined,
  })
  revalidatePath('/emails')
}
