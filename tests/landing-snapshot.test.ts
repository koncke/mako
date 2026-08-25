// El «antes» contra el que se compara la landing. Lo que se testea acá no es el
// diff —eso es restar dos listas— sino la ASIMETRÍA: aparecer se cree a la
// primera, desaparecer necesita dos lecturas buenas seguidas.
//
// El caso que justifica cada línea: la landing del ws13 se sirve con
// `X-Vercel-Cache: HIT` y `Age` de horas, y su análisis depende de bajar hasta 8
// chunks de bundle con un timeout de 8 s. O sea que «no vi el video» es un
// resultado NORMAL en una página que sí lo tiene. Un aviso de «te sacaron el
// video» disparado por eso es peor que no avisar: entrena a ignorar los avisos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aplicarLectura,
  conSnapshot,
  hayCambios,
  parsearSnapshots,
  snapshotDe,
  type SnapshotLanding,
} from '../lib/landing-snapshot';

const T1 = '2026-08-20T10:00:00.000Z';
const T2 = '2026-08-21T10:00:00.000Z';
const T3 = '2026-08-22T10:00:00.000Z';

// ── Estrenar no es cambiar ──────────────────────────────────────────────────

test('la primera lectura no anuncia nada', () => {
  const r = aplicarLectura(null, ['video-nativo', 'formulario'], T1);
  assert.deepEqual(r.snapshot, { piezas: ['video-nativo', 'formulario'], visto: T1 });
  assert.equal(hayCambios(r.cambios), false);
  // Sin «antes», todo lo que la página tiene es nuevo PARA NOSOTROS, y nada de
  // eso es un cambio que el cliente haya hecho. Anunciarlo sería felicitarlo por
  // un video que subió hace un año.
  assert.deepEqual(r.cambios.nuevas, []);
  assert.equal(r.cambios.desde, null);
});

// ── Aparecer: a la primera ──────────────────────────────────────────────────

test('el VSL que agregaron después se detecta en UNA lectura', () => {
  // Es el pedido textual del dueño: «una landing puede NO tener VSL en un
  // principio y luego que los dueños le agreguen un VSL».
  const antes: SnapshotLanding = { piezas: ['formulario'], visto: T1 };
  const r = aplicarLectura(antes, ['formulario', 'video-nativo'], T2);
  assert.deepEqual(r.cambios.nuevas, ['video-nativo']);
  assert.deepEqual(r.cambios.sacadas, []);
  assert.equal(r.cambios.desde, T1);
  assert.deepEqual(r.snapshot.piezas.sort(), ['formulario', 'video-nativo']);
});

// ── Desaparecer: hacen falta dos ────────────────────────────────────────────

test('una pieza que falta UNA vez no se da por sacada', () => {
  const antes: SnapshotLanding = { piezas: ['video-nativo', 'formulario'], visto: T1 };
  const r = aplicarLectura(antes, ['formulario'], T2);
  assert.deepEqual(r.cambios.sacadas, [], 'no se anuncia todavía');
  assert.equal(hayCambios(r.cambios), false);
  // Y sigue contando como presente: los chequeos del video NO se apagan.
  assert.ok(r.snapshot.piezas.includes('video-nativo'));
  assert.deepEqual(r.snapshot.dudosas, ['video-nativo']);
});

test('si falta DOS veces seguidas, ahí sí se da por sacada', () => {
  const antes: SnapshotLanding = { piezas: ['video-nativo', 'formulario'], visto: T1 };
  const primera = aplicarLectura(antes, ['formulario'], T2);
  const segunda = aplicarLectura(primera.snapshot, ['formulario'], T3);
  assert.deepEqual(segunda.cambios.sacadas, ['video-nativo']);
  assert.deepEqual(segunda.snapshot.piezas, ['formulario']);
  assert.equal(segunda.snapshot.dudosas, undefined);
});

