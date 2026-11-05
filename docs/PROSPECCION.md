# Prospección (`/prospecting`)

Actualizado: 03/11/2026. La operación comercial de Turnia y habita. en un solo panel: un **panel base** con el motor, la forma de medir y la interfaz, y encima **un panel por unidad** con su ICP, su propuesta de valor, sus plantillas y su cadencia. Una mejora al panel base llega a las dos; lo propio de cada una vive en `prospecting/units.js`.

- `/prospecting`: resumen de todas las unidades (embudos lado a lado, contactos por día, lo que pasa en el producto).
- `/prospecting/turnia` y `/prospecting/habita`: **Hoy** (cola del día), **Embudo**, **Cuentas**, **Mensajes** y **Playbook**.
- `/prospecting?ejemplo=1`: recorrido con cuentas ficticias. No lee ni escribe ninguna planilla.

## Cómo está armado

| Archivo | Qué hace |
| --- | --- |
| `prospecting/core.js` | El motor, igual en el navegador y en el servidor: lee las columnas de cualquier planilla, traduce los estados a etapas comunes, calcula el embudo, la cola del día y la respuesta por plantilla, y aplica cada acción (qué cambia en la fila y qué se anota en Actividad). |
| `prospecting/units.js` | Turnia y habita.: ICP, propuesta, reglas, objeciones, nombres de las etapas, plantillas, cadencia, meta diaria, quién entra en la cola y qué métricas del producto siguen al embudo. |
| `prospecting/app.js`, `index.html`, `glass.css`, `glass.js` | La interfaz. |
| `api/prospecting.js` | Una sola función (Vercel Hobby permite 12): sesión, lectura y escritura de la planilla. |
| `api/_google.js`, `api/_session.js` | Google Sheets por API REST con una cuenta de servicio (JWT firmado con `node:crypto`, sin dependencias) y la cookie de sesión. |
| `tests/` | `npm test`: el motor y la función con una planilla simulada. |

### Lo mejor de cada panel

| De Turnia | De habita. |
| --- | --- |
| Cola «Para hoy» en bloques (conversaciones, esperan la demo, seguimientos, nuevos hasta la meta), plegables y recordados | Abrir el canal no es enviar: el contacto cuenta cuando se confirma que salió |
| Saludo primero y sin link; tres mensajes como máximo; el seguimiento se agenda solo en días hábiles | Medición por cohorte del primer contacto, ventana de 7 días, «en observación» y «muestra chica» con n<30 |
| Quien abrió o probó su demo sube en los seguimientos; «después de probar la demo» reemplaza al seguimiento | Respuesta por plantilla con atribución al último toque dentro de la ventana, sin ganadora automática |
| Deshacer el último contacto; «Pidió no recibir más» lo saca para siempre | Historial que no se borra (Actividad es solo agregar; deshacer deja un evento nuevo), evidencia en cada resultado |
| Guion de llamada, Instagram sin link, búsqueda de Instagram y Google desde la ficha | Desglose por SDR, campaña, zona, canal y prioridad; contactos «por revisar» no entran en la cola |

### Cómo se mide (igual en todas las unidades)

Las etapas son las mismas para todas (`por_contactar`, `saludado`, `contactado`, `respondio`, `interesado`, `reunion`, `cliente`, y cerradas `perdido`, `invalido`, `baja`); cada unidad las nombra a su manera («Demo enviada» en Turnia, «Enviado» en habita.). Por eso se pueden sumar en el resumen general.

- **Prospectados**: toda la base filtrada; no depende del período. En Turnia no cuentan los fijos que no respondieron (no tienen WhatsApp), como en su panel.
- **Contactados**: cohorte de primer contacto dentro del período.
- **Respondieron, Interesados, Reunión o demo, Clientes**: cada etapa incluye a las siguientes. Las fechas de cada hito quedan en su columna, así que una cuenta perdida después de responder sigue contando como que respondió.
- **Abrió o probó la demo**: señal aparte, nunca interés.

### Agregar y desagregar

- **Arriba**: `/prospecting` suma las dos unidades con las mismas definiciones y muestra, para cada una, lo que pasa después del contacto desde su `/api/metricas` (Turnia: demos de Sofi, pedidos de demo, clínicas activas y turnos; habita.: demos publicadas, inmobiliarias vinculadas, activadas e ingresos). La web y el producto siguen en el tablero (`/#turnia`, `/#amobla-ia`).
- **Abajo**: en el Embudo de cada unidad, tocar una fila de «Por segmento» filtra todo el panel por ese valor (zona, SDR, prioridad…); tocar una etapa del embudo lleva a esas cuentas; tocar una cuenta abre su ficha.
- El período (histórico, 7 días, 30 días, este mes) aplica al embudo, a los desgloses y a `/api/metricas`.

