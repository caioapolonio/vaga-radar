import { describe, expect, it } from 'vitest'
import {
  newId,
  operatorCount,
  queryProblem,
  runnableSearches,
  searchLabels,
  type SearchConfig,
} from './search-config'

describe('queryProblem', () => {
  it('accepts a query within the operator limit', () => {
    expect(queryProblem('("react" OR "next.js") AND ("remoto")')).toBeNull()
  })

  it('counts only uppercase operators', () => {
    expect(operatorCount('("a" OR "b") AND ("c") or and')).toBe(2)
  })

  it('refuses empty, too long, and unbalanced queries', () => {
    expect(queryProblem('  ')).toBe('Escreva a busca')
    expect(
      queryProblem('("a" OR "b" OR "c") AND ("d" OR "e") AND ("f" OR "g")'),
    ).toMatch(/6 operadores/)
    expect(queryProblem('("react) AND ("remoto")')).toMatch(/aspas/)
    expect(queryProblem('("react" AND ("remoto")')).toMatch(/parênteses/)
    expect(queryProblem('"react")(')).toMatch(/parênteses/)
  })
})

describe('search groups', () => {
  const config: SearchConfig = {
    groups: [
      {
        id: 'br',
        name: 'Brasil',
        recentOnly: false,
        searches: [
          { id: 'a', label: 'A', query: '"a"', enabled: true },
          { id: 'b', label: 'B', query: '"b"', enabled: false },
        ],
      },
      {
        id: 'cv',
        name: 'CV por e-mail',
        recentOnly: true,
        searches: [{ id: 'c', label: 'C', query: '"c"', enabled: true }],
      },
    ],
  }

  it('runs only enabled searches, carrying the group flag', () => {
    expect(runnableSearches(config).map(({ id }) => id)).toEqual(['a', 'c'])
    expect(runnableSearches(config, 'cv')).toEqual([
      { id: 'c', label: 'C', query: '"c"', enabled: true, recentOnly: true },
    ])
  })

  it('labels disabled searches too, for the posts they found', () => {
    expect(searchLabels(config)).toEqual({ a: 'A', b: 'B', c: 'C' })
  })

  it('makes readable ids from names', () => {
    expect(newId('Dev Recife (PJ)')).toMatch(
      /^dev-recife-pj-[a-z0-9]{4}$/,
    )
    expect(newId('***')).toMatch(/^busca-[a-z0-9]{4}$/)
  })
})
