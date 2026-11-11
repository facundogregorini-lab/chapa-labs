# Centro comercial: Chapa Labs + habita. + Turnia

## Fuente de interacción actualizada: Habita 2a067b1 (09/11/2026)

La fuente de verdad del diseño de interacción es `axellaban/amoblaia` `main` a commit `2a067b11298e9f36bb074d7245c312f2ac23b5e7`, verificado contra `4917aa7` (6 commits). Cualquier actualización posterior exige reconsultar esa fuente antes de afirmar paridad.

- **Cola:** una sola fila de tarjetas comerciales (TODAS + siete etapas Habita); no duplicar el selector técnico. Turnia usa el mismo gesto con ocho etapas propias. Después KPIs, situaciones, resultados del contacto, filtros por regla, tabla y acción tomada.
- **Respuestas:** dos columnas, listado y conversación; texto literal, clasificación y derivados; los motores se encargan de registrar y de prevenir envíos automáticos.
- **Situaciones de origen producto (novedad):** `source=product` y `product_stage` en catálogo (validados en Habita por etapa), junto a los orígenes `whatsapp` y `manual`. Los filtros usan `productSituations[]`, sin inventar eventos.
- **Reglas:** ampliar opciones según `catalog.actions[stage]` del motor (incluye `encuesta_cierre` en etapas tras demo donde Habita lo permite) y copiar una regla existente como borrador de otra etapa; guardar sigue sujeto a compatibilidad y validaciones de Habita. El reminder de actividad de cuenta aparece por su definición en el catálogo, no por hardcode.
- **Turnia:** conserva sus mensajes, consentimientos, cadencias y cambios de etapa; la UI es análoga. El catálogo editable y reglas avanzadas de Turnia aún requieren contratos equivalentes. No declarar paridad al 100% hasta completar esa parte.
- **Nunca validar un despliegue solo por el build:** ejecutar pruebas de cola, respuestas, QA, locks, encuestas y clasificación por evento, incluyendo 10 acciones controladas por negocio. Distinguir estado `main`, preview, CI y producción.


## Commercial OS · navegación centralizada (09/11/2026)

Chapa Labs adopta un único workspace con selector **General / habita. / Turnia**. El diseño se comparte; los motores y bases siguen separados.

- **General**: resumen operativo de ambas colas; Cola, Embudos, Prospectos, Reglas y Mensajes, Resultados. Se suman tareas, respuestas y envíos, nunca tasas de conversión con definiciones distintas.
- **Por producto**: Cola de ejecución (Follow-up real, por defecto), Respuestas (inbox de la unidad), Embudo (etapas comerciales/etapas técnicas + filas accionables), Prospectos, Reglas y Mensajes, Resultados y Etapas y situaciones.
- **Habita**: siete etapas comerciales en la capa visual; las claves técnicas y el envío quedan en amoblaia. Se pueden editar reglas y versiones en Chapa a través de `rule-save` y `version-update`.
- **Catálogo Habita**: `followupSnapshot.catalog` trae etapas personalizadas, estados y overrides; `stage-create`, `state-save` y `state-delete` pasan por las funciones validadas del producto, no por una base nueva en Chapa.
- **Turnia**: misma navegación, cola, detalle, métricas, respuesta y embudo según sus propias etapas; configuración de reglas y catálogo sigue solo lectura hasta implementar APIs equivalentes.
- **Herramientas previas**: no se eliminaron; aparecen en navegación secundaria (también en mobile) mientras se verifica paridad y continuidad operativa.
- **Seguridad (modo experimental Habita, 10/11/2026)**: Habita permite editar reglas, versiones, etapas y situaciones desde una sesión de Chapa identificada por el nombre del operador **sin exigir `PROSPECTING_PASSWORD`**. La API de Chapa sigue requiriendo cookie de sesión y credencial de servidor para hablar con Habita; el motor Habita sigue aplicando validaciones de negocio y auditoría. **Esto NO es autenticación real del usuario**: con el modo abierto cualquier persona que pueda acceder al enlace puede identificarse con cualquier nombre y modificar las reglas de Habita. No compartir el enlace; antes de exponerlo a terceros, activar control de acceso real (ej. protección Vercel o integración de identidad) o establecer `PROSPECTING_PASSWORD` (12 caracteres o más). Turnia conserva la exigencia de sesión protegida para cambios sensibles. La protección por contraseña de Chapa sigue siendo opcional y, si se activa, protege todo el panel. No poner contraseñas en GitHub.
- **No cambia**: el contrato existente de tomar 10 minutos, abrir WhatsApp sin contar envío, confirmar idempotente, bloqueos, baja permanente, cadencias propias y auditoría en cada producto.
- **QA antes de retirar paneles duplicados**: validar login por persona, 10 ejecuciones reales con Facu y Axel simultáneamente, versiones y catálogo en habita., clasificación de no interesados, límites de WhatsApp, persistencia desde Chapa y conciliación de métricas por dos semanas.

