// Todo mensaje del onboarding que nombra algo de un video sale cuando la voz llega ahí (20/11/2026, tarde; Martín lo vio en producción:
// el video y el mensaje con «Abrir WhatsApp» salían juntos). El núcleo de app/_ui/tutorial/useMensajeDelVideo.ts con un video de
// mentira y un reloj a mano: el momento, y los desvíos que no pueden dejar a nadie trabado (sin play, falla, pausa, ya visto, sin
// video). Los momentos contra el manifiesto de verdad, y cómo lo arma app/onboarding/ChatArranqueV2.tsx.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { esperarAlMomento, momentoDelVideo, MS_SIN_PLAY, MS_SIN_VIDEO, type Reloj, type VideoQueCorre } from '../app/_ui/tutorial/useMensajeDelVideo';
import { MOMENTO_AGENDADO, MOMENTO_CODIGO, MOMENTO_NOMBRE, MOMENTOS_DEL_ONBOARDING } from '../lib/onboarding-v2/momentos';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

function lugarFalso(video: VideoQueCorre | null) {
  const oyentes = new Map<string, Set<() => void>>();
  return {
    addEventListener: (t: string, f: () => void) => { if (!oyentes.has(t)) oyentes.set(t, new Set()); oyentes.get(t)!.add(f); },
    removeEventListener: (t: string, f: () => void) => { oyentes.get(t)?.delete(f); },
    querySelector: () => video,
    emitir: (t: string) => { for (const f of [...(oyentes.get(t) ?? [])]) f(); },
    cuantos: () => [...oyentes.values()].reduce((n, s) => n + s.size, 0),
  };
}
function relojFalso(): Reloj & { correr(tipo: number): void; pendientes(): number[] } {
  let n = 0;
  const p = new Map<number, { f: () => void; ms: number }>();
  return {
    poner: (f, ms) => { p.set(++n, { f, ms }); return n; },
    sacar: (id) => { p.delete(id); },
    /** Corre los relojes de `ms` milisegundos. */
    correr: (ms) => { for (const [id, x] of [...p]) if (x.ms === ms) { p.delete(id); x.f(); } },
    pendientes: () => [...p.values()].map((x) => x.ms),
  };
}
const video = (o: Partial<VideoQueCorre> = {}): VideoQueCorre => ({ paused: true, ended: false, currentTime: 0, playbackRate: 1, ...o });

test('1. el mensaje del código: el video va solo, y el mensaje sale cuando la voz dice «toca Abrir WhatsApp» (una vez)', () => {
  const v = video();
  const l = lugarFalso(v);
  const r = relojFalso();
  const salidas: boolean[] = [];
  esperarAlMomento(l, { tMomento: 3.98, esperaPlay: MS_SIN_PLAY, hayVideo: true }, (p) => salidas.push(p), r);
  assert.deepEqual(salidas, [], 'quieto: el mensaje espera');
  v.paused = false; l.emitir('play');
  v.currentTime = 2; l.emitir('timeupdate');
  assert.deepEqual(salidas, [], 'antes de que la voz lo nombre, no');
  v.currentTime = 4; l.emitir('timeupdate');
  assert.deepEqual(salidas, [true], 'ahí, con sus tres puntitos');
  v.currentTime = 6; l.emitir('timeupdate'); l.emitir('ended');
  assert.deepEqual(salidas, [true], 'una sola vez');
  assert.equal(l.cuantos(), 0, 'y deja de oír el video');
  assert.deepEqual(r.pendientes(), [], 'sin relojes colgados');
});

test('2. los desvíos: nadie queda trabado (sin play, falla, pausa, ya visto, sin video)', () => {
  const caso = (v: VideoQueCorre | null, o: { hayVideo?: boolean; esperaPlay?: number } = {}) => {
    const l = lugarFalso(v);
    const r = relojFalso();
    const salidas: boolean[] = [];
    esperarAlMomento(l, { tMomento: 3.98, esperaPlay: o.esperaPlay ?? MS_SIN_PLAY, hayVideo: o.hayVideo ?? true }, (p) => salidas.push(p), r);
    return { l, r, salidas };
  };
  // Nadie le da play.
  const a = caso(video());
  a.r.correr(MS_SIN_PLAY);
  assert.deepEqual(a.salidas, [true], 'sin play: sale a los MS_SIN_PLAY, con sus puntitos');
  // Le dan play y falla.
  const b = caso(video());
  b.l.emitir('play'); b.l.emitir('error');
  assert.deepEqual(b.salidas, [true], 'el video falla: sale igual');
  // Lo pausan antes del momento.
  const c = caso(video({ paused: false }));
  c.l.emitir('pause');
  assert.deepEqual(c.salidas, [true], 'pausado: sale');
  // Ya se vio entero (o ya pasó su momento).
  const d = caso(video({ ended: true, currentTime: 16.9 }));
  assert.deepEqual(d.salidas, [true], 'ya visto: sale enseguida');
  // El manifiesto no tiene el video, o no cargó.
  const e = caso(null, { hayVideo: false });
  assert.deepEqual(e.salidas, []);
  e.r.correr(MS_SIN_VIDEO);
  assert.deepEqual(e.salidas, [true], 'sin video: sale a los MS_SIN_VIDEO');
  // Corre pero se traba (o flota en la esquina): a más tardar a su hora más el margen.
  const f = caso(video());
  f.l.emitir('play');
  assert.equal(f.r.pendientes().length, 1, 'el play saca la espera del play y pone el tope');
  assert.ok(f.r.pendientes()[0] > 3980 && f.r.pendientes()[0] < 3980 + 5000);
});

