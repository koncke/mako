// =============================================================================
// Los chats de Claude Code en el Second Brain: el Centro como adaptador (tanda 5, 17/10/2026)
// =============================================================================
// Martín (17/10/2026): «quiero dejar de mandar prompts por aquí, quiero mandar prompts por MaKo en el Second Brain».
// Desde /second-brain y /m/second-brain, el super admin le escribe al Cerebro y a cada jefe con el MISMO motor que
// /admin/operaciones (app/admin/operaciones/useCentro.ts). Lo que se fija acá es lo que, roto, NO da error:
//
//   1. La lectura del Centro para otra página sin la guarda ARRIBA: una fila de la cola es un prompt que corre en la
//      PC de Martín, y lo leería cualquiera que abra el Second Brain.
//   2. Una página del Second Brain leyendo la cola por su cuenta, sin pasar por esa lectura guardada.
//   3. Una pantalla del Second Brain escribiendo en la cola por otro camino que mandar.ts (la firma del dispositivo).
//   4. En el teléfono, la hoja de la conversación ADENTRO de «Tus chats»: cerrarla al elegir el chat la desmontaría
//      (una hoja sobre otra REEMPLAZA, SheetM.tsx), y la conversación no se abriría nunca. Sin error.
//
// ⚠️ Probado ROMPIÉNDOLO (17/10/2026), una rotura por vez contra la base en verde de 5 pases:
//   · datos.ts leyendo la cola antes de `puedeOperar` (las dos líneas cambiadas de lugar) → 1 fallo;
//   · /second-brain con `listarPedidos()` propio → 1 fallo;
//   · SecondBrainCentroM con la hoja (`parte="hoja"`) adentro de `masChats` → 1 fallo;
//   · useCentro mandando con `encolarPedidoAction` en vez de `firma.mandar` → 1 fallo;
//   · buscarChats sin sacar las tildes → 1 fallo.
//   Restaurado de memoria (no con git checkout): 5 pases.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('la lectura del Centro para otra página pide puedeOperar en sus dos primeras líneas, antes de leer la cola', () => {
  const src = sinComentarios(leer('app/admin/operaciones/datos.ts'));
  assert.match(src, /^import 'server-only';/, 'nunca viaja al navegador');
  const i = src.indexOf('export async function datosDelCentroSiOpera(');
  assert.ok(i > 0, 'datosDelCentroSiOpera');
  const cuerpo = src.slice(src.indexOf('{', src.indexOf(')', i)) + 1);
  const dos = cuerpo.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 2);
  assert.deepEqual(dos, ['const admin = await getSesionAdmin();', 'if (!puedeOperar(admin, await wsSuperAdmin())) return null;']);
  assert.ok(cuerpo.indexOf('listarPedidos()') > cuerpo.indexOf('puedeOperar('), 'la guarda va antes de listarPedidos');
});

test('las dos páginas del Second Brain leen el Centro SÓLO por la lectura guardada', () => {
  for (const f of ['app/second-brain/page.tsx', 'app/m/second-brain/page.tsx', 'app/admin/operaciones/page.tsx']) {
    const src = sinComentarios(leer(f));
    assert.match(src, /datosDelCentroSiOpera\(\)/, `${f}: por datos.ts`);
    assert.doesNotMatch(src, /listarPedidos|leerCarteros|leerDecisiones|leerMunecos/, `${f}: la cola no se lee por fuera de la guarda`);
  }
});

