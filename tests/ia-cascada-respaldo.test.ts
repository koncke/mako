// =============================================================================
// La cascada de IA: el respaldo que no existía, y el turno que se tiraba a la basura
// =============================================================================
// EL INCIDENTE (30/09/2026). El dueño mandó un par de mensajes al grupo y MaKo le
// contestó «⚠️ Probé tus 4 cuentas de IA y las 4 me rebotaron por límite». Él dudó:
// «¿realmente se acabó de 4 cuentas con un par de mensajes?». No se había acabado
// nada. Lo que pasó, medido:
//
//   1. Gemini contestó OCHO veces HTTP 200 en nueve segundos y se quedó sin PASOS
//      antes de redactar. `chatCheapTools` devolvía un centinela y se perdía todo.
//   2. OpenAI —el último escalón, el que existe para este turno— era inalcanzable
//      desde el 13/08: `provsDe` leía `clavesCargadas`, que devuelve `[]` para los
//      proveedores de una sola cuenta.
//   3. El 413 de Groq («reduce your message size») trae `rate-limits` en la URL de
//      su documentación, así que la regex de cuota lo contaba como cuota agotada.
//   4. El «4» del mensaje salía de CONTAR FILAS en `credenciales`, no intentos.
//
// Los cuatro fallan iguales desde afuera: un cartel que culpa al cliente por algo
// que no es suyo y lo manda a cargar una key que no le hace falta.
//
// PROBADO ROMPIÉNDOLO, una por una (con todo puesto: 5 pasan, 0 fallan):
//   · `clavesAProbar` vuelve a devolver [] para el de una cuenta  -> 4 / 1
//   · `provsDe` vuelve a iterar `clavesCargadas` siempre          -> 4 / 1
//   · el cierre vuelve a mandar `tools` / `tool_choice`           -> 4 / 1
//   · nadie llama al cierre y vuelve el centinela pelado          -> 4 / 1
//   · mistral vuelve a la cascada del doer                        -> 4 / 1
//   · el rebote se anota con algo que no es el Nº de cuenta       -> 4 / 1
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clavesAProbar, clavesDe, PROVS_MULTIKEY, MAX_KEYS } from '../lib/ia-keys';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');
/** ⚠️ Sin comentarios: un guard que busca el nombre de lo que NO tiene que estar se
 *  acusa a sí mismo por el párrafo que explica por qué no está. */
const sinComentarios = (src: string): string =>
  src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** El bloque de una función, de su firma a la llave de cierre en la columna 0. Un
 *  guard que lee el archivo ENTERO encuentra lo que el archivo dice DE SÍ MISMO. */
const bloque = (src: string, firma: string): string => {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  const f = src.indexOf('\n}', i);
  return src.slice(i, f < 0 ? src.length : f + 2);
};

// ── 1. el proveedor de UNA sola cuenta existe ───────────────────────────────

test('⚠️ UN PROVEEDOR DE UNA SOLA CUENTA TIENE NOMBRE DE CLAVE, no cero claves', () => {
  // Las dos preguntas que se habían confundido: `clavesDe` contesta «¿cuántas CUENTAS
  // admite?» —y `[]` para los que cobran es correcto y deliberado— y `clavesAProbar`
  // contesta «¿por qué credencial pregunto?», que nunca puede ser ninguna.
  assert.deepEqual(clavesDe('openai'), [], 'openai no admite varias cuentas: eso no cambia');
  assert.deepEqual(clavesAProbar('openai'), ['OPENAI_API_KEY'],
    'sin esto OpenAI no existe en NINGUNA cascada: cero instancias, sin error y sin log');
  assert.deepEqual(clavesAProbar('anthropic'), ['ANTHROPIC_API_KEY']);
  // Y para los multikey no cambia nada: devuelve el catálogo entero, en orden.
  for (const p of PROVS_MULTIKEY) {
    assert.deepEqual(clavesAProbar(p), clavesDe(p), p);
    assert.equal(clavesAProbar(p).length, MAX_KEYS, p);
  }
  // Nunca vacío, para nadie: es la propiedad de la que cuelga todo lo de arriba.
  for (const p of [...PROVS_MULTIKEY, 'openai', 'anthropic', 'inventado']) {
    assert.ok(clavesAProbar(p).length >= 1, p);
  }
});

test('⚠️ `provsDe` PREGUNTA PRIMERO POR EL CATÁLOGO, que es lo que distingue los dos []', () => {
  // `clavesCargadas` devuelve `[]` por dos razones distintas («este ws no tiene
  // ninguna» y «este proveedor no admite varias cuentas») y su propio módulo lo dice.
  // Este loop leía una sola, así que para openai iteraba sobre nada.
  const b = sinComentarios(bloque(leer('../lib/ai-cheap.ts'), 'export async function provsDe('));
  assert.match(b, /const delCatalogo = clavesDe\(nombre\)/,
    'volvió a iterar `clavesCargadas` sin preguntar por el catálogo');
  assert.match(b, /delCatalogo\.length \? await clavesCargadas\(nombre\) : clavesProv\(nombre\)/,
    'el proveedor de una sola cuenta volvió a quedarse sin claves que probar');
});

