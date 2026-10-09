// =============================================================================
// La invitación al curso AL GANAR: opcional, sólo en la transición, y por los tres caminos
// =============================================================================
// Pedido de Martín (07/10/2026, por la sesión de Customer Success): «poder automatizar la
// invitación al curso cuando un lead cae a Ganado, así no se tiene que estar invitando
// manualmente... Pero que sea opcional, activar esa automatización».
//
// Correr: npx tsx --test tests/crm-curso-al-ganar.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (07/10/2026), una por vez y restaurando de memoria. Con todo
// puesto: 8 pases / 0 fallos (07/10). Cada rotura, 7 / 1:
//   · apagar un embudo no lo saca de la lista
//   · cualquier guardado de un ganado invita (no sólo la transición)
//   · un motivo nuevo de Customer Success sale en blanco en el historial
//   · updateLead sin el enganche · el producto agregado sin el enganche
//   · el plan de pagos lee el estado DESPUÉS de escribir Ganado
//   · el enganche manda en línea (sin after) · el enganche no anota el historial
// Y el 08/10, con 9 tests: un escritor nuevo de Ganado (en lib/lead-funnel.ts) → 8 / 1, y
// contar las lecturas como escritores → 8 / 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  CURSO_AL_GANAR_KEY, conCursoAlGanar, lineaDelCurso, parsearCursoAlGanar, pasaAGanado,
} from '../lib/crm-curso-al-ganar-reglas';

const leer = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
/** Sin comentarios: la convención de la casa es citar en el comentario lo que se sacó. */
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
/** El cuerpo de UNA función, hasta la siguiente declaración de nivel superior. */
const cuerpoDe = (src: string, firma: string): string => {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  const fin = src.slice(i + firma.length).search(/\n(export )?(async )?function |\nexport (const|type) /);
  return src.slice(i, fin < 0 ? undefined : i + firma.length + fin);
};

test('nace APAGADA: sin setting, ilegible o con basura, no invita ningún embudo', () => {
  assert.deepEqual(parsearCursoAlGanar(null), []);
  assert.deepEqual(parsearCursoAlGanar(''), []);
  assert.deepEqual(parsearCursoAlGanar('{roto'), []);
  assert.deepEqual(parsearCursoAlGanar('{"a":1}'), []);
  assert.deepEqual(parsearCursoAlGanar('[0,-3,"x",null,1.5]'), []);
  // bigint como texto, y sin repetidos
  assert.deepEqual(parsearCursoAlGanar('["12", 12, 7]'), [12, 7]);
  assert.equal(CURSO_AL_GANAR_KEY, 'crm.curso_al_ganar');
});

test('prender y apagar UN embudo no toca los otros', () => {
  assert.deepEqual(conCursoAlGanar([3, 9], 5, true), [3, 9, 5]);
  assert.deepEqual(conCursoAlGanar([3, 9, 5], 9, false), [3, 5]);
  assert.deepEqual(conCursoAlGanar([3], 3, true), [3]);   // prender dos veces no duplica
  assert.deepEqual(conCursoAlGanar([], 4, false), []);
});

test('sólo la TRANSICIÓN a Ganado cuenta: re-guardar un ganado no es una venta nueva', () => {
  assert.equal(pasaAGanado('abierto', 'ganado'), true);
  assert.equal(pasaAGanado(null, 'ganado'), true);
  assert.equal(pasaAGanado('perdido', 'ganado'), true);
  assert.equal(pasaAGanado('ganado', 'ganado'), false);
  assert.equal(pasaAGanado('ganado', 'perdido'), false);
  assert.equal(pasaAGanado('abierto', 'abierto'), false);
});

test('el historial dice SIEMPRE qué pasó, corto, y un motivo nuevo no se calla', () => {
  assert.equal(lineaDelCurso({ ok: true, enviado: true }), 'Lo invité al curso por email');
  assert.equal(lineaDelCurso({ ok: true, enviado: false, motivo: 'ya-invitado' }), 'No lo invité al curso: ya estaba invitado');
  assert.equal(lineaDelCurso({ ok: true, enviado: false, motivo: 'cortado' }), 'No lo invité al curso: su acceso está cortado');
  assert.equal(lineaDelCurso({ ok: false, error: 'No salió el correo: rebotó' }), 'No lo invité al curso: No salió el correo: rebotó');
  // Un motivo que Customer Success agregue mañana sale con su clave, no en blanco.
  assert.equal(lineaDelCurso({ ok: true, enviado: false, motivo: 'otro-nuevo' }), 'No lo invité al curso: otro-nuevo');
  // Los cinco del contrato (docs/diseno-curso-skool.md) tienen su frase, y entran en una línea.
  for (const m of ['ya-invitado', 'ya-entro', 'sin-email', 'sin-clases', 'cortado', 'no-ganado']) {
    const l = lineaDelCurso({ ok: true, enviado: false, motivo: m });
    assert.ok(l !== `No lo invité al curso: ${m}` && l.length <= 70, l);
  }
  assert.ok(lineaDelCurso({ ok: false, error: 'x'.repeat(500) }).length <= 200);
});

