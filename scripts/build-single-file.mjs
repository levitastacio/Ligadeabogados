// Compila la app en un solo archivo HTML autocontenido (JS y CSS incrustados).
// Sirve para probar la demo desde cualquier navegador sin servidor ni Supabase.
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const dist = path.join(root, 'dist')
const out = path.join(root, 'gym-squad-app.html')

console.log('Compilando en modo archivo unico...')
execSync('npx vite build', { stdio: 'inherit', env: { ...process.env, VITE_SINGLE_FILE: '1' } })

let html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')

// Incrusta el CSS
html = html.replace(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (_m, href) => {
  const css = fs.readFileSync(path.join(dist, href.replace(/^\//, '')), 'utf8')
  return `<style>\n${css}\n</style>`
})

// Incrusta el JS
html = html.replace(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g, (_m, src) => {
  const js = fs.readFileSync(path.join(dist, src.replace(/^\//, '')), 'utf8')
  return `<script type="module">\n${js}\n</script>`
})

// Quita referencias a archivos externos que no existen en una pagina suelta
html = html
  .replace(/<link rel="manifest"[^>]*>/g, '')
  .replace(/<link rel="icon"[^>]*>/g, '')
  .replace(/<link rel="apple-touch-icon"[^>]*>/g, '')

if (html.includes('src="/assets') || html.includes('href="/assets')) {
  throw new Error('Quedaron referencias externas sin incrustar')
}

fs.writeFileSync(out, html)
console.log(`Listo: ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`)
