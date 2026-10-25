# Chapa Labs · Dashboard de seguimiento

Dashboard ejecutivo de los proyectos que llevamos adelante con Axel: **Maru Coach**, **Amobla IA** y **Turnia**. Es una página estática (`index.html`, `styles.css`, `main.js` y `data.js`), sin compilación ni dependencias: se abre `index.html` directo en el navegador. Para publicarla alcanza con importar el repo en Vercel (o activar GitHub Pages sobre `main`); `vercel.json` le agrega `noindex` para que no aparezca en buscadores.

## De dónde salen los datos

| Sección | Fuente | Estado |
| --- | --- | --- |
| Pauta de Maru Coach y Amobla IA | **Meta Ads**, cuenta "Costa Reset": campañas que empiezan con `MARU` y `amoblaIA` | **Real.** |
| North Star, embudo por canal (registros, compras, CPA, ROI) y usabilidad de **Maru Coach** | **PostHog**, organización "Growth Labs 2" (marucoach.com) | **Real.** Canal según la UTM de la primera visita; registro = primer login; ingresos = `monto` de `compra_confirmada`. |
| North Star y usabilidad de **Amobla IA** | **PostHog**, organización "AmoblaIA" | **Real**, pero medido con clics automáticos (botones "Amoblar", "Subir mi foto") hasta que la app mande eventos propios. |
| Embudo outbound de Amobla IA y todo **Turnia** | CRM o planilla de prospección; Turnia no tiene PostHog | Ejemplo. |

Lo real se ve con la etiqueta **Datos reales**; lo de ejemplo, con **Ejemplo**. Lo real se guarda como foto en `data.js` y las funciones `/api/meta` y `/api/posthog` lo actualizan en vivo cuando tienen sus claves (abajo).

### Conectar Meta Ads en vivo

1. En [Business Manager](https://business.facebook.com/settings/system-users) → **Usuarios del sistema**, crear uno (o usar uno existente), asignarle la cuenta publicitaria con permiso de lectura y **Generar token** con el permiso `ads_read`.
2. En Vercel → proyecto `chapa-labs` → **Settings → Environment Variables**, agregar `META_ACCESS_TOKEN` con ese token (y `META_AD_ACCOUNT_ID` si se usa otra cuenta).
3. **Redeploy.** El dashboard toma los datos de Meta al abrirse (con 15 minutos de caché) y la etiqueta pasa a decir "en vivo".

### Conectar PostHog en vivo

1. En PostHog → avatar → **Settings → Personal API keys** → **Create personal API key**. Darle acceso a las organizaciones **Growth Labs 2** y **AmoblaIA** (o a todas) con el permiso **Query: Read**.
2. En Vercel, agregar `POSTHOG_API_KEY` con esa clave y hacer **Redeploy**.

Las consultas de cada proyecto (y el id de proyecto de PostHog) están en `api/posthog.js`. Para sumar Turnia: crear su proyecto en PostHog, agregar sus consultas ahí y en `data.js` un bloque `posthog` con la misma forma.

Cada proyecto toma las campañas cuyo nombre empieza con su prefijo (`ads.match` en `data.js`) y cuenta como resultado el evento de `ads.resultAction` (por ejemplo `maru_paywall_viewed` del píxel o la conversión personalizada "Foto subida").

## Qué muestra

- **Resumen**: una tarjeta por proyecto con su North Star Metric, la variación contra el mes anterior, el avance contra la meta y los números clave de adquisición, más un cuadro comparativo.
- **Una pestaña por proyecto**, con tres secciones:
  1. **North Star Metric**: valor del mes, variación, avance a la meta y evolución mensual.
  2. **Adquisición**, según el modelo del proyecto:
     - **Pauta paga** (Maru Coach): inversión, registros nuevos, costo por registro (CPL), nuevos pagos, conversión a pago, costo por adquisición (CPA), ingresos atribuidos, ROI y ROAS. Por mes y por canal.
     - **Outbound** (Amobla IA y Turnia): embudo prospectados → contactados → interesados → demo agendada → demo realizada → cliente nuevo, con la conversión entre etapas, MRR nuevo, evolución mensual y desglose por canal.
  3. **Usabilidad**: KPIs de uso y tablas libres (uso por funcionalidad, retención por cohorte con mapa de calor, salud de cuentas, uso por rubro).
- **Selector de mes** arriba a la derecha: todo se recalcula a ese mes y la variación es contra el anterior.
- Tema claro y oscuro (sigue al sistema; el botón ◐ lo fija). Se ve bien en celular.

## Cómo cargar los datos

Todo vive en `data.js`. Por cada proyecto:

| Campo | Qué es |
| --- | --- |
| `posthog` | Resultado de las consultas de `api/posthog.js` (la foto inicial). `northStar.posthog`, `acquisition.query` y `usability` (`query`, `funnel`) leen de acá. |
| `ads` | Pauta real de Meta Ads: prefijo de las campañas, evento que cuenta como resultado y la foto por día y campaña. |
| `sample` | En `northStar`, `acquisition` o `usability`: marca la sección como de ejemplo. |
| `northStar` | Nombre, definición, `target` (meta) y `series` con un valor por mes (`"AAAA-MM"`). |
| `acquisition.type` | `"paid"` u `"outbound"`. Define qué tablas y gráficos se muestran. |
| `acquisition.months` | Una fila por mes. Pauta: `inversion`, `registros`, `pagos`, `ingresos` (CPL, CPA, conversión, ROI y ROAS se calculan solos). Outbound: una columna por etapa de `stages` y opcional `mrrNuevo`. |
| `acquisition.channels` | Desglose por canal del último mes, con los mismos campos. |
| `usability.kpis` | Tarjetas: `label`, `value`, `prev` (mes anterior), `format` y `good` (`"up"` o `"down"`: qué dirección es buena). |
| `usability.tables` | Tablas con columnas libres: cada columna tiene `key`, `label` y `format`. Con `heat: true` en la tabla y en las columnas se pinta como mapa de calor. |

Formatos disponibles: `int`, `dec`, `pct` (0,46 = 46%), `money`, `money2` (con centavos), `hours`, `x` (multiplicador), `month`, `delta` (variación coloreada) y `status` (`good`, `warning`, `critical`).

Las etapas del embudo outbound se configuran en `stages`, así que cada proyecto puede tener las suyas (por ejemplo, sumar "Propuesta enviada").

**Sumar un proyecto**: copiar uno de los bloques de `projects`, cambiarle el `id` y el nombre. Aparece solo en las pestañas y en el resumen.

Cuando una sección pase a tener datos reales, sacarle `sample: true`.

## Próximos pasos posibles

- Leer los datos desde una Google Sheet compartida (cada proyecto en una pestaña) en lugar de editar `data.js`.
- Conectar el CRM o la planilla de prospección de Amobla IA y Turnia para el embudo.
- Instrumentar eventos propios en Amobla IA (foto subida, ambiente generado, compra) y PostHog en Turnia.
- Agregar metas por mes y alertas cuando una métrica se desvía.
