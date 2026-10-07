import type { NextRequest } from 'next/server'
import { feedPage, firstFeedPage, isView, type Section } from '@/lib/feed'
import { parseFilters } from '@/lib/feed-filters'
import { readSearchConfig } from '@/lib/searches'
import { readStore } from '@/lib/store'

const SECTIONS: Section[] = ['active', 'archived']

// A page of a tab's feed, for infinite scroll and the filter bar; the first
// page of the active list also brings the filter counts
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const view = params.get('tab')
  const section = params.get('section') as Section
  const offset = Number(params.get('offset') ?? 0)
  const [store, config] = await Promise.all([readStore(), readSearchConfig()])

  if (
    !isView(config, view) ||
    !SECTIONS.includes(section) ||
    !Number.isInteger(offset) ||
    offset < 0
  )
    return Response.json({ error: 'Parâmetros inválidos' }, { status: 400 })

  const filters = parseFilters(params)
  return Response.json(
    section === 'active' && offset === 0
      ? firstFeedPage(store, config, view, filters)
      : feedPage(store, config, view, section, filters, offset),
  )
}
