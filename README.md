# Chapa Labs · Dashboard de seguimiento

Dashboard ejecutivo de los proyectos que llevamos adelante con Axel: **Maru Coach**, **Amobla IA** y **Turnia**. Es una página estática (`index.html`, `styles.css`, `main.js` y `data.js`), sin compilación ni dependencias: se abre `index.html` directo en el navegador. Para publicarla alcanza con importar el repo en Vercel (o activar GitHub Pages sobre `main`); `vercel.json` le agrega `noindex` para que no aparezca en buscadores.

> ⚠️ **Los números de esta primera versión son de ejemplo.** Hay que reemplazarlos por los reales en `data.js`.

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
| `northStar` | Nombre, definición, `target` (meta) y `series` con un valor por mes (`"AAAA-MM"`). |
| `acquisition.type` | `"paid"` u `"outbound"`. Define qué tablas y gráficos se muestran. |
| `acquisition.months` | Una fila por mes. Pauta: `inversion`, `registros`, `pagos`, `ingresos` (CPL, CPA, conversión, ROI y ROAS se calculan solos). Outbound: una columna por etapa de `stages` y opcional `mrrNuevo`. |
| `acquisition.channels` | Desglose por canal del último mes, con los mismos campos. |
| `usability.kpis` | Tarjetas: `label`, `value`, `prev` (mes anterior), `format` y `good` (`"up"` o `"down"`: qué dirección es buena). |
| `usability.tables` | Tablas con columnas libres: cada columna tiene `key`, `label` y `format`. Con `heat: true` en la tabla y en las columnas se pinta como mapa de calor. |

Formatos disponibles: `int`, `dec`, `pct` (0,46 = 46%), `money`, `money2` (con centavos), `hours`, `x` (multiplicador), `month`, `delta` (variación coloreada) y `status` (`good`, `warning`, `critical`).

Las etapas del embudo outbound se configuran en `stages`, así que cada proyecto puede tener las suyas (por ejemplo, sumar "Propuesta enviada").

**Sumar un proyecto**: copiar uno de los bloques de `projects`, cambiarle el `id` y el nombre. Aparece solo en las pestañas y en el resumen.

Cuando los datos sean reales, cambiar `sample: true` por `false` para ocultar el aviso de "Datos de ejemplo".

## Próximos pasos posibles

- Leer los datos desde una Google Sheet compartida (cada proyecto en una pestaña) en lugar de editar `data.js`.
- Traer automáticamente la inversión y los resultados de Meta Ads / Google Ads para Maru Coach.
- Conectar el CRM o la planilla de prospección de Amobla IA y Turnia para el embudo.
- Traer la North Star y la usabilidad desde la analítica de producto (PostHog, base de datos propia).
- Agregar metas por mes y alertas cuando una métrica se desvía.
