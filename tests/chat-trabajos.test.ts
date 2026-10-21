// =============================================================================
// Los trabajos largos del chat: se confirman y siguen por detrás (20/10/2026, ola 1, pieza 1.11)
// =============================================================================
// docs/ops-center-principal.md §2.7. Hecho = «`replicar_landing` responde en menos de 5 s; "créame una landing para el
// webinar" termina con la miniatura en el hilo, sin recargar, aunque tarde 3 minutos; con la pestaña cerrada a mitad, al
// volver está». Lo que se fija (tests/_trabajos-hijo.ts, el camino real contra una base de mentira, con un runner que
// tarda 5,5 s):
//   1. confirmar un trabajo largo en su tarjeta responde ENSEGUIDA (menos de 5 s) con un G6 en curso, y el trabajo
//      todavía no corrió; la pantalla consulta su avance con la llave del G6, y nadie más (otra llave, otro negocio);
//   2. al terminar, ESE mensaje pasa a «Hecho: …» con el G6 terminado y su «Abrir»: lo ve quien consulta, quien vuelve con
//      la pestaña cerrada (está en el hilo) y el modelo en el turno siguiente (es el texto del mensaje);
//   3. una propuesta lenta de pantalla confirmada adentro del chat termina con su miniatura, en un solo mensaje;
//   4. la tarjeta queda «En curso», y el G6 dibuja su avance y su resultado.
//
// Probado rompiéndolo (20/10/2026, con la base en 0 fallos):
//   · `confirmarDesdeTarjeta` sin el camino de los trabajos largos → 2 fallos (1 y 2);
//   · `estadoDeTrabajo` sin mirar la llave → 1 fallo (1);
//   · `aplicarPropuestaGenerica` anotando igual con `sinAnotar` → 1 fallo (3);
//   · `trasTarjeta` sin el estado «en curso» → 1 fallo (4).

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { sanearBloque, type Bloque } from '../lib/chat-bloques';
import { PILL_PROPUESTA, trasTarjeta } from '../app/m/mako/chat-ui';
import type { ResultadoTarjeta } from '../lib/mako-turno-app-reglas';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');

type Estado = { texto: string; bloques: Bloque[] } | null;
let medido: {
  tarjeta: ResultadoTarjeta; ms: number; antes: Estado; conOtraLlave: Estado; enOtroNegocio: Estado; pendienteAntes: string;
  despuesDeCorrer: Estado; pendienteDespues: string; pantalla: Estado; hilo: { id: number; session_id: number; content: string }[]; red: string[];
} | null = null;
const medir = () => {
  medido ??= JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_trabajos-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'],
  }));
  return medido!;
};
const trabajo = (e: Estado) => e?.bloques.find((b): b is Extract<Bloque, { t: 'trabajo' }> => b.t === 'trabajo');

test('1. confirmar un trabajo largo responde enseguida, y su avance sólo lo ve quien tiene la llave', () => {
  const r = medir();
  assert.deepEqual(r.red, [], 'nada sale a la red');
  assert.ok(r.ms < 5_000, `respondió en ${r.ms} ms, con un trabajo que tarda 5,5 s`);
  assert.ok(r.tarjeta.ok && r.tarjeta.enCurso, 'la tarjeta dice que sigue por detrás');
  const g6 = r.tarjeta.ok ? r.tarjeta.bloques?.[0] : undefined;
  assert.ok(g6?.t === 'trabajo' && g6.consulta && g6.pasos.some((p) => p.estado === 'en_curso'), 'con el G6 en curso y su llave');
  assert.equal(r.pendienteAntes, 'pendiente', 'el trabajo todavía no corrió');
  assert.match(r.antes?.texto ?? '', /^En curso: /, 'en el hilo queda «En curso»');
  assert.equal(trabajo(r.antes)?.pasos.at(-1)?.estado, 'en_curso');
  assert.equal(r.conOtraLlave, null, 'con otra llave, nada');
  assert.equal(r.enOtroNegocio, null, 'desde otro negocio, nada');
});

test('2. al terminar, el mismo mensaje pasa a «Hecho» con su resultado', () => {
  const r = medir();
  assert.equal(r.pendienteDespues, 'ejecutada');
  assert.match(r.despuesDeCorrer?.texto ?? '', /^Hecho: Replicada la página\./, 'el texto que lee el modelo en el turno siguiente');
  const t = trabajo(r.despuesDeCorrer);
  assert.ok(t && t.pasos.every((p) => p.estado === 'listo'), 'el G6 terminado');
  assert.deepEqual(t?.abrir, { titulo: 'Abrir en Web Generator', href: '/web-generator/l-9' }, 'con su «Abrir», del link que devolvió');
});

test('3. una propuesta lenta de pantalla termina con su miniatura, en un solo mensaje', () => {
  const r = medir();
  const t = trabajo(r.pantalla);
  assert.match(r.pantalla?.texto ?? '', /^Hecho: Creada la landing del webinar\./);
  assert.equal(t?.listo?.miniatura, '/cv/landing.webp', 'el G6 termina en el G5, con la miniatura');
  assert.equal(r.hilo.length, 2, 'un mensaje por trabajo: el «En curso» se reescribe, no se suma otro «Hecho»');
  assert.match(leer('app/mako/revisar/[id]/acciones.ts'), /enSegundoPlano\(c\.ctx\.ws, sesion, def\.titulo,\s*\(\) => aplicarPropuestaGenerica\(id, editado, c\.ctx, \{ sinAnotar: true \}\)/, '/mako/revisar (y el formulario del chat) lo corre por detrás');
  assert.match(leer('app/api/mako/chat/route.ts'), /runWithWorkspace\(persona\.ws, \(\) => estadoDeTrabajo\(sp\.get\('trabajo'\)\)\)/, 'la pantalla consulta en el negocio de quien pregunta');
});

test('4. la tarjeta queda «En curso», y el G6 dibuja su avance y su resultado', async () => {
  const r: ResultadoTarjeta = { ok: true, resumen: 'En curso: Replicar', paraLaPersona: [], enCurso: true };
  assert.equal(trasTarjeta(r, 'confirmar').estado, 'en_curso');
  assert.equal(PILL_PROPUESTA.en_curso.texto, 'En curso');
  const { BloqueHilo } = await import('../app/_chat/BloqueHilo');
  const enCurso = sanearBloque({ t: 'trabajo', titulo: 'Replicar', consulta: '1200.AxQ9Q5F591--1t2l', pasos: [{ texto: 'Confirmado', estado: 'listo' }, { texto: 'Replicar', estado: 'en_curso' }] })!;
  assert.match(renderToStaticMarkup(createElement(BloqueHilo, { b: enCurso })), /Sigue por detrás: puedes cerrar el chat, al volver está\./);
  const listo = sanearBloque({ t: 'trabajo', titulo: 'Replicar', consulta: '1200.AxQ9Q5F591--1t2l', pasos: [{ texto: 'Replicar', estado: 'listo' }], abrir: { titulo: 'Abrir en Web Generator', href: '/web-generator/l-9' } })!;
  const html = renderToStaticMarkup(createElement(BloqueHilo, { b: listo }));
  assert.doesNotMatch(html, /Sigue por detrás/);
  assert.match(html, /href="\/web-generator\/l-9[^"]*"[^>]*>Abrir en Web Generator</);
  assert.equal((sanearBloque({ ...enCurso, consulta: '1200' }) as { consulta?: string }).consulta, undefined, 'una llave sin token no pasa');
});
