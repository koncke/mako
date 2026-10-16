// =============================================================================
// Las plantillas sugeridas: primero las que le sirven a ESTE negocio, con un «Sugerido» sutil (lib/plantillas-sugeridas.ts)
// =============================================================================
// Martín, 16/10/2026: «en todos los lugares que usamos templates, que al principio se posicionen los sugeridos para el
// negocio, que MaKo lo tome de lo analizado de su offer, de su funnel... Y que tenga un texto sutil de "Sugerido"».
// Fija la regla (el orden, el tope, los empates, sólo lo declarado), que cada plantilla de las dos galerías tenga su
// fila de etiquetas con valores del catálogo, y el cableado: la página lee las señales, el editor se las pasa a la
// galería y la API de MaKo da el mismo orden.
//
// PROBADO ROMPIÉNDOLO, cada rotura restaurada de memoria (base 16/0):
//   · sin el tope de MAX_SUGERIDAS                                  -> 13 / 3
//   · las empatadas al revés del orden de la galería                -> 12 / 4
//   · el canal pesa como los demás ejes                             -> 14 / 2
//   · el porqué sale del eje más liviano                            -> 15 / 1
//   · un funnel sin declarar aporta sus entradas                    -> 15 / 1
//   · un canal fuera del catálogo cuenta                            -> 15 / 1
//   · un cuello fuera del catálogo cuenta                           -> 15 / 1
//   · el «único» que el código le pone a un producto cuenta         -> 15 / 1
//   · la galería filtra antes de ordenar                            -> 15 / 1
//   · la tarjeta no dice «Sugerido»                                 -> 15 / 1
//   · «Ventas por WhatsApp» con el cuello genérico                  -> 15 / 1
//   · Closing con el cuello genérico                                -> 15 / 1
//   · una plantilla sin su fila de etiquetas                        -> 15 / 1
//   · una etiqueta con un valor que no existe                       -> 15 / 1
//   · la página del Dashboard no pasa las señales                   -> 15 / 1
//   · el editor no se las pasa al modal                             -> 15 / 1
//   · el lector de funnels trae el `data` entero                    -> 15 / 1
//   · el server no usa la regla pura                                -> 15 / 1
//   · la API del Dashboard no ordena                                -> 15 / 1
//   · el catálogo en JSON de la API no pasa las señales             -> 15 / 1
//   · la API de General no ordena                                   -> 15 / 1
//
// Correr: npx tsx --test tests/plantillas-sugeridas.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MAX_SUGERIDAS, PORQUE, ordenarConSugeridas, senalesDe, type SenalesNegocio } from '../lib/plantillas-sugeridas';
import { ETIQUETAS_DASHBOARD, ETIQUETAS_GENERAL } from '../lib/graficos-plantillas-etiquetas';
import { PLANTILLAS_HOJA } from '../lib/graficos-plantillas';
import { PLANTILLAS_GENERAL } from '../lib/general-plantillas';
import { CANALES, FASES } from '../lib/fase-diagnostico';
import { ENTRADAS } from '../lib/pipeline';
import { catalogoJson, catalogoMarkdown, plantillasDelCatalogo } from '../lib/api-mako/areas/dashboard.helpers';

const RAIZ = join(__dirname, '..');
// Líneas `//` primero y bloques después (docs/hallazgos-ia.md, 16/10/2026).
const sinComentarios = (s: string) => s.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (...ruta: string[]) => sinComentarios(readFileSync(join(RAIZ, ...ruta), 'utf8'));

const NADA: SenalesNegocio = { canales: [], entradas: [], cobros: [], cuello: null };
const ids = <T extends { plantilla: { id: string } }>(xs: T[]) => xs.map((x) => x.plantilla.id);
const sugeridas = <T extends { plantilla: { id: string }; porque: string | null }>(xs: T[]) => xs.filter((x) => x.porque).map((x) => x.plantilla.id);

// ── La regla ─────────────────────────────────────────────────────────────────────────────────

