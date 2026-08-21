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

## CUÁNDO: sola, al cerrar el trabajo. No esperes que te lo pidan

Esto no se usa cuando el dueño dice «anotá esto». Es lo que hacés **al terminar
cualquier trabajo sustancial**, sin que te lo pidan, igual que correr los tests.

Hay varias sesiones de Claude trabajando este repo en paralelo, cada una tocando cosas
que ya están en el plan y descubriendo otras nuevas. Si cada una espera a que se lo
pidan, el tablero queda mintiendo: tareas cerradas que figuran abiertas, y trabajo
nuevo que solo existe en un chat que nadie va a releer.

Al cerrar, mirá para atrás y contestate las tres, en este orden:

1. **¿CERRÉ algo que estaba abierto?** → `cerrar`, con la evidencia (commit, archivo:línea).
2. **¿APRENDÍ algo sobre una tarea que ya está?** → `enriquece` apuntando a su id. **No**
   una tarea nueva.
3. **¿APARECIÓ trabajo nuevo?** → `tareas`. Lo que quedó sin hacer, la deuda que
   dejaste, lo que descubriste de paso.

**Las tres van en UN SOLO borrador y UN SOLO link.** No mandes tres borradores: el
dueño revisa una vez y confirma una vez, que es la costumbre que ya tiene.

Si de las tres no sale nada, no mandes nada y no lo anuncies — pero que no salga nada
tiene que ser raro después de una sesión de trabajo real.

### Enriquecer vs. crear

| Lo que pasó | Va en |
|---|---|
| La tarea quedó HECHA | `cerrar` |
| Aprendiste algo sobre una tarea abierta | `enriquece` |
| Es trabajo que antes no estaba | `tareas` |

```js
tareas: [{
  titulo: 'el mismo tema, como lo dirías hoy',
  detalle: 'SOLO lo que aprendiste — no repitas lo que ya dice la tarjeta',
  enriquece: { id: '<id de la tarea que ya está>', razon: 'es la misma: acá está el porqué', confianza: 'alta' },
}]
```

`crearPropuesta` lo sanea y `ampliarTareasPlanOwner` lo aplica: el detalle se **suma**
al que ya tiene, no lo pisa. Ante la duda entre enriquecer y crear, **enriquecé**: dos
tarjetas de lo mismo son más caras de deshacer que una con contexto de más.

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

⚠️ En este entorno **`db.<ref>.supabase.co` NO resuelve**: si el postgres directo falla,
usá el cliente de la app (`runWithWorkspace` + `getTenantDb`, como
`scripts/probe-plan-superadmin.ts`), que va por HTTPS.

- Si lo que vas a hacer **ya está** en la lista → NO dupliques: continuá esa tarea.
- Si hay **ALTA** (score ≥ 75) o **vencidas** relacionadas con tu trabajo, mencionáselas.

## 1.b Cerrá lo que ya hiciste (paso 0 de cada sesión)

Si en esta sesión (o en los commits desde el último chequeo) quedó resuelto algo que
sigue **abierto en el tablero**, no lo dejes ahí: proponé cerrarlo. Va en el MISMO
borrador, en el array `cerrar`, y el dueño lo confirma de a una en `/plan/revisar`.

```js
// 1. qué se tocó
//    git log --oneline <ultimo-check>..HEAD  y  git diff --stat
// 2. cruzarlo con las abiertas del GET /api/agente/plan
// 3. POR CADA CANDIDATA, ABRIR EL ARCHIVO Y VERIFICAR QUE ESTÉ ENCHUFADO
//    (que exista no alcanza: que lo llame alguien, que no sea código muerto,
//     que cubra la tarea ENTERA y no un hermano parecido)
// 4. mandar SOLO las que sobreviven ese paso
```

