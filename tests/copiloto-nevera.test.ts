// =============================================================================
// Marketing CoPilot — la nevera de contenido (13/11/2026): lo que decide el código, sin base
// =============================================================================
// Fija lo que pidió Martín («cuántos videos, reels e historias hay guardados, cuántos se publicaron, hasta qué fecha alcanzan, y
// avisos para grabar más») y lo que no se puede romper:
//   · LISTA = de hoy en adelante, con su archivo y sin salir; lo de antes, lo sin archivo y lo ya publicado no cuentan;
//   · un video en YouTube es un video largo, y en otra red un reel; anuncios y correos no son de la nevera;
//   · avisa SÓLO con un ritmo respondido, cuando lo listo no cubre la semana que viene; sin ritmo no inventa cuánto publica;
//   · la tarea de la nevera es una por formato y por SEMANA: cerrada, no vuelve; la semana siguiente es otra.
// Probado rompiéndolo: al pie.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { armarNevera, avisosDeLaNevera, formatoDeNevera, lunesDe, type PiezaNevera } from '../lib/copiloto/nevera-reglas';
import { esClaveCoPilot, tareasDelCoPilot, type ResumenParaTareas } from '../lib/copiloto/tareas';

const HOY = '2026-11-13'; // viernes
const p = (dia: string, formato: string, extra: Partial<PiezaNevera> = {}): PiezaNevera => ({ formato, red: 'instagram', dia, conArchivo: true, publicada: false, hecha: false, ...extra });

test('lista = de hoy en adelante, con archivo y sin salir; publicadas = las de los últimos 30 días', () => {
  const filas = armarNevera([
    p('2026-11-14', 'reel'), p('2026-11-18', 'reel'),
    p('2026-11-20', 'reel', { conArchivo: false }),          // sin archivo: todavía no está grabado
    p('2026-11-21', 'reel', { publicada: true }),            // ya salió (raro, pero no es stock)
    p('2026-11-10', 'reel', { publicada: true }),            // publicada hace 3 días
    p('2026-10-01', 'reel', { hecha: true }),                // hace más de 30 días: no cuenta
    p('2026-11-15', 'story'),
    p('2026-11-16', 'ad'), p('2026-11-16', 'email'),         // no son de la nevera
  ], HOY, null);
  const reel = filas.find((f) => f.formato === 'reel')!;
  assert.equal(reel.listas, 2);
  assert.equal(reel.hasta, '2026-11-18');
  assert.equal(reel.publicadas30, 1);
  assert.equal(filas.find((f) => f.formato === 'story')!.listas, 1);
  assert.equal(filas.reduce((n, f) => n + f.listas, 0), 3, 'anuncios y correos no son de la nevera');
});

test('un video en YouTube es un video largo; en otra red, un reel', () => {
  assert.equal(formatoDeNevera('video', 'youtube'), 'video');
  assert.equal(formatoDeNevera('video', 'instagram'), 'reel');
  assert.equal(formatoDeNevera('post', 'instagram'), 'post');
  assert.equal(formatoDeNevera('ad', 'instagram'), null);
});

test('sin ritmo no avisa; con ritmo, avisa si lo listo no cubre la semana que viene', () => {
  const piezas = [p('2026-11-15', 'reel')];
  assert.ok(armarNevera(piezas, HOY, null).every((f) => f.faltan === 0), 'sin ritmo no se inventa cuánto publica');
  const filas = armarNevera(piezas, HOY, { reel: 3, story: 5 });
  assert.equal(filas.find((f) => f.formato === 'reel')!.faltan, 3);
  assert.equal(filas.find((f) => f.formato === 'story')!.faltan, 5, 'nada listo: la semana entera');
  const cubierta = armarNevera([p('2026-11-25', 'reel')], HOY, { reel: 3 });
  assert.equal(cubierta.find((f) => f.formato === 'reel')!.faltan, 0, 'hasta el 25 alcanza para la semana');
  const avisos = avisosDeLaNevera(filas, 4);
  assert.equal(avisos.find((a) => a.formato === 'reel')?.titulo, 'Graba 3 reels: te alcanzan hasta el domingo 15 (tienes 4 horas por semana)');
  assert.equal(avisos.find((a) => a.formato === 'story')?.titulo, 'Graba 5 historias: no tienes ninguna lista (tienes 4 horas por semana)');
});

test('la tarea de la nevera es una por formato y por semana', () => {
  assert.equal(lunesDe('2026-11-13'), '2026-11-09');
  assert.equal(lunesDe('2026-11-09'), '2026-11-09');
  assert.equal(lunesDe('2026-11-15'), '2026-11-09', 'el domingo es de la semana del lunes anterior');
  const base: ResumenParaTareas = {
    oferta: { sesion: 1, notaOferta: true, notaAngulos: true, notaVoz: true, faltan: { oferta: 0, angulos: 0, voz: 0 } },
    anuncios: { conectada: false, funnel: null, semana: [] }, web: [], redes: { instagram: { conectada: true }, youtube: { conectada: true } }, seguidos: 3,
    nevera: { lunes: '2026-11-09', avisos: [{ formato: 'reel', titulo: 'Graba 3 reels: no tienes ninguno listo' }] },
  };
  const { tareas, resueltas } = tareasDelCoPilot(base);
  const t = tareas.find((x) => x.clave.includes('nevera'))!;
  assert.equal(t.clave, 'instagram:nevera-reel-20261109');
  assert.ok(esClaveCoPilot(t.clave));
  assert.ok(resueltas.includes('instagram:nevera-story-20261109'), 'lo que alcanza, resuelto esta semana');
  assert.ok(resueltas.includes('youtube:nevera-video-20261109'));
  const otra = tareasDelCoPilot({ ...base, nevera: { ...base.nevera!, lunes: '2026-11-16' } }).tareas.find((x) => x.clave.includes('nevera'))!;
  assert.notEqual(otra.clave, t.clave, 'la semana siguiente es otra tarea');
});

// Probado rompiéndolo (13/11/2026):
//   · `armarNevera` contando las listas sin mirar `conArchivo` → el reel sin grabar sumaba: rojo.
//   · `faltan` sin exigir ritmo → avisaba sin saber cuánto publica: rojo.
