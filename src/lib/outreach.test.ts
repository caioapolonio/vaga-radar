import { describe, expect, it } from 'vitest'
import { cardForJob, findEmails, type Draft } from './outreach'
import type { Post } from './store'

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

const post = (id: string, content = ''): Post => ({
  id,
  url: '',
  content,
  postedAt: '2026-10-01T12:00:00.000Z',
  author: { name: '', headline: '', url: '' },
  searchIds: [],
})

const draft = (postId: string, to: string, status: Draft['status']): Draft => ({
  postId,
  createdAt: '2026-10-01T12:00:00.000Z',
  job: { title: `Vaga de ${postId}` },
  fit: '',
  to,
  subject: '',
  body: '',
  cv: '',
  status,
})

describe('cardForJob', () => {
  it("finds the card written for any of the job's posts", () => {
    const card = draft('b', 'rh@empresa.com', 'pending')
    expect(cardForJob([post('a'), post('b')], [card])).toBe(card)
  })

  it('finds a card written to an address in the posts for another post', () => {
    const card = draft('x', 'rh@empresa.com', 'sent')
    expect(
      cardForJob([post('a', 'Currículo para RH@empresa.com')], [card]),
    ).toBe(card)
  })

  it('prefers a sent card, then the one written for the job itself', () => {
    const own = draft('a', 'rh@empresa.com', 'discarded')
    const sent = draft('x', 'rh@empresa.com', 'sent')
    const posts = [post('a', 'rh@empresa.com')]
    expect(cardForJob(posts, [own, sent])).toBe(sent)

    const ownPending = draft('a', 'rh@empresa.com', 'pending')
    const otherPending = draft('y', 'rh@empresa.com', 'pending')
    expect(cardForJob(posts, [otherPending, ownPending])).toBe(ownPending)
  })

  it('finds nothing without a shared post or address', () => {
    expect(
      cardForJob(
        [post('a', 'vagas@outra.com')],
        [draft('x', 'rh@empresa.com', 'sent')],
      ),
    ).toBeUndefined()
  })
})