test('sin señales: el orden de siempre y ninguna «Sugerido»', () => {
  for (const s of [null, undefined, NADA]) {
    const r = ordenarConSugeridas(PLANTILLAS_HOJA, ETIQUETAS_DASHBOARD, s);
    assert.deepEqual(ids(r), PLANTILLAS_HOJA.map((p) => p.id));
    assert.deepEqual(sugeridas(r), []);
  }
});

test('vende por llamada, los leads vienen de anuncios y el cuello es la conversión: Comercial, Closing y Marketing', () => {
  const r = ordenarConSugeridas(PLANTILLAS_HOJA, ETIQUETAS_DASHBOARD, { ...NADA, canales: ['llamadas'], entradas: ['formulario_anuncio'], cuello: 'conversion' });
  assert.deepEqual(sugeridas(r), ['comercial', 'closing', 'marketing']);
  assert.deepEqual(ids(r).slice(0, 3), ['comercial', 'closing', 'marketing'], 'las sugeridas van primero');
  assert.equal(r[0].porque, 'Vendes por llamada', 'el porqué es el del eje más pesado');
  assert.equal(r[2].porque, 'Tus leads vienen de anuncios');
  const resto = PLANTILLAS_HOJA.map((p) => p.id).filter((id) => !['comercial', 'closing', 'marketing'].includes(id));
  assert.deepEqual(ids(r).slice(3), resto, 'y las demás, en el orden de siempre');
});

test('vende por chat y cobra una suscripción: Chat Analyst, Comercial y CS Analyst', () => {
  const r = ordenarConSugeridas(PLANTILLAS_HOJA, ETIQUETAS_DASHBOARD, { ...NADA, canales: ['conversaciones'], entradas: ['chat_entrante'], cobros: ['suscripcion'] });
  assert.deepEqual(sugeridas(r), ['chat-analyst', 'comercial', 'cs-analyst']);
});

test('una plantilla de un canal no se le sugiere a quien vende por otro (los ejes suman por separado)', () => {
  // Visto en el arnés el 16/10/2026: con el cuello en la conversión, «Ventas por WhatsApp» salía sugerida a quien vende
  // por llamada, y Closing a quien vende por chat.
  const porLlamada: SenalesNegocio = { ...NADA, canales: ['llamadas'], entradas: ['formulario_anuncio'], cuello: 'conversion' };
  assert.ok(!sugeridas(ordenarConSugeridas(PLANTILLAS_GENERAL, ETIQUETAS_GENERAL, porLlamada)).includes('funnel-whatsapp'));
  const porChat: SenalesNegocio = { ...NADA, canales: ['conversaciones'], cuello: 'conversion' };
  assert.ok(!sugeridas(ordenarConSugeridas(PLANTILLAS_HOJA, ETIQUETAS_DASHBOARD, porChat)).includes('closing'));
  assert.ok(!sugeridas(ordenarConSugeridas(PLANTILLAS_GENERAL, ETIQUETAS_GENERAL, porChat)).includes('funnel-llamadas'));
});

test('empatadas, manda el orden de la galería', () => {
  const s = { ...NADA, cobros: ['suscripcion' as const] };
  assert.deepEqual(sugeridas(ordenarConSugeridas(PLANTILLAS_HOJA, ETIQUETAS_DASHBOARD, s)), ['cs-analyst', 'cobranza']);
  assert.deepEqual(sugeridas(ordenarConSugeridas(PLANTILLAS_GENERAL, ETIQUETAS_GENERAL, s)), ['cobros', 'servicio']);
});

test(`nunca más de ${MAX_SUGERIDAS}: si la mitad dice «Sugerido», no dice nada`, () => {
  const todo: SenalesNegocio = {
    canales: CANALES.map((c) => c.id), entradas: Object.keys(ENTRADAS) as SenalesNegocio['entradas'], cobros: ['unico', 'suscripcion'], cuello: 'conversion',
  };
  assert.equal(MAX_SUGERIDAS, 3);
  assert.equal(sugeridas(ordenarConSugeridas(PLANTILLAS_HOJA, ETIQUETAS_DASHBOARD, todo)).length, 3);
  assert.equal(sugeridas(ordenarConSugeridas(PLANTILLAS_GENERAL, ETIQUETAS_GENERAL, todo)).length, 3);
});

