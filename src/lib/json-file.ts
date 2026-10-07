import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

export async function readJson<T>(file: string, empty: () => T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return empty()
    throw error
  }
}

export async function writeJson(file: string, data: unknown) {
  await mkdir(path.dirname(file), { recursive: true })
  // Write then rename so a crash mid-write never leaves a truncated file; the
  // pid keeps two processes from sharing a temp file
  const tempPath = `${file}.${process.pid}.tmp`
  await writeFile(tempPath, JSON.stringify(data, null, 2))
  await rename(tempPath, file)
}

// Serializes read-modify-write cycles so concurrent actions don't overwrite each other
export function jsonUpdater<T>(file: string, empty: () => T) {
  let pending: Promise<unknown> = Promise.resolve()
  return (update: (data: T) => T) => {
    const next = pending.then(async () => {
      const data = update(await readJson(file, empty))
      await writeJson(file, data)
      return data
    })
    pending = next.catch(() => {})
    return next
  }
}
