// =============================================================================
// Un turno SIN herramientas: el prompt no puede ordenar lo que la API no recibió
// =============================================================================
// EL INCIDENTE (01/10/2026, ws13 «Código Inmobiliario»). Un cliente de una agencia
// escribió «hola mako, como venimos de reuniones los ultimos 15 dias» y MaKo le
// contestó «⚠️ Te quedaste sin cuota de IA». Su key había contestado HTTP 200.
// Martín: «es un producto totalmente defectuoso que MaKo cada 2 mensajes te diga
// esto». Medido en la base: a ese cliente el cartel le salió en 16 de sus 53 turnos.
//
// LA CADENA, medida entera:
//   1. `clasificarIntencion` leyó «hola» al principio y devolvió `charlar` — cuyo
//      contrato es `tools: []`. El comentario de esa regla decía «sin nada más» y la
//      condición sólo miraba que el mensaje tuviera menos de 80 caracteres.
//   2. El router, en cambio, SÍ lo leyó como un pedido de datos («reuni», «ultimo»),
//      así que el turno no tomó el camino barato y entró al loop de tool-use.
//   3. Ahí se mandó el preámbulo entero —8.516 caracteres que nombran diez
//      herramientas y ORDENAN usarlas— con el array de tools VACÍO.
//   4. Groq contestó HTTP 400 «Tool choice is none, but model called a tool» y Gemini
//      HTTP 200 con el contenido vacío y `finish_reason: tool_calls`.
//   5. Como nadie contestó, corrió la red de plataforma — keys de la AGENCIA — y los
//      429 de mistral eligieron el texto que leyó el cliente.
//
// ⚠️ LO QUE REFUTÓ LA MEDICIÓN EN VIVO, y cambió el arreglo: la lista vacía NO era la
// causa. Con un system corto, `tools: []` contesta perfecto; con el preámbulo falla
// igual SIN el campo `tools`. Lo que rompe es pedirle al modelo que llame algo que no
// recibió. Por eso el arreglo principal está en el PROMPT y no en el body.
//
// PROBADOS ROMPIÉNDOLOS, uno por uno (con todo puesto: 8 pasan, 0 fallan):
//   · el protocolo de tools vuelve a mandarse siempre        -> 6 / 2
//   · el system vuelve a armarse ANTES de las tools          -> 7 / 1
//   · la voz vuelve a nombrar las herramientas               -> 7 / 1
//   · sin tools se va la prohibición de inventar             -> 7 / 1
//   · el body vuelve a mandar tools y tool_choice vacíos     -> 7 / 1
//   · la tool fantasma vuelve a ejecutarse                   -> 7 / 1
//   · se va el corte del segundo rechazo                     -> 7 / 1
//   · el 200 mudo vuelve a decir que cerró normal            -> 7 / 1
//   · el saludo vuelve a comerse el pedido                   -> 7 / 1
//   · «cuántas» vuelve a no ser una pregunta                 -> 7 / 1
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clasificarIntencion, CONTRATO } from '../lib/mako-intencion';

const NL = String.fromCharCode(10);
const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, NL);
/** Sin comentarios: este archivo explica el bug en prosa y el guard se acusaría solo. */
const sinComentarios = (src: string): string =>
  src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** El bloque de una función, de su firma a la llave de cierre en la columna 0.
 *  ⚠️ NUNCA por cantidad de caracteres: dos guards de esta misma zona se pusieron
 *  rojos el 01/10 porque un comentario nuevo empujó lo que buscaban fuera de su
 *  ventana de 700 y 800 caracteres. Un universo elegido a ojo se queda viejo solo. */
const bloque = (src: string, firma: string): string => {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  const f = src.indexOf(NL + '}', i);
  return src.slice(i, f < 0 ? src.length : f + 2);
};

const DOER = leer('../lib/mako-doer-in.ts');
const AICHEAP = leer('../lib/ai-cheap.ts');

// ── 1. el prompt ────────────────────────────────────────────────────────────

