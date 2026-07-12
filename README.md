# Gym Squad 🏋️

App social de entrenamiento para un grupo de amigos: gimnasio + running, con rankings, medallas mensuales, duelos 1v1 y superación personal. PWA instalable con modo offline.

Stack: React + Vite + Supabase (Auth, Postgres, Storage, RLS) + Netlify.

## Puesta en marcha

### 1. Base de datos (Supabase)

1. Entra a tu proyecto en [supabase.com](https://supabase.com) → SQL Editor.
2. Pega el contenido COMPLETO de `supabase/schema.sql` y ejecútalo UNA sola vez (si lo ejecutas dos veces, el seed de ejercicios se duplica).
3. Ve a Database → Extensions y verifica que `pg_cron` esté activada (el script la crea, pero si falla actívala ahí y vuelve a ejecutar solo el bloque de `cron.schedule`).
4. Ve a Storage y verifica que existan los buckets `avatars` (público) y `progress-photos` (privado). El script los crea; si tu proyecto no lo permite por SQL, créalos a mano con esos nombres exactos y esa visibilidad.
5. Si quieres login con Google: Authentication → Providers → Google, y configura el OAuth client. Es opcional, el login con email y contraseña funciona sin nada extra.
6. Recomendado para probar rápido: Authentication → Providers → Email → desactiva "Confirm email" (si lo dejas activo, cada cuenta nueva debe confirmar por correo antes de entrar).

### 2. Variables de entorno

Copia `.env.example` a `.env` y completa:

```
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_ANON_KEY
```

Ambos valores están en Supabase → Settings → API.

### 3. Local

```
npm install
npm run dev
```

Abre http://localhost:5173, crea una cuenta y completa el onboarding.

### 4. Netlify

1. El repo ya incluye `netlify.toml` (build `npm run build`, publish `dist`, redirect SPA).
2. En Netlify → Site settings → Environment variables agrega `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
3. Haz deploy de la rama. Listo: la app queda instalable como PWA desde el navegador del teléfono.

## Cómo probar las funcionalidades principales

- **Crear cuenta**: pantalla inicial → Crear cuenta → onboarding (nombre, meta, días por semana, plantilla de rutina, grupo).
- **Crear grupo**: en el onboarding, o en Squad → Grupos → Crear grupo. Comparte el código de 6 caracteres por WhatsApp con el botón Invitar.
- **Registrar entreno**: Entrenar → elige el día de tu rutina → Agregar serie (teclado numérico, peso × reps × RPE) → el cronómetro de descanso arranca solo → Terminar → resumen con tarjeta compartible. Si superas tu mejor peso en un ejercicio: confeti y vibración.
- **Registrar carrera**: Inicio → Registrar carrera → tipo, distancia, tiempo mm:ss (el pace se calcula solo), nombre de ruta opcional. El básquet se registra solo con duración.
- **Ver ranking**: Squad → Ranking → pestañas Gym / Running / Constancia y Semana / Mes, con podio animado para el top 3.
- **Duelos**: Squad → Duelos → Retar a un duelo. El rival acepta y ambos ven la barra comparativa; al vencer se publica el ganador en el feed.
- **Medallas**: se otorgan automáticamente el día 1 a las 6:00 AM (hora RD). Respaldo manual: Perfil → Otorgar medallas del mes pasado. El día 1, al abrir la app, aparece la pantalla de cierre de mes estilo Wrapped.
- **Offline**: activa modo avión en el gym; las series se guardan localmente y se sincronizan al volver la señal (verás el contador de pendientes sobre la barra de pestañas).
- **Migración**: Perfil → Importar respaldo de Gym Progress AI (JSON con `{version, sessions[], exercises[], routines[]}`).

## Estructura

- `supabase/schema.sql`: esquema completo (tablas, RLS, vistas, funciones security definer, `award_monthly_medals`, pg_cron, buckets, seed de 60 ejercicios).
- `src/lib`: utilidades (unidades, pace, Epley, offline, plantillas, medallas, compartir, respaldos).
- `src/pages`: una página por pantalla del tab bar + sesión en vivo, rutinas, carrera, wrapped.
- `src/components`: componentes pequeños reutilizables (anillos, podio, feed, duelos, gráficas...).
