## Hallazgo de QA visual del 09/11 — REGLAS Y MENSAJES NO tiene paridad

## Cierre de implementación — 10/11/2026

**Publicado (Vercel: success en main de los tres repositorios):**
- **Habita** PR #230 `axellaban/amoblaia` commit `230430473b46662120fbc8e580af26706a16cb2c`: el API de Follow-up expone el embudo histórico exacto (9 pasos), barras acumuladas, pérdidas, filas reales por paso y filtros de períodos sin inventar conteos. PR #228 y #229 ya estaban integrados.
- **Turnia** PR #167 `axellaban/turniasalud` commit `8b14a8b2a3a2a65b9201a74ad2c3bbea05c41b0f`: catálogo propio de ocho etapas comerciales y situaciones editables, reglas que restringen la cadencia sin adelantar mensajes, protección de exclusiones y migración idempotente por `scripts/migrate-db.mjs` en deploy de producción. **CI completo aprobado**, incluida la migración contra Postgres descartable y todas las pruebas de integración. El esquema no se cargó en el Supabase de Habita; Turnia usa su propia DB.
- **Chapa Labs** PR #64 y #65 `facundogregorini-lab/chapa-labs`, último commit `7f04eb47b62aaba76b7ffb6660e2ef1c99fe2892`: embudo histórico con período/fechas, clic en barras para ver inmobiliarias, etapa/acciones debajo, selector de unidad, editor de etapas y situaciones compartido pero persistido en cada producto, reglas con condiciones y vista previa estilo WhatsApp en la tercera columna. CI smoke aprobado. PR #61 cerrado sin merge por obsoleto; reemplazado por #65.

**Verificación cumplida**: SHA integrado en main, CI verde y estado Vercel `success` para cada repo. No se enviaron mensajes ni se mutaron datos comerciales reales durante la validación.

**Limitaciones para no sobredimensionar QA**:
1. No se hizo una prueba de navegador autenticado ni capturas pixel-a-pixel contra las seis pantallas del original. No afirmar literalmente 100% de identidad visual/funcional sin ese QA manual. Revisar **Cola** y **Reglas** primero y después Embudo, Etapas y situaciones, Respuestas y Resultados, desktop y mobile.
2. El editor de escrituras sensibles sigue bloqueado si Chapa no tiene la variable `PROSPECTING_PASSWORD` configurada en Vercel; el warning de «sesión abierta» mostrado anteriormente es evidencia de que en ese momento no estaba habilitada. Verificar en Vercel antes de las pruebas de edición, sin exponer la contraseña.
3. `catalog.available` en Turnia solo será true si se aplicó la migración en la DB de producción. El build publicado normalmente la ejecuta automáticamente salvo `SKIP_DB_MIGRATION=1`; los estados Vercel exitosos **no prueban el valor de esas variables**. Validar respuesta de `GET /api/prospeccion?vista=followup` con el secreto de servidor por canal autorizado.
4. Las modificaciones de reglas deben testearse en sandbox o contactos de prueba antes de afectar mensajes reales: claims, opt-outs, horarios, bajas, encuestas y versiones.

**Cómo continuar si Claude Code retoma el QA**: Abrir este doc, leer `AGENTS.md`, `docs/CENTRO_COMERCIAL.md`, `docs/PROSPECCION.md`, tomar los SHA anteriores como referencia, inspeccionar HEAD nuevo en cada repo; ejecutar pruebas de navegación autenticadas, tomar capturas y comparar con `axellaban/amoblaia/src/components/admin-followup.tsx` y sus CSS. Corregir solo diferencias verificadas, sin reimplementar motores ni reabrir cierres.


## Estado posterior de QA y paridad — 10/11/2026 (actualización)

- Cola y Reglas: mergeadas a main en Chapa PR #62 y Habita PR #228. Vercel las reporta en producción. **No declarar fidelidad visual 100% sin capturas y pruebas reales de interacción.**
- Etapas y situaciones: Chapa PR #63 y Habita PR #229, con el catálogo en dos columnas, árbol lateral de etapas, listado con interruptores Habilitada/Deshabilitada, edición, creación y eliminación; operaciones delegadas al motor de Habita. Chapa CI pasó; Habita CI seguía en ejecución al redactar esta actualización. No integrar hasta que pase.
- Embudo: **todavía no es literalmente idéntico** al Follow-up original. Habita usa `CommercialFunnelChart` (`src/components/commercial-funnel-chart.tsx`) más selector de etapa, subtareas técnicas, detalle de regla, versiones y Cola. Chapa todavía presenta tarjetas en lugar de aquel gráfico y no ofrece las mismas lecturas por período/segmentos. Para reproducirlo sin inventar métricas, extender primero el snapshot de Habita con `chart`, `lostAt` y parámetros de período, reutilizando el mismo `funnelCounts`/filtros; adaptar el componente de Chapa o reutilizar frontend original. **No dibujar barras ficticias.**
- Turnia: la edición avanzada en PR #167 sigue bloqueada por Vercel y CI; Chapa PR #61 depende de ella. No mergear estas ramas sin resolver error y aplicar migración SQL real. El layout de Turnia puede ser el mismo, pero sus 8 etapas comerciales y sus reglas de consentimiento y mensajes son propias.
- Usuario exige fidelidad *literal* del diseño de interacción, no simplemente semejanza visual: confirmar con screenshots desktop/mobile de ambas apps y QA de todos los CTAs/filtros antes de declarar terminado.


