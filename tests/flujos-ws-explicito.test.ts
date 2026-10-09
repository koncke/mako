import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// =============================================================================
// Todo `dispararEvento` corre los flujos del workspace del EVENTO, nunca los del ws1
// =============================================================================
// `dispararEvento` (lib/flujos.ts) resolvía `ctx.ws ?? OWNER_WS` y volvía a envolver con ESE
// workspace: no lee el del contexto. Y las OCHO llamadas del repo —los webhooks de Calendly
// (×3), Cal.com (×2), Chatwoot, Meta y Fathom— lo llamaban SIN `ws`, cada una adentro de un
// `runWithWorkspace(ws)` que daba la sensación de estar cubierta. Así que el lead de
// CUALQUIER cliente corría los flujos del ws1 —Mauricio, otro cliente— en SU grupo de MaKo,
// con el nombre de un lead que no es suyo. ws11, ws13 y ws15 tienen ruteados esos webhooks.
//
// ⚠️ ESTE TEST NACIÓ MIRANDO UN SOLO ARCHIVO, y por eso existe así. La primera versión
// (tests/fathom-flujos-ws.test.ts, 06/10 16:18) fijaba el webhook de Fathom, que era donde se
// había visto el bug, y daba VERDE con las otras siete llamadas rotas: estaba bien escrito y
// preguntaba por el universo equivocado. Ahora BARRE `app/` y `lib/` y cualquier llamada nueva
// entra sola. La pregunta no es «¿lo arreglé donde lo vi?» sino «¿dónde más está esto?».
//
// Dos capas, y las dos tienen test:
//  · las LLAMADAS: cada `dispararEvento(` lleva `ws` en el primer nivel de su contexto, y es el
//    `ws` que resolvió el ruteo del webhook (declarado una vez, cortado si es null);
//  · la PUERTA: `dispararEvento` exige `ws` en el TIPO y, si igual llega sin él, no corre nada.
//    Ya no cae a OWNER_WS — `OWNER_WS` no es la plataforma: es un cliente.
//
// Lee el FUENTE sin comentarios (líneas `//` primero, bloques después): los comentarios que
// explican el arreglo nombran `dispararEvento` y `OWNER_WS`, y un guard que los leyera se
// acusaría a sí mismo.
//
// PROBADO ROMPIÉNDOLO (06/10/2026), sobre los archivos reales y restaurando de memoria. La
// versión de Fathom ya traía sus tres roturas (sacar `ws, `, poner `ws: OWNER_WS`, declarar un
// segundo `ws` → 1 fallo cada una). Las del barrido, con la primera versión de este archivo (5 tests):
//  · sacando `ws, ` de UNA llamada de Cal.com ............... 1 fallo / 4 pases
//  · poniendo `ws: OWNER_WS` en la de Meta .................. 1 fallo / 4 pases
//  · devolviendo `?? OWNER_WS` a la puerta de lib/flujos.ts .. 1 fallo / 4 pases
//  · sacando el `return` del fail-closed de la puerta ....... 1 fallo / 4 pases
//  · volviendo el ctx opcional (`ctx: CtxFlujo = {}`) ....... 1 fallo / 4 pases
//
// Y LA SEGUNDA PASADA (06/10/2026 a la noche, sobre lo que marcó un refutador): un guard que
// exige el NOMBRE `ws` y la función `wsPorIdentificador(` acusaba código sano —Calendly pasó a
// leer con `wsPorIdentificadorEstricto(` y el test 3 se puso rojo sobre un webhook correcto—, y
// un `import { dispararEvento as x }` dejaba la llamada afuera del barrido en verde. Ahora el
// valor puede ser cualquier expresión menos el ws1 / un número / null, el estructural mira sólo
// los webhooks, y un alias falla. Con este archivo (6 tests):
//  · `ws: 1` en la llamada de Chatwoot ...................... 1 fallo / 5 pases
//  · `ws: ctx.ws ?? OWNER_WS` en la de Meta .................. 1 fallo / 5 pases
//  · importando `dispararEvento as disparar` en Cal.com ...... 2 fallos / 4 pases (y el conteo baja a 7)
//  · un segundo `let ws` en el webhook de Calendly ........... 1 fallo / 5 pases
//
// ⚠️ La primera corrida de este archivo dio TRES rojos y ninguno era el código: el barrido
// encontraba `dispararEvento(` adentro del TEXTO del log de la puerta (una cadena no es una
// llamada) y la regex del corte se paraba en el primer paréntesis de `Number.isFinite(ws)`.
// Las dos se arreglaron del lado de la medición; un guard que se acusa a sí mismo manda a
// «arreglar» algo que está bien.
// =============================================================================

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')    // las líneas PRIMERO
  .replace(/\/\*[\s\S]*?\*\//g, '');   // y los bloques después

/**
 * Los `.ts`/`.tsx` de `app/` y `lib/`, del DISCO y no del índice: un barrido con `git
 * ls-files` no ve un archivo nuevo sin stagear, y el caller nuevo es justo el que importa.
 */
function fuentes(): string[] {
  const out: string[] = [];
  for (const dir of ['app', 'lib']) {
    for (const rel of readdirSync(join(RAIZ, dir), { recursive: true }) as string[]) {
      const r = rel.replace(/\\/g, '/');
      if (!/\.(ts|tsx)$/.test(r) || r.includes('node_modules')) continue;
      out.push(`${dir}/${r}`);
    }
  }
  return out;
}

/** Índice justo después de la cadena que abre en `i` (comillas simples, dobles o backtick). */
function finDeCadena(src: string, i: number): number {
  const q = src[i];
  let j = i + 1;
  while (j < src.length && src[j] !== q) j += src[j] === '\\' ? 2 : 1;
  return j + 1;
}

/** Los argumentos (texto crudo) de cada llamada `fn(…)`, con los paréntesis balanceados. */
function llamadas(src: string, fn: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`\\b${fn}\\(`, 'g');
  for (const m of src.matchAll(re)) {
    const ini = (m.index ?? 0) + m[0].length;
    let i = ini;
    let prof = 1;
    while (i < src.length && prof > 0) {
      const c = src[i];
      if (c === "'" || c === '"' || c === '`') { i = finDeCadena(src, i); continue; }
      if (c === '(') prof++;
      else if (c === ')') prof--;
      i++;
    }
    out.push(src.slice(ini, i - 1));
  }
  return out;
}

