// How well a match fits, as the AI rates it (client-safe: no Node imports)
export const STRENGTHS = [
  {
    value: 3,
    tab: 'Fortes',
    badge: 'Forte',
    hint: 'Nível e stack confirmados pelo post.',
    className:
      'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200',
  },
  {
    value: 2,
    tab: 'Boas',
    badge: 'Boa',
    hint: 'Falta um dado no post ou algum requisito fica no limite.',
    className: 'bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-200',
  },
  {
    value: 1,
    tab: 'Na dúvida',
    badge: 'Na dúvida',
    hint: 'O post não diz a stack ou o nível: confira no link antes.',
    className:
      'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200',
  },
] as const

// A match saved before ratings existed counts as "na dúvida"
export const strengthInfo = (strength?: number) =>
  STRENGTHS.find(({ value }) => value === (strength ?? 1)) ?? STRENGTHS[2]