El usuario envió una captura de Chapa y señaló que **Reglas y mensajes se ve completamente diferente del panel original de Habita**. Confirmado revisando código publicado:
- **Habita** `src/components/admin-followup.tsx` `RulesWorkspace`: selector horizontal de 7 etapas comerciales; cabecera de etapa; DOS COLUMNAS con listado de reglas de la etapa a la izquierda y editor completo (regla + mensaje) a la derecha; prioridad P1, reordenamiento drag-and-drop, agregar nueva o usar regla existente como plantilla; selector de etapa y situación, validación y versiones de mensajes asociadas.
- **Chapa en producción** `prospecting/app.js` `fuSecuencias()`: una TABLA global de reglas seguida de muchos acordeones por paso técnico, con formularios separados. **No es literalmente igual**. Ni PR #60 (ya integrado y desplegado) ni PR #61 (catálogo Turnia) corrigen por sí mismos esta diferencia.
- **Prioridad P0 pendiente**: reconstruir específicamente `fuSecuencias()` de ambos espacios tomando el JSX actual de `RulesWorkspace` como fuente exacta. Habita con paridad 100% visual y de interacción; Turnia con misma distribución/interacciones pero reglas y cadencia nativas. Los cambios deben probarse con capturas y tests antes de merge.
- Para reordenamiento real y seguro, Habita ya dispone de `reorderRules` en `src/lib/followup/server.ts` y PATCH `src/app/api/admin/follow-up/reglas/route.ts`, **pero Chapa todavía NO expone una operación de API de reordenamiento**; incorporarla a `src/lib/followup/chapa.ts` y al proxy `api/prospecting.js` (protegida con contraseña), con pruebas. No simular reordenamiento solo local.
- Turnia PR #167 `https://github.com/axellaban/turniasalud/pull/167` tenía Vercel y CI fallando en última consulta; no publicar todavía. Chapa PR #61 `https://github.com/facundogregorini-lab/chapa-labs/pull/61` está sin merge y contiene interfaz para catálogo Turnia, **no para Reglas**.
- Nunca afirmar que el Follow-up ya es literal/paridad completa mientras esta pantalla siga distinta.


# TRASPASO A CLAUDE CODE — CHAPA COMMERCIAL OS / HABITA / TURNIA
Fecha: 2026-11-09 (Argentina). Estado comprobado al inicio del traspaso: **NO TODO ESTÁ EN PRODUCCIÓN**.

## Objetivo del usuario
- Habita dentro de Chapa Labs debe ser **literalmente igual en diseño de interacción y orden de bloques** al Follow-up actual de Habita: Cola, Respuestas, Embudo, Reglas y mensajes, Resultados, Etapas y situaciones, ejecución y QA; desktop y mobile. No basta con parecerse.
- Turnia debe reutilizar **los mismos componentes y recorridos**, respetando sus distintas etapas, cadencias, consentimiento, límite de mensajes, WAHA, conversiones y backend. Nunca sustituir las reglas de Turnia por las de Habita.
- Una sola operación en https://chapa-labs.vercel.app/prospecting/ con switch General / Habita / Turnia. Datos y cambios persistidos exclusivamente en el motor de cada producto.

## Repositorios, PR y ramas
1. Chapa repo de producción: **facundogregorini-lab/chapa-labs**. PR abierto **#60** https://github.com/facundogregorini-lab/chapa-labs/pull/60 ; rama **feat/followup-interaction-parity-20261109**. Allí están los cambios de interfaz de esta ronda (app.js, followup.js, commercial-os.css, tests/followup-parity.test.js). **No está mergeado al crear este documento**. El PR #59 (esqueleto Commercial OS) ya está en main.
2. Habita repo: **axellaban/amoblaia**. PR #226 (catálogo desde Chapa) y #227 (no interesados en snapshot) **mergeados a main** y con CI aprobado.
3. Turnia repo: **axellaban/turniasalud**. PR #165 (documentación) y #166 (textos de respuesta y no interesados en snapshot) **mergeados a main** y con CI aprobado.

