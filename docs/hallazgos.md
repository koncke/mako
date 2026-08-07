# Hallazgos — índice

Lo que aprendimos trabajando en cada área y **no se puede deducir leyendo el código**:
el síntoma que se vio, la causa real, dónde vive y la regla que queda. Sobre todo, los
casos en que el diagnóstico obvio era el equivocado — eso es lo que ahorra días.

No son changelogs. Lo que se hizo ya está en el commit y en el código; acá va lo que
hay que saber **antes** de tocar algo.

La regla que los produce está en [AGENTS.md](../AGENTS.md) → "La cosecha": toda
corrida con subagentes termina escribiendo en el documento de su área. El área es
**dónde vive el código**, no de qué hablaba la tarea.

| Área | Documento | Qué cubre |
|---|---|---|
| CRM | [hallazgos-crm.md](hallazgos-crm.md) | Leads, funnel, etapas y requisitos, worklist de datos sin marcar, agenda y horarios, historial |
| Infraestructura | [hallazgos-infra.md](hallazgos-infra.md) | Paginado y límites de Supabase/PostgREST, zonas horarias, trampas del runner de tests, trabajar con sesiones paralelas |
| UI compartida | [hallazgos-ui.md](hallazgos-ui.md) | `app/_components`: `WizardShell` y el progreso, la pila de modales y los z-index |
| MaKo (IA) | [hallazgos-ia.md](hallazgos-ia.md) | Doer, tools y confirmaciones diferidas: qué puede cargar cada canal, qué se valida y cuándo |
| Comunicación | [hallazgos-comunicacion.md](hallazgos-comunicacion.md) | Espejo de WhatsApp (Evolution), onboarding del Chat Agent, desenlace de nutriciones |
| Ads | [hallazgos-ads.md](hallazgos-ads.md) | `ads-analyst` y las lecturas de `marketing_metrics_daily` |
| Landing / VSL | [hallazgos-landing.md](hallazgos-landing.md) | `landing-analyst`, `landing_visits` y `vsl_events` |
| Plan | [hallazgos-plan.md](hallazgos-plan.md) | El board, el Perro Guardián, el pipeline reunión → tareas y el reparto por proyecto |
| Seguridad | [hallazgos-seguridad.md](hallazgos-seguridad.md) | Aislamiento, cifrado de credenciales, firma de webhooks, superficie expuesta |
| Aislamiento | [auditoria-aislamiento-workspace.md](auditoria-aislamiento-workspace.md) | Multi-inquilino: qué se scopea por workspace y qué no |

Dos documentos de esta carpeta **no son hallazgos** sino contexto de arranque, y se leen
antes que todo lo demás:

| Documento | Para qué |
|---|---|
| [mapa-del-proyecto.md](mapa-del-proyecto.md) | Qué es MaKo, cómo está armado y en qué estado está cada pieza. Lo que una sesión nueva necesita saber y no está en el código |
| [dos-cuentas.md](dos-cuentas.md) | El protocolo de las dos cuentas de Claude sobre este clon: qué comparten, los dos modos de trabajo y el traspaso |
| [corridas-multiagente.md](corridas-multiagente.md) | El registro de las 260 corridas de workflow: qué se fue a buscar en cada una y si dejó algo escrito |

Documentos que todavía no existen y hay que crear cuando aparezca el primer hallazgo:
`hallazgos-email.md`, si lo de Resend crece lo suficiente como para salir de
`hallazgos-comunicacion.md`.

## La cosecha retroactiva del 2026-08-07

Se leyeron los journals de las **261 corridas multi-agente** de junio a agosto de 2026
(3.340 subagentes) para rescatar lo que nunca se había escrito. El resultado:
**134 de 260 corridas no habían dejado nada en el repo**, y de ahí salieron 337 hallazgos
que ahora viven en la sección «Cosecha retroactiva» de cada documento de área.

Ese material es **de segunda mano**: sale de lo que devolvieron los agentes en su momento,
no de una relectura del código de hoy. Cada entrada dice de qué corrida y de qué fecha
viene. Antes de actuar sobre una, verificá contra el código.

Es también la mejor evidencia de por qué existe la regla: sin una fase final que escriba,
más de la mitad del trabajo de los agentes se evapora.

Al crear uno, sumar su fila acá **en el mismo commit**: un documento que no está en el
índice es un documento que nadie va a abrir.

Cuando un hallazgo cruza áreas va **donde vive el código** y se enlaza desde la otra, sin
copiarlo. El caso vivo es el paginado: la trampa está en `hallazgos-infra.md` y la citan
CRM, Ads, Landing y Comunicación con su síntoma propio.
