import { readFile } from 'node:fs/promises'
import { extractText } from 'unpdf'
import { cvPath } from './outreach'

// Enough for several résumés; more only repeats the same experience
const MAX_CHARS = 60_000

// The text of every résumé, for the AI to summarize the profile from
export async function cvTexts(files: string[]) {
  const parts: string[] = []
  let total = 0
  for (const file of files) {
    const data = new Uint8Array(await readFile(await cvPath(file)))
    const { text } = await extractText(data, { mergePages: true })
    const part = `### ${file}\n\n${text.trim()}`
    if (total + part.length > MAX_CHARS) break
    parts.push(part)
    total += part.length
  }
  return parts.join('\n\n')
}
