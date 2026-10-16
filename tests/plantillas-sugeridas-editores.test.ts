// =============================================================================
// Las plantillas sugeridas en los dos editores: la pestaña Plantillas del Video Editor y el panel del Image Editor
// =============================================================================
// Martín, 16/10/2026: «en todos los lugares que usamos templates, que al principio se posicionen los sugeridos para el
// negocio, que MaKo lo tome de lo analizado de su offer, de su funnel... Y que tenga un texto sutil de "Sugerido"».
// La regla es la del módulo compartido (lib/plantillas-sugeridas.ts, con su test); acá se fija lo de los editores: que
// cada plantilla tenga su fila de etiquetas con valores del catálogo, qué se sugiere a quién, que el Image Editor ordene
// la galería ENTERA antes de filtrar y paginar, y el cableado: la page lee las señales, bajan hasta la galería, y la
// API de MaKo y el chat «Editar con IA» dan el mismo orden.
//
// PROBADO ROMPIÉNDOLO: ver el final.
//
// Correr: node --import tsx --test tests/plantillas-sugeridas-editores.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SenalesNegocio } from '../lib/plantillas-sugeridas';
import { CANALES, FASES } from '../lib/fase-diagnostico';
import { ENTRADAS } from '../lib/pipeline';
import { PLANTILLAS, plantillasEnOrden, plantillasParaApi } from '../lib/editor-video/plantillas';
import { ETIQUETAS_VIDEO } from '../lib/editor-video/plantillas-etiquetas';
import { catalogoParaPrompt } from '../lib/editor-video/chat-catalogo';
import { catalogoPlantillas, servicioPlantillas } from '../app/image-editor/mako/plantillas';
import { ETIQUETAS_IMAGEN } from '../app/image-editor/mako/plantillas-etiquetas';

const RAIZ = join(__dirname, '..');
// Líneas `//` primero y bloques después (docs/hallazgos-ia.md, 16/10/2026).
const sinComentarios = (s: string) => s.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (...ruta: string[]) => sinComentarios(readFileSync(join(RAIZ, ...ruta), 'utf8'));

const NADA: SenalesNegocio = { canales: [], entradas: [], cobros: [], cuello: null };
const CHECKOUT: SenalesNegocio = { ...NADA, canales: ['carrito'], entradas: ['carrito'] };
const EN_PERSONA: SenalesNegocio = { ...NADA, canales: ['presencial'] };
const TODO: SenalesNegocio = {
  canales: CANALES.map((c) => c.id), entradas: Object.keys(ENTRADAS) as SenalesNegocio['entradas'], cobros: ['unico', 'suscripcion'], cuello: 'oferta',
};

const sugeridasVideo = (s: SenalesNegocio | null) => plantillasEnOrden(s).filter((x) => x.porque).map((x) => x.plantilla.id);
const listaImagen = async (s: SenalesNegocio | null, q: Parameters<ReturnType<typeof servicioPlantillas>['list']>[0] = {}) =>
  (await servicioPlantillas(s).list(q)).results;
const sugeridasImagen = async (s: SenalesNegocio | null) => (await listaImagen(s)).filter((t) => t.suggested_reason).map((t) => t.slug);
const SLUGS_IMAGEN = catalogoPlantillas().map((p) => p.slug);

// ── Las etiquetas: una fila por plantilla, con valores del catálogo ──────────────────────────

test('cada plantilla de las dos galerías tiene su fila de etiquetas, y no sobra ninguna', () => {
  assert.deepEqual(Object.keys(ETIQUETAS_VIDEO).sort(), PLANTILLAS.map((p) => p.id).sort());
  assert.deepEqual(Object.keys(ETIQUETAS_IMAGEN).sort(), [...SLUGS_IMAGEN].sort());
});

