# Cooperativa de Útiles Escolares

Aplicación web para una cooperativa escolar de útiles: préstamo, intercambio, donación y reutilización. Incluye un **modo demostración** autónomo con datos ficticios y un **modo Supabase** con autenticación real, RLS y funciones transaccionales en PostgreSQL.

Proyecto de la materia **Organización y Métodos**. Interfaz en español, responsive para escritorio y teléfono.

---

## 1. Qué resuelve

La cooperativa permite que los integrantes:

- pidan útiles en préstamo con un plazo máximo de **7 días corridos**;
- registren la devolución y avisen pérdidas o daños;
- ofrezcan útiles para donación o intercambio;
- voten decisiones y consulten avisos y acuerdos;
- registren recursos y movimientos;
- organicen actividades y tareas;
- sigan cuatro indicadores de gestión acordados por la asamblea.

La aplicación conserva el historial: las solicitudes, préstamos, útiles, movimientos y demás registros no se borran físicamente. Se usan estados, banderas `activo` y bajas lógicas.

---

## 2. Pantallas y flujos incluidos

| # | Pantalla / flujo | Ruta principal |
|---|------------------|----------------|
| 1 | Ingreso y registro | `/login` |
| 2 | Panel de inicio | `/` |
| 3 | Catálogo de útiles | `/catalogo` |
| 4 | Detalle del útil y solicitud de préstamo | `/catalogo/:id` |
| 5 | Confirmación de solicitud | `/solicitud/:id/confirmacion` |
| 6 | Mis préstamos, devoluciones y reportes | `/mis-prestamos` |
| 7 | Confirmación de devolución | `/devolucion/:id/confirmacion` |
| 8 | Ofrecer un útil | `/ofrecer` |
| 9 | Votaciones | `/votaciones` |
| 10 | Avisos | `/avisos` |
| 11 | Acuerdos | `/acuerdos` |
| 12 | Recursos y movimientos | `/recursos` |
| 13 | Actividades y tareas | `/tareas` |
| 14 | Gestión de préstamos | `/gestion-prestamos` |
| 15 | Inventario | `/inventario` |
| 16 | Estadísticas e indicadores | `/estadisticas` |
| — | Integrantes y asignación de roles | `/integrantes` |
| — | Página no encontrada | `/:pathMatch(.*)*` |

Flujo de préstamo:

```text
pendiente → aprobada → atendida
     └──────────────→ rechazada
     └──────────────→ cancelada (solo el solicitante, mientras está pendiente)
```

Flujo de devolución:

```text
prestado → devuelto / a_controlar → devuelto (buen_estado | danado | en_reparacion)
                                  └→ perdido
```

El estudiante avisa la devolución; administración controla el estado real del útil y recién entonces se actualiza el stock.

---

## 3. Roles y permisos

| Rol | Puede hacer |
|-----|-------------|
| `estudiante` | Pedir préstamos, cancelar solicitudes propias pendientes, devolver, reportar daños/pérdidas, ofrecer útiles, votar y consultar información. Ve su resumen personal en estadísticas y puede responder la encuesta. |
| `presidente` | Todo lo de estudiante, más crear/cerrar votaciones, asignar roles y ver el panel completo de estadísticas, incluidos los promedios de la encuesta. |
| `secretario` | Gestionar acuerdos (crear, editar, archivar). |
| `tesorero` | Registrar y anular movimientos de recursos. |
| `comision_administracion` | Gestionar inventario, aprobar/rechazar solicitudes, registrar entregas, controlar devoluciones, revisar ofertas y reportes. |
| `comision_comunicacion` | Crear, editar y archivar avisos. |
| `comision_organizacion` | Crear actividades, asignar tareas, editarlas y archivarlas. |

Reglas importantes:

- **Todo registro nuevo nace como `estudiante`**, tanto en la demo como en Supabase. El formulario no permite elegir rol.
- En Supabase, **solo presidencia puede asignar roles** mediante la función `asignar_rol()`.
- El selector **“Cambiar de rol (demostración)”** existe únicamente en modo demo y está rotulado como demostración. No aparece cuando la aplicación usa Supabase.
- Las rutas de gestión tienen guardas por rol en el router y también RLS/validaciones en la base.

### Primer arranque en Supabase

Como todos los registros nacen como estudiantes, la primera persona con rol de presidencia se designa una sola vez desde el **SQL Editor** del proyecto (operación administrativa, no desde el cliente):

