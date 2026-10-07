import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { revalidatePath } from 'next/cache'
import type { NextRequest } from 'next/server'
import { cvDir, cvPath, listCvs } from '@/lib/outreach'

const MAX_BYTES = 5 * 1024 * 1024

// Opens a résumé PDF so a card's attachment can be checked before sending
export async function GET(request: NextRequest) {
  const file = request.nextUrl.searchParams.get('file') ?? ''
  try {
    return new Response(await readFile(await cvPath(file)), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline',
      },
    })
  } catch {
    return Response.json({ error: 'CV não encontrado' }, { status: 404 })
  }
}

// "Meu CV (front).pdf" -> "meu-cv-front.pdf"
const safeName = (name: string) =>
  `${
    name
      .replace(/\.pdf$/i, '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'curriculo'
  }.pdf`

// A route handler, not a Server Action: those cap uploads at 1 MB
export async function POST(request: NextRequest) {
  const file = (await request.formData()).get('file')
  if (!(file instanceof File))
    return Response.json({ error: 'Envie um arquivo' }, { status: 400 })
  if (file.size > MAX_BYTES)
    return Response.json({ error: 'O PDF passa de 5 MB' }, { status: 400 })

  const bytes = Buffer.from(await file.arrayBuffer())
  // Checks the content, not just the name
  if (bytes.subarray(0, 5).toString() !== '%PDF-')
    return Response.json({ error: 'O arquivo não é um PDF' }, { status: 400 })

  const dir = await cvDir()
  const existing = await listCvs()
  let name = safeName(file.name)
  for (let n = 2; existing.includes(name); n++)
    name = safeName(`${file.name.replace(/\.pdf$/i, '')}-${n}`)

  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, name), bytes)
  revalidatePath('/', 'layout')
  return Response.json({ file: name })
}

export async function DELETE(request: NextRequest) {
  const file = request.nextUrl.searchParams.get('file') ?? ''
  try {
    // cvPath refuses anything that isn't a listed résumé
    await unlink(await cvPath(file))
  } catch {
    return Response.json({ error: 'CV não encontrado' }, { status: 404 })
  }
  revalidatePath('/', 'layout')
  return Response.json({ ok: true })
}
