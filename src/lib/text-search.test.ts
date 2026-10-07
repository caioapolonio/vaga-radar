import { describe, expect, it } from 'vitest'
import { foldText, hasTerms, queryTerms } from './text-search'

describe('text search', () => {
  it('ignores accents and case', () => {
    expect(foldText('Programação SÊNIOR')).toBe('programacao senior')
  })

  it('needs every word, in any order', () => {
    const text = foldText('Vaga remota para dev React júnior')
    expect(hasTerms(text, queryTerms('react REMOTA'))).toBe(true)
    expect(hasTerms(text, queryTerms('react pleno'))).toBe(false)
    expect(hasTerms(text, queryTerms('   '))).toBe(true)
  })
})
