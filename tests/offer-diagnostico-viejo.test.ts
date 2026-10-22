// =============================================================================
// OF1 · Lo guardado no se recalcula: el diagnóstico armado con el embudo de otro funnel (22/10/2026)
// =============================================================================
// La v1 del Sprint de Mauricio (ws1, sesión 18) quedó guardada con «solo 2 ventas de 24 asistentes» (el CRM entero, que
// era «Negocio que ESCALA») y «Tienes 6 ofertas activas en MaKo». `embudoDeFunnel` lo arregló hacia adelante, pero la
// conclusión guardada se seguía mostrando y la API de MaKo se la daba a los chats como contexto para prospectar.
// Al leer se MARCA (no se reescribe nada): la pantalla avisa con «Rehacer el diagnóstico» y la API no la entrega.
// Medido en producción con scripts/medir-diagnostico-viejo.mts: con el código de 87365c830 las dos frases llegan al
// contexto del ws1; con éste, ninguna. Y el ws13 (un solo funnel: su negocio entero ERA ese funnel) no se marca.
//
// ⚠️ PROBADO ROMPIENDO LO QUE PERSIGUE (22/10/2026, arnés romper-of1.mjs en el scratchpad de la sesión). Los números,
// al lado de cada test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { armadaConElEmbudoViejo, EMBUDO_POR_FUNNEL_DESDE } from '../lib/offer-reglas';
import { AVISO_DIAGNOSTICO_VIEJO, DIMENSION_IDS, REHACER_DIAGNOSTICO, type ConclusionOferta, type OfferSesionVista } from '../lib/offer-marco';
import { Conclusion } from '../app/offer/Conclusion';

const leer = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const desde = (s: string, inicio: string, largo = 2_500) => { const i = s.indexOf(inicio); assert.ok(i >= 0, `no está: ${inicio}`); return s.slice(i, i + largo); };

// rotura (sin mirar el funnel): 1 fallo. rotura (el corte después de lo que mide): 1 fallo. rotura (sin fecha = vigente): 1 fallo.
test('armadaConElEmbudoViejo: con funnel y antes del corte; sin funnel nunca (la v1 sigue siendo del negocio entero)', () => {
  const sprint = { at: '2026-10-22T05:08:37.178Z' };   // la v1 de Mauricio
  assert.equal(armadaConElEmbudoViejo(sprint, 44), true);
  assert.equal(armadaConElEmbudoViejo(sprint, null), false, 'una conversación sin funnel usa el negocio entero a propósito');
  assert.equal(armadaConElEmbudoViejo({ at: '2026-10-22T13:02:54.122Z' }, 45), false, 'lo armado con el embudo del funnel');
  assert.equal(armadaConElEmbudoViejo({ at: '2026-10-22T07:22:27.833Z' }, 45), true, 'antes del aviso de Integración (07:33 UTC)');
  assert.equal(armadaConElEmbudoViejo({}, 44), true, 'sin fecha es de antes');
  assert.equal(armadaConElEmbudoViejo(undefined, 44), false, 'sin conclusión no hay nada que marcar');
  assert.equal(EMBUDO_POR_FUNNEL_DESDE, '2026-10-22T07:33:00Z');
});

// rotura (se marca sin mirar si el negocio tenía otros funnels): 1 fallo. rotura (si la lectura falla, se marca): 1 fallo.
// rotura (la marca se pierde en la vista): 1 fallo.
test('la base dice si el negocio mezclaba otros funnels; si no se puede leer, NO se marca', () => {
  const s = sinComentarios(leer('lib/offer-sesiones.ts'));
  const nombres = desde(s, 'export async function nombresDeSesion(', 4_000);
  assert.match(nombres, /if \(!armadaConElEmbudoViejo\(ultima, f\.funnelId\)\) return;/);
  assert.match(nombres, /out\.diagnosticoViejo = x \? await hayLeadsFueraDelFunnel\(x\.id, !!x\.esDefault\)/);
  assert.match(nombres, /hayLeadsFueraDelFunnel\([^)]*\)\s*\.catch\(\(e\) => \{[^}]*return false; \}\)/, 'tolerante: un aviso en falso le diría a un cliente que su diagnóstico está mal');
  assert.match(desde(s, 'export function vistaDe('), /\.\.\.\(nombres\.diagnosticoViejo && f\.conclusiones\.length \? \{ diagnosticoViejo: true \} : \{\}\)/);
  assert.match(s, /return vistaDe\(f, await nombresDeSesion\(f\)\);/, 'la vista de la ruta y de la API pasa por acá');
});

// rotura (el default cuenta sus propios NULL como de otro funnel): 1 fallo. rotura (otro funnel sin los NULL): 1 fallo.
test('hayLeadsFueraDelFunnel: el default son los NULL más los suyos, como en embudoDeFunnel', () => {
  const a = sinComentarios(leer('lib/analisis-negocio.ts'));
  const f = desde(a, 'export async function hayLeadsFueraDelFunnel(', 900);
  assert.match(f, /base\.not\('funnel_id', 'is', null\)\.neq\('funnel_id', funnelId\)/, 'el default: los que tienen OTRO id');
  assert.match(f, /base\.or\(`funnel_id\.is\.null,funnel_id\.neq\.\$\{funnelId\}`\)/, 'otro funnel: los NULL (del default) y los de otros ids');
});

