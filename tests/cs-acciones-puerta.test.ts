// =============================================================================
// La PUERTA de las server actions de Customer Success, y quién firma lo que mueven
// =============================================================================
// Una server action es un POST que se puede mandar directo, sin pasar por la página: el
// `requireCapa('customer-success')` de app/customer-success/page.tsx no corre ahí. Hasta el
// 06/10/2026 las 16 actions de app/customer-success/actions.ts preguntaban si el lead era de
// ESTE workspace y nada más, así que un usuario de un workspace con capa 'pm' (la única sin
// esta tab) podía crear clientes, moverlos de etapa o leer sus pagos con un POST.
//
// Lo que se fija acá, ENUMERANDO los exports (no una lista escrita a mano: una lista cubre las
// actions que ya existían, nunca la que se agregue mañana):
//   · cada export de actions.ts abre con `puedeUsarCs()` (app/customer-success/puerta.ts);
//   · cada export de curso-ficha-actions.ts abre con `puerta(leadId)`, y esa `puerta` abre con
//     `puedeUsarCs()`: la regla de sesión y capa vive en UN lugar;
//   · puerta.ts es server-only, SIN 'use server', y nunca tira (fail-closed);
//   · `guardarEtapasEntregaAction` rebota un producto que no es de este workspace;
//   · los movimientos de entrega firman con quien los hizo (`por`), no con «CRM».
//
// ⚠️ SE LEE CON EL COMPILADOR DE TYPESCRIPT, no con regex sobre el texto: «la primera línea del
// cuerpo» es una pregunta sobre la ESTRUCTURA, y un `indexOf` del nombre encuentra la llamada a
// la puerta de la función de al lado. Y `getText()` deja afuera los comentarios, que en estos
// archivos citan la puerta al explicarla.
//
// PROBADO ROMPIÉNDOLO (06/10/2026): la tabla con los números está al final del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

