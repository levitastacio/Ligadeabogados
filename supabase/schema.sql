-- ============================================================
-- GYM SQUAD - Esquema completo de base de datos (Supabase)
-- Pegar COMPLETO una sola vez en el SQL Editor de Supabase.
-- Incluye: tablas, RLS, vistas, funciones security definer,
-- award_monthly_medals, pg_cron, buckets de Storage y seed
-- de 60 ejercicios.
-- ============================================================

create extension if not exists pgcrypto;

-- ============ PERFILES ============
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null,
  display_name text not null,
  avatar_url text,
  goal text not null default 'masa' check (goal in ('masa','grasa','fuerza','resistencia','recomposicion')),
  body_weight numeric,
  unit text not null default 'lb' check (unit in ('lb','kg')),
  weekly_target int not null default 4,
  monthly_target int not null default 16,
  streak_pardon_used_month text,
  created_at timestamptz default now()
);

-- ============ GRUPOS (ligas de amigos) ============
create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null,
  owner_id uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists group_members (
  group_id uuid references groups(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
);

-- ============ EJERCICIOS (biblioteca compartida) ============
create table if not exists exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  muscle text not null,
  video_url text,
  created_by uuid references profiles(id),
  is_global boolean default true,
  created_at timestamptz default now()
);

-- ============ RUTINAS ============
create table if not exists routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  name text not null,
  is_active boolean default false,
  created_at timestamptz default now()
);

create table if not exists routine_days (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid references routines(id) on delete cascade,
  name text not null,
  emoji text default '💪',
  color text default '#0A84FF',
  muscles text[] not null default '{}',
  sort_order int not null default 0
);

create table if not exists routine_day_exercises (
  id uuid primary key default gen_random_uuid(),
  day_id uuid references routine_days(id) on delete cascade,
  exercise_id uuid references exercises(id),
  target_sets int default 3,
  target_reps text default '8-12',
  rest_seconds int default 90,
  sort_order int not null default 0
);

-- ============ SESIONES DE GYM ============
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  date date not null default current_date,
  day_name text,
  partner_id uuid references profiles(id),
  mood int check (mood between 1 and 5),
  sleep_quality int check (sleep_quality between 1 and 5),
  note text,
  created_at timestamptz default now()
);

create table if not exists sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  exercise_id uuid references exercises(id),
  weight numeric not null,
  unit text not null default 'lb',
  reps int not null,
  rpe numeric,
  note text,
  is_pr boolean default false,
  created_at timestamptz default now()
);

-- ============ CARDIO / RUNNING (estilo Strava) ============
create table if not exists runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  date date not null default current_date,
  activity text not null default 'correr' check (activity in ('correr','bici','caminata','basquet','otro')),
  distance_km numeric,
  duration_seconds int not null,
  avg_pace_seconds int,
  elevation_m numeric,
  note text,
  route_name text,
  is_race boolean default false,
  created_at timestamptz default now()
);

-- ============ PESO CORPORAL Y MEDIDAS ============
create table if not exists body_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  date date not null default current_date,
  weight numeric,
  arm_cm numeric,
  waist_cm numeric,
  chest_cm numeric,
  photo_url text
);

