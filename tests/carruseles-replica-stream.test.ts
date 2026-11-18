// =============================================================================
// «Editar» un ejemplo nunca termina sin decir por qué (18/11/2026, F14) — lib/carruseles/replica-stream.ts
// =============================================================================
// La ruta de «Editar» (app/api/image-editor/carruseles/replicar/route.ts) tiene `maxDuration = 300` y una corrida real llegó a
// 276,9 s. Si se pasaba, Vercel cortaba, el stream terminaba SIN `fin` y la pantalla (EditarCarrusel.tsx) se quedaba en «Escribo
// tu versión…» para siempre. Este test corre el servidor (`streamDeReplica`) y la pantalla (`leerStreamDeReplica`) de verdad,
// con una réplica de mentira que se cuelga, falla, revienta o termina, y mira qué le llega a la persona.
//
// Probado rompiéndolo (18/11/2026), base 10/0, cada rotura sola y restaurada desde una copia (nunca git):
//   · `streamDeReplica` sin la carrera contra el plazo (`await correr(mandar)` a secas)  → 8 pasan y 2 CANCELADOS por su timeout
//     (los dos de la IA colgada: sin el plazo, el stream no se cierra nunca);
//   · `leerStreamDeReplica` sin leer el resto del final (la última línea sin `\n`)       → 9/1;
//   · `mandar` sin el corte de `conFin` (deja salir un segundo `fin`)                    → 9/1 («falla con su motivo»);
//   · EditarCarrusel.tsx sin `setError(errorSinFin(ultima))`                              → 9/1 (el de cableado).
//
// Correr: node --import tsx --test tests/carruseles-replica-stream.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { errorPorPlazo, errorSinFin, leerStreamDeReplica, streamDeReplica } from '../lib/carruseles/replica-stream';
import { lineaDeEvento, type EventoReplica } from '../lib/carruseles/replica';

const RAIZ = join(import.meta.dirname, '..');
const sinComentarios = (src: string) => src.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** Lo que ve la pantalla: todos los eventos, y si llegó el `fin`. */
async function leer(stream: ReadableStream<Uint8Array>) {
  const eventos: EventoReplica[] = [];
  const r = await leerStreamDeReplica(stream, (e) => eventos.push(e));
  return { ...r, eventos, fines: eventos.filter((e) => e.fase === 'fin') };
}

const fin = (e: EventoReplica | undefined) => (e && e.fase === 'fin' ? e : null);

test('la IA se cuelga: la ruta manda el `fin` con la causa ANTES de su tope, y nombra la fase', { timeout: 3000 }, async () => {
  const s = streamDeReplica(async (alEvento) => {
    alEvento({ fase: 'leer', laminas: 6, vistas: 6 });
    alEvento({ fase: 'escribir', con: 'tu IA' });
    return new Promise(() => { /* la IA que no contesta nunca */ });
  }, { plazoMs: 40, minutos: 4 });
  const r = await leer(s);
  assert.equal(r.conFin, true, 'la pantalla recibió el fin');
  assert.equal(r.fines.length, 1);
  const f = fin(r.fines[0]);
  assert.ok(f && !f.ok);
  assert.match(f.ok ? '' : f.error, /^Tu IA tardó más de 4 minutos en escribir la versión y se cortó/);
  assert.match(f.ok ? '' : f.error, /Si se armó, está en tus diseños; si no, vuelve a intentar\.$/);
  assert.equal(r.ultima, 'escribir');
});

test('lo que la réplica manda DESPUÉS del plazo no se escribe, y no sale un segundo `fin`', { timeout: 3000 }, async () => {
  let tarde: (() => void) | null = null;
  const s = streamDeReplica(async (alEvento) => {
    alEvento({ fase: 'leer', laminas: 1, vistas: 1 });
    await new Promise<void>((res) => { tarde = res; });
    alEvento({ fase: 'lamina', indice: 0, total: 1, pagina: {}, ancho: 1080, alto: 1350 });
    alEvento({ fase: 'fin', ok: true, id: 'tarde', titulo: 'Carrusel · tarde' });
    return { ok: true, id: 'tarde', titulo: 'Carrusel · tarde' };
  }, { plazoMs: 30, minutos: 4 });
  const r = await leer(s);
  (tarde as (() => void) | null)?.();
  await new Promise((res) => setTimeout(res, 20));
  assert.equal(r.fines.length, 1, 'un solo fin');
  assert.match(fin(r.fines[0])?.ok === false ? (r.fines[0] as { error: string }).error : '', /mientras se leía el ejemplo/);
  assert.equal(r.eventos.some((e) => e.fase === 'lamina'), false, 'la lámina tardía no viajó');
});

test('inspeccionando, la IA que tardó es la del negocio que se mira', () => {
  assert.match(errorPorPlazo('escribir', 4, 'Mauricio Bustos'), /^La IA de Mauricio Bustos tardó más de 4 minutos/);
  assert.match(errorPorPlazo('escribir', 4, '  '), /^Tu IA/, 'un nombre vacío no es otro negocio');
  assert.match(errorPorPlazo('armar', 1, null), /^Se cortó a los 1 minuto, mientras se armaba el diseño\./);
});

