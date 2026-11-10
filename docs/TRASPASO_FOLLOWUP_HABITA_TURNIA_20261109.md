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