-- ============ MEDALLAS ============
create table if not exists medals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  group_id uuid references groups(id),
  month text not null,
  code text not null,
  rank int,
  value numeric,
  awarded_at timestamptz default now()
);
create unique index if not exists medals_unique_idx
  on medals (user_id, month, code, coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ============ DUELOS 1v1 ============
create table if not exists duels (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid references profiles(id),
  opponent_id uuid references profiles(id),
  metric text not null check (metric in ('volumen_total','volumen_musculo','dias','km')),
  muscle text,
  starts_on date not null,
  ends_on date not null,
  status text default 'pendiente' check (status in ('pendiente','activo','terminado','rechazado')),
  winner_id uuid references profiles(id),
  created_at timestamptz default now()
);

-- ============ FEED Y REACCIONES ============
create table if not exists feed_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  group_id uuid references groups(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz default now()
);

create table if not exists reactions (
  event_id uuid references feed_events(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  emoji text not null default '🔥',
  primary key (event_id, user_id)
);

-- ============ METAS MENSUALES ============
create table if not exists monthly_goals (
  user_id uuid references profiles(id) on delete cascade,
  month text not null,
  target_days int not null,
  target_km numeric,
  primary key (user_id, month)
);

-- ============================================================
-- FUNCIONES AUXILIARES (security definer, evitan recursion RLS)
-- ============================================================

create or replace function is_group_member(gid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

create or replace function shares_group_with(other uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select other = auth.uid() or exists (
    select 1
    from group_members a
    join group_members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

create or replace function username_available(p_username text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select not exists (
    select 1 from profiles where lower(username) = lower(p_username)
  );
$$;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Deteccion automatica de PR: al insertar una serie, si el peso
-- (convertido a kg) supera el maximo historico del usuario en ese
-- ejercicio, se marca is_pr = true.
create or replace function detect_pr()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_kg numeric;
  v_max numeric;
begin
  select user_id into v_user from sessions where id = new.session_id;
  v_kg := case when new.unit = 'lb' then new.weight * 0.45359237 else new.weight end;
  select max(case when st.unit = 'lb' then st.weight * 0.45359237 else st.weight end)
    into v_max
  from sets st
  join sessions s on s.id = st.session_id
  where s.user_id = v_user
    and st.exercise_id = new.exercise_id
    and st.id <> new.id;
  if v_max is null or v_kg > v_max then
    new.is_pr := true;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_detect_pr on sets;
create trigger trg_detect_pr
  before insert on sets
  for each row execute function detect_pr();

-- Calcula el pace automaticamente si no viene del cliente
create or replace function compute_pace()
returns trigger
language plpgsql
as $$
begin
  if new.distance_km is not null and new.distance_km > 0 and new.avg_pace_seconds is null then
    new.avg_pace_seconds := round(new.duration_seconds / new.distance_km);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_compute_pace on runs;
create trigger trg_compute_pace
  before insert or update on runs
  for each row execute function compute_pace();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table profiles enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table exercises enable row level security;
alter table routines enable row level security;
alter table routine_days enable row level security;
alter table routine_day_exercises enable row level security;
alter table sessions enable row level security;
alter table sets enable row level security;
alter table runs enable row level security;
alter table body_logs enable row level security;
alter table medals enable row level security;
alter table duels enable row level security;
alter table feed_events enable row level security;
alter table reactions enable row level security;
alter table monthly_goals enable row level security;

-- profiles: lectura para quien comparta grupo (o uno mismo); escritura solo el dueño
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select
  using (shares_group_with(id));
drop policy if exists profiles_insert on profiles;
create policy profiles_insert on profiles for insert
  with check (id = auth.uid());
drop policy if exists profiles_update on profiles;
create policy profiles_update on profiles for update
  using (id = auth.uid());

-- groups: lectura para autenticados (necesario para unirse por codigo);
-- crear cualquiera; modificar solo el dueño
drop policy if exists groups_select on groups;
create policy groups_select on groups for select
  using (auth.uid() is not null);
drop policy if exists groups_insert on groups;
create policy groups_insert on groups for insert
  with check (owner_id = auth.uid());
drop policy if exists groups_update on groups;
create policy groups_update on groups for update
  using (owner_id = auth.uid());
drop policy if exists groups_delete on groups;
create policy groups_delete on groups for delete
  using (owner_id = auth.uid());

-- group_members: ver miembros de mis grupos; unirme yo mismo; salirme yo o el dueño
drop policy if exists group_members_select on group_members;
create policy group_members_select on group_members for select
  using (is_group_member(group_id));
drop policy if exists group_members_insert on group_members;
create policy group_members_insert on group_members for insert
  with check (user_id = auth.uid());
drop policy if exists group_members_delete on group_members;
create policy group_members_delete on group_members for delete
  using (user_id = auth.uid() or exists (select 1 from groups g where g.id = group_id and g.owner_id = auth.uid()));

-- exercises: globales visibles para todos, propios para el creador
drop policy if exists exercises_select on exercises;
create policy exercises_select on exercises for select
  using (is_global = true or created_by = auth.uid());
drop policy if exists exercises_insert on exercises;
create policy exercises_insert on exercises for insert
  with check (created_by = auth.uid());
drop policy if exists exercises_update on exercises;
create policy exercises_update on exercises for update
  using (created_by = auth.uid());
drop policy if exists exercises_delete on exercises;
create policy exercises_delete on exercises for delete
  using (created_by = auth.uid());

-- routines y derivadas: CRUD solo el dueño
drop policy if exists routines_all on routines;
create policy routines_all on routines for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists routine_days_all on routine_days;
create policy routine_days_all on routine_days for all
  using (exists (select 1 from routines r where r.id = routine_id and r.user_id = auth.uid()))
  with check (exists (select 1 from routines r where r.id = routine_id and r.user_id = auth.uid()));
drop policy if exists routine_day_exercises_all on routine_day_exercises;
create policy routine_day_exercises_all on routine_day_exercises for all
  using (exists (
    select 1 from routine_days d join routines r on r.id = d.routine_id
    where d.id = day_id and r.user_id = auth.uid()))
  with check (exists (
    select 1 from routine_days d join routines r on r.id = d.routine_id
    where d.id = day_id and r.user_id = auth.uid()));

-- sessions, sets, runs, body_logs, monthly_goals: solo el dueño
drop policy if exists sessions_all on sessions;
create policy sessions_all on sessions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists sets_all on sets;
create policy sets_all on sets for all
  using (exists (select 1 from sessions s where s.id = session_id and s.user_id = auth.uid()))
  with check (exists (select 1 from sessions s where s.id = session_id and s.user_id = auth.uid()));
drop policy if exists runs_all on runs;
create policy runs_all on runs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists body_logs_all on body_logs;
create policy body_logs_all on body_logs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists monthly_goals_all on monthly_goals;
create policy monthly_goals_all on monthly_goals for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- medals: el dueño y sus compañeros de grupo pueden verlas
drop policy if exists medals_select on medals;
create policy medals_select on medals for select
  using (shares_group_with(user_id));

-- duels: visibles para participantes y compañeros de grupo
drop policy if exists duels_select on duels;
create policy duels_select on duels for select
  using (challenger_id = auth.uid() or opponent_id = auth.uid()
         or shares_group_with(challenger_id) or shares_group_with(opponent_id));
drop policy if exists duels_insert on duels;
create policy duels_insert on duels for insert
  with check (challenger_id = auth.uid());
drop policy if exists duels_update on duels;
create policy duels_update on duels for update
  using (challenger_id = auth.uid() or opponent_id = auth.uid());

-- feed_events: visibles e insertables por miembros del grupo
drop policy if exists feed_events_select on feed_events;
create policy feed_events_select on feed_events for select
  using (is_group_member(group_id));
drop policy if exists feed_events_insert on feed_events;
create policy feed_events_insert on feed_events for insert
  with check (user_id = auth.uid() and is_group_member(group_id));
drop policy if exists feed_events_delete on feed_events;
create policy feed_events_delete on feed_events for delete
  using (user_id = auth.uid());

-- reactions: miembros del grupo del evento
drop policy if exists reactions_select on reactions;
create policy reactions_select on reactions for select
  using (exists (select 1 from feed_events fe where fe.id = event_id and is_group_member(fe.group_id)));
drop policy if exists reactions_insert on reactions;
create policy reactions_insert on reactions for insert
  with check (user_id = auth.uid()
    and exists (select 1 from feed_events fe where fe.id = event_id and is_group_member(fe.group_id)));
drop policy if exists reactions_delete on reactions;
create policy reactions_delete on reactions for delete
  using (user_id = auth.uid());

-- ============================================================
-- VISTAS DE AGREGADOS (sin acceso directo para clientes;
-- se consumen via funciones security definer)
-- ============================================================

create or replace view v_monthly_volume as
select s.user_id,
       to_char(s.date, 'YYYY-MM') as month,
       sum(case when st.unit = 'lb' then st.weight * 0.45359237 else st.weight end * st.reps) as volume_kg,
       count(distinct s.date) as days_trained
from sessions s
join sets st on st.session_id = s.id
group by 1, 2;

create or replace view v_monthly_running as
select user_id,
       to_char(date, 'YYYY-MM') as month,
       sum(distance_km) as km,
       sum(duration_seconds) as seconds,
       min(avg_pace_seconds) filter (where distance_km >= 1) as best_pace
from runs
where activity in ('correr','caminata','bici')
group by 1, 2;

revoke all on v_monthly_volume from anon, authenticated;
revoke all on v_monthly_running from anon, authenticated;

-- ============================================================
-- FUNCIONES DE RANKING Y AGREGADOS (security definer)
-- ============================================================

-- Ranking de un grupo en un rango de fechas.
create or replace function get_group_ranking_range(p_group_id uuid, p_from date, p_to date)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  volume_kg numeric,
  days int,
  km numeric,
  prs_count int,
  best_pace int,
  activities int
)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not exists (select 1 from group_members gm where gm.group_id = p_group_id and gm.user_id = auth.uid()) then
    raise exception 'No eres miembro de este grupo';
  end if;

  return query
  select p.id,
         p.display_name,
         p.avatar_url,
         coalesce(vol.volume_kg, 0)::numeric,
         coalesce(act.days, 0)::int,
         coalesce(run.km, 0)::numeric,
         coalesce(vol.prs, 0)::int,
         run.best_pace::int,
         coalesce(run.activities, 0)::int
  from group_members gm
  join profiles p on p.id = gm.user_id
  left join lateral (
    select sum(case when st.unit = 'lb' then st.weight * 0.45359237 else st.weight end * st.reps) as volume_kg,
           count(*) filter (where st.is_pr) as prs
    from sessions s join sets st on st.session_id = s.id
    where s.user_id = p.id and s.date between p_from and p_to
  ) vol on true
  left join lateral (
    select sum(r.distance_km) as km,
           min(r.avg_pace_seconds) filter (where r.distance_km >= 5) as best_pace,
           count(*) as activities
    from runs r
    where r.user_id = p.id and r.date between p_from and p_to
      and r.activity in ('correr','caminata','bici')
  ) run on true
  left join lateral (
    select count(distinct d) as days from (
      select s.date as d from sessions s where s.user_id = p.id and s.date between p_from and p_to
      union
      select r.date as d from runs r where r.user_id = p.id and r.date between p_from and p_to
    ) x
  ) act on true
  where gm.group_id = p_group_id;
end;
$$;

-- Ranking mensual (envuelve la version por rango).
create or replace function get_group_ranking(p_group_id uuid, p_month text)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  volume_kg numeric,
  days int,
  km numeric,
  prs_count int,
  best_pace int,
  activities int
)
language sql stable security definer
set search_path = public
as $$
  select * from get_group_ranking_range(
    p_group_id,
    to_date(p_month || '-01', 'YYYY-MM-DD'),
    (to_date(p_month || '-01', 'YYYY-MM-DD') + interval '1 month' - interval '1 day')::date
  );
$$;

-- Totales del squad para la tarjeta "Este mes el squad levanto X toneladas"
create or replace function get_group_totals(p_group_id uuid, p_month text)
returns table (volume_kg numeric, km numeric, days int, prs int)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not exists (select 1 from group_members gm where gm.group_id = p_group_id and gm.user_id = auth.uid()) then
    raise exception 'No eres miembro de este grupo';
  end if;

  return query
  select coalesce(sum(r.volume_kg), 0)::numeric,
         coalesce(sum(r.km), 0)::numeric,
         coalesce(sum(r.days), 0)::int,
         coalesce(sum(r.prs_count), 0)::int
  from get_group_ranking(p_group_id, p_month) r;
end;
$$;

-- Leaderboard de una ruta nombrada (segmento simplificado estilo Strava)
create or replace function get_route_leaderboard(p_group_id uuid, p_route text)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  best_seconds int,
  distance_km numeric,
  best_pace int,
  run_date date
)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not exists (select 1 from group_members gm where gm.group_id = p_group_id and gm.user_id = auth.uid()) then
    raise exception 'No eres miembro de este grupo';
  end if;

  return query
  select distinct on (r.user_id)
         r.user_id,
         p.display_name,
         p.avatar_url,
         r.duration_seconds,
         r.distance_km,
         r.avg_pace_seconds,
         r.date
  from runs r
  join profiles p on p.id = r.user_id
  join group_members gm on gm.user_id = r.user_id and gm.group_id = p_group_id
  where lower(trim(r.route_name)) = lower(trim(p_route))
  order by r.user_id, r.duration_seconds asc;
end;
$$;

-- Rutas nombradas del grupo (para listar segmentos)
create or replace function get_group_routes(p_group_id uuid)
returns table (route_name text, runs_count int, runners int)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not exists (select 1 from group_members gm where gm.group_id = p_group_id and gm.user_id = auth.uid()) then
    raise exception 'No eres miembro de este grupo';
  end if;

  return query
  select min(r.route_name) as route_name,
         count(*)::int,
         count(distinct r.user_id)::int
  from runs r
  join group_members gm on gm.user_id = r.user_id and gm.group_id = p_group_id
  where r.route_name is not null and trim(r.route_name) <> ''
  group by lower(trim(r.route_name))
  order by count(*) desc;
end;
$$;

-- Progreso de un duelo: valor de cada participante segun la metrica
create or replace function get_duel_progress(p_duel_id uuid)
returns table (challenger_value numeric, opponent_value numeric)
language plpgsql stable security definer
set search_path = public
as $$
declare
  d record;
begin
  select * into d from duels where id = p_duel_id;
  if d is null then
    raise exception 'Duelo no encontrado';
  end if;
  if auth.uid() <> d.challenger_id and auth.uid() <> d.opponent_id
     and not shares_group_with(d.challenger_id) and not shares_group_with(d.opponent_id) then
    raise exception 'Sin acceso a este duelo';
  end if;

  return query
  select duel_metric_value(d.challenger_id, d.metric, d.muscle, d.starts_on, d.ends_on),
         duel_metric_value(d.opponent_id, d.metric, d.muscle, d.starts_on, d.ends_on);
end;
$$;

create or replace function duel_metric_value(p_user uuid, p_metric text, p_muscle text, p_from date, p_to date)
returns numeric
language plpgsql stable security definer
set search_path = public
as $$
declare
  v numeric := 0;
begin
  if p_metric = 'volumen_total' then
    select coalesce(sum(case when st.unit = 'lb' then st.weight * 0.45359237 else st.weight end * st.reps), 0)
      into v
    from sessions s join sets st on st.session_id = s.id
    where s.user_id = p_user and s.date between p_from and p_to;
  elsif p_metric = 'volumen_musculo' then
    select coalesce(sum(case when st.unit = 'lb' then st.weight * 0.45359237 else st.weight end * st.reps), 0)
      into v
    from sessions s
    join sets st on st.session_id = s.id
    join exercises e on e.id = st.exercise_id
    where s.user_id = p_user and s.date between p_from and p_to and e.muscle = p_muscle;
  elsif p_metric = 'dias' then
    select count(distinct dd) into v from (
      select s.date as dd from sessions s where s.user_id = p_user and s.date between p_from and p_to
      union
      select r.date as dd from runs r where r.user_id = p_user and r.date between p_from and p_to
    ) x;
  elsif p_metric = 'km' then
    select coalesce(sum(r.distance_km), 0) into v
    from runs r
    where r.user_id = p_user and r.date between p_from and p_to
      and r.activity in ('correr','caminata','bici');
  end if;
  return coalesce(v, 0);
end;
$$;

-- ============================================================
-- MEDALLAS MENSUALES: award_monthly_medals(month 'YYYY-MM')
-- Calcula medallas de competencia (por grupo, rank 1-3) y de
-- superacion personal. Idempotente: reejecutar no duplica.
-- ============================================================

create or replace function longest_streak_in_month(p_user uuid, p_month text)
returns int
language sql stable security definer
set search_path = public
as $$
  with dates as (
    select distinct d from (
      select s.date as d from sessions s
      where s.user_id = p_user and to_char(s.date, 'YYYY-MM') = p_month
      union
      select r.date as d from runs r
      where r.user_id = p_user and to_char(r.date, 'YYYY-MM') = p_month
    ) x
  ),
  islands as (
    select d, d - (row_number() over (order by d))::int as grp from dates
  )
  select coalesce(max(cnt), 0)::int from (
    select count(*) as cnt from islands group by grp
  ) y;
$$;

create or replace function award_monthly_medals(p_month text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_prev text;
  g record;
  u record;
  m record;
begin
  v_prev := to_char(to_date(p_month || '-01', 'YYYY-MM-DD') - interval '1 month', 'YYYY-MM');

  -- ===== MEDALLAS DE COMPETENCIA (por grupo, rank 1/2/3) =====
  for g in select id from groups loop

    -- vol: Rey del volumen
    insert into medals (user_id, group_id, month, code, rank, value)
    select r.user_id, g.id, p_month, 'vol', row_number() over (order by r.volume_kg desc), r.volume_kg
    from (
      select vm.user_id, vm.volume_kg
      from v_monthly_volume vm
      join group_members gm on gm.user_id = vm.user_id and gm.group_id = g.id
      where vm.month = p_month and vm.volume_kg > 0
    ) r
    order by r.volume_kg desc
    limit 3
    on conflict do nothing;

    -- dias: El mas constante (dias activos: gym + cardio)
    insert into medals (user_id, group_id, month, code, rank, value)
    select r.user_id, g.id, p_month, 'dias', row_number() over (order by r.days desc), r.days
    from (
      select gm.user_id, count(distinct dd) as days
      from group_members gm
      join lateral (
        select s.date as dd from sessions s where s.user_id = gm.user_id and to_char(s.date,'YYYY-MM') = p_month
        union
        select rr.date as dd from runs rr where rr.user_id = gm.user_id and to_char(rr.date,'YYYY-MM') = p_month
      ) act on true
      where gm.group_id = g.id
      group by gm.user_id
      having count(distinct dd) > 0
    ) r
    order by r.days desc
    limit 3
    on conflict do nothing;

    -- prs: Rompe-records
    insert into medals (user_id, group_id, month, code, rank, value)
    select r.user_id, g.id, p_month, 'prs', row_number() over (order by r.prs desc), r.prs
    from (
      select s.user_id, count(*) as prs
      from sessions s
      join sets st on st.session_id = s.id and st.is_pr
      join group_members gm on gm.user_id = s.user_id and gm.group_id = g.id
      where to_char(s.date, 'YYYY-MM') = p_month
      group by s.user_id
      having count(*) > 0
    ) r
    order by r.prs desc
    limit 3
    on conflict do nothing;

    -- km: Rey de la ruta
    insert into medals (user_id, group_id, month, code, rank, value)
    select r.user_id, g.id, p_month, 'km', row_number() over (order by r.km desc), r.km
    from (
      select vr.user_id, vr.km
      from v_monthly_running vr
      join group_members gm on gm.user_id = vr.user_id and gm.group_id = g.id
      where vr.month = p_month and vr.km > 0
    ) r
    order by r.km desc
    limit 3
    on conflict do nothing;

    -- pace: El mas rapido (mejor pace en carreras de 5km o mas)
    insert into medals (user_id, group_id, month, code, rank, value)
    select r.user_id, g.id, p_month, 'pace', row_number() over (order by r.pace asc), r.pace
    from (
      select rr.user_id, min(rr.avg_pace_seconds) as pace
      from runs rr
      join group_members gm on gm.user_id = rr.user_id and gm.group_id = g.id
      where to_char(rr.date, 'YYYY-MM') = p_month
        and rr.activity = 'correr' and rr.distance_km >= 5 and rr.avg_pace_seconds is not null
      group by rr.user_id
    ) r
    order by r.pace asc
    limit 3
    on conflict do nothing;

    -- relativo: Fuerza relativa (volumen / peso corporal en kg, solo con peso registrado)
    insert into medals (user_id, group_id, month, code, rank, value)
    select r.user_id, g.id, p_month, 'relativo', row_number() over (order by r.rel desc), round(r.rel, 1)
    from (
      select vm.user_id,
             vm.volume_kg / (case when p.unit = 'lb' then p.body_weight * 0.45359237 else p.body_weight end) as rel
      from v_monthly_volume vm
      join profiles p on p.id = vm.user_id and p.body_weight is not null and p.body_weight > 0
      join group_members gm on gm.user_id = vm.user_id and gm.group_id = g.id
      where vm.month = p_month and vm.volume_kg > 0
    ) r
    order by r.rel desc
    limit 3
    on conflict do nothing;

    -- Publicar en el feed del grupo las medallas de oro recien otorgadas
    insert into feed_events (user_id, group_id, type, payload)
    select m.user_id, g.id, 'medalla',
           jsonb_build_object('code', m.code, 'rank', m.rank, 'value', m.value, 'month', p_month)
    from medals m
    where m.group_id = g.id and m.month = p_month and m.rank = 1
      and not exists (
        select 1 from feed_events fe
        where fe.group_id = g.id
          and fe.type = 'medalla'
          and fe.user_id = m.user_id
          and fe.payload->>'code' = m.code
          and fe.payload->>'month' = p_month
      );

  end loop;

  -- ===== MEDALLAS DE SUPERACION PERSONAL (group_id null) =====
  for u in select id from profiles loop

    -- mejor_mes: superaste tu volumen del mes anterior
    insert into medals (user_id, group_id, month, code, value)
    select u.id, null, p_month, 'mejor_mes', cur.volume_kg
    from v_monthly_volume cur
    join v_monthly_volume prev on prev.user_id = u.id and prev.month = v_prev
    where cur.user_id = u.id and cur.month = p_month
      and prev.volume_kg > 0 and cur.volume_kg > prev.volume_kg
    on conflict do nothing;

    -- mas_constante: mas dias que el mes pasado
    insert into medals (user_id, group_id, month, code, value)
    select u.id, null, p_month, 'mas_constante', cur.days_trained
    from v_monthly_volume cur
    join v_monthly_volume prev on prev.user_id = u.id and prev.month = v_prev
    where cur.user_id = u.id and cur.month = p_month
      and cur.days_trained > prev.days_trained
    on conflict do nothing;

    -- superacion_prs: 3 o mas records personales en el mes
    insert into medals (user_id, group_id, month, code, value)
    select u.id, null, p_month, 'superacion_prs', count(*)
    from sessions s join sets st on st.session_id = s.id and st.is_pr
    where s.user_id = u.id and to_char(s.date, 'YYYY-MM') = p_month
    having count(*) >= 3
    on conflict do nothing;

    -- cumplidor: 90%+ de la meta mensual de dias
    insert into medals (user_id, group_id, month, code, value)
    select u.id, null, p_month, 'cumplidor', act.days
    from (
      select count(distinct dd) as days from (
        select s.date as dd from sessions s where s.user_id = u.id and to_char(s.date,'YYYY-MM') = p_month
        union
        select r.date as dd from runs r where r.user_id = u.id and to_char(r.date,'YYYY-MM') = p_month
      ) x
    ) act,
    lateral (
      select coalesce(
        (select mg.target_days from monthly_goals mg where mg.user_id = u.id and mg.month = p_month),
        (select p.monthly_target from profiles p where p.id = u.id)
      ) as target
    ) t
    where t.target > 0 and act.days >= ceil(t.target * 0.9)
    on conflict do nothing;

    -- corredor: mas km que el mes anterior
    insert into medals (user_id, group_id, month, code, value)
    select u.id, null, p_month, 'corredor', cur.km
    from v_monthly_running cur
    join v_monthly_running prev on prev.user_id = u.id and prev.month = v_prev
    where cur.user_id = u.id and cur.month = p_month
      and prev.km > 0 and cur.km > prev.km
    on conflict do nothing;

    -- pace_propio: mejoraste tu mejor pace del mes anterior
    insert into medals (user_id, group_id, month, code, value)
    select u.id, null, p_month, 'pace_propio', cur.best_pace
    from v_monthly_running cur
    join v_monthly_running prev on prev.user_id = u.id and prev.month = v_prev
    where cur.user_id = u.id and cur.month = p_month
      and prev.best_pace is not null and cur.best_pace is not null
      and cur.best_pace < prev.best_pace
    on conflict do nothing;

    -- racha: Racha de hierro (14+ dias consecutivos activos)
    insert into medals (user_id, group_id, month, code, value)
    select u.id, null, p_month, 'racha', longest_streak_in_month(u.id, p_month)
    where longest_streak_in_month(u.id, p_month) >= 14
    on conflict do nothing;

  end loop;
end;
$$;

-- ============================================================
-- pg_cron: otorgar medallas el dia 1 de cada mes a las 6:00 AM
-- hora RD (UTC-4 = 10:00 UTC), sobre el mes que acaba de cerrar.
-- Requiere activar la extension pg_cron en Database > Extensions.
-- ============================================================

create extension if not exists pg_cron;

select cron.schedule(
  'award-monthly-medals',
  '0 10 1 * *',
  $$select award_monthly_medals(to_char((now() at time zone 'America/Santo_Domingo') - interval '1 day', 'YYYY-MM'))$$
);

-- ============================================================
-- STORAGE: buckets avatars (publico) y progress-photos (privado)
-- ============================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', false)
on conflict (id) do nothing;

drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects for select
  using (bucket_id = 'avatars');
drop policy if exists avatars_write on storage.objects;
create policy avatars_write on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects for delete
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists progress_photos_read on storage.objects;
create policy progress_photos_read on storage.objects for select
  using (bucket_id = 'progress-photos' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists progress_photos_write on storage.objects;
create policy progress_photos_write on storage.objects for insert
  with check (bucket_id = 'progress-photos' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists progress_photos_delete on storage.objects;
create policy progress_photos_delete on storage.objects for delete
  using (bucket_id = 'progress-photos' and auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- SEED: biblioteca de 60 ejercicios con musculo y video de tecnica
-- ============================================================

insert into exercises (name, muscle, video_url, is_global) values
-- PECHO (8)
('Press banca con barra', 'pecho', 'https://www.youtube.com/results?search_query=press+banca+barra+tecnica', true),
('Press inclinado con mancuernas', 'pecho', 'https://www.youtube.com/results?search_query=press+inclinado+mancuernas+tecnica', true),
('Press plano con mancuernas', 'pecho', 'https://www.youtube.com/results?search_query=press+plano+mancuernas+tecnica', true),
('Press de pecho en maquina', 'pecho', 'https://www.youtube.com/results?search_query=press+pecho+maquina+tecnica', true),
('Aperturas con mancuernas', 'pecho', 'https://www.youtube.com/results?search_query=aperturas+mancuernas+tecnica', true),
('Cruce de poleas', 'pecho', 'https://www.youtube.com/results?search_query=cruce+de+poleas+tecnica', true),
('Fondos en paralelas', 'pecho', 'https://www.youtube.com/results?search_query=fondos+en+paralelas+tecnica', true),
('Flexiones', 'pecho', 'https://www.youtube.com/results?search_query=flexiones+tecnica+correcta', true),
-- ESPALDA (9)
('Dominadas', 'espalda', 'https://www.youtube.com/results?search_query=dominadas+tecnica+correcta', true),
('Jalon al pecho', 'espalda', 'https://www.youtube.com/results?search_query=jalon+al+pecho+tecnica', true),
('Remo con barra', 'espalda', 'https://www.youtube.com/results?search_query=remo+con+barra+tecnica', true),
('Remo con mancuerna a una mano', 'espalda', 'https://www.youtube.com/results?search_query=remo+mancuerna+una+mano+tecnica', true),
('Remo en maquina', 'espalda', 'https://www.youtube.com/results?search_query=remo+maquina+tecnica', true),
('Remo en polea baja', 'espalda', 'https://www.youtube.com/results?search_query=remo+polea+baja+tecnica', true),
('Pullover en polea', 'espalda', 'https://www.youtube.com/results?search_query=pullover+polea+tecnica', true),
('Peso muerto', 'espalda', 'https://www.youtube.com/results?search_query=peso+muerto+tecnica+correcta', true),
('Hiperextensiones', 'espalda', 'https://www.youtube.com/results?search_query=hiperextensiones+tecnica', true),
-- PIERNA (12)
('Sentadilla con barra', 'pierna', 'https://www.youtube.com/results?search_query=sentadilla+barra+tecnica', true),
('Sentadilla frontal', 'pierna', 'https://www.youtube.com/results?search_query=sentadilla+frontal+tecnica', true),
('Prensa de pierna', 'pierna', 'https://www.youtube.com/results?search_query=prensa+de+pierna+tecnica', true),
('Zancadas con mancuernas', 'pierna', 'https://www.youtube.com/results?search_query=zancadas+mancuernas+tecnica', true),
('Sentadilla bulgara', 'pierna', 'https://www.youtube.com/results?search_query=sentadilla+bulgara+tecnica', true),
('Extension de cuadriceps', 'pierna', 'https://www.youtube.com/results?search_query=extension+cuadriceps+maquina+tecnica', true),
('Curl femoral acostado', 'pierna', 'https://www.youtube.com/results?search_query=curl+femoral+acostado+tecnica', true),
('Curl femoral sentado', 'pierna', 'https://www.youtube.com/results?search_query=curl+femoral+sentado+tecnica', true),
('Peso muerto rumano', 'pierna', 'https://www.youtube.com/results?search_query=peso+muerto+rumano+tecnica', true),
('Hip thrust', 'pierna', 'https://www.youtube.com/results?search_query=hip+thrust+tecnica', true),
('Elevacion de talones de pie', 'pierna', 'https://www.youtube.com/results?search_query=elevacion+talones+de+pie+tecnica', true),
('Elevacion de talones sentado', 'pierna', 'https://www.youtube.com/results?search_query=elevacion+talones+sentado+tecnica', true),
-- HOMBRO (8)
('Press militar con barra', 'hombro', 'https://www.youtube.com/results?search_query=press+militar+barra+tecnica', true),
('Press de hombros con mancuernas', 'hombro', 'https://www.youtube.com/results?search_query=press+hombros+mancuernas+tecnica', true),
('Press Arnold', 'hombro', 'https://www.youtube.com/results?search_query=press+arnold+tecnica', true),
('Elevaciones laterales', 'hombro', 'https://www.youtube.com/results?search_query=elevaciones+laterales+tecnica', true),
('Elevaciones frontales', 'hombro', 'https://www.youtube.com/results?search_query=elevaciones+frontales+tecnica', true),
('Pajaros para hombro posterior', 'hombro', 'https://www.youtube.com/results?search_query=pajaros+hombro+posterior+tecnica', true),
('Face pull', 'hombro', 'https://www.youtube.com/results?search_query=face+pull+tecnica', true),
('Encogimientos con mancuernas', 'hombro', 'https://www.youtube.com/results?search_query=encogimientos+trapecio+mancuernas+tecnica', true),
-- BICEPS (6)
('Curl con barra', 'biceps', 'https://www.youtube.com/results?search_query=curl+biceps+barra+tecnica', true),
('Curl alterno con mancuernas', 'biceps', 'https://www.youtube.com/results?search_query=curl+alterno+mancuernas+tecnica', true),
('Curl martillo', 'biceps', 'https://www.youtube.com/results?search_query=curl+martillo+tecnica', true),
('Curl predicador', 'biceps', 'https://www.youtube.com/results?search_query=curl+predicador+tecnica', true),
('Curl en polea', 'biceps', 'https://www.youtube.com/results?search_query=curl+biceps+polea+tecnica', true),
('Curl concentrado', 'biceps', 'https://www.youtube.com/results?search_query=curl+concentrado+tecnica', true),
-- TRICEPS (6)
('Press frances', 'triceps', 'https://www.youtube.com/results?search_query=press+frances+tecnica', true),
('Extension de triceps en polea', 'triceps', 'https://www.youtube.com/results?search_query=extension+triceps+polea+tecnica', true),
('Extension con cuerda', 'triceps', 'https://www.youtube.com/results?search_query=extension+triceps+cuerda+tecnica', true),
('Fondos en banco', 'triceps', 'https://www.youtube.com/results?search_query=fondos+en+banco+triceps+tecnica', true),
('Press cerrado', 'triceps', 'https://www.youtube.com/results?search_query=press+banca+agarre+cerrado+tecnica', true),
('Patada de triceps', 'triceps', 'https://www.youtube.com/results?search_query=patada+de+triceps+tecnica', true),
-- ABDOMEN (7)
('Crunch abdominal', 'abdomen', 'https://www.youtube.com/results?search_query=crunch+abdominal+tecnica', true),
('Plancha', 'abdomen', 'https://www.youtube.com/results?search_query=plancha+abdominal+tecnica', true),
('Elevacion de piernas colgado', 'abdomen', 'https://www.youtube.com/results?search_query=elevacion+piernas+colgado+tecnica', true),
('Rueda abdominal', 'abdomen', 'https://www.youtube.com/results?search_query=rueda+abdominal+tecnica', true),
('Giro ruso', 'abdomen', 'https://www.youtube.com/results?search_query=giro+ruso+abdominal+tecnica', true),
('Crunch en polea', 'abdomen', 'https://www.youtube.com/results?search_query=crunch+polea+tecnica', true),
('Plancha lateral', 'abdomen', 'https://www.youtube.com/results?search_query=plancha+lateral+tecnica', true),
-- CARDIO (4)
('Correr en cinta', 'cardio', 'https://www.youtube.com/results?search_query=tecnica+correr+en+cinta', true),
('Bicicleta estatica', 'cardio', 'https://www.youtube.com/results?search_query=bicicleta+estatica+postura+correcta', true),
('Eliptica', 'cardio', 'https://www.youtube.com/results?search_query=eliptica+tecnica+correcta', true),
('Remo ergometro', 'cardio', 'https://www.youtube.com/results?search_query=remo+ergometro+tecnica', true);

-- ============================================================
-- FIN DEL ESQUEMA
-- ============================================================
