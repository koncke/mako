// =============================================================================
// Los insights de la LLAMADA: a qué reunión va cada análisis, a quién le falta,
// y que el disparo esté enchufado donde pasan las tres grabaciones
// =============================================================================
// Lo que se persigue acá son los tres modos de falla de este apartado, y ninguno
// da error:
//   · el análisis de la R2 dibujado debajo del título de la Reunión 1 (el link
//     en un bloque y lo que se dijo en el otro);
//   · un lead que paga el barrido de Fathom en CADA ronda del cron para no
//     analizar nada, porque la cola calculada no tiene memoria del fracaso;
//   · el disparo escrito en uno de los tres caminos que enganchan una grabación
//     en vez de en el choke point, que es cómo el cuarto nace sin él.
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  etiquetaEsR2,
  urlComparable,
  repartirPorReunion,
  leadsPendientesDeInsights,
  type InsightLlamada,
  type LeadConGrabacion,
} from '../lib/insights-llamada-reparto';

const C = (p: Partial<InsightLlamada>): InsightLlamada => ({
  recordingId: 1, tipo: null, titulo: null, startedAt: null, callDate: null, duracionMin: null,
  outcome: null, outcomeTone: null, resumen: null, proximoPaso: null, objeciones: [], momentos: [],
  url: null, analizadoEn: null, ...p,
});

// ── La etiqueta ──────────────────────────────────────────────────────────────

test('la etiqueta de la R2 se reconoce con y sin acento, y nada más es R2', () => {
  for (const l of ['Reunión 2', 'Reunion 2', 'R2', 'junta 2', 'GRABACIÓN R2']) {
    assert.equal(etiquetaEsR2(l), true, `"${l}" es de la Reunión 2`);
  }
  for (const l of ['Reunión 1', 'R1', 'Grabación', '', null, undefined]) {
    assert.equal(etiquetaEsR2(l), false, `"${l}" no es de la Reunión 2`);
  }
});

test('la url se compara sin querystring, sin barra final y sin mayúsculas', () => {
  // Fathom devuelve el share_url con tracking a veces; el link lo pega una persona
  // a mano. Comparar crudo deja el análisis sin bloque aunque sea la misma llamada.
  const base = 'https://fathom.video/share/AbC';
  assert.equal(urlComparable(base + '?utm=x'), urlComparable(base + '/'));
  assert.equal(urlComparable(base.toUpperCase()), urlComparable(base));
});

// ── El reparto ───────────────────────────────────────────────────────────────

test('MANDA LA ETIQUETA DEL LINK, no el tipo que escribió el modelo', () => {
  // Verificado rompiéndolo: con el orden invertido (el `tipo` primero) este test
  // falla 1 de 12 (11 en verde) — el análisis de la R2 aparece debajo del título de la Reunión 1,
  // que es el bug que el apartado no puede tener: el link de esa misma llamada se
  // dibuja en el otro bloque, por la misma etiqueta.
  const c = C({ recordingId: 9, tipo: 'R1', url: 'https://fathom.video/share/zz' });
  const r = repartirPorReunion([c], [{ label: 'Reunión 2', url: 'https://fathom.video/share/zz?x=1' }]);
  assert.deepEqual(r.R1.map((x) => x.recordingId), []);
  assert.deepEqual(r.R2.map((x) => x.recordingId), [9]);
  assert.deepEqual(r.otras, []);
});

test('sin link que matchee cae por el tipo, y sin tipo va a OTRAS (no se adivina)', () => {
  const porTipo = C({ recordingId: 1, tipo: 'R2', url: 'https://fathom.video/share/a' });
  const huerfana = C({ recordingId: 2, tipo: null, url: 'https://fathom.video/share/b' });
  const r = repartirPorReunion([porTipo, huerfana], []);
  assert.deepEqual(r.R2.map((x) => x.recordingId), [1]);
  assert.deepEqual(r.otras.map((x) => x.recordingId), [2], 'una llamada analizada NO se tira');
  assert.deepEqual(r.R1, []);
});

test('ninguna llamada se pierde ni se duplica en el reparto', () => {
  const llamadas = [
    C({ recordingId: 1, url: 'https://fathom.video/share/uno' }),
    C({ recordingId: 2, tipo: 'R2' }),
    C({ recordingId: 3 }),
  ];
  const r = repartirPorReunion(llamadas, [{ label: 'Reunión 1', url: 'https://fathom.video/share/uno' }]);
  const ids = [...r.R1, ...r.R2, ...r.otras].map((x) => x.recordingId).sort();
  assert.deepEqual(ids, [1, 2, 3]);
});

// ── La cola calculada ────────────────────────────────────────────────────────

const L = (id: number, links = 1): LeadConGrabacion => ({ id, fathomLinks: links });

test('la cola son los que tienen grabación y ninguna llamada analizada', () => {
  const leads = [L(1), L(2), L(3, 0)];
  const cola = leadsPendientesDeInsights(leads, new Set([2]), new Set(), 10);
  assert.deepEqual(cola, [1], 'el 2 ya tiene análisis y el 3 no tiene grabación');
});

test('UN LEAD YA INTENTADO NO VUELVE A LA COLA: una cola calculada no tiene memoria del fracaso', () => {
  // Es la parte caro-silenciosa: un link pegado a mano que apunta a una grabación
  // que no está en Fathom nunca va a producir análisis, así que sin esta exclusión
  // entra en CADA ronda del cron y paga el barrido para no analizar nada.
  // Verificado rompiéndolo (quitando el filtro de `yaIntentados`): este test falla
  // 1 de 12 (11 en verde) y la cola devuelve [1, 7] en vez de [1].
  const cola = leadsPendientesDeInsights([L(7), L(1)], new Set(), new Set([7]), 10);
  assert.deepEqual(cola, [1]);
});