test('las etiquetas usan valores del catálogo', () => {
  const canales = CANALES.map((c) => c.id) as string[];
  const entradas = Object.keys(ENTRADAS);
  const cuellos = FASES.map((f) => f.cuello) as string[];
  for (const [galeria, tabla] of [['Video', ETIQUETAS_VIDEO], ['Imagen', ETIQUETAS_IMAGEN]] as const) {
    for (const [id, e] of Object.entries(tabla)) {
      for (const v of e.canal ?? []) assert.ok(canales.includes(v), `${galeria}/${id}: el canal «${v}» no existe`);
      for (const v of e.entrada ?? []) assert.ok(entradas.includes(v), `${galeria}/${id}: la entrada «${v}» no existe`);
      for (const v of e.cuello ?? []) assert.ok(cuellos.includes(v), `${galeria}/${id}: el cuello «${v}» no existe`);
      for (const v of e.cobro ?? []) assert.ok(v === 'unico' || v === 'suscripcion', `${galeria}/${id}: el cobro «${v}» no existe`);
    }
  }
});

// ── Sin señales, nada cambia ─────────────────────────────────────────────────────────────────

test('sin señales: las dos galerías, la API y el chat en el orden de siempre y sin «Sugerido»', async () => {
  for (const s of [null, NADA]) {
    assert.deepEqual(plantillasEnOrden(s).map((x) => x.plantilla.id), PLANTILLAS.map((p) => p.id));
    assert.deepEqual(sugeridasVideo(s), []);
    assert.deepEqual((await listaImagen(s)).map((t) => t.slug), SLUGS_IMAGEN);
    assert.deepEqual(await sugeridasImagen(s), []);
    assert.ok(plantillasParaApi(s).plantillas.every((p) => !('sugerida' in p)));
    assert.ok(catalogoPlantillas(s).every((p) => !('sugerida' in p)));
    assert.doesNotMatch(catalogoParaPrompt(s), /SUGERIDA/);
  }
});

// ── Qué se sugiere a quién: Video Editor ─────────────────────────────────────────────────────

test('video · cobra en un checkout: primero «Oferta con cuenta regresiva», y su variante con glitch no', () => {
  const r = plantillasEnOrden(CHECKOUT);
  assert.deepEqual(sugeridasVideo(CHECKOUT), ['oferta']);
  assert.equal(r[0].plantilla.id, 'oferta', 'la sugerida va primero');
  assert.equal(r[0].porque, 'Vendes con checkout', 'el porqué es el del eje más pesado');
  assert.deepEqual(r.slice(1).map((x) => x.plantilla.id), PLANTILLAS.map((p) => p.id).filter((id) => id !== 'oferta'), 'y las demás, en el orden de siempre');
});

test('video · vende por llamada, los leads vienen de anuncios y el cuello es la conversión: Testimonio y el gancho', () => {
  const s: SenalesNegocio = { ...NADA, canales: ['llamadas'], entradas: ['formulario_anuncio'], cuello: 'conversion' };
  assert.deepEqual(sugeridasVideo(s), ['testimonio', 'gancho']);
  assert.ok(!sugeridasVideo(s).includes('oferta'), 'la oferta es de UN modo de vender: no se sugiere por un cuello genérico');
});

test('video · el cuello en la oferta y le compran desde su página: Beneficios, el gancho y Antes y después', () => {
  assert.deepEqual(sugeridasVideo({ ...NADA, entradas: ['landing'], cuello: 'oferta' }), ['beneficios', 'gancho', 'antes-despues']);
});

test('video · las variantes no se sugieren nunca, y nunca más de tres', () => {
  const r = sugeridasVideo(TODO);
  assert.equal(r.length, 3);
  for (const variante of ['gancho-escrito', 'oferta-glitch']) {
    assert.deepEqual(ETIQUETAS_VIDEO[variante], {}, `${variante} es una variante: \`{}\``);
    assert.ok(!r.includes(variante));
  }
});

// ── Qué se sugiere a quién: Image Editor ─────────────────────────────────────────────────────

