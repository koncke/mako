// =============================================================================
// Las plantillas de la ficha son las del documento, y MaKo elige la del tipo de funnel sin preguntar
// =============================================================================
// docs/diseno-ficha-bloques.md §4: «Cada funnel arranca con la plantilla de su tipo... MaKo la elige sola
// con lo que el funnel ya tiene». Este test LEE las listas del .md y las compara con lib/ficha/plantillas.ts,
// y EJECUTA `elegirPlantilla` con funnels armados como los de cada negocio que nombra el documento (ws1,
// ws11, ws13, ws15, ws17) por `filaAFunnel`, la misma lectura que usa el server.
//
// Correr: npx tsx --test tests/ficha-plantillas.test.ts
//
// ⚠️ VERIFICADO ROMPIÉNDOLO (14/10/2026, base 7/0), cada rotura restaurada antes de la siguiente:
//   · elegir con `funnels.canal` pelado en vez de `canalEfectivo`         → 5 / 2 (ws11 da «Una llamada»)
//   · contar las reuniones con `kind === 'reunion'` y no con la regla de la tab → 6 / 1
//   · `te-escriben` sin `pase-a-humano` en el Resumen                      → 6 / 1
//   · los apagados sin los de bloques que la plantilla no pone             → 6 / 1
//   · Carrito sin `siguenAvisando: ['comprobante']`                        → 6 / 1
//   · el carrito decidido sólo por la entrada (sin el canal)               → 6 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PLANTILLAS_FICHA, PLANTILLA_CS, PLANTILLA_RESPALDO, apagadosDePlantilla, elegirPlantilla, listaDePlantilla, plantillaFicha,
  cuantasReuniones, type PlantillaId,
} from '../lib/ficha/plantillas';
import { bloqueDef, vaEnTab, TABS_FICHA, type TabCs } from '../lib/ficha/catalogo';
import { filaAFunnel } from '../lib/funnel-fila';
import { FUNNEL_TEMPLATES, DEFAULT_PIPELINE } from '../lib/pipeline';
import { NO_IGNORABLES } from '../lib/datos-aviso';
import type { CanalId } from '../lib/fase-diagnostico';