// rotura (la API entrega el diagnóstico viejo): 1 fallo. rotura (entrega sus avisos): 1 fallo.
test('la API de MaKo no entrega ese diagnóstico ni sus avisos, y dice por qué', () => {
  const r = sinComentarios(leer('lib/api-mako/areas/negocio.run.ts'));
  const ver = desde(r, 'ver_analisis_oferta: {', 5_000);
  assert.match(ver, /const viejo = s\.diagnosticoViejo === true;/);
  assert.match(ver, /diagnostico: viejo \? null : \{/);
  assert.match(ver, /avisos: viejo \? \[\] : avisosAfirmables\(c\.calculo\.alertas\)/);
  assert.match(ver, /diagnostico_no_vigente: `\$\{AVISO_DIAGNOSTICO_VIEJO\}/);
});

// rotura (sin el aviso en la computadora): 1 fallo. rotura (sin el botón que lo rehace): 1 fallo.
// rotura (sin el aviso en el teléfono): 1 fallo.
test('la pantalla lo dice, con «Rehacer el diagnóstico», en la computadora y en el teléfono', () => {
  assert.equal(AVISO_DIAGNOSTICO_VIEJO, 'Este diagnóstico usó datos de otro funnel.');
  assert.equal(REHACER_DIAGNOSTICO, 'Rehacer el diagnóstico');
  const c = sinComentarios(leer('app/offer/Conclusion.tsx'));
  assert.match(c, /\{sesion\.diagnosticoViejo && \(\s*<Banner tono="warn" alcance="local" accion=\{onRehacer \? \{ label: REHACER_DIAGNOSTICO, onClick: onRehacer \} : undefined\}>\s*\{AVISO_DIAGNOSTICO_VIEJO\}/);
  const app = sinComentarios(leer('app/offer/OfferApp.tsx'));
  assert.match(app, /onRehacer=\{puedeConcluir \? \(\) => \{ setVerConclusion\(false\); void armar\(\); \} : undefined\}/, 'rehacer es armar otra versión');
  const m = sinComentarios(leer('app/m/offer/HojasOfferM.tsx'));
  assert.match(m, /\{sesion\?\.diagnosticoViejo && \(\s*<div className="m-offer-viejo">\s*<p className="m-offer-linea m-offer-linea--warn" role="status">\{AVISO_DIAGNOSTICO_VIEJO\}<\/p>\s*\{onRehacer && <Button[^>]*onClick=\{onRehacer\}>\{REHACER_DIAGNOSTICO\}<\/Button>\}/);
  assert.match(sinComentarios(leer('app/m/offer/OfferM.tsx')), /onRehacer=\{sesion\?\.puedeConcluir \? \(\) => void armar\(\) : undefined\}/);
});

// rotura (sin el aviso en la computadora): este test y el de arriba. rotura (sin el botón): ídem.
test('dibujada: con la marca, el aviso y el botón arriba de todo; sin la marca, nada', () => {
  const conclusion = {
    version: 1, at: '2026-10-22T05:08:37.178Z', modelo: 'IA',
    calculo: { total: 61, cuello: 'D1', lista: false, alertas: [], cifrasConFuente: true },
    diagnostico: { tesis: 'T.', fuerte: 'F.', fuertes: ['F.'], dimensiones: DIMENSION_IDS.map((id) => ({ id, nota: 6, porque: 'p', mejora: 'm' })), cambios: [] },
    propuesta: { nombre: 'Sprint', frase: 'Frase.', completar: [], avisos: [], supuestos: [], propuestoPorMako: [] },
  } as unknown as ConclusionOferta;
  const sesion = (s: Partial<OfferSesionVista>) => ({ id: 18, ofertaId: 24, ligada: true, funnelId: 44, guardadaEn: [], versiones: 1, ...s }) as unknown as OfferSesionVista;
  const dibujar = (s: OfferSesionVista, onRehacer?: () => void) => renderToStaticMarkup(createElement(Conclusion, {
    sesion: s, conclusion, onSeguir: () => {}, onGuardar: async () => null, onRehacer, pestanaInicial: 'diagnostico',
  }));
  const viejo = dibujar(sesion({ diagnosticoViejo: true }), () => {});
  assert.ok(viejo.includes(AVISO_DIAGNOSTICO_VIEJO), 'el aviso');
  assert.match(viejo, new RegExp(`>${REHACER_DIAGNOSTICO}<`), 'y su botón');
  assert.ok(viejo.indexOf(AVISO_DIAGNOSTICO_VIEJO) < viejo.indexOf('role="tablist"'), 'arriba de las pestañas: vale también para el PDF');
  assert.ok(!dibujar(sesion({ diagnosticoViejo: true })).includes(REHACER_DIAGNOSTICO), 'sin cómo rehacerlo, el aviso va sin botón');
  assert.ok(!dibujar(sesion({})).includes(AVISO_DIAGNOSTICO_VIEJO), 'sin la marca, nada');
});