/** Parte por las comas del PRIMER nivel (fuera de (), {}, [] y cadenas). */
function partirPrimerNivel(s: string): string[] {
  const out: string[] = [];
  let prof = 0;
  let desde = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "'" || c === '"' || c === '`') { i = finDeCadena(s, i) - 1; continue; }
    if (c === '(' || c === '{' || c === '[') prof++;
    else if (c === ')' || c === '}' || c === ']') prof--;
    else if (c === ',' && prof === 0) { out.push(s.slice(desde, i).trim()); desde = i + 1; }
  }
  const resto = s.slice(desde).trim();
  if (resto) out.push(resto);
  return out;
}

/**
 * ¿El contexto de esta llamada lleva `ws` en su PRIMER nivel? Devuelve null si sí, o el motivo
 * si no. Un `ws` anidado (adentro de `datos`, por ejemplo) no cuenta: `dispararEvento` lee
 * `ctx.ws`, no `ctx.datos.ws`.
 *
 * El VALOR puede ser cualquier expresión (`ws`, `fila.workspace_id`): un cron que itera
 * inquilinos no tiene por qué llamar `ws` a su variable, y exigir el nombre convertiría al
 * guard en un candado sin llave. Lo que NO puede ser es el ws1 (`OWNER_WS`, que es un
 * cliente), un número cableado, ni null/undefined.
 */
function faltaWs(args: string): string | null {
  const [, ctx] = partirPrimerNivel(args);
  if (!ctx) return 'no le pasa contexto: sin ws no corre ningún flujo';
  if (!ctx.startsWith('{') || !ctx.endsWith('}')) return `el contexto no es un objeto literal (${ctx.slice(0, 40)}…): no se puede leer del fuente si lleva ws`;
  const entradas = partirPrimerNivel(ctx.slice(1, -1));
  const ws = entradas.find((e) => /^ws\b/.test(e));
  if (!ws) return 'el contexto no lleva `ws`';
  const valor = ws === 'ws' ? 'ws' : ws.replace(/^ws\s*:\s*/, '');
  if (/\bOWNER_WS\b|^\d+$|^(?:null|undefined)$/.test(valor)) return `lleva \`ws: ${valor}\`: el ws1 es un cliente, y un número cableado es el ws de otro`;
  return null;
}

/** Las llamadas reales del repo: archivo + argumentos. La definición no es una llamada. */
function llamadasDelRepo(): Array<{ archivo: string; args: string }> {
  const out: Array<{ archivo: string; args: string }> = [];
  for (const archivo of fuentes()) {
    const src = sinComentarios(leer(archivo));
    if (!src.includes('dispararEvento(')) continue;
    for (const args of llamadas(src, 'dispararEvento')) {
      if (archivo === 'lib/flujos.ts' && /^evento\s*:/.test(args.trim())) continue;   // la firma
      out.push({ archivo, args });
    }
  }
  return out;
}

