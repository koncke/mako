// F158 (18/11/2026): las dos sugerencias de la clase 3 que faltaban del mapa (docs/sugerencias-mako-crm.md):
// «Perdidos hace 60 a 90 días» y «una etapa donde la mitad o más no avanza». Se ejecuta el motor (lib/sugerencias-crm.ts)
// con el pipeline de fábrica y con las dos lecturas del historial armadas a mano.
//
// Probado rompiéndolo (base 7/0):
//   · el filtro de 60 a 90 días sin su punta de abajo (todo perdido de los últimos 90 días) → 6/1;
//   · la caída contando la vuelta a un paso anterior como «no avanzó» → 6/1;
//   · la caída sin quedarse con la ÚLTIMA salida de cada lead (cuenta las dos) → 6/1;
//   · la caída sin el piso de salidas (`caidaMinimo`) → 6/1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sugerenciasDelCrm, idCaida, UMBRALES_SUGERENCIAS, TOPE_TEXTO, ID_SUGERENCIA, type EntradaSugerencias } from '../lib/sugerencias-crm';
import { generateFunnel, DEFAULT_PIPELINE } from '../lib/pipeline';
import { marcasDeVoseo } from '../lib/voseo';

const { stages, transitions } = generateFunnel(DEFAULT_PIPELINE);
const HOY = '2026-11-18';
const AHORA = Date.parse(`${HOY}T15:00:00Z`);
const hace = (dias: number) => new Date(AHORA - dias * 86_400_000).toISOString();

const base = (o: Partial<EntradaSugerencias> = {}): EntradaSugerencias => ({
  funnel: { id: 7, canal: 'llamadas', entradas: ['landing'], productoId: 3, etapasEntrega: ['onboarding'] },
  etapas: stages, transiciones: transitions, plazos: {},
  // Con las automatizaciones de la clase 1 «ya armadas» la lista no se llena de otras: se mira sólo lo de este test.
  automatizaciones: [], leads: [], cuotas: { vencidas: 0, pendientes: 0 },
  conectado: { whatsapp: true, fathom: true }, hoy: HOY, ahora: AHORA, ...o,
});
const la = (e: EntradaSugerencias, id: string) => sugerenciasDelCrm(e, 100).find((s) => s.id === id);

/** `n` salidas de `desde` a `hacia`, cada una de un lead distinto a partir de `primerLead`. */
const salen = (n: number, desde: string, hacia: string, primerLead: number) =>
  Array.from({ length: n }, (_, i) => ({ lead: primerLead + i, desde, hacia }));

test('las etapas de fábrica tienen lo que la regla necesita: pasos, nutrición y salidas', () => {
  const k = new Set(stages.map((s) => s.key));
  for (const key of ['lead', 'agenda', 'agendaj2', 'ganado', 'noshow_r1', 'perdido']) assert.ok(k.has(key), `falta la etapa ${key}`);
});

test('perdidos hace 60 a 90 días: se cuentan los de la ventana, con su piso, y se arma por el chat', () => {
  const p = (dias: number, lead: number) => ({ lead, desde: hace(dias) });
  const enVentana = [p(61, 1), p(70, 2), p(75, 3), p(80, 4), p(89, 5)];
  const s = la(base({ perdidos: [...enVentana, p(30, 6), p(95, 7)] }), 'perdidos-60-90');
  assert.ok(s, 'cinco perdidos en la ventana: se sugiere');
  assert.match(s!.texto, /^5 leads se perdieron hace 60 a 90 días\./, 'cuenta sólo los de la ventana');
  assert.equal(s!.accion.tipo, 'chat');
  assert.equal(s!.soloAdmin, false);
  assert.equal(la(base({ perdidos: enVentana.slice(0, 4) }), 'perdidos-60-90'), undefined, 'con cuatro no hay tendencia');
  assert.equal(la(base({ perdidos: null }), 'perdidos-60-90'), undefined, 'sin poder leerlo no se sugiere');
  assert.equal(la(base({}), 'perdidos-60-90'), undefined, 'sin la lectura (un llamador viejo) tampoco');
  assert.equal(la(base({ perdidos: Array.from({ length: 6 }, (_, i) => p(10, i)) }), 'perdidos-60-90'), undefined, 'perdidos recientes no');
});

