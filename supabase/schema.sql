-- ============================================================================
-- Cooperativa de Útiles Escolares · esquema para Supabase (PostgreSQL)
--
-- Ejecutar una sola vez en el SQL Editor de un proyecto NUEVO.
-- El script crea tablas, restricciones, funciones transaccionales, triggers,
-- políticas RLS y permisos. No incluye datos de prueba: la aplicación tiene
-- un modo demostración con datos ficticios guardados en el navegador.
--
-- Seguridad:
--   * El registro siempre crea un perfil con rol "estudiante".
--   * Solo presidencia puede asignar roles mediante la función asignar_rol().
--   * Las operaciones que mueven stock o cambian varios registros se hacen
--     con funciones SECURITY DEFINER que validan permisos y estado.
--   * La clave service_role nunca se usa en el cliente.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Secuencias para números legibles
-- ----------------------------------------------------------------------------
create sequence if not exists public.seq_util start 1;
create sequence if not exists public.seq_solicitud start 1;
create sequence if not exists public.seq_prestamo start 1;

-- ----------------------------------------------------------------------------
-- Perfiles
-- ----------------------------------------------------------------------------
create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null check (char_length(trim(nombre)) between 1 and 80),
  apellido text not null check (char_length(trim(apellido)) between 1 and 80),
  curso text not null check (
    curso = any (array[
      '1.º A', '1.º B',
      '2.º A', '2.º B',
      '3.º A', '3.º B',
      '4.º A', '4.º B',
      '5.º A', '5.º B',
      '6.º A', '6.º B'
    ]::text[])
  ),
  rol text not null default 'estudiante' check (
    rol = any (array[
      'estudiante',
      'presidente',
      'secretario',
      'tesorero',
      'comision_administracion',
      'comision_comunicacion',
      'comision_organizacion'
    ]::text[])
  ),
  email text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index perfiles_email_lower_idx on public.perfiles (lower(email));

-- ----------------------------------------------------------------------------
-- Catálogo de útiles
-- ----------------------------------------------------------------------------
create table public.utiles (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique default (
    'U-' || lpad(nextval('public.seq_util')::text, 3, '0')
  ),
  nombre text not null check (char_length(trim(nombre)) > 0),
  tipo text not null check (
    tipo = any (array['Escritura', 'Medición', 'Papel', 'Guardado', 'Manualidades']::text[])
  ),
  estado text not null default 'Disponible' check (
    estado = any (array['Disponible', 'Prestado', 'Atrasado', 'Dañado', 'En reparación']::text[])
  ),
  cantidad_total integer not null check (cantidad_total >= 1),
  cantidad_disponible integer not null check (cantidad_disponible >= 0),
  dueno_id uuid references public.perfiles (id) on delete set null,
  origen text not null default 'cooperativa' check (
    origen = any (array['cooperativa', 'donacion', 'intercambio']::text[])
  ),
  ubicacion text not null check (char_length(trim(ubicacion)) > 0),
  observaciones text not null default '',
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint utiles_stock_valido check (cantidad_disponible <= cantidad_total)
);

create index utiles_tipo_idx on public.utiles (tipo);
create index utiles_activo_idx on public.utiles (activo);

-- ----------------------------------------------------------------------------
-- Solicitudes de préstamo
-- ----------------------------------------------------------------------------
create table public.solicitudes (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique default (
    'S-' || lpad(nextval('public.seq_solicitud')::text, 4, '0')
  ),
  util_id uuid not null references public.utiles (id) on delete restrict,
  solicitante_id uuid not null references public.perfiles (id) on delete restrict,
  fecha_solicitud date not null default current_date,
  fecha_acordada date not null,
  motivo text not null default '',
  estado text not null default 'pendiente' check (
    estado = any (array['pendiente', 'aprobada', 'atendida', 'rechazada', 'cancelada']::text[])
  ),
  compromiso boolean not null default false,
  revisado_por uuid references public.perfiles (id) on delete set null,
  revisado_en timestamptz,
  nota_revision text not null default '',
  entregado_en timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint solicitudes_plazo_valido check (
    fecha_acordada >= fecha_solicitud
    and fecha_acordada <= fecha_solicitud + 7
  )
);

create index solicitudes_solicitante_idx on public.solicitudes (solicitante_id, created_at desc);
create index solicitudes_estado_idx on public.solicitudes (estado);
create unique index solicitudes_activa_uidx
  on public.solicitudes (util_id, solicitante_id)
  where estado in ('pendiente', 'aprobada');

-- ----------------------------------------------------------------------------
-- Préstamos
-- ----------------------------------------------------------------------------
create table public.prestamos (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique default (
    'P-' || lpad(nextval('public.seq_prestamo')::text, 4, '0')
  ),
  solicitud_id uuid not null unique references public.solicitudes (id) on delete restrict,
  util_id uuid not null references public.utiles (id) on delete restrict,
  estudiante_id uuid not null references public.perfiles (id) on delete restrict,
  fecha_entrega date not null default current_date,
  fecha_acordada date not null,
  fecha_devolucion_real date,
  estado text not null default 'prestado' check (
    estado = any (array['prestado', 'atrasado', 'devuelto', 'perdido']::text[])
  ),
  condicion text check (
    condicion is null
    or condicion = any (array['buen_estado', 'danado', 'en_reparacion', 'perdido', 'a_controlar']::text[])
  ),
  creado_por uuid references public.perfiles (id) on delete set null,
  controlado_por uuid references public.perfiles (id) on delete set null,
  controlado_en timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index prestamos_estudiante_idx on public.prestamos (estudiante_id, created_at desc);
create index prestamos_estado_idx on public.prestamos (estado);
create index prestamos_fecha_acordada_idx on public.prestamos (fecha_acordada);

-- ----------------------------------------------------------------------------
-- Reportes de daño o pérdida
-- ----------------------------------------------------------------------------
create table public.reportes (
  id uuid primary key default gen_random_uuid(),
  prestamo_id uuid not null references public.prestamos (id) on delete restrict,
  tipo text not null check (tipo = any (array['danado', 'perdido']::text[])),
  descripcion text not null check (char_length(trim(descripcion)) >= 10),
  estado text not null default 'pendiente' check (
    estado = any (array['pendiente', 'resuelto']::text[])
  ),
  reportado_por uuid not null default auth.uid() references public.perfiles (id) on delete restrict,
  resuelto_por uuid references public.perfiles (id) on delete set null,
  resuelto_en timestamptz,
  created_at timestamptz not null default now()
);

create index reportes_prestamo_idx on public.reportes (prestamo_id);
create index reportes_estado_idx on public.reportes (estado);

-- ----------------------------------------------------------------------------
-- Ofertas de útiles (donación o intercambio)
-- ----------------------------------------------------------------------------
create table public.ofertas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(trim(nombre)) > 0),
  tipo text not null check (
    tipo = any (array['Escritura', 'Medición', 'Papel', 'Guardado', 'Manualidades']::text[])
  ),
  modalidad text not null check (modalidad = any (array['donacion', 'intercambio']::text[])),
  descripcion text not null check (char_length(trim(descripcion)) >= 10),
  estado text not null default 'pendiente' check (
    estado = any (array['pendiente', 'aceptada', 'rechazada', 'cancelada']::text[])
  ),
  oferente_id uuid not null default auth.uid() references public.perfiles (id) on delete restrict,
  revisado_por uuid references public.perfiles (id) on delete set null,
  revisado_en timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ofertas_estado_idx on public.ofertas (estado);

