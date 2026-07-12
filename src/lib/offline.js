// Offline first: cola de escrituras en IndexedDB (localForage) y cache de lecturas.
// Si una escritura falla por red, se encola y se sincroniza al volver la conexion.
import localforage from 'localforage'
import { supabase } from './supabase'

const queueStore = localforage.createInstance({ name: 'gym-squad', storeName: 'write_queue' })
const cacheStore = localforage.createInstance({ name: 'gym-squad', storeName: 'read_cache' })

const listeners = new Set()
let pendingCount = 0

export function onPendingChange(fn) {
  listeners.add(fn)
  fn(pendingCount)
  return () => listeners.delete(fn)
}

async function refreshPending() {
  const keys = await queueStore.keys()
  pendingCount = keys.length
  listeners.forEach((fn) => fn(pendingCount))
}

function isNetworkError(err) {
  const msg = String(err?.message || err || '').toLowerCase()
  return !navigator.onLine || msg.includes('fetch') || msg.includes('network') || msg.includes('failed to')
}

async function enqueue(item) {
  await queueStore.setItem(`${Date.now()}-${Math.random().toString(36).slice(2)}`, item)
  await refreshPending()
}

async function runItem(item) {
  if (item.op === 'update') {
    let q = supabase.from(item.table).update(item.rows)
    for (const [k, v] of Object.entries(item.match)) q = q.eq(k, v)
    const { error } = await q
    if (error) throw error
  } else {
    const { error } = await supabase.from(item.table).insert(item.rows)
    if (error && !String(error.message || '').toLowerCase().includes('duplicate')) throw error
  }
}

// Inserta filas; si falla por red las guarda en la cola local.
export async function offlineInsert(table, rows) {
  const list = Array.isArray(rows) ? rows : [rows]
  const item = { op: 'insert', table, rows: list }
  try {
    if (!navigator.onLine) throw new Error('offline')
    await runItem(item)
    return { queued: false }
  } catch (err) {
    if (isNetworkError(err) || String(err?.message) === 'offline') {
      await enqueue(item)
      return { queued: true }
    }
    throw err
  }
}

// Actualiza filas por match exacto; si falla por red se encola.
export async function offlineUpdate(table, rows, match) {
  const item = { op: 'update', table, rows, match }
  try {
    if (!navigator.onLine) throw new Error('offline')
    await runItem(item)
    return { queued: false }
  } catch (err) {
    if (isNetworkError(err) || String(err?.message) === 'offline') {
      await enqueue(item)
      return { queued: true }
    }
    throw err
  }
}

export async function syncQueue() {
  if (!navigator.onLine) return
  const keys = (await queueStore.keys()).sort()
  for (const key of keys) {
    const item = await queueStore.getItem(key)
    if (!item) continue
    try {
      await runItem(item)
      await queueStore.removeItem(key)
    } catch (err) {
      if (isNetworkError(err)) break
      // Error de datos (no de red): descartar para no bloquear la cola
      await queueStore.removeItem(key)
    }
  }
  await refreshPending()
}

export function initOfflineSync() {
  refreshPending()
  syncQueue()
  window.addEventListener('online', syncQueue)
}

// Cache de lecturas: guarda el ultimo resultado bueno por clave
export async function cachedFetch(key, fetcher) {
  try {
    const data = await fetcher()
    await cacheStore.setItem(key, { data, at: Date.now() })
    return { data, fromCache: false }
  } catch (err) {
    const cached = await cacheStore.getItem(key)
    if (cached) return { data: cached.data, fromCache: true }
    throw err
  }
}

export async function cacheGet(key) {
  const cached = await cacheStore.getItem(key)
  return cached?.data ?? null
}