test('imagen · cierra en persona: la historia de evento, el volante y la tarjeta, con su porqué', async () => {
  const lista = await listaImagen(EN_PERSONA);
  assert.deepEqual(lista.filter((t) => t.suggested_reason).map((t) => t.slug), ['rooftop-event-story', 'grand-opening-flyer', 'clean-business-card']);
  assert.deepEqual(lista.slice(0, 3).map((t) => t.suggested_reason), ['Cierras en persona', 'Cierras en persona', 'Cierras en persona']);
});

test('imagen · cobra en un checkout: el anuncio de oferta', async () => {
  assert.deepEqual(await sugeridasImagen(CHECKOUT), ['bold-sale-announcement']);
});

test('imagen · quien vende por llamada no ve ninguna «Sugerido»: ninguna de las 10 lleva un eje genérico', async () => {
  const s: SenalesNegocio = { ...NADA, canales: ['llamadas'], cobros: ['suscripcion'], cuello: 'conversion' };
  assert.deepEqual(await sugeridasImagen(s), []);
  assert.deepEqual((await listaImagen(s)).map((t) => t.slug), SLUGS_IMAGEN);
});

test('imagen · se ordena la galería ENTERA y después se filtra y se pagina', async () => {
  // Cuatro coinciden (oferta, evento, volante y tarjeta) y van tres: la tarjeta, la última, queda afuera.
  const s: SenalesNegocio = { ...NADA, canales: ['presencial', 'carrito'] };
  assert.deepEqual(await sugeridasImagen(s), ['bold-sale-announcement', 'rooftop-event-story', 'grand-opening-flyer']);
  const negocios = await listaImagen(s, { category: 'negocios' });
  assert.deepEqual(negocios.map((t) => t.slug), ['clean-business-card']);
  assert.equal(negocios[0].suggested_reason, undefined, 'filtrar no la vuelve «Sugerido»: no está entre las tres');
  const pagina1 = await servicioPlantillas(s).list({ page: 1, page_size: 2 });
  assert.deepEqual(pagina1.results.map((t) => t.slug), ['bold-sale-announcement', 'rooftop-event-story'], 'la primera página empieza por las sugeridas');
  assert.equal(pagina1.count, SLUGS_IMAGEN.length);
});

// ── El cableado ──────────────────────────────────────────────────────────────────────────────

