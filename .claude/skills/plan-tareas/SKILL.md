---
name: plan-tareas
description: >
  Revisar el PLAN del super-admin (board /plan) ANTES de arrancar una tarea grande, y
  proponerle tareas nuevas por el MISMO camino que MaKo en WhatsApp: un BORRADOR con
  preguntas de contexto que él revisa en la app y que puntúa el Perro Guardián. Usar al
  empezar un trabajo sustancial en este repo, o cuando identifiques algo que vale la pena
  anotar. NUNCA insertar en plan_tareas a mano: eso saltea el Perro.
---

# Plan de tareas de MaKo (board /plan)

El board del super-admin vive en **Supabase** (`plan_tareas` / `plan_proyectos`, mig 0093),
en **su propio workspace** (el que tiene `capa='superadmin'`; Mauricio/ws1 usa otro board,
`experimento_tareas`, y NO es este). El viejo puente localStorage + `mako.plan.inbox/ops/
snapshot` **está muerto**: no lo uses.

## LA REGLA (no negociable)

**Todo origen que carga tareas pasa por el MISMO proceso**: se resuelve lo deducible →
se preguntan los HECHOS que faltan → **el Perro Guardián puntúa**. Da igual si viene de
WhatsApp, de Fathom, de un archivo o de Claude Code.

⛔ **NUNCA hagas `insert into plan_tareas`.** Saltea las preguntas, el Perro, la checklist
y la descripción del proyecto — y deja una tarea con prioridad inventada por vos.
✅ **Creá una PROPUESTA** (`plan_propuestas`) y pasale el link. La app corre el wizard y el
Perro con las credenciales del dueño (que vos no tenés: se descifran con
`CREDENCIALES_SECRET`, que solo vive en Vercel).

## 1. Revisá el plan ANTES de trabajar

Leé directo de la base (read-only). Resolvé el workspace por capa, no lo hardcodees:

```js
// node --experimental-strip-types, con dotenv sobre .env.local (apunta a PROD)
const [{ id: ws }] = await sql`select id from workspaces where capa = 'superadmin' limit 1`;
const tareas = await sql`select num, title, score, priority, progress, deadline
                         from plan_tareas where workspace_id = ${ws} and progress < 100
                         order by score desc limit 60`;
const proys  = await sql`select pid, name, score from plan_proyectos
                         where workspace_id = ${ws} order by score desc`;
```

- Si lo que vas a hacer **ya está** en la lista → NO dupliques: continuá esa tarea.
- Si hay **ALTA** (score ≥ 75) o **vencidas** relacionadas con tu trabajo, mencionáselas.

## 2. Proponé tareas nuevas (borrador + link)

Insertá UNA fila en `plan_propuestas` y entregá el link `/plan/revisar/<id>`:

```js
await sql`insert into plan_propuestas (id, workspace_id, estado, origen, resumen, tareas, notas, eliminar)
          values (${id}, ${ws}, 'pendiente', 'claude-code', ${resumen},
                  ${sql.json(tareas)}, ${sql.json(preguntas)}, ${sql.json([])})`;
```

- `tareas`: `[{ titulo, proyecto, detalle, deadline? }]`. **No mandes `prioridad`**: la decide
  el Perro. `proyecto` = el NOMBRE exacto de un proyecto existente (mirá `plan_proyectos`)
  para no duplicarlo; si no existe, se crea con ese nombre.
- `notas` = las **preguntas** `[{ pregunta, tipo, opciones }]`.
- `eliminar`: `[{ id, motivo }]` si esta carga deja tareas viejas obsoletas o duplicadas.

### Las preguntas (mismas reglas que MaKo)

Son para **sacarle CONTEXTO al dueño y que EL PERRO decida**, nunca para que él elija la
prioridad (exagera, se encariña, no sabe priorizar).

- ⛔ Prohibido: "¿qué prioridad le das?", "¿cuál te urge primero?", "¿alta/media/baja?".
- ✅ Preguntá HECHOS: deadlines duros, qué BLOQUEA o de qué DEPENDE, qué mueve en plata y
  en cuánto, qué sería "listo", si es 1 tarea o varias.
- Si la respuesta es obvia o se contradice con lo que ya sabés, **no la preguntes**.
- **Variá el formato** eligiendo el mejor para cada una:
  `multi` (varias válidas a la vez — sin opción "Ambas/Todas", que tilde varias) ·
  `opcion` (excluyente) · `escala` (1-5) · `comparacion` (A vs B).
  **Nada de preguntas abiertas**: siempre con opciones para tocar.

## 3. Entregá el link y pará

Pasale `/plan/revisar/<id>`. Él contesta de a una, aplica, y recién ahí el Perro puntúa,
describe los proyectos nuevos y arma las checklists. **No insertes nada más.**

## Cuidados

- **Escribe en PROD** (`.env.local` apunta a prod). No lo uses para pruebas; si probás,
  borrá la propuesta después (`delete from plan_propuestas where id = ...`).
- El **historial** es obligatorio para lo que toca la IA/el agente: la propuesta ya entra con
  `origen: 'claude-code'` y `aplicarPropuesta` estampa la fuente en cada tarjeta.
- Para el board de un **cliente** (no el super-admin) el camino es `lib/todo`
  (`experimento_tareas`), no este.