// El analizador se prueba solo, para que el guard no pase en vacío sobre un caso que no
// sabe leer.
test('el analizador distingue el ws del primer nivel del que no está o está anidado', () => {
  const una = (s: string) => llamadas(s, 'dispararEvento')[0];
  assert.equal(faltaWs(una("dispararEvento('x', { ws, leadId: 1 })")), null);
  assert.equal(faltaWs(una("dispararEvento('x', { leadId: f(a, b), ws: ws })")), null);
  assert.match(faltaWs(una("dispararEvento('x', { leadId: 1 })")) ?? '', /no lleva `ws`/);
  assert.match(faltaWs(una("dispararEvento('x')")) ?? '', /no le pasa contexto/);
  assert.match(faltaWs(una("dispararEvento('x', { ws: OWNER_WS })")) ?? '', /ws: OWNER_WS/);
  assert.match(faltaWs(una("dispararEvento('x', { ws: ctx.ws ?? OWNER_WS })")) ?? '', /OWNER_WS/, 'el fallback viejo, escrito en la llamada');
  assert.match(faltaWs(una("dispararEvento('x', { ws: 1 })")) ?? '', /ws: 1/, 'un número cableado es el ws de otro');
  assert.match(faltaWs(una("dispararEvento('x', { ws: undefined })")) ?? '', /ws: undefined/);
  assert.equal(faltaWs(una("dispararEvento('x', { ws: fila.workspace_id, leadId: 1 })")), null, 'un cron que itera inquilinos nombra su ws como quiere');
  assert.match(faltaWs(una("dispararEvento('x', { datos: { ws: '1' }, leadId: 1 })")) ?? '', /no lleva `ws`/, 'un ws anidado no es ctx.ws');
  assert.match(faltaWs(una("dispararEvento('x', { wsX: 1, leadId: 1 })")) ?? '', /no lleva `ws`/, '`wsX` no es `ws`');
  assert.match(faltaWs(una("dispararEvento('x', ctx)")) ?? '', /no es un objeto literal/);
  // Una cadena con paréntesis y comas adentro no parte la llamada.
  assert.equal(faltaWs(una("dispararEvento('a, (b', { ws, leadNombre: 'x), y' })")), null);
});

test('TODA llamada a dispararEvento del repo lleva el ws del evento', () => {
  const todas = llamadasDelRepo();
  // «No encontré nada que revisar» no es «está todo bien»: si un día no queda ninguna
  // llamada, el guard quedó sin sujeto y hay que decidirlo, no pasar en verde.
  // (Eran 8 el 06/10; desde el 09/10/2026 son 7: la del webhook de Chatwoot se fue con la integración.)
  assert.ok(todas.length >= 7, `sólo encontré ${todas.length} llamadas a dispararEvento: el barrido perdió archivos (eran 7 el 09/10)`);
  const malas = todas
    .map((x) => ({ ...x, motivo: faltaWs(x.args) }))
    .filter((x) => x.motivo)
    .map((x) => `${x.archivo}: dispararEvento(${x.args.split(',')[0]}, …) → ${x.motivo}`);
  assert.deepEqual(malas, []);
});

// Sólo los WEBHOOKS: son los que llegan sin sesión y resuelven de quién es el evento por el
// ruteo. Un caller de otra familia (un cron, una acción) tiene su propia forma de saber el ws, y
// el test de arriba ya le prohíbe el ws1 y los números cableados. Y no se exige UNA función de
// ruteo: Calendly lee con `wsPorIdentificadorEstricto` y la línea de WhatsApp se resuelve por
// instancia — lo que se fija es la forma (una variable, cortada si es null antes del evento).
test('en cada WEBHOOK que dispara, el ws es una sola variable y corta si es null antes del evento', () => {
  const archivos = [...new Set(llamadasDelRepo().map((x) => x.archivo))].filter((a) => a.startsWith('app/api/webhooks/'));
  // (Eran 5 el 06/10; desde el 09/10/2026 son 4: el webhook de Chatwoot se borró.)
  assert.ok(archivos.length >= 4, `sólo ${archivos.length} webhooks disparan: el barrido perdió archivos (eran 4 el 09/10)`);
  const problemas: string[] = [];
  for (const archivo of archivos) {
    const src = sinComentarios(leer(archivo));
    const decl = [...src.matchAll(/\b(?:const|let|var)\s+ws\b/g)];
    if (decl.length !== 1) problemas.push(`${archivo}: ${decl.length} declaraciones de \`ws\` — el que llega al evento puede no ser el del ruteo`);
    const corte = src.indexOf('if (ws == null) {');
    const primera = src.indexOf('dispararEvento(');
    if (corte < 0 || corte > primera) problemas.push(`${archivo}: el corte por «sin workspace» no va antes del primer evento`);
  }
  assert.deepEqual(problemas, []);
});

