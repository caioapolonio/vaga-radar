import { readSearchConfig } from '@/lib/searches'

// "Exportar": the search groups as a file to share; ids are left out, the
// importing side makes its own
export async function GET() {
  const { groups } = await readSearchConfig()
  const file = {
    app: 'vaga-radar',
    groups: groups.map(({ name, recentOnly, searches }) => ({
      name,
      recentOnly,
      searches: searches.map(({ label, query, enabled }) => ({
        label,
        query,
        enabled,
      })),
    })),
  }
  return new Response(JSON.stringify(file, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="vaga-radar-buscas.json"',
    },
  })
}
