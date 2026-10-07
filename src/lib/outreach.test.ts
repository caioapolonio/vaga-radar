import { describe, expect, it } from 'vitest'
import { findEmails } from './outreach'

describe('findEmails', () => {
  it('finds addresses written in a post, lowercased and once each', () => {
    expect(
      findEmails('Envie para Vagas@Empresa.com.br ou vagas@empresa.com.br.'),
    ).toEqual(['vagas@empresa.com.br'])
  })

  it('skips image names that look like addresses', () => {
    expect(findEmails('logo@2x.png e rh@empresa.com')).toEqual([
      'rh@empresa.com',
    ])
  })
})