test('la etapa donde la mitad o más no avanza: la que más pierde, con su piso y su id', () => {
  // De «Agenda R1»: 7 a No show (nutrición), 2 a Perdido (salida), 3 avanzan a R2 → 9 de 12 no avanzaron.
  const salidas = [...salen(7, 'agenda', 'noshow_r1', 1), ...salen(2, 'agenda', 'perdido', 20), ...salen(3, 'agenda', 'agendaj2', 30),
    // De «Lead entrante»: 3 de 12 se caen → no llega a la mitad.
    ...salen(9, 'lead', 'agenda', 40), ...salen(3, 'lead', 'perdido', 60)];
  const s = la(base({ salidas }), idCaida('agenda'));
  assert.ok(s, 'la mitad o más de Agenda R1 no avanzó: se sugiere');
  assert.match(s!.texto, /^En «Agenda R1», 9 de 12 no avanzaron\./);
  assert.equal(s!.etapa, 'agenda');
  assert.equal(la(base({ salidas }), idCaida('lead')), undefined, 'una etapa que pierde menos de la mitad no');
  assert.equal(sugerenciasDelCrm(base({ salidas }), 100).filter((x) => x.id.startsWith('caida:')).length, 1, 'una sola: la que más pierde');
  assert.match(idCaida('agenda'), ID_SUGERENCIA, 'el id se puede callar');
});

test('volver a un paso anterior no es caerse, y de cada lead vale su ÚLTIMA salida', () => {
  // 6 vuelven de R2 a R1 (reagendar) y 5 se caen: de lo que cuenta, 5 de 5... pero sin piso. Con 10 que se caen, 10 de 10.
  const vuelven = salen(6, 'agendaj2', 'agenda', 1);
  const caen = salen(10, 'agendaj2', 'nopaga', 10);
  assert.match(la(base({ salidas: [...vuelven, ...caen] }), idCaida('agendaj2'))!.texto, /10 de 10 no avanzaron/, 'la vuelta atrás no suma al total');
  // Los mismos 10 leads salieron primero a nutrición y la ÚLTIMA vez avanzaron a Facturando: no se cayeron.
  const reintentan = [...caen, ...salen(10, 'agendaj2', 'facturando', 10)];
  assert.equal(la(base({ salidas: reintentan }), idCaida('agendaj2')), undefined);
});

test('sin el piso de salidas no hay sugerencia, y sin la lectura tampoco', () => {
  const min = UMBRALES_SUGERENCIAS.caidaMinimo;
  assert.equal(la(base({ salidas: salen(min - 1, 'agenda', 'noshow_r1', 1) }), idCaida('agenda')), undefined, `${min - 1} salidas no son una tendencia`);
  assert.ok(la(base({ salidas: salen(min, 'agenda', 'noshow_r1', 1) }), idCaida('agenda')));
  assert.equal(la(base({ salidas: null }), idCaida('agenda')), undefined);
  // De Ganado no se «cae» nadie: no es un paso del recorrido que haya que cruzar.
  assert.equal(la(base({ salidas: salen(12, 'ganado', 'perdido', 1) }), idCaida('ganado')), undefined);
});

test('las dos líneas: una frase corta, en español neutro', () => {
  const salidas = salen(12, 'agenda', 'noshow_r1', 1);
  const perdidos = Array.from({ length: 5 }, (_, i) => ({ lead: 100 + i, desde: hace(70) }));
  const lista = sugerenciasDelCrm(base({ salidas, perdidos }), 100).filter((s) => s.id === 'perdidos-60-90' || s.id.startsWith('caida:'));
  assert.equal(lista.length, 2);
  for (const s of lista) {
    assert.ok(s.texto.length <= TOPE_TEXTO, `«${s.texto}» pasa el techo de una línea`);
    assert.deepEqual(marcasDeVoseo(s.texto), [], `«${s.texto}» tiene voseo`);
    assert.equal(s.accion.tipo === 'chat' && marcasDeVoseo(s.accion.pedido).length, 0, `el pedido de ${s.id} tiene voseo`);
    assert.equal(s.clase, 3);
  }
});

test('una etapa de nombre larguísimo se acorta en el medio y la pregunta queda entera', () => {
  const largas = stages.map((s) => (s.key === 'agenda' ? { ...s, label: 'Agenda de la primera reunión con el equipo comercial del programa de mentoría avanzada' } : s));
  const s = la(base({ etapas: largas, salidas: salen(12, 'agenda', 'noshow_r1', 1) }), idCaida('agenda'))!;
  assert.ok(s.texto.length <= TOPE_TEXTO);
  assert.match(s.texto, /¿Probamos un recordatorio ahí\?$/);
});