-- ----------------------------------------------------------------------------
-- Avisos y acuerdos
-- ----------------------------------------------------------------------------
create table public.avisos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(trim(titulo)) > 0),
  contenido text not null check (char_length(trim(contenido)) >= 20),
  categoria text not null check (
    categoria = any (array[
      'Útiles disponibles',
      'Novedades',
      'Reuniones',
      'Recordatorios de devolución'
    ]::text[])
  ),
  autor_id uuid not null default auth.uid() references public.perfiles (id) on delete restrict,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index avisos_activo_idx on public.avisos (activo);

create table public.acuerdos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  tema text not null check (char_length(trim(tema)) > 0),
  decision text not null check (char_length(trim(decision)) >= 10),
  autor_id uuid not null default auth.uid() references public.perfiles (id) on delete restrict,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index acuerdos_activo_idx on public.acuerdos (activo);

-- ----------------------------------------------------------------------------
-- Votaciones y votos
-- ----------------------------------------------------------------------------
create table public.votaciones (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(trim(titulo)) > 0),
  descripcion text not null default '',
  opciones text[] not null check (array_length(opciones, 1) between 2 and 6),
  estado text not null default 'abierta' check (
    estado = any (array['abierta', 'cerrada']::text[])
  ),
  fecha_cierre date not null,
  creada_por uuid not null default auth.uid() references public.perfiles (id) on delete restrict,
  cerrada_en timestamptz,
  cerrada_por uuid references public.perfiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index votaciones_estado_idx on public.votaciones (estado);

create table public.votos (
  id uuid primary key default gen_random_uuid(),
  votacion_id uuid not null references public.votaciones (id) on delete cascade,
  usuario_id uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  opcion text not null,
  created_at timestamptz not null default now(),
  unique (votacion_id, usuario_id)
);

create index votos_votacion_idx on public.votos (votacion_id);

-- ----------------------------------------------------------------------------
-- Recursos / movimientos
-- ----------------------------------------------------------------------------
create table public.movimientos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  concepto text not null check (char_length(trim(concepto)) > 0),
  tipo text not null check (tipo = any (array['ingreso', 'egreso']::text[])),
  monto numeric(12, 2) not null check (monto > 0),
  registrado_por uuid not null default auth.uid() references public.perfiles (id) on delete restrict,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index movimientos_fecha_idx on public.movimientos (fecha desc);

-- ----------------------------------------------------------------------------
-- Actividades y tareas
-- ----------------------------------------------------------------------------
create table public.actividades (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(trim(titulo)) > 0),
  descripcion text not null default '',
  fecha_limite date not null,
  creada_por uuid not null default auth.uid() references public.perfiles (id) on delete restrict,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.tareas (
  id uuid primary key default gen_random_uuid(),
  actividad_id uuid not null references public.actividades (id) on delete restrict,
  titulo text not null check (char_length(trim(titulo)) > 0),
  descripcion text not null default '',
  asignado_id uuid not null references public.perfiles (id) on delete restrict,
  estado text not null default 'pendiente' check (
    estado = any (array['pendiente', 'en_curso', 'terminada']::text[])
  ),
  fecha_limite date not null,
  creada_por uuid not null default auth.uid() references public.perfiles (id) on delete restrict,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tareas_asignado_idx on public.tareas (asignado_id, estado);
create index tareas_actividad_idx on public.tareas (actividad_id);

-- ----------------------------------------------------------------------------
-- Encuestas de impacto
--
-- Solo se guardan respuestas propias. Las políticas permiten leer únicamente
-- las respuestas del usuario actual; los promedios se entregan por la función
-- estadisticas_cooperativa() solo a presidencia, sin exponer filas individuales.
-- ----------------------------------------------------------------------------
create table public.encuestas (
  id uuid primary key default gen_random_uuid(),
  curso text not null check (
    curso = any (array[
      '1.º A', '1.º B',
      '2.º A', '2.º B',
      '3.º A', '3.º B',
      '4.º A', '4.º B',
      '5.º A', '5.º B',
      '6.º A', '6.º B'
    ]::text[])
  ),
  momento text not null check (momento = any (array['antes', 'despues']::text[])),
  veces_sin_util integer not null check (veces_sin_util between 0 and 30),
  usuario_id uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  fecha date not null default current_date,
  created_at timestamptz not null default now(),
  unique (usuario_id, curso, momento)
);

create index encuestas_curso_idx on public.encuestas (curso, momento);

-- ============================================================================
-- Funciones auxiliares
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.rol_actual()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select rol
  from public.perfiles
  where id = auth.uid() and activo = true
  limit 1;
$$;

create or replace function public.es_presidente()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.rol_actual() = 'presidente', false);
$$;

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.rol_actual() = 'comision_administracion', false);
$$;

create or replace function public.es_secretario()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.rol_actual() = 'secretario', false);
$$;

create or replace function public.es_tesorero()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.rol_actual() = 'tesorero', false);
$$;

create or replace function public.es_comunicacion()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.rol_actual() = 'comision_comunicacion', false);
$$;

create or replace function public.es_organizacion()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.rol_actual() = 'comision_organizacion', false);
$$;

-- Indicador porcentual con N/A cuando el denominador es cero.
create or replace function public.indicador_kpi(p_parte bigint, p_total bigint)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'parte', coalesce(p_parte, 0),
    'total', coalesce(p_total, 0),
    'valor', case
      when coalesce(p_total, 0) = 0 then null
      else round((coalesce(p_parte, 0)::numeric / p_total) * 100, 1)
    end,
    'na', coalesce(p_total, 0) = 0
  );
$$;

-- ============================================================================
-- Registro: el perfil nace siempre como estudiante.
--
-- No se lee ningún rol desde raw_user_meta_data. Aunque alguien manipule el
-- formulario o la API de registro, el rol inicial siempre es "estudiante".
-- ============================================================================
create or replace function public.crear_perfil_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_nombre text;
  v_apellido text;
  v_curso text;
  v_email text;
begin
  v_nombre := left(coalesce(nullif(trim(v_meta ->> 'nombre'), ''), 'Sin nombre'), 80);
  v_apellido := left(coalesce(nullif(trim(v_meta ->> 'apellido'), ''), 'Sin apellido'), 80);
  v_curso := coalesce(nullif(trim(v_meta ->> 'curso'), ''), '1.º A');
  if v_curso <> all (array[
    '1.º A', '1.º B',
    '2.º A', '2.º B',
    '3.º A', '3.º B',
    '4.º A', '4.º B',
    '5.º A', '5.º B',
    '6.º A', '6.º B'
  ]::text[]) then
    v_curso := '1.º A';
  end if;
  v_email := lower(coalesce(new.email, ''));

  insert into public.perfiles (id, nombre, apellido, curso, rol, email, activo)
  values (new.id, v_nombre, v_apellido, v_curso, 'estudiante', v_email, true)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.crear_perfil_nuevo_usuario();

