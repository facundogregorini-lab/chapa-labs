# Centro comercial: Chapa Labs + habita. + Turnia

Traspaso para quien siga este trabajo (persona o IA), sin necesidad de leer conversaciones anteriores. Estado al **08/11/2026**.

## En una frase

Chapa Labs (`/prospecting`) es la **única pantalla comercial** de los dos productos. **No guarda prospectos ni corre su propio motor de seguimiento.** Cada producto es dueño de sus datos y de su Follow-up, y los expone por la misma API. Chapa los lee, los muestra juntos y manda cada acción al producto que corresponde, a nombre de quien opera.

| Repositorio | Producto | Qué hace en este sistema |
| --- | --- | --- |
| `facundogregorini-lab/chapa-labs` (público) | Chapa Labs | Interfaz y una sola función de Vercel (`api/prospecting.js`). Sin base propia. Producción: `chapa-labs.vercel.app/prospecting` |
| `axellaban/amoblaia` | habita. (a veces llamada «Avita») | Prospección y Follow-up en Supabase. Producción: `www.habitaia.app` |
| `axellaban/turniasalud` | Turnia | Prospección y Follow-up en Postgres (Neon). Producción: `turniasalud.app` (`turniasalud.vercel.app` redirige) |

**Ojo:** existe otro repo, `axellaban/chapa-labs`, que **no** es el que se publica. El que importa es `facundogregorini-lab/chapa-labs`.

## Cómo se conectan

```
Navegador ──► chapa-labs.vercel.app/api/prospecting
                 │  ?op=followup   (GET: lee la cola de cada producto)
                 │  ?op=task       (POST: una acción sobre una tarea)
                 │  ?op=data       (GET: cuentas e historia de una unidad)
                 ▼
   habita.  www.habitaia.app/api/prospeccion     Turnia  turniasalud.app/api/prospeccion
            Authorization: Bearer <clave>                 Authorization: Bearer <clave>
```

- **Claves** (solo en Vercel, nunca en el repo):
  - Chapa usa `HABITA_PROSPECTING_SECRET` o `HABITA_METRICS_SECRET`, y `TURNIA_PROSPECTING_SECRET` o `TURNIA_METRICS_SECRET`.
  - Cada producto acepta su `PROSPECTING_API_SECRET` o `METRICS_SECRET`, de 32 caracteres o más.
- **URLs opcionales:** `HABITA_PROSPECTING_API_URL` y `TURNIA_PROSPECTING_API_URL`. Por defecto, las de `prospecting/units.js`.
- **Redirecciones:** `api/_authfetch.js` sigue las redirecciones sin perder la clave.

## Quién es dueño de cada dato

| Dato | Dueño | En Chapa |
| --- | --- | --- |
| Prospectos, contactos, bajas, envíos, respuestas | La base de cada producto | Se lee por API en cada carga |
| Etapa, situación, próxima acción, bloqueos | El motor de Follow-up de cada producto | Llega calculado; Chapa no lo recalcula |
| Mensajes (versiones A/B) y reglas | Cada producto | Se editan desde Secuencias, por API |
| Tomas de 10 minutos (claims) | Cada producto | Chapa muestra «Lo tiene Facu» |
| Demo, visitas, cuenta, uso, pagos | Cada producto | Solo lectura |
| Quién opera y su sesión | Chapa (cookie con el nombre) | — |

Turnia también escribe una copia en una planilla de Google, pero ya no es la fuente de datos de Chapa. Ahora Chapa lee de `GET ?vista=filas`, y la planilla queda solo como respaldo si eso falla.

## El contrato (igual en los dos productos)

Sobre `/api/prospeccion` de cada producto:

- `GET ?vista=followup` devuelve `{ labels, summary, queue, scheduled, blocked, inbox, funnel, stages, rules, results, changes }`. Turnia suma `timing`.
- `POST { by, followup: { op, ...campos } }`:
  - **`by`** es el nombre de quien opera.
  - **Campos:** `inmobiliaria` (id de la persona o inmobiliaria; en Turnia también sirve el código), `etapa`, `tarea` (solo en habita.: la clave de la acción), `version`, `texto`, `motivo`, `tipo` (`sin_whatsapp` o `numero_incorrecto`), `situacion`, `clasificacion`, `hasta`, `volver`, `prioridad`, `responsable` y `valores`.
  - **Operaciones:**

    | `op` | Qué hace |
    | --- | --- |
    | `queue` | Devuelve la cola |
    | `claim` | Toma 10 minutos y devuelve el mensaje armado |
    | `open` | Registra que se abrió WhatsApp (no cuenta como envío) |
    | `confirm` | Registra el envío (idempotente) |
    | `fail` | Registra que no salió |
    | `release` | Suelta la tarea |
    | `situation` | Guarda la situación de la conversación |
    | `reply` | Registra una respuesta |
    | `replies` | Devuelve la bandeja de respuestas |
    | `snooze` | Reprograma |
    | `priority` | Cambia la prioridad |
    | `owner` | Asigna responsable (solo Turnia) |
    | `version-create` | Crea una versión |
    | `version-update` | Edita una versión (solo habita.) |
    | `version-status` | Cambia el estado de una versión |
    | `rule-save` | Guarda una regla (solo habita.) |
  - **Errores:** 409 si la tiene otra persona o la tarea cambió; 400 o 422 si el pedido es inválido.
- **Turnia, además:** `GET ?vista=filas` devuelve `{ header, rows, events }`, con las mismas columnas que la pestaña «Prospección».

Implementación:
- **habita.:** `src/lib/followup/chapa.ts`, que llama a las mismas funciones que `/api/admin/followup/*` y a su extensión de Chrome. Documentado en `docs/FOLLOWUP.md` → «Desde Chapa Labs».
- **Turnia:** `src/lib/sales/followup-plan.ts` (lógica pura) y `src/lib/sales/followup-queue.ts`. Documentado en `PLAN_PROSPECCION.md` → «La cola, operada desde Chapa Labs».

### Quién opera

- **habita.** busca el usuario del equipo (`ADMIN_EMAILS`) cuyo nombre de pila coincide con `by`. Si nadie coincide, usa `PROSPECTING_ACTOR_ID` con el nombre que mandó Chapa; un claim de otra persona con ese mismo usuario igual frena la operación.
- **Turnia** guarda el nombre tal cual en `sales_followup_claims.actor`, `sales_followup_executions.actor` y `sales_followup_audit`.
- **Para que las tomas funcionen bien**, Facu y Axel tienen que entrar a Chapa con su nombre de pila: «Facundo» o «Facu», y «Axel».

## Chapa Labs por dentro

| Archivo | Qué hace |
| --- | --- |
| `prospecting/followup.js` | Lógica pura: junta las dos colas en una forma común, filtra, cuenta, arma los campos de cada operación y las filas de versiones, reglas y responsables. Tests en `tests/prospecting-followup.test.js` |
| `prospecting/app.js`, sección «Bandeja comercial» | Las pantallas: Hoy, Pipeline, Prospectos, Secuencias y Rendimiento con «Todas», la pestaña Follow-up de cada unidad, el detalle de la tarea y la ficha con «Actividad de producto» |
| `api/prospecting.js` | `doFollowup` y `doTask`. Turnia lee sus filas con `unit.api.rowsQuery`. Tests en `tests/prospecting-api.test.js` |
| `prospecting/units.js` | Configuración de cada unidad (URL de la API, `rowsQuery` de Turnia) |
| `docs/PROSPECCION.md` | Guía del panel, con la sección «Bandeja comercial» |

**Vistas y URL:**
- `/prospecting` y `?vista=pipeline|prospectos|secuencias|rendimiento|resumen`.
- `/prospecting/turnia?vista=followup` y su equivalente para habita.

**Comportamiento:** la cola se relee cada minuto mientras está a la vista, salvo con una tarea abierta.

## Cómo probar

- **Chapa:** `npm test` (56 tests). Para mirarlo en el navegador sin tocar producción, se puede levantar un servidor local que cargue `api/prospecting.js` con `_google.js` simulado y `global.fetch` devolviendo colas de ejemplo. Así se hizo la verificación del 08/11; el servidor no quedó en el repo.
- **Turnia:** levantar un Postgres local y correr `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres npx vitest run` (540 tests). Las pruebas de la cola están en `src/test/followup-queue.integration.test.ts`. CI corre `npx next typegen` antes de `tsc`.
- **habita.:** `npx vitest run` (1265 tests); las pruebas de este contrato están en `tests/followup-chapa.test.ts`.

## Estado al 08/11/2026