test('⚠️ EL PROTOCOLO DE HERRAMIENTAS SÓLO VIAJA SI HAY HERRAMIENTAS', () => {
  // Probado rompiéndolo: con `const bloqueTools = \n\n${DOER_WA_TOOLS}` incondicional,
  // 1 fallo. Con el `system` armado otra vez ANTES de `tools`, 1 fallo.
  const src = sinComentarios(DOER);
  // El preámbulo está partido en dos consts, y la voz no nombra herramientas.
  assert.match(src, /const DOER_WA_VOZ = /, 'volvió el preámbulo de una sola pieza');
  assert.match(src, /const DOER_WA_TOOLS = /, 'se fue el bloque de herramientas');
  const voz = DOER.slice(DOER.indexOf('const DOER_WA_VOZ = `'), DOER.indexOf('const DOER_WA_TOOLS'));
  assert.ok(!/HERRAMIENTAS DE LECTURA|proponer_tareas_plan|confirmar_accion/.test(voz),
    'la voz volvió a nombrar herramientas: eso es lo que revienta un turno sin tools');
  // Y el bloque cuelga del largo de la lista.
  assert.match(src, /const bloqueTools = tools\.length/,
    'el protocolo de herramientas volvió a mandarse siempre');
  // El system se arma DESPUÉS de las tools: si vuelve arriba, no las puede mirar.
  assert.ok(src.indexOf('const tools = toolsParaIntencion') < src.indexOf('const system = `${base}'),
    'el system volvió a armarse antes de saber cuántas herramientas tiene el turno');
});

test('⚠️ Y SIN HERRAMIENTAS VA LA PROHIBICIÓN DE INVENTAR', () => {
  // La frase «nunca inventes nombres, números ni fechas» vivía DENTRO del protocolo de
  // tools, así que al sacarlo se iba con él. Medido el 02/10/2026 contra Groq con el
  // system ya partido y sin esta línea: contestó «hemos tenido 6 reuniones: 3 internas
  // (planificación, revisión de KPIs, brainstorming), 2 con cliente…» — seis reuniones
  // inventadas con su desglose, en 548 ms. Con la línea puesta: «Eso lo miro y te lo
  // paso.» (25 chars, fin=stop).
  //
  // Probado rompiéndolo: con la rama vacía (`: ''`), 1 fallo.
  const src = sinComentarios(DOER);
  const i = src.indexOf('const bloqueTools = tools.length');
  const ternario = src.slice(i, src.indexOf(';', src.indexOf(" : '", i)));
  assert.match(ternario, /NO TIENES HERRAMIENTAS/,
    'un turno sin herramientas volvió a quedar sin la prohibición de inventar');
  assert.match(ternario, /NO inventes/i, 'se fue la prohibición');
});

// ── 2. el transporte ────────────────────────────────────────────────────────

