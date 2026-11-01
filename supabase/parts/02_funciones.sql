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