- **Cola en mobile y «Quién ejecuta» (11/11/2026)**: Turnia usa el mismo espacio de trabajo y el mismo diseño mobile que habita. (encabezado, pestañas y estilos de `commercial-os.css` aplican a las dos unidades). En mobile, el header queda en Chapa Labs + General · Turnia · Habita y pasa directo a las pestañas de la cola; se ocultan la fila repetida de vistas, las herramientas anteriores y el encabezado «Ejecución comercial». Buscar, Filtros y métricas y Orden quedan dentro de un solo botón **Filtros**; no hay «Ejecutar siguiente». Debajo, el filtro **Quién ejecuta** (Todos · Extensión · Facu · Axel; Facu y Axel solo aparecen si tienen acciones) y cada tarjeta muestra quién la ejecuta debajo de EJECUTAR. Se calcula con el responsable de la tarea: sin responsable o «Extensión» = la extensión del producto (Facu en habita., Axel en Turnia).

- **General mobile y Resultados más visuales (11/11/2026)**: General usa el mismo espacio de trabajo (encabezado «Centro comercial» y pestañas Resumen · Cola · Embudos · Prospectos · Reglas y mensajes · Resultados) y los mismos estilos que habita. y Turnia, así que en el celular entra en pantalla. Resultados (y la ejecución en el Resumen) muestra lo mismo con menos ruido: barras sin texto cortado, el score primero en el celular, los días en una fila y las cohortes con la semana fija al desplazar. En Reglas, «Etapas comerciales» ya no deja un espacio vacío arriba. En el celular, las etiquetas de los chips quedan arriba y las tablas anchas se desplazan.

