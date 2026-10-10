// La pastilla de una espera (DELAY en la flecha) no pisa las tarjetas de sus puntas, en CUALQUIER
// automatización. Lo encontró la verificación de los restos (10/10/2026): el árbol separa las columnas 92 px
// y «1 h antes de la reunión» mide 150, así que iba de x=251 a x=401 con el CRON terminando en 280 y la
// tarjeta siguiente empezando en 372. El recordatorio lo arreglaba sólo para él (lib/recordatorio-grafo.ts);
// ahora la columna se corre lo que pide su pastilla (`huecoHacia`, lib/flujo-conversacion.ts).
//
// ROTURAS (10/10/2026), restaurando de memoria, base 3 / 0:
//   P1. la columna vuelve al hueco fijo de 92                      → 0 / 3
//   P2. con varias esperas en la flecha, pide sólo la más ancha    → 2 / 1
import test from 'node:test';
import assert from 'node:assert/strict';
import { grafoDeSecuencia, AIRE_PILDORA, ID_ENTRADA, type PasoParaGrafo } from '../lib/flujo-conversacion';
import { posicionDePildora } from '../lib/lienzo-grafo';

const base = { canal: 'whatsapp', delay_horas: 0, cuerpo: '' } as const;
const espera = (id: string, siguiente: string, modo: 'antes_reunion' | 'despues', minutos: number) =>
  ({ ...base, id, nodo: 'esperar', espera: { modo, minutos }, siguiente } as PasoParaGrafo);
const msg = (id: string, siguiente: string | null = null) => ({ ...base, id, cuerpo: `Hola ${id}`, siguiente } as PasoParaGrafo);

/** Cada pastilla queda entre sus dos tarjetas, con su aire a cada lado. */
function sinPisar(pasos: PasoParaGrafo[]) {
  const g = grafoDeSecuencia(pasos, { disparador: 'Agendó una reunión' });
  let vistas = 0;
  for (const a of g.aristas) for (const e of a.esperas ?? []) {
    const r = posicionDePildora(g, e.id)!;
    const d = g.nodos.find((n) => n.id === a.desde)!;
    const h = g.nodos.find((n) => n.id === a.hasta)!;
    assert.ok(r.x >= d.x + d.ancho + AIRE_PILDORA - 1, `«${e.texto}» pisa la tarjeta de la izquierda (${r.x} < ${d.x + d.ancho})`);
    assert.ok(r.x + r.ancho <= h.x - AIRE_PILDORA + 1, `«${e.texto}» pisa la tarjeta de la derecha (${r.x + r.ancho} > ${h.x})`);
    vistas++;
  }
  return vistas;
}

test('una espera antes de la reunión, colgando del CRON, no pisa el CRON ni el mensaje', () => {
  assert.equal(sinPisar([espera('e1', 'm1', 'antes_reunion', 60), msg('m1')]), 1);
});

test('tampoco entre dos mensajes, con «1 día antes de la reunión»', () => {
  assert.equal(sinPisar([msg('m0', 'e1'), espera('e1', 'm1', 'antes_reunion', 1440), msg('m1')]), 1);
});

test('dos esperas seguidas en la misma flecha piden lo de las dos', () => {
  const pasos = [msg('m0', 'e1'), espera('e1', 'e2', 'despues', 1440), espera('e2', 'm1', 'antes_reunion', 60), msg('m1')];
  const g = grafoDeSecuencia(pasos, { disparador: 'X' });
  const a = g.aristas.find((x) => x.desde === 'm0')!;
  assert.equal(a.esperas?.length, 2, 'el fixture tiene que llevar las dos en una flecha');
  const d = g.nodos.find((n) => n.id === 'm0')!;
  const h = g.nodos.find((n) => n.id === 'm1')!;
  const [r1, r2] = a.esperas!.map((e) => posicionDePildora(g, e.id)!);
  // Van a distinta altura sobre la curva: lo que no pueden es pisarse como rectángulos.
  const seTocan = r1.x < r2.x + r2.ancho && r2.x < r1.x + r1.ancho && r1.y < r2.y + r2.alto && r2.y < r1.y + r1.alto;
  assert.ok(!seTocan, 'las dos pastillas se pisan entre sí');
  assert.ok(Math.min(r1.x, r2.x) >= d.x + d.ancho && Math.max(r1.x + r1.ancho, r2.x + r2.ancho) <= h.x, 'las pastillas pisan una tarjeta');
  void ID_ENTRADA;
});
