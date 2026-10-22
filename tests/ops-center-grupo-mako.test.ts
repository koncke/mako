// =============================================================================
// MaKo en WhatsApp en el Ops Center: el grupo del negocio se LEE ahí, sólo el admin (22/10/2026, OC3)
// =============================================================================
// El lector existía desde la tanda 8 (lib/chat-mako-indice.ts → grupoDeMaKo, hiloDelGrupoMaKo) y nadie lo llamaba: 1.375
// mensajes en 10 negocios que el cliente no veía en ningún lado. Ahora es una fila más de la lista del Ops Center, en la
// computadora y en el teléfono (el mismo motor, app/second-brain/useChatCliente.ts):
//   1. la fila sale sólo cuando el servidor da el grupo, con su hora, y entra en el orden y la búsqueda como las demás;
//   2. el corte de quién lo ve es del SERVIDOR (sólo el admin; el jid nunca sale) y no va a ningún modelo;
//   3. se lee: sin caja (dónde se contesta), sin el menú de un mensaje, y lo que se escribe no sale; «Ver anteriores» pagina.
//
// Correr: node --import tsx --test tests/ops-center-grupo-mako.test.ts
// PROBADO ROMPIÉNDOLO (base 3/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AVISO_GRUPO, TITULO_GRUPO, listaDelCliente } from '../lib/chat-mako-reglas';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. la fila del grupo: sólo si el servidor la da, con su hora, en el orden y en la búsqueda', () => {
  const base = { sesiones: [], offer: [{ id: 7, titulo: 'Sprint', updatedAt: '2026-10-22T10:00:00Z' }], antes: [], busca: '' };
  assert.ok(!listaDelCliente(base).some((f) => f.origen === 'grupo'), 'sin grupo (un miembro, o un negocio sin grupo), no hay fila');
  const con = listaDelCliente({ ...base, grupo: { titulo: TITULO_GRUPO, ultimoAt: '2026-10-22T12:00:00Z' } });
  assert.deepEqual(con.map((f) => f.clave), ['jefe', 'grupo', 'o7'], 'el Cerebro primero y el grupo por su último mensaje');
  const g = con.find((f) => f.origen === 'grupo')!;
  assert.deepEqual(g.elegido, { grupo: true });
  assert.equal(g.titulo, 'MaKo en WhatsApp');
  assert.deepEqual(listaDelCliente({ ...base, busca: 'whats', grupo: { titulo: TITULO_GRUPO, ultimoAt: null } }).map((f) => f.clave), ['jefe', 'grupo']);
});

test('2. quién lo ve lo decide el servidor (sólo el admin, sin el jid) y no va a ningún modelo', () => {
  const indice = sinComentarios(leer('lib/chat-mako-indice.ts'));
  for (const f of ['grupoDeMaKo', 'hiloDelGrupoMaKo']) {
    const desde = indice.indexOf(`export async function ${f}(`);
    const cuerpo = indice.slice(desde, indice.indexOf('\n}\n', desde));
    assert.match(cuerpo, /if \(p\.rol !== 'admin'\) return null;/, `${f}: sólo el admin`);
  }
  assert.match(indice, /return \{ titulo: TITULO_GRUPO, ultimoAt: filas\[0\]\?\.created_at \?\? null \};/, 'la fila no lleva el jid');
  const ruta = sinComentarios(leer('app/api/mako/chat/route.ts'));
  assert.match(ruta, /if \(sp\.get\('grupo'\)\) return json\(\{ ok: true, grupo: await grupoDeMaKo\(persona\) \}\);/);
  assert.match(ruta, /const hilo = await hiloDelGrupoMaKo\(persona, antesValido\(sp\.get\('desde'\)\)\);/, 'la página anterior, con la fecha saneada');
  // Ni la lista ni el hilo de los chats que lee MaKo (decisión 11): lo que se dijo en el grupo no se le da al modelo.
  const run = sinComentarios(leer('lib/api-mako/areas/mako.run.ts'));
  assert.doesNotMatch(run, /grupoDeMaKo|hiloDelGrupoMaKo|hiloDelGrupo\(/, 'listar_chats_mako / hilo_chat_mako no leen el grupo');
});

test('3. se lee: sin caja, sin el menú de un mensaje, y lo escrito no sale; «Ver anteriores» trae la página de antes', () => {
  const piezas = sinComentarios(leer('app/second-brain/PiezasCliente.tsx'));
  assert.match(piezas, /if \(k\.esGrupo\) return <p className="co-solo-lectura" role="note">\{AVISO_GRUPO\}<\/p>;/, 'en lugar de la caja, dónde se contesta');
  assert.match(piezas, /<ContextoWA\.Provider value=\{k\.esGrupo \|\| k\.esAutomatizacion(?: \|\| k\.esEditor)? \? null : k\.accionesWA\}>/, 'sin responder ni reaccionar');
  assert.match(piezas, /onClick=\{\(\) => void k\.verAnteriores\(\)\}/);
  assert.equal(AVISO_GRUPO, 'Se contesta en el grupo de WhatsApp.');
  const motor = sinComentarios(leer('app/second-brain/useChatCliente.ts'));
  assert.match(motor, /if \(esGrupo \|\| esAutomatizacion \|\| (?:esEditor \|\| )?\(!t && !archivos\.length\) \|\| ocupadoRef\.current/, 'lo que se escribe no va a ningún lado');
  assert.match(motor, /pedir<\{ grupo: GrupoDeMaKo \| null \}>\(`\$\{RUTA\}\?grupo=1`\)/);
  assert.match(motor, /`\$\{RUTA\}\?grupoHilo=1&desde=\$\{encodeURIComponent\(desde\)\}`/);
  // La computadora y el teléfono montan las mismas piezas (tests/ops-center-cliente.test.ts, 4).
  for (const f of ['app/second-brain/ChatSecondBrain.tsx', 'app/m/second-brain/ChatClienteM.tsx']) {
    assert.match(sinComentarios(leer(f)), /<CajaDelCliente k=\{k\}/, f);
  }
});

// PROBADO ROMPIÉNDOLO (22/10/2026, base 3/0):
//   · la fila del grupo sin su `grupo` (siempre en la lista)                 → 2/1 (1)
//   · grupoDeMaKo sin el corte del admin                                      → 2/1 (2)
//   · la caja del cliente también en el grupo                                 → 2/1 (3)
//   · `enviar` sin mirar `esGrupo`                                            → 2/1 (3)
