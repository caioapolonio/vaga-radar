import { describe, expect, it } from 'vitest'
import { applyButtonUrl, toHref } from './links'
import type { Post } from './store'

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

describe('applyButtonUrl', () => {
  const post = (content: string, attachment?: string): Post => ({
    id: '1',
    url: 'https://www.linkedin.com/feed/update/1',
    content,
    postedAt: '2026-11-01T00:00:00.000Z',
    author: { name: 'Ana', headline: 'Recrutadora', url: '' },
    ...(attachment && { attachment: { title: 'Vaga', url: attachment } }),
    searchIds: [],
  })

  it('keeps the link of a post that has only that one', () => {
    expect(
      applyButtonUrl(
        post('Vaga React remota: https://lnkd.in/abc'),
        'https://lnkd.in/abc',
      ),
    ).toBe('https://lnkd.in/abc')
    expect(
      applyButtonUrl(
        post('Aplique em nerdin.com.br/vaga/1'),
        'nerdin.com.br/vaga/1',
      ),
    ).toBe('nerdin.com.br/vaga/1')
  })

  it("doesn't count LinkedIn's preview of the link nor profile links", () => {
    const withPreview = post(
      'Fale com https://www.linkedin.com/in/ana e aplique: https://lnkd.in/abc',
      'https://empresa.gupy.io/jobs/1',
    )
    expect(applyButtonUrl(withPreview, 'https://lnkd.in/abc')).toBe(
      'https://lnkd.in/abc',
    )
    expect(applyButtonUrl(withPreview, 'https://empresa.gupy.io/jobs/1')).toBe(
      'https://empresa.gupy.io/jobs/1',
    )
    expect(
      applyButtonUrl(
        post('Vaga no link', 'https://empresa.gupy.io/jobs/1'),
        'https://empresa.gupy.io/jobs/1',
      ),
    ).toBe('https://empresa.gupy.io/jobs/1')
  })

  it('drops the button when the post has more than one link', () => {
    const list = post(
      '1. Front-end https://lnkd.in/a\n2. Back-end https://lnkd.in/b',
    )
    expect(applyButtonUrl(list, 'https://lnkd.in/a')).toBeUndefined()
    expect(
      applyButtonUrl(
        post('Vaga em https://lnkd.in/a'),
        'empresa.com.br/vagas/2',
      ),
    ).toBeUndefined()
  })

  it('gives nothing without a usable link', () => {
    expect(applyButtonUrl(post('Mande DM'), undefined)).toBeUndefined()
    expect(applyButtonUrl(post('x'), 'link nos comentários')).toBeUndefined()
  })
})
