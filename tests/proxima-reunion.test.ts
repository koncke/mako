// =============================================================================
// proximaReunion — «la reunión del dato» y «la de la espera» son la MISMA (undécima tanda, 11/10/2026)
// =============================================================================
// docs/diseno-undecima-tanda.md §1.5 y §5. Los datos «Próxima reunión» del «{ }» (`{{reunion_cuando}}`,
// `{{reunion_hora}}`, `{{reunion_faltan}}`, `{{reunion_link}}`, `{{reunion_cual}}`) y el ancla del DELAY «antes de la
// reunión» tienen que hablar de la misma reunión, y no puede ser la regla laxa: `reunionFuturaMs` le inventa las
// 12:00 de México a una fecha sin hora (en el ws1, 74 leads así) y contaba como futura una reunión CANCELADA.
//
// Lo que se fija:
//   1. la ESTRICTA es la regla del emisor del recordatorio de hoy (`toquesVencidos`): hora puesta, fecha en pie que
//      coincide, sin asistencia, futura. Se CRUZA caso por caso con `toquesVencidos`: si una dice que sí y la otra
//      que no, el recordatorio del motor saldría donde el de hoy no (o al revés);
//   2. la LAXA es la de siempre, salvo que una cancelada (`fecha_junta_X` LEÍDA en null) ya no cuenta, y un objeto que
//      no trae la fecha se lee como antes;
//   3. los VALORES: «mañana», «10:00 a. m.», «en 24 horas», «2ª reunión», el link limpio; sin reunión estricta, nada;
//   4. el cableado: `reunionFuturaMs` y el resolvedor salen de `proximaReunion`.
//
// PROBADO ROMPIÉNDOLO: ver las roturas al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { proximaReunion, reunionFuturaMs, type FilaReunion } from '../lib/nutricion-reinscripcion';
import { toquesVencidos, juntasDe, TZ_FECHA_AGENDA, type FilaJuntas } from '../lib/recordatorio-lead';
import { valoresDeLaProximaReunion } from '../lib/variables-del-lead';

const leer = (r: string): string => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const VACIA: FilaJuntas = { junta_1_at: null, junta_2_at: null, fecha_junta_1: null, fecha_junta_2: null, asistio_j1: null, asistio_j2: null, junta_1_url: null, junta_2_url: null };
const fila = (o: Partial<FilaJuntas>): FilaJuntas => ({ ...VACIA, ...o });
const TIJ = 'America/Tijuana';
const BA = 'America/Argentina/Buenos_Aires';
const AHORA = Date.parse('2026-10-12T17:00:00Z');   // 10:00 del lunes 12 en Tijuana

test('la R1 ya pasó y la R2 viene: la próxima es la R2, con las dos reglas', () => {
  const l = fila({
    junta_1_at: '2026-10-11T17:00:00Z', fecha_junta_1: '2026-10-11',
    junta_2_at: '2026-10-13T17:00:00Z', fecha_junta_2: '2026-10-13', junta_2_url: 'https://meet.google.com/abc-defg-hij',
  });
  assert.deepEqual(proximaReunion(l, AHORA, { estricta: true }), { cual: 'R2', inicioMs: Date.parse('2026-10-13T17:00:00Z'), conHora: true, link: 'https://meet.google.com/abc-defg-hij' });
  assert.equal(proximaReunion(l, AHORA, { estricta: false })?.cual, 'R2');
  assert.equal(reunionFuturaMs(l, AHORA), Date.parse('2026-10-13T17:00:00Z'));
  // Las dos por delante: la más próxima.
  const dos = fila({ junta_1_at: '2026-10-14T17:00:00Z', fecha_junta_1: '2026-10-14', junta_2_at: '2026-10-13T17:00:00Z', fecha_junta_2: '2026-10-13' });
  assert.equal(proximaReunion(dos, AHORA, { estricta: true })?.cual, 'R2');
  assert.equal(proximaReunion(null, AHORA, { estricta: true }), null);
});

test('⚠️ una FECHA SIN HORA: la laxa la cuenta a mediodía de México sin hora; la estricta, NO es una próxima reunión', () => {
  const l = fila({ fecha_junta_1: '2026-10-14' });
  assert.deepEqual(proximaReunion(l, AHORA, { estricta: false }), { cual: 'R1', inicioMs: Date.parse('2026-10-14T18:00:00Z'), conHora: false, link: null });
  assert.equal(proximaReunion(l, AHORA, { estricta: true }), null, 'un «1 h antes» saldría a las 11:00 de una hora que nadie cargó');
  assert.deepEqual(valoresDeLaProximaReunion(l, TIJ, AHORA), {}, 'sin hora no hay «Próxima reunión»: sus renglones se van');
});

