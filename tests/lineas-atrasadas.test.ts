// =============================================================================
// Las líneas de los NEGOCIOS que reciben con un día de atraso, y nadie lo veía (11/11/2026, informe de la voz sorda)
// =============================================================================
// Medido esa noche en `wa_mensajes` (llegada contra hora de envío): ws21 Florencia Carballo y ws22 Patricia Contreras desde el 3/11,
// ws20 Sergio Arriata desde el 7/11, ws9 y la voz: todo con ~24 h de atraso, en tandas cada ~50 min. La alarma de demora sólo leía la
// cola de MaKo: los clientes estuvieron hasta 9 días viendo sus conversaciones con un día de atraso. Lo que fija (lib/linea-demora.ts,
// lib/canal-vigilante.ts):
//   1. la medida: el atraso TÍPICO por línea (mediana), sin lo del importador (`raw.id`), sin eventos, sin lo encolado al vincularse,
//      con un mínimo de mensajes; una persona sin señal no es la línea;
//   2. las marcas: se avisa la primera vez y cada 3 h; una medida sana cierra; la que no se pudo medir NO vuelve;
//   3. el texto, con el nombre del negocio;
//   4. la función REAL (tests/_lineas-atrasadas-hijo.ts): un mail y una campanita por línea, con el nombre; la marca para el panel;
//      sin WhatsApp;
//   5. el cableado: va dentro de la alarma de demora, que corre en el cron.
//
// Probado rompiéndolo (11/11/2026, una rotura por vez, restaurada): ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ATRASO_TIPICO_MS, marcasDeAtraso, medirLineas, MIN_PARA_MEDIR, textoDeLasLineasAtrasadas, type FilaDeLinea, type MarcaDeLinea } from '../lib/linea-demora';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const T = (iso: string) => Date.parse(iso);
const fila = (inst: string, ws: number, llego: string, mandado: string, extra: Partial<FilaDeLinea> = {}): FilaDeLinea => ({ instance_name: inst, workspace_id: ws, created_at: llego, wa_timestamp: mandado, tipo: 'text', importado: null, ...extra });
const AHORA = T('2026-11-11T22:40:00Z');

test('1. la medida: el atraso típico por línea, sin importador, eventos ni lo encolado al vincularse', () => {
  assert.equal(ATRASO_TIPICO_MS, 30 * 60_000);
  assert.equal(MIN_PARA_MEDIR, 3);
  const filas = [
    // ws21 a las 21:52: lo del 10/11 14:28 (la tanda medida).
    ...['14:28', '14:29', '14:30'].map((hm, i) => fila('mako_ws21', 21, `2026-11-11T21:52:0${i}Z`, `2026-11-10T${hm}:00Z`)),
    // ws19 al día, con el importador (un mes atrás) y un evento viejo.
    ...[0, 1, 2].map((i) => fila('mako_ws19', 19, `2026-11-11T22:0${i}:03Z`, `2026-11-11T22:0${i}:00Z`)),
    ...[0, 1, 2, 3].map((i) => fila('mako_ws19', 19, `2026-11-11T22:10:0${i}Z`, '2026-10-11T10:00:00Z', { importado: 'cmh8k2x0a00ab' })),
    fila('mako_ws19', 19, '2026-11-11T22:11:00Z', '2026-11-09T10:00:00Z', { tipo: 'evento' }),
    // ws10: tres al día y una persona que escribió sin señal (3 h).
    ...[0, 1, 2].map((i) => fila('mako_ws10', 10, `2026-11-11T21:0${i}:02Z`, `2026-11-11T21:0${i}:00Z`)),
    fila('mako_ws10', 10, '2026-11-11T21:30:00Z', '2026-11-11T18:30:00Z'),
    // ws22 con dos mensajes: no alcanza para medir.
    fila('mako_ws22', 22, '2026-11-11T22:25:47Z', '2026-11-10T20:55:00Z'), fila('mako_ws22', 22, '2026-11-11T22:25:49Z', '2026-11-10T20:56:00Z'),
    // ws18 re-vinculada a las 22:30: lo encolado llega viejo a las 22:35.
    ...[0, 1, 2].map((i) => fila('mako_ws18', 18, `2026-11-11T22:35:0${i}Z`, '2026-11-10T22:00:00Z')),
    // Fuera de la ventana de 3 h.
    ...[0, 1, 2].map((i) => fila('mako_ws11', 11, `2026-11-11T19:0${i}:00Z`, '2026-11-10T19:00:00Z')),
  ];
  const m = medirLineas(filas, AHORA, new Map([['mako_ws18', T('2026-11-11T22:30:00Z')]]));
  assert.deepEqual(m.map((x) => [x.instancia, x.mensajes, x.tipicoMin]), [['mako_ws21', 3, 1883], ['mako_ws19', 3, 0], ['mako_ws10', 4, 0]], JSON.stringify(m));
});