```json
{
  "resumen": "…",
  "tareas": [],
  "cerrar": [
    { "id": "<id de la tarea>", "titulo": "Ficha del lead: notas múltiples",
      "evidencia": "commit d4a6958 · app/plan/board/NotasLista.tsx:59 — la lista de notas con fecha ya está montada en el modal y guarda contra el campo `notas`. Verificado: BoardShell.tsx:1204 la renderiza.",
      "confianza": "alta" }
  ]
}
```

**Reglas duras del canal `cerrar`:**
- `evidencia` es obligatoria y tiene que ser **verificable**: commit + `archivo:línea`,
  o el dato concreto. «Ya lo hicimos» no es evidencia.
- `confianza: 'alta'` **solo** si abriste el archivo y lo verificaste. Si lo dedujiste
  del mensaje del commit, es `'media'`.
- **Ante la duda, no la mandes.** La primera vez que se midió esto, de 17 tareas que la
  IA afirmó hechas solo 8 lo estaban. Un cierre equivocado esconde trabajo real; una
  tarea que queda abierta de más cuesta un clic.
- Si cubriste **parte** de la tarea, mandala igual con la evidencia de lo que sí está: el
  dueño tiene el botón «está a medias», que sube el avance sin cerrarla.
- `cerrar` NO borra. Nunca uses `eliminar` para esto.

## 2. Proponé tareas nuevas (borrador + link)

Insertá UNA fila en `plan_propuestas` y entregá el link `/plan/revisar/<id>`:

```js
await sql`insert into plan_propuestas (id, workspace_id, estado, origen, resumen, tareas, notas, eliminar)
          values (${id}, ${ws}, 'pendiente', 'claude-code', ${resumen},
                  ${sql.json(tareas)}, ${sql.json(preguntas)}, ${sql.json([])})`;
```

- `tareas`: `[{ titulo, proyecto, detalle }]`. **No mandes `prioridad` ni `deadline`**: las
  decide el Perro (ver abajo).
- `proyecto` = un nombre del **CATÁLOGO CERRADO** (`lib/plan-proyectos-catalogo.ts`). NO
  inventes nombres. Los proyectos son GRANDES —del tamaño del nombre de una tab— y hay dos
  familias: los de producto se llaman **`Feature: <la tab>`** (`Feature: CRM`,
  `Feature: Dashboard`, `Feature: Onboarding`, `Feature: WhatsApp`, `Feature: MaKo Doer`…)
  y el trabajo comercial va en `Vender MaKo: <canal>`. Más unos pocos transversales, que
  NO llevan prefijo (`Seguridad y multi-inquilino`, `Diseño de la app`, `Infraestructura y
  versionado`, `Avisos y reportes`).

<!-- REGLA-NOMBRE-PROYECTO:INICIO — generado por scripts/sync-contrato-detalle.mjs, NO editar a mano -->

**Cómo se llama un proyecto nuevo.** Vive en `lib/plan-proyectos-catalogo.ts` y se copia
acá sola: si cambia allá, cambia acá. No la edites a mano.

