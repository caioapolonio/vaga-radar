import { describe, expect, it } from 'vitest'
import { jobLevels, jobRegions, jobWorkModels } from './job'

describe('job buckets', () => {
  it('sorts free-text seniority', () => {
    expect(jobLevels({ title: '', seniority: 'Júnior/Pleno' })).toEqual([
      'junior',
      'pleno',
    ])
    expect(jobLevels({ title: '', seniority: 'Não informada' })).toEqual([
      'unknown',
    ])
    expect(jobLevels({ title: '', seniority: 'Sênior' })).toEqual(['other'])
  })

  it('sorts work models', () => {
    expect(jobWorkModels({ title: '', workModel: 'Remoto (PJ)' })).toEqual([
      'remote',
    ])
    expect(jobWorkModels({ title: '', workModel: 'Híbrido' })).toEqual([
      'onsite',
    ])
  })

  it('puts the profile city and its neighbors in "local"', () => {
    const places = ['Recife', 'Olinda']
    expect(jobRegions({ title: '', location: 'Olinda, PE' }, places)).toEqual([
      'brasil',
      'local',
    ])
    expect(jobRegions({ title: '', location: 'LATAM' }, places)).toEqual([
      'abroad',
    ])
    expect(jobRegions({ title: '', location: 'Recife' }, [])).toEqual([
      'unknown',
    ])
  })
})