test('2. las marcas: avisa la primera vez y cada 3 h; la medida sana cierra; la que no se midió no vuelve', () => {
  const med = (inst: string, ws: number, tipicoMin: number) => ({ instancia: inst, ws, mensajes: 6, tipicoMin, ultimaLlegadaMs: AHORA });
  const nombre = (ws: number | null) => ({ 20: 'Sergio Arriata', 21: 'Florencia Carballo' } as Record<number, string>)[ws ?? 0] ?? '?';
  const vinc = new Map([['mako_ws20', 1], ['mako_ws21', 2]]);
  const a = marcasDeAtraso({}, [med('mako_ws21', 21, 1882), med('mako_ws20', 20, 1799), med('mako_ws19', 19, 0)], AHORA, { negocio: nombre, vinculos: vinc });
  assert.deepEqual(a.avisar.map((l) => l.negocio), ['Florencia Carballo', 'Sergio Arriata']);
  assert.deepEqual(Object.keys(a.marcas).sort(), ['mako_ws20', 'mako_ws21'], 'marcó una línea sana');
  assert.equal(a.marcas.mako_ws20.vinculadaDesde, 1, 'la marca no dice sobre qué vinculación se midió');
  const b = marcasDeAtraso(a.marcas, [med('mako_ws21', 21, 1890), med('mako_ws20', 20, 1801)], AHORA + 10 * 60_000, { negocio: nombre, vinculos: vinc });
  assert.deepEqual(b.avisar, [], 'repitió el aviso a los 10 min');
  assert.equal(b.marcas.mako_ws21.desde, a.marcas.mako_ws21.desde, 'perdió desde cuándo está atrasada');
  assert.deepEqual(marcasDeAtraso(b.marcas, [med('mako_ws21', 21, 1890)], AHORA + 3 * 3_600_000, { negocio: nombre }).avisar.map((l) => l.instancia), ['mako_ws21'], 'a las 3 h no insistió');
  // ws21 medida sana: cierra. ws20 sin medir (no le entró nada): sigue marcada —el silencio es justo lo que hace una línea sorda—.
  const c = marcasDeAtraso(b.marcas, [med('mako_ws21', 21, 0)], AHORA + 4 * 3_600_000);
  assert.deepEqual(c.volvieron.map((l) => l.instancia), ['mako_ws21']);
  assert.deepEqual(Object.keys(c.marcas), ['mako_ws20'], 'una línea sin medir se dio por curada');
});

test('3. el texto lleva el nombre del negocio, el atraso y cómo se cura', () => {
  const l = (negocio: string, instancia: string, tipicoMin: number): MarcaDeLinea => ({ instancia, ws: 1, negocio, tipicoMin, mensajes: 6, desde: '2026-11-11T22:40:00.000Z', avisadaAt: null, vinculadaDesde: null });
  const t = textoDeLasLineasAtrasadas([l('Florencia Carballo', 'mako_ws21', 1882), l('Sergio Arriata', 'mako_ws20', 1799), l('Patricia Contreras', 'mako_ws22', 45)]);
  assert.equal(t.asunto, '⚠️ WhatsApp le entrega con 31 h de atraso a Florencia Carballo, Sergio Arriata, Patricia Contreras');
  assert.match(t.cuerpo, /· Sergio Arriata \(mako_ws20\): lo que entró en las últimas 3 h llegó con un atraso típico de 30 h \(6 mensajes\)\./);
  assert.match(t.cuerpo, /Patricia Contreras \(mako_ws22\): .* de 45 min/);
  assert.match(t.cuerpo, /un reinicio no la cura/);
  assert.match(t.cuerpo, /«Conectar» la desvincula sola y da el QR/);
});

