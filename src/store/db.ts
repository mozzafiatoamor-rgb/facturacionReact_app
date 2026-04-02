// ============================================================
// DB.TS — Dexie (IndexedDB) para cola de operaciones offline
// ============================================================

import Dexie, { type Table } from 'dexie'
import type { PendingOperation } from '../api/types'

class FacturasDB extends Dexie {
  pendingOps!: Table<PendingOperation, number>

  constructor() {
    super('mozzafiato-facturas-db')
    this.version(1).stores({
      // id es auto-increment, indexamos createdAt para ordenar y type para filtrar
      pendingOps: '++id, type, createdAt, retries',
    })
  }
}

export const db = new FacturasDB()

// ── Helpers ────────────────────────────────────────────────

export async function enqueueOp(op: Omit<PendingOperation, 'id'>): Promise<void> {
  await db.pendingOps.add(op)
}

export async function getPendingOps(): Promise<PendingOperation[]> {
  return db.pendingOps.orderBy('createdAt').toArray()
}

export async function deleteOp(id: number): Promise<void> {
  await db.pendingOps.delete(id)
}

export async function incrementRetry(id: number): Promise<void> {
  await db.pendingOps
    .where('id')
    .equals(id)
    .modify((op) => { op.retries++ })
}

export async function countPending(): Promise<number> {
  return db.pendingOps.count()
}
