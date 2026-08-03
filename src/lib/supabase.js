import { createClient } from '@supabase/supabase-js'
import { demoClient } from './demo/client'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigured = Boolean(url && key)

// Sin credenciales la app corre en modo demo contra una base local que
// imita a Supabase. Al agregar el .env pasa a la base real sin tocar codigo.
export const supabase = supabaseConfigured
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })
  : demoClient

export const isDemo = !supabaseConfigured
