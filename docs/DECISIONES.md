# Decisiones de diseño y trazabilidad

Este documento explica **por qué** la aplicación está construida así, cómo se resolvieron los 16 requerimientos y qué límites tiene la entrega. Está pensado para evaluar el proyecto y para facilitar su mantenimiento.

---

## 1. Resumen de la solución

Se construyó una aplicación Vue 3 de una sola página (SPA) con dos adaptadores de datos intercambiables:

1. **Modo demostración (`demoApi`)**: funciona sin configuración, guarda los datos en `localStorage` y permite probar todos los roles con un selector explícitamente marcado como demostración.
2. **Modo Supabase (`supabaseApi`)**: usa autenticación real, PostgreSQL, RLS y funciones transaccionales. Se activa automáticamente cuando existen `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

La interfaz, las reglas de negocio visibles y los indicadores son los mismos en ambos modos. El cambio de modo se resuelve en `src/services/api.js`; las vistas nunca importan un adaptador concreto.

---

## 2. Decisiones de arquitectura

### 2.1 Vue 3 + Vite + Vue Router, sin librería de UI

**Decisión:** usar Vue 3 con Composition API, Vite y un sistema de diseño CSS propio.

**Motivos:**

- El proyecto es escolar y debe poder explicarse y modificarse sin depender de una librería compleja.
- Un CSS propio permite cumplir el estilo solicitado (verde, tarjetas, badges de estado) y el comportamiento responsive sin sobrecarga.
- Vite ofrece arranque rápido, recarga en caliente y un build simple.
- Vue Router permite guardas por rol y rutas de confirmación claras.

**Alternativa descartada:** una librería de componentes (Vuetify, PrimeVue, etc.). Habría acelerado algunos controles, pero agregaba dependencias, estilos difíciles de adaptar y una curva de aprendizaje innecesaria.

### 2.2 Dos adaptadores de datos con la misma interfaz

**Decisión:** `demoApi` y `supabaseApi` exponen los mismos métodos; `api.js` elige uno al iniciar.

**Motivos:**

- Permite evaluar la aplicación sin crear un proyecto Supabase.
- Evita que la demo y la versión real se separen: ambas alimentan las mismas vistas.
- Los datos de prueba quedan aislados del backend real.
- Si no hay credenciales, la aplicación no falla: funciona en demo.

**Costo:** mantener dos implementaciones. Se mitiga con una interfaz común, pruebas manuales de los flujos críticos y una única fuente para las fórmulas de estadísticas (`src/services/stats.js` y el RPC equivalente).

### 2.3 Sin backend propio

**Decisión:** no se creó un servidor Node/Express intermedio.

**Motivos:**

- Supabase ya ofrece autenticación, base de datos, RLS y RPC.
- Un backend propio habría duplicado validaciones y agregado infraestructura.
- Las operaciones críticas (stock, aprobación, devolución, roles) se resuelven en funciones PostgreSQL atómicas.
- El cliente solo usa la clave pública `anon`.

**Alternativa descartada:** backend propio con JWT y ORM. Se descartó por tiempo, por complejidad de despliegue y porque no aportaba seguridad adicional frente a RLS bien configurado.

---

## 3. Autenticación, registro y roles

### 3.1 Registro siempre como estudiante

**Decisión:** el formulario de registro no incluye selector de rol. En Supabase, el trigger `crear_perfil_nuevo_usuario()` ignora cualquier rol enviado en los metadatos y escribe `rol = 'estudiante'`.

**Motivo:** evitar escalada de privilegios. Aunque alguien modifique el HTML o llame directamente a la API de registro, no puede nacer como presidente o administración.

### 3.2 Solo presidencia asigna roles

**Decisión:** la función `asignar_rol(p_usuario_id, p_rol)` valida `es_presidente()` y actualiza el perfil. En la interfaz, `/integrantes` está protegida por rol y el selector solo aparece para presidencia.

**Motivo:** separar la operación cotidiana (pedir, prestar, devolver) de la administración de permisos.

### 3.3 Bootstrap del primer presidente

**Problema:** si todos nacen estudiantes y solo un presidente puede asignar roles, no existe un primer presidente.

**Decisión:** la primera designación se hace una vez desde el SQL Editor del proyecto, con un `update` administrativo documentado en el README. No se crea una “clave secreta” ni un endpoint de bootstrap en el cliente.

**Motivo:** el SQL Editor ya es una herramienta privilegiada del proyecto; agregar un mecanismo público de bootstrap sería un riesgo mayor.

### 3.4 Selector de rol solo en demo

**Decisión:** el selector se rotula **“Cambiar de rol (demostración)”** y se renderiza únicamente si `IS_DEMO` es verdadero.

**Motivo:** permitir recorrer todas las pantallas sin crear siete cuentas, sin confundir la demo con la asignación real de roles. En Supabase, el cambio de rol solo ocurre por `asignar_rol()`.

### 3.5 Sesión demo

**Decisión:** la demo guarda el identificador del usuario en `localStorage` (sesión persistente) o `sessionStorage` (sesión temporal), según “mantener la sesión”.

**Motivo:** imitar el comportamiento de una sesión real sin manejar tokens ni contraseñas reales. Las cuentas demo tienen una contraseña ficticia común.

---

## 4. Modelo de datos y operaciones

### 4.1 Nombres en español y UUID

**Decisión:** tablas y columnas en español (`perfiles`, `solicitudes`, `prestamos`, etc.) y claves UUID.

**Motivo:** el dominio y la documentación están en español; los UUID evitan colisiones y facilitan el uso con Supabase. Los números legibles (`S-0001`, `P-0001`, `U-001`) se generan con secuencias para mostrar al usuario.

### 4.2 Operaciones críticas en RPC

**Decisión:** las transiciones que afectan stock o varios registros se ejecutan en funciones `SECURITY DEFINER`:

- `solicitar_prestamo`
- `aprobar_solicitud`
- `rechazar_solicitud`
- `entregar_solicitud`
- `registrar_devolucion`
- `controlar_devolucion`
- `asignar_rol`
- `aceptar_oferta`
- `guardar_encuesta`

**Motivos:**

- Atomicidad: entregar un útil debe descontar stock, marcar la solicitud y crear el préstamo en una sola transacción.
- Validación centralizada: no se puede saltar una regla llamando directamente a la tabla.
- RLS más simple: las tablas de préstamos no necesitan permisos de escritura directa.
- Menos condiciones de carrera: se usan `for update` al leer útiles, solicitudes y préstamos.

**Alternativa descartada:** hacer todo con `insert/update` desde el cliente y confiar en RLS. RLS controla filas, pero no garantiza secuencias de negocio ni consistencia de stock.

### 4.3 Máquina de estados

Solicitud:

```text
pendiente → aprobada → atendida
     ├────→ rechazada
     └────→ cancelada (autor, solo pendiente)