## Enviar con un agente de IA (`?vista=enviar`)

Una sola tarjeta en un lugar fijo, para una persona o para un agente con computer use (por ejemplo, Claude en Chrome, que alterna entre este panel y la pestaña de WhatsApp Web). En la vista están las **instrucciones para el agente**, listas para copiar.

- **Orden:** seguimientos que tocan hoy (primero quienes abrieron o probaron su demo), saludos por revisar (¿respondió?) y nuevos hasta la meta del día. «Saltar» lo manda al final de la sesión. Las conversaciones abiertas no entran: las contesta una persona.
- **Estado en `data-state`** de `[data-testid="agent"]`: `ready` (se puede abrir), `check` (mirar si respondió el saludo), `opened` (falta confirmar), `wait` (pausa entre envíos), `paused` (fuera de horario o solo lectura), `done` (meta cumplida o cola vacía), `stopped` (tres «no salió» seguidos: revisar WhatsApp).
- **Datos para verificar:** `agent-name`, `agent-phone` (con 549), `agent-message` (el texto exacto), y en la tarjeta `data-account-id`, `data-phone`, `data-expected-name`, `data-template` y `data-wa-url` (el link de WhatsApp Web).
- **Botones:** `agent-open-whatsapp`, `agent-confirm-sent`, `agent-not-sent`, `agent-no-whatsapp`, `agent-skip`, `agent-open-chat`, `agent-replied` y `agent-override-hours`.
- **Ritmo:** después de cada envío confirmado, una pausa al azar de 45 a 90 segundos (`pacing` en `units.js`). Franjas de envío (`sendWindows`): Turnia 8:30–9:30 y 13–14:30; habita. 9–12:30 y 15–18. Fuera de franja, «Mandar igual» (con confirmación) vale hasta el fin del día.
- **WhatsApp:** abre WhatsApp Web directo (`web.whatsapp.com/send`), sin la página intermedia de `wa.me`; en el celular, `wa.me` abre la app. WhatsApp Web no deja que otra página reutilice su pestaña (política de aislamiento), así que cada apertura es una pestaña nueva: el agente la cierra después de enviar.

### Auditoría contra los paneles originales (04/11/2026)

| Tema | Turnia (`/panel/prospeccion`) | habita. (`/admin/prospeccion`) | Este panel, antes | Ahora |
| --- | --- | --- | --- | --- |
| Abrir WhatsApp | WhatsApp Web directo en la computadora | `wa.me` en una pestaña nueva | `wa.me` y una pestaña nueva por envío | WhatsApp Web directo; `wa.me` solo en el celular |
| Cuándo cuenta el contacto | Al tocar (se deshace si no salió) | Al confirmar que salió | Al confirmar | Igual, y la pregunta «¿salió?» sobrevive a una recarga |
| Doble registro | — | Clave de idempotencia | Posible | Un reintento del mismo paso en 2 minutos no suma (planilla y API de Turnia); doble clic bloqueado |
| Confirmaciones | — | En la página | `confirm()` del navegador | En la página, con doble toque (los diálogos del navegador traban a los agentes) |
| Selectores estables | — | `data-testid` | No | `data-testid` en cola, botones, confirmación y ficha |
| Ritmo y horario | Reglas escritas | — | Solo texto | Pausa al azar entre envíos y franjas horarias en el modo Enviar |
| Para un agente | — | Guía de operación | — | Modo Enviar + instrucciones copiables |

**Lo que sigue (no hecho):**
- Un bloqueo por persona mientras alguien la está contactando (habita. lo tiene): hoy, si una persona y un agente operan la misma cola a la vez, podrían abrir el mismo contacto. Mientras tanto: un solo operador por unidad.
- Leer las respuestas solas (WAHA en Turnia) en vez de mirar el chat para «¿respondió el saludo?».
- Detectar en WhatsApp Web el aviso de número inválido sin que el agente lo tenga que leer.

## Liquid glass