const doc = readFileSync(new URL('../docs/diseno-ficha-bloques.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const ID_DE_TITULO: Array<[string, PlantillaId | 'cs']> = [
  ['Respaldo', 'respaldo'], ['Llamada con R1 y R2', 'dos-reuniones'], ['Una llamada', 'una-llamada'], ['Evento', 'evento'],
  ['Formulario de Meta', 'formulario-meta'], ['Landing con opt-in', 'landing'], ['Te escriben', 'te-escriben'],
  ['Prospección', 'prospeccion'], ['Carrito', 'carrito'], ['Cliente en Customer Success', 'cs'],
];
const TAB_DE: Record<string, string> = { Resumen: 'resumen', Reuniones: 'reuniones', Pagos: 'pagos', Tracking: 'tracking', 'CS · Resumen': 'cs-resumen', 'CS · Pagos': 'cs-pagos' };
/** «Avisos que nacen apagados» del documento → StepId. «contrato» no es un dato sin marcar. */
const AVISO_DE: Array<[RegExp, string[]]> = [
  [/datos y documento fiscal/, ['dealFiscal', 'dealFiscalDoc']], [/datos fiscales/, ['dealFiscal']], [/\bservicio\b/, ['dealServicio']],
  [/\bpromesa\b/, ['dealPromesa']], [/\bobligaciones\b/, ['dealObligaciones']], [/\bempresa\b/, ['empresa']], [/\bplan\b/, ['plan']],
  [/\bcalificado\b/, ['calificado']], [/\bsetter\b/, ['setter']],
];

type PlantillaDoc = { tabs: Record<string, string[] | 'respaldo' | 'misma-llamada'>; apagados: Set<string> };

function plantillasDelDocumento(): Map<string, PlantillaDoc> {
  const ini = doc.indexOf('## 4. Plantillas');
  const fin = doc.indexOf('## 5.');
  const out = new Map<string, PlantillaDoc>();
  let actual: PlantillaDoc | null = null;
  for (const linea of doc.slice(ini, fin).split('\n')) {
    const h = /^### (.+)$/.exec(linea);
    if (h) {
      const par = ID_DE_TITULO.find(([t]) => h[1].startsWith(t));
      assert.ok(par, `no sé qué plantilla es «${h[1]}»`);
      actual = { tabs: {}, apagados: new Set() };
      out.set(par[1], actual);
      continue;
    }
    const m = /^- \*\*(.+?):\*\* (.+)$/.exec(linea);
    if (!m || !actual) continue;
    if (m[1] === 'Avisos que nacen apagados') {
      let txt = m[2].split('.')[0];
      for (const [re, ids] of AVISO_DE) if (re.test(txt)) { ids.forEach((i) => actual!.apagados.add(i)); txt = txt.replace(re, ''); }
      continue;
    }
    const tab = TAB_DE[m[1]];
    if (!tab) continue;
    const ids = [...m[2].matchAll(/`([a-z0-9-]+)`/g)].map((x) => x[1]);
    actual.tabs[tab] = ids.length ? ids : /la misma de/.test(m[2]) ? 'misma-llamada' : 'respaldo';
  }
  return out;
}

const DOC = plantillasDelDocumento();

test('las listas de cada plantilla son las del documento, tab por tab', () => {
  assert.equal(DOC.size, 10, 'el documento tiene diez plantillas (con la fija de CS)');
  for (const p of PLANTILLAS_FICHA) {
    const d = DOC.get(p.id);
    assert.ok(d, `${p.id} no está en el documento`);
    for (const tab of TABS_FICHA) {
      const esperado = d.tabs[tab] ?? 'respaldo';
      if (esperado === 'respaldo') assert.equal(p.tabs[tab], undefined, `${p.id} · ${tab}: el documento no le da lista (usa la del respaldo)`);
      else if (esperado === 'misma-llamada') assert.deepEqual(p.tabs[tab], plantillaFicha('dos-reuniones').tabs[tab], `${p.id} · ${tab}`);
      else assert.deepEqual([...(p.tabs[tab] ?? [])], esperado, `${p.id} · ${tab}`);
    }
  }
  const cs = DOC.get('cs')!;
  for (const tab of ['cs-resumen', 'cs-pagos'] as TabCs[]) assert.deepEqual([...PLANTILLA_CS[tab]], cs.tabs[tab], `CS · ${tab}`);
});

test('cada bloque de una plantilla existe y va en esa tab, sin repetirse', () => {
  for (const p of PLANTILLAS_FICHA) {
    for (const tab of TABS_FICHA) {
      const l = listaDePlantilla(p, tab);
      assert.equal(new Set(l).size, l.length, `${p.id} · ${tab}: un bloque repetido`);
      for (const id of l) assert.ok(vaEnTab(bloqueDef(id)!, tab), `${p.id}: «${id}» no va en ${tab}`);
      if (tab === 'resumen') assert.ok(l.includes('contacto'), `${p.id}: el Resumen sin contacto`);
    }
  }
  for (const [tab, l] of Object.entries(PLANTILLA_CS)) for (const id of l) assert.ok(vaEnTab(bloqueDef(id)!, tab as TabCs), `CS: «${id}» no va en ${tab}`);
});

test('los avisos que nacen apagados: los del documento MÁS los de bloques que la plantilla no pone', () => {
  for (const p of PLANTILLAS_FICHA) {
    const d = DOC.get(p.id)!;
    assert.deepEqual([...p.apagados].sort(), [...d.apagados].sort(), `${p.id}: los apagados escritos en el documento`);
    const ap = new Set(apagadosDePlantilla(p));
    for (const id of p.apagados) assert.ok(ap.has(id), `${p.id}: «${id}»`);
    for (const id of NO_IGNORABLES) assert.ok(!ap.has(id), `${p.id}: una asistencia nunca se apaga`);
  }
  // El respaldo y la de dos reuniones: «los avisos quedan como hoy» / «todos los avisos del deal prendidos».
  assert.deepEqual(apagadosDePlantilla(PLANTILLA_RESPALDO), []);
  assert.deepEqual(apagadosDePlantilla(plantillaFicha('dos-reuniones')), []);
  // Derivados: Landing no pone setter-y-closer, Te escriben no pone cuotas ni datos fiscales.
  assert.ok(apagadosDePlantilla(plantillaFicha('landing')).includes('setter'));
  assert.ok(apagadosDePlantilla(plantillaFicha('te-escriben')).includes('comprobante'));
  assert.ok(apagadosDePlantilla(plantillaFicha('te-escriben')).includes('dealFiscalDoc'));
  // «El teléfono sigue avisando, porque pedirlo es parte de la charla».
  assert.ok(!apagadosDePlantilla(plantillaFicha('te-escriben')).includes('telefono'));
  // Carrito: «El comprobante sólo se pide en un pago a mano», aunque `cuotas` no venga.
  assert.ok(!apagadosDePlantilla(plantillaFicha('carrito')).includes('comprobante'));
});

// ── elegirPlantilla, con funnels como los de cada negocio ─────────────────────

const plantilla = (id: string) => FUNNEL_TEMPLATES.find((t) => t.id === id)!.pipeline;
/** Una fila de `funnels` como la de producción: `canal` en NULL (hereda el del negocio) y declarado. */
const fila = (pipeline: unknown, entradas: string[] = [], canal: string | null = null) =>
  filaAFunnel({ id: 1, nombre: 'Funnel principal', canal, data: { pipeline, entradas }, declarado: true, es_default: true });
const elegir = (pipeline: unknown, entradas: string[], canalNegocio: CanalId | null, canalFunnel: string | null = null) => {
  const cfg = fila(pipeline, entradas, canalFunnel);
  return elegirPlantilla({ etapas: cfg.stages, canalDelFunnel: cfg.canal, canalDelNegocio: canalNegocio, entradas: cfg.entradas }).id;
};

test('dos reuniones o más → Llamada con R1 y R2 (ws1, high-ticket)', () => {
  assert.equal(elegir(DEFAULT_PIPELINE, ['landing'], 'llamadas'), 'dos-reuniones');
  assert.equal(elegir(plantilla('highticket'), [], null), 'dos-reuniones');
});

test('una reunión: con fecha fija es Evento (ws11, canal del funnel en NULL), sin ella Una llamada', () => {
  // ws11: lista en frío → 1ª sesión sin costo → mensualidad; `funnels.canal` NULL y el negocio presencial.
  assert.equal(elegir(plantilla('presencial'), ['chat_saliente'], 'presencial'), 'evento');
  assert.equal(elegir(plantilla('vsl'), ['landing'], 'webinar'), 'evento');
  // El canal del funnel le gana al del negocio (canalEfectivo).
  assert.equal(elegir(plantilla('presencial'), [], 'presencial', 'llamadas'), 'una-llamada');
  assert.equal(elegir(plantilla('simple'), ['landing'], 'llamadas'), 'una-llamada');
  // Una etapa que se llama «Agenda R1» cuenta aunque nadie la haya marcado (la regla de la tab Reuniones).
  const porNombre = [{ key: 'lead', label: 'Lead entrante', kind: 'entrada' }, { key: 'r1', label: 'Agenda R1' }, { key: 'ganado', label: 'Ganado', kind: 'cierre' }];
  assert.equal(elegir(porNombre, [], 'llamadas'), 'una-llamada');
});

test('ninguna reunión: decide cómo entra la gente (ws13, ws15, ws17, carrito, chat)', () => {
  // ws13: landing con Cal.com sin etapa de reunión.
  assert.equal(elegir(plantilla('conversaciones'), ['landing'], 'llamadas'), 'landing');
  // ws15 y ws17: inmobiliaria, anuncio con formulario de Meta. «Reunión excepcional» (nutrición) no cuenta.
  assert.equal(elegir(plantilla('conversaciones'), ['formulario_anuncio'], 'conversaciones'), 'formulario-meta');
  assert.equal(cuantasReuniones(fila(plantilla('conversaciones')).stages), 0, 'la «Reunión excepcional» que siembra generateFunnel está en la banda de nutrición');
  assert.equal(elegir(plantilla('conversaciones'), ['chat_entrante'], 'conversaciones'), 'te-escriben');
  assert.equal(elegir(plantilla('conversaciones'), ['chat_saliente'], 'conversaciones'), 'prospeccion');
  assert.equal(elegir(plantilla('directa'), ['carrito'], null), 'carrito');
  // El canal carrito alcanza, aunque no haya entrada declarada.
  assert.equal(elegir(plantilla('directa'), [], 'carrito'), 'carrito');
});

test('si nada aplica, el Respaldo (y un funnel no declarado no afirma su entrada)', () => {
  assert.equal(elegir(plantilla('conversaciones'), [], 'conversaciones'), 'respaldo');
  assert.equal(elegir(plantilla('conversaciones'), ['agenda_sola'], null), 'respaldo', '«Agendan llamada» no es un tipo de funnel');
  const noDeclarado = filaAFunnel({ id: 2, nombre: 'x', canal: null, data: { pipeline: plantilla('conversaciones'), entradas: ['carrito'] }, declarado: false });
  assert.equal(elegirPlantilla({ etapas: noDeclarado.stages, canalDelFunnel: null, canalDelNegocio: null, entradas: noDeclarado.entradas }).id, 'respaldo');
});