test('nadie importa dispararEvento con OTRO nombre (el barrido busca el nombre)', () => {
  // `import { dispararEvento as disparar }` deja la llamada afuera de todo lo de arriba, en verde.
  const conAlias = fuentes()
    .filter((a) => /\bdispararEvento\s+as\s+\w+/.test(sinComentarios(leer(a))))
    .map((a) => `${a}: importa dispararEvento con alias — renombrala de vuelta o sumá el alias al barrido`);
  assert.deepEqual(conAlias, []);
});

test('Fathom: el ws que viaja es el que resolvió recorded_by, y nadie lo pisa en el medio', () => {
  const src = sinComentarios(leer('app/api/webhooks/fathom/route.ts'));
  // Desde el 07/10/2026 la lectura es la ESTRICTA (tests/webhooks-ruteo-estricto.test.ts) y va
  // en un try: el `ws` se declara arriba y se asigna una sola vez, acá.
  assert.match(src, /\bws = await wsPorIdentificadorEstricto\('fathom', hostEmail\);/);
  // Una sola asignación: la de la declaración. `(?![=>])` deja afuera `==`, `===` y `=>`.
  const asignaciones = [...src.matchAll(/(?<![.\w])ws\s*=(?![=>])/g)];
  assert.equal(asignaciones.length, 1, '`ws` se reasigna en algún lado');
});

// ⚠️ EL CONTRATO ES DE DOS ARCHIVOS. Pasar `ws` desde los webhooks no sirve de nada si
// `dispararEvento` vuelve a caer al ws1 cuando falta, y ese cambio no lo ve ningún test de
// los webhooks. Las roturas van EN MEMORIA sobre el texto real de lib/flujos.ts y corren en
// cada pasada: así se sabe que cada pregunta distingue.
const cuerpoDeDisparar = (flujos: string): string => {
  const ini = flujos.indexOf('export async function dispararEvento(');
  const fin = flujos.indexOf('export async function correrFlujoDe(', ini);
  assert.ok(ini > 0 && fin > ini, 'no encontré el cuerpo de dispararEvento en lib/flujos.ts');
  const cuerpo = flujos.slice(ini, fin);
  assert.ok(cuerpo.length < 2500, `el recorte de dispararEvento mide ${cuerpo.length}: está mirando otra cosa`);
  return cuerpo;
};
const caeAlWs1 = (c: string) => /OWNER_WS/.test(c);
const exigeWsEnElTipo = (c: string) => /ctx:\s*CtxFlujo\s*&\s*\{\s*ws:\s*number\s*\}/.test(c);
// El `if` del corte se lee por RENGLÓN: `[^)]*` se paraba en el primer paréntesis de
// `Number.isFinite(ws)` y la pregunta contestaba «no corta» sobre una puerta que corta.
const cortaSinWs = (c: string) => /if \(typeof ws !== 'number'[^\n]*\{[\s\S]{0,400}?\breturn;/.test(c);

test('la puerta: dispararEvento exige el ws en el tipo, no cae al ws1 y corta sin él', () => {
  const real = cuerpoDeDisparar(sinComentarios(leer('lib/flujos.ts')));
  assert.equal(caeAlWs1(real), false, 'dispararEvento volvió a nombrar OWNER_WS: un evento sin ws correría los flujos de Mauricio');
  assert.equal(exigeWsEnElTipo(real), true, 'el ctx de dispararEvento dejó de exigir `ws: number`: una llamada nueva sin ws vuelve a compilar');
  assert.equal(cortaSinWs(real), true, 'dispararEvento ya no corta cuando falta el ws');

  // Y cada pregunta distingue su rotura, sobre el texto real.
  const conFallback = real.replace('const ws = ctx?.ws;', 'const ws = ctx?.ws ?? OWNER_WS;');
  assert.notEqual(conFallback, real, 'la rotura en memoria no encontró `const ws = ctx?.ws;`: revisá la forma de la línea');
  assert.equal(caeAlWs1(conFallback), true, 'la pregunta no ve un fallback al ws1');
  const tipoOpcional = real.replace(/ctx:\s*CtxFlujo\s*&\s*\{\s*ws:\s*number\s*\}/, 'ctx: CtxFlujo = {}');
  assert.equal(exigeWsEnElTipo(tipoOpcional), false, 'la pregunta no ve que el tipo dejó de exigir ws');
  const sinCorte = real.replace(/(if \(typeof ws !== 'number'[^\n]*\{[\s\S]{0,400}?)\breturn;/, '$1');
  assert.equal(cortaSinWs(sinCorte), false, 'la pregunta no ve que se sacó el return del corte');
});