> El nombre se entiende SOLO, en 1 a 4 palabras, como el nombre de una tab. Nunca un verbo ("Implementar…"), nunca el nombre de una tarea, nunca jerga ni apodos.
>
> EL PREFIJO ES OBLIGATORIO y sale de UNA pregunta: ¿esto se CONSTRUYE, se EJECUTA SOLO, se VENDE, o CRUZA todo?
> · «Feature: NOMBRE» → una PANTALLA o módulo del producto que el usuario abre y usa. «Feature: Facturación», igual que «Feature: CRM» o «Feature: Ads Manager». Los analistas y los generadores van acá aunque usen IA: los disparás vos.
> · «${PREFIJO_AGENTE}NOMBRE» → una IA que TRABAJA SOLA, sin que se lo pidas, y cuyo trabajo es su CRITERIO (cómo decide, sus prompts, sus reglas). «${PREFIJO_AGENTE}Perro Guardián», «${PREFIJO_AGENTE}Chat Agent». La prueba: si corre solo, es agente; si lo abrís y lo usás, es feature.
> · «Cliente: NOMBRE» → el trabajo que se hace PARA un cliente de la plataforma: su cuenta, su contenido, sus campañas, lo que se le entrega. «Cliente: Mauricio». La prueba: si el resultado lo usa SOLO ese cliente, es suyo; si lo van a tener todos, es producto y va a su tab.
> · SIN prefijo → un área del negocio ("Legal y fiscal", "Soporte"), algo transversal ("Seguridad y multi-inquilino") o el trabajo de vender ("Vender MaKo: Ads").
>
> ⚠️ Ponerle «Feature:» a algo que no se programa es peor que no ponérselo: dice que hay que construirlo cuando hay que firmarlo o pagarlo.
> ⚠️ Y la confusión que más se repite: **la pantalla y el agente que vive adentro NO son el mismo proyecto.** El tablero es «Feature: Plan»; el cerebro que puntúa es «${PREFIJO_AGENTE}Perro Guardián». Mejorar la vista Kanban va a la primera; cambiar cómo decide una prioridad va al segundo.

<!-- REGLA-NOMBRE-PROYECTO:FIN -->

  ⚠️ No es una convención suelta: en dos semanas la IA creó 24 proyectos basura (TRES de
  Instagram, DOS "Ads Content Machine", varios con una sola tarea) y hubo que fundir 64 en
  34 a mano. Si de verdad ninguno encaja, **decilo en el `resumen`** en vez de inventar uno.
- `detalle`: **es el campo más importante.**

<!-- CONTRATO-DETALLE:INICIO — generado por scripts/sync-contrato-detalle.mjs, NO editar a mano -->

El `detalle` va con ESTA forma exacta. Vive en `lib/detalle-contrato.ts` y se copia acá
sola: si cambia allá, cambia acá. No la edites a mano.

```
**Qué hay que hacer**
La acción concreta, 1-2 frases.

**Por qué**
A qué problema responde. Si alguien lo pidió, la frase TEXTUAL entre « » con quién.

**Detalles concretos**
- números, nombres, archivo:línea, LINKS TAL CUAL
- lo que se descartó y por qué

**Listo cuando**
El criterio de terminado, verificable.
```

Esta forma va DENTRO DEL VALOR de este campo, no en tu respuesta al usuario. Copiála EXACTA, con los asteriscos y los saltos de línea. Apuntá a 600-1200 caracteres si el material da para eso. ⛔ NO escribas prosa corrida: sin estos cuatro títulos el detalle NO sirve por más largo y mejor escrito que esté. ⛔ NO rellenes ni supongas: si el material solo da para dos partes, escribí dos — un detalle corto y honesto vale más que uno largo inventado.

<!-- CONTRATO-DETALLE:FIN -->

  Una tarea con detalle pobre es una que en tres semanas nadie sabe hacer — y el Perro
  estima el ESFUERZO con lo que le des, así que escribir corto la hace parecer barata.
- `notas` = las **preguntas** `[{ pregunta, tipo, opciones }]`. **Mandá al menos una**:
  sin preguntas el wizard aplica con `contexto=''` y el Perro puntúa a ciegas.
- `eliminar`: `[{ id, motivo }]` si esta carga deja tareas viejas obsoletas o duplicadas.

### Antes de mandar: ¿ya existe?

El tablero tiene ~400 tareas y el dedup automático solo ve el parecido léxico (atrapa 5 de
17 duplicados reales). **Buscá vos**: leé `plan_tareas` y compará por objetivo, no por
palabras ("Modo Simple" y "vista simple por default" son la misma). Si ya existe, NO la
mandes de nuevo: ponela en `eliminar` si la vieja quedó obsoleta, o mencionala en el
`resumen` para que el dueño la amplíe. La misma tarea cargada dos veces con scores
distintos destruye la confianza en todos los demás puntajes.