test('el tope corta la cola y no la reordena', () => {
  assert.deepEqual(leadsPendientesDeInsights([L(5), L(6), L(7)], new Set(), new Set(), 2), [5, 6]);
  assert.deepEqual(leadsPendientesDeInsights([L(5)], new Set(), new Set(), 0), []);
});

// ── Que esté ENCHUFADO ───────────────────────────────────────────────────────
// Un guard de cableado no reemplaza a los tests de arriba: contesta «¿lo llama
// alguien?», no «¿hace lo que dice». Las dos preguntas se rompen distinto y por
// eso van separadas.

const bloque = (src: string, abre: string, cierra: string): string => {
  const i = src.indexOf(abre);
  assert.notEqual(i, -1, `no encontré "${abre}"`);
  const j = src.indexOf(cierra, i + abre.length);
  assert.notEqual(j, -1, `no encontré el cierre "${cierra}" después de "${abre}"`);
  return src.slice(i, j);
};

test('EL DISPARO VIVE EN EL CHOKE POINT (applyFathomRecording), no en los tres caminos', () => {
  // Los tres que enganchan una grabación —el webhook de Fathom, el barrido de
  // fathom-auto y el link que alguien pega a mano— pasan por acá. Verificado
  // rompiéndolo (dejando la llamada fuera de la función): falla 1 de 12, 11 en verde.
  // Y con el `if (addedLink && shareUrl)` cambiado por `if (true)`, idem.
  const src = readFileSync(new URL('../lib/leads.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const fn = bloque(src, 'export async function applyFathomRecording(', '// ── Audit log');
  assert.ok(fn.length < 6000, `el recorte de applyFathomRecording mide ${fn.length}: está mirando otra cosa`);
  assert.match(fn, /enlazarAnalisisDeGrabacion\(/, 'el análisis de la grabación no se engancha al lead');
  // La CONDICIÓN, no el cuerpo: con `if (true)` esto se enlazaría en cada escritura
  // del lead, incluida la que no agrega ningún link.
  assert.match(fn, /if \(addedLink && shareUrl\)/, 'sólo se enlaza cuando se acaba de agregar un link');
});

test('EL ANÁLISIS QUE COBRA NO CUELGA DEL CHOKE POINT: lo drena el cron, con presupuesto', () => {
  // `applyFathomRecording` lo dispara también el render del CRM con un `void`
  // (fathom-auto): una llamada al modelo de 90-120 s ahí se paga y se pierde.
  const leads = readFileSync(new URL('../lib/leads.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(leads, /analizarLlamadasDeLead/, 'lib/leads.ts no puede pagarle al modelo');
  const cron = readFileSync(new URL('../app/api/cron/closing-sync/route.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.match(cron, /drenarInsightsDeLlamada\(\{ deadline/, 'el drenaje tiene que recibir el deadline de la ronda');
  // El presupuesto se mide con la MISMA unidad que el resto del cron de closing.
  const lib = readFileSync(new URL('../lib/insights-llamada.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const drena = bloque(lib, 'export async function drenarInsightsDeLlamada(', '\n  return r;');
  assert.match(drena, /Date\.now\(\) \+ RESERVA_LLAMADA_MS > opts\.deadline/, 'se arranca un lead sólo si entra ENTERO antes del corte');
  assert.match(drena, /arrancarAnalisis\(leadId\)/, 'sin el candado de closing_jobs dos corridas pagan la misma grabación');
});

test('HAY UN SOLO LECTOR de closing_analyses por lead: la ficha y el resumen del celular', () => {
  // Con dos lecturas, el día que una agregue un campo o cambie el filtro las dos
  // pantallas cuentan dos versiones de la misma llamada. Verificado rompiéndolo
  // (metiendo un segundo `from(closing_analyses)` en lead-resumen.ts): falla 1 de 12.
  const resumen = readFileSync(new URL('../lib/lead-resumen.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(resumen, /from\('closing_analyses'\)/, 'lead-resumen no lee closing_analyses por su cuenta');
  assert.match(resumen, /insightsDeLlamadaDeLead\(leadId\)/);
  const action = readFileSync(new URL('../app/crm/insights-actions.ts', import.meta.url), 'utf8');
  assert.match(action, /insightsDeLlamadaDeLead\(leadId\)/, 'el apartado de la ficha lee por el mismo lector');
});

test('EL APARTADO SE DIBUJA EN LA FICHA Y LO FIRMA MaKo', () => {
  // Lo que afirma un modelo lleva su rastro: el rótulo y la marca salen de
  // lib/mako-gramatica.ts vía <Mako>, no de un estilo escrito acá.
  const card = readFileSync(new URL('../app/crm/lead-view/InsightsLlamadaCard.tsx', import.meta.url), 'utf8');
  assert.match(card, /estado="explica"/, 'sin <Mako> el apartado no dice que lo escribió la IA');
  assert.match(card, /repartirPorReunion\(llamadas, links\)/);
  const reuniones = readFileSync(new URL('../app/crm/lead-view/ReunionesCard.tsx', import.meta.url), 'utf8');
  assert.match(reuniones, /<InsightsLlamadaCard leadId=\{lead\.id\}/, 'el apartado sin call site no existe para nadie');
  // Y el apartado del formulario sigue estando, separado: la decisión fue que no
  // se pise ninguno de los dos.
  assert.match(reuniones, /Respuestas del formulario de Calendly/);
});
