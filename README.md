# Chapa Labs · Dashboard de seguimiento

Dashboard ejecutivo de los proyectos que llevamos adelante con Axel: **Maru Coach**, **habita.** (ex Amobla IA; la pestaña sigue en `#amobla-ia`) y **Turnia**. Es una página estática (`index.html`, `styles.css`, `main.js` y `data.js`), sin compilación ni dependencias: se abre `index.html` directo en el navegador. Para publicarla alcanza con importar el repo en Vercel (o activar GitHub Pages sobre `main`); `vercel.json` le agrega `noindex` para que no aparezca en buscadores.

## De dónde salen los datos

| Sección | Fuente | Estado |
| --- | --- | --- |
| Pauta de Maru Coach y habita. | **Meta Ads**, cuenta "Costa Reset": campañas que empiezan con `MARU` y `amoblaIA` | **Real.** |
| North Star, embudo por canal (registros, compras, CPA, ROI) y usabilidad de **Maru Coach** | **PostHog**, organización "Growth Labs 2" (marucoach.com) | **Real.** Canal según la UTM de la primera visita; registro = primer login; ingresos = `monto` de `compra_confirmada`. |
| North Star y usabilidad de **habita.** | **PostHog**, organización "AmoblaIA" | **Real.** North Star: diseños generados (evento `diseno_generado`). Producto: recorrido en la web (foto subida, diseño generado, precios, plan) e interacción con las demos públicas (`demo_vista`, interacciones, «Crear mi inmobiliaria», alta). Sin el tráfico del equipo (`is_internal`). |
| Prospección, demos comerciales e ingresos de **habita.** | **`/api/metricas` de habita.** (Supabase, mismas reglas que `/admin/prospeccion`) | **Real.** Reemplaza a la planilla "Prospecting amobla IA", que quedó vieja: la prospección ahora vive en el panel. |
| Prospección a odontólogos, demos, pedidos de demo y uso de **Turnia** | **`/api/metricas` de Turnia** (su base) | **Real** cuando se conecta; hasta entonces, **Sin datos**. North Star: turnos que tomó Turnia en los últimos 7 días. |
| Recorrido en la web de **Turnia** | **PostHog**, proyecto "Turnia Salud" (518346) | **Real** cuando la clave de PostHog tiene acceso a esa organización. |
| Ingresos de **Turnia** | — | **Sin datos**: Turnia todavía no registra cobros. |

Lo real se ve con la etiqueta **Datos reales**; lo que no tiene fuente conectada, con **Sin datos** y en 0. Nunca se cargan números inventados. Lo real se guarda como foto en `data.js` y las funciones `/api/meta`, `/api/posthog` y `/api/prospectos` lo actualizan en vivo cuando tienen sus claves (abajo).

### Conectar Meta Ads en vivo