test('las pantallas del Second Brain escriben a un chat sólo por mandar.ts (la firma del dispositivo)', () => {
  for (const f of ['app/second-brain/ChatSecondBrain.tsx', 'app/m/second-brain/SecondBrainCentroM.tsx', 'app/admin/operaciones/PiezasCentro.tsx',
    'app/admin/operaciones/useCentro.ts', 'app/m/operaciones/CentroAppMovil.tsx']) {
    assert.doesNotMatch(sinComentarios(leer(f)), /encolarPedido|cancelarPedido|crearTokenCartero/, `${f}: el único camino es mandar.ts`);
  }
  const motor = sinComentarios(leer('app/admin/operaciones/useCentro.ts'));
  // Desde el 17/10 va a la sesión de la cuenta elegida (o la automática) y con el modelo elegido (lib/centro-cuentas.ts).
  assert.match(motor, /const r = await firma\.mandar\(\{ sesion: d\.sesion, cuenta: d\.cuenta, titulo: c\.titulo \}, texto, alcance, como\);/, 'mandar firma en el dispositivo');
  // El panel de un chat de Claude Code en el Second Brain es la conversación del Centro, no otra caja.
  const sb = sinComentarios(leer('app/second-brain/ChatSecondBrain.tsx'));
  assert.match(sb, /<ChatDelCentro centro=\{centro\} chat=\{chatCentro\}/);
});

test('el teléfono: la hoja de la conversación vive AFUERA de «Tus chats»', () => {
  const src = sinComentarios(leer('app/m/second-brain/SecondBrainCentroM.tsx'));
  const ini = src.indexOf('masChats={(cerrar) => (');
  assert.ok(ini > 0, 'las filas van en la hoja «Tus chats»');
  const fin = src.indexOf(')} />', ini);
  const adentro = src.slice(ini, fin);
  assert.match(adentro, /parte="lista"/, 'adentro, sólo las filas');
  assert.doesNotMatch(adentro, /parte="hoja"/, 'la hoja adentro se desmontaría al cerrar «Tus chats»');
  assert.match(src.slice(fin), /<ChatsMDelCentro centro=\{k\} parte="hoja"/, 'la hoja, afuera');
});

test('buscar un chat de Claude Code no distingue tildes ni mayúsculas', async () => {
  const { buscarChats } = await import('../lib/centro-chats');
  const chats = [{ titulo: 'Centro de Operaciones' }, { titulo: 'CRM › Lead Detail' }, { titulo: 'Cerebro' }];
  assert.deepEqual(buscarChats(chats, 'operación').map((c) => c.titulo), ['Centro de Operaciones']);
  assert.deepEqual(buscarChats(chats, 'crm  › LEAD').map((c) => c.titulo), ['CRM › Lead Detail']);
  assert.deepEqual(buscarChats(chats, 'céreb').map((c) => c.titulo), ['Cerebro']);
  assert.equal(buscarChats(chats, '   ').length, 3, 'sin nada buscado, todos');
});

// Tanda 10 (17/10/2026): «entender el pedido». Lo que, roto, no da error: el pedido esperando a la ruta antes de
// mandar el turno (la respuesta se demora), o el mensaje partido (en el Second Brain todo sería «otra tab» y MaKo
// dejaría de contestar). Probado ROMPIÉNDOLO: con `await linksDelPedido(mensaje)` antes del turno → 1 fallo (éste).
test('el Second Brain pide los links EN PARALELO al turno, con la tab de MaKo, y no parte el mensaje', () => {
  const src = sinComentarios(leer('app/second-brain/ChatSecondBrain.tsx'));
  assert.match(src, /body: JSON\.stringify\(\{ texto, tab: 'mako' \}\)/);
  const mandar = src.slice(src.indexOf('const mandar = async ('), src.indexOf('const enviar = ('));
  const pide = mandar.indexOf('const irA = linksDelPedido(mensaje);');
  assert.ok(pide > 0 && pide < mandar.indexOf('await postArchivos') && pide < mandar.indexOf('await postLargo'), 'arranca antes del turno, sin esperarlo');
  assert.match(mandar, /void irA\.then\(\(links\) => \{ if \(links\.length\) setItems\(\(xs\) => colgarIrA\(xs, links, idU\)\); \}\);/);
  assert.match(mandar, /mensaje \}\)/, 'el turno lleva el mensaje entero');
});