### Qué decide el Perro con lo que le mandás (no lo decidas vos)

Corre server-side al aplicar, en **Gemini Flash** (`mako-guardian` + `checklist-coach` en
`lib/model-registry.ts`), y en una sola pasada define:

| Decide | Cómo |
|---|---|
| **score 1-100** | contra la pirámide del plan y el diagnóstico de fase del negocio |
| **deadline + su razón** | sale del score y del esfuerzo; vacío es respuesta válida. NUNCA pisa una fecha que ya venía |
| **descripción + checklist** | AMPLÍA la tuya, no la reemplaza (`fusionarDetalle`) |
| **el proyecto** | rutea contra el catálogo cerrado; ya no puede devolver "es trabajo nuevo" |
| **`haceloEn`** | si la tarea se resuelve en una tab de MaKo (`lib/mako-capacidades.ts`) |

Las **notas** de una tarjeta son del dueño: la IA no las toca nunca.

### Las preguntas (mismas reglas que MaKo)

Son para **sacarle CONTEXTO al dueño y que EL PERRO decida**, nunca para que él elija la
prioridad (exagera, se encariña, no sabe priorizar).

- ⛔ Prohibido: "¿qué prioridad le das?", "¿cuál te urge primero?", "¿alta/media/baja?".
- ✅ Preguntá HECHOS: deadlines duros, qué BLOQUEA o de qué DEPENDE, qué mueve en plata y
  en cuánto, qué sería "listo", si es 1 tarea o varias.
- Si la respuesta es obvia o se contradice con lo que ya sabés, **no la preguntes**.
- **CUÁNTAS: escalá con el tamaño del lote**, ~1 cada 3 tareas (`topePreguntas` en
  `lib/plan-propuesta.ts`). Con 20 tareas y 4 preguntas, 16 entran a ciegas.
- **Variá el formato** eligiendo el mejor para cada una, según el catálogo de acá abajo.

<!-- CONTRATO-PREGUNTAS:INICIO — generado por scripts/sync-contrato-detalle.mjs, NO editar a mano -->

**Los tipos de pregunta y su campo.** Vive en `lib/preguntas-contrato.ts` y se copia acá
sola: si cambia allá, cambia acá. No la edites a mano.

