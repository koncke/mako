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
| Aislamiento | [auditoria-aislamiento-workspace.md](auditoria-aislamiento-workspace.md) | Multi-inquilino: qué se scopea por workspace y qué no |

Documentos que todavía no existen y hay que crear cuando aparezca el primer hallazgo:
`hallazgos-plan.md` (board, Perro Guardián, reuniones), `hallazgos-email.md` si lo de
Resend crece lo suficiente como para salir de `hallazgos-comunicacion.md`.

Al crear uno, sumar su fila acá **en el mismo commit**: un documento que no está en el
índice es un documento que nadie va a abrir.

Cuando un hallazgo cruza áreas va **donde vive el código** y se enlaza desde la otra, sin
copiarlo. El caso vivo es el paginado: la trampa está en `hallazgos-infra.md` y la citan
CRM, Ads, Landing y Comunicación con su síntoma propio.