test('video · la page lee las señales en el server y bajan hasta la pestaña Plantillas', () => {
  const pagina = leer('app', 'video-editor', '[proyecto]', 'page.tsx');
  assert.match(pagina, /senalesDelNegocio\(\)\.catch\(\(\) => null\)/);
  assert.match(pagina, /<VideoEditorCliente [^>]*senales=\{senales\} \/>/);
  assert.match(leer('app', 'video-editor', 'VideoEditorCliente.tsx'), /<SenalesNegocioProvider senales=\{senales\}>/);
  const g = leer('app', 'video-editor', '_opencut', 'plantillas', 'components', 'biblioteca-plantillas.tsx');
  assert.match(g, /const senales = useSenalesNegocio\(\);/);
  assert.match(g, /useMemo\(\(\) => plantillasEnOrden\(senales\), \[senales\]\)/);
  assert.match(g, /\{plantillas\.map\(\(\{ plantilla: p, porque \}\) =>/, 'la grilla recorre la lista ordenada');
  assert.match(g, /\{porque && \(\s*<span [^>]*title=\{porque\}>\s*Sugerido\s*<\/span>/, 'y la tarjeta dice «Sugerido», con el porqué en el title');
});

test('imagen · la page lee las señales y bajan hasta el servicio de plantillas; el panel dibuja «Sugerido»', () => {
  const pagina = leer('app', 'image-editor', '[diseno]', 'page.tsx');
  assert.match(pagina, /senalesDelNegocio\(\)\.catch\(\(\) => null\)/);
  assert.match(pagina, /<ImageEditorCliente [^>]*senales=\{senales\} \/>/);
  assert.match(leer('app', 'image-editor', 'ImageEditorCliente.tsx'), /<PantallaEditor [^>]*senales=\{senales\} \/>/);
  assert.match(leer('app', 'image-editor', 'editor', 'PantallaEditor.tsx'), /crearAdaptadorNube\(\{[\s\S]*?\bsenales,\s*\}\), \[[^\]]*\bsenales\]\)/);
  assert.match(leer('app', 'image-editor', 'mako', 'adaptadorNube.ts'), /const nube = serviciosCatalogo\(o\.senales\);/);
  assert.match(leer('app', 'image-editor', 'mako', 'servicios.ts'), /templates: servicioPlantillas\(senales\),/);
  const panel = leer('app', 'image-editor', '_doory', 'editor', 'panels', 'TemplatesPanel.tsx');
  assert.match(panel, /\{tpl\.suggested_reason \? \(\s*<span className=\{styles\.suggested\} title=\{tpl\.suggested_reason\}>\s*\{t\.templates\.suggested\}/);
  assert.match(leer('app', 'image-editor', '_doory', 'editor', 'strings.ts'), /suggested: 'Sugerido',/);
});

test('la API de MaKo da el mismo orden, con la sugerida marcada', () => {
  const v = plantillasParaApi(CHECKOUT).plantillas;
  assert.equal(v[0].id, 'oferta');
  assert.equal((v[0] as { sugerida?: string }).sugerida, 'Vendes con checkout');
  const i = catalogoPlantillas(EN_PERSONA);
  assert.equal(i[0].slug, 'rooftop-event-story');
  assert.equal(i[0].sugerida, 'Cierras en persona');
  assert.match(leer('lib', 'api-mako', 'areas', 'video.run.ts'), /plantillasParaApi\(await senalesDelNegocio\(\)\.catch\(\(\) => null\)\)/);
  assert.match(leer('lib', 'api-mako', 'areas', 'imagen.run.ts'), /catalogoPlantillas\(await senalesDelNegocio\(\)\.catch\(\(\) => null\)\)/);
});

test('el chat «Editar con IA» lee las plantillas en el mismo orden, con la sugerida marcada', () => {
  const p = catalogoParaPrompt(CHECKOUT);
  assert.match(p, /· "oferta" «Oferta con cuenta regresiva» \(SUGERIDA para este negocio: Vendes con checkout\), /);
  assert.ok(p.indexOf('· "oferta" ') < p.indexOf('· "gancho" '), 'la sugerida va primero');
  assert.match(p, /Si la persona no dice cuál, elige una SUGERIDA para este negocio\./);
  const ia = leer('lib', 'editor-video', 'ia.ts');
  assert.match(ia, /senalesDelNegocio\(\)\.catch\(\(\) => null\)/);
  assert.match(ia, /catalogo: catalogoParaPrompt\(senales\),/);
});

// Probado rompiéndolo (16/10/2026), cada rotura restaurada (base 15/0):
//   · la pestaña ordena sin las señales / no lee el contexto / no dice «Sugerido»      -> 14/1 cada una
//   · la page del video no pasa las señales / el cliente no las pone en el contexto  -> 14/1 cada una
//   · la variante con glitch con la fila de la original                               -> 13/2
//   · la oferta con un cuello genérico                                                -> 14/1
//   · una plantilla de video sin su fila                                              -> 13/2
//   · una etiqueta con un canal que no existe                                         -> 14/1
//   · el orden del video sin la tabla de etiquetas                                    -> 9/6
//   · el servicio de imagen ordena lo ya filtrado                                     -> 14/1
//   · el servicio de imagen ordena sin las señales                                    -> 12/3
//   · la page de imagen no las lee / el cliente, la pantalla, el adaptador o el
//     catálogo no las pasan / el panel no dibuja «Sugerido»                           -> 14/1 cada una
//   · la tarjeta de presentación con un cuello genérico                               -> 14/1
//   · la API del video no lee las señales / no marca / en el orden de siempre         -> 14/1 cada una
//   · la API de imagen ordena sin las señales                                         -> 14/1
//   · el chat no rearma usar_plantilla / ia.ts no le pasa las señales / el renglón no
//     marca la sugerida / no dice que elija una sugerida                              -> 14/1 cada una
