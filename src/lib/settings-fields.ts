// Limits the user can change on /ajustes (client-safe: no Node imports)
export type Settings = {
  // The AI only reads posts this recent; null reads every post
  triageMaxAgeDays: number | null
  // How far back a search goes the first time it runs
  searchLookbackDays: number
  // Same, for groups marked "só posts recentes" on /buscas
  emailSearchLookbackDays: number
  maxPostsPerSearch: number
  // Never let a search bring the monthly Apify credit below this
  creditReserveUsd: number
}

export const DEFAULT_SETTINGS: Settings = {
  triageMaxAgeDays: 30,
  searchLookbackDays: 90,
  emailSearchLookbackDays: 30,
  maxPostsPerSearch: 250,
  creditReserveUsd: 0.5,
}

type NumberField = {
  key: keyof Settings
  label: string
  hint: string
  min: number
  max: number
  step: number
  unit: string
  // Lets the field be turned off ("no limit")
  unlimitedLabel?: string
}

export const SETTING_FIELDS: NumberField[] = [
  {
    key: 'triageMaxAgeDays',
    label: 'Posts que a IA analisa',
    hint: 'Idade máxima dos posts lidos nas análises de "Para você" e "E-mails". Posts mais velhos são ignorados.',
    min: 1,
    max: 365,
    step: 1,
    unit: 'dias',
    unlimitedLabel: 'Todas as vagas, de qualquer data',
  },
  {
    key: 'searchLookbackDays',
    label: 'Primeira pesquisa de uma busca',
    hint: 'Quantos dias para trás uma busca nova vai no LinkedIn. Depois disso, cada pesquisa só traz o que saiu desde a anterior.',
    min: 1,
    max: 365,
    step: 1,
    unit: 'dias',
  },
  {
    key: 'emailSearchLookbackDays',
    label: 'Primeira pesquisa dos grupos "só posts recentes"',
    hint: 'O mesmo, para os grupos marcados assim em Buscas.',
    min: 1,
    max: 365,
    step: 1,
    unit: 'dias',
  },
  {
    key: 'maxPostsPerSearch',
    label: 'Máximo de posts por busca',
    hint: 'Por busca, em cada pesquisa. O LinkedIn entrega cerca de 200 por consulta; cada post custa ~US$ 0,002.',
    min: 1,
    max: 1000,
    step: 1,
    unit: 'posts',
  },
  {
    key: 'creditReserveUsd',
    label: 'Reserva de crédito da Apify',
    hint: 'A pesquisa para antes de o crédito do mês ficar abaixo deste valor.',
    min: 0,
    max: 50,
    step: 0.1,
    unit: 'US$',
  },
]

// The settings to save, or what's wrong with the input
export function parseSettings(input: Settings): Settings | string {
  for (const { key, label, min, max, step, unlimitedLabel } of SETTING_FIELDS) {
    const value = input[key]
    if (value === null && unlimitedLabel) continue
    if (typeof value !== 'number' || !Number.isFinite(value))
      return `${label}: informe um número`
    if (value < min || value > max)
      return `${label}: use um valor entre ${min} e ${max}`
    if (step === 1 && !Number.isInteger(value))
      return `${label}: use um número inteiro`
  }
  return input
}

// "dos últimos 30 dias" / "de qualquer data", for the pages' explanations
export const triageWindowLabel = ({ triageMaxAgeDays }: Settings) =>
  triageMaxAgeDays === null
    ? 'de qualquer data'
    : `dos últimos ${triageMaxAgeDays} dias`