1. En [Business Manager](https://business.facebook.com/settings/system-users) → **Usuarios del sistema**, crear uno (o usar uno existente), asignarle la cuenta publicitaria con permiso de lectura y **Generar token** con el permiso `ads_read`.
2. En Vercel → proyecto `chapa-labs` → **Settings → Environment Variables**, agregar `META_ACCESS_TOKEN` con ese token (y `META_AD_ACCOUNT_ID` si se usa otra cuenta).
3. **Redeploy.** El dashboard toma los datos de Meta al abrirse (con 15 minutos de caché) y la etiqueta pasa a decir "en vivo".

### Conectar PostHog en vivo

1. En PostHog → avatar → **Settings → Personal API keys** → **Create personal API key**. Darle acceso a las organizaciones **Growth Labs 2** y **AmoblaIA** (o a todas) con el permiso **Query: Read**.
2. En Vercel, agregar `POSTHOG_API_KEY` con esa clave y hacer **Redeploy**.

### Conectar habita. y Turnia en vivo (`/api/metricas`)

Cada app tiene su `GET /api/metricas`, que devuelve solo totales y series por día (nada de nombres, teléfonos ni emails) y pide una clave. La función `api/metricas.js` de acá los junta.

1. Inventar dos claves largas (32 caracteres o más), por ejemplo con `openssl rand -hex 32`.
2. En Vercel → proyecto de **habita.** (amoblaia) → `METRICS_SECRET` con la primera. En el proyecto de **Turnia** (turniasalud) → `METRICS_SECRET` con la segunda. Redeploy de los dos.
3. En Vercel → proyecto `chapa-labs` → `HABITA_METRICS_SECRET` y `TURNIA_METRICS_SECRET` con esas mismas claves. Si las apps no están en `amoblaia.vercel.app` y `turniasalud.vercel.app`, también `HABITA_METRICS_URL` y `TURNIA_METRICS_URL` (la URL completa de `/api/metricas`). **Redeploy.**

El tablero las trae al abrirse (5 minutos de caché) y con el filtro de fechas pide ese período. Sin conexión, habita. muestra la foto guardada en `data.js` y Turnia, "Sin datos". Qué devuelve cada una: `docs/METRICAS_TABLERO.md` en amoblaia y `ESTADO_Y_PRIORIDADES.md` en turniasalud.

Para la parte de Producto de Turnia, la clave `POSTHOG_API_KEY` tiene que tener acceso también a la organización de "Turnia Salud".

### Planilla de prospección (ya no se usa)

habita. dejó de leer la planilla: la prospección sale de `/api/metricas`. La función `/api/prospectos` y el tipo `prospects` quedan por si otro proyecto vuelve a usar una planilla. Lo que sigue es cómo se conectaba.

### Conectar la planilla de prospección en vivo

1. En la planilla → **Compartir** → "Cualquier persona con el enlace" → **Lector**. Hoy está como *Editor*: con el link cualquiera puede modificarla, conviene bajarlo a Lector.
2. En Vercel, agregar `AMOBLA_SHEET_ID` con el id de la planilla (lo que va entre `/d/` y `/edit` en el link) y, si la pestaña Prospectos no es la primera, `AMOBLA_SHEET_GID`. Va en una variable y no en el repo porque el repo es público.
3. **Redeploy.** El dashboard lee la planilla al abrirse (5 minutos de caché). La función devuelve solo inmobiliaria, SDR, estado, fecha de envío, canal y score: nada de teléfonos, emails ni notas.

Cómo se cuenta cada etapa (columna **Estado**):

| Etapa | Cuenta las filas con |
| --- | --- |
| Prospectados | Todas las filas con nombre de inmobiliaria |
| Contactados | Fecha de envío, o un estado como "Enviado", "Respondió", "Número incorrecto", "No interesado" |
| Interesados | Estado con "Interesado", "Demo", "Prueba", "Reunión" o "Propuesta" |
| Suscriptores | Estado con "Suscriptor", "Cliente", "Pagó", "Compró" o "Cerrado" |

Cada etapa incluye a las siguientes (un suscriptor también cuenta como interesado y contactado). Para que el embudo avance alcanza con cambiar el Estado en la planilla. En el tablero, **Editar etapas** permite pisar a mano cualquier total (por ejemplo, contactados que no están en la planilla): los ratios, el embudo y la proyección se recalculan con ese valor. Lo editado se guarda en el servidor (función `/api/ediciones`, almacén privado de Vercel Blob `chapa-labs-ediciones`) y lo ven todos. Cada edición recuerda cuánto marcaba la planilla en ese momento: vale mientras la planilla siga igual y se descarta sola cuando trae un dato nuevo para esa etapa (o al tocar "Volver a la planilla"). Ojo: el tablero no tiene login, así que cualquiera con el link puede editar. El canal sale de la columna Notas: si empieza con "Mail" es Email; si no, WhatsApp.

Las consultas de cada proyecto (y el id de proyecto de PostHog) están en `api/posthog.js`. Para sumar Turnia: crear su proyecto en PostHog, agregar sus consultas ahí y en `data.js` un bloque `posthog` con la misma forma.

Cada proyecto toma las campañas cuyo nombre empieza con su prefijo (`ads.match` en `data.js`) y cuenta como resultado el evento de `ads.resultAction` (por ejemplo `maru_paywall_viewed` del píxel o la conversión personalizada "Foto subida").

## Qué muestra

- **Resumen**: dos bloques con una tarjeta igual por proyecto. Arriba, la **North Star Metric** (últimos 7 días, variación contra los 7 anteriores y evolución por día del mes); abajo, separados, los **suscriptores e ingresos** del mes por día.
- **Una pestaña por proyecto**: arriba la **North Star Metric** (valor, variación, avance a la meta y evolución) y los suscriptores e ingresos; abajo, dos secciones:
  1. **Producto**: funnels y usabilidad del producto digital. KPIs de uso, recorrido dentro de la web o la app y tablas libres (secciones o páginas más usadas, uso por funcionalidad, retención por cohorte con mapa de calor).
  2. **Distribución**: la adquisición, según el modelo del proyecto:
     - **Prospección y demos** (habita. y Turnia, desde `/api/metricas`): por secciones, cada una con KPIs, embudos (prospectados → contactados → respondieron → interesados → clientes; demos publicadas → abiertas → interactuaron → generaron → panel → suscribieron), series por día y tablas por SDR, canal o zona. Todo se arma desde `acquisition.sections` en `data.js`.
     - **Outbound con planilla** (ya sin uso): embudo prospectados → contactados → interesados → suscriptores con la conversión entre etapas (editables a mano), contactados por día, desglose por SDR y por canal, y el listado completo de prospectos. Debajo, **ventas proyectadas**: se completa el total de prospectados de la base, cada conversión (*real* o *estimada*) y el ticket medio; muestra los ingresos por mes, el recorrido de la base hasta suscriptores y la comparación con los contactados de hoy. Las variables se recuerdan en cada navegador.
     - **Pauta en Meta Ads** (Maru Coach y habita.): inversión, impresiones, clics, CTR, CPC y resultado por día y por campaña.
     - **Embudo por canal** (Maru Coach): visitantes → registro → suscripción por canal, con CPL, CPA y ROI.
     - **Outbound por mes** (Turnia, de ejemplo): embudo con demo agendada y realizada, MRR nuevo y desglose por canal.
- **Selector de mes** arriba a la derecha: aplica al Resumen (North Star, suscriptores e ingresos).
- **Filtro de fechas** al principio de Producto y de Distribución, en cada proyecto: Histórico (por defecto), Hoy, Últimos 7 días, Últimos 30 días o Elegir fechas. Lo de PostHog se vuelve a consultar para ese período (`/api/posthog?desde=AAAA-MM-DD&hasta=AAAA-MM-DD`, necesita la conexión en vivo); la pauta de Meta se filtra por día; en la planilla, contactados y las etapas siguientes cuentan solo los envíos de esas fechas (prospectados es siempre toda la base). La proyección de ventas y la edición a mano de etapas usan siempre el histórico.
- Tema claro y oscuro (sigue al sistema; el botón ◐ lo fija). Se ve bien en celular.

## Cómo cargar los datos

Todo vive en `data.js`. Por cada proyecto:

| Campo | Qué es |
| --- | --- |
| `posthog` | Resultado de las consultas de `api/posthog.js` (la foto inicial). `northStar.posthog`, `acquisition.query` y `usability` (`query`, `funnel`) leen de acá. |
| `metrics` | Foto de `/api/metricas` del producto (`source`, `snapshotAt`, `data`). `northStar.metrics`, `revenue.metrics`, `acquisition.sections` y los KPIs con `metrics` leen de acá con rutas como `prospeccion.contactados`. Sin `snapshotAt` ni conexión en vivo, todo eso marca **Sin datos**. |
| `ads` | Pauta real de Meta Ads: prefijo de las campañas, evento que cuenta como resultado y la foto por día y campaña. |
| `noData` | En `northStar`, `revenue`, `acquisition` o `usability`: la sección no tiene fuente conectada; se muestra en 0 con la etiqueta "Sin datos". |
| `northStar` | Nombre, definición, `target` (meta) y `series` con un valor por mes (`"AAAA-MM"`). |
| `acquisition.type` | `"funnel"`, `"paid"`, `"outbound"`, `"prospects"` o `"pipeline"` (secciones desde `metrics`). Define qué tablas y gráficos se muestran. |
| `acquisition.rows` | Solo `prospects`: la foto de la planilla, una fila por inmobiliaria (`[prioridad, nombre, SDR, estado, fecha, canal, score]`). |
| `acquisition.projection` | Solo `prospects`: moneda, ticket medio y conversiones iniciales de las ventas proyectadas (`mode`: `"real"` o `"estimate"`; `estimate`: 0,1 = 10%). |
| `acquisition.months` | Una fila por mes. Pauta: `inversion`, `registros`, `pagos`, `ingresos` (CPL, CPA, conversión, ROI y ROAS se calculan solos). Outbound: una columna por etapa de `stages` y opcional `mrrNuevo`. |
| `acquisition.channels` | Desglose por canal del último mes, con los mismos campos. |
| `usability.kpis` | Tarjetas: `label`, `value`, `prev` (mes anterior), `format` y `good` (`"up"` o `"down"`: qué dirección es buena). |
| `usability.tables` | Tablas con columnas libres: cada columna tiene `key`, `label` y `format`. Con `heat: true` en la tabla y en las columnas se pinta como mapa de calor. |

Formatos disponibles: `int`, `dec`, `pct` (0,46 = 46%), `money`, `money2` (con centavos), `hours`, `x` (multiplicador), `month`, `delta` (variación coloreada) y `status` (`good`, `warning`, `critical`).

Las etapas del embudo outbound se configuran en `stages`, así que cada proyecto puede tener las suyas (por ejemplo, sumar "Propuesta enviada").

**Sumar un proyecto**: copiar uno de los bloques de `projects`, cambiarle el `id` y el nombre. Aparece solo en las pestañas y en el resumen.

Cuando una sección pase a tener datos reales, sacarle `noData: true`.

## Próximos pasos posibles

- Leer los datos desde una Google Sheet compartida (cada proyecto en una pestaña) en lugar de editar `data.js`.
- Conectar la prospección de Turnia de la misma forma que la de Amobla IA.
- Instrumentar eventos propios en Amobla IA (foto subida, ambiente generado, compra) y PostHog en Turnia.
- Agregar metas por mes y alertas cuando una métrica se desvía.
