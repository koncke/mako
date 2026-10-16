// =============================================================================
// «PROBAR» ORDENA LOS «ANTES DE LA REUNIÓN» CONTRA LA REUNIÓN DEL LEAD (16/10/2026)
// =============================================================================
// Martín (feedback del 16/10 por Cerebro, punto 2): «EL ORDEN ESTÁ MAL: salen primero los "1 hora antes de la reunión"
// cuando tendrían que salir antes los "⏳ Esperar 5 min" o los que estén antes... si tenemos varias condiciones de
// "antes de...", eso debe funcionar bien».
//
// La causa (lib/simulador-grafo.ts, `correrHilo`): una espera «N antes de la reunión» NO movía el reloj de su camino
// («la prueba no tiene una reunión de la que descontar»). Con varios caminos en paralelo, el de los recordatorios se
// quedaba en el minuto 0 y salía entero antes que el «Esperar» de otro. Pero la prueba SÍ tiene una reunión: quien
// entra por una etapa de reunión la tiene mañana a esta hora (`hechosDeLeadNuevo`). Ahora el estado lleva ese minuto
// (`reunionMin`) y la espera lleva el reloj a la reunión menos N, como el motor (lib/nutricion-grafo-motor.ts: si eso ya
// pasó, sigue enseguida).
//
// ⚠️ PROBADO ROMPIENDO (16/10/2026, scratchpad romper-orden.mjs; base 3 pass / 0 fail). El resultado MEDIDO de cada
// rotura, al lado de su test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { plantillaPorId, pasosDePlantilla } from '../lib/plantillas-automatizaciones';
import { mensajesDelRecorrido, iniciar, siguiente, elegirComoLead, hechosDeLeadNuevo, reunionMinDe, escenariosDeLaSecuencia } from '../lib/simulador-grafo';
import { normalizar, idDe, type PasoGrafo } from '../lib/flujo-grafo';
import { TRIGGER_ETAPA } from '../lib/nutricion-etapa';

const leer = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const AHORA = Date.parse('2026-10-16T12:00:00Z');
const pasos = () => normalizar(pasosDePlantilla(plantillaPorId('lead-agendo')!) as unknown as PasoGrafo[]);
const ids = (ps: readonly PasoGrafo[]) => ps.map((p, i) => idDe(p, i));

/** Los eventos de la prueba con el minuto virtual de cada uno, eligiendo como el lead. */
function linea(reunionMin: number | undefined): Array<{ nodo: string; t: string; min: number }> {
  const ps = pasos();
  let st = iniciar(ps, { reunionMin });
  const out: Array<{ nodo: string; t: string; min: number }> = [];
  for (let v = 0; v < 80; v++) {
    const r = siguiente(ps, st);
    st = r.estado;
    if (r.evento && r.evento.t !== 'fin') out.push({ nodo: (r.evento as { nodo?: string }).nodo ?? '', t: r.evento.t, min: st.ahora });
    if (r.evento?.t === 'fin') break;
    if (st.eligiendo) {
      const e = elegirComoLead(ps, st, hechosDeLeadNuevo({ etapa: 'agenda', ahoraMs: AHORA, yaContactado: true }));
      if (!e.opcion) break;
      st = e.estado;
    } else if (!r.evento) break;
  }
  return out;
}

// rotura 1 (la espera «antes de la reunión» no mueve el reloj): 1 pass / 2 fail, caen éste y el del recorrido.
test('con la reunión del lead, «1 hora antes» sale en su minuto: después de un «Esperar» más corto de otro camino', () => {
  const hechos = hechosDeLeadNuevo({ etapa: 'agenda', ahoraMs: AHORA });
  assert.equal(reunionMinDe(hechos), 24 * 60, 'quien entra por «agenda» tiene la reunión mañana a esta hora');
  const l = linea(reunionMinDe(hechos));
  const en = (nodo: string) => l.find((x) => x.nodo === nodo);
  // La cadena de recordatorios, contra la reunión (1440): 1 día antes = ya (0), 1 hora antes = 1380, 30 min = 1410…
  assert.equal(en('la_w24')?.min, 0);
  assert.equal(en('la_w60')?.min, 24 * 60 - 60);
  assert.equal(en('la_mk2')?.min, 24 * 60 - 30);
  // …y el otro camino espera «1 día» por tiempo (1440): su CONDITION va DESPUÉS de los de «1 hora» y «30 min antes».
  const i = (nodo: string) => l.findIndex((x) => x.nodo === nodo);
  assert.ok(i('la_w60') < i('la_c') && i('la_mk2') < i('la_c'), `orden: ${l.map((x) => `${x.nodo}@${x.min}`).join(' ')}`);
  // Y nada sale «antes» que algo ya dicho: los minutos de la línea nunca bajan.
  for (let k = 1; k < l.length; k++) assert.ok(l[k].min >= l[k - 1].min, `${l[k].nodo}@${l[k].min} después de ${l[k - 1].nodo}@${l[k - 1].min}`);
});

test('sin reunión, una espera «antes de la reunión» no inventa un minuto (como antes)', () => {
  const l = linea(undefined);
  assert.equal(l.find((x) => x.nodo === 'la_w60')?.min, 0);
  assert.equal(reunionMinDe(hechosDeLeadNuevo({ ahoraMs: AHORA })), undefined, 'por otra etapa, no hay reunión');
});

// rotura 2 (los escenarios y la API arrancan sin la reunión): 2 pass / 1 fail, cae éste.
// rotura 3 (el panel arranca sin la reunión): 2 pass / 1 fail, cae éste.
test('el recorrido, los escenarios, la API y el panel arrancan con la reunión del lead de la prueba', () => {
  const ms = ids(mensajesDelRecorrido(pasos(), { etapa: 'agenda', ahoraMs: AHORA }));
  assert.ok(ms.indexOf('la_w60') > ms.indexOf('la_m2'), `recorrido: ${ms.join(' → ')}`);
  const sim = leer('lib/simulador-grafo.ts');
  assert.match(sim, /visitar\(iniciar\(pasosIn, \{ medio: o\.medio, reunionMin: reunionMinDe\(o\.hechos\) \}\)/);
  assert.match(sim, /return \{ pasos, escenarios: escenarios\.filter\(\(e\) => !e\.respuesta\), faltan, reunionMin: reunionMinDe\(hechos\) \};/);
  assert.match(leer('lib/setting-secuencias.ts'), /mensajesDelEscenario\(pasos, elegido\.elecciones, \{\}, \{ reunionMin \}\)/);
  assert.equal(escenariosDeLaSecuencia({ trigger_tipo: TRIGGER_ETAPA, etapa: 'agenda', pasos: pasos(), estrategia: null }, () => null).reunionMin, 24 * 60);
  const panel = leer('app/automations/PanelProbar.tsx');
  assert.match(panel, /simRef\.current = iniciar\(flujoVivo, \{ medio: medioIA, reunionMin: reunionDeLaPrueba\(\) \}\);/);
  assert.match(panel, /const reunionDeLaPrueba = \(\): number \| undefined => reunionMinDe\(hechosDeLeadNuevo\(leadRef\.current\)\);/);
});
