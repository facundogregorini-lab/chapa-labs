# Chapa Labs · Dashboard de seguimiento

Dashboard ejecutivo de los proyectos que llevamos adelante con Axel: **Maru Coach**, **Amobla IA** y **Turnia**. Es una página estática (`index.html`, `styles.css`, `main.js` y `data.js`), sin compilación ni dependencias: se abre `index.html` directo en el navegador. Para publicarla alcanza con importar el repo en Vercel (o activar GitHub Pages sobre `main`); `vercel.json` le agrega `noindex` para que no aparezca en buscadores.

## De dónde salen los datos

| Sección | Fuente | Estado |
| --- | --- | --- |
| Pauta de Maru Coach y Amobla IA | **Meta Ads**, cuenta "Costa Reset": campañas que empiezan con `MARU` y `amoblaIA` | **Real.** |
| North Star, embudo por canal (registros, compras, CPA, ROI) y usabilidad de **Maru Coach** | **PostHog**, organización "Growth Labs 2" (marucoach.com) | **Real.** Canal según la UTM de la primera visita; registro = primer login; ingresos = `monto` de `compra_confirmada`. |
| North Star de **Amobla IA** | **PostHog**, organización "AmoblaIA" | **Real.** Diseños descargados: suma de `cantidad` del evento `diseno_descargado`. |
| Usabilidad de **Amobla IA** | **PostHog**, organización "AmoblaIA" | **Real**, medido con páginas vistas y clics automáticos (botones "Crear diseños gratis" / "Generar mi diseño" y "Subir mi foto"; ojo que "Amoblar" es solo la pestaña del modo). |
| Embudo outbound de **Amobla IA** y ventas proyectadas | **Google Sheet** "Prospecting amobla IA" (pestaña Prospectos) | **Real.** Etapa según la columna Estado y la fecha de envío. |
| Todo **Turnia** | Turnia no tiene PostHog; sus datos viven en su propia base | **Sin datos**: todo marca 0. |

Lo real se ve con la etiqueta **Datos reales**; lo que no tiene fuente conectada, con **Sin datos** y en 0. Nunca se cargan números inventados. Lo real se guarda como foto en `data.js` y las funciones `/api/meta`, `/api/posthog` y `/api/prospectos` lo actualizan en vivo cuando tienen sus claves (abajo).

### Conectar Meta Ads en vivo

1. En [Business Manager](https://business.facebook.com/settings/system-users) → **Usuarios del sistema**, crear uno (o usar uno existente), asignarle la cuenta publicitaria con permiso de lectura y **Generar token** con el permiso `ads_read`.
2. En Vercel → proyecto `chapa-labs` → **Settings → Environment Variables**, agregar `META_ACCESS_TOKEN` con ese token (y `META_AD_ACCOUNT_ID` si se usa otra cuenta).
3. **Redeploy.** El dashboard toma los datos de Meta al abrirse (con 15 minutos de caché) y la etiqueta pasa a decir "en vivo".

### Conectar PostHog en vivo

1. En PostHog → avatar → **Settings → Personal API keys** → **Create personal API key**. Darle acceso a las organizaciones **Growth Labs 2** y **AmoblaIA** (o a todas) con el permiso **Query: Read**.
2. En Vercel, agregar `POSTHOG_API_KEY` con esa clave y hacer **Redeploy**.

### Conectar la planilla de prospección de Amobla IA en vivo

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

Cada etapa incluye a las siguientes (un suscriptor también cuenta como interesado y contactado). Para que el embudo avance alcanza con cambiar el Estado en la planilla. En el tablero, **Editar etapas** permite pisar a mano cualquier total (por ejemplo, contactados que no están en la planilla): los ratios, el embudo y la proyección se recalculan con ese valor. Lo editado se recuerda en ese navegador hasta tocar "Volver a la planilla". El canal sale de la columna Notas: si empieza con "Mail" es Email; si no, WhatsApp.

Las consultas de cada proyecto (y el id de proyecto de PostHog) están en `api/posthog.js`. Para sumar Turnia: crear su proyecto en PostHog, agregar sus consultas ahí y en `data.js` un bloque `posthog` con la misma forma.

Cada proyecto toma las campañas cuyo nombre empieza con su prefijo (`ads.match` en `data.js`) y cuenta como resultado el evento de `ads.resultAction` (por ejemplo `maru_paywall_viewed` del píxel o la conversión personalizada "Foto subida").

## Qué muestra

- **Resumen**: dos bloques con una tarjeta igual por proyecto. Arriba, la **North Star Metric** (últimos 7 días, variación contra los 7 anteriores y evolución por día del mes); abajo, separados, los **suscriptores e ingresos** del mes por día.
- **Una pestaña por proyecto**: arriba la **North Star Metric** (valor, variación, avance a la meta y evolución) y los suscriptores e ingresos; abajo, dos secciones:
  1. **Producto**: funnels y usabilidad del producto digital. KPIs de uso, recorrido dentro de la web o la app y tablas libres (secciones o páginas más usadas, uso por funcionalidad, retención por cohorte con mapa de calor).
  2. **Distribución**: la adquisición, según el modelo del proyecto:
     - **Outbound con planilla** (Amobla IA): embudo prospectados → contactados → interesados → suscriptores con la conversión entre etapas (editables a mano), contactados por día, desglose por SDR y por canal, y el listado completo de prospectos. Debajo, **ventas proyectadas**: se completa el total de prospectados de la base, cada conversión (*real* o *estimada*) y el ticket medio; muestra los ingresos por mes, el recorrido de la base hasta suscriptores y la comparación con los contactados de hoy. Las variables se recuerdan en cada navegador.
     - **Pauta en Meta Ads** (Maru Coach y Amobla IA): inversión, impresiones, clics, CTR, CPC y resultado por día y por campaña.
     - **Embudo por canal** (Maru Coach): visitantes → registro → suscripción por canal, con CPL, CPA y ROI.
     - **Outbound por mes** (Turnia, de ejemplo): embudo con demo agendada y realizada, MRR nuevo y desglose por canal.
- **Selector de mes** arriba a la derecha: todo se recalcula a ese mes y la variación es contra el anterior.
- Tema claro y oscuro (sigue al sistema; el botón ◐ lo fija). Se ve bien en celular.

## Cómo cargar los datos

Todo vive en `data.js`. Por cada proyecto:

| Campo | Qué es |
| --- | --- |
| `posthog` | Resultado de las consultas de `api/posthog.js` (la foto inicial). `northStar.posthog`, `acquisition.query` y `usability` (`query`, `funnel`) leen de acá. |
| `ads` | Pauta real de Meta Ads: prefijo de las campañas, evento que cuenta como resultado y la foto por día y campaña. |
| `noData` | En `northStar`, `revenue`, `acquisition` o `usability`: la sección no tiene fuente conectada; se muestra en 0 con la etiqueta "Sin datos". |
| `northStar` | Nombre, definición, `target` (meta) y `series` con un valor por mes (`"AAAA-MM"`). |
| `acquisition.type` | `"funnel"`, `"paid"`, `"outbound"` o `"prospects"`. Define qué tablas y gráficos se muestran. |
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