```

Préstamo:

```text
prestado → devuelto / a_controlar → devuelto (condición final)
         └→ perdido
```

**Decisiones asociadas:**

- El estudiante solo puede **avisar** la devolución. La condición queda en `a_controlar`.
- Administración confirma la condición final y actualiza el stock.
- Si se pierde un útil, se descuenta del total y del disponible; si el total llega a 0, el útil queda fuera del catálogo.
- Si se daña o queda en reparación, no se presta hasta resolverse.
- Un préstamo perdido cuenta como finalizado para el indicador de devoluciones y para el de condición.

### 4.4 Plazo máximo de 7 días

**Decisión:** se valida tres veces:

1. En la interfaz, al elegir la fecha.
2. En la función `solicitar_prestamo`, con `current_date + 7`.
3. En la restricción `solicitudes_plazo_valido` de la tabla.

**Motivo:** la regla es central para la cooperativa; no debe depender de una sola capa.

### 4.5 Ofertas de donación e intercambio

**Decisión:** una oferta es un registro separado (`ofertas`) con estado `pendiente`, `aceptada`, `rechazada` o `cancelada`. Al aceptarla, `aceptar_oferta()` crea un útil con stock 1, dueño y origen correspondiente.

**Motivos:**

- No se publica directamente en el catálogo algo que todavía no fue revisado.
- Se conserva la trazabilidad entre la oferta y el útil creado.
- La persona oferente queda registrada como dueña/donante.

### 4.6 Reportes de daño o pérdida

**Decisión:** el estudiante crea un reporte asociado a su préstamo; administración lo resuelve al controlar la devolución.

**Motivo:** separar el aviso del estudiante de la decisión de inventario. El reporte no cambia el stock por sí solo; la operación que lo hace es `controlar_devolucion()`.

---

## 5. Historial y baja lógica

**Decisión:** no se eliminan físicamente registros de negocio.

- `utiles`, `avisos`, `acuerdos`, `movimientos`, `actividades` y `tareas` tienen `activo`.
- `solicitudes` y `ofertas` usan estados `cancelada`/`rechazada`.
- `prestamos` conserva `devuelto` o `perdido` y la condición final.
- `reportes` conserva `pendiente` o `resuelto`.
- Las claves foráneas de autores usan `on delete restrict` para no perder historia; las de revisores usan `on delete set null` para permitir dar de baja una cuenta sin borrar el hecho.

**Motivo:** la cooperativa necesita auditoría y estadísticas históricas. Borrar filas rompería los indicadores y la trazabilidad.

**Consecuencia:** las consultas públicas filtran por `activo` o por estados vigentes; las pantallas de gestión pueden mostrar el historial completo.

---

## 6. Indicadores y N/A

**Decisión:** una única definición de cada indicador, replicada en JavaScript y SQL.

| Indicador | Numerador | Denominador | N/A |
|-----------|-----------|-------------|-----|
| Cobertura | solicitudes `atendida` | solicitudes válidas (todas menos `cancelada`) | denominador 0 |
| A tiempo | devoluciones con fecha real ≤ acordada y ≤ 7 días desde la entrega | préstamos que vencían o terminaron (`devuelto`/`perdido`) | denominador 0 |
| Buen estado | condición `buen_estado` | préstamos `devuelto`/`perdido` con condición registrada | denominador 0 |
| Tareas | tareas `terminada` | tareas activas con fecha límite | denominador 0 |

**Motivos:**

- N/A evita interpretar un cero como “0 % de cumplimiento” cuando en realidad no hay casos.
- Las metas (90 %, 85 %, 95 %, 90 %) se muestran siempre, aun cuando el resultado sea N/A.
- El cálculo mensual usa la fecha de solicitud, la fecha acordada del préstamo y la fecha límite de la tarea, respectivamente.

**Encuesta de impacto:**

- Se compara el promedio de veces sin útil “antes” y “después” por curso.
- La reducción por curso solo se calcula si existen ambos momentos y el promedio “antes” es mayor que 0.
- La reducción global promedia los cursos que tienen ambos momentos, sin ponderar por cantidad de respuestas.
- `respuestasAntes` y `respuestasDespues` son los totales reales de respuestas.

**Decisión de privacidad:** las respuestas individuales solo son visibles para su autor. Los agregados por curso se obtienen con `estadisticas_cooperativa()` y solo presidencia recibe `encuestaImpacto`. Por eso la pantalla usa los totales del RPC para presidencia, no la cantidad de filas que devuelve la consulta directa.

---

## 7. RLS y permisos

### 7.1 Matriz resumida

| Tabla | Lectura | Escritura directa |
|-------|---------|-------------------|
| `perfiles` | autenticados | solo trigger de registro y `asignar_rol()` |
| `utiles` | autenticados | administración |
| `solicitudes` | autor, administración, presidencia | autor cancela pendiente; el resto por RPC |
| `prestamos` | estudiante, administración, presidencia | solo RPC |
| `reportes` | autor, administración, presidencia | autor crea; administración resuelve |
| `ofertas` | autor, administración, presidencia | autor crea/cancela; administración revisa |
| `avisos` | autenticados | comunicación |
| `acuerdos` | autenticados | secretaría |
| `votaciones` | autenticados | presidencia |
| `votos` | autenticados | cada integrante, una vez, en votación abierta |
| `movimientos` | autenticados | tesorería |
| `actividades` | autenticados | organización |
| `tareas` | autenticados | organización; asignado solo cambia estado |
| `encuestas` | solo el autor | solo `guardar_encuesta()` |

### 7.2 Triggers de protección

Además de RLS, se usan triggers para evitar cambios que RLS no puede expresar con precisión:

- `proteger_solicitud`: solo permite cancelar la solicitud propia pendiente sin cambiar otros campos.
- `proteger_oferta`: solo permite cancelar la oferta propia pendiente.
- `proteger_tarea`: la persona asignada solo puede cambiar el estado.
- `proteger_votacion`: no se pueden cambiar opciones con votos ni reabrir una votación cerrada.

**Motivo:** RLS decide *qué filas* se pueden tocar; los triggers deciden *qué columnas y transiciones* son válidas.

### 7.3 Funciones auxiliares

`rol_actual()`, `es_presidente()`, `es_admin()`, etc. son `SECURITY DEFINER` y `stable` para evitar recursión de RLS al consultar `perfiles`. Se revocó su ejecución pública y se otorgó solo a `authenticated`.

---

## 8. Interfaz y experiencia

### 8.1 Sistema visual

**Decisión:** variables CSS, tarjetas, badges de estado, barras de progreso y una paleta verde con acentos cálidos.

**Motivos:**

- El verde comunica cuidado, reutilización y sustentabilidad.
- Los badges permiten leer estados de un vistazo.
- Las tarjetas KPI muestran valor, meta, numerador/denominador y N/A sin ambigüedad.

### 8.2 Responsive

**Decisión:** breakpoints en 1080, 900, 680 y 420 px; tablas que se convierten en tarjetas con `data-label` en pantallas pequeñas; menú móvil desplegable.

**Motivo:** la aplicación debe usarse tanto en la computadora de la escuela como en el teléfono.

### 8.3 Accesibilidad

- Formularios con `label`, `aria-invalid`, mensajes de error y roles `alert`/`status`.
- Modales con `role="dialog"`, `aria-modal`, foco inicial y cierre con Escape.
- Navegación con `aria-label`, botones con texto o `aria-label`.
- Respeto a `prefers-reduced-motion`.
- Contraste alto en estados y textos de error.

---

## 9. Trazabilidad de los 16 requerimientos

| # | Requerimiento | Dónde se resolvió |
|---|---------------|-------------------|
| 1 | Login y registro con roles | `LoginView.vue`, `auth.js`, trigger `crear_perfil_nuevo_usuario()` |
| 2 | Panel de inicio | `DashboardView.vue` con KPIs, avisos, tareas y accesos |
| 3 | Catálogo de útiles | `CatalogoView.vue`, búsqueda, filtros y disponibilidad |
| 4 | Detalle del útil y solicitud | `UtilDetalleView.vue` con plazo máximo y compromiso |
| 5 | Confirmación de solicitud | `SolicitudConfirmacionView.vue` y `solicitar_prestamo()` |
| 6 | Mis préstamos | `MisPrestamosView.vue`, historial, devolución y reportes |
| 7 | Confirmación de devolución | `DevolucionConfirmacionView.vue` y `registrar_devolucion()` |
| 8 | Ofrecer útil | `OfrecerUtilView.vue` y `aceptar_oferta()` |
| 9 | Votaciones | `VotacionesView.vue`, reglas de voto único y cierre |
| 10 | Avisos | `AvisosView.vue`, CRUD lógico de comunicación |
| 11 | Acuerdos | `AcuerdosView.vue`, CRUD lógico de secretaría |
| 12 | Recursos | `RecursosView.vue`, ingresos, egresos y anulación lógica |
| 13 | Tareas | `TareasView.vue`, actividades, asignación y cumplimiento |
| 14 | Gestión de préstamos | `GestionPrestamosView.vue`, aprobación, entrega, control, ofertas y reportes |
| 15 | Inventario | `InventarioView.vue`, alta, edición, baja y reactivación |
| 16 | Estadísticas | `EstadisticasView.vue`, `stats.js` y `estadisticas_cooperativa()` |

Requerimientos transversales:

- **Plazo de 7 días:** UI + RPC + restricción SQL.
- **Cálculo de atrasos:** `estadoPrestamoEfectivo()` y `diasAtraso()` en `src/data/utils.js`; el RPC también calcula atrasados.
- **Devoluciones y pérdidas:** estados, condición, reportes y control de administración.
- **Cuatro KPIs y N/A:** `KPI_META`, `estadoKpi()` y `indicador_kpi()`.
- **Roles:** constantes, permisos, guardas de router, RLS y RPC.
- **Registro siempre estudiante:** trigger SQL y ausencia de selector de rol.
- **Selector demo rotulado:** `AppShell.vue` muestra “Cambiar de rol (demostración)” solo en demo.
- **Historial:** estados y bajas lógicas, sin `delete` de negocio.
- **Datos ficticios identificados:** badge “Datos de prueba”, barra de demo y cuentas `@coop.demo`.
- **Secretos:** solo anon key; `.env.example` y `.env.local`; service_role nunca usada.
- **README:** instalación, demo, Supabase, SQL, seguridad y reproducción.

---

## 10. Pruebas y evidencia

### 10.1 Build

```bash
npm run build
```

Resultado: compilación correcta de Vue + Vite, assets en `dist/`.

### 10.2 SQL

El archivo `supabase/schema.sql` fue validado con `pglast` (parser de PostgreSQL) para detectar errores de sintaxis. No se ejecutó contra una instancia real por falta de credenciales.

### 10.3 Smoke test manual en demo

- Ingreso con Ana Pérez (`ana@coop.demo`).
- Catálogo → detalle → solicitud `S-0057`.
- Cambio a “Comisión de administración” con el selector demo.
- Aprobación y entrega de `S-0057`; creación del préstamo y descuento de stock de `U-017`.
- Devolución avisada por la estudiante (`P-0052`); la ruta de confirmación se muestra sin modal residual.
- Control de `P-0049` en buen estado; el stock de `U-013` vuelve de 2 a 3.
- Verificación de conteos de gestión: solicitudes pendientes, préstamos activos, devoluciones a controlar, ofertas y reportes.
- Sin errores de consola observados.

### 10.4 Pruebas pendientes

- Ejecución real del esquema en un proyecto Supabase.
- Registro con confirmación de correo activada.
- Asignación real de roles entre varias cuentas.
- Pruebas de RLS con usuarios de cada rol.
- Pruebas automatizadas E2E.

---

## 11. Seguridad: decisiones y controles

1. **Solo anon key en el cliente.** `src/lib/supabase.js` lee únicamente `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
2. **RLS en todas las tablas.** Sin políticas, el acceso se deniega.
3. **Funciones de negocio con validación de rol.** No alcanza con ocultar botones.
4. **Registro sin rol elegible.** El trigger ignora metadatos.
5. **Triggers de protección de columnas.** Evitan cambios laterales en cancelaciones y tareas.
6. **Encuestas privadas.** Solo el autor lee sus filas; los agregados salen de un RPC con control de rol.
7. **Sin datos reales en la demo.** Todo el seed es ficticio y se identifica en la interfaz.
8. **Variables de entorno ignoradas.** `.env.local` está en `.gitignore`; `.env.example` no contiene secretos.