-- ============================================================================
-- Triggers de actualización y protección de columnas
-- ============================================================================
drop trigger if exists trg_perfiles_updated on public.perfiles;
create trigger trg_perfiles_updated before update on public.perfiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_utiles_updated on public.utiles;
create trigger trg_utiles_updated before update on public.utiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_solicitudes_updated on public.solicitudes;
create trigger trg_solicitudes_updated before update on public.solicitudes
  for each row execute function public.set_updated_at();

drop trigger if exists trg_prestamos_updated on public.prestamos;
create trigger trg_prestamos_updated before update on public.prestamos
  for each row execute function public.set_updated_at();

drop trigger if exists trg_ofertas_updated on public.ofertas;
create trigger trg_ofertas_updated before update on public.ofertas
  for each row execute function public.set_updated_at();

drop trigger if exists trg_avisos_updated on public.avisos;
create trigger trg_avisos_updated before update on public.avisos
  for each row execute function public.set_updated_at();

drop trigger if exists trg_acuerdos_updated on public.acuerdos;
create trigger trg_acuerdos_updated before update on public.acuerdos
  for each row execute function public.set_updated_at();

drop trigger if exists trg_movimientos_updated on public.movimientos;
create trigger trg_movimientos_updated before update on public.movimientos
  for each row execute function public.set_updated_at();

drop trigger if exists trg_tareas_updated on public.tareas;
create trigger trg_tareas_updated before update on public.tareas
  for each row execute function public.set_updated_at();

-- Un integrante solo puede cancelar su propia solicitud pendiente. Cualquier
-- otra modificación directa queda bloqueada; las transiciones de estado se
-- hacen con las funciones de la sección siguiente.
create or replace function public.proteger_solicitud()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.es_admin() then
    return new;
  end if;

  if auth.uid() = old.solicitante_id
     and old.estado = 'pendiente'
     and new.estado = 'cancelada'
     and (to_jsonb(new) - 'updated_at' - 'estado') =
         (to_jsonb(old) - 'updated_at' - 'estado') then
    return new;
  end if;

  raise exception 'Solo podés cancelar una solicitud pendiente propia.';
end;
$$;

drop trigger if exists trg_solicitudes_proteger on public.solicitudes;
create trigger trg_solicitudes_proteger before update on public.solicitudes
  for each row execute function public.proteger_solicitud();

-- Una oferta pendiente solo puede cancelarse por su autor. Administración
-- puede revisarla (aceptar/rechazar).
create or replace function public.proteger_oferta()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.es_admin() then
    return new;
  end if;

  if auth.uid() = old.oferente_id
     and old.estado = 'pendiente'
     and new.estado = 'cancelada'
     and (to_jsonb(new) - 'updated_at' - 'estado') =
         (to_jsonb(old) - 'updated_at' - 'estado') then
    return new;
  end if;

  raise exception 'Solo podés cancelar tus ofertas pendientes.';
end;
$$;

drop trigger if exists trg_ofertas_proteger on public.ofertas;
create trigger trg_ofertas_proteger before update on public.ofertas
  for each row execute function public.proteger_oferta();

-- La persona asignada puede actualizar el estado de su tarea, pero no cambiar
-- el título, la actividad, la persona asignada ni las fechas.
create or replace function public.proteger_tarea()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.es_organizacion() then
    return new;
  end if;

  if auth.uid() = old.asignado_id
     and (to_jsonb(new) - 'updated_at' - 'estado') =
         (to_jsonb(old) - 'updated_at' - 'estado') then
    return new;
  end if;

  raise exception 'Solo podés actualizar el estado de tus tareas asignadas.';
end;
$$;

drop trigger if exists trg_tareas_proteger on public.tareas;
create trigger trg_tareas_proteger before update on public.tareas
  for each row execute function public.proteger_tarea();

-- Evita modificar opciones de una votación que ya tiene votos y reabrir una
-- votación cerrada.
create or replace function public.proteger_votacion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.estado = 'cerrada' then
    raise exception 'La votación ya está cerrada.';
  end if;

  if new.opciones is distinct from old.opciones
     and exists (select 1 from public.votos where votacion_id = old.id) then
    raise exception 'No se pueden cambiar las opciones de una votación con votos registrados.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_votaciones_proteger on public.votaciones;
create trigger trg_votaciones_proteger before update on public.votaciones
  for each row execute function public.proteger_votacion();

-- ============================================================================
-- Flujos transaccionales
-- ============================================================================

