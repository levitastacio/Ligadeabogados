# Instrucciones para continuar Gym Squad (para Claude Code en la terminal)

## Estado del proyecto

La app Gym Squad está COMPLETA en la rama `claude/gym-squad-full-build-74ztnw` de este repo. No hay que reconstruir nada. Lo que existe:

- **App completa React + Vite + Supabase** en `src/` (las 7 fases de la especificación: auth, onboarding, rutinas con plantillas, entrenamiento en vivo con PRs y cronómetro, grupos, feed con reacciones, rankings con podio, running estilo Strava con rutas y récords, medallas mensuales con pantalla Wrapped, duelos 1v1, progreso con gráficas Recharts y calendario GitHub, peso corporal y fotos privadas, offline con cola IndexedDB, PWA, exportes e importador de la app vieja).
- **`supabase/schema.sql`**: TODO el SQL (tablas, RLS, vistas, funciones security definer, `award_monthly_medals`, pg_cron, buckets, seed de 60 ejercicios). Se pega UNA vez en el SQL Editor de Supabase.
- **`README.md`**: guía completa de despliegue y de prueba de cada funcionalidad.
- **`gym-squad-local.html`**: versión ligera de un solo archivo que funciona sin Supabase (localStorage). Es solo una demo funcional para el teléfono, NO es la app principal.
- **`demo-diseno.html`**: maqueta estática de las 5 pantallas para revisar diseño.
- **`netlify.toml`**: build `npm run build`, publish `dist`, redirect SPA. El build ya pasa sin errores.

## Convenciones que se deben mantener

- Todo el texto de interfaz en español, SIN em-dashes.
- Unidades en libras por defecto, fechas es-DO.
- Estética iOS: cards con radio 22px, sombras suaves, modo oscuro automático, acento según la meta del usuario (`src/lib/utils.js` → GOALS).
- Mobile first, max-width 560px.
- Componentes pequeños en `src/components/`, páginas en `src/pages/`, lógica compartida en `src/lib/`.

## Pasos de arranque (hacer en orden)

1. Verificar que existe `.env` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (si no, crearlo a partir de `.env.example` y pedirle los valores al usuario, están en Supabase → Settings → API).
2. `npm install`
3. `npm run dev` y abrir http://localhost:5173
4. Si el usuario aún no ejecutó `supabase/schema.sql` en el SQL Editor de Supabase, recordárselo: sin eso el onboarding falla al crear el perfil.
5. Probar el flujo completo: crear cuenta → onboarding → registrar un entreno → registrar una carrera → crear un grupo.

## Trabajo pendiente sugerido (en este orden, solo si el usuario lo pide)

1. Ajustes de diseño que el usuario decida tras ver la app.
2. Agregar variables de entorno en Netlify y mergear la rama a `main` para desplegar.
3. Opcional: configurar Google OAuth en Supabase.