## Fuente de verdad que debe reconsultarse
- Habita fuente literal: `axellaban/amoblaia/src/components/admin-followup.tsx`, estilos `src/app/admin/follow-up/followup-reference.css`, `followup-workspace.css`, `followup-polish.css`. Últimos cambios detectados: seis commits hasta `2a067b11298e9f36bb074d7245c312f2ac23b5e7`, **pero consultar HEAD de main nuevamente**.
- Habita operaciones: `src/lib/followup/server.ts`, `chapa.ts`, `stages.ts`, `state-catalog.ts`, `commercial-catalog.ts`, `plan.ts`, `rules.ts`.
- Turnia: `AGENTS.md`, `PENDIENTES.md`, `CENTRO_COMERCIAL.md`, `EMBUDO.md`, `src/lib/sales/followup-stages.ts`, `followup-plan.ts`, `followup-queue.ts`, `src/app/api/prospeccion/route.ts`. Turnia tiene **7 etapas técnicas** (sin-saludo, saludo-sin-demo, demo-sin-abrir, abrio-sin-conversar, converso-sin-cuenta, cuenta-sin-actividad, activa-sin-pago) y **8 comerciales incluyendo cliente**. Habita: **7 comerciales + TODAS**.
- Chapa: `AGENTS.md`, `docs/CENTRO_COMERCIAL.md`, `docs/PROSPECCION.md`, `prospecting/app.js`, `followup.js`, `commercial-os.css`, `api/prospecting.js`.

## Lo desarrollado en PR #60
- Cola con tarjetas de etapas, KPIs, filtro de situación/regla, tabla, detalle de tarea junto a cola, registro de liberación del claim antes de salir.
- Bandeja de Respuestas con lista + detalle y clasificación usando API origen. Normalización `F.inboxItems` de Habita y Turnia.
- Embudo por etapas comerciales y técnicas con situaciones y contactos.
- Soporte de situaciones personalizadas de origen **product** (`product_stage`, `productSituations`), además de WhatsApp/manual.
- Reglas de Habita pueden usar otras como plantilla; última UI de tarjetas compactas con íconos imitando referencia.
- Prueba: `tests/followup-parity.test.js`.
- **No se ha verificado que PR #60 sea literal al 100% ni se ha hecho QA real de navegador con datos de producción.** No afirmar paridad sin validación.

## Brechas y riesgos por revisar antes de merge
- El panel de Habita exige disposición literal y textos, no solo aspectos similares; comparar TODO el JSX/estilos contra app.js + CSS con capturas de desktop/mobile.
- Turnia aún no tiene catálogo avanzado editable por etapa ni reglas editables con un contrato equivalente. No inventar escritura cliente. Se necesita PR aparte en Turnia con persistencia/validaciones.
- Verificar inbox: clasificación sin recrear mensaje; no confundir `reply` con `situation`; no enviar WhatsApp al cambiar situación.
- Verificar liberación de claim, idempotencia en confirmación, horarios y opt-out; dos operadores concurrentes.
- Situación **No interesado**: permitir regla de despedida/encuesta solo bajo las reglas del motor original; **no reabrir cierres ni bajas permanentes**.
- Revisar seguridad: Chapa exige `PROSPECTING_PASSWORD` para edición sensible de reglas/etapas/situaciones.
- Inspeccionar que ninguna etapa comercial se use erróneamente como clave técnica de Turnia; que «Habló con Sofi» signifique conversación efectiva.
- Leer los cambios recientes de Habita de nuevo antes de cerrar.

## Pasos concretos para Claude Code
1. Clonar/abrir **los tres repositorios** y leer AGENTS.md / docs citados. Ejecutar `git fetch origin`, cambiar a rama de PR #60 en Chapa, sincronizar con main sin pisar cambios.
2. Ejecutar `npm test` en Chapa, test de TS / lint / build en Habita y Turnia. Verificar estado Vercel y CI. Depurar.
3. Comparar literalmente cada sección de Habita actual con Chapa Habita (fuente JSX + CSS + rutas y API); tomar screenshots **reales** desktop/mobile; ajustar sin cambiar lógica. Comprobar manualmente botones, filtros, edición y navegación. No eliminar herramientas legacy mientras falte paridad.
4. Validar Turnia con las definiciones `EMBUDO.md` y `followup-plan.ts`. Aplicar la misma UI pero labels/cadencias/consentimiento de Turnia. Abrir PR funcional para catálogo/reglas/acciones en Turnia si hay soporte backend real. Hacer migrations y tests antes de exponer edición.
5. Probar casos sin enviar: lista, bloqueada, reprogramada, tomada por otro, no interesado, respondió, demo, situación de producto, sin versión, mobile. **No mandar WhatsApp reales sin autorización explícita.**
6. Con CI y previews verdes, merge squash PRs relevantes hacia main. Verificar **deploy de producción de main** en los tres Vercel y abrir rutas públicas. No afirmar éxito solo por build de preview.
7. Informar con honestidad lo implementado, lo no validado y los PR SHA exactos.

## Prompt directo a Claude
«Retomá el trabajo de unificación Commercial OS de Chapa Labs siguiendo este traspaso. El usuario exige Habita Chapa **idéntico en diseño de interacción** al Follow-up actual de Habita; Turnia con los **mismos flujos y componentes pero adaptados estrictamente** a su funnel, secuencia, WAHA y motor. Revisá primero los tres repos y el HEAD de Habita, luego completá y corregí PR #60, paridad de Turnia, tests, screenshots desktop/mobile, QA sin enviar mensajes reales, CI, merges y producción. Nunca reportes finalizado sin evidencia. Conservá seguridad, claims y auditoría. No pidas de nuevo especificaciones ya decididas.»