**Riesgo residual:** el RPC de estadísticas es `SECURITY DEFINER` y devuelve agregados generales a cualquier usuario autenticado. No expone filas individuales, pero sí conteos operativos. Si se quisiera un secreto estricto, habría que devolver solo las secciones permitidas por rol; la interfaz ya oculta las no permitidas. Se documenta como mejora posible.

---

## 12. Limitaciones asumidas

- **Sin credenciales Supabase** no fue posible probar el flujo real completo.
- **Sin correos automáticos:** no hay recordatorios de vencimiento ni notificaciones.
- **Sin archivos adjuntos:** los daños se describen con texto.
- **Sin tiempo real:** no hay suscripciones Realtime; se recarga al navegar.
- **Una sola cooperativa:** el modelo no está preparado para múltiples escuelas.
- **Demo local:** no sincroniza entre dispositivos y se pierde si se limpia el almacenamiento.
- **Primer presidente manual:** requiere un `update` administrativo en el SQL Editor.
- **Encuesta no probabilística:** mide percepción declarada, no un experimento controlado.

---

## 13. Alternativas evaluadas y descartadas

| Alternativa | Por qué se descartó |
|-------------|---------------------|
| Backend propio con Express | Duplicaba validaciones, agregaba despliegue y no mejoraba RLS. |
| Firebase | El proyecto pedía SQL/RLS y Supabase encaja mejor con PostgreSQL y funciones. |
| Solo localStorage | No permitía cuentas reales, concurrencia ni roles confiables. |
| Solo Supabase | Imposibilitaba evaluar la app sin credenciales y complicaba la demostración. |
| Librería de UI | Más peso, menos control del estilo solicitado y más curva de aprendizaje. |
| Borrado físico | Rompía historial, estadísticas y trazabilidad. |
| Rol elegible en el registro | Riesgo de escalada de privilegios. |
| Condición final definida por el estudiante | Permitía ocultar daños; por eso la define administración. |

---

## 14. Cómo extender el proyecto

1. **Nuevo rol o permiso:** agregar en `ROLES` y `PERMISOS`, crear guardas, actualizar RLS y funciones auxiliares.
2. **Nuevo estado:** agregar al check SQL, a `constants.js`, a los badges y a las transiciones.
3. **Nuevo indicador:** definirlo en `KPI_META`, `analizar()` y `estadisticas_cooperativa()`; agregar la tarjeta en `EstadisticasView.vue`.
4. **Nueva pantalla:** crear la vista, agregar la ruta con `meta.roles`, el enlace en `AppShell.vue` y la política RLS si usa una tabla nueva.
5. **Nuevo flujo transaccional:** crear una función SQL `SECURITY DEFINER`, validar rol/estado, otorgar execute a `authenticated` y agregar el método en ambos adaptadores.

---

## 15. Conclusión

La entrega prioriza **claridad de dominio, historial y seguridad de roles** por sobre la sofisticación técnica. La demo permite evaluar la experiencia completa sin infraestructura; el esquema Supabase deja preparada una versión multiusuario real con reglas de negocio en la base. Las limitaciones están explicitadas y los pasos para pasar a producción están documentados.
