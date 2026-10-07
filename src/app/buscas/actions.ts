'use server'

import { revalidatePath } from 'next/cache'
import {
  EMAIL_VIEW,
  newId,
  queryProblem,
  updateSearchConfig,
  type SearchConfig,
  type SearchGroup,
} from '@/lib/searches'
import { updateStore } from '@/lib/store'

export type ActionResult =
  { ok: true; message?: string } | { ok: false; error: string }

// Runs an edit on the saved groups; a thrown message goes back to the page
async function edit(
  change: (config: SearchConfig) => SearchConfig,
): Promise<ActionResult> {
  try {
    await updateSearchConfig(change)
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }
  }
  // The feed tabs, the nav counts and this page all read the groups
  revalidatePath('/', 'layout')
  return { ok: true }
}

const mapGroup = (
  config: SearchConfig,
  groupId: string,
  change: (group: SearchGroup) => SearchGroup,
) => {
  if (!config.groups.some(({ id }) => id === groupId))
    throw new Error('Grupo não encontrado')
  return {
    ...config,
    groups: config.groups.map((group) =>
      group.id === groupId ? change(group) : group,
    ),
  }
}

const checkName = (name: string) => {
  if (!name.trim()) throw new Error('Dê um nome')
  if (name.trim().length > 40) throw new Error('Use um nome mais curto')
}

export async function createGroup(name: string) {
  return edit((config) => {
    checkName(name)
    let id = newId(name)
    while (id === EMAIL_VIEW || config.groups.some((group) => group.id === id))
      id = newId(name)
    return {
      ...config,
      groups: [
        ...config.groups,
        { id, name: name.trim(), recentOnly: false, searches: [] },
      ],
    }
  })
}

export async function updateGroup(
  groupId: string,
  { name, recentOnly }: { name: string; recentOnly: boolean },
) {
  return edit((config) => {
    checkName(name)
    return mapGroup(config, groupId, (group) => ({
      ...group,
      name: name.trim(),
      recentOnly,
    }))
  })
}

// Posts stay saved: they still show in "Com e-mail" and "Para você"
export async function deleteGroup(groupId: string) {
  return edit((config) => ({
    ...config,
    groups: config.groups.filter(({ id }) => id !== groupId),
  }))
}

export async function moveGroup(groupId: string, offset: -1 | 1) {
  return edit((config) => {
    const groups = [...config.groups]
    const from = groups.findIndex(({ id }) => id === groupId)
    const to = from + offset
    if (from < 0 || to < 0 || to >= groups.length) return config
    ;[groups[from], groups[to]] = [groups[to], groups[from]]
    return { ...config, groups }
  })
}

export async function saveSearch(
  groupId: string,
  input: { id?: string; label: string; query: string; enabled: boolean },
) {
  let changedQueryOf: string | null = null
  const result = await edit((config) => {
    checkName(input.label)
    const problem = queryProblem(input.query)
    if (problem) throw new Error(problem)
    const query = input.query.trim()
    const ids = config.groups.flatMap(({ searches }) =>
      searches.map(({ id }) => id),
    )

    return mapGroup(config, groupId, (group) => {
      const saved = group.searches.find(({ id }) => id === input.id)
      if (!saved) {
        let id = newId(input.label)
        while (ids.includes(id)) id = newId(input.label)
        return {
          ...group,
          searches: [
            ...group.searches,
            { id, label: input.label.trim(), query, enabled: input.enabled },
          ],
        }
      }
      if (saved.query !== query) changedQueryOf = saved.id
      return {
        ...group,
        searches: group.searches.map((search) =>
          search.id === saved.id
            ? {
                ...search,
                label: input.label.trim(),
                query,
                enabled: input.enabled,
              }
            : search,
        ),
      }
    })
  })

  // A new query is a new search: its next run goes back the full lookback
  const searchId: string | null = changedQueryOf
  if (result.ok && searchId)
    await updateStore((store) => {
      const searchedAt = { ...store.searchedAt }
      delete searchedAt[searchId]
      return { ...store, searchedAt }
    })
  return result
}

export async function deleteSearch(groupId: string, searchId: string) {
  return edit((config) =>
    mapGroup(config, groupId, (group) => ({
      ...group,
      searches: group.searches.filter(({ id }) => id !== searchId),
    })),
  )
}

// Adds the groups from a file made by "Exportar" (someone else's searches,
// for instance); queries that can't run are left out
export async function importGroups(text: string): Promise<ActionResult> {
  let file: { groups?: unknown }
  try {
    file = JSON.parse(text)
  } catch {
    return { ok: false, error: 'O arquivo não é um JSON válido' }
  }
  if (!Array.isArray(file.groups))
    return { ok: false, error: 'O arquivo não tem grupos de busca' }

  let groupCount = 0
  let searchCount = 0
  let skipped = 0
  const result = await edit((config) => {
    const groups = [...config.groups]
    const usedIds = new Set([
      EMAIL_VIEW,
      ...groups.flatMap(({ id, searches }) => [
        id,
        ...searches.map((s) => s.id),
      ]),
    ])
    const freshId = (name: string) => {
      let id = newId(name)
      while (usedIds.has(id)) id = newId(name)
      usedIds.add(id)
      return id
    }
    const freshName = (name: string) => {
      let candidate = name
      for (let n = 2; groups.some((group) => group.name === candidate); n++)
        candidate = `${name.slice(0, 36)} ${n}`
      return candidate
    }

    for (const raw of file.groups as Partial<SearchGroup>[]) {
      const name =
        typeof raw?.name === 'string' ? raw.name.trim().slice(0, 40) : ''
      if (!name || !Array.isArray(raw.searches)) continue
      const searches = raw.searches.flatMap((search) => {
        const label =
          typeof search?.label === 'string'
            ? search.label.trim().slice(0, 40)
            : ''
        const query =
          typeof search?.query === 'string' ? search.query.trim() : ''
        if (!label || queryProblem(query)) {
          skipped++
          return []
        }
        return [
          {
            id: freshId(label),
            label,
            query,
            enabled: search.enabled !== false,
          },
        ]
      })
      groups.push({
        id: freshId(name),
        name: freshName(name),
        recentOnly: raw.recentOnly === true,
        searches,
      })
      groupCount++
      searchCount += searches.length
    }
    if (!groupCount) throw new Error('Nenhum grupo válido no arquivo')
    return { ...config, groups }
  })
  if (!result.ok) return result
  return {
    ok: true,
    message: `${groupCount} ${groupCount === 1 ? 'grupo importado' : 'grupos importados'}, com ${searchCount} buscas${
      skipped === 1
        ? ' (1 ignorada por estar inválida)'
        : skipped
          ? ` (${skipped} ignoradas por estarem inválidas)`
          : ''
    }`,
  }
}