> TIPO Y OPCIONES — TIENEN QUE SER COHERENTES ENTRE SÍ. Es donde más se falla, y una pregunta incoherente es una pregunta que el dueño no puede contestar:
> · "opcion" → una sola respuesta, excluyente. OBLIGATORIO: 2 a 6 opciones cortas y concretas.
> · "multi" → pueden valer VARIAS a la vez. OBLIGATORIO: 2 a 6 opciones. NO agregues "Todas" ni "Ambas": para eso tilda varias.
> · "comparacion" → enfrentar DOS ítems para ver cuál pesa más. OBLIGATORIO: EXACTAMENTE 2 opciones, y cada una es uno de los ítems.
> · "fecha" → **para todo "¿para cuándo?", "¿qué fecha?", "¿hay deadline?"**. El dueño ve un CALENDARIO. Podés sumar 2-4 "opciones" como atajos ("Esta semana", "Este mes", "Todavía no hay fecha"), pero no hacen falta.
> · "escala" → intensidad de 1 a 5, y NADA MÁS. NO lleva opciones: el dueño ve los números pelados. Por eso la pregunta TIENE que decir qué significan los dos extremos, dentro del enunciado mismo: "¿Qué tan firme es esa fecha? (1 = es una idea, 5 = ya está comprometida con el cliente)".
> · "texto" → un campo abierto. ⛔⛔ **CASI NUNCA.** La regla del dueño es NUNCA campos abiertos: un textarea vacío es la pregunta que más se saltea. Usalo solo si de verdad no existe ningún otro campo que la conteste, y antes de usarlo intentá dos veces convertirla en "opcion" o en "fecha". Si mandás cualquier otro tipo sin las opciones que ese tipo exige, la pregunta **se descarta entera** — no se convierte en un campo abierto.
>
> ⛔ NUNCA uses "escala" para preguntar CUÁNDO ni CUÁNTO. "¿Cuál es el deadline?" con botones del 1 al 5 no se puede contestar: el 3 no es una fecha. Si preguntás cuándo, el tipo es "fecha"; si preguntás cuánto, dale opciones con rangos concretos.
> ⛔ Una "escala" sin los extremos explicados en el enunciado es una pregunta muerta.
> ⛔ Una "opcion", "multi" o "comparacion" SIN opciones no se puede contestar: el dueño ve el texto y ningún botón. Si no se te ocurren opciones concretas, cambiá la pregunta hasta que se te ocurran, o no la hagas.
>
> ⛔⛔ CADA OPCIÓN TIENE QUE SER UNA RESPUESTA POSIBLE A LA PREGUNTA. Leé tu enunciado y leé tus opciones: si al elegir una la frase no queda contestada, está mal.
>   MAL (pasó de verdad): "¿los cinco grupos son fijos o hay que validar si algún módulo no encaja?" con opciones ["CRM", "Chats", "Plan", "Dashboard"]. El enunciado es "¿A o B?" y abajo hay una lista de sustantivos: ninguna opción lo contesta.
>   BIEN: o las opciones son las dos alternativas ("Son fijos" / "Hay que revisarlos"), o cambiás el enunciado para que la lista SÍ lo conteste ("¿Qué módulos no encajan?", tipo multi).
>   Nunca dejes un enunciado binario con una lista de nombres abajo.

<!-- CONTRATO-PREGUNTAS:FIN -->

## 3. Entregá el link ENTERO (o abrilo) y pará

⚠️ **Nunca pases un path suelto** (`/plan/revisar/<id>`): no es clickeable y obliga a
armarlo a mano. Pasá **la URL COMPLETA**, y si podés, abrila directamente.

```js
import { APP_BASE_URL } from '@/lib/app-url';
const link = `${APP_BASE_URL}/plan/revisar/${id}`;   // ← esto es lo que se entrega
```

(`lib/app-url.ts` es la ÚNICA fuente de la URL base — la misma que usa
`lib/mako-doer-acciones.ts` para los links de WhatsApp. Nunca la rearmes a mano.)

Él contesta de a una, aplica, y recién ahí el Perro puntúa, describe los proyectos nuevos
y arma las checklists. **No insertes nada más.**

## Cuidados

- **Escribe en PROD** (`.env.local` apunta a prod). No lo uses para pruebas; si probás,
  borrá la propuesta después (`delete from plan_propuestas where id = ...`).
- El **historial** es obligatorio para lo que toca la IA/el agente: la propuesta ya entra con
  `origen: 'claude-code'` y `aplicarPropuesta` estampa la fuente en cada tarjeta.
- **Un lote grande NO se manda de a partes.** Una propuesta con las 20 tareas juntas, no
  cinco propuestas de cuatro: cada corrida del Perro compara solo contra lo que ve, y en
  lotes separados el mismo trabajo termina con scores distintos.
- Para el board de un **cliente** (no el super-admin) el camino es `lib/todo`
  (`experimento_tareas`). Se aplica solo: `aplicarPropuesta` detecta el workspace y manda
  al board que corresponde, y desde jul-2026 el cliente TAMBIÉN recibe al Perro
  (`priorizarNuevasCliente`, lib/todo-guardian.ts).
- Esta skill es la versión "de adentro" (habla con la base porque corre en la máquina del
  dev). La que instala un **cliente** en SU Claude Code sale de /integraciones → "Tu agente"
  y habla por `/api/agente/plan` con un token; el texto vive en `lib/agente-skill.ts`.
  Si cambiás las reglas de acá, cambialas también allá.
