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
    "tareas": [{ "titulo": "...", "proyecto": "<nombre EXACTO de uno del GET>", "detalle": "..." }],
    "preguntas": [{ "pregunta": "...", "tipo": "opcion", "opciones": ["A", "B"] }]
  }'
\`\`\`

- **No mandes prioridad ni deadline**: los decide el Perro (si los mandás, se ignoran).
- \`proyecto\` = el nombre EXACTO de uno del GET. **Los proyectos son POCOS y GRANDES**
  (del tamaño de "Anuncios", "Landing y web", "Mensajes de seguimiento") y si la tarea es
  de un cliente suyo, va al proyecto de ESE cliente. Inventar uno nuevo por cada tema es
  el error más caro que se puede cometer acá: un tablero con 60 proyectos de una tarea
  cada uno no se puede priorizar. Si de verdad ninguno encaja, **decilo en el \`resumen\`**
  en vez de crear uno.
- \`detalle\` es **el campo más importante y va LARGO** (4 a 8 frases): el porqué, de dónde
  salió, los nombres y números concretos, y qué sería "listo". Si sale de una charla o de
  un documento, **citá la frase textual y decí quién la dijo**. El Perro estima el ESFUERZO
  con lo que le des: escribir corto hace que la tarea parezca barata y la hunde en la lista.
- \`eliminar: [{ id, motivo }]\` si esta carga deja tareas viejas obsoletas.

### Antes de mandar: ¿ya existe?

El dedup automático solo ve el parecido de las palabras. **Compará vos** lo que vas a
mandar contra el GET, por OBJETIVO y no por título ("modo simple" y "vista simplificada
por default" son la misma tarea). Si ya existe, no la mandes de nuevo: mencionala en el
\`resumen\` para que la amplíe. La misma tarea dos veces con scores distintos rompe la
confianza en todos los demás puntajes.

### Qué decide el Perro (no lo decidas vos)

Corre al aplicar y en una sola pasada define el **score 1-100**, el **deadline y su razón**
(vacío es respuesta válida; nunca pisa una fecha que ya venía), y **amplía** tu descripción
con una checklist. Las **notas** de una tarjeta son del usuario: la IA no las toca.

### Las preguntas

Son para sacarle **CONTEXTO** al usuario y que **el Perro decida**, nunca para que él
elija la prioridad (exagera, se encariña, no sabe priorizar).

- ⛔ Prohibido: "¿qué prioridad le das?", "¿cuál te urge primero?", "¿alta/media/baja?".
- ✅ Preguntá HECHOS: deadlines duros, qué BLOQUEA o de qué DEPENDE, qué mueve en
  plata y cuánto, qué sería "listo", si es una tarea o varias.
- Si la respuesta es obvia o ya la sabés, **no la preguntes**.
- **CUÁNTAS: escalá con el tamaño del lote**, ~1 cada 3 tareas. Con 20 tareas y 4
  preguntas, 16 entran a ciegas.
- **Variá el formato**: \`multi\` (varias válidas — sin opción "todas") · \`opcion\`
  (excluyente) · \`escala\` (1-5) · \`comparacion\` (A vs B).
- **Nada de preguntas abiertas**: siempre con opciones para tocar.
- ⚠️ **Tipo y opciones tienen que ser coherentes**: una \`opcion\` sin \`opciones\` se dibuja
  sin un solo botón y no se puede contestar. Una \`escala\` NO lleva opciones y la pregunta
  tiene que explicar los extremos ("1 = es una idea, 5 = ya está comprometido"). Una
  \`comparacion\` lleva EXACTAMENTE dos.

### Un lote grande NO se manda de a partes

Una propuesta con las 20 tareas juntas, no cinco de cuatro: el Perro compara solo contra
lo que ve en esa corrida, y en lotes separados el mismo trabajo termina con scores
distintos.

## 3. Entregá el link ENTERO y pará

La respuesta trae \`url\`. Pasásela **completa** (nunca un path suelto: no es
clickeable) o abrila directamente. El usuario contesta de a una, aplica, y recién
ahí el Perro puntúa y arma las checklists. **No hagas nada más.**
`;
}
