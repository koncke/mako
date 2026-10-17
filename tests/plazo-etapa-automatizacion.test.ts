// =============================================================================
// El plazo de una etapa, como plantilla de Automations: «Sigue en la etapa del CRON»
// =============================================================================
// Pedido de Martín reenviado por el chat CRM (12/10/2026): «Si, pasa a una automatización eso de los plazos... Y ponlo
// como template en automations». La plantilla «Un Lead No Avanzó» (lib/plantillas-automatizaciones.ts): entra a una
// etapa → espera el plazo → si SIGUE en la etapa del CRON, avisa al equipo.
//
// Lo que fija:
//   1. `sigueEnEtapaDelCron`: venta (la casa o un embudo), entrega (un producto o cualquiera), varios CRON, y «no sé»
//      cuando no hay CRON de etapa o falta el dato — y «no sé» no se cumple ni negado.
//   2. `etapasDelCron`: sale de la lista de CRON; un CRON de venta sin embudo es el de la automatización.
//   3. El catálogo la ofrece en adquisición y en entrega.
//   4. La plantilla, y que «Probar» (el lead recién llegado) llegue al aviso.
//   5. El motor evalúa con las etapas de ESA automatización en los dos lugares donde decide.
//
// PROBADO ROMPIÉNDOLO (13/10/2026), cada rotura de a una y restaurada de memoria. Pasan / fallan:
//   R1 la entrega sin producto mira la etapa entera (`x`) en vez de la key          → 6 / 1
//   R2 un CRON de venta sin embudo no hereda el de la automatización               → 6 / 1
//   R3 sin CRON de etapa devuelve false (no «no sé»)                                → 6 / 1
//   R4 el motor (control) evalúa con los hechos del lead pelados                    → 6 / 1
//   R5 «Probar»: el lead de prueba sin `etapasDelCron`                              → 6 / 1
//   R6 (17/10, con el `equipoDeLaInscripcion` de #849) la corrida sin el embudo     → 6 / 1
//
// Correr: node --import tsx --test tests/plazo-etapa-automatizacion.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sigueEnEtapaDelCron, cumpleCatalogo, seccionesDeCondiciones, condicionPorId } from '../lib/condiciones-catalogo';
import { etapasDelCron, conEtapasDelCron, type Disparador } from '../lib/disparadores';
import { cumpleFila, type HechosLead } from '../lib/flujo-grafo';
import { hechosDeLeadNuevo, leadNuevoDelCron } from '../lib/simulador-grafo';
import { PLANTILLAS } from '../lib/plantillas-automatizaciones';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const base = (o: Partial<HechosLead> = {}): HechosLead => ({ ...hechosDeLeadNuevo({}), etapasDelCron: undefined, ...o });

test('venta: la casa del lead o el embudo del CRON', () => {
  const casa = base({ etapa: 'agendado', etapasDelCron: [{ tipo: 'venta', funnelId: null, keys: ['agendado', 'r1'] }] });
  assert.equal(sigueEnEtapaDelCron(casa), true);
  assert.equal(sigueEnEtapaDelCron({ ...casa, etapa: 'ganado' }), false, 'salió de la etapa y se cumplía igual');
  const embudo = base({ etapa: 'otra', etapasPorProducto: new Map([[5, 'agendado']]), etapasDelCron: [{ tipo: 'venta', funnelId: 5, keys: ['agendado'] }] });
  assert.equal(sigueEnEtapaDelCron(embudo), true, 'con embudo mira la etapa de ESE embudo, no la casa');
  assert.equal(sigueEnEtapaDelCron({ ...embudo, etapasPorProducto: new Map() }), null, 'sin el dato del embudo: no sé');
});

test('entrega: un producto o cualquiera (se guarda `${producto}:${etapa}`)', () => {
  const cat = hechosDeLeadNuevo({}).catalogo!;
  const h = (entrega: string[], cron: HechosLead['etapasDelCron']) => base({ etapasDelCron: cron, catalogo: { ...cat, entrega: new Set(entrega) } });
  assert.equal(sigueEnEtapaDelCron(h(['9:onb'], [{ tipo: 'entrega', productoId: 9, keys: ['onb'] }])), true);
  assert.equal(sigueEnEtapaDelCron(h(['9:onb'], [{ tipo: 'entrega', productoId: 11, keys: ['onb'] }])), false, 'otro producto');
  assert.equal(sigueEnEtapaDelCron(h(['9:onb'], [{ tipo: 'entrega', productoId: null, keys: ['onb'] }])), true, 'sin producto: cualquiera');
  assert.equal(sigueEnEtapaDelCron(h(['9:kick'], [{ tipo: 'entrega', productoId: null, keys: ['onb'] }])), false);
});

