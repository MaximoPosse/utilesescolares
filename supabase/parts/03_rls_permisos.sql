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