test('4. la función real: un mail y una campanita por línea, con el nombre; la marca para el panel; sin WhatsApp', () => {
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--conditions=react-server', fileURLToPath(new URL('./_lineas-atrasadas-hijo.ts', import.meta.url))], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 240_000 });
  const linea = (r.stdout ?? '').split('\n').find((l) => l.startsWith('@@ATRASO@@'));
  assert.ok(linea, `el hijo no contestó (status ${r.status}): ${(r.stderr ?? '').slice(-1500)}`);
  const o = JSON.parse(linea.slice('@@ATRASO@@'.length));
  assert.equal(o.error, undefined, String(o.error));
  const p = o.primera;
  assert.equal(p.lineas.error, undefined, String(p.lineas.error));
  assert.deepEqual(p.lineas.avisadas, ['mako_ws21', 'mako_ws20', 'mako_ws22'], JSON.stringify(p.lineas));
  assert.deepEqual(p.mails.map((m: { asunto: string }) => m.asunto), ['⚠️ WhatsApp le entrega con 31 h de atraso a Florencia Carballo, Sergio Arriata, Patricia Contreras']);
  assert.deepEqual(p.campanita.map((c: { titulo: string }) => c.titulo), [
    'WhatsApp le entrega con 31 h de atraso a Florencia Carballo', 'WhatsApp le entrega con 30 h de atraso a Sergio Arriata', 'WhatsApp le entrega con 25 h de atraso a Patricia Contreras']);
  for (const c of p.campanita) assert.deepEqual([c.severidad, c.ws], ['urgente', 9], 'la campanita no fue al SuperAdmin, o no es urgente');
  assert.deepEqual(Object.keys(p.marcas).sort(), ['mako_ws20', 'mako_ws21', 'mako_ws22'], 'marcó una sana, el importador, o lo encolado de la recién vinculada');
  assert.equal(p.marcas.mako_ws20.vinculadaDesde, T('2026-10-19T11:57:08.000Z'));
  assert.deepEqual([o.diezMin.mails.length, o.diezMin.campanita.length], [0, 0], 'repitió a los 10 min');
  assert.deepEqual(o.ws21Volvio.lineas.volvieron, ['mako_ws21']);
  assert.deepEqual(o.ws21Volvio.campanita.map((c: { titulo: string; severidad: string }) => [c.titulo, c.severidad]), [['La línea de Florencia Carballo volvió a recibir a tiempo', 'info']]);
  assert.deepEqual(Object.keys(o.ws21Volvio.marcas).sort(), ['mako_ws20', 'mako_ws22'], 'las que no se pudieron medir se dieron por curadas');
  for (const k of ['primera', 'diezMin', 'ws21Volvio']) assert.equal(o[k].whatsapp, 0, `${k}: la alarma salió por WhatsApp`);
});

test('5. el cableado: dentro de la alarma de demora (en el cron), leyendo sólo lo entrante y la marca del importador', () => {
  const vig = sinComentarios(leer('lib/canal-vigilante.ts'));
  const i = vig.indexOf('export async function vigilarDemoraDeLaLinea(');
  assert.ok(i > 0 && vig.indexOf('const lineas = await vigilarLineasAtrasadas(ahora).catch(', i) > i, 'la alarma de demora dejó de medir las líneas');
  assert.match(vig, /\.select\('instance_name, workspace_id, created_at, wa_timestamp, tipo, importado:raw->>id'\)\n\s*\.eq\('from_me', false\)\.gt\('id', maxId - IDS_HACIA_ATRAS\)/);
  assert.match(vig, /tipo: 'linea-atrasada', severidad: 'urgente'/);
  assert.match(sinComentarios(leer('app/api/cron/alerta-critica/route.ts')), /const demora = await vigilarDemoraDeLaLinea\(\)\.catch\(/);
});

// ── Probado rompiéndolo (11/11/2026; cada rotura sola, restaurada después) ──────────────────────────────────────────────
//   L1 sin descartar lo del importador (`importado`)                                    → fallan el 1 y el 4
//   L2 el máximo en vez de la mediana                                                   → fallan el 1 y el 4
//   L3 sin el mínimo de mensajes                                                        → falla el 1
//   L4 sin la gracia tras vincularse                                                    → fallan el 1 y el 4
//   L5 una línea sin medir se da por curada                                             → fallan el 2 y el 4
//   L6 sin el tope de 3 h para repetir                                                  → fallan el 2 y el 4
//   L7 la alarma de demora sin las líneas                                               → fallan el 4 y el 5
