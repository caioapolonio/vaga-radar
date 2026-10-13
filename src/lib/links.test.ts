import { describe, expect, it } from 'vitest'
import { toHref } from './links'

describe('toHref', () => {
  it('keeps web and email links that are already complete', () => {
    expect(toHref('https://nerdin.com.br/vaga/1')).toBe(
      'https://nerdin.com.br/vaga/1',
    )
    expect(toHref('mailto:rh@empresa.com')).toBe('mailto:rh@empresa.com')
  })

  it('completes links written without the scheme', () => {
    expect(toHref('nerdin.com.br/vaga/99449')).toBe(
      'https://nerdin.com.br/vaga/99449',
    )
    expect(toHref('makroengenharia.gupy.io')).toBe(
      'https://makroengenharia.gupy.io',
    )
    expect(toHref(' www.empresa.me ')).toBe('https://www.empresa.me')
    expect(toHref('rh@empresa.digital')).toBe('mailto:rh@empresa.digital')
  })

  it('gives no link for anything else', () => {
    expect(toHref('javascript:alert(1)')).toBeNull()
    expect(toHref('data:text/html,oi')).toBeNull()
    expect(toHref('link nos comentários')).toBeNull()
  })
})
