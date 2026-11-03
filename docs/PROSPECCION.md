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

1. [Google Cloud Console](https://console.cloud.google.com/) → un proyecto (puede ser el de Turnia) → APIs y servicios → Biblioteca → **Google Sheets API** → Habilitar.
2. IAM y administración → **Cuentas de servicio** → Crear (por ejemplo `chapa-labs-prospeccion`). Sin roles.
3. En la cuenta → Claves → Agregar clave → JSON. Se descarga un archivo: no subirlo al repo (es público).
4. En Vercel → proyecto `chapa-labs` → Settings → Environment Variables → `GOOGLE_SERVICE_ACCOUNT_JSON` con el contenido entero del archivo.

### 2. Contraseña del equipo

- `PROSPECTING_PASSWORD`: 12 caracteres o más. Cada persona entra con su nombre (queda en cada contacto que registra) y esta contraseña. La sesión dura 30 días.
- Opcional, `PROSPECTING_SECRET` (32 caracteres o más) para firmar la cookie. Sin ella se deriva de la contraseña: cambiarla cierra todas las sesiones.
- El tablero general sigue sin login; la prospección no, porque muestra nombres y teléfonos.

### 3. La planilla de cada unidad

Compartir cada planilla con el email de la cuenta de servicio (`...@...iam.gserviceaccount.com`) como **Editor** y cargar su id (lo que va entre `/d/` y `/edit`) en Vercel. Después, **Redeploy** y, en el panel, «Preparar la planilla» (agrega las columnas, la pestaña **Actividad** y la pestaña **Mensajes** con las plantillas de fábrica).

| Unidad | Variable | Pestaña (por defecto) |
| --- | --- | --- |
| Turnia | `TURNIA_PROSPECTING_SHEET_ID` | `Prospectos` (cambiar con `TURNIA_PROSPECTING_TAB`) |
| habita. | `HABITA_PROSPECTING_SHEET_ID` | `Prospectos` (cambiar con `HABITA_PROSPECTING_TAB`) |

**habita.** Sirve la planilla «Prospecting amobla IA» tal como está (pestaña «Prospectos»). El panel reconoce sus columnas (Inmobiliaria, SDR, Estado, Fecha envío, WhatsApp, Confianza del número…) y escribe con su mismo vocabulario («Enviado», «Número incorrecto», «No interesado») y la fecha de envío como día, así que la sincronización por hora con `/admin/prospeccion` (`scripts/prospeccion-sync.gs` en amoblaia) sigue funcionando.

**Turnia.** La planilla «Turnia · Prospección y pedidos de demo» **no sirve** como planilla del panel: Turnia la reescribe entera con cada cambio de su panel y se perderían los cambios hechos acá. Pasos:

1. Crear una planilla nueva («Turnia · Prospección · Chapa Labs»).
2. En la planilla de Turnia, pestaña «Prospección» → clic derecho → Copiar en → la planilla nueva. Renombrar la copia a `Prospectos`. Las columnas (Código, Nombre, Trato, Saludo, Consultorio, Teléfono, De quién es el teléfono, Estado, Mensajes…) se reconocen solas.
3. Su id va en `TURNIA_PROSPECTING_SHEET_ID`.
4. Opcional y recomendado: compartir también la planilla de Turnia (como Lector alcanza) y cargar su id en `TURNIA_SIGNALS_SHEET_ID`. El panel la lee sin escribirla y trae, por código o teléfono, «Abrió su demo», «Probó la demo» y el link de cada uno: las señales que registra la app cuando el odontólogo abre su `/p/<código>`.
5. Desde ese día se trabaja en `/prospecting/turnia`. El panel de Turnia no ve los cambios hechos acá (y al revés): no usar los dos a la vez.

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

- Probar en vivo con las dos planillas reales (solo se probó con una planilla simulada y con el modo de ejemplo).
- Señales de demo de habita. por cuenta (hoy su `/api/metricas` da solo totales): un endpoint por cuenta en amoblaia, o que su panel escriba «Abrió la demo» en la planilla.
- Leer respuestas solas desde WAHA (Turnia) para no tener que marcar «Respondió» a mano.
- Pasar de la planilla a una base cuando el volumen lo pida: el motor no cambia, solo `api/prospecting.js`.
