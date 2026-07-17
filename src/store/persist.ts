/**
 * IndexedDB persistence (Dexie): the uma library and named tree saves,
 * plus JSON export/import for backup.
 */
import Dexie from 'dexie'
import type { EntityTable } from 'dexie'
import type { LibraryUma } from '../model/library'
import type { Tree } from '../model/types'

export interface TreeSave {
  id?: number
  name: string
  tree: Tree
  createdAt: string
  updatedAt: string
}

const db = new Dexie('sparkline') as Dexie & {
  library: EntityTable<LibraryUma, 'id'>
  treeSaves: EntityTable<TreeSave, 'id'>
}

db.version(1).stores({
  library: '++id, name, owned, trainedAt, updatedAt',
  treeSaves: '++id, name, updatedAt',
})

export { db }

// --- uma library -----------------------------------------------------------

export async function saveUmaToLibrary(
  entry: Omit<LibraryUma, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<number> {
  const now = new Date().toISOString()
  return db.library.add({ ...entry, createdAt: now, updatedAt: now }) as Promise<number>
}

export async function updateLibraryUma(id: number, patch: Partial<LibraryUma>): Promise<void> {
  await db.library.update(id, { ...patch, updatedAt: new Date().toISOString() })
}

export async function deleteLibraryUma(id: number): Promise<void> {
  await db.library.delete(id)
}

export async function clearLibrary(): Promise<void> {
  await db.library.clear()
}

export async function listLibrary(): Promise<LibraryUma[]> {
  return db.library.orderBy('updatedAt').reverse().toArray()
}

// --- tree saves --------------------------------------------------------------

export async function saveTree(name: string, tree: Tree, id?: number): Promise<number> {
  const now = new Date().toISOString()
  if (id !== undefined) {
    await db.treeSaves.update(id, { name, tree: structuredClone(tree), updatedAt: now })
    return id
  }
  return db.treeSaves.add({ name, tree: structuredClone(tree), createdAt: now, updatedAt: now }) as Promise<number>
}

export async function deleteTreeSave(id: number): Promise<void> {
  await db.treeSaves.delete(id)
}

export async function listTreeSaves(): Promise<TreeSave[]> {
  return db.treeSaves.orderBy('updatedAt').reverse().toArray()
}

// --- JSON backup -------------------------------------------------------------

export interface BackupFile {
  app: 'sparkline'
  version: 1
  exportedAt: string
  library: LibraryUma[]
  treeSaves: TreeSave[]
}

export async function exportBackup(): Promise<BackupFile> {
  return {
    app: 'sparkline',
    version: 1,
    exportedAt: new Date().toISOString(),
    library: await db.library.toArray(),
    treeSaves: await db.treeSaves.toArray(),
  }
}

/** Imports a backup, merging by name (existing entries are kept). */
export async function importBackup(raw: unknown): Promise<{ umas: number; trees: number }> {
  const file = raw as BackupFile
  if (!file || file.app !== 'sparkline' || file.version !== 1) {
    throw new Error('Not a Sparkline backup file.')
  }
  let umas = 0
  for (const uma of file.library ?? []) {
    const { id: _id, ...rest } = uma
    await db.library.add(rest)
    umas++
  }
  let trees = 0
  for (const save of file.treeSaves ?? []) {
    const { id: _id, ...rest } = save
    await db.treeSaves.add(rest)
    trees++
  }
  return { umas, trees }
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