// ── Las señales: sólo lo que el dueño dijo ──────────────────────────────────────────────────

test('un funnel sin declarar no aporta entradas; su canal sí, si es del catálogo', () => {
  const s = senalesDe({
    funnels: [
      { canal: null, declarado: false, entradas: ['formulario_anuncio'] },
      { canal: 'llamadas', declarado: true, entradas: ['landing'] },
      { canal: 'por-telefono', declarado: true, entradas: [] },
    ],
    fase: null, ofertas: [], productos: [],
  });
  assert.deepEqual(s, { canales: ['llamadas'], entradas: ['landing'], cobros: [], cuello: null });
});

test('el diagnóstico de fase aporta su canal y su cuello, sólo si son del catálogo', () => {
  assert.deepEqual(senalesDe({ funnels: [], fase: { canal: 'webinar', cuello: 'foco' }, ofertas: [], productos: [] }),
    { canales: ['webinar'], entradas: [], cobros: [], cuello: 'foco' });
  assert.equal(senalesDe({ funnels: [], fase: { canal: 'radio', cuello: 'suerte' }, ofertas: [], productos: [] }), null);
});

test('cómo cobra: el modelo de sus ofertas, y de un producto SÓLO la suscripción («único» lo pone el código)', () => {
  assert.equal(senalesDe({ funnels: [], fase: null, ofertas: [{ modelo: null }], productos: [{ tipo: 'unico' }] }), null);
  assert.deepEqual(senalesDe({ funnels: [], fase: null, ofertas: [{ modelo: 'unico' }], productos: [{ tipo: 'suscripcion' }, { tipo: 'unico' }] })?.cobros,
    ['unico', 'suscripcion']);
});

test('sin nada declarado: null (y la galería, en el orden de siempre)', () => {
  assert.equal(senalesDe({ funnels: [{ canal: null, declarado: false, entradas: [] }], fase: null, ofertas: [], productos: [] }), null);
});

// ── Las etiquetas: una fila por plantilla, con valores del catálogo ──────────────────────────

test('cada plantilla de las dos galerías tiene su fila de etiquetas, y no sobra ninguna', () => {
  assert.deepEqual(Object.keys(ETIQUETAS_DASHBOARD).sort(), PLANTILLAS_HOJA.map((p) => p.id).sort());
  assert.deepEqual(Object.keys(ETIQUETAS_GENERAL).sort(), PLANTILLAS_GENERAL.map((p) => p.id).sort());
});

test('las etiquetas usan valores del catálogo, y cada valor tiene su porqué', () => {
  const canales = CANALES.map((c) => c.id) as string[];
  const entradas = Object.keys(ENTRADAS);
  const cuellos = FASES.map((f) => f.cuello) as string[];
  for (const [galeria, tabla] of [['Dashboard', ETIQUETAS_DASHBOARD], ['General', ETIQUETAS_GENERAL]] as const) {
    for (const [id, e] of Object.entries(tabla)) {
      for (const v of e.canal ?? []) assert.ok(canales.includes(v), `${galeria}/${id}: el canal «${v}» no existe`);
      for (const v of e.entrada ?? []) assert.ok(entradas.includes(v), `${galeria}/${id}: la entrada «${v}» no existe`);
      for (const v of e.cuello ?? []) assert.ok(cuellos.includes(v), `${galeria}/${id}: el cuello «${v}» no existe`);
      for (const v of e.cobro ?? []) assert.ok(v === 'unico' || v === 'suscripcion', `${galeria}/${id}: el cobro «${v}» no existe`);
    }
  }
  for (const c of canales) assert.ok(PORQUE.canal[c as keyof typeof PORQUE.canal], `sin porqué para el canal ${c}`);
  for (const x of entradas) assert.ok(PORQUE.entrada[x as keyof typeof PORQUE.entrada], `sin porqué para la entrada ${x}`);
  for (const c of cuellos) assert.ok(PORQUE.cuello[c as keyof typeof PORQUE.cuello], `sin porqué para el cuello ${c}`);
});

