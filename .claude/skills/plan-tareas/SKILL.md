---
name: plan-tareas
description: >
  Revisar el PLAN del dueño (board /plan) ANTES de arrancar una tarea grande, y dejarle
  tareas nuevas marcadas con el chat de dónde salieron (origen Claude Code). Usar al
  empezar un trabajo sustancial en este repo, o cuando identifiques algo que vale la pena
  anotar para Martín. El board del super-admin vive en localStorage; se lee por la foto
  (mako.plan.snapshot) y se le deja tarea por la bandeja (mako.plan.inbox).
---

# Plan de tareas de MaKo (board /plan)

El board del super-admin (`/plan/agencia`) vive en el **localStorage del navegador** del
dueño: ni el servidor ni vos lo ven directo (bloqueo #177). Pero:
- El board **empuja una foto** de sólo-lectura → setting `mako.plan.snapshot` (proyectos +
  tareas abiertas con score y deadline).
- El board **lee una bandeja** al abrir → setting `mako.plan.inbox`; la mergea (dedup por
  `refId`) a su localStorage.

El script `scripts/plan.mjs` habla con esas dos settings usando el `service_role` de
`.env.local` (que **apunta a PROD**). Corré siempre desde la raíz del repo.

## 1. Revisá el plan ANTES de trabajar (obligatorio en tareas grandes)

```bash
node .claude/skills/plan-tareas/scripts/plan.mjs review
```

Imprime los proyectos y las tareas abiertas **ordenadas por prioridad**, marcando las
**ALTA** (score ≥ 75) y las **vencidas**. Reglas:
- Si lo que vas a hacer **ya está** en la lista → NO dupliques: es esa tarea, continuala.
- Si hay **ALTA/vencidas** relacionadas con tu trabajo, mencionáselas a Martín.
- La foto puede tener minutos de atraso (se refresca cuando el dueño abre `/plan`).

## 2. Dejá tareas nuevas CON su procedencia

Cuando identifiques algo que vale la pena anotar (y no exista ya), dejáselo en la bandeja
**con el chat de dónde salió** — así el board lo muestra con el chip "Claude Code" + link:

```bash
node .claude/skills/plan-tareas/scripts/plan.mjs add \
  --title "Cerrar la fuga cross-tenant de webhooks" \
  --priority alta \
  --project "Seguridad" \
  --detalle "Contexto de por qué / qué hay que hacer" \
  --chat "Auditoría de aislamiento (esta sesión)" \
  --url "https://github.com/mbustos-digital/dashboard-marketing/commit/<sha>"
```

- `--title` (obligatorio). `--priority` alta|media|baja|futuro (default media).
- `--project` nombre (si no existe, el board lo crea). `--detalle` contexto.
- **`--chat`**: el TEMA del chat/sesión de donde salió (es la etiqueta de procedencia). Poné
  algo reconocible; es lo que resuelve el "¿de qué chat salió esta tarea?".
- **`--url`** (opcional): un link real que la respalde — commit, PR o issue de GitHub. Las
  sesiones de Claude Code CLI no tienen URL propia; usá el commit/PR como ancla.

La tarea entra con `origen: 'code'` y `fuente: { tipo: 'claude-code', etiqueta, url }`, así el
historial dice "Claude Code hizo tal cosa" (regla: la IA/el agente SIEMPRE deja rastro).

## Límites y cuidados

- **Escribe en PROD** (la bandeja del dueño real). No la uses para pruebas; para probar,
  borrá después el item de `mako.plan.inbox`.
- **No completa ni edita** tareas del board del super-admin (localStorage): sólo REVISA
  (foto) y AGREGA (bandeja). Marcar-como-hecha desde acá necesitaría una bandeja de
  "completadas" que todavía no existe — si hace falta, es un TODO.
- Para tareas de un **cliente** (no el dueño) el board vive en la base (`experimento_tareas`),
  no en esta bandeja; ese caso va por `lib/todo`, no por acá.
- Backfill histórico: las tareas viejas del SEED NO tienen chat registrado y **no se puede
  reconstruir** sin inventarlo. Esta procedencia es hacia adelante.
