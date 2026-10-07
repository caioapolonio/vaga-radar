import path from 'node:path'
import { jsonUpdater, readJson } from './json-file'
import type { SearchConfig } from './search-config'

export * from './search-config'

const SEARCHES_PATH = path.join(process.cwd(), 'data', 'searches.json')

// A fresh clone starts with no searches: the user creates them on /buscas
const emptyConfig = (): SearchConfig => ({ groups: [] })

export const readSearchConfig = () => readJson(SEARCHES_PATH, emptyConfig)

export const updateSearchConfig = jsonUpdater(SEARCHES_PATH, emptyConfig)