- **Turnia con el «Funnel comercial» de habita. (11/11/2026)**: en Turnia → Embudo se ve el mismo gráfico, con la misma interacción, que en habita. (barras con pasaron / se quedaron / perdidos, período, fechas y la revisión de cada uno al tocar una parte). Sus siete pasos son los de Turnia: saludados, demo enviada, visitaron la demo, conversaron con Sofi, cuenta creada, cuenta activa y clientes pagos. Los datos (`chart`, `lostAt` y `chartRows`) los manda la API de Turnia (turniasalud#176), y Chapa le pasa el período igual que a habita. En la revisión, Turnia solo deja cambiar la situación: su etapa sale de lo que hizo cada persona. Mientras la API de Turnia no mande el gráfico, se ve la vista de antes.
- **Evolución semanal en el Resumen (11/11/2026)**: lo primero del Resumen general es «Evolución semanal»: una tarjeta por producto (Turnia y habita.), separadas y sin sumar, con un gráfico de líneas curvas de cada paso de su embudo, semana a semana (lunes a domingo; 4 semanas por defecto, 8 o 12). Cada paso es un botón para sumarlo o sacarlo; de entrada van marcados Contactados, Conversaron con Sofi y Demos enviadas en Turnia, y Contactados, Interesados y Demos enviadas en habita. (los pasos son las etapas del Follow-up de cada unidad desde el 11/11). Cada semana usa la misma cuenta del embudo contra la meta (`core.targetFunnel` con el período lunes–domingo de esa semana, hasta hoy en la semana en curso): en habita. los pasos de la app salen de `/api/metricas?desde&hasta` de cada semana (`prospeccion.periodo`), un pedido por semana, de a uno; no se usa `porDia`, que no trae demos, visitas ni interacción. Los pasos son píldoras chicas (nombre, total y variación) para que el gráfico ocupe la tarjeta. La semana en curso va punteada y la variación compara las dos últimas semanas completas. En el celular las fechas se ralean.
- **Resumen general en el celular (11/11/2026)**: primero el embudo de cada producto (Turnia y habita.) y después la cola de cada uno («Turnia · Cola», «habita. · Cola»), luego «Cómo avanzó» y «Ejecución → avance» («Qué conviene hacer» antes del gráfico en el celular). En el celular el embudo contra la meta se lee en filas y los períodos van en una sola fila, sin párrafos; en vez del aviso «Cargando los embudos…» queda un «Actualizando…» chico, y si un embudo no tiene conversiones en el período lo dice en vez de «Todos los pasos convierten en meta». **El resto de las vistas (Cola, Embudo, Resultados, Reglas, Respuestas) queda como en producción, igual en habita. y Turnia**; solo se arreglaron cosas rotas: en el Embudo de Turnia los contactos de la etapa no se veían en el celular (ahora como tarjetas, las mismas de la cola), el texto de las reglas se encimaba y los filtros se salían de la pantalla; el corte de una barra del Funnel comercial tapaba su número; la barra de ejecutadas cortaba el texto; y el contador de un negocio sin cargar mostraba «—».

- **Prospectos, antes de la cola (11/11/2026)**: en habita. → Prospectos se ven todas las inmobiliarias que todavía no recibieron el saludo, ordenadas por ranking (contactabilidad, encaje y facilidad de armar la demo), con su estado (Descubierto → Enriquecido → Calificado → En cola, o Descartado) y lo que les falta para entrar a la cola. Al tocar una se abre su ficha para cargar los datos (fuente, contacto, quién decide, cartera, necesidad visual, madurez digital, competencia), pasarla a la cola, sacarla o descartarla; «Sumar las mejores» pasa a la cola las calificadas de mejor ranking y, de cada tanda de 5 o más, 15% al azar (exploración). La pestaña **Aprendizajes** cruza cada variable con lo que pasó después (número válido, respuesta, interés, demo con interacción, clientes), con filtro por primer mensaje y «muestra chica» con menos de 30. Todo lo define y lo guarda habita. (`GET /api/prospeccion?vista=prospectos` y `POST { prospectos: { op } }`, amoblaia `docs/PROSPECCION.md` §12); Chapa lo muestra (`prospecting/pool-view.js`, `pool.css`) y pasa cada operación por `?op=pool` a nombre de quien opera. La unidad lo prende con `pool: true` en `units.js`. **Turnia: pendiente** (decisión del 11/11: primero habita. en producción); hasta entonces su pestaña Prospectos sigue como antes. Para llevarlo, turniasalud tiene que exponer el mismo contrato con sus propias variables (el catálogo viaja en la respuesta, así que la vista no cambia).

**Estado técnico:** la UI y los endpoints quedaron implementados en ramas; las pruebas con bases y credenciales reales, deploy y paridad funcional total de Turnia deben verificarse por separado.


Traspaso para quien siga este trabajo (persona o IA), sin necesidad de leer conversaciones anteriores. Estado al **08/11/2026**.

## Modo extensión y semanas de lunes a domingo (11/11/2026)

- **Quién ejecutó (persona o bot).** La extensión del navegador usa el mismo Chrome y la misma sesión que una persona, así que no hay forma técnica de distinguirlas. Por eso la extensión se identifica: abrí su pestaña con **`https://chapa-labs.vercel.app/prospecting?agente=1`**. Esa pestaña muestra la franja «Modo extensión» y todo lo que se confirme desde ahí llega a habita y a Turnia con `ejecutor: "bot"` y se guarda como `executed_by = 'bot'`. `?agente=0` lo apaga; las otras pestañas siguen siendo de personas. En las instrucciones de la extensión, que siempre abra ese enlace.
- **Semanas:** lunes a domingo en todo (Resumen, Resultados, cohortes y semanas de habita y Turnia). Cada semana se nombra por su domingo de cierre.

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

- **Chapa:** `npm test` (58 tests). Para mirarlo en el navegador sin tocar producción, se puede levantar un servidor local que cargue `api/prospecting.js` con `_google.js` simulado y `global.fetch` devolviendo colas de ejemplo. Así se hizo la verificación del 08/11; el servidor no quedó en el repo.
- **Turnia:** levantar un Postgres local y correr `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres npx vitest run` (544 tests). Las pruebas de la cola están en `src/test/followup-queue.integration.test.ts` y las de la lectura de WhatsApp en `src/test/whatsapp-sync.integration.test.ts`. CI corre `npx next typegen` antes de `tsc`.
- **habita.:** `npx vitest run` (1265 tests); las pruebas de este contrato están en `tests/followup-chapa.test.ts`.

## El embudo de Turnia y las versiones de su demo (08/11)

- **Hablar con Sofi es la conversión de la demo:** la persona le escribió o le habló. Es la misma definición en los cuatro lados:
  - el embudo semanal de Turnia (`EMBUDO.md`, `npm run embudo`);
  - PostHog;
  - Chapa;
  - el panel de Turnia.
  
  Antes, el embudo semanal contaba como «interacción» que empezara la charla, y el panel contaba como conversión «la probaron».
- **Dos versiones de la demo personal:**
  - **A:** con «Probar la demo», hasta el 07/11 a las 12:30.
  - **B:** la pantalla única con la esfera, desde ese momento.
  
  Se comparan de punta a punta, abrieron → hablaron con Sofi:
  - **en Chapa:** Turnia → Embudo → «La demo, por versión»;
  - **en PostHog:** tablero «Turnia · Prospección» → «Turnia · Demo personal: A contra B», por visita;
  - **en Turnia:** `npm run embudo`.
- **Dónde se define cada embudo:**

  | Dónde | Pasos | Archivo |
  | --- | --- | --- |
  | Embudo semanal | saludos → demos enviadas → visitadas → hablaron con Sofi → cuentas creadas → activas → clientes pagos | turniasalud `EMBUDO.md` y `scripts/embudo.mjs` |
  | Chapa, «Embudo contra la meta» y el embudo de la demo | saludos → demos enviadas → abrieron → hablaron con Sofi → llamada agendada → Clientes Fundadores | chapa-labs `prospecting/units.js` (`targets`) |
  | Follow-up | sin saludo → … → conversó, sin cuenta → cuenta, sin actividad → activa, sin pago | turniasalud `src/lib/sales/followup-stages.ts` |
  | PostHog | demo enviada → visitó → habló con Sofi → respondió | tablero «Turnia · Prospección» |

- **Diferencia pendiente:** después de «hablaron con Sofi», el embudo semanal y el Follow-up siguen por la cuenta (creada, activa, pago), mientras que Chapa sigue por la llamada y el Cliente Fundador. Hay que acordar cuál es el final del embudo.

## Estado al 08/11/2026

- **En producción:**
  - amoblaia#200: el Follow-up de habita. se puede operar desde Chapa.
  - turniasalud#148: Turnia tiene la cola de Follow-up de habita.
  - chapa-labs#44 y #45: la bandeja comercial.
- **Verificado en vivo (solo lectura):** la bandeja leyó las dos colas sin errores.
  - **habita.:** 6 tareas listas (demos pendientes).
  - **Turnia:** 0 listas, porque era domingo y la regla de horario las bloquea; 331 bloqueadas y 64 programadas.
- **No probado en vivo:** tomar y confirmar una tarea real (se evitó escribirle a prospectos reales). Está cubierto por tests con base real y por un recorrido en Chromium con APIs simuladas.

## Responder (09/11)

La vista **Responder** (`/prospecting/<unidad>?vista=responder`) es la bandeja de quienes escribieron último, con su mensaje textual y la respuesta armada. Está detallada en `PROSPECCION.md` → «Responder».

- **Turnia:** los datos salen de `GET ?vista=filas` → `whatsappInbox` (turniasalud#162). Registra con las acciones `sent` (con `line`), `conversation` y `refer`.
- **habita.:** salen de la bandeja de su Follow-up (`inbox`). Registra con `op: "reply"` sobre la respuesta, con su clasificación. La derivación va con `contactoNombre` y `contactoWhatsapp`.

## Pendientes, en orden

1. **Primera tanda real**, 10 por producto. Facu y Axel en paralelo: tomar, abrir WhatsApp, confirmar.
   - Hay que comprobar que el otro ve «Lo tiene…».
   - Hay que comprobar que el envío aparece en el panel de cada producto: habita. → `/admin/follow-up` y Adquisición; Turnia → Panel → Prospección.
2. **Login por persona.** Hoy el panel está **abierto**, por decisión del usuario del 08/11: cualquiera con el link ve nombres y teléfonos y puede registrar contactos.
   - Mínimo: poner `PROSPECTING_PASSWORD` (12 caracteres o más) en Vercel; ver `api/_session.js`.
   - Mejor: una contraseña por persona o Google, así el nombre de quien opera no se puede inventar.
3. **Crear una demo de habita. desde Chapa.** Falta una API segura en amoblaia; hoy «Su panel» abre el editor. Turnia no lo necesita: cada prospecto tiene su demo `/p/<código>` desde que se importa.
4. **Respuestas automáticas.**
   - **Turnia: hecho (08/11) con la lectura diaria de WhatsApp.** Turnia lee una vez por día los chats de sus dos líneas de WAHA (0022 y 5483), cruza con la base y pasa cada respuesta nueva a «Respuestas para atender» (detalle en turniasalud `CENTRO_COMERCIAL.md`). Chapa la dispara con su cron a las 8 y muestra el resumen en Hoy. Falta mirar la primera lectura real: si una línea dice «sin conectar», falta `WAHA_PROSPECCION_5483` en Vercel de Turnia; si dice «store», hay que prender el historial de esa sesión en WAHA.
   - **habita.:** no usa WAHA. Su extensión de Chrome, que trabaja sobre WhatsApp Web, registra las respuestas con clasificación (`followup_replies`). Lo que se responda sin pasar por la extensión hay que registrarlo a mano.
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
   **Resumen general (11/11/2026, `prospecting/overview.js`):** «¿La ejecución está moviendo los embudos?». Una columna por producto (habita. a la izquierda, Turnia a la derecha): su Embudo contra la meta en barras verticales (los mismos `targets` y `core.targetFunnel` de la vista Embudo, con la conversión de cada paso contra la esperada y el paso donde se frena) y, debajo, «¿Se ejecutó la cola?» tal cual está en Resultados. Después, «Cómo avanzó» (la cohorte contactada cada día o semana en el paso elegido, contra la meta; habita. la manda por día en `/api/metricas → prospeccion.porDia`) y «Ejecución → avance» (cada paso por cuánto se ejecutó la cola de su etapa —`units.js → queueSteps`— y cuánto convirtió contra la meta, con qué conviene hacer). Períodos: 7, 14 o 30 días y este mes.
   **Resultados en tres lecturas (11/11/2026, `prospecting/results-view.js`):** (1) «¿Se ejecutó la cola?»: pendientes → ejecutadas (persona / bot) → exitosas (con conversión atribuida, con la definición de cada producto), por hoy, ayer, 7 días o fechas elegidas, con el score de ejecución (60% cobertura + 40% éxito, configurable); cada barra se abre en sus tipos de acción y cada día del gráfico filtra el período. Los datos son `results.execution` de cada API (habita.: foto diaria `followup_queue_days`, migración 202612110001 de amoblaia; Turnia: `sales_followup_queue_days` en su schema.sql). (2) «Qué acciones convierten»: una fila por tipo de acción (`results.actionLabels`), con su tendencia de 8 semanas (`weeklyByType`); al abrirla (clic o doble clic), las etapas donde corrió y sus versiones. (3) Cohortes como mapa de calor con las etapas del panel: Inmobiliarias en habita. (`results.cohortFunnel`) y Odontólogos en Turnia (calculadas en Chapa desde sus cuentas). En «General» se muestran las dos unidades por separado, sin mezclar tasas. **Revisión del 11/11:** ejecutadas y exitosas suman todos los días del período (antes, los días sin foto de la cola quedaban afuera: con la foto recién empezada, casi todo); el «% de pendientes» y el score se miden solo con los días con foto (`executedCaptured`). En Turnia la cola cuenta también los mensajes que salieron sin «Confirmar envío» (Prospección, lote, lectura de WhatsApp: antes daba 0) y, en los dos productos, el saludo es exitoso si respondieron.

## Reglas que no se rompen

- **Repo público:** el de Chapa no lleva ids de planillas, claves ni datos personales. Las listas de prospectos se pasan por chat o por archivo y se importan en el panel de cada producto: nunca van a ningún repo.
- **habita. → Turnia:** cada mejora de habita. se lleva a Turnia, adaptada a sus etapas y su cadencia (ver `CLAUDE.md` o `AGENTS.md`).
- **WhatsApp:** abrir el chat no cuenta como envío. El contacto cuenta cuando se confirma que salió. Nunca se envía solo, sin aprobación.
- **Saludo y bajas (Turnia):** la secuencia le habla a la recepción (09/11): el saludo va primero, sin link; cuando responde, el Paso 2 pide permiso (tampoco lleva link ni cuenta); el link va en el Paso 3 o, a las 24 h sin respuesta, en el Seguimiento 1. Tres mensajes como máximo (el link y los Seguimientos 2 y 3); «Pidió no recibir más» es para siempre. Ver `docs/PROSPECCION.md` y, en turniasalud, `PLAN_PROSPECCION.md` → «Los mensajes».
- **Esquemas:**
  - En habita., cada migración se aplica a mano en el SQL Editor de Supabase; hay que dar el enlace al archivo.
  - En Turnia, el build de producción aplica `supabase/schema.sql`, que tiene que ser idempotente.
- **Ramas mergeadas:** si la rama de trabajo ya tiene un PR mergeado, hay que rehacerla desde `main`. Si no se puede forzar el push, se une la rama vieja con `git merge -X ours` (su contenido ya está en `main`) y se pushea normal.
- **Hora de las tomas:** la de Turnia usa la del servidor de la app, no la de la base, para que coincida con cómo se leen.
- **Horario de Turnia:** de lunes a sábado de 8:30 a 21; los contactos nuevos, hasta las 20. Los domingos toda la cola de Turnia aparece «Fuera de horario»: es lo esperado.