test('⚠️ una reunión CANCELADA (la hora quedó, la fecha en null) ya no cuenta, con ninguna regla', () => {
  const l = fila({ junta_1_at: '2026-10-14T17:00:00Z', fecha_junta_1: null });
  assert.equal(proximaReunion(l, AHORA, { estricta: false }), null, 'la laxa contaba la cancelada como futura');
  assert.equal(reunionFuturaMs(l, AHORA), null);
  assert.equal(proximaReunion(l, AHORA, { estricta: true }), null);
  // Un objeto que NO TRAE la fecha no afirma que se canceló: se lee como siempre (tests/nutricion-reinscripcion).
  assert.equal(reunionFuturaMs({ junta_1_at: '2026-10-14T17:00:00Z' }, AHORA), Date.parse('2026-10-14T17:00:00Z'));
});

test('la estricta: sin la asistencia marcada y con la fecha que COINCIDE (la del negocio también vale)', () => {
  const at = '2026-10-14T17:00:00Z';
  assert.equal(proximaReunion(fila({ junta_1_at: at, fecha_junta_1: '2026-10-14', asistio_j1: false }), AHORA, { estricta: true }), null, 'con la asistencia marcada, la reunión ocurrió');
  assert.equal(proximaReunion(fila({ junta_1_at: at, fecha_junta_1: '2026-10-14', asistio_j1: false }), AHORA, { estricta: false })?.cual, 'R1', 'la laxa no mira la asistencia (como siempre)');
  assert.equal(proximaReunion(fila({ junta_1_at: at, fecha_junta_1: '2026-10-15' }), AHORA, { estricta: true }), null, 'la hora quedó vieja: la fecha se editó a mano');
  // 05:30Z del 15 = 22:30 del 14 en Tijuana y 02:30 del 15 en Buenos Aires: la fecha escrita en la zona del negocio.
  const ba = fila({ junta_1_at: '2026-10-15T05:30:00Z', fecha_junta_1: '2026-10-15' });
  assert.equal(proximaReunion(ba, AHORA, { estricta: true }), null, 'sin la zona del negocio, sólo vale la de la agenda');
  assert.equal(proximaReunion(ba, AHORA, { estricta: true, tz: BA })?.cual, 'R1');
});

test('el link: el de ESA reunión y sólo un https', () => {
  const base = { junta_1_at: '2026-10-14T17:00:00Z', fecha_junta_1: '2026-10-14' };
  assert.equal(proximaReunion(fila({ ...base, junta_1_url: 'http://meet.google.com/abc' }), AHORA, { estricta: true })?.link, null);
  assert.equal(proximaReunion(fila({ ...base, junta_1_url: 'javascript:alert(1)' }), AHORA, { estricta: true })?.link, null);
  assert.equal(proximaReunion(fila({ ...base, junta_1_url: ' https://zoom.us/j/123 ' }), AHORA, { estricta: true })?.link, 'https://zoom.us/j/123');
  assert.equal(proximaReunion(fila({ ...base, junta_2_url: 'https://zoom.us/j/999' }), AHORA, { estricta: true })?.link, null, 'el link de la OTRA reunión no');
});

test('⚠️ LA ESTRICTA ES LA DEL EMISOR: caso por caso, sale un toque de 15 min sí y sólo sí hay próxima reunión', () => {
  // `toquesVencidos` (lib/recordatorio-lead.ts) es el emisor de hoy. Con `ahora` = 15 min antes de la hora, el
  // toque de 15 min vence justo; si la estricta dijera otra cosa, el carril del motor (M3) y el emisor no coincidirían.
  const at = '2026-10-14T17:00:00Z';
  const casos: Array<[string, FilaJuntas, string | null]> = [
    ['en pie', fila({ junta_1_at: at, fecha_junta_1: '2026-10-14' }), null],
    ['cancelada', fila({ junta_1_at: at, fecha_junta_1: null }), null],
    ['con asistencia', fila({ junta_1_at: at, fecha_junta_1: '2026-10-14', asistio_j1: true }), null],
    ['hora vieja', fila({ junta_1_at: at, fecha_junta_1: '2026-10-13' }), null],
    ['fecha del negocio, sin su zona', fila({ junta_1_at: '2026-10-15T05:30:00Z', fecha_junta_1: '2026-10-15' }), null],
    ['fecha del negocio, con su zona', fila({ junta_1_at: '2026-10-15T05:30:00Z', fecha_junta_1: '2026-10-15' }), BA],
    ['sin hora', fila({ fecha_junta_1: '2026-10-14' }), null],
    ['la R2', fila({ junta_2_at: at, fecha_junta_2: '2026-10-14' }), null],
  ];
  let conToque = 0;
  for (const [nombre, l, tz] of casos) {
    const t = Date.parse(l.junta_1_at ?? l.junta_2_at ?? '2026-10-14T18:00:00Z');
    const ahora = t - 15 * 60_000;
    const toque = toquesVencidos({ leadId: 1, juntas: juntasDe(l), ahora, toques: [15], tz }).length > 0;
    const prox = proximaReunion(l as FilaReunion, ahora, { estricta: true, tz });
    assert.equal(prox != null, toque, `«${nombre}»: el emisor dice ${toque ? 'que sí' : 'que no'} y la estricta lo contrario`);
    if (prox) assert.equal(prox.inicioMs, t, `«${nombre}»: otra reunión`);
    if (toque) conToque += 1;
  }
  assert.equal(conToque, 3, 'el cruce tiene que tener casos de los dos lados');
  assert.equal(TZ_FECHA_AGENDA, TIJ);
});