```sql
-- Reemplazar por el correo real de la persona que será presidenta.
update public.perfiles
set rol = 'presidente'
where lower(email) = lower('presidenta@escuela.edu');
```

Después de eso, presidencia ya puede asignar el resto de los roles desde `/integrantes`.

---

## 4. Tecnologías

- **Vue 3** con `<script setup>` y Composition API.
- **Vite 7** como servidor de desarrollo y empaquetador.
- **Vue Router 4** con historial HTML5 y guardas por rol.
- **CSS propio** con variables, grilla responsive y componentes reutilizables. Sin librería de UI.
- **Supabase** (`@supabase/supabase-js`) para autenticación, base PostgreSQL, RLS y RPC.
- **localStorage** para el modo demostración.

No hay backend propio ni claves privilegiadas en el cliente. La única clave que se usa es la **anon public key**.

---

## 5. Ejecutar en modo demostración

Requisitos: **Node.js 20 o superior** y npm.

```bash
npm install
npm run dev
```

Abrir `http://localhost:5173`.

Si no existen `VITE_SUPABASE_URL` ni `VITE_SUPABASE_ANON_KEY`, la aplicación arranca automáticamente en modo demo:

- los datos se guardan en `localStorage` con la clave `cooperativa-utiles:demo:v1`;
- el encabezado muestra “Modo demostración · todos los datos son ficticios”;
- se pueden reiniciar los datos desde la barra de demostración;
- las cuentas de prueba usan contraseñas ficticias.

### Cuentas de demostración

Contraseña para todas: **`demo1234`**

| Correo | Nombre | Curso | Rol |
|--------|--------|-------|-----|
| `ana@coop.demo` | Ana Pérez | 3.º B | Estudiante |
| `elena@coop.demo` | Elena Ruiz | 3.º B | Presidencia |
| `facundo@coop.demo` | Facundo López | 4.º B | Secretaría |
| `gabriela@coop.demo` | Gabriela Torres | 5.º A | Tesorería |
| `hernan@coop.demo` | Hernán Castro | 6.º B | Administración |
| `ines@coop.demo` | Inés Molina | 3.º A | Comunicación |
| `julian@coop.demo` | Julián Vega | 4.º A | Organización |

También se puede entrar con el botón **“Entrar sin cuenta (demo)”** y cambiar de rol desde la barra superior. Los datos sembrados incluyen solicitudes, préstamos, avisos, acuerdos, votaciones, tareas, ofertas, reportes y encuestas ficticias.

> Los datos y las cuentas demo no son credenciales reales. No reutilizar contraseñas personales.

---

## 6. Ejecutar con Supabase

### 6.1 Crear el proyecto

