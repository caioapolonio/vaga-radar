'use server'

import { stat } from 'node:fs/promises'
import path from 'node:path'
import { revalidatePath } from 'next/cache'
import { explainAiError, generatePlain, readAiConfig } from '@/lib/ai'
import { ABOUT_INSTRUCTIONS } from '@/lib/analysis/prompts'
import { updateAppConfig } from '@/lib/config'
import { cvTexts } from '@/lib/cv-text'
import { listCvs } from '@/lib/outreach'
import { parseProfile, writeProfile, type Profile } from '@/lib/profile'

export type ActionResult = { ok: true } | { ok: false; error: string }

export async function saveProfile(input: Profile): Promise<ActionResult> {
  const profile = parseProfile(input)
  if (typeof profile === 'string') return { ok: false, error: profile }
  await writeProfile(profile)
  // The sender name, the "Onde" filter and the CV names come from here
  revalidatePath('/', 'layout')
  return { ok: true }
}

// Empty goes back to data/cvs
export async function saveCvDir(dir: string): Promise<ActionResult> {
  const trimmed = dir.trim()
  if (trimmed) {
    if (!path.isAbsolute(trimmed))
      return { ok: false, error: 'Use o caminho completo da pasta' }
    const info = await stat(trimmed).catch(() => null)
    if (!info?.isDirectory())
      return { ok: false, error: 'Essa pasta não existe' }
  }
  await updateAppConfig((config) => ({
    ...config,
    cvDir: trimmed || undefined,
  }))
  revalidatePath('/', 'layout')
  return { ok: true }
}

// A first "Sobre você" written from the résumés; the user reviews and saves it
export async function draftAboutFromCvs(): Promise<
  { ok: true; text: string } | { ok: false; error: string }
> {
  try {
    const files = await listCvs()
    if (!files.length)
      return { ok: false, error: 'Adicione um currículo antes' }
    const text = await generatePlain({
      ai: await readAiConfig(),
      role: 'write',
      instructions: ABOUT_INSTRUCTIONS,
      prompt: await cvTexts(files),
    })
    return { ok: true, text: text.trim() }
  } catch (error) {
    return { ok: false, error: explainAiError(error) }
  }
}