-- Solicitud de préstamo: valida disponibilidad, plazo máximo de 7 días,
-- compromiso, autoría del útil y solicitudes activas duplicadas.
create or replace function public.solicitar_prestamo(
  p_util_id uuid,
  p_fecha_acordada date,
  p_motivo text default '',
  p_compromiso boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_util public.utiles%rowtype;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Tenés que iniciar sesión.';
  end if;
  if not exists (select 1 from public.perfiles where id = v_uid and activo = true) then
    raise exception 'Tu cuenta no está activa.';
  end if;
  if p_compromiso is not true then
    raise exception 'Tenés que aceptar el compromiso de devolución.';
  end if;
  if p_fecha_acordada is null then
    raise exception 'La fecha de devolución es obligatoria.';
  end if;
  if p_fecha_acordada < current_date then
    raise exception 'La fecha de devolución no puede ser anterior a hoy.';
  end if;
  if p_fecha_acordada > current_date + 7 then
    raise exception 'El plazo máximo de préstamo es de 7 días corridos.';
  end if;

  select * into v_util
  from public.utiles
  where id = p_util_id
  for update;

  if not found or v_util.activo = false then
    raise exception 'El útil no está disponible en el catálogo.';
  end if;
  if v_util.cantidad_disponible < 1 or v_util.estado in ('Dañado', 'En reparación') then
    raise exception 'No hay unidades disponibles de este útil.';
  end if;
  if v_util.dueno_id = v_uid then
    raise exception 'No podés solicitar un útil que vos mismo ofreciste.';
  end if;

  if exists (
    select 1 from public.solicitudes
    where util_id = p_util_id
      and solicitante_id = v_uid
      and estado in ('pendiente', 'aprobada')
  ) then
    raise exception 'Ya tenés una solicitud activa para este útil.';
  end if;

  insert into public.solicitudes (
    util_id,
    solicitante_id,
    fecha_solicitud,
    fecha_acordada,
    motivo,
    estado,
    compromiso
  ) values (
    p_util_id,
    v_uid,
    current_date,
    p_fecha_acordada,
    left(coalesce(trim(p_motivo), ''), 500),
    'pendiente',
    true
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Administración aprueba una solicitud pendiente.
create or replace function public.aprobar_solicitud(p_solicitud_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sol public.solicitudes%rowtype;
  v_util public.utiles%rowtype;
begin
  if not public.es_admin() then
    raise exception 'Esta acción requiere el rol de la comisión de administración.';
  end if;

  select * into v_sol from public.solicitudes where id = p_solicitud_id for update;
  if not found then
    raise exception 'No se encontró la solicitud.';
  end if;
  if v_sol.estado <> 'pendiente' then
    raise exception 'La solicitud ya fue revisada.';
  end if;

  select * into v_util from public.utiles where id = v_sol.util_id for update;
  if not found or v_util.activo = false or v_util.cantidad_disponible < 1 then
    raise exception 'Ya no hay unidades disponibles para aprobar esta solicitud.';
  end if;

  update public.solicitudes
  set estado = 'aprobada',
      revisado_por = auth.uid(),
      revisado_en = now()
  where id = p_solicitud_id;
end;
$$;

-- Administración rechaza una solicitud pendiente con una nota.
create or replace function public.rechazar_solicitud(
  p_solicitud_id uuid,
  p_nota text default ''
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sol public.solicitudes%rowtype;
  v_nota text;
begin
  if not public.es_admin() then
    raise exception 'Esta acción requiere el rol de la comisión de administración.';
  end if;

  select * into v_sol from public.solicitudes where id = p_solicitud_id for update;
  if not found then
    raise exception 'No se encontró la solicitud.';
  end if;
  if v_sol.estado <> 'pendiente' then
    raise exception 'La solicitud ya fue revisada.';
  end if;

  v_nota := coalesce(nullif(trim(p_nota), ''), 'Solicitud rechazada por administración.');

  update public.solicitudes
  set estado = 'rechazada',
      revisado_por = auth.uid(),
      revisado_en = now(),
      nota_revision = left(v_nota, 500)
  where id = p_solicitud_id;
end;
$$;

-- Entrega de un útil aprobado: descuenta stock y crea el préstamo.
create or replace function public.entregar_solicitud(p_solicitud_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sol public.solicitudes%rowtype;
  v_util public.utiles%rowtype;
  v_prestamo_id uuid;
  v_disponible integer;
  v_estado text;
begin
  if not public.es_admin() then
    raise exception 'Esta acción requiere el rol de la comisión de administración.';
  end if;

  select * into v_sol from public.solicitudes where id = p_solicitud_id for update;
  if not found then
    raise exception 'No se encontró la solicitud.';
  end if;
  if v_sol.estado = 'pendiente' then
    raise exception 'Primero aprobá la solicitud.';
  end if;
  if v_sol.estado <> 'aprobada' then
    raise exception 'La solicitud no está en condiciones de entregarse.';
  end if;

  select * into v_util from public.utiles where id = v_sol.util_id for update;
  if not found or v_util.activo = false then
    raise exception 'El útil ya no está activo.';
  end if;
  if v_util.cantidad_disponible < 1 then
    raise exception 'No hay unidades disponibles.';
  end if;

  v_disponible := v_util.cantidad_disponible - 1;
  v_estado := v_util.estado;
  if v_disponible <= 0 and v_estado = 'Disponible' then
    v_estado := 'Prestado';
  elsif v_disponible > 0 and v_estado = 'Prestado' then
    v_estado := 'Disponible';
  end if;

  update public.utiles
  set cantidad_disponible = v_disponible,
      estado = v_estado
  where id = v_util.id;

  update public.solicitudes
  set estado = 'atendida',
      entregado_en = now()
  where id = p_solicitud_id;

  insert into public.prestamos (
    solicitud_id,
    util_id,
    estudiante_id,
    fecha_entrega,
    fecha_acordada,
    estado,
    creado_por
  ) values (
    v_sol.id,
    v_sol.util_id,
    v_sol.solicitante_id,
    current_date,
    v_sol.fecha_acordada,
    'prestado',
    auth.uid()
  )
  returning id into v_prestamo_id;

  return v_prestamo_id;
end;
$$;

-- El estudiante marca la devolución. La condición queda "a_controlar" hasta
-- que administración revisa el estado real del útil.
create or replace function public.registrar_devolucion(p_prestamo_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prestamo public.prestamos%rowtype;
begin
  select * into v_prestamo from public.prestamos where id = p_prestamo_id for update;
  if not found then
    raise exception 'No se encontró el préstamo.';
  end if;

  if auth.uid() <> v_prestamo.estudiante_id and not public.es_admin() then
    raise exception 'Solo podés registrar la devolución de tus préstamos.';
  end if;
  if v_prestamo.estado <> 'prestado' then
    raise exception 'El préstamo no está activo.';
  end if;

  update public.prestamos
  set estado = 'devuelto',
      condicion = 'a_controlar',
      fecha_devolucion_real = current_date
  where id = p_prestamo_id;
end;
$$;

-- Administración controla la devolución y ajusta el inventario.
create or replace function public.controlar_devolucion(
  p_prestamo_id uuid,
  p_condicion text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prestamo public.prestamos%rowtype;
  v_util public.utiles%rowtype;
  v_total integer;
  v_disponible integer;
  v_estado text;
  v_estado_prestamo text;
begin
  if not public.es_admin() then
    raise exception 'Esta acción requiere el rol de la comisión de administración.';
  end if;
  if p_condicion is null or p_condicion <> all (array[
    'buen_estado', 'danado', 'en_reparacion', 'perdido'
  ]::text[]) then
    raise exception 'Elegí una condición de devolución válida.';
  end if;

  select * into v_prestamo from public.prestamos where id = p_prestamo_id for update;
  if not found then
    raise exception 'No se encontró el préstamo.';
  end if;
  if v_prestamo.estado <> 'devuelto' or v_prestamo.condicion <> 'a_controlar' then
    raise exception 'Este préstamo no está pendiente de control.';
  end if;

  select * into v_util from public.utiles where id = v_prestamo.util_id for update;

  v_total := v_util.cantidad_total;
  v_disponible := v_util.cantidad_disponible;
  v_estado := v_util.estado;
  v_estado_prestamo := 'devuelto';

  if p_condicion = 'buen_estado' then
    v_disponible := least(v_total, v_disponible + 1);
    if v_estado not in ('Dañado', 'En reparación') then
      v_estado := 'Disponible';
    end if;
  elsif p_condicion = 'danado' then
    v_estado := 'Dañado';
  elsif p_condicion = 'en_reparacion' then
    v_estado := 'En reparación';
  else
    v_estado_prestamo := 'perdido';
    v_total := greatest(0, v_total - 1);
    v_disponible := least(v_disponible, v_total);
    if v_total = 0 then
      v_estado := 'Dañado';
    end if;
  end if;

  update public.utiles
  set cantidad_total = v_total,
      cantidad_disponible = v_disponible,
      estado = v_estado
  where id = v_util.id;

  update public.prestamos
  set estado = v_estado_prestamo,
      condicion = p_condicion,
      controlado_por = auth.uid(),
      controlado_en = now()
  where id = p_prestamo_id;

  update public.reportes
  set estado = 'resuelto',
      resuelto_por = auth.uid(),
      resuelto_en = now()
  where prestamo_id = p_prestamo_id
    and estado = 'pendiente';
end;
$$;

-- Solo presidencia asigna roles. El registro inicial nunca permite elegir rol.
create or replace function public.asignar_rol(
  p_usuario_id uuid,
  p_rol text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.es_presidente() then
    raise exception 'Esta acción requiere el rol de presidencia.';
  end if;
  if p_rol is null or p_rol <> all (array[
    'estudiante',
    'presidente',
    'secretario',
    'tesorero',
    'comision_administracion',
    'comision_comunicacion',
    'comision_organizacion'
  ]::text[]) then
    raise exception 'Elegí un rol válido.';
  end if;
  if not exists (select 1 from public.perfiles where id = p_usuario_id) then
    raise exception 'No se encontró el integrante.';
  end if;

  -- Evita que presidencia se saque a sí misma el rol si es la única persona.
  if p_usuario_id = auth.uid()
     and p_rol <> 'presidente'
     and (select count(*) from public.perfiles
          where rol = 'presidente' and activo = true) <= 1 then
    raise exception 'Tiene que quedar al menos una persona con el rol de presidencia.';
  end if;

  update public.perfiles
  set rol = p_rol
  where id = p_usuario_id;
end;
$$;

-- Acepta una oferta y la convierte en un útil del catálogo con stock 1.
create or replace function public.aceptar_oferta(p_oferta_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_oferta public.ofertas%rowtype;
  v_util_id uuid;
begin
  if not public.es_admin() then
    raise exception 'Esta acción requiere el rol de la comisión de administración.';
  end if;

  select * into v_oferta from public.ofertas where id = p_oferta_id for update;
  if not found then
    raise exception 'No se encontró la oferta.';
  end if;
  if v_oferta.estado <> 'pendiente' then
    raise exception 'La oferta ya fue revisada.';
  end if;

  insert into public.utiles (
    nombre,
    tipo,
    estado,
    cantidad_total,
    cantidad_disponible,
    dueno_id,
    origen,
    ubicacion,
    observaciones,
    activo
  ) values (
    v_oferta.nombre,
    v_oferta.tipo,
    'Disponible',
    1,
    1,
    v_oferta.oferente_id,
    v_oferta.modalidad,
    'Armario B · donaciones',
    v_oferta.descripcion,
    true
  )
  returning id into v_util_id;

  update public.ofertas
  set estado = 'aceptada',
      revisado_por = auth.uid(),
      revisado_en = now()
  where id = p_oferta_id;

  return v_util_id;
end;
$$;

-- Guarda o reemplaza la respuesta de encuesta del usuario actual.
create or replace function public.guardar_encuesta(
  p_curso text,
  p_momento text,
  p_veces_sin_util integer
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Tenés que iniciar sesión.';
  end if;
  if not exists (select 1 from public.perfiles where id = v_uid and activo = true) then
    raise exception 'Tu cuenta no está activa.';
  end if;
  if p_curso is null or p_curso <> all (array[
    '1.º A', '1.º B',
    '2.º A', '2.º B',
    '3.º A', '3.º B',
    '4.º A', '4.º B',
    '5.º A', '5.º B',
    '6.º A', '6.º B'
  ]::text[]) then
    raise exception 'Elegí un curso válido.';
  end if;
  if p_momento is null or p_momento <> all (array['antes', 'despues']::text[]) then
    raise exception 'Momento de encuesta inválido.';
  end if;
  if p_veces_sin_util is null or p_veces_sin_util < 0 or p_veces_sin_util > 30 then
    raise exception 'Indicá un número entero entre 0 y 30.';
  end if;

  insert into public.encuestas (curso, momento, veces_sin_util, usuario_id, fecha)
  values (p_curso, p_momento, p_veces_sin_util, v_uid, current_date)
  on conflict (usuario_id, curso, momento)
  do update set
    veces_sin_util = excluded.veces_sin_util,
    fecha = excluded.fecha;
end;
$$;

-- ============================================================================
-- Estadísticas
--
-- Devuelve exactamente la forma que consume src/services/stats.js.
-- Los indicadores usan N/A (valor null) cuando el denominador es cero.
-- Los promedios de la encuesta solo se exponen a presidencia.
-- ============================================================================
create or replace function public.estadisticas_cooperativa()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_rol text := public.rol_actual();
  v_general jsonb;
  v_operacion jsonb;
  v_months jsonb := '[]'::jsonb;
  v_por_tipo jsonb := '[]'::jsonb;
  v_top jsonb := '[]'::jsonb;
  v_encuesta jsonb := '{}'::jsonb;
  v_result jsonb;

  v_cob_total bigint;
  v_cob_parte bigint;
  v_at_total bigint;
  v_at_parte bigint;
  v_est_total bigint;
  v_est_parte bigint;
  v_tar_total bigint;
  v_tar_parte bigint;

  v_month date;
  v_sol_total bigint;
  v_sol_parte bigint;
  v_prestamo_total bigint;
  v_prestamo_parte bigint;
  v_rev_total bigint;
  v_rev_parte bigint;
  v_tarea_total bigint;
  v_tarea_parte bigint;

  v_ingresos numeric;
  v_egresos numeric;
  v_enc_antes numeric;
  v_enc_despues numeric;
  v_enc_reduccion numeric;
  v_enc_resp_antes bigint;
  v_enc_resp_despues bigint;
  v_enc_cursos jsonb := '[]'::jsonb;
begin
  if v_rol is null then
    raise exception 'Tu perfil no está activo o no existe.';
  end if;

  -- Cobertura: solicitudes atendidas / solicitudes válidas (sin canceladas).
  select
    count(*) filter (where estado <> 'cancelada'),
    count(*) filter (where estado = 'atendida')
  into v_cob_total, v_cob_parte
  from public.solicitudes;

  -- Devoluciones a tiempo y condición de devolución.
  select
    count(*) filter (
      where fecha_acordada <= current_date
         or estado in ('devuelto', 'perdido')
    ),
    count(*) filter (
      where estado = 'devuelto'
        and fecha_devolucion_real is not null
        and fecha_devolucion_real <= fecha_acordada
        and (fecha_devolucion_real - coalesce(fecha_entrega, fecha_acordada)) <= 7
    ),
    count(*) filter (
      where condicion in ('buen_estado', 'danado', 'en_reparacion', 'perdido')
        and estado in ('devuelto', 'perdido')
    ),
    count(*) filter (
      where condicion = 'buen_estado'
        and estado in ('devuelto', 'perdido')
    )
  into v_at_total, v_at_parte, v_est_total, v_est_parte
  from public.prestamos;

  -- Cumplimiento de tareas activas con vencimiento.
  select
    count(*),
    count(*) filter (where estado = 'terminada')
  into v_tar_total, v_tar_parte
  from public.tareas
  where activo = true
    and fecha_limite is not null;

  v_general := jsonb_build_object(
    'cobertura', public.indicador_kpi(v_cob_parte, v_cob_total),
    'aTiempo', public.indicador_kpi(v_at_parte, v_at_total),
    'buenEstado', public.indicador_kpi(v_est_parte, v_est_total),
    'tareas', public.indicador_kpi(v_tar_parte, v_tar_total)
  );

  -- Tendencia de los últimos 6 meses, incluido el mes actual.
  for v_month in
    select generate_series(
      date_trunc('month', current_date) - interval '5 months',
      date_trunc('month', current_date),
      interval '1 month'
    )::date
  loop
    select
      count(*) filter (where estado <> 'cancelada'),
      count(*) filter (where estado = 'atendida')
    into v_sol_total, v_sol_parte
    from public.solicitudes
    where fecha_solicitud >= v_month
      and fecha_solicitud < (v_month + interval '1 month')::date;

    select
      count(*) filter (
        where fecha_acordada <= current_date
           or estado in ('devuelto', 'perdido')
      ),
      count(*) filter (
        where estado = 'devuelto'
          and fecha_devolucion_real is not null
          and fecha_devolucion_real <= fecha_acordada
          and (fecha_devolucion_real - coalesce(fecha_entrega, fecha_acordada)) <= 7
      ),
      count(*) filter (
        where condicion in ('buen_estado', 'danado', 'en_reparacion', 'perdido')
          and estado in ('devuelto', 'perdido')
      ),
      count(*) filter (
        where condicion = 'buen_estado'
          and estado in ('devuelto', 'perdido')
      )
    into v_prestamo_total, v_prestamo_parte, v_rev_total, v_rev_parte
    from public.prestamos
    where fecha_acordada >= v_month
      and fecha_acordada < (v_month + interval '1 month')::date;

    select
      count(*),
      count(*) filter (where estado = 'terminada')
    into v_tarea_total, v_tarea_parte
    from public.tareas
    where activo = true
      and fecha_limite is not null
      and fecha_limite >= v_month
      and fecha_limite < (v_month + interval '1 month')::date;

    v_months := v_months || jsonb_build_array(jsonb_build_object(
      'key', to_char(v_month, 'YYYY-MM'),
      'cobertura', public.indicador_kpi(v_sol_parte, v_sol_total),
      'aTiempo', public.indicador_kpi(v_prestamo_parte, v_prestamo_total),
      'buenEstado', public.indicador_kpi(v_rev_parte, v_rev_total),
      'tareas', public.indicador_kpi(v_tarea_parte, v_tarea_total)
    ));
  end loop;

  -- Distribución del catálogo por tipo.
  select coalesce(jsonb_agg(jsonb_build_object(
    'tipo', t.tipo,
    'icon', t.icon,
    'unidades', (
      select coalesce(sum(u.cantidad_total), 0)
      from public.utiles u
      where u.tipo = t.tipo and u.activo = true
    ),
    'disponibles', (
      select coalesce(sum(u.cantidad_disponible), 0)
      from public.utiles u
      where u.tipo = t.tipo and u.activo = true
    ),
    'prestamos', (
      select count(*)
      from public.prestamos p
      join public.utiles u on u.id = p.util_id
      where u.tipo = t.tipo
    )
  ) order by t.ord), '[]'::jsonb)
  into v_por_tipo
  from (values
    ('Escritura', '✏️', 1),
    ('Medición', '📐', 2),
    ('Papel', '📄', 3),
    ('Guardado', '🎒', 4),
    ('Manualidades', '🎨', 5)
  ) as t(tipo, icon, ord);

  -- Estudiantes con más préstamos.
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id,
    'nombre', t.nombre,
    'curso', t.curso,
    'cantidad', t.cantidad,
    'activos', t.activos
  ) order by t.cantidad desc, t.nombre), '[]'::jsonb)
  into v_top
  from (
    select
      p.estudiante_id as id,
      trim(pr.nombre || ' ' || pr.apellido) as nombre,
      pr.curso,
      count(*) as cantidad,
      count(*) filter (where p.estado in ('prestado', 'atrasado')) as activos
    from public.prestamos p
    join public.perfiles pr on pr.id = p.estudiante_id
    group by p.estudiante_id, pr.nombre, pr.apellido, pr.curso
    order by count(*) desc, nombre
    limit 6
  ) t;

  -- Estado actual de la operación.
  select
    coalesce(sum(monto) filter (where tipo = 'ingreso' and activo = true), 0),
    coalesce(sum(monto) filter (where tipo = 'egreso' and activo = true), 0)
  into v_ingresos, v_egresos
  from public.movimientos;

  v_operacion := jsonb_build_object(
    'solicitudesPendientes', (select count(*) from public.solicitudes where estado = 'pendiente'),
    'solicitudesAprobadas', (select count(*) from public.solicitudes where estado = 'aprobada'),
    'prestamosActivos', (select count(*) from public.prestamos where estado = 'prestado'),
    'prestamosAtrasados', (
      select count(*) from public.prestamos
      where estado = 'prestado' and fecha_acordada < current_date
    ),
    'devolucionesAControlar', (
      select count(*) from public.prestamos
      where estado = 'devuelto' and condicion = 'a_controlar'
    ),
    'reportesPendientes', (select count(*) from public.reportes where estado = 'pendiente'),
    'ofertasPendientes', (select count(*) from public.ofertas where estado = 'pendiente'),
    'avisosActivos', (select count(*) from public.avisos where activo = true),
    'acuerdosActivos', (select count(*) from public.acuerdos where activo = true),
    'tareasPendientes', (
      select count(*) from public.tareas
      where activo = true and estado <> 'terminada'
    ),
    'tareasTerminadas', (
      select count(*) from public.tareas
      where activo = true and estado = 'terminada'
    ),
    'estudiantes', (select count(*) from public.perfiles where activo = true),
    'ingresos', v_ingresos,
    'egresos', v_egresos,
    'saldo', v_ingresos - v_egresos,
    'unidadesDisponibles', (
      select coalesce(sum(cantidad_disponible), 0)
      from public.utiles
      where activo = true and estado not in ('Dañado', 'En reparación')
    )
  );

  -- Encuesta: promedios por curso y reducción global sin ponderar.
  if v_rol = 'presidente' then
    select
      count(*) filter (where momento = 'antes'),
      count(*) filter (where momento = 'despues')
    into v_enc_resp_antes, v_enc_resp_despues
    from public.encuestas;

    select coalesce(jsonb_agg(jsonb_build_object(
      'curso', t.curso,
      'antesN', t.antes_n,
      'despuesN', t.despues_n,
      'antes', case when t.antes is null then null else round(t.antes, 1) end,
      'despues', case when t.despues is null then null else round(t.despues, 1) end,
      'reduccion', case
        when t.antes is not null and t.despues is not null and t.antes > 0
          then round(((t.antes - t.despues) / t.antes) * 100, 1)
        else null
      end
    ) order by t.curso), '[]'::jsonb)
    into v_enc_cursos
    from (
      select
        curso,
        avg(veces_sin_util) filter (where momento = 'antes') as antes,
        avg(veces_sin_util) filter (where momento = 'despues') as despues,
        count(*) filter (where momento = 'antes') as antes_n,
        count(*) filter (where momento = 'despues') as despues_n
      from public.encuestas
      group by curso
    ) t;

    select
      sum(t.antes),
      sum(t.despues)
    into v_enc_antes, v_enc_despues
    from (
      select
        avg(veces_sin_util) filter (where momento = 'antes') as antes,
        avg(veces_sin_util) filter (where momento = 'despues') as despues
      from public.encuestas
      group by curso
      having count(*) filter (where momento = 'antes') > 0
         and count(*) filter (where momento = 'despues') > 0
    ) t;

    if v_enc_antes is not null and v_enc_antes > 0 and v_enc_despues is not null then
      v_enc_reduccion := round(((v_enc_antes - v_enc_despues) / v_enc_antes) * 100, 1);
    else
      v_enc_reduccion := null;
    end if;

    v_encuesta := jsonb_build_object(
      'cursos', v_enc_cursos,
      'reduccionGlobal', v_enc_reduccion,
      'respuestasAntes', v_enc_resp_antes,
      'respuestasDespues', v_enc_resp_despues
    );
  end if;

  v_result := jsonb_build_object(
    'general', v_general,
    'operacion', v_operacion,
    'generadoEn', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );

  if v_rol in ('presidente', 'comision_administracion', 'comision_organizacion') then
    v_result := v_result || jsonb_build_object('months', v_months);
  end if;

  if v_rol in ('presidente', 'comision_administracion') then
    v_result := v_result || jsonb_build_object(
      'porTipo', v_por_tipo,
      'topEstudiantes', v_top
    );
  end if;

  if v_rol = 'presidente' then
    v_result := v_result || jsonb_build_object('encuestaImpacto', v_encuesta);
  end if;

  return v_result;
end;
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.perfiles enable row level security;
alter table public.utiles enable row level security;
alter table public.solicitudes enable row level security;
alter table public.prestamos enable row level security;
alter table public.reportes enable row level security;
alter table public.ofertas enable row level security;
alter table public.avisos enable row level security;
alter table public.acuerdos enable row level security;
alter table public.votaciones enable row level security;
alter table public.votos enable row level security;
alter table public.movimientos enable row level security;
alter table public.actividades enable row level security;
alter table public.tareas enable row level security;
alter table public.encuestas enable row level security;

-- Perfiles: lectura para integrantes autenticados. La escritura solo ocurre
-- por el trigger de registro y por asignar_rol().
drop policy if exists perfiles_select on public.perfiles;
create policy perfiles_select on public.perfiles
  for select to authenticated using (true);

-- Catálogo: lectura para todos; escritura solo administración.
drop policy if exists utiles_select on public.utiles;
create policy utiles_select on public.utiles
  for select to authenticated using (true);

drop policy if exists utiles_insert on public.utiles;
create policy utiles_insert on public.utiles
  for insert to authenticated with check (public.es_admin());

drop policy if exists utiles_update on public.utiles;
create policy utiles_update on public.utiles
  for update to authenticated using (public.es_admin()) with check (public.es_admin());

-- Solicitudes: propias, administración y presidencia. El estudiante solo puede
-- cancelar la propia mientras está pendiente (el trigger protege el resto).
drop policy if exists solicitudes_select on public.solicitudes;
create policy solicitudes_select on public.solicitudes
  for select to authenticated using (
    solicitante_id = auth.uid() or public.es_admin() or public.es_presidente()
  );

drop policy if exists solicitudes_cancelar on public.solicitudes;
create policy solicitudes_cancelar on public.solicitudes
  for update to authenticated
  using (solicitante_id = auth.uid() and estado = 'pendiente')
  with check (solicitante_id = auth.uid() and estado = 'cancelada');

-- Préstamos: propias, administración y presidencia. Las transiciones se hacen
-- mediante funciones; no hay políticas de escritura directa.
drop policy if exists prestamos_select on public.prestamos;
create policy prestamos_select on public.prestamos
  for select to authenticated using (
    estudiante_id = auth.uid() or public.es_admin() or public.es_presidente()
  );

-- Reportes: el dueño del préstamo puede crear y ver los suyos; administración
-- y presidencia ven todos.
drop policy if exists reportes_select on public.reportes;
create policy reportes_select on public.reportes
  for select to authenticated using (
    reportado_por = auth.uid() or public.es_admin() or public.es_presidente()
  );

drop policy if exists reportes_insert on public.reportes;
create policy reportes_insert on public.reportes
  for insert to authenticated with check (
    reportado_por = auth.uid()
    and estado = 'pendiente'
    and exists (
      select 1 from public.prestamos p
      where p.id = prestamo_id and p.estudiante_id = auth.uid()
    )
  );

drop policy if exists reportes_update on public.reportes;
create policy reportes_update on public.reportes
  for update to authenticated using (public.es_admin()) with check (public.es_admin());

-- Ofertas: cada integrante ve y cancela las suyas; administración revisa todas.
drop policy if exists ofertas_select on public.ofertas;
create policy ofertas_select on public.ofertas
  for select to authenticated using (
    oferente_id = auth.uid() or public.es_admin() or public.es_presidente()
  );

drop policy if exists ofertas_insert on public.ofertas;
create policy ofertas_insert on public.ofertas
  for insert to authenticated with check (
    oferente_id = auth.uid() and estado = 'pendiente'
  );

drop policy if exists ofertas_update on public.ofertas;
create policy ofertas_update on public.ofertas
  for update to authenticated
  using ((oferente_id = auth.uid() and estado = 'pendiente') or public.es_admin())
  with check ((oferente_id = auth.uid() and estado = 'cancelada') or public.es_admin());

-- Avisos: todos leen; comunicación escribe.
drop policy if exists avisos_select on public.avisos;
create policy avisos_select on public.avisos
  for select to authenticated using (true);

drop policy if exists avisos_insert on public.avisos;
create policy avisos_insert on public.avisos
  for insert to authenticated with check (public.es_comunicacion());

drop policy if exists avisos_update on public.avisos;
create policy avisos_update on public.avisos
  for update to authenticated
  using (public.es_comunicacion()) with check (public.es_comunicacion());

-- Acuerdos: todos leen; secretaría escribe.
drop policy if exists acuerdos_select on public.acuerdos;
create policy acuerdos_select on public.acuerdos
  for select to authenticated using (true);

drop policy if exists acuerdos_insert on public.acuerdos;
create policy acuerdos_insert on public.acuerdos
  for insert to authenticated with check (public.es_secretario());

drop policy if exists acuerdos_update on public.acuerdos;
create policy acuerdos_update on public.acuerdos
  for update to authenticated
  using (public.es_secretario()) with check (public.es_secretario());

-- Votaciones: todos leen y votan; presidencia crea y cierra.
drop policy if exists votaciones_select on public.votaciones;
create policy votaciones_select on public.votaciones
  for select to authenticated using (true);

drop policy if exists votaciones_insert on public.votaciones;
create policy votaciones_insert on public.votaciones
  for insert to authenticated with check (public.es_presidente());

drop policy if exists votaciones_update on public.votaciones;
create policy votaciones_update on public.votaciones
  for update to authenticated
  using (public.es_presidente()) with check (public.es_presidente());

-- Votos: lectura para calcular resultados; cada integrante vota una vez y solo
-- en votaciones abiertas, vigentes y con una opción válida.
drop policy if exists votos_select on public.votos;
create policy votos_select on public.votos
  for select to authenticated using (true);

drop policy if exists votos_insert on public.votos;
create policy votos_insert on public.votos
  for insert to authenticated with check (
    usuario_id = auth.uid()
    and exists (
      select 1 from public.votaciones v
      where v.id = votacion_id
        and v.estado = 'abierta'
        and v.fecha_cierre >= current_date
        and opcion = any (v.opciones)
    )
  );

-- Recursos: lectura para integrantes; tesorería registra y anula (baja lógica).
drop policy if exists movimientos_select on public.movimientos;
create policy movimientos_select on public.movimientos
  for select to authenticated using (true);

drop policy if exists movimientos_insert on public.movimientos;
create policy movimientos_insert on public.movimientos
  for insert to authenticated with check (public.es_tesorero());

drop policy if exists movimientos_update on public.movimientos;
create policy movimientos_update on public.movimientos
  for update to authenticated
  using (public.es_tesorero()) with check (public.es_tesorero());

-- Actividades: todos leen; organización escribe.
drop policy if exists actividades_select on public.actividades;
create policy actividades_select on public.actividades
  for select to authenticated using (true);

drop policy if exists actividades_insert on public.actividades;
create policy actividades_insert on public.actividades
  for insert to authenticated with check (public.es_organizacion());

drop policy if exists actividades_update on public.actividades;
create policy actividades_update on public.actividades
  for update to authenticated
  using (public.es_organizacion()) with check (public.es_organizacion());

-- Tareas: todos leen; organización crea/edita; la persona asignada actualiza
-- únicamente el estado (lo controla el trigger).
drop policy if exists tareas_select on public.tareas;
create policy tareas_select on public.tareas
  for select to authenticated using (true);

drop policy if exists tareas_insert on public.tareas;
create policy tareas_insert on public.tareas
  for insert to authenticated with check (public.es_organizacion());

drop policy if exists tareas_update on public.tareas;
create policy tareas_update on public.tareas
  for update to authenticated
  using (asignado_id = auth.uid() or public.es_organizacion())
  with check (asignado_id = auth.uid() or public.es_organizacion());

-- Encuestas: anónimas para el resto. Solo se leen las respuestas propias y se
-- escriben mediante guardar_encuesta(); los promedios salen del RPC de estadísticas.
drop policy if exists encuestas_select on public.encuestas;
create policy encuestas_select on public.encuestas
  for select to authenticated using (usuario_id = auth.uid());

-- ============================================================================
-- Permisos
-- ============================================================================
revoke all on public.perfiles from anon, authenticated;
grant select on public.perfiles to authenticated;

revoke all on public.utiles from anon, authenticated;
grant select, insert, update on public.utiles to authenticated;

revoke all on public.solicitudes from anon, authenticated;
grant select, update on public.solicitudes to authenticated;

revoke all on public.prestamos from anon, authenticated;
grant select on public.prestamos to authenticated;

revoke all on public.reportes from anon, authenticated;
grant select, insert, update on public.reportes to authenticated;

revoke all on public.ofertas from anon, authenticated;
grant select, insert, update on public.ofertas to authenticated;

revoke all on public.avisos from anon, authenticated;
grant select, insert, update on public.avisos to authenticated;

revoke all on public.acuerdos from anon, authenticated;
grant select, insert, update on public.acuerdos to authenticated;

revoke all on public.votaciones from anon, authenticated;
grant select, insert, update on public.votaciones to authenticated;

revoke all on public.votos from anon, authenticated;
grant select, insert on public.votos to authenticated;

revoke all on public.movimientos from anon, authenticated;
grant select, insert, update on public.movimientos to authenticated;

revoke all on public.actividades from anon, authenticated;
grant select, insert, update on public.actividades to authenticated;

revoke all on public.tareas from anon, authenticated;
grant select, insert, update on public.tareas to authenticated;

revoke all on public.encuestas from anon, authenticated;
grant select on public.encuestas to authenticated;

revoke all on sequence public.seq_util from anon, authenticated;
revoke all on sequence public.seq_solicitud from anon, authenticated;
revoke all on sequence public.seq_prestamo from anon, authenticated;
grant usage, select on sequence public.seq_util to authenticated;
grant usage, select on sequence public.seq_solicitud to authenticated;
grant usage, select on sequence public.seq_prestamo to authenticated;

-- Funciones auxiliares de rol.
revoke all on function public.rol_actual() from public, anon;
revoke all on function public.es_presidente() from public, anon;
revoke all on function public.es_admin() from public, anon;
revoke all on function public.es_secretario() from public, anon;
revoke all on function public.es_tesorero() from public, anon;
revoke all on function public.es_comunicacion() from public, anon;
revoke all on function public.es_organizacion() from public, anon;
grant execute on function public.rol_actual() to authenticated;
grant execute on function public.es_presidente() to authenticated;
grant execute on function public.es_admin() to authenticated;
grant execute on function public.es_secretario() to authenticated;
grant execute on function public.es_tesorero() to authenticated;
grant execute on function public.es_comunicacion() to authenticated;
grant execute on function public.es_organizacion() to authenticated;

-- Funciones de negocio.
revoke all on function public.solicitar_prestamo(uuid, date, text, boolean) from public, anon;
revoke all on function public.aprobar_solicitud(uuid) from public, anon;
revoke all on function public.rechazar_solicitud(uuid, text) from public, anon;
revoke all on function public.entregar_solicitud(uuid) from public, anon;
revoke all on function public.registrar_devolucion(uuid) from public, anon;
revoke all on function public.controlar_devolucion(uuid, text) from public, anon;
revoke all on function public.asignar_rol(uuid, text) from public, anon;
revoke all on function public.aceptar_oferta(uuid) from public, anon;
revoke all on function public.guardar_encuesta(text, text, integer) from public, anon;
revoke all on function public.estadisticas_cooperativa() from public, anon;

grant execute on function public.solicitar_prestamo(uuid, date, text, boolean) to authenticated;
grant execute on function public.aprobar_solicitud(uuid) to authenticated;
grant execute on function public.rechazar_solicitud(uuid, text) to authenticated;
grant execute on function public.entregar_solicitud(uuid) to authenticated;
grant execute on function public.registrar_devolucion(uuid) to authenticated;
grant execute on function public.controlar_devolucion(uuid, text) to authenticated;
grant execute on function public.asignar_rol(uuid, text) to authenticated;
grant execute on function public.aceptar_oferta(uuid) to authenticated;
grant execute on function public.guardar_encuesta(text, text, integer) to authenticated;
grant execute on function public.estadisticas_cooperativa() to authenticated;

-- La función indicador_kpi() es de uso interno; no se expone a los clientes.
revoke all on function public.indicador_kpi(bigint, bigint) from public, anon;

-- ============================================================================
-- Verificación rápida (opcional, ejecutar después del script):
--
--   select tablename, rowsecurity
--   from pg_tables
--   where schemaname = 'public'
--   order by tablename;
--
--   select trigger_name, event_object_table
--   from information_schema.triggers
--   where trigger_schema = 'public'
--   order by event_object_table, trigger_name;
-- ============================================================================