1. Crear un proyecto nuevo en [Supabase](https://supabase.com/).
2. Esperar a que termine la provisión de la base.
3. Guardar la **Project URL** y la **anon public key** desde *Project Settings → API*.
4. **No usar ni copiar la `service_role` key** en el frontend, en `.env` ni en el repositorio.

### 6.2 Crear el esquema

1. Abrir *SQL Editor* en Supabase.
2. Copiar todo el contenido de [`supabase/schema.sql`](supabase/schema.sql).
3. Ejecutarlo **una sola vez** en un proyecto nuevo.

El script crea:

- tablas, restricciones, secuencias e índices;
- trigger de creación automática del perfil al registrarse;
- triggers de `updated_at` y de protección de columnas;
- funciones transaccionales (`solicitar_prestamo`, `aprobar_solicitud`, `entregar_solicitud`, `registrar_devolucion`, `controlar_devolucion`, `asignar_rol`, `aceptar_oferta`, `guardar_encuesta`);
- la función de estadísticas `estadisticas_cooperativa()`;
- políticas RLS y permisos para el rol `authenticated`.

No incluye datos de prueba: la demo es independiente y vive en el navegador.

> **Si el SQL Editor corta el script o devuelve un error de sintaxis en una línea que no coincide**, ejecutá en orden los tres archivos de [`supabase/parts/`](supabase/parts/): `01_tablas.sql`, `02_funciones.sql` y `03_rls_permisos.sql`. Son exactamente el mismo contenido dividido en tres bloques, para pegarlos y ejecutarlos de a uno. No ejecutes un fragmento suelto: el error `syntax error at or near ")"` suele indicar que solo se pegó una parte de una tabla.

### 6.3 Configurar variables de entorno

Crear un archivo `.env.local` en la raíz:

```env
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=tu-clave-anon-publica
```

El archivo `.env.example` documenta las mismas variables y puede usarse como plantilla. `.env.local` no debe subirse al repositorio.

Reiniciar `npm run dev` después de crear o modificar el archivo.

### 6.4 Configurar autenticación

En *Authentication → Providers → Email*:

- para probar rápido, se puede desactivar temporalmente **“Confirm email”**;
- si se deja activada, cada persona recibe un correo de confirmación antes de ingresar;
- la aplicación contempla ambos casos: si el registro devuelve una sesión, entra directamente; si no, muestra el aviso de confirmación.

### 6.5 Primer usuario y primer rol

1. Registrarse desde la aplicación. El perfil se crea automáticamente como `estudiante`.
2. En el SQL Editor, asignar `presidente` a esa cuenta con el `update` de la sección 3.
3. Ingresar de nuevo y usar `/integrantes` para asignar los demás roles.
4. Crear los primeros útiles desde `/inventario` con la cuenta de administración.

### 6.6 Verificación rápida

En el SQL Editor:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

select trigger_name, event_object_table
from information_schema.triggers
where trigger_schema = 'public'
order by event_object_table, trigger_name;
```

---

## 7. Indicadores y reglas de cálculo

Los cuatro indicadores se calculan igual en la demo (`src/services/stats.js`) y en Supabase (`estadisticas_cooperativa()`). Si el denominador es **0**, el valor es **N/A**; nunca se muestra un 0 engañoso.

| Indicador | Fórmula | Meta |
|-----------|---------|------|
| Cobertura de solicitudes | solicitudes `atendida` ÷ solicitudes válidas (todas menos `cancelada`) | ≥ 90 % |
| Devoluciones a tiempo | devoluciones con fecha real ≤ fecha acordada y dentro de 7 días ÷ préstamos que vencían o ya finalizaron | ≥ 85 % |
| Devoluciones en buen estado | préstamos con condición `buen_estado` ÷ préstamos devueltos o perdidos con condición registrada | ≥ 95 % |
| Cumplimiento de tareas | tareas `terminada` ÷ tareas activas con fecha límite | ≥ 90 % |

Detalles:

- El plazo máximo se valida en el cliente y en la base: **7 días corridos**.
- Una solicitud `cancelada` no cuenta en la cobertura, pero permanece en el historial.
- Un préstamo sin devolver cuyo plazo todavía no venció no entra en el denominador de “a tiempo”.
- La condición `a_controlar` no cuenta como buena ni mala: se resuelve cuando administración controla la devolución.
- Los promedios de la encuesta comparan respuestas “antes” y “después” por curso. La reducción global solo se calcula para cursos que tienen ambos momentos y cuyos promedios “antes” son mayores que 0.

Visibilidad de estadísticas:

- **Presidencia:** los cuatro indicadores, tendencia, distribución, ranking, operación y agregados de la encuesta.
- **Administración:** cobertura, devoluciones a tiempo, buen estado, tendencia, distribución, ranking y operación.
- **Organización:** cumplimiento de tareas, tendencia y operación.
- **Secretaría, tesorería y comunicación:** estado de la operación.
- **Estudiantes:** resumen personal, historial propio y formulario de encuesta.

---

## 8. Modelo de datos

Tablas principales en Supabase:

| Tabla | Función |
|-------|---------|
| `perfiles` | Datos del integrante y rol. Se crea automáticamente desde `auth.users`. |
| `utiles` | Catálogo, stock total/disponible, dueño, origen y ubicación. |
| `solicitudes` | Pedidos de préstamo y su revisión. |
| `prestamos` | Préstamo entregado, fechas, estado y condición de devolución. |
| `reportes` | Avisos de daño o pérdida asociados a un préstamo. |
| `ofertas` | Donaciones o intercambios propuestos por integrantes. |
| `avisos` | Comunicaciones de la comisión de comunicación. |
| `acuerdos` | Decisiones registradas por secretaría. |
| `votaciones` / `votos` | Votaciones y un voto por integrante. |
| `movimientos` | Ingresos y egresos de recursos. |
| `actividades` / `tareas` | Planificación y cumplimiento de tareas. |
| `encuestas` | Respuestas privadas “antes/después” por curso. |

Cada tabla usa UUID como clave primaria. Los números legibles (`U-001`, `S-0001`, `P-0001`) se generan con secuencias.

### Historial y baja lógica

- No se borran solicitudes, préstamos, útiles, avisos, acuerdos, movimientos, actividades ni tareas.
- Se usan estados (`cancelada`, `rechazada`, `archivada`, etc.) y banderas `activo`.
- Las claves foráneas de autores y actores usan `on delete restrict` o `on delete set null` según corresponda, para no perder historia.
- La cancelación de una solicitud o una oferta solo es posible mientras está pendiente y por su autor; los triggers de protección bloquean cambios arbitrarios.

---

## 9. Seguridad

- Solo se usa la **anon public key**. La `service_role` nunca se expone.
- El registro siempre crea `estudiante`, aunque se manipule el formulario o la API.
- Solo presidencia puede ejecutar `asignar_rol()`.
- Las operaciones que mueven stock o cambian varios registros se ejecutan en funciones `SECURITY DEFINER` con validaciones de rol y estado.
- RLS está activo en todas las tablas.
- Las encuestas son privadas: cada persona solo puede leer sus propias filas. Los promedios agregados se obtienen con `estadisticas_cooperativa()` y solo presidencia recibe `encuestaImpacto`.
- Los reportes de daño/pérdida solo pueden crearlos quienes tienen el préstamo.
- Los votos solo se aceptan en votaciones abiertas, vigentes y con una opción válida.
- No se guardan contraseñas ni secretos en el repositorio.

Checklist antes de publicar:

1. Confirmar que `.env.local` está ignorado por git.
2. Verificar que no aparezca `service_role` en el código ni en el bundle.
3. Revisar las políticas RLS en el proyecto real.
4. Configurar los orígenes permitidos de autenticación.
5. Probar el flujo completo con cuentas de prueba reales.

---

## 10. Estructura del proyecto

```text
.
├── index.html
├── package.json
├── vite.config.js
├── .env.example
├── README.md
├── docs/
│   └── DECISIONES.md
├── supabase/
│   └── schema.sql
└── src/
    ├── main.js
    ├── App.vue
    ├── components/        # Shell, modales, tarjetas, badges, estados vacíos
    ├── data/              # Constantes, roles, cuentas demo y utilidades de fechas
    ├── lib/               # Cliente Supabase (solo anon key)
    ├── router/            # Rutas y guardas por rol
    ├── services/          # API demo, API Supabase, estadísticas
    ├── stores/            # Autenticación y notificaciones
    ├── styles/            # Sistema de diseño responsive
    └── views/             # Pantallas de la aplicación
```

---

## 11. Scripts

```bash
npm run dev      # Servidor de desarrollo
npm run build    # Build de producción en dist/
npm run preview  # Previsualizar el build
npm run check    # Alias del build (verificación rápida)
```

---

## 12. Pruebas realizadas

- `npm run build` compila correctamente (Vue + Vite).
- El esquema SQL se validó sintácticamente con un parser PostgreSQL (`pglast`).
- Smoke test en navegador del modo demo:
  - ingreso como Ana Pérez;
  - catálogo → detalle → solicitud `S-0057`;
  - cambio al rol de administración;
  - aprobación y entrega de `S-0057`, con descuento de stock de `U-017`;
  - devolución avisada por la estudiante (`P-0052`) y confirmación sin modal residual;
  - control de devolución de `P-0049` en buen estado, con retorno de stock de `U-013`;
  - navegación responsive y sin errores de consola observados.

No se pudo ejecutar una prueba end-to-end contra una instancia Supabase real porque el entorno de desarrollo no cuenta con credenciales. El adaptador y el SQL quedaron preparados para ese paso.

---

## 13. Limitaciones y próximos pasos

- No hay envío automático de correos (recordatorios de vencimiento, avisos, etc.).
- No hay carga de archivos ni fotos de los útiles.
- No hay notificaciones en tiempo real; las pantallas se actualizan al recargar o navegar.
- No hay pruebas automatizadas de interfaz ni de integración con Supabase.
- El modo demo guarda todo en un solo navegador y no sincroniza entre dispositivos.
- El proyecto administra una sola cooperativa; no es multi-escuela.
- La encuesta es anónima para el resto, pero presidencia ve agregados por curso, no respuestas individuales.
- El primer rol de presidencia requiere una intervención administrativa única en el SQL Editor.

Posibles mejoras: recordatorios por correo, exportación de estadísticas, carga de imágenes, notificaciones en tiempo real con Supabase Realtime, pruebas E2E con Playwright y un panel de auditoría de cambios.

---

## 14. Documentación adicional

Las decisiones de diseño, el mapeo de los 16 requerimientos, la justificación del backend y las alternativas descartadas están en [`docs/DECISIONES.md`](docs/DECISIONES.md).