test('3. «¿Guardaste el contacto de MaKo?»: si el video sigue corriendo, espera «guarda el contacto»; si no corre, sale ya', () => {
  const corriendo = video({ paused: false, currentTime: 10 });
  const l = lugarFalso(corriendo);
  const r = relojFalso();
  const salidas: boolean[] = [];
  esperarAlMomento(l, { tMomento: 12.28, esperaPlay: 0, hayVideo: true }, (p) => salidas.push(p), r);
  assert.deepEqual(salidas, []);
  corriendo.currentTime = 12.3; l.emitir('timeupdate');
  assert.deepEqual(salidas, [true]);
  // Quieto (lo pausó, terminó o nunca lo vio): enseguida, sin puntitos de más (los de la respuesta del código ya estuvieron).
  const quieto: boolean[] = [];
  esperarAlMomento(lugarFalso(video({ currentTime: 5 })), { tMomento: 12.28, esperaPlay: 0, hayVideo: true }, (p) => quieto.push(p), relojFalso());
  assert.deepEqual(quieto, [false]);
});

test('4. los momentos, contra el manifiesto de verdad: cada mensaje nombra lo que dice la voz', () => {
  const man = JSON.parse(leer('public/tutoriales/manifiesto.json')) as { videos: { key: string; frases?: { t_inicio: number; texto: string }[] }[] };
  const t = (m: typeof MOMENTO_CODIGO) => momentoDelVideo(man.videos.find((x) => x.key === m.video)?.frases ?? [], m.dice);
  assert.equal(t(MOMENTO_CODIGO), 3.98, '«Para confirmarlo, toca Abrir WhatsApp…»');
  assert.equal(t(MOMENTO_AGENDADO), 12.28, '«Y guarda el contacto de MaKo…»');
  assert.equal(t(MOMENTO_NOMBRE), 18.92, '«Primero, unas preguntas cortas…»');
  for (const m of MOMENTOS_DEL_ONBOARDING) assert.notEqual(t(m), null, `${m.mensaje}: ninguna frase de ${m.video} dice «${m.dice}»`);
  assert.equal(momentoDelVideo([{ t_inicio: 1, texto: 'Toca ABRIR whatsapp' }], 'Abrir WhatsApp'), 1, 'sin mayúsculas ni acentos');
  assert.equal(momentoDelVideo([{ t_inicio: 1, texto: 'otra cosa' }], 'Abrir WhatsApp'), null);
});

test('5. el onboarding lo arma así: el video del WhatsApp y el código salen por la cola, a su momento, y el velo marca «Abrir WhatsApp» con su tarjeta', () => {
  const v2 = sinComentarios(leer('app/onboarding/ChatArranqueV2.tsx'));
  // El momento del código se espera con el video ya dibujado (sale por la cola, con sus puntitos); sin video, sin él.
  assert.match(v2, /lugar: filaWhatsapp, activo: mensajes\.some\(\(m\) => m\.id === MENSAJE_DEL_CODIGO\) && \(conVideoWa \|\| !videoWhatsapp\), inicial: yaEstaba\(MENSAJE_DEL_CODIGO\) \? 'listo' : 'espera',\n\s*clave: VIDEO_WHATSAPP, dice: MOMENTO_CODIGO\.dice, esperaPlay: MS_SIN_PLAY,/);
  assert.match(v2, /lugar: filaWhatsapp, activo: mensajes\.some\(\(m\) => m\.id === MENSAJE_AGENDADO\), inicial: yaEstaba\(MENSAJE_AGENDADO\) \? 'listo' : 'espera',\n\s*clave: VIDEO_WHATSAPP, dice: MOMENTO_AGENDADO\.dice, esperaPlay: 0,/);
  assert.match(v2, /useEffect\(\(\) => \{ if \(cola\.visibles\.some\(\(f\) => f\.id === FILA_VIDEO_WHATSAPP\)\) setConVideoWa\(true\); \}, \[cola\.visibles\]\);/);
  // Lo que espera su momento queda RETENIDO en la cola (sin puntitos); suelto, trae los suyos. Primero SOLO el video, como un mensaje más.
  assert.match(v2, /retenido: \(id\) => \(id === MOMENTO_NOMBRE\.mensaje && primero !== 'listo'\) \|\| \(id === MENSAJE_DEL_CODIGO && codigoFase !== 'listo'\)\n\s*\|\| \(id === MENSAJE_AGENDADO && agendadoFase !== 'listo'\),/);
  assert.match(v2, /if \(m\.id === MENSAJE_DEL_CODIGO && videoWhatsapp\) out\.push\(\{ id: FILA_VIDEO_WHATSAPP, de: 'mako', texto: '', m: null \}\);/);
  // La tarjeta (con «Abrir WhatsApp») sale después de su texto, y el velo la marca recién entonces.
  assert.match(v2, /const t = cola\.conPieza\(m\.id\) \? tarjeta\(m\) : null;/);
  assert.match(v2, /const tarjetaDelCodigo = cola\.conPieza\(MENSAJE_DEL_CODIGO\);/);
  assert.match(v2, /if \(!codigoEnVivo\.current \|\| !document\.querySelector\(SEL_ABRIR_WHATSAPP\)\) return;/);
  assert.match(v2, /marcaWa\.current = senalarDondeTocar\(PASO_ABRIR_WHATSAPP, fuera, \{ alOmitir: fuera \}\);/);
  assert.match(v2, /href=\{w\.link!\} target="_blank" rel="noopener noreferrer" data-abrir-whatsapp="">/);
  assert.match(v2, /if \(etapa === 'codigo' \|\| !marcaWa\.current\) return;\n\s*soltarSenal\(marcaWa\.current\);/, 'se va cuando el paso termina');
  // Los videos, oídos desde su fila (sin tocar el reproductor).
  assert.match(v2, /<div key=\{key\} ref=\{o\.lugar\} className=/);
});