Fondo: `prospecting/fondo.jpg`, «St. Moritz on an evening during the winter in Switzerland», de [GoodFreePhotos](https://www.goodfreephotos.com/Free-Stock-Photos/st-moritz-on-an-evening-during-the-winter-in-switzerland.jpg.php) (CC0, dominio público). Para cambiarlo alcanza con reemplazar el archivo; sin archivo queda la luz de color.


Investigación (noviembre de 2026):

- [kube.io · Liquid Glass in the browser](https://kube.io/blog/liquid-glass-css-svg/): la técnica de referencia. Refracción real con un mapa de desplazamiento calculado para un bisel convexo y aplicado con `backdrop-filter: url(#filtro)`.
- [rizroze/liquid-glass](https://github.com/rizroze/liquid-glass): la misma idea en un archivo sin dependencias, con aberración cromática y caída automática a `blur()` fuera de Chromium.
- [rdev/liquid-glass-react](https://github.com/rdev/liquid-glass-react): la más usada en React (refracción, blur y aberración cromática). Este repo no usa React ni compila, así que se tomó la técnica y no la librería.
- [w3c/svgwg#1142](https://github.com/w3c/svgwg/issues/1142) y WebKit Bug 245510: hoy solo Chromium aplica filtros SVG en `backdrop-filter`; Safari y Firefox los ignoran.

Lo que quedó en `glass.js` y `glass.css`:

- `glass.js` calcula, para cada elemento con `data-liquid`, un mapa de desplazamiento del tamaño del elemento (perfil tipo squircle: el borde «estira» lo que hay detrás) y arma un filtro SVG con blur, desplazamiento por canal (aberración cromática leve) y saturación. Se rehace solo cuando cambia el tamaño. Se usa en la barra superior, el indicador de la unidad, la ficha y la confirmación de envío; las tarjetas usan vidrio esmerilado (la refracción en todas sería pesada).
- En Safari y Firefox, o con «Reducir transparencia», queda el vidrio esmerilado (blur, saturación y el brillo del borde), que se ve bien solo. Con «Reducir movimiento» el fondo no se mueve.
- Los datos van sobre vidrio con suficiente opacidad para leerse; los colores de cada unidad son los del tablero (Turnia verde agua, habita. naranja).

## Puesta en marcha (una vez)

### 1. Cuenta de servicio de Google

Es un «usuario robot» de Google: un email del tipo `chapa-labs@proyecto.iam.gserviceaccount.com` con una clave. El servidor de chapa-labs la usa para leer y escribir las planillas sin que nadie tenga que iniciar sesión con su Google ni reconectar cada 7 días. Solo ve las planillas que se comparten con ese email, como si fuera una persona más.

1. [Google Cloud Console](https://console.cloud.google.com/) → el proyecto de Turnia (el de Calendar) u otro → APIs y servicios → Biblioteca → **Google Sheets API** → Habilitar.
2. IAM y administración → **Cuentas de servicio** → Crear (por ejemplo `chapa-labs-prospeccion`). Sin roles.
3. En la cuenta → Claves → Agregar clave → JSON. Se descarga un archivo: no subirlo al repo (es público).
4. En Vercel → proyecto `chapa-labs` → Settings → Environment Variables → `GOOGLE_SERVICE_ACCOUNT_JSON` con el contenido entero del archivo (empieza con `{` y termina con `}`). Si se pegó solo la clave privada (`-----BEGIN PRIVATE KEY-----…`), también anda, pero hay que agregar `GOOGLE_SERVICE_ACCOUNT_EMAIL` con el `client_email` del archivo. La pantalla de conexión de `/prospecting` dice qué falta.

### 2. Contraseña del equipo (opcional)

- `PROSPECTING_PASSWORD` (12 caracteres o más). **Hoy no está puesta**: el panel queda abierto y solo pide un nombre (queda en cada contacto que se registra). Ojo: así, cualquiera que tenga el link ve nombres y teléfonos y puede registrar contactos en habita. Cuando se ponga, cada persona entra con su nombre y la contraseña, y la sesión dura 30 días.
- Opcional, `PROSPECTING_SECRET` (32 caracteres o más) para firmar la cookie.

### 3. La planilla de cada unidad

| Unidad | Variable | Planilla | Pestaña | Modo |
| --- | --- | --- | --- | --- |
| habita. | `HABITA_PROSPECTING_SHEET_ID` | «Prospecting Habita» | `Prospectos` | Respaldo: con la clave de su API, las cuentas y las acciones van por habita. |
| Turnia | `TURNIA_PROSPECTING_SHEET_ID` | «Turnia · Prospección y pedidos de demo» | `Prospección` | Lee la planilla; escribe por la API de Turnia |

El id es lo que va entre `/d/` y `/edit` en el link de la planilla. Va en Vercel y no acá porque el repo es público. Cada planilla se comparte con el email de la cuenta de servicio (`...@...iam.gserviceaccount.com`): **Editor** la de habita., **Lector** alcanza para la de Turnia. Después, **Redeploy**.

**habita. (con su API).** La base es la del panel de habita. (`/admin/prospeccion`); la planilla solo lo alimenta (cada hora, `scripts/prospeccion-sync.gs`). Con `HABITA_METRICS_SECRET` (o `HABITA_PROSPECTING_SECRET`), el mismo valor que `METRICS_SECRET` en habita., las cuentas y su historia se leen de `GET https://habitaia.vercel.app/api/prospeccion` y cada acción va por `POST` a la misma ruta, con las reglas de ese panel (solo números revisados, bajas, tres pasos, evidencia; «Mandé el mensaje» prepara, abre y confirma de una). Los mensajes y las metas siguen en la planilla. Sin la clave, el panel avisa y opera sobre la planilla como antes.

**habita. (sin su API).** El panel reconoce sus columnas (Inmobiliaria, SDR, Número, Confianza del número, Estado, Fecha envío, Grupo Habita…), escribe con su mismo vocabulario («Enviado», «Número incorrecto», «No interesado») y la fecha de envío como día, así que la sincronización por hora con `/admin/prospeccion` (`scripts/prospeccion-sync.gs` en amoblaia) sigue funcionando. «Motivo / próximo paso» (la nota de la investigación) se muestra como señal y no se pisa: el próximo paso del panel va en una columna propia que se agrega al primer cambio. En la vista de la unidad, «Preparar la planilla» agrega las pestañas Actividad y Mensajes.

**Turnia.** Su planilla la escribe la app de Turnia: con cada cambio en su panel reescribe la pestaña «Prospección» entera. Por eso el panel la **lee** (siempre al día) pero **no la escribe**: cada acción de `/prospecting/turnia` va a la API de Turnia (`POST https://turniasalud.vercel.app/api/prospeccion`), que aplica las mismas reglas que su panel (saludo primero, tres mensajes, la baja para siempre, PostHog) y vuelve a copiar la planilla.

- La clave: `TURNIA_METRICS_SECRET` en chapa-labs (la misma que `METRICS_SECRET` en Turnia, que ya usa `/api/metricas`). Si se quiere una clave aparte para escribir: `TURNIA_PROSPECTING_SECRET` acá y `PROSPECTING_API_SECRET` en Turnia. Otra URL: `TURNIA_PROSPECTING_API_URL`.
- Sin clave, Turnia queda en solo lectura y la ficha lleva al panel de Turnia.
- «Contactado» sin mensajes y con «Saludo enviado» se lee como «Saludado» (esperan la demo); «Sin WhatsApp» como número inválido. «Interesado» se guarda en Turnia como «Respondió» con el detalle. Abrir o probar la demo lo registra Turnia sola.
- La historia completa de cada persona queda en el panel de Turnia (acá no hay pestaña Actividad).
- **Mensajes:** los de Turnia son los mismos de su panel (Prospección → Mensajes): se leen y se guardan por su API, así que editarlos acá los cambia allá. Los de habita. se guardan en la pestaña «Mensajes» de su planilla.
- **Cuenta:** cuando se le da acceso a una clínica real, se vincula en la ficha (sección Cuenta). Así «cuentas creadas» y «activas» cuentan solo lo que viene de la prospección: las clínicas de otras fuentes (como Guerra–Mininni) no entran.

### Embudo contra la meta

En el Embudo de cada unidad y en el resumen. Base: **250 saludos por semana** (se escala al período; en «Histórico», desde el primer contacto). Cada paso tiene la conversión esperada sobre el anterior. Cada unidad tiene el suyo, según cómo vende:

**Turnia** (Programa Fundadores: nadie compra sin una llamada de 15 minutos y el setup se cobra 100% antes de implementar, `src/content/precios.ts`). El embudo termina en el cobro; crear la cuenta y que opere es posventa.

| Paso | Meta | De dónde sale |
| --- | --- | --- |
| Saludos enviados | 250 por semana | Planilla: saludo o primer contacto |
| Demos enviadas | 15% | Planilla: al menos un mensaje con la demo |
| Visitadas | 65% | Planilla: abrieron su demo (`/p/…`) |
| Hablaron con Sofi | 50% | Planilla: conversaron con Sofi en su demo |
| Llamadas agendadas | 45% | Planilla: «Reunión» (15 minutos) |
| Clientes Fundadores | 50% | Planilla: «Cliente» = setup y mes 1 cobrados |

**habita.** (alta autogestionada con créditos de regalo: crear la cuenta sí es parte del embudo).

| Paso | Meta | De dónde sale |
| --- | --- | --- |
| Saludos enviados | 250 por semana | Planilla: «Enviado» |
| Demos enviadas | 15% | App: demos publicadas de las cuentas prospectadas |
| Visitadas | 65% | App: entraron a su demo |
| Con interacción | 50% | App: interactuaron con su demo |
| Cuentas creadas | 50% | App: crearon o reclamaron su cuenta |
| Cuentas activas | 50% | App: primera ambientación propia |
| Clientes pagos | 25% | App: primer pago aprobado |

**Metas ajustables:** en el Embudo, «Editar metas» cambia los saludos por semana y el % de cada paso. Son del equipo (las ve todo el que abre el panel) y se guardan donde vive cada unidad: **Turnia**, en su configuración por su API (los saludos por semana son la misma meta semanal de su panel, `outreach_weekly_goal`; los % en `outreach_funnel_rates`); **habita.**, en la pestaña «Metas» de su planilla (se puede editar ahí también: el % como «45» o «45%»). «Volver a las de fábrica» vuelve a las de `units.js`.

### Onboarding de Turnia (`?vista=onboarding`)

Posventa, fuera del embudo: por cada cliente (marcado «Cliente» o con cuenta vinculada), las dos garantías del Programa Fundadores. **Operativa en 14 días** desde «Cliente desde» (si no, se devuelve el setup) y **50 interacciones en su primer mes** desde «Operativa desde» (si no, el mes 2 es gratis). «Operativa» es la primera conversación de Sofi en su clínica real (la que se vincula en la ficha, sección Cuenta). Marca en riesgo lo que está por vencer o no llega al ritmo. Los datos salen de las columnas «Cliente desde», «Operativa desde» e «Interacciones del primer mes» de la planilla de Turnia. La garantía de Revenue Growth (100 pacientes dormidos en 30 días) todavía no está.

Cada paso de la planilla incluye a los siguientes (quien conversó en la demo también cuenta como visita). Las metas están en `targets` de cada unidad (`prospecting/units.js`). Lo de la planilla es la cohorte contactada en el período; lo de la app, el mismo período desde su `/api/metricas`. Sin dato, el paso dice «Sin datos».

### Qué se escribe en la planilla

- **Prospectos**: solo las celdas que cambian de esa fila (etapa, fechas de contacto y de cada hito, mensajes, próximo paso, notas, baja, actualizado). Las columnas que el panel necesita y faltan se agregan al final. Nada se borra; las columnas propias se conservan y se ven en la ficha.
- **Actividad**: una fila por evento (fecha, ID, cuenta, tipo, canal, plantilla, detalle, quién). Solo se agrega.
- **Mensajes**: las plantillas. Se editan en la planilla y el cambio llega a todo el equipo. Variables: `{saludo}`, `{nombre}`, `{organizacion}` (o `{consultorio}`, `{inmobiliaria}`), `{destinatario}` (Turnia: «la Dra. Pérez»), `{zona}`, `{link}`.
- Si dos personas tocan la misma cuenta a la vez, gana la primera y a la segunda se le muestra la versión nueva (columna «Actualizado»).
- Una fila sin ID recibe uno estable (`fila-<nombre>`) en su primer cambio.

## Sumar una unidad

1. En `prospecting/units.js`, copiar el bloque de una unidad, cambiarle el `id`, el nombre, el color (`s1`…`s8` de la paleta del tablero), el ICP, la propuesta, las plantillas y `nextTemplate`.
2. Si tiene `/api/metricas`, sumarla en `api/metricas.js` y poner su clave en `metricsKey`.
3. Agregar el id a las rutas de `vercel.json` y de `readRoute()` en `app.js`.
4. Su planilla en `<ID>_PROSPECTING_SHEET_ID`.

## Pendiente

- Probar en vivo con las dos planillas reales (se probó con planillas simuladas con sus mismas columnas y con el modo de ejemplo).
- Señales de demo de habita. por cuenta (hoy su `/api/metricas` da solo totales): un endpoint por cuenta en amoblaia, o que su panel escriba «Abrió la demo» en la planilla.
- Leer respuestas solas desde WAHA (Turnia) para no tener que marcar «Respondió» a mano.
- Pasar de la planilla a una base cuando el volumen lo pida: el motor no cambia, solo `api/prospecting.js`.