test('los VALORES de la próxima reunión: cuándo, a qué hora, cuánto falta (al mandar), cuál y el link', () => {
  const l = fila({ junta_2_at: '2026-10-13T17:00:00Z', fecha_junta_2: '2026-10-13', junta_2_url: 'https://meet.google.com/abc-defg-hij' });
  assert.deepEqual(valoresDeLaProximaReunion(l, TIJ, AHORA), {
    reunion_cual: '2ª reunión', reunion_cuando: 'mañana', reunion_hora: '10:00 a. m.', reunion_faltan: 'en 24 horas',
    reunion_link: 'https://meet.google.com/abc-defg-hij',
  });
  // Una hora antes: «hoy», «en 1 hora». La hora se dice en la zona del NEGOCIO.
  const unaHora = valoresDeLaProximaReunion(l, BA, Date.parse('2026-10-13T16:00:00Z'));
  assert.equal(unaHora.reunion_cuando, 'hoy');
  assert.equal(unaHora.reunion_faltan, 'en 1 hora');
  assert.equal(unaHora.reunion_hora, '2:00 p. m.', '17:00Z son las 14:00 de Buenos Aires');
  // Sin link, no hay `reunion_link` (y su renglón se va); con una zona que no se entiende, nada inventado.
  assert.ok(!('reunion_link' in valoresDeLaProximaReunion(fila({ junta_1_at: '2026-10-13T17:00:00Z', fecha_junta_1: '2026-10-13' }), TIJ, AHORA)));
  assert.equal(valoresDeLaProximaReunion(fila({ junta_1_at: '2026-10-13T17:00:00Z', fecha_junta_1: '2026-10-13' }), TIJ, AHORA).reunion_cual, '1ª reunión');
  assert.deepEqual(valoresDeLaProximaReunion(l, 'Zona/Inventada', AHORA), {});
});

test('CABLEADO: `reunionFuturaMs` y el resolvedor salen de `proximaReunion` (una sola regla de «la reunión»)', () => {
  const rein = sinComentarios(leer('lib/nutricion-reinscripcion.ts'));
  const rf = rein.slice(rein.indexOf('export function reunionFuturaMs('));
  assert.match(rf.slice(0, rf.indexOf('\n}\n')), /return proximaReunion\(juntas, ahoraMs, \{ estricta: false \}\)\?\.inicioMs \?\? null;/, 'reunionFuturaMs volvió a su propia regla');
  const del = sinComentarios(leer('lib/variables-del-lead.ts'));
  const vp = del.slice(del.indexOf('export function valoresDeLaProximaReunion('));
  assert.match(vp.slice(0, vp.indexOf('\n}\n')), /proximaReunion\(l, ahoraMs, \{ estricta: true, tz \}\)/, 'los datos no usan la estricta');
  const res = sinComentarios(leer('lib/variables-resolver.ts'));
  assert.match(res, /if \(zona && f\.has\('proxima'\)\) Object\.assign\(r, valoresDeLaProximaReunion\(l, zona, Date\.now\(\)\)\);/, 'el resolvedor no lee la próxima reunión con la ficha');
  assert.match(res, /pide\('momento'\) \|\| pide\('zona'\) \|\| pide\('proxima'\) \? await zonaPara\(/, 'la próxima reunión sin zona');
});

// ── Roturas (11/10/2026, arnés scratchpad/wf-undecima/w1-datos-catalogo/romper.mjs) ───────────────────────────
// Una por vez, restaurada desde la copia en memoria y verificada con md5 (nunca `git checkout`: hay otras sesiones
// en el árbol). Con tests/datos-mensaje: base 19 / 0. Con tests/nutricion-reinscripcion: base 36 / 0. Restaurado: igual.
//   R3.  la estricta ACEPTA una fecha sin hora (cae a mediodía de México)        → 17 / 2 (la fecha sola y el cruce con el emisor)
//   R6.  la laxa vuelve a contar la reunión CANCELADA                             → 35 / 1
//   R20. `reunionFuturaMs` con la estricta en vez de la laxa                      → 33 / 3 (éste, el de la cancelada y el
//        de tests/nutricion-reinscripcion: «una fecha sola es mediodía de México»)