test('«no sé» sin CRON de etapa, y «no sé» no se cumple ni negado; con varios CRON alcanza uno', () => {
  assert.equal(sigueEnEtapaDelCron(base({ etapa: 'agendado' })), null, 'sin las etapas del CRON');
  assert.equal(sigueEnEtapaDelCron(base({ etapa: 'agendado', etapasDelCron: [] })), null, 'una automatización por etiqueta o evento');
  const h = base({ etapa: 'agendado' });
  assert.equal(cumpleFila({ campo: 'sigue_en_etapa_cron' }, h), false);
  assert.equal(cumpleFila({ campo: 'sigue_en_etapa_cron', no: true }, h), false, '«no sé» negado se cumplía');
  const dos = base({ etapa: 'r2', etapasDelCron: [{ tipo: 'venta', funnelId: null, keys: ['agendado'] }, { tipo: 'venta', funnelId: null, keys: ['r2'] }] });
  assert.equal(cumpleCatalogo({ campo: 'sigue_en_etapa_cron' }, dos), true);
  assert.equal(cumpleCatalogo({ campo: 'sigue_en_etapa_cron', no: true }, dos), false);
});

test('`etapasDelCron` sale de la lista de CRON; uno de venta sin embudo es el de la automatización', () => {
  const ds: Disparador[] = [
    { id: 'd1', trigger_tipo: 'etapa_actual', etapa: 'agendado', etapas: ['agendado', 'r1'] },
    { id: 'd2', trigger_tipo: 'entrega_actual', etapa: 'onb', producto_id: 9 },
    { id: 'd3', trigger_tipo: 'etiqueta_puesta', etiqueta_id: 4 },
  ];
  assert.deepEqual(etapasDelCron(ds, 5), [
    { tipo: 'venta', funnelId: 5, keys: ['agendado', 'r1'] },
    { tipo: 'entrega', productoId: 9, keys: ['onb'] },
  ]);
  assert.deepEqual(conEtapasDelCron(base(), ds, 5).etapasDelCron, etapasDelCron(ds, 5));
});

test('el catálogo la ofrece en adquisición y en entrega', () => {
  assert.ok(condicionPorId('sigue_en_etapa_cron'));
  const ofrecida = (ambito: 'adquisicion' | 'entrega') =>
    seccionesDeCondiciones(ambito, { etiquetas: [], etapas: [], productos: [] } as never).flatMap((s) => s.options.map((o) => o.value));
  assert.ok(ofrecida('adquisicion').some((v) => v.startsWith('sigue_en_etapa_cron')), 'no se ofrece en adquisición');
  assert.ok(ofrecida('entrega').some((v) => v.startsWith('sigue_en_etapa_cron')), 'no se ofrece en entrega');
});

test('la plantilla «Un Lead No Avanzó»: espera, pregunta por la etapa del CRON y avisa; «Probar» llega al aviso', () => {
  const p = PLANTILLAS.find((x) => x.id === 'lead-no-avanzo');
  assert.ok(p, 'falta la plantilla');
  assert.equal(p!.cron.pide, 'etapa_venta');
  const [espera, cond, aviso] = p!.pasos;
  assert.equal(espera.nodo, 'esperar');
  assert.equal(espera.siguiente, cond.id);
  assert.deepEqual(cond.ramas?.[0].filas, [{ campo: 'sigue_en_etapa_cron' }]);
  assert.equal(cond.ramas?.[0].siguiente, aviso.id);
  assert.equal(aviso.accion?.operacion, 'avisar_al_equipo');
  // El lead de prueba entra EN la etapa del CRON: la condición se cumple (si no, «Probar» no mostraba el aviso).
  const prueba = hechosDeLeadNuevo(leadNuevoDelCron({ trigger_tipo: 'etapa_actual', etapa: 'agendado', funnel_id: 5 }));
  assert.equal(cumpleFila({ campo: 'sigue_en_etapa_cron' }, prueba), true);
});

test('el motor evalúa con las etapas de ESA automatización, en los dos lugares donde decide', () => {
  const src = sinComentarios(leer('lib/nutricion.ts'));
  // (17/10/2026, #849: detrás puede venir `equipoDeLaInscripcion`, la condición «Contestó el equipo». Lo que se exige no
  //  cambia: las etapas del CRON de ESA automatización y el «contestó en esta».)
  assert.match(src, /const hechos = leidos \? \{ \.\.\.conEtapasDelCron\(leidos, sec\.disparadores \?\? disparadoresDe\(sec\), sec\.funnel_id \?\? null\), contestoEnEsta: enRespuesta(?:, \.\.\.\(await equipoDeLaInscripcion\(sec\.pasos, insc\.id\)\))? \} : null;/);
  // (14/10/2026: adentro de «Si responde» además el lead acaba de contestar, `contestoEnEsta: true`.)
  assert.match(src, /elegirSalida\(p, \{ \.\.\.conEtapasDelCron\(hechos, secuencia\.disparadores \?\? disparadoresDe\(secuencia\), secuencia\.funnel_id \?\? null\), contestoEnEsta: true \}\)/);
});
