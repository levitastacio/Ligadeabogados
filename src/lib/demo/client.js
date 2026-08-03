// Cliente del modo demo: expone la misma superficie que supabase-js
// (auth, from, rpc, storage) pero contra la base local. Permite probar
// la app completa sin configurar Supabase.
import { getDB, persist, uuid, resetDB } from './db'
import { DemoQuery } from './query'
import { runRPC } from './rpc'

const SESSION_KEY = 'gym-squad-demo-session'
const listeners = new Set()

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
  } catch {
    return null
  }
}

function writeSession(session) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  else localStorage.removeItem(SESSION_KEY)
  listeners.forEach((fn) => fn(session ? 'SIGNED_IN' : 'SIGNED_OUT', session))
}

function makeSession(user) {
  return { user, access_token: 'demo-token', expires_at: Date.now() + 86400000 }
}

const auth = {
  async getSession() {
    return { data: { session: readSession() }, error: null }
  },

  async getUser() {
    const s = readSession()
    return { data: { user: s?.user || null }, error: null }
  },

  async signUp({ email, password }) {
    const db = getDB()
    if (db.auth_users.some((u) => u.email.toLowerCase() === String(email).toLowerCase())) {
      return { data: { user: null, session: null }, error: { message: 'User already registered' } }
    }
    if (!password || password.length < 6) {
      return { data: { user: null, session: null }, error: { message: 'Password should be at least 6 characters' } }
    }
    const user = { id: uuid(), email, created_at: new Date().toISOString() }
    db.auth_users.push({ ...user, password })
    persist()
    const session = makeSession(user)
    writeSession(session)
    return { data: { user, session }, error: null }
  },

  async signInWithPassword({ email, password }) {
    const db = getDB()
    const found = db.auth_users.find((u) => u.email.toLowerCase() === String(email).toLowerCase() && u.password === password)
    if (!found) return { data: { user: null, session: null }, error: { message: 'Invalid login credentials' } }
    const user = { id: found.id, email: found.email, created_at: found.created_at }
    const session = makeSession(user)
    writeSession(session)
    return { data: { user, session }, error: null }
  },

  async signInWithOAuth() {
    const db = getDB()
    let found = db.auth_users.find((u) => u.email === 'demo@gymsquad.app')
    if (!found) {
      found = { id: uuid(), email: 'demo@gymsquad.app', password: null, created_at: new Date().toISOString() }
      db.auth_users.push(found)
      persist()
    }
    writeSession(makeSession({ id: found.id, email: found.email, created_at: found.created_at }))
    return { data: {}, error: null }
  },

  async signOut() {
    writeSession(null)
    return { error: null }
  },

  onAuthStateChange(callback) {
    listeners.add(callback)
    return {
      data: {
        subscription: {
          unsubscribe() {
            listeners.delete(callback)
          },
        },
      },
    }
  },
}

// Storage: guarda las imagenes como data URL dentro de la base local.
function storageBucket(bucket) {
  return {
    async upload(path, file) {
      const db = getDB()
      try {
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
        db.storage_objects = db.storage_objects.filter((o) => !(o.bucket === bucket && o.path === path))
        db.storage_objects.push({ bucket, path, data: dataUrl, created_at: new Date().toISOString() })
        persist()
        return { data: { path }, error: null }
      } catch (err) {
        return { data: null, error: { message: 'No se pudo guardar la imagen en modo demo' } }
      }
    },

    getPublicUrl(path) {
      const db = getDB()
      const obj = db.storage_objects.find((o) => o.bucket === bucket && o.path === path)
      return { data: { publicUrl: obj?.data || '' } }
    },

    async list(folder) {
      const db = getDB()
      const prefix = folder ? `${folder}/` : ''
      const data = db.storage_objects
        .filter((o) => o.bucket === bucket && o.path.startsWith(prefix))
        .map((o) => ({ name: o.path.slice(prefix.length), created_at: o.created_at }))
        .sort((a, b) => b.name.localeCompare(a.name))
      return { data, error: null }
    },

    async createSignedUrl(path) {
      const db = getDB()
      const obj = db.storage_objects.find((o) => o.bucket === bucket && o.path === path)
      if (!obj) return { data: null, error: { message: 'No encontrado' } }
      return { data: { signedUrl: obj.data }, error: null }
    },

    async remove(paths) {
      const db = getDB()
      db.storage_objects = db.storage_objects.filter((o) => !(o.bucket === bucket && paths.includes(o.path)))
      persist()
      return { data: null, error: null }
    },
  }
}

export const demoClient = {
  isDemo: true,
  auth,
  from(table) {
    return new DemoQuery(table)
  },
  async rpc(name, args) {
    const session = readSession()
    return runRPC(name, args, session?.user?.id || null)
  },
  storage: { from: storageBucket },
}

export function resetDemo() {
  resetDB()
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem('gs-group')
  Object.keys(localStorage)
    .filter((k) => k.startsWith('gs-wrapped-seen-'))
    .forEach((k) => localStorage.removeItem(k))
}