- **En producción:**
  - amoblaia#200: el Follow-up de habita. se puede operar desde Chapa.
  - turniasalud#148: Turnia tiene la cola de Follow-up de habita.
  - chapa-labs#44 y #45: la bandeja comercial.
- **Verificado en vivo (solo lectura):** la bandeja leyó las dos colas sin errores.
  - **habita.:** 6 tareas listas (demos pendientes).
  - **Turnia:** 0 listas, porque era domingo y la regla de horario las bloquea; 331 bloqueadas y 64 programadas.
- **No probado en vivo:** tomar y confirmar una tarea real (se evitó escribirle a prospectos reales). Está cubierto por tests con base real y por un recorrido en Chromium con APIs simuladas.

## Pendientes, en orden

1. **Primera tanda real**, 10 por producto. Facu y Axel en paralelo: tomar, abrir WhatsApp, confirmar.
   - Hay que comprobar que el otro ve «Lo tiene…».
   - Hay que comprobar que el envío aparece en el panel de cada producto: habita. → `/admin/follow-up` y Adquisición; Turnia → Panel → Prospección.
2. **Login por persona.** Hoy el panel está **abierto**, por decisión del usuario del 08/11: cualquiera con el link ve nombres y teléfonos y puede registrar contactos.
   - Mínimo: poner `PROSPECTING_PASSWORD` (12 caracteres o más) en Vercel; ver `api/_session.js`.
   - Mejor: una contraseña por persona o Google, así el nombre de quien opera no se puede inventar.
3. **Crear una demo de habita. desde Chapa.** Falta una API segura en amoblaia; hoy «Su panel» abre el editor. Turnia no lo necesita: cada prospecto tiene su demo `/p/<código>` desde que se importa.
4. **Respuestas automáticas.** En Turnia, leerlas desde WAHA; hoy se registran a mano con «Registrar una respuesta». habita. tiene la bandeja con clasificación (`followup_replies`), alimentada por su extensión.
5. **Retirar lo repetido**, después de dos semanas sin diferencias entre Chapa y los paneles de cada producto:
   - La pestaña «Mensajes» de Chapa, que usa la planilla.
   - La cola «Hoy» por unidad, que Chapa calcula sobre la planilla.
   - Las pantallas comerciales repetidas de cada producto.
   - **No borrar nada sin esa comparación.**
6. **Mejoras en Turnia:**
   - Reglas editables como en habita. (hoy siguen la cadencia de Prospección, en días hábiles).
   - Edición de versiones (hoy se crea la siguiente).
   - Mostrar situaciones, tomas y bloqueos en su propio Panel → Follow-up, que sigue como antes.
7. **Rendimiento:** en habita. no hay tiempo entre etapas por persona, porque su embudo no guarda cuándo se llegó a cada paso; solo hay tiempo hasta la conversión por versión.

## Reglas que no se rompen

- **Repo público:** el de Chapa no lleva ids de planillas, claves ni datos personales. Las listas de prospectos se pasan por chat o por archivo y se importan en el panel de cada producto: nunca van a ningún repo.
- **habita. → Turnia:** cada mejora de habita. se lleva a Turnia, adaptada a sus etapas y su cadencia (ver `CLAUDE.md` o `AGENTS.md`).
- **WhatsApp:** abrir el chat no cuenta como envío. El contacto cuenta cuando se confirma que salió. Nunca se envía solo, sin aprobación.
- **Saludo y bajas (Turnia):** el saludo va primero, sin link; tres mensajes como máximo; «Pidió no recibir más» es para siempre.
- **Esquemas:**
  - En habita., cada migración se aplica a mano en el SQL Editor de Supabase; hay que dar el enlace al archivo.
  - En Turnia, el build de producción aplica `supabase/schema.sql`, que tiene que ser idempotente.
- **Ramas mergeadas:** si la rama de trabajo ya tiene un PR mergeado, hay que rehacerla desde `main`. Si no se puede forzar el push, se une la rama vieja con `git merge -X ours` (su contenido ya está en `main`) y se pushea normal.
- **Hora de las tomas:** la de Turnia usa la del servidor de la app, no la de la base, para que coincida con cómo se leen.
- **Horario de Turnia:** de lunes a sábado de 8:30 a 21; los contactos nuevos, hasta las 20. Los domingos toda la cola de Turnia aparece «Fuera de horario»: es lo esperado.
