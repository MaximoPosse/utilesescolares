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