test('⚠️ CON LA LISTA VACÍA NO VIAJAN NI `tools` NI `tool_choice`', () => {
  // Mandar `tools: []` no es «no mandar nada»: Groq resuelve `tool_choice` a `none` y
  // contesta HTTP 400 «Tool choice is none, but model called a tool» si el modelo igual
  // emite una llamada. Reproducido en vivo el 01 y el 02/10, con el error textual.
  //
  // Probado rompiéndolo: volviendo a `tools: oaiTools, tool_choice: …` fijos, 1 fallo.
  const cuerpo = sinComentarios(bloque(AICHEAP, 'export async function chatCheapTools('));
  assert.match(cuerpo, /\.\.\.\(oaiTools\.length/,
    'el body volvió a mandar tools y tool_choice con la lista vacía');
});

test('⚠️ UNA TOOL QUE NO SE DECLARÓ NO SE EJECUTA, y al segundo rechazo se corta', () => {
  // Medido: Gemini, con `tools: []`, pidió `metricas_negocio` — un nombre que sólo
  // estaba en el TEXTO del system. El código la ejecutaba igual, así que el recorte por
  // intención era una sugerencia. El caso caro no es una lectura de más: es
  // `proponer_tareas_plan`, que crea un borrador de verdad sobre un saludo.
  //
  // El corte es parte del arreglo: devolverle el error y seguir deja que lo reintente, y
  // con la lista vacía eso quema los 8 pasos — más lento y más caro que el bug.
  //
  // Probado rompiéndolo: sin el `filter(... permitidas.has ...)`, 1 fallo; sin el
  // `rechazadas >= 2`, 1 fallo.
  const cuerpo = sinComentarios(bloque(AICHEAP, 'export async function chatCheapTools('));
  assert.match(cuerpo, /const permitidas = new Set\(tools\.map/, 'se fue la lista permitida del turno');
  assert.match(cuerpo, /!permitidas\.has\(c\.function\?\.name/, 'volvió a ejecutar cualquier nombre que pida el modelo');
  assert.match(cuerpo, /rechazadas >= 2/, 'se fue el corte: una tool fantasma puede quemar los 8 pasos');
});

test('Un 200 con el contenido vacío se reporta como VACÍO, no como un cierre normal', () => {
  // Decía `stopReason: 'stop'` y devolvía un centinela entre paréntesis — la MISMA forma
  // que usa el caller para descartar. Así, el motivo que se escribía en la lista de
  // errores era «fin=stop», que es lo contrario de lo que pasó. El `finish_reason` real
  // de ese turno era `tool_calls`.
  const cuerpo = sinComentarios(bloque(AICHEAP, 'export async function chatCheapTools('));
  assert.match(cuerpo, /stopReason: `vacio:\$\{fin\}`/, 'el 200 mudo volvió a reportarse como un cierre normal');
  assert.match(cuerpo, /finish_reason/, 'se dejó de leer el finish_reason que el proveedor sí manda');
});

// ── 3. el clasificador ──────────────────────────────────────────────────────

test('⚠️ UN SALUDO ADELANTE NO SE COME EL PEDIDO', () => {
  // La condición decía `t.length <= 80`, que es un proxy del LARGO cuando lo que el
  // comentario de al lado prometía era «sin nada más». Medido: el 22/09 «mako, como
  // venimos de agendas…» se contestó bien y el 01/10 «hola mako, como venimos…» no. La
  // única diferencia era la palabra «hola».
  //
  // Probado rompiéndolo: devolviendo `charlar` sin pelar, 3 fallos.
  const v = clasificarIntencion('hola mako, como venimos de reuniones los ultimos 15 dias');
  assert.notEqual(v.intencion, 'charlar', 'el saludo volvió a comerse la pregunta');
  assert.equal(CONTRATO[v.intencion].tools, null, 'el turno se quedó sin herramientas para mirar el CRM');
  assert.match(v.porque, /saludo adelante/, 'se perdió el rastro de que se peló un saludo');
  // Y lo mismo con los otros saludos del vocabulario.
  for (const t of ['buenas, cuantos leads tengo', 'che mako, pasame el lead de Juan', 'gracias! y cuantas campañas activas hay?']) {
    assert.notEqual(clasificarIntencion(t).intencion, 'charlar', t);
  }
});

test('Un saludo PELADO sigue siendo charla, y sigue sin herramientas', () => {
  // La otra punta: pelar no puede convertir un «hola» en un pedido.
  for (const t of ['hola', 'OPA', 'test', 'gracias', 'buen día', '👍', 'hola mako']) {
    const v = clasificarIntencion(t);
    assert.equal(v.intencion, 'charlar', `«${t}» dejó de ser charla`);
    assert.deepEqual(CONTRATO[v.intencion].tools, [], 'charlar dejó de ser el turno sin herramientas');
  }
});

test('⚠️ «cuántas X» ES una pregunta: el lookahead la hacía imposible', () => {
  // `cu[aá]nt` seguido de `(?![a-záéíóúñ])` no matchea nunca: en español después de
  // «cuánt» siempre viene una letra. Era código muerto, y es la forma que más usa el
  // cliente que se quejó — sin el signo de apertura, que en WhatsApp no escribe nadie.
  //
  // Probado rompiéndolo: volviendo a `cu[aá]nt`, 2 fallos.
  for (const t of ['cuantas agendas tengo', 'cuántos leads entraron esta semana', 'cuanto gasté en ads']) {
    const v = clasificarIntencion(t);
    assert.notEqual(v.intencion, 'capturar', `«${t}» se guardaría como una TAREA en vez de contestarse`);
  }
});