test('⚠️ «NO PUDE LEER» Y «NO TIENE NINGUNA» NO PUEDEN SER EL MISMO VACÍO', () => {
  // Es el mismo bug del 30/09 en `provsDe`, una capa más abajo: `clavesEnBase`
  // devolvía un Set vacío TAMBIÉN cuando la consulta salía bien y el workspace no
  // tenía ninguna credencial — y el caller leía eso como «no pude leer» y caía al
  // catálogo ENTERO. Medido el 02/10/2026: para un workspace sin una sola fila en
  // `credenciales`, `contarKeysIA` contestaba **40**, con lo cual el veredicto
  // `sin_keys` («todavía no cargaste ninguna API key») era INALCANZABLE justo para el
  // caso que vino a resolver, y a quien no conectó nada se le decía «la IA que tengo
  // conectada me está rebotando por límite».
  //
  // Probado rompiéndolo: volviendo a `Promise<Set<string>>` + `if (!enBase.size)`,
  // 5 pasan y 1 falla.
  const src = sinComentarios(leer('../lib/ia-keys-ws.ts'));
  assert.match(src, /Promise<Set<string> \| null>/,
    'el fallo de lectura volvió a ser indistinguible de «no tiene ninguna»');
  assert.match(src, /if \(enBase === null\) return delCatalogo;/,
    'volvió a caer al catálogo entero por un Set vacío legítimo');
  assert.ok(!/if \(!enBase\.size\)/.test(src),
    'volvió la condición que confunde los dos vacíos');
});

// ── 2. agotar los pasos no es un fallo ──────────────────────────────────────

test('⚠️ QUEDARSE SIN PASOS SE CIERRA CON UN PEDIDO SIN HERRAMIENTAS, no se tira', () => {
  // El modelo ya trabajó: las tool_calls y sus resultados están en `msgs`. Lo único
  // que falta es que escriba, y con `tools` puesto puede volver a llamar en vez de
  // redactar. Es el request más barato del turno.
  const src = leer('../lib/ai-cheap.ts');
  const cuerpo = sinComentarios(bloque(src, 'async function cerrarSinTools('));
  // Lo que no puede viajar es la LLAVE del payload. El nombre de la función y la
  // feature que se registra también dicen «tools», y ésos son inofensivos — un guard
  // que busca la palabra suelta se acusa a sí mismo.
  assert.ok(!/[^_]tools\s*:|tool_choice/.test(cuerpo),
    `el cierre volvió a mandar herramientas, así que puede volver a no contestar:\n${cuerpo}`);
  assert.match(cuerpo, /chat\/completions/, 'el cierre dejó de pegarle al proveedor');
  // Y se llama ANTES de devolver el centinela, que es lo que el doer descarta.
  const tools = sinComentarios(bloque(src, 'export async function chatCheapTools('));
  const iCierre = tools.indexOf('cerrarSinTools(');
  const iCentinela = tools.indexOf('se alcanzó el máximo de pasos');
  assert.ok(iCierre >= 0, 'el cierre no se llama: el turno vuelve a morir en el centinela');
  assert.ok(iCierre < iCentinela, 'el centinela vuelve antes de intentar cerrar');
});

// ── 3. la cascada del doer sólo tiene a los que CONTESTAN ───────────────────

test('⚠️ NI MISTRAL NI CEREBRAS: un 4xx garantizado FABRICA el veredicto de cuota', () => {
  // Mistral devuelve 429 siempre (`limit-req-minute: 0`, medido con la key del cliente
  // el 30/09) y las siete keys de Cerebras devuelven 402 (medido el 12/08). Un
  // proveedor que rebota siempre no es un escalón: es una línea de «rate limit»
  // garantizada en la lista con la que `causaDelFallo` decide.
  const linea = sinComentarios(leer('../lib/mako-doer-in.ts'))
    .split('\n').find((l) => l.includes('const cands = ['));
  assert.ok(linea, 'se fue la lista de candidatos del doer');
  assert.ok(!/mistral/.test(linea), `mistral volvió a la cascada del doer: ${linea}`);
  assert.ok(!/cerebras/.test(linea), `cerebras volvió a la cascada del doer: ${linea}`);
  assert.match(linea, /'openai'/, 'se fue el último escalón, que es el que faltaba');
});

test('⚠️ EL 429 DEL DOER SE ANOTA: su cascada era la única sin marca', () => {
  // `anotarRebote429` tenía UN solo call site, en `chatCheapCascade` —la cascada SIN
  // herramientas, que el doer no usa—. Medido: 4.497 filas en `anthropic_usage` y
  // CERO con la marca, así que para contestar «¿qué pasó a las 20:30?» hubo que salir
  // a pegarle a la API de Google. Y esa marca es la que ordena las cuentas después.
  const src = sinComentarios(leer('../lib/mako-doer-in.ts'));
  assert.match(src, /anotarRebote429\(prov, nroCuenta\(inst\)/,
    'el doer volvió a no anotar el rebote, o lo anota con algo que no es el Nº de cuenta');
});
