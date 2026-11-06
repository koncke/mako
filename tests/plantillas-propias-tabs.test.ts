// =============================================================================
// Plantillas propias por tab: lo que NO es texto y es del negocio no sale a la comunidad (6/11/2026)
// =============================================================================
// Cada enchufe saca lo suyo antes de la limpieza de textos (`paraPublico`, lib/creaciones-enchufes.ts):
//   · un guion del Copywriter (lib/creaciones-guion.ts): sus links;
//   · un diseño del Image Editor (lib/creaciones-diseno.ts): sus fotos (pasan a marcos vacíos del mismo tamaño) y los
//     fondos con foto. Una foto es un link al storage del negocio: la limpieza de textos la vería como un texto más.
// Y lo compone `definicionParaTodos` (lib/plantillas-propias-reglas.ts), que es lo que llama el server.
//
// Probado rompiéndolo (base: 7 verdes, 0 rojos; 6/11/2026):
//   · `disenoParaPublico` devolviendo `def` tal cual → 5/2 (la foto y el fondo siguen);
//   · `guionParaPublico` sin `sinLinks` → 6/1;
//   · `definicionParaTodos` sin `paraPublico` → 6/1 (el diseño compartido trae la foto).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { definicionParaTodos, type NegocioQueComparte } from '../lib/plantillas-propias-reglas';
import { definicionDeGuion, guionParaPublico, leerDefinicionGuion } from '../lib/creaciones-guion';
import { disenoParaPublico, leerDefinicionDiseno, resumenDiseno } from '../lib/creaciones-diseno';
import { propsNuevas } from '../lib/copywriter/tipos';

const NEGOCIO: NegocioQueComparte = { nombres: ['Estudio Brújula Norte'], personas: ['Renata Villaseñor'] };
const FOTO = 'https://xyz.supabase.co/storage/v1/object/public/image-editor/ws77/subidas/renata.webp';

const GUION = definicionDeGuion(
  { titulo: 'Anuncio de Brújula Norte', emoji: '📣', tipo: 'ad' },
  {
    props: propsNuevas('ad', 'pas', { plantilla: 'pas' }),
    contenido: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2, bid: 'b1aaaaaaaa' }, content: [{ type: 'text', text: 'GANCHO' }] },
        { type: 'paragraph', attrs: { bid: 'b2aaaaaaaa' }, content: [
          { type: 'text', text: 'Soy Renata, de Estudio Brújula Norte. ' },
          { type: 'text', text: 'Agenda aquí', marks: [{ type: 'link', attrs: { href: 'https://agenda.brujulanorte.mx' } }] },
        ] },
      ],
    },
  },
);

const DISENO = {
  v: 1, titulo: 'Post de Brújula Norte',
  doc: {
    schemaVersion: 1, width: 1080, height: 1350, unit: 'px', meta: { marca: 'Estudio Brújula Norte' },
    pages: [
      { id: 'p1', name: 'Portada', background: { type: 'image', src: FOTO }, objects: [
        { id: 'o1', type: 'textbox', name: 'Titular', left: 80, top: 80, width: 900, text: 'ESTUDIO BRÚJULA NORTE: USD 2,750', fontSize: 64, fontFamily: 'Inter' },
        { id: 'o2', type: 'image', name: 'Foto', src: FOTO, left: 100, top: 400, width: 500, height: 400, scaleX: 1.5, scaleY: 2 },
        { id: 'g1', type: 'group', objects: [{ id: 'o3', type: 'image', src: FOTO, left: 0, top: 0, width: 10, height: 10 }] },
      ] },
    ],
  },
};

const todo = (x: unknown) => JSON.stringify(x);

test('un guion compartido no lleva el link ni los datos del negocio', () => {
  const r = definicionParaTodos(GUION, NEGOCIO, guionParaPublico);
  assert.ok(r.ok);
  const j = todo(r.ok && r.definicion);
  assert.ok(!j.includes('brujulanorte'), 'quedó el link');
  assert.ok(!/Brújula|Renata/i.test(j), 'quedó el negocio o su gente');
  assert.ok(!j.includes('"link"'), 'quedó la marca de link');
  assert.ok(leerDefinicionGuion(r.ok && r.definicion), 'la definición limpia sigue siendo un guion');
});

test('el guion conserva la FORMA: la sección, el tipo y la plantilla de MaKo', () => {
  const d = guionParaPublico(GUION) as typeof GUION;
  assert.equal(d.tipo, 'ad');
  assert.equal(d.props.plantilla, 'pas');
  assert.equal(d.contenido.content?.[0].content?.[0].text, 'GANCHO');
});

test('un diseño compartido cambia cada foto por un marco vacío del mismo tamaño', () => {
  const d = disenoParaPublico(DISENO) as typeof DISENO;
  const objs = d.doc.pages[0].objects as Array<Record<string, unknown>>;
  const marco = objs.find((o) => o.id === 'o2')!;
  assert.equal(marco.type, 'rect');
  assert.equal(marco.isPlaceholder, true);
  assert.equal(marco.width, 750);
  assert.equal(marco.height, 800);
  assert.equal(marco.left, 100);
  assert.ok(!('src' in marco));
  const deGrupo = (objs.find((o) => o.id === 'g1')!.objects as Array<Record<string, unknown>>)[0];
  assert.equal(deGrupo.type, 'rect', 'la foto adentro de un grupo también');
});

test('un diseño compartido no lleva fotos, fondos con foto ni la marca', () => {
  const d = disenoParaPublico(DISENO) as typeof DISENO;
  const j = todo(d);
  assert.ok(!j.includes('supabase.co'), 'quedó una foto');
  // `Object.hasOwn` y no `'meta' in`: el `in` estrecha el tipo a `never` después del assert y el tsc entero lo rechaza.
  assert.equal(Object.hasOwn(d.doc, 'meta'), false, 'quedó la marca del documento');
  assert.deepEqual(d.doc.pages[0].background, { type: 'solid', color: '#FFFFFF' });
});

test('todo junto: el diseño compartido no trae nada del negocio y sigue siendo un diseño', () => {
  const r = definicionParaTodos(DISENO, NEGOCIO, disenoParaPublico);
  assert.ok(r.ok);
  const j = todo(r.ok && r.definicion);
  for (const c of ['supabase.co', 'Brújula', 'BRÚJULA', 'USD 2,750']) assert.ok(!j.includes(c), `quedó «${c}»`);
  assert.ok(leerDefinicionDiseno(r.ok && r.definicion));
  assert.equal(resumenDiseno(r.ok && r.definicion)?.detalle, '1080 × 1350 · 1 página');
});

test('sin el paso del enchufe, la red no deja compartir un texto con el nombre del negocio', () => {
  const r = definicionParaTodos({ texto: 'x' }, NEGOCIO, () => ({ texto: 'Hola' }));
  assert.ok(r.ok);
  // La red mira lo que queda DESPUÉS de limpiar: un campo que no es texto (un número) no la engaña.
  const r2 = definicionParaTodos({ n: 3, t: 'Estudio Brújula Norte' }, NEGOCIO);
  assert.ok(r2.ok && !todo(r2.definicion).includes('Brújula'));
});

test('una definición que no es un guion o un diseño no se lee', () => {
  assert.equal(leerDefinicionGuion({ tipo: 'nada' }), null);
  assert.equal(leerDefinicionDiseno({ doc: { width: 0, height: 10, pages: [] } }), null);
  assert.equal(leerDefinicionDiseno({ doc: { width: 10, height: 10, pages: [{ objects: [{ src: 'blob:x' }] }] } }), null);
});
