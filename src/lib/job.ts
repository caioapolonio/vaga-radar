// What the AI extracts about a job from its post (client-safe: no Node imports)
export type JobSummary = {
  title: string
  company?: string
  seniority?: string
  workModel?: string
  location?: string
}

// "Não informado" says nothing on its own; the fit text explains what's missing
const UNKNOWN = /^(não informad[oa]|not (specified|informed|stated))\.?$/i

export function jobBadges(job: JobSummary) {
  return (['seniority', 'workModel', 'location'] as const).flatMap((field) => {
    const value = job[field]?.trim()
    return value && !UNKNOWN.test(value) ? [{ field, value }] : []
  })
}

// The AI writes these fields as free text ("Pleno/Sênior", "Remoto (PJ, a
// confirmar)", "LATAM"), so the filters sort them into a few buckets; a job
// can land in more than one

export const LEVELS = {
  junior: 'Júnior',
  pleno: 'Pleno',
  other: 'Outro nível',
  unknown: 'Não informado',
} as const

export const WORK_MODELS = {
  remote: 'Remoto',
  onsite: 'Presencial ou híbrido',
  unknown: 'Não informado',
} as const

export type Region = 'brasil' | 'abroad' | 'local' | 'unknown'

// "Onde" filter options; "local" is the city from /perfil, when there's one
export const regionLabels = (city: string) => ({
  brasil: 'Brasil',
  abroad: 'Exterior / LATAM',
  ...(city && { local: `${city} e região` }),
  unknown: 'Não informado',
})

const fold = (text = '') =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

function buckets<T extends string>(text: string, rules: [T, RegExp][]) {
  const found = rules.flatMap(([bucket, rule]) =>
    rule.test(text) ? [bucket] : [],
  )
  return found.length ? found : null
}

export const jobLevels = (job: JobSummary): (keyof typeof LEVELS)[] => {
  const text = fold(job.seniority)
  if (!text || /^(nao informad|a confirmar)/.test(text)) return ['unknown']
  return (
    buckets(text, [
      ['junior', /junior|\bjr\b|entry/],
      ['pleno', /pleno|\bmid\b|semi|ssr/],
    ]) ?? ['other']
  )
}

export const jobWorkModels = (job: JobSummary): (keyof typeof WORK_MODELS)[] =>
  buckets(fold(job.workModel), [
    ['remote', /remot|home office/],
    ['onsite', /presencial|hibrid|hybrid|on-?site/],
  ]) ?? ['unknown']

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// localPlaces: the city and its neighbors from /perfil
export function jobRegions(job: JobSummary, localPlaces: string[]): Region[] {
  const rules: [Region, RegExp][] = [
    [
      'brasil',
      /brasil|brazil|sao paulo|rio de janeiro|rio grande|santa catarina|minas gerais|parana|pernambuco|bahia|brasilia|goiania|\b(sp|rj|df|go|mg|pr|sc|rs|pe|ba)\b/,
    ],
    [
      'abroad',
      /latam|latin|america|worldwide|mundial|internacional|global|exterior|europ|eua|usa|canad|portugal|panama|mexico|chile|argentin|colombia|peru|uruguai|paquistao|emirados/,
    ],
  ]
  if (localPlaces.length)
    rules.push([
      'local',
      new RegExp(
        localPlaces
          .map((place) => `\\b${escapeRegExp(fold(place))}\\b`)
          .join('|'),
      ),
    ])
  return (
    buckets(fold(`${job.location ?? ''} ${job.workModel ?? ''}`), rules) ?? [
      'unknown',
    ]
  )
}
