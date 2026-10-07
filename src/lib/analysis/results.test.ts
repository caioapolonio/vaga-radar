import { describe, expect, it } from 'vitest'
import type { Post } from '../store'
import {
  emailProblem,
  matchProblem,
  toJobSummary,
  type EmailResult,
  type MatchResult,
} from './results'

const post: Post = {
  id: '1',
  url: 'https://www.linkedin.com/posts/1',
  content:
    'Vaga dev React júnior remoto. Candidate-se em https://lnkd.in/abc ou envie o CV para rh@empresa.com',
  postedAt: '2026-10-01T12:00:00.000Z',
  author: { name: 'Ana', headline: 'Recrutadora', url: 'https://x' },
  searchIds: [],
}

const job = {
  title: 'Dev React',
  company: null,
  seniority: 'Júnior',
  workModel: 'Remoto',
  location: null,
}

const match: MatchResult = {
  postId: '1',
  match: true,
  reason: 'combina',
  strength: 3,
  job,
  fit: 'React júnior remoto.',
  applyUrl: 'https://lnkd.in/abc',
}

describe('matchProblem', () => {
  it('accepts a complete match with a link from the post', () => {
    expect(matchProblem(match, post)).toBeNull()
  })

  it('refuses invented links and missing ratings', () => {
    expect(
      matchProblem({ ...match, applyUrl: 'https://outro.com/vaga' }, post),
    ).toMatch(/não aparece no post/)
    expect(matchProblem({ ...match, strength: 5 }, post)).toMatch(/strength/)
  })

  it('only needs a reason to reject', () => {
    expect(
      matchProblem(
        { ...match, match: false, job: null, fit: null, strength: null },
        post,
      ),
    ).toBeNull()
  })
})

describe('emailProblem', () => {
  const cvs = ['front-end/cv-pt.pdf']
  const email: EmailResult = {
    postId: '1',
    match: true,
    reason: 'combina',
    draft: {
      job,
      fit: 'combina',
      to: 'RH@empresa.com',
      subject: 'Candidatura – Dev React – Ana',
      body: 'Olá, Ana. Vi a vaga no seu post.',
      cv: 'front-end/cv-pt.pdf',
    },
  }

  it('accepts a draft to an address in the post with a listed résumé', () => {
    expect(emailProblem(email, post, cvs)).toBeNull()
  })

  it('refuses other addresses, unknown résumés and semicolons', () => {
    const draft = email.draft!
    expect(
      emailProblem({ ...email, draft: { ...draft, to: 'x@y.com' } }, post, cvs),
    ).toMatch(/não aparece no post/)
    expect(
      emailProblem(
        { ...email, draft: { ...draft, cv: 'outro.pdf' } },
        post,
        cvs,
      ),
    ).toMatch(/currículo inexistente/)
    expect(
      emailProblem(
        { ...email, draft: { ...draft, body: 'Olá; tudo bem?' } },
        post,
        cvs,
      ),
    ).toMatch(/ponto e vírgula/)
  })
})

describe('toJobSummary', () => {
  it('drops unknown fields', () => {
    expect(toJobSummary(job)).toEqual({
      title: 'Dev React',
      seniority: 'Júnior',
      workModel: 'Remoto',
    })
  })
})
