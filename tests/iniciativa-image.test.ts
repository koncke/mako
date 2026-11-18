// =============================================================================
// MaKo toma la iniciativa en el Image Editor: el diseño en blanco (5/11/2026, T12 de docs/mako-iniciativa/plan.md)
// =============================================================================
// Martín (29/10/2026): «que MaKo te vaya guiando… dependiendo del template que se eligió, o de la situación de la persona». Lo
// que se fija:
//   1. la apertura (lib/aperturas/image.ts): con una página sin nada y la charla vacía pregunta un HECHO, «¿Dónde lo vas a
//      publicar?», por diseño (alcance `entidad`); con algo en la página, con charla o sin diseño, calla; cada lugar tiene su medida;
//   2. el montaje: cada respuesta pone el lienzo a esa medida con el MISMO resize del panel de tamaño (sin IA), y mientras habla
//      el saludo y las píldoras se esconden.
//
// Correr: node --import tsx --test tests/iniciativa-image.test.ts
// PROBADO ROMPIÉNDOLO (base 2/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ID_DONDE, ID_MARCA, ID_SUGERIDA, LUGARES_IMAGE, MEDIDA_DE, aperturaImage, nombreCorto, sugeridaDe, type HechosImage } from '../lib/aperturas/image';
import { PREGUNTA_DE_ACCION, claveApertura, claveValida, problemasDeApertura } from '../lib/aperturas/reglas';
import { PLANTILLAS_IMAGEN } from '../lib/image-editor/plantillas-reales';
import { PREFIJO_PLANTILLA_REAL, conPlantilla, plantillaDelDiseno } from '../lib/image-editor/reglas';
import { rutaSeccion } from '../lib/secciones-negocio';
import { applyTemplate } from '../app/image-editor/_doory/editor/panels/templateOps';
import { migrateDocument } from '../app/image-editor/_doory/editor/engine/migrations';
import { plantillaNueva } from '../app/image-editor/plantillas-crear';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. la apertura: en blanco y sin charla pregunta un hecho, por diseño; si no, calla; cada lugar con su medida', () => {
  const h: HechosImage = { diseno: '3f9a1b2c-4d5e-4f60-8a7b-1c2d3e4f5a6b', enBlanco: true, charlaVacia: true, sinMarca: false, familia: null };
  const a = aperturaImage(h, {})!;
  assert.equal(a.id, ID_DONDE);
  assert.equal(a.texto, '¿Dónde lo vas a publicar?');
  assert.doesNotMatch(a.texto, PREGUNTA_DE_ACCION);
  assert.deepEqual(problemasDeApertura(a, { primerPaso: true }), []);
  assert.equal(a.alcance, 'entidad');
  assert.ok(claveValida(claveApertura(a.id, a.entidad)), 'la clave con el diseño pasa la validación de la ruta');
  assert.deepEqual(a.botones.filter((b) => b.tipo === 'hacer').map((b) => (b.tipo === 'hacer' ? b.accion : '')), [...LUGARES_IMAGE]);
  assert.deepEqual(MEDIDA_DE.historia, { ancho: 1080, alto: 1920 }, 'la historia, 9:16');
  for (const acc of LUGARES_IMAGE) assert.ok(MEDIDA_DE[acc].ancho > 0 && MEDIDA_DE[acc].alto > 0, acc);
  assert.equal(aperturaImage({ ...h, enBlanco: false }, {}), null, 'con algo en la página');
  assert.equal(aperturaImage({ ...h, charlaVacia: false }, {}), null, 'con la charla empezada');
  assert.equal(aperturaImage({ ...h, diseno: null }, {}), null);
});

