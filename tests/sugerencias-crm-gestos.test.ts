// =============================================================================
// Sugerencias de MaKo en el CRM: «repites un gesto» (clase 2) y «llega algo nuevo» (clase 4) (20/10/2026)
// =============================================================================
// Martín, 13/10 pts 2 y 3: sugerencias «inteligentes y personalizadas». El mapa (docs/sugerencias-mako-crm.md) tiene
// cuatro clases; el motor cubría la 1 y la 3 (docs/pedidos-crm.md, D4). Ahora:
//   · clase 2: mover a mano 5 o más leads de A a B en 14 días → «¿Lo hago solo?» (por el chat); marcar 3 No show a mano →
//     la plantilla de reagendar, con el porqué («marcaste 3 No show»);
//   · clase 4: el primer DM de Instagram o Messenger → que MaKo los conteste (las plantillas que ya existen);
//   · el server cuenta SÓLO los gestos de una persona (autor con email) y lo que no puede leer se abstiene.
//
// PROBADO ROMPIÉNDOLO (20/10/2026), con el archivo en 4 / 0, de a una rotura y restaurada:
//   · el umbral de movimientos en 1 (cualquier movimiento sugería)                 → 3 / 1
//   · la clase 2 DESPUÉS de la 1 (el No show perdía su porqué)                     → 3 / 1
//   · el server contando también lo que hizo MaKo (sin el filtro del email)        → 3 / 1
// Correr: node --import tsx --test tests/sugerencias-crm-gestos.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sugerenciasDelCrm, type EntradaSugerencias } from '../lib/sugerencias-crm';
import { generateFunnel, DEFAULT_PIPELINE } from '../lib/pipeline';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const { stages, transitions } = generateFunnel(DEFAULT_PIPELINE);
const HOY = '2026-10-20';
const base = (o: Partial<EntradaSugerencias> = {}): EntradaSugerencias => ({
  funnel: { id: 7, canal: 'llamadas', entradas: ['landing'], productoId: 3, etapasEntrega: ['onboarding'] },
  etapas: stages, transiciones: transitions, plazos: {},
  automatizaciones: [], leads: [], cuotas: { vencidas: 0, pendientes: 0 },
  conectado: { whatsapp: true, fathom: true }, hoy: HOY, ahora: Date.parse(`${HOY}T15:00:00Z`), ...o,
});
const mov = (desde: string, hacia: string, n: number) => Array.from({ length: n }, () => ({ desde, hacia }));

test('clase 2: mover a mano 5 leads de A a B lo ofrece por el chat; 4 no, y ganar o perder no es rutina', () => {
  const s = sugerenciasDelCrm(base({ gestos: { movimientos: [...mov('lead', 'agenda', 5), ...mov('agenda', 'ganado', 9), ...mov('lead', 'perdido', 9)], noShowsAMano: 0 } }), 100);
  const g = s.find((x) => x.id === 'gesto-mover:lead>agenda');
  assert.ok(g, 'cinco movimientos de A a B ofrecen hacerlo solo');
  assert.equal(g.clase, 2);
  assert.equal(g.accion.tipo, 'chat');
  assert.match(g.texto, /Hace 5 veces que mueves de «.+» a «.+»\. ¿Lo hago solo\?/);
  assert.ok(!s.some((x) => x.id.startsWith('gesto-mover:agenda>ganado') || x.id.startsWith('gesto-mover:lead>perdido')), 'ganar o perder son decisiones');
  const cuatro = sugerenciasDelCrm(base({ gestos: { movimientos: mov('lead', 'agenda', 4), noShowsAMano: 0 } }), 100);
  assert.ok(!cuatro.some((x) => x.clase === 2), 'con 4 no es un gesto repetido');
  assert.ok(!sugerenciasDelCrm(base(), 100).some((x) => x.clase === 2), 'sin historial leído, la clase 2 se calla');
});

test('clase 2: tres No show a mano ofrecen reagendar, con su porqué (gana a la de la clase 1)', () => {
  const s = sugerenciasDelCrm(base({ gestos: { movimientos: [], noShowsAMano: 3 } }), 100);
  const ns = s.filter((x) => x.id === 'lead-no-asistio:noshow_r1');
  assert.equal(ns.length, 1, 'una sola, sin repetir');
  assert.equal(ns[0].clase, 2);
  assert.match(ns[0].texto, /Marcaste 3 No show a mano/);
  const dos = sugerenciasDelCrm(base({ gestos: { movimientos: [], noShowsAMano: 2 } }), 100).find((x) => x.id === 'lead-no-asistio:noshow_r1');
  assert.equal(dos?.clase, 1, 'con 2, la de siempre del CRM armado');
});

test('clase 4: el primer DM de Instagram o Messenger, salvo que ya haya quien los reciba', () => {
  const s = sugerenciasDelCrm(base({ nuevos: { dmInstagram: 2, dmMessenger: 1 } }), 100);
  const ig = s.find((x) => x.id === 'instagram-te-escribieron');
  assert.ok(ig && ig.clase === 4 && ig.accion.tipo === 'plantilla');
  assert.match(ig.texto, /Te escribieron 2 personas por Instagram/);
  assert.ok(s.some((x) => x.id === 'messenger-te-escribieron' && x.texto.includes('Te escribió 1 persona por Messenger')));
  const yaHay = sugerenciasDelCrm(base({
    nuevos: { dmInstagram: 2, dmMessenger: 0 },
    automatizaciones: [{ id: 1, clave: null, trigger_tipo: 'instagram', disparadores: [{ trigger_tipo: 'instagram', subtipo: 'dm' }] } as never],
  }), 100);
  assert.ok(!yaHay.some((x) => x.id === 'instagram-te-escribieron'), 'ya hay una automatización que recibe los DM');
  assert.ok(!sugerenciasDelCrm(base({ nuevos: { dmInstagram: 0, dmMessenger: 0 } }), 100).some((x) => x.clase === 4));
});

test('el server cuenta sólo los gestos de una persona, y lo que no lee se calla', () => {
  const sv = leer('lib/sugerencias-crm-server.ts');
  const g = sv.slice(sv.indexOf('async function gestosAMano'), sv.indexOf('async function dmsNuevos'));
  assert.match(g, /!String\(f\.autor \?\? ''\)\.includes\('@'\)/, 'lo que hizo MaKo o una automatización no es un gesto de la persona');
  assert.match(g, /\.in\('campo', \[CAMPO_ETAPA, 'Asistió R1'\]\)/);
  assert.match(g, /maxPaginas: 10/, 'con tope: no se lee el historial entero');
  assert.match(sv, /gestosAMano\(idsCasa, ahora\)\.catch\(avisar\('gestos'\)\)/);
  assert.match(sv, /dmsNuevos\(ahora\)\.catch\(avisar\('conversaciones nuevas'\)\)/);
  assert.match(sv, /gestos, nuevos,\n\s+\};/);
});