test('los TRES caminos a Ganado llaman al enganche, y sólo en la transición', () => {
  const update = sinComentarios(cuerpoDe(leer('lib/leads.ts'), 'export async function updateLead('));
  assert.match(update, /if \(pasaAGanado\(actual\.estado_lead, merged\.estado_lead\)\) \{[\s\S]{0,200}alGanarInvitarAlCurso\(/);

  const plan = sinComentarios(cuerpoDe(leer('lib/pagos.ts'), 'export async function saveLeadPlanManual('));
  // El estado de ANTES se lee antes del update que gana.
  const iLee = plan.indexOf(".select('estado_lead, funnel_id')");
  const iEscribe = plan.indexOf(".update(leadUpdate)");
  assert.ok(iLee > 0 && iEscribe > iLee, 'el estado previo se lee antes de escribir Ganado');
  assert.match(plan, /if \(previo && pasaAGanado\(previo\.estado_lead, 'ganado'\)\) \{[\s\S]{0,200}alGanarInvitarAlCurso\(/);

  const fila = sinComentarios(cuerpoDe(leer('lib/lead-funnel.ts'), 'export async function moverEtapaEnProducto('));
  assert.match(fila, /if \(pasaAGanado\(terminalEstadoFor\(fila\.etapa\), terminalEstadoFor\(etapa\)\)\) \{[\s\S]{0,200}alGanarInvitarAlCurso\(\{ leadId, funnelId \}\)/);
});

test('el enganche sale barato si está apagado y no tira hacia quien movió al lead', () => {
  const src = sinComentarios(cuerpoDe(leer('lib/crm-curso-al-ganar.ts'), 'export async function alGanarInvitarAlCurso('));
  // La primera lectura es el setting, y con la lista vacía se sale antes de cualquier otra.
  const iLista = src.indexOf('await embudosQueInvitan()');
  const iSale = src.indexOf('if (!prendidos.length) return;');
  const iOtra = src.indexOf('idDelFunnelDefault()');
  assert.ok(iLista > 0 && iSale > iLista && iOtra > iSale, 'apagado = una lectura y sale');
  // Todo adentro de un try que no relanza.
  assert.match(src, /^export async function alGanarInvitarAlCurso\([^)]*\): Promise<void> \{\n  try \{/);
  assert.doesNotMatch(src, /\bthrow\b/);
  // Por detrás, y en línea si no hay request.
  assert.match(src, /after\(\(\) => runWithWorkspace\(ws, trabajo\)\)/);
});

test('NO hay una segunda invitación: delega en la de Customer Success', () => {
  const src = sinComentarios(leer('lib/crm-curso-al-ganar.ts'));
  // Al curso del producto DONDE GANÓ (09/10/2026): sin el producto, el acceso nacía abriendo todos sus
  // productos y ninguna invitación posterior lo acotaba.
  assert.ok(src.includes('invitarAlCursoSinSesion({ ws, leadId: p.leadId, autor: MAKO, productoId })'), 'delega, con el producto');
  assert.match(src, /const productoId = \(await productoDeFunnel\(\[real\]\)\)\.get\(real\)\?\.id \?\? null;/, 'el producto sale del embudo donde ganó');
  // Ninguna de las piezas que arman una invitación: si aparece una, hay dos invitaciones.
  for (const pieza of ['linkDeAcceso(', 'firmarAccesoCurso(', 'invitarAlCursoPorEmail(', 'marcarInvitacion(', "from('usuarios')", 'mako_session']) {
    assert.ok(!src.includes(pieza), pieza);
  }
  // Y lo que contestó queda en el historial, con actor MaKo.
  assert.ok(src.includes("logLeadEvent(p.leadId, 'Curso', lineaDelCurso(r), MAKO)"), 'historial con MaKo');
});

test('el interruptor: sólo el admin, y prender exige que el producto tenga clases', () => {
  const src = sinComentarios(leer('app/crm/curso-al-ganar-actions.ts'));
  assert.match(src, /getRolWsEfectivo\(\)\) !== 'admin'\) return \{ ok: false/);
  assert.match(src, /if \(prendido && !\(await estadoCursoAlGanar\(real\)\)\) return \{ ok: false/);
  // El tablero lo ofrece sólo en Ganado y sólo si el server dijo que hay curso.
  const board = leer('app/crm/CrmBoard.tsx');
  assert.match(board, /\.\.\.\(cursoAlGanar && terminalEstadoFor\(c\.key\) === 'ganado'/);
  // Y no es un useState sembrado de la prop (el tablero no se desmonta al cambiar de embudo).
  assert.doesNotMatch(board, /useState\(cursoAlGanar/);
});

test('todo el que ESCRIBE Ganado a mano está enumerado, y llama al enganche', () => {
  // Lo sugirió el relevo de Customer Success (08/10/2026): «conviene un test que enumere todo
  // escritor de estado_lead = 'ganado'». Un escritor nuevo que no pase por updateLead es una venta
  // que no invita al curso, y nada lo diría.
  //
  // ⚠️ LO QUE ESTO NO VE, y por qué está bien: los `update(patch)` con un patch armado en otro lado.
  // Son los dos REVERT (lib/mako-confirmaciones.ts al rechazar, lib/crm-auto.ts al compensar), que
  // devuelven un estado anterior y no venden nada, enumerados a mano el 08/10/2026.
  const archivos = execFileSync('git', ['ls-files', 'lib', 'app'], { encoding: 'utf8' })
    .split('\n').filter((f) => /\.(ts|tsx)$/.test(f));
  const escritores: string[] = [];
  for (const f of archivos) {
    let src: string;
    try { src = sinComentarios(leer(f)); } catch { continue; }
    for (const linea of src.split('\n')) {
      if (!/estado_lead:\s*'ganado'/.test(linea)) continue;
      // Las lecturas (`eq: { estado_lead: 'ganado' }`) y lo que pasa por updateLead no escriben a mano.
      if (/eq:\s*\{|\.eq\(|updateLead\(/.test(linea)) continue;
      escritores.push(f);
    }
  }
  assert.deepEqual([...new Set(escritores)], ['lib/pagos.ts'], `escritores de Ganado a mano: ${escritores.join(', ')}`);
  // Y ése llama al enganche (lo fija el test de los tres caminos, arriba).
});
