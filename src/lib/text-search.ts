// Accent and case-insensitive text, so "programacao" finds "Programação"
export const foldText = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

// The words typed in a search box, folded
export const queryTerms = (query: string) =>
  foldText(query).split(/\s+/).filter(Boolean)

// Every word must appear somewhere, in any order: "react remoto" finds posts
// that mention both
export const hasTerms = (foldedText: string, terms: string[]) =>
  terms.every((term) => foldedText.includes(term))
