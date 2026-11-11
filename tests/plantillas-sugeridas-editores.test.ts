// =============================================================================
// Las plantillas sugeridas en los dos editores: la pestaña Plantillas del Video Editor y el panel del Image Editor
// =============================================================================
// Martín, 16/10/2026: «en todos los lugares que usamos templates, que al principio se posicionen los sugeridos para el
// negocio, que MaKo lo tome de lo analizado de su offer, de su funnel... Y que tenga un texto sutil de "Sugerido"».
// La regla es la del módulo compartido (lib/plantillas-sugeridas.ts, con su test); acá se fija lo de los editores: que
// cada plantilla tenga su fila de etiquetas con valores del catálogo, qué se sugiere a quién, y el cableado: la page lee
// las señales, bajan hasta la galería, y la API de MaKo y el chat «Editar con IA» dan el mismo orden.
//
// ⚠️ **Lo que se sugiere es sólo de Video desde el 6/11/2026.** El panel del Image Editor se quedó sin plantillas: las
// 10 de Doory se borraron (eran material ajeno) y las de MaKo se eligen en «Nuevo diseño», no en el panel. Se fueron
// con ellas la tabla `plantillas-etiquetas.ts` y los cuatro tests de qué se le sugiere a quién en Imagen, que no tienen
// sujeto. Queda el CABLEADO de Imagen (abajo), porque es lo primero que hará falta cuando el panel sirva las plantillas
// propias del negocio; que no vuelva ninguna de Doory lo guarda el test 3 de tests/api-mako-imagen.test.ts.
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
import { servicioPlantillas } from '../app/image-editor/mako/plantillas';

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

// ── Las etiquetas: una fila por plantilla, con valores del catálogo ──────────────────────────
// Sólo Video: la tabla de Imagen (`plantillas-etiquetas.ts`) se borró con las 10 plantillas de Doory, que eran sus
// únicas diez filas (6/11/2026).

test('cada plantilla de la galería de Video tiene su fila de etiquetas, y no sobra ninguna', () => {
  assert.deepEqual(Object.keys(ETIQUETAS_VIDEO).sort(), PLANTILLAS.map((p) => p.id).sort());
});

test('las etiquetas usan valores del catálogo', () => {
  const canales = CANALES.map((c) => c.id) as string[];
  const entradas = Object.keys(ENTRADAS);
  const cuellos = FASES.map((f) => f.cuello) as string[];
  for (const [id, e] of Object.entries(ETIQUETAS_VIDEO)) {
    for (const v of e.canal ?? []) assert.ok(canales.includes(v), `Video/${id}: el canal «${v}» no existe`);
    for (const v of e.entrada ?? []) assert.ok(entradas.includes(v), `Video/${id}: la entrada «${v}» no existe`);
    for (const v of e.cuello ?? []) assert.ok(cuellos.includes(v), `Video/${id}: el cuello «${v}» no existe`);
    for (const v of e.cobro ?? []) assert.ok(v === 'unico' || v === 'suscripcion', `Video/${id}: el cobro «${v}» no existe`);
  }
});

// ── Sin señales, nada cambia ─────────────────────────────────────────────────────────────────

test('sin señales: la galería de Video, la API y el chat en el orden de siempre y sin «Sugerido»', async () => {
  for (const s of [null, NADA]) {
    assert.deepEqual(plantillasEnOrden(s).map((x) => x.plantilla.id), PLANTILLAS.map((p) => p.id));
    assert.deepEqual(sugeridasVideo(s), []);
    assert.ok(plantillasParaApi(s).plantillas.every((p) => !('sugerida' in p)));
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

// El panel «Diseño» del Image Editor se quedó SIN plantillas el 6/11/2026: las 10 de Doory se borraron (eran material
// ajeno; el guard de que no vuelvan está en tests/api-mako-imagen.test.ts, test 3). Con eso se fueron los cuatro tests
// de qué se le sugiere a quién en Imagen. El CABLEADO que baja las señales hasta el servicio se queda entero (el test de
// más abajo lo fija), porque es lo primero que hará falta para sugerir.
// 11/11/2026: el panel volvió a servir plantillas, las REALES de MaKo (app/image-editor/mako/plantillas.ts). Todavía no sugiere
// ninguna: el «Sugerido» necesita etiquetas por plantilla, que las reales no tienen. El panel tiene plantillas y no miente con
// un «Sugerido», con señales o sin ellas.
test('imagen · el panel sirve las plantillas reales y no sugiere ninguna, con señales o sin ellas', async () => {
  for (const s of [null, NADA, CHECKOUT, EN_PERSONA, TODO]) {
    assert.ok((await listaImagen(s)).length > 0, 'el panel «Diseño» quedó vacío otra vez');
    assert.deepEqual(await sugeridasImagen(s), []);
  }
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
  assert.match(leer('lib', 'api-mako', 'areas', 'video.run.ts'), /plantillasParaApi\(await senalesDelNegocio\(\)\.catch\(\(\) => null\)\)/);
  // Imagen ya no: su área no tiene plantillas que ordenar (las 10 de Doory se borraron el 6/11/2026).
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
//   · la page de imagen no las lee / el cliente, la pantalla, el adaptador o el
//     catálogo no las pasan / el panel no dibuja «Sugerido»                           -> 14/1 cada una
//   · la API del video no lee las señales / no marca / en el orden de siempre         -> 14/1 cada una
//   · el chat no rearma usar_plantilla / ia.ts no le pasa las señales / el renglón no
//     marca la sugerida / no dice que elija una sugerida                              -> 14/1 cada una
// Las roturas que medían el ORDEN de la galería de imagen (ordenar lo ya filtrado, ordenar sin las señales, la API de
// imagen sin las señales, la tarjeta de presentación con un cuello genérico) se fueron el 6/11/2026 con las plantillas
// que ordenaban. Medido el 6/11/2026: la base es 12/0, y el panel sugiriendo algo (su `list` devolviendo una fila) da
// 11/1 en «imagen · sin plantillas, el panel no sugiere nada».
