// =============================================================================
// El chat de MaKo al costado del estudio de video (27/10/2026): el MISMO chat de la app, una conversación por persona
// =============================================================================
// Martín pidió el chat al costado «como en Web Generator»: la pieza es la del chat único (PanelDeChat + useChatCliente, el motor
// del Ops Center, como el del Second Brain), no un chat nuevo. Lo propio del estudio: desde dónde escribe (el anuncio abierto
// como entidad, así las herramientas toman su planId), el saludo y los arranques, y que el Ops Center la liste en su grupo.
//
// Probado rompiéndolo: ver el bloque «PROBADO ROMPIÉNDOLO» al final.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { desdeDelEstudio, saludoDelEstudio, arranquesDelEstudio } from '../app/video-generator/estudio/chat-reglas';
import { ENTIDADES } from '../lib/chat-desde';
import { ORIGEN_VIDEO_GENERATOR, TABS_CON_CHAT_PROPIO, TAB_VIDEO_GENERATOR, origenDeClave } from '../lib/chat-mako-reglas';
import { REGISTRO } from '../lib/api-mako/registro';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('desde el estudio: el anuncio abierto es la entidad, y su parámetro es el planId de las operaciones', () => {
  const d = desdeDelEstudio({ id: 'abc-1', titulo: '  Mi anuncio  ' });
  assert.equal(d.tab, ORIGEN_VIDEO_GENERATOR);
  assert.equal(d.modo, 'editar');
  assert.deepEqual(d.entidad, { tipo: 'anuncio', id: 'abc-1', titulo: 'Mi anuncio' });
  assert.equal(desdeDelEstudio(null).entidad, null, 'sin anuncio abierto (el nuevo), no hay entidad');
  assert.equal(desdeDelEstudio({ id: 'x', titulo: 'a'.repeat(200) }).entidad?.titulo.length, 80);
  assert.equal(ENTIDADES.anuncio.param, 'planId');
  // Todas las operaciones del área que piden el anuncio lo llaman planId: con otro nombre, la entidad no se tomaría por defecto.
  const deVideo = REGISTRO.filter((o) => o.area === 'video' && o.parametros.some((p) => /anuncio/i.test(p.descripcion) && p.nombre !== 'planId' && /id del anuncio/i.test(p.descripcion)));
  assert.deepEqual(deVideo.map((o) => o.id), []);
});

test('el saludo y los arranques cambian con el anuncio abierto, y son cortos', () => {
  assert.notEqual(saludoDelEstudio(null), saludoDelEstudio({ id: 'a', titulo: 'b' }));
  for (const a of [null, { id: 'a', titulo: 'b' }]) {
    const xs = arranquesDelEstudio(a);
    assert.equal(xs.length, 3);
    for (const x of xs) assert.ok(x.length <= 40, `«${x}» es largo para un botón`);
  }
});

test('una conversación por persona en la tab, y el Ops Center la lista como «Video Generator»', () => {
  assert.ok(TABS_CON_CHAT_PROPIO.includes(TAB_VIDEO_GENERATOR), 'la ruta sólo crea conversaciones de las tabs de esta lista');
  assert.equal(origenDeClave(`mako-movil:u12:${TAB_VIDEO_GENERATOR}`), ORIGEN_VIDEO_GENERATOR);
  assert.equal(origenDeClave('mako-movil:u12:second-brain'), 'Second Brain', 'el de al lado no cambia');
  assert.equal(origenDeClave(`otra:u12:${TAB_VIDEO_GENERATOR}`), null);
});

test('el chat del estudio es el chat único: PanelDeChat + useChatCliente, sin un chat propio', () => {
  const c = leer('app/video-generator/estudio/ChatVideo.tsx');
  assert.match(c, /from '@\/app\/admin\/operaciones\/PanelChat'/);
  assert.match(c, /useChatCliente\(/);
  assert.match(c, /\/api\/mako\/chat\?deTab=\$\{TAB_VIDEO_GENERATOR\}/);
  assert.doesNotMatch(c, /<textarea/, 'la caja es la de la casa (CajaChat), no una propia');
  const e = leer('app/video-generator/estudio/EstudioVideo.tsx');
  assert.match(e, /onTurno=\{releer\}/, 'lo que hizo MaKo ya está guardado: el estudio vuelve a leer al terminar el turno');
});

// PROBADO ROMPIÉNDOLO (27/10/2026, base 4/0):
//   · `desdeDelEstudio` sin la entidad (el chat no sabría qué anuncio está abierto)          → 3/1
//   · TABS_CON_CHAT_PROPIO sin TAB_VIDEO_GENERATOR (la ruta no crea la conversación)          → 3/1
//   · el estudio sin `onTurno={releer}` (lo que hizo MaKo no aparece hasta recargar)          → 3/1
