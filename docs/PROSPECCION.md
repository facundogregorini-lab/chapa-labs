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

## Liquid glass

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
| habita. | `HABITA_PROSPECTING_SHEET_ID` | «Prospecting Habita» | `Prospectos` | Lee y escribe |
| Turnia | `TURNIA_PROSPECTING_SHEET_ID` | «Turnia · Prospección y pedidos de demo» | `Prospección` | Solo lectura |

El id es lo que va entre `/d/` y `/edit` en el link de la planilla. Va en Vercel y no acá porque el repo es público. Cada planilla se comparte con el email de la cuenta de servicio (`...@...iam.gserviceaccount.com`): **Editor** la de habita., **Lector** alcanza para la de Turnia. Después, **Redeploy**.

**habita.** El panel reconoce sus columnas (Inmobiliaria, SDR, Número, Confianza del número, Estado, Fecha envío, Grupo Habita…), escribe con su mismo vocabulario («Enviado», «Número incorrecto», «No interesado») y la fecha de envío como día, así que la sincronización por hora con `/admin/prospeccion` (`scripts/prospeccion-sync.gs` en amoblaia) sigue funcionando. «Motivo / próximo paso» (la nota de la investigación) se muestra como señal y no se pisa: el próximo paso del panel va en una columna propia que se agrega al primer cambio. En la vista de la unidad, «Preparar la planilla» agrega las pestañas Actividad y Mensajes.

**Turnia.** Su planilla la escribe la app de Turnia: con cada cambio en su panel (un contacto, un estado, una demo abierta) reescribe la pestaña «Prospección» entera. Por eso:

- Siempre está al día con el panel de Turnia, sin hacer nada. Si alguna vez deja de actualizarse, en el panel de Turnia → Prospección → Google Sheets: «Copiar ahora» (o «Reconectar» si Google lo pide; en modo prueba el permiso vence a los 7 días).
- En `/prospecting/turnia` es de **solo lectura**: se mira, se mide y se filtra, y para contactar se abre el panel de Turnia (que tiene el WhatsApp, las demos `/p/<código>` y su seguimiento). Si el panel escribiera en esta planilla, la próxima copia de Turnia lo borraría.
- «Contactado» sin mensajes y con «Saludo enviado» se lee como «Saludado» (esperan la demo); «Sin WhatsApp» como número inválido. Los fijos que no respondieron no cuentan, como en el panel de Turnia.
- Sin pestaña Actividad, el ritmo diario cuenta primeros contactos.
- Para operar Turnia desde acá hace falta que Turnia acepte las acciones por API (ver Pendiente).

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
- **Operar Turnia desde acá:** un `POST /api/prospeccion` en Turnia (con clave, como `/api/metricas`) que reciba las mismas acciones (contacto confirmado, estado, nota, próximo paso). El panel las mandaría ahí en vez de a la planilla, y la planilla seguiría siendo el espejo.
- Señales de demo de habita. por cuenta (hoy su `/api/metricas` da solo totales): un endpoint por cuenta en amoblaia, o que su panel escriba «Abrió la demo» en la planilla.
- Leer respuestas solas desde WAHA (Turnia) para no tener que marcar «Respondió» a mano.
- Pasar de la planilla a una base cuando el volumen lo pida: el motor no cambia, solo `api/prospecting.js`.
