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
| Aislamiento | [auditoria-aislamiento-workspace.md](auditoria-aislamiento-workspace.md) | Multi-inquilino: qué se scopea por workspace y qué no |

Documentos que todavía no existen y hay que crear cuando aparezca el primer hallazgo:
`hallazgos-plan.md` (board, Perro Guardián, reuniones), `hallazgos-ia.md` (modelos,
prompts, tool-use), `hallazgos-ads.md` (Meta, Ads Manager, creativos),
`hallazgos-landing.md` (VSL, tracking), `hallazgos-comunicacion.md` (WhatsApp, email,
nutrición), `hallazgos-infra.md` (build, deploy, Supabase, auth).

Al crear uno, sumar su fila acá **en el mismo commit**: un documento que no está en el
índice es un documento que nadie va a abrir.