test('una lectura mala en el medio NO produce un aviso falso', () => {
  // La secuencia real que se quiere sobrevivir: el video está, un chunk tarda y
  // no se lo ve, y a la vuelta siguiente se lo ve otra vez. Nadie tocó nada.
  const antes: SnapshotLanding = { piezas: ['video-nativo', 'formulario'], visto: T1 };
  const parpadeo = aplicarLectura(antes, ['formulario'], T2);
  const vuelve = aplicarLectura(parpadeo.snapshot, ['video-nativo', 'formulario'], T3);
  assert.equal(hayCambios(parpadeo.cambios), false, 'el parpadeo no anuncia');
  assert.equal(hayCambios(vuelve.cambios), false, 'volver tampoco anuncia');
  assert.ok(vuelve.snapshot.piezas.includes('video-nativo'));
  // Y la duda se limpia: el contador NO es acumulativo entre parpadeos sueltos,
  // porque si no, dos timeouts separados por un mes terminarían borrando el video.
  assert.equal(vuelve.snapshot.dudosas, undefined);
});

test('sacar y volver a poner: las dos cosas se anuncian, en orden', () => {
  let s: SnapshotLanding = { piezas: ['video-nativo'], visto: T1 };
  s = aplicarLectura(s, [], T2).snapshot;
  const confirmado = aplicarLectura(s, [], T3);
  assert.deepEqual(confirmado.cambios.sacadas, ['video-nativo']);
  const repuesto = aplicarLectura(confirmado.snapshot, ['video-nativo'], T3);
  assert.deepEqual(repuesto.cambios.nuevas, ['video-nativo']);
});

// ── Saneo: un snapshot roto es «no hay antes», no una pantalla rota ─────────

test('parsear aguanta cualquier basura sin lanzar', () => {
  for (const basura of [null, '', '   ', 'no soy json', '[]', '"texto"', '123', '{"a":']) {
    assert.deepEqual(parsearSnapshots(basura), {}, String(basura));
  }
});

test('una entrada sin fecha de lectura buena no es un «antes» utilizable', () => {
  // Sin `visto` no se puede decir «desde tu última prueba, hace 6 días», y peor:
  // se podría anunciar como sacado algo que nunca se confirmó presente.
  const m = parsearSnapshots(JSON.stringify({
    'https://a.com': { piezas: ['video-nativo'] },
    'https://b.com': { piezas: ['formulario'], visto: 'ayer nomás' },
    'https://c.com': { piezas: ['formulario'], visto: T1 },
  }));
  assert.deepEqual(Object.keys(m), ['https://c.com']);
  assert.equal(m['https://a.com'], undefined);
  assert.equal(m['https://b.com'], undefined);
  assert.ok(m['https://c.com']);
});

test('las dudosas que no están entre las piezas se descartan', () => {
  const m = parsearSnapshots(JSON.stringify({
    'https://a.com': { piezas: ['formulario'], visto: T1, dudosas: ['video-nativo', 'formulario'] },
  }));
  assert.deepEqual(m['https://a.com'].dudosas, ['formulario']);
});

test('la clave es la URL normalizada, la misma que usa landing.config', () => {
  // Si las dos puntas normalizaran distinto, el snapshot quedaría huérfano y se
  // vería como «esta landing nunca se analizó» sobre una que se analiza a diario.
  const m = parsearSnapshots(JSON.stringify({ 'HTTPS://A.com/': { piezas: [], visto: T1 } }));
  assert.ok(snapshotDe(m, 'https://a.com'), 'se encuentra escrita de otra forma');
  assert.ok(snapshotDe(m, 'a.com'));
});

// ── Poda ────────────────────────────────────────────────────────────────────

test('borrar una landing de la lista le saca el snapshot', () => {
  const m = { 'https://a.com': { piezas: [], visto: T1 }, 'https://b.com': { piezas: [], visto: T1 } };
  const out = conSnapshot(m, 'https://a.com', { piezas: ['formulario'], visto: T2 }, ['https://a.com']);
  assert.deepEqual(Object.keys(out), ['https://a.com']);
});

test('sin la lista vigente NO se poda nada', () => {
  // No saber cuáles siguen vivas no autoriza a borrar: un `leer()` que falló y
  // devolvió [] vaciaría todos los snapshots del workspace.
  const m = { 'https://a.com': { piezas: [], visto: T1 }, 'https://b.com': { piezas: [], visto: T1 } };
  const out = conSnapshot(m, 'https://a.com', { piezas: ['formulario'], visto: T2 });
  assert.deepEqual(Object.keys(out).sort(), ['https://a.com', 'https://b.com']);
});
