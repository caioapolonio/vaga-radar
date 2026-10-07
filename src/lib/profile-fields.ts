// Who is applying: filled in on /perfil, read by the filters, the email
// sender and, later, the AI (client-safe: no Node imports)

export const TARGET_LEVELS = [
  { value: 'estagio', label: 'Estágio' },
  { value: 'junior', label: 'Júnior' },
  { value: 'pleno', label: 'Pleno' },
  { value: 'senior', label: 'Sênior' },
] as const

export const WORK_MODES = [
  { value: 'remote-country', label: 'Remoto, no Brasil' },
  { value: 'remote-abroad', label: 'Remoto, para o exterior' },
  { value: 'onsite-city', label: 'Presencial ou híbrido na sua cidade' },
] as const

export const CV_LANGUAGES = [
  { value: 'pt', label: 'Português' },
  { value: 'en', label: 'Inglês' },
  { value: 'es', label: 'Espanhol' },
] as const

export type CvLanguage = (typeof CV_LANGUAGES)[number]['value']

export type CvInfo = {
  label: string
  language: CvLanguage
  // Which jobs this version fits, e.g. "Front-end React"
  useFor: string
}

export type Profile = {
  name: string
  // Closes every email, exactly as written
  signature: string
  city: string
  // Comma-separated, e.g. "Niterói, São Gonçalo"; count as the same region
  nearbyCities: string
  levels: (typeof TARGET_LEVELS)[number]['value'][]
  workModes: (typeof WORK_MODES)[number]['value'][]
  // Free text: salary expectations by currency and level
  salary: string
  // Free text: experience, strongest and weakest technologies, languages
  about: string
  // Free text: anything the emails must or must never say
  rules: string
  // Résumé file (relative to the CV folder) -> what it is
  cvs: Record<string, CvInfo>
}

export const EMPTY_PROFILE: Profile = {
  name: '',
  signature: '',
  city: '',
  nearbyCities: '',
  levels: [],
  workModes: [],
  salary: '',
  about: '',
  rules: '',
  cvs: {},
}

// The city and its neighbors, for the "Onde" filter
export const localPlaces = ({ city, nearbyCities }: Profile) =>
  [city, ...nearbyCities.split(',')]
    .map((place) => place.trim())
    .filter(Boolean)

const isOneOf = <T extends string>(
  options: readonly { value: T }[],
  value: unknown,
): value is T => options.some((option) => option.value === value)

// The profile to save, or what's wrong with the input
export function parseProfile(input: Profile): Profile | string {
  if (!input.name.trim()) return 'Escreva seu nome'
  if (!input.signature.trim()) return 'Escreva a assinatura dos e-mails'
  if (!input.levels.every((level) => isOneOf(TARGET_LEVELS, level)))
    return 'Nível inválido'
  if (!input.workModes.every((mode) => isOneOf(WORK_MODES, mode)))
    return 'Modalidade inválida'
  for (const [file, cv] of Object.entries(input.cvs)) {
    if (!cv.label.trim()) return `Dê um nome ao CV ${file}`
    if (!isOneOf(CV_LANGUAGES, cv.language))
      return `Escolha o idioma do CV ${file}`
  }
  return {
    ...input,
    name: input.name.trim(),
    signature: input.signature.trim(),
    city: input.city.trim(),
  }
}

export const isProfileFilled = ({ name, signature }: Profile) =>
  !!name.trim() && !!signature.trim()

// "front-end/cv-frontend-br.pdf" -> "cv-frontend-br", until it's named
export const fallbackCvLabel = (file: string) =>
  file
    .split('/')
    .at(-1)!
    .replace(/\.pdf$/i, '')

// Guesses for a résumé just found in the folder
export const guessCvInfo = (file: string): CvInfo => ({
  label: fallbackCvLabel(file),
  language: /(^|[/_-])(en|english|eng)([/_.-]|$)/i.test(file)
    ? 'en'
    : /(^|[/_-])(es|espanol|spanish)([/_.-]|$)/i.test(file)
      ? 'es'
      : 'pt',
  useFor: '',
})
