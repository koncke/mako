// =============================================================================
// agente-skill — el archivo SKILL.md que el usuario pega en SU Claude Code
// =============================================================================
// Es la versión "para afuera" de .claude/skills/plan-tareas/SKILL.md (la interna
// habla directo con la base porque corre en la máquina del dev). Esta habla por
// /api/agente/plan con el token del workspace, así que sirve igual para el dueño
// y para cualquier cliente.
//
// La regla que enseña es la misma para todos los orígenes: el agente NO crea
// tareas — deja un borrador con preguntas y el Perro Guardián puntúa al aplicar.
// Función pura (sin server-only) para poder mostrarla y copiarla desde la UI.
// =============================================================================

/** Ruta donde va el archivo dentro del proyecto del usuario. */
export const AGENTE_SKILL_PATH = '.claude/skills/mako-plan/SKILL.md';

/** El SKILL.md listo para pegar, con la URL y el token ya embebidos. */
export function agenteSkillMarkdown(baseUrl: string, token: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  const tk = token || '<pegá-acá-tu-token-de-/integraciones>';
  return `---
name: mako-plan
description: >
  Mirar el plan de MaKo antes de arrancar algo grande, y proponerle tareas nuevas
  cuando aparezca algo que vale la pena anotar. Usar al empezar un trabajo
  sustancial en este proyecto o cuando el usuario diga "anotá esto". NUNCA crear
  tareas por tu cuenta: se proponen y las puntúa el Perro Guardián.
---

# Plan de MaKo

El plan del usuario vive en MaKo. Esta skill lo LEE y le PROPONE — no escribe tareas.

\`\`\`
BASE=${base}
TOKEN=${tk}
\`\`\`

## LA REGLA (no negociable)

Todo lo que entra al plan pasa por el MISMO proceso: se resuelve lo deducible →
se preguntan los HECHOS que faltan → **el Perro Guardián puntúa**. Da igual si
viene de WhatsApp, de una reunión, de un archivo o de acá.

⛔ No inventes prioridades ni las pidas. ✅ Dejá un borrador y pasá el link.

## 1. Mirá el plan ANTES de trabajar

\`\`\`bash
curl -s "$BASE/api/agente/plan" -H "Authorization: Bearer $TOKEN"
\`\`\`

Devuelve \`{ tareas: [{ id, titulo, score, prioridad, deadline, proyecto }], proyectos: [{ nombre }] }\`.

- Si lo que vas a hacer **ya está** anotado → no dupliques: seguí esa tarea.
- Si hay algo de score alto (≥ 75) o **vencido** relacionado con lo que te pidieron,
  decíselo antes de arrancar.

## 2. Proponé (borrador + link)

\`\`\`bash
curl -s -X POST "$BASE/api/agente/plan" \\
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \\
  -d '{
    "resumen": "Qué encontraste, en una línea",
    "tareas": [{ "titulo": "...", "proyecto": "<nombre EXACTO de uno existente>", "detalle": "..." }],
    "preguntas": [{ "pregunta": "...", "tipo": "opcion", "opciones": ["A", "B"] }]
  }'
\`\`\`

- **No mandes prioridad**: la decide el Perro (si la mandás, se ignora).
- \`proyecto\` = el nombre EXACTO de uno del GET, para no duplicarlo. Si no existe, se crea.
- \`eliminar: [{ id, motivo }]\` si esta carga deja tareas viejas obsoletas.

### Las preguntas

Son para sacarle **CONTEXTO** al usuario y que **el Perro decida**, nunca para que él
elija la prioridad (exagera, se encariña, no sabe priorizar).

- ⛔ Prohibido: "¿qué prioridad le das?", "¿cuál te urge primero?", "¿alta/media/baja?".
- ✅ Preguntá HECHOS: deadlines duros, qué BLOQUEA o de qué DEPENDE, qué mueve en
  plata y cuánto, qué sería "listo", si es una tarea o varias.
- Si la respuesta es obvia o ya la sabés, **no la preguntes**.
- **Variá el formato**: \`multi\` (varias válidas — sin opción "todas") · \`opcion\`
  (excluyente) · \`escala\` (1-5) · \`comparacion\` (A vs B).
- **Nada de preguntas abiertas**: siempre con opciones para tocar.

## 3. Entregá el link ENTERO y pará

La respuesta trae \`url\`. Pasásela **completa** (nunca un path suelto: no es
clickeable) o abrila directamente. El usuario contesta de a una, aplica, y recién
ahí el Perro puntúa y arma las checklists. **No hagas nada más.**
`;
}