const leer = (p: string) => readFileSync(resolve(import.meta.dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');
const fuente = (p: string) => ts.createSourceFile(p, leer(p), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const plano = (n: ts.Node, sf: ts.SourceFile) => n.getText(sf).replace(/\s+/g, ' ').trim();
const tiene = (n: ts.Node, k: ts.SyntaxKind) => !!ts.getModifiers(n as ts.HasModifiers)?.some((m) => m.kind === k);

type Fn = { nombre: string; nodo: ts.FunctionDeclaration };

/** Las funciones DECLARADAS en el archivo, exportadas o no. */
function funciones(sf: ts.SourceFile): Fn[] {
  return sf.statements
    .filter((s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && !!s.name && !!s.body)
    .map((nodo) => ({ nombre: nodo.name!.text, nodo }));
}

/** Todo lo que el archivo EXPORTA y no es una función async declarada (en un 'use server', tira el build). */
function exportsQueNoSonActions(sf: ts.SourceFile): string[] {
  return sf.statements
    .filter((s) => tiene(s, ts.SyntaxKind.ExportKeyword) || ts.isExportAssignment(s) || ts.isExportDeclaration(s))
    .filter((s) => !(ts.isFunctionDeclaration(s) && tiene(s, ts.SyntaxKind.AsyncKeyword)))
    .map((s) => plano(s, sf).slice(0, 80));
}

const exportadas = (sf: ts.SourceFile) => funciones(sf).filter((f) => tiene(f.nodo, ts.SyntaxKind.ExportKeyword));

const GATE = 'const no = await puedeUsarCs(); if (no) return { ok: false, error: no };';
/** Las dos primeras sentencias de un bloque, juntas y sin comentarios. */
const abre = (b: ts.Block | undefined, sf: ts.SourceFile) =>
  (b?.statements.slice(0, 2) ?? []).map((s) => plano(s, sf)).join(' ');

const ACC_RUTA = 'app/customer-success/actions.ts';
const FICHA_RUTA = 'app/customer-success/curso-ficha-actions.ts';
const ACC = fuente(ACC_RUTA);
const FICHA = fuente(FICHA_RUTA);

// ── La puerta ─────────────────────────────────────────────────────────────────

test('actions.ts: cada export es una action async y ABRE con la puerta', () => {
  assert.deepEqual(exportsQueNoSonActions(ACC), [], 'un export que no es una función async tira el build');
  const fns = exportadas(ACC);
  // Piso, no techo: si mañana hay 17, la 17 también pasa por acá.
  assert.ok(fns.length >= 16, `esperaba las 16 actions, encontré ${fns.length}: ¿se leyó otro archivo?`);
  const sinPuerta = fns.filter((f) => abre(f.nodo.body, ACC) !== GATE).map((f) => f.nombre);
  assert.deepEqual(sinPuerta, [], `estas actions no abren con la puerta (sesión + capa): ${sinPuerta.join(', ')}`);
  assert.match(leer(ACC_RUTA), /^import \{ puedeUsarCs \} from '\.\/puerta';$/m);
});

test('curso-ficha-actions.ts: cada export ABRE con `puerta(leadId)`, y la puerta con `puedeUsarCs`', () => {
  assert.deepEqual(exportsQueNoSonActions(FICHA), [], 'un export que no es una función async tira el build');
  const fns = exportadas(FICHA);
  assert.ok(fns.length >= 9, `esperaba las 9 actions de la ficha, encontré ${fns.length}`);
  const sinPuerta = fns.filter((f) => {
    // La puerta va adentro del `try`: lee la base y puede tirar, y el catch lo devuelve como fallo.
    const primera = f.nodo.body?.statements[0];
    const bloque = primera && ts.isTryStatement(primera) ? primera.tryBlock : f.nodo.body;
    return abre(bloque, FICHA) !== 'const p = await puerta(leadId); if (!p.ok) return p;';
  }).map((f) => f.nombre);
  assert.deepEqual(sinPuerta, [], `estas actions no abren con la puerta: ${sinPuerta.join(', ')}`);

  const puerta = funciones(FICHA).find((f) => f.nombre === 'puerta');
  assert.ok(puerta, 'desapareció la puerta de la ficha');
  if (!puerta) return;
  assert.equal(abre(puerta.nodo.body, FICHA), GATE, 'la puerta de la ficha tiene que preguntar PRIMERO la sesión y la capa, con la regla compartida');
  // Y la regla no vuelve a escribirse a mano acá: dos lugares es cómo una se queda vieja.
  assert.doesNotMatch(plano(puerta.nodo, FICHA), /getRolWsEfectivo|tabEnCapa/, 'la sesión y la capa volvieron a escribirse a mano en la ficha');
});

test('puerta.ts: server-only, SIN «use server», la regla de la página, y nunca tira', () => {
  const ruta = 'app/customer-success/puerta.ts';
  const sf = fuente(ruta);
  // Un 'use server' la convertiría en un endpoint más que el navegador puede llamar.
  const directivas = sf.statements.filter((s) => ts.isExpressionStatement(s) && ts.isStringLiteral(s.expression)).map((s) => plano(s, sf));
  assert.ok(!directivas.some((d) => /use server/.test(d)), 'puerta.ts no puede ser un archivo «use server»');
  assert.ok(sf.statements.some((s) => ts.isImportDeclaration(s) && plano(s, sf) === "import 'server-only';"), "falta import 'server-only'");

  const fn = funciones(sf).find((f) => f.nombre === 'puedeUsarCs');
  assert.ok(fn && tiene(fn.nodo, ts.SyntaxKind.ExportKeyword) && tiene(fn.nodo, ts.SyntaxKind.AsyncKeyword), 'puedeUsarCs tiene que ser un export async');
  if (!fn) return;
  const cuerpo = plano(fn.nodo, sf);
  // Lo mismo que `requireCapa('customer-success')`: sesión viva y la tab en la capa.
  assert.match(cuerpo, /if \(\(await getRolWsEfectivo\(\)\) == null\) return '/, 'sin sesión tiene que contestar que no');
  assert.match(cuerpo, /if \(!tabEnCapa\('customer-success', await getCapaActual\(\)\)\) return '/, 'sin la tab en la capa tiene que contestar que no');
  // Fail-closed: si leer la sesión o la capa tira, el motivo es un texto — nunca `null` («adelante»).
  const t = fn.nodo.body?.statements[0];
  assert.ok(t && ts.isTryStatement(t) && t.catchClause, 'puedeUsarCs tiene que atrapar lo que tire: es la primera línea de cada action, sin try alrededor');
  if (!t || !ts.isTryStatement(t) || !t.catchClause) return;
  const enCatch = t.catchClause.block.statements.map((s) => plano(s, sf)).join(' ');
  assert.match(enCatch, /^return '[^']+';$/, 'el catch tiene que devolver un motivo (fail-closed), no null');
});

test('guardarEtapasEntregaAction rebota un producto que no es de este workspace, ANTES de guardar', () => {
  const fn = exportadas(ACC).find((f) => f.nombre === 'guardarEtapasEntregaAction');
  assert.ok(fn, 'no está guardarEtapasEntregaAction');
  if (!fn) return;
  const c = plano(fn.nodo, ACC);
  const lee = c.indexOf(".from('productos').select('id').eq('id', productoId)");
  const rebota = c.search(/if \(!\(prods \?\? \[\]\)\.length\) return \{ ok: false/);
  const guarda = c.indexOf('guardarEtapasEntrega(productoId');
  assert.ok(lee > 0, 'no lee el producto con el inquilino puesto');
  assert.ok(rebota > lee, 'leer el producto y no rebotar si no vino es lo mismo que no leerlo');
  assert.ok(guarda > rebota, 'el guardado tiene que ir DESPUÉS de comprobar que el producto es suyo');
});

// ── Quién firma ───────────────────────────────────────────────────────────────

/** Las llamadas a `nombre(...)` dentro del archivo. */
function llamadas(sf: ts.SourceFile, nombre: string): ts.CallExpression[] {
  const out: ts.CallExpression[] = [];
  const ver = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === nombre) out.push(n);
    ts.forEachChild(n, ver);
  };
  ver(sf);
  return out;
}

test('los movimientos de entrega de las actions firman con quien los hizo (`por`)', () => {
  // Sin `por`, el choke point firma `POR_PERSONA` («CRM»): en la misma ficha, renombrar firmaba
  // con el email y mover firmaba «CRM».
  const mover = llamadas(ACC, 'moverClienteDeEtapa');
  assert.ok(mover.length >= 3, `esperaba las tres llamadas (mover, lote, volver), hay ${mover.length}`);
  const moverSinPor = mover.filter((c) => {
    const a = c.arguments[0];
    return !(a && ts.isObjectLiteralExpression(a) && a.properties.some((p) => p.name && ts.isIdentifier(p.name) && p.name.text === 'por'));
  }).map((c) => plano(c, ACC));
  assert.deepEqual(moverSinPor, [], 'estas llamadas al choke point van sin autor');

  const sacar = llamadas(ACC, 'sacarClienteDeEntrega');
  assert.ok(sacar.length >= 3, `esperaba las tres llamadas (lote, sacar, quitar), hay ${sacar.length}`);
  const sacarSinPor = sacar.filter((c) => c.arguments.length < 3).map((c) => plano(c, ACC));
  assert.deepEqual(sacarSinPor, [], 'estas salidas de la entrega van sin autor');
});

test('el choke point escribe el autor que le pasan; el curso sigue firmando MaKo', () => {
  const sf = fuente('lib/cs-mover-etapa.ts');
  const sacar = funciones(sf).find((f) => f.nombre === 'sacarClienteDeEntrega');
  assert.ok(sacar, 'no está sacarClienteDeEntrega');
  if (!sacar) return;
  assert.ok(sacar.nodo.parameters.some((p) => ts.isIdentifier(p.name) && p.name.text === 'por'), 'sacarClienteDeEntrega no recibe el autor');
  const c = plano(sacar.nodo, sf);
  assert.match(c, /autor: por,/, 'la línea de historial de la salida no usa el autor que le pasan');
  assert.doesNotMatch(c, /autor: POR_PERSONA/, 'la salida volvió a firmar «CRM» fijo');
  // El paso automático del curso NO es una persona: lo firma MaKo, a propósito.
  const avance = fuente('lib/curso-avance.ts');
  const mov = llamadas(avance, 'moverClienteDeEtapa');
  assert.equal(mov.length, 1);
  assert.match(plano(mov[0], avance), /por: POR_MAKO/, 'el curso dejó de firmar MaKo');
});

// ── Las roturas (06/10/2026), cada una restaurada de memoria (nunca con git) ────
// Corriendo juntos los cinco archivos que miran estas piezas (este, cs-mover-etapa,
// cs-deshacer-reloj, curso-ficha y nutricion-etapa): baseline 61 pass / 0 fail.
//   1. crearClienteAction sin su línea de puerta                    → 60/1 «actions.ts: cada export…»
//   2. un `export const TOPE = 1;` en actions.ts                      → 60/1 el mismo (y tira el build)
//   3. la puerta de la ficha con la sesión y la capa escritas a mano → 59/2 «curso-ficha-actions.ts…» y,
//      en curso-ficha.test.ts, «cada action pasa por la PUERTA…»
//   4. borrarLlamadaCursoAction sin `puerta(leadId)`                  → 59/2 los mismos dos
//   5. `'use server'` arriba de puerta.ts                             → 60/1 «puerta.ts: server-only…»
//   6. el catch de puedeUsarCs devolviendo `null` (deja pasar)        → 60/1 el mismo
//   7. guardarEtapasEntregaAction sin chequear el producto            → 60/1 «…rebota un producto…»
//   8. el lote sin `por`                                              → 59/2 «…firman con quien los hizo» y,
//      en cs-deshacer-reloj.test.ts, «las dos actions le pasan el reloj»
//   9. sacarDeEntregaAction sin el autor                              → 60/1 «…firman con quien los hizo»
//  10. la salida de la entrega con `autor: POR_PERSONA` fijo          → 60/1 «el choke point escribe el autor…»
// Restaurado: 61 pass / 0 fail.
