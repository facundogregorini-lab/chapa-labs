# Chapa Labs · instrucciones del proyecto

Antes de tocar `/prospecting`, leé [`docs/CENTRO_COMERCIAL.md`](docs/CENTRO_COMERCIAL.md) (cómo se conectan Chapa, habita. y Turnia, el estado y los pendientes en orden) y [`docs/PROSPECCION.md`](docs/PROSPECCION.md) (la guía del panel). El repo es público: nunca subas ids de planillas, claves ni datos personales.

Este archivo y `AGENTS.md` dicen lo mismo (uno para Claude Code, el otro para cualquier otro agente): si cambiás uno, cambiá el otro.

## Regla: cada mejora de habita. se lleva a Turnia

Toda mejora en los paneles comerciales de habita. se lleva también a Turnia, en el mismo trabajo y sin que haga falta pedirlo. Así los dos paneles quedan siempre al día.

- **Qué cuenta como mejora de habita.:** lo que se haga en su panel del equipo (amoblaia: `/admin/prospeccion`, `/admin/inmobiliarias` y lo que se sume) o en su panel dentro de Chapa Labs (chapa-labs: `/prospecting/habita`). Vistas, embudos, filtros, acciones rápidas, métricas, textos y diseño.
- **Dónde se lleva:** a `/prospecting/turnia` en chapa-labs y, si es algo del panel de la app, también al panel de Turnia (turniasalud: `/panel/prospeccion`).
- **Cómo:** adaptado a Turnia, no copiado a ciegas. Usar sus etapas, su demo `/p/<código>`, sus datos y su embudo contra la meta, con las mismas definiciones que ya usa Turnia, para que los números de una vista y otra coincidan.
- **Si no aplica a Turnia:** decirlo en el PR y por qué.
- **Si no entra en el mismo PR** (otro repositorio, falta acceso): abrir el PR de Turnia a continuación. Si no se puede, dejarlo anotado en `PENDIENTES.md` de turniasalud y avisarlo al terminar.
- En chapa-labs la lógica compartida está en `prospecting/agencies.js` (`HABITA` y `TURNIA`) y la configuración de cada unidad en `prospecting/units.js`.
