import type { NextRequest } from 'next/server'
import { research } from '@/lib/research'
import { readSearchConfig } from '@/lib/searches'

// A route handler instead of a Server Action: Next.js runs Server Actions one
// at a time per page, so a minutes-long search would block marking posts
export async function POST(request: NextRequest) {
  // Without ?group=, every enabled search runs
  const group = request.nextUrl.searchParams.get('group')
  const { groups } = await readSearchConfig()
  if (group !== null && !groups.some(({ id }) => id === group))
    return Response.json(
      { ok: false, error: 'Grupo de busca não encontrado' },
      { status: 400 },
    )

  return Response.json(await research(group ?? undefined))
}