// ── El cableado ──────────────────────────────────────────────────────────────────────────────

test('la galería ordena la lista ENTERA, filtra después, y dibuja «Sugerido»', () => {
  const g = leer('app', 'dashboard', 'NuevaHoja.tsx');
  assert.match(g, /ordenarConSugeridas\(\s*informe === 'general' \? PLANTILLAS_GENERAL : PLANTILLAS_HOJA, informe === 'general' \? ETIQUETAS_GENERAL : ETIQUETAS_DASHBOARD, senales,\s*\)/);
  assert.match(g, /filtrarPlantillasHoja\(ordenadas\.map\(\(x\) => x\.plantilla\), busca\)/, 'se filtra lo ya ordenado');
  assert.match(g, /\{sugerida && <span className="nh-sugerido" title=\{sugerida\}>Sugerido<\/span>\}/);
});

test('las páginas leen las señales en el server y el editor se las pasa a las dos galerías', () => {
  for (const pagina of [leer('app', 'dashboard', 'page.tsx'), leer('app', 'general', 'page.tsx')]) {
    assert.match(pagina, /senalesDelNegocio\(\)\.catch\(\(\) => null\)/);
    assert.match(pagina, /senales=\{senales(Negocio)?\}/);
  }
  const ed = leer('app', 'dashboard', 'EditorInforme.tsx');
  assert.match(ed, /<CrearHoja [^>]*senales=\{senales\} \/>/);
  assert.match(ed, /<NuevaHoja [^>]*senales=\{senales\} \/>/);
});

test('las señales se leen de lo guardado, sin IA, con la regla pura', () => {
  const srv = leer('lib', 'plantillas-sugeridas-server.ts');
  assert.match(srv, /return senalesDe\(\{ funnels: funnels \?\? \[\], fase, ofertas: ofertas \?\? \[\], productos: productos \?\? \[\] \}\);/);
  assert.doesNotMatch(srv, /chatCheap|chatClaude|anthropic|gemini/i, 'abrir la galería no le pregunta a ninguna IA');
  const fun = leer('lib', 'funnels.ts');
  assert.match(fun, /\.from\('funnels'\)\.select\('canal, declarado, entradas:data->entradas'\)/, 'sólo las entradas, no el `data` entero');
});

test('la API de MaKo da el mismo orden, con la sugerida marcada', () => {
  const r = plantillasDelCatalogo({ ...NADA, canales: ['llamadas'] });
  assert.equal(r[0].id, 'comercial');
  assert.equal(r[0].sugerida, 'Vendes por llamada');
  assert.ok(plantillasDelCatalogo(null).every((x) => !('sugerida' in x)));
  const j = catalogoJson({ seccion: 'plantillas', senales: { ...NADA, canales: ['llamadas'] } }) as { plantillas: Array<{ id: string; sugerida?: string }> };
  assert.equal(j.plantillas[0].sugerida, 'Vendes por llamada', 'el catálogo en JSON pasa las señales');
  const md = catalogoMarkdown({ seccion: 'plantillas', senales: { ...NADA, canales: ['llamadas'] } }) as string;
  assert.match(md, /`comercial` .* · sugerida para este negocio \(Vendes por llamada\)/, 'y el de markdown también');
  assert.match(leer('lib', 'api-mako', 'areas', 'dashboard.run.ts'), /await senalesDelNegocio\(\)\.catch\(\(\) => null\)/);
  assert.match(leer('lib', 'api-mako', 'areas', 'general.run.ts'), /ordenarConSugeridas\(PLANTILLAS_GENERAL, ETIQUETAS_GENERAL, senales\)/);
});