test('2. el montaje: el mismo resize del panel de tamaño, y el saludo y las píldoras se esconden mientras habla', () => {
  const panel = sinComentarios(leer('app/image-editor/mako/chat/PanelMakoIA.tsx'));
  assert.match(panel, /const enBlanco = useEditorState\(\(s\) => s\.doc\.pages\.length === 1 && s\.doc\.pages\[0\]\.objects\.length === 0\);/);
  assert.match(panel, /editor\.pages\.resize\(m\.ancho, m\.alto, 'keep'\)/, 'el resize del panel de tamaño, sin IA');
  assert.match(panel, /\{hilo\.mensajes\.length === 0 && !estadoApertura\.apertura && \(\n\s*<div className=\{styles\.saludo\}>/);
  // `ocupado` es «corriendo o una propuesta a mitad de aplicarse» (F49, 18/11/2026).
  assert.match(panel, /\{!ocupado && !estadoApertura\.apertura && \(\n\s*<div className=\{styles\.sugerencias\}>/, 'las píldoras, sólo sin la apertura');
});

// 18/11/2026 (F18 y F44 de docs/pendientes-verificados-17-11.md): la sugerida de esa familia, el slug guardado y la marca.
test('3. elegido el lugar, la plantilla real de ese grupo; «Usar la plantilla» la pone y el diseño recuerda de cuál nació', () => {
  const h: HechosImage = { diseno: '3f9a1b2c-4d5e-4f60-8a7b-1c2d3e4f5a6b', enBlanco: true, charlaVacia: true, sinMarca: false, familia: 'historia' };
  const a = aperturaImage(h, {})!;
  assert.equal(a.id, ID_SUGERIDA);
  const s = sugeridaDe('historia')!;
  assert.equal(s.grupo, 'Historias');
  assert.equal(s, PLANTILLAS_IMAGEN.find((p) => p.grupo === 'Historias'), 'la primera de su grupo, en el orden del catálogo');
  assert.ok(a.texto.includes(`«${nombreCorto(s)}»`) && !a.texto.includes(' · '), `nombra la plantilla por su nombre corto: ${a.texto}`);
  assert.deepEqual(problemasDeApertura(a, { primerPaso: false }), []);
  assert.deepEqual(a.botones.map((b) => b.tipo === 'hacer' ? `${b.tipo}:${b.accion}` : b.tipo), ['hacer:usar-sugerida', 'callar']);
  assert.equal(sugeridaDe('anuncio')?.grupo, 'Anuncios');
  // El carrusel no tiene plantilla real: sigue la pregunta del lugar (un carrusel de MaKo por tipo nace en el server).
  assert.equal(sugeridaDe('carrusel'), null);
  assert.equal(aperturaImage({ ...h, familia: 'carrusel' }, {})?.id, ID_DONDE);
  // Cada sugerida tiene su tarjeta de «Nuevo diseño», con el mismo id que guarda el diseño.
  for (const l of LUGARES_IMAGE) {
    const x = sugeridaDe(l);
    if (x) assert.equal(plantillaNueva(`${PREFIJO_PLANTILLA_REAL}${x.id}`)?.real, x.id, l);
  }

  // «Usar la plantilla», como lo hace el panel: el diseño en blanco recibe la estructura y la plantilla queda en `meta`.
  const enBlanco = migrateDocument({ schemaVersion: 1, width: 1080, height: 1920, unit: 'px', pages: [{ id: 'pag-1', background: { type: 'solid', color: '#ffffff' }, objects: [] }] });
  const aplicada = applyTemplate(enBlanco, 'pag-1', migrateDocument(s.estructura()), 'replace')!;
  const doc = conPlantilla(aplicada.doc, `${PREFIJO_PLANTILLA_REAL}${s.id}`);
  assert.ok(doc.pages[0].objects.length > 0, 'la página trae la estructura');
  assert.equal(plantillaDelDiseno(doc), `${PREFIJO_PLANTILLA_REAL}${s.id}`);
  assert.equal(plantillaDelDiseno(aplicada.doc), null, 'conPlantilla no toca el de entrada');
  // El motor lo conserva: al abrirlo (la migración del documento) y al guardarlo (viaja entero).
  assert.equal(plantillaDelDiseno(migrateDocument(JSON.parse(JSON.stringify(doc)))), `${PREFIJO_PLANTILLA_REAL}${s.id}`);
  // Lo que no es un slug no se escribe; y un diseño en blanco no lleva ninguna.
  assert.equal(plantillaDelDiseno(conPlantilla(enBlanco, '<script>')), null);
  assert.equal(plantillaDelDiseno(conPlantilla(enBlanco, null)), null);

  // El montaje: la acción de crear, la API y el panel escriben el slug con `conPlantilla`.
  assert.match(sinComentarios(leer('app/image-editor/actions.ts')), /doc: conPlantilla\(doc, real \|\| tipo \? pl\.id : null\)/);
  assert.match(sinComentarios(leer('lib/api-mako/areas/imagen.run.ts')), /conPlantilla\(real\.estructura\(randomUUID\), `\$\{PREFIJO_PLANTILLA_REAL\}\$\{real\.id\}`\)/);
  const panel = sinComentarios(leer('app/image-editor/mako/chat/PanelMakoIA.tsx'));
  assert.match(panel, /applyTemplate\(editor\.getDocument\(\), editor\.state\.activePageId, migrateDocument\(s\.estructura\(\)\), 'replace'\)/);
  assert.match(panel, /editor\.applyDocument\(conPlantilla\(aplicada\.doc,/);
});

test('4. sin marca, con algo en la página y la charla vacía, MaKo pregunta por la marca; el link del saludo se fue', () => {
  const h: HechosImage = { diseno: '3f9a1b2c-4d5e-4f60-8a7b-1c2d3e4f5a6b', enBlanco: false, charlaVacia: true, sinMarca: true, familia: null };
  const a = aperturaImage(h, {})!;
  assert.equal(a.id, ID_MARCA);
  assert.equal(a.alcance, 'negocio', 'es del negocio: contestada en un diseño, no se repite en el siguiente');
  assert.doesNotMatch(a.texto, PREGUNTA_DE_ACCION);
  assert.deepEqual(problemasDeApertura(a, { primerPaso: true }), []);
  const ir = a.botones.find((b) => b.tipo === 'ir');
  assert.equal(ir?.tipo === 'ir' ? ir.href : null, rutaSeccion('marca'), 'el link a la marca del Second Brain');
  assert.equal(aperturaImage(h, { [ID_MARCA]: 'no' }), null, '«Todavía no» la contesta');
  assert.equal(aperturaImage({ ...h, sinMarca: false }, {}), null, 'con marca, calla');
  assert.equal(aperturaImage({ ...h, enBlanco: true }, {})?.id, ID_DONDE, 'en blanco va primero la medida');
  const panel = sinComentarios(leer('app/image-editor/mako/chat/PanelMakoIA.tsx'));
  assert.doesNotMatch(panel, /Sube tu manual de marca/, 'el link del saludo se reemplazó por la apertura');
  assert.match(panel, /hechos: marca\.kits \? \{ diseno: disenoId \?\? null, enBlanco, charlaVacia: hilo\.mensajes\.length === 0, sinMarca, familia \} : null,/);
  assert.match(panel, /const sinMarca = !!marca\.kits && marca\.kits\.kits\.length === 0 && !marca\.error;/, '«no pude leer» no es «sin marca»');
});

// PROBADO ROMPIÉNDOLO (5/11/2026, base 2/0):
//   · la apertura también con algo en la página                  → 1/1 (1)
//   · las píldoras siguen a la vista con la apertura              → 1/1 (2)
// PROBADO ROMPIÉNDOLO (18/11/2026, base 4/0):
//   · sin el paso de la sugerida (la función vuelve a preguntar el lugar)   → 3/1 (3)
//   · `conPlantilla` sin escribir `meta.plantilla`                          → 3/1 (3)
//   · la marca preguntada también con la página en blanco                   → 3/1 (4)
//   · el link «Sube tu manual de marca» de vuelta en el saludo              → 3/1 (4)