test('termina bien: pasa el `fin` de la réplica tal cual, uno solo', { timeout: 3000 }, async () => {
  const s = streamDeReplica(async (alEvento) => {
    alEvento({ fase: 'leer', laminas: 1, vistas: 1 });
    alEvento({ fase: 'escribir', con: 'tu IA' });
    alEvento({ fase: 'lamina', indice: 0, total: 1, pagina: { id: 'p1' }, ancho: 1080, alto: 1350 });
    alEvento({ fase: 'fin', ok: true, id: 'abc', titulo: 'Carrusel · X' });
    return { ok: true, id: 'abc', titulo: 'Carrusel · X' };
  }, { plazoMs: 2000, minutos: 4 });
  const r = await leer(s);
  assert.equal(r.fines.length, 1);
  assert.deepEqual(fin(r.fines[0]), { fase: 'fin', ok: true, id: 'abc', titulo: 'Carrusel · X' });
  assert.equal(r.ultima, 'armar');
});

test('termina bien pero NO avisó: el `fin` sale del resultado, nunca «se cortó» sobre un diseño guardado', { timeout: 3000 }, async () => {
  const s = streamDeReplica(async () => ({ ok: true, id: 'xyz', titulo: 'Miniatura · Y', sinIA: true, aviso: 'Sin IA.' }), { plazoMs: 2000, minutos: 4 });
  const r = await leer(s);
  assert.equal(r.fines.length, 1);
  const f = fin(r.fines[0]);
  assert.ok(f && f.ok && f.id === 'xyz' && f.sinIA === true && f.aviso === 'Sin IA.');
});

test('falla con su motivo: el `fin` lleva el error y el link a conectar', { timeout: 3000 }, async () => {
  const s = streamDeReplica(async () => ({ ok: false, error: 'Ese ejemplo ya no está: elige otro.', conectar: null }), { plazoMs: 2000, minutos: 4 });
  const r = await leer(s);
  assert.deepEqual(r.fines, [{ fase: 'fin', ok: false, error: 'Ese ejemplo ya no está: elige otro.', conectar: null }]);
  // Si la réplica ya avisó su propio `fin` y además devuelve la falla, sale UNO (dos harían que la pantalla pise el primero).
  const dos = await leer(streamDeReplica(async (alEvento) => {
    alEvento({ fase: 'fin', ok: false, error: 'El suyo.' });
    return { ok: false, error: 'El de la ruta.' };
  }, { plazoMs: 2000, minutos: 4 }));
  assert.deepEqual(dos.fines.map((f) => (f.fase === 'fin' && !f.ok ? f.error : '')), ['El suyo.']);
});

test('revienta: el `fin` genérico, y el error queda en el log', { timeout: 3000 }, async () => {
  const vistos: unknown[] = [];
  const s = streamDeReplica(async () => { throw new Error('boom'); }, { plazoMs: 2000, minutos: 4, alFallar: (e) => vistos.push(e) });
  const r = await leer(s);
  assert.equal(r.fines.length, 1);
  assert.match((r.fines[0] as { error: string }).error, /^No pude armar el diseño\. Vuelve a intentar\.$/);
  assert.equal(vistos.length, 1);
});

/** Un stream crudo con estas líneas (como el de una función que murió a mitad). */
const crudo = (texto: string) => new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new TextEncoder().encode(texto)); c.close(); } });

test('la pantalla: un stream que termina SIN `fin` se dice, con la fase en que estaba', { timeout: 3000 }, async () => {
  const r = await leer(crudo(lineaDeEvento({ fase: 'leer', laminas: 3, vistas: 3 }) + lineaDeEvento({ fase: 'escribir', con: 'tu IA' })));
  assert.equal(r.conFin, false);
  assert.equal(r.ultima, 'escribir');
  assert.equal(errorSinFin(r.ultima), 'Se cortó antes de terminar, mientras se escribía la versión. Si se armó, está en tus diseños; si no, vuelve a intentar.');
  assert.equal(errorSinFin(null), 'Se cortó antes de terminar. Si se armó, está en tus diseños; si no, vuelve a intentar.');
});

test('la pantalla lee la última línea aunque no traiga el salto final', { timeout: 3000 }, async () => {
  const sinSalto = lineaDeEvento({ fase: 'fin', ok: true, id: 'q', titulo: 'T' }).trimEnd();
  const r = await leer(crudo(lineaDeEvento({ fase: 'leer', laminas: 1, vistas: 1 }) + sinSalto));
  assert.equal(r.conFin, true, 'el fin sin salto se perdía');
});

test('cableado: la ruta avisa antes de su tope y la pantalla dice el corte (lo que corre, arriba)', () => {
  const ruta = sinComentarios(readFileSync(join(RAIZ, 'app/api/image-editor/carruseles/replicar/route.ts'), 'utf8'));
  assert.match(ruta, /export const maxDuration = 300;/);
  assert.match(ruta, /const AVISO_ANTES_DEL_TOPE_MS = \(maxDuration - 15\) \* 1000;/, 'el plazo de la ruta no sale de su maxDuration');
  assert.match(ruta, /streamDeReplica\([\s\S]{0,400}?plazoMs: AVISO_ANTES_DEL_TOPE_MS/, 'la ruta no arma el stream con el plazo');
  const pantalla = sinComentarios(readFileSync(join(RAIZ, 'app/image-editor/carruseles/EditarCarrusel.tsx'), 'utf8'));
  assert.match(pantalla, /await leerStreamDeReplica\(r\.body,/, 'la pantalla no lee el stream con el lector compartido');
  assert.match(pantalla, /if \(!conFin && !ctrl\.signal\.aborted\) setError\(errorSinFin\(ultima\)\);/, 'sin fin, la pantalla se queda esperando');
});
