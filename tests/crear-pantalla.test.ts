// =============================================================================
// UN solo diseño para las tabs de Create (29/10/2026): las reglas de la pantalla y lo que nav.ts no puede volver a tener
// =============================================================================
// Martín, 29/10/2026: «para todas las secciones de "create" no quiero otras tabs… En todas las tabs el mismo diseño de la
// barra lateral del chat de MaKo SIEMPRE abierto a la izquierda… En "nueva"… TEMPLATES con la sección de ¿Qué vas a crear
// hoy?». La pieza es app/_crear/PantallaCrear.tsx; esto fija:
//   1. las reglas puras (buscar, qué ocupa el centro, el marco de una plantilla, «hace cuánto»);
//   2. que un ítem de Create no vuelve a tener `secciones` (las pestañas de arriba), salvo los que FALTAN, cada uno con el
//      chat que lo hace: cada migración achica la lista (uno que ya no tiene y sigue anotado falla, para que se lo saque);
//   3. que los ítems de Video e Image siguen con la key que miran las capas y la API ('video-editor', 'image-editor');
//   4. que las páginas de Create montan la pantalla (con la misma lista de las que faltan).
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  cajaDeMiniatura, centroDe, chipsVisibles, haceCuanto, hojaDe, marcoDe, normalizar, proporcion, proyectosVisibles, seccionesDeCrear,
  type PlantillaCrear,
} from '@/app/_crear/reglas';
import { NO_TENGO_PREGUNTAME, primerMensajeDeEjemplo, rotuloDeEjemplo, type TabConEjemplo } from '@/app/_crear/ejemplo';
import { PREGUNTA_DE_ACCION } from '@/lib/aperturas/reglas';
import { TarjetaPlantilla } from '@/app/_crear/TarjetaPlantilla';
import { FAMILIAS } from '@/app/_components/nav';
import { problemasDelEjemplo } from './_reales';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');

const PROYECTOS = [
  { id: '1', nombre: 'Reel de lanzamiento' },
  { id: '2', nombre: 'Anuncio café' },
  { id: '3', nombre: '' },
];

test('buscar: sin tildes ni mayúsculas, y en el orden en que vinieron', () => {
  assert.equal(normalizar('  Reél DE Lanzamiento '), 'reel de lanzamiento');
  assert.deepEqual(proyectosVisibles(PROYECTOS, '').map((p) => p.id), ['1', '2', '3']);
  assert.deepEqual(proyectosVisibles(PROYECTOS, 'CAFÉ').map((p) => p.id), ['2']);
  // Uno sin nombre se busca por lo que se ve: «Sin título».
  assert.deepEqual(proyectosVisibles(PROYECTOS, 'sin tit').map((p) => p.id), ['3']);
  assert.deepEqual(proyectosVisibles(PROYECTOS, 'nada que ver'), []);
});

test('el centro: sin pieza abierta es «¿Qué vas a crear hoy?»; con pieza, «Nuevo …» lo trae encima', () => {
  assert.equal(centroDe(false, false), 'nueva');
  assert.equal(centroDe(false, true), 'nueva');
  assert.equal(centroDe(true, false), 'pieza');
  assert.equal(centroDe(true, true), 'nueva');
});

test('el marco de una plantilla sin imagen: lo ancho se mide por el ancho y lo alto por el alto', () => {
  assert.equal(proporcion('9 / 16'), 9 / 16);
  assert.equal(proporcion('1080/1350'), 1080 / 1350);
  assert.equal(proporcion('roto'), 1);
  assert.equal(proporcion(undefined), 1);
  assert.equal(proporcion('0 / 5'), 1);
  assert.deepEqual(marcoDe('16 / 9'), { width: '62%', aspectRatio: String(16 / 9), maxWidth: 'none' });
  assert.deepEqual(marcoDe('9 / 16'), { height: '62%', aspectRatio: String(9 / 16), maxWidth: 'none' });
  assert.ok('height' in marcoDe('1 / 1'), 'un cuadrado es más alto que 4:3: va por el alto');
});

// ── Plantillas reales (29/10/2026, docs/plantillas-reales/README.md, tanda 0): la tarjeta muestra el EJEMPLO ──────────

test('la imagen de una plantilla, a su proporción (una historia ya no se recorta al tercio del medio)', () => {
  assert.equal(cajaDeMiniatura(undefined), null, 'sin formato, la imagen llena la caja como antes');
  assert.equal(cajaDeMiniatura('  '), null);
  assert.deepEqual(cajaDeMiniatura('9 / 16'), { height: '90%', aspectRatio: String(9 / 16), maxWidth: 'none', objectFit: 'contain' });
  assert.deepEqual(cajaDeMiniatura('16 / 9'), { width: '90%', aspectRatio: String(16 / 9), maxWidth: 'none', objectFit: 'contain' });
  assert.ok('height' in (cajaDeMiniatura('1 / 1') ?? {}), 'un cuadrado es más alto que 4:3: va por el alto');
});

test('los chips: los primeros tres y «+N»; los vacíos no cuentan', () => {
  assert.deepEqual(chipsVisibles(['Gancho', 'Problema', 'Agitación', 'Solución', 'Prueba', 'CTA']), ['Gancho', 'Problema', 'Agitación', '+3']);
  assert.deepEqual(chipsVisibles(['USD 1,500', 'Garantía', '15 lugares']), ['USD 1,500', 'Garantía', '15 lugares'], 'tres entran enteros');
  assert.deepEqual(chipsVisibles([' a ', '', '  ', 'b']), ['a', 'b']);
  assert.deepEqual(chipsVisibles(['a', 'b', 'c'], 1), ['a', '+2']);
  assert.deepEqual(chipsVisibles(undefined), []);
});

test('las secciones de la grilla: una por grupo, en el orden en que aparecen', () => {
  const pl = (id: string, grupo?: string): PlantillaCrear => ({ id, nombre: id, grupo });
  assert.deepEqual(seccionesDeCrear([]), []);
  // Sin grupos, una sola sección con el título de la grilla (null): se ve como antes.
  assert.deepEqual(seccionesDeCrear([pl('a'), pl('b')]), [{ titulo: null, plantillas: [pl('a'), pl('b')] }]);
  const s = seccionesDeCrear([pl('f1', 'Tus funnels'), pl('p1', 'Programas'), pl('s1', 'Servicios'), pl('p2', 'Programas'), pl('x'), pl('f2', ' Tus funnels ')]);
  assert.deepEqual(s.map((x) => [x.titulo, x.plantillas.map((p) => p.id)]), [
    ['Tus funnels', ['f1', 'f2']], ['Programas', ['p1', 'p2']], ['Servicios', ['s1']], [null, ['x']],
  ]);
});

test('la hoja: el primer renglón es el título; con la frase (AI Avatar), el extracto es el título', () => {
  assert.equal(hojaDe({}), null, 'sin extracto no hay hoja');
  assert.equal(hojaDe({ extracto: ' \n ' }), null);
  assert.deepEqual(hojaDe({ extracto: 'Si haces llamadas de venta y escuchas «lo voy a pensar»…' }),
    { titulo: null, cuerpo: 'Si haces llamadas de venta y escuchas «lo voy a pensar»…' });
  assert.deepEqual(hojaDe({ extracto: 'Cierre Consultivo: 90 días\nEn 90 días aprendes a llevar\nuna llamada de diagnóstico.' }),
    { titulo: 'Cierre Consultivo: 90 días', cuerpo: 'En 90 días aprendes a llevar una llamada de diagnóstico.' });
  assert.deepEqual(hojaDe({ extracto: 'NO ES TU PRECIO', frase: 'Te cuento lo que me pasó en el auto.' }),
    { titulo: 'NO ES TU PRECIO', cuerpo: '«Te cuento lo que me pasó en el auto.»' });
});

test('el ejemplo se dice igual en las cinco tabs: el rótulo y el primer mensaje, sin IA', () => {
  assert.equal(rotuloDeEjemplo('Pulso Dental'), 'Ejemplo: Pulso Dental (negocio ficticio)');
  const tabs: TabConEjemplo[] = ['copywriter', 'video', 'image', 'avatar', 'offer'];
  for (const tab of tabs) {
    const m = primerMensajeDeEjemplo(tab, 'Cierre Consultivo');
    assert.match(m.texto, /^Es un ejemplo de Cierre Consultivo, un negocio ficticio\. /, `${tab}: la primera frase es la común`);
    assert.deepEqual(problemasDelEjemplo(m.texto), [], `${tab}: el mensaje no está en español neutro`);
    if (tab === 'offer') {
      // La excepción: adaptar empieza por el documento de la oferta, y su único botón es «No tengo, pregúntame».
      assert.match(m.texto, /¿tienes un documento, tu guion de ventas o el link de tu web\? Súbelo o pégalo aquí\.$/);
      assert.deepEqual(m.botones, [NO_TENGO_PREGUNTAME]);
    } else {
      // Desde el 5/11/2026 pregunta la OFERTA (un hecho), no «¿Lo adapto a tu negocio?» (una acción: plan.md T4).
      assert.match(m.texto, /¿Qué vas a vender con esto\?$/, `${tab}: sin ofertas, qué va a vender`);
      assert.doesNotMatch(m.texto, PREGUNTA_DE_ACCION, `${tab}: pregunta un hecho`);
      assert.equal(m.botones.at(-1), tab === 'copywriter' ? 'Solo la estructura' : tab === 'avatar' ? 'Ver el ejemplo completo' : 'Lo edito yo');
    }
  }
  const dos = [{ id: 12, nombre: 'Mentoría 1 a 1' }, { id: 7, nombre: 'Taller grupal' }];
  const conDos = primerMensajeDeEjemplo('copywriter', 'Pulso Dental', dos);
  assert.equal(conDos.texto, 'Es un ejemplo de Pulso Dental, un negocio ficticio. ¿Para cuál de tus ofertas es?');
  assert.deepEqual(conDos.botones, ['Mentoría 1 a 1', 'Taller grupal', 'Solo la estructura'], 'las ofertas primero, el de la tab al final');
  assert.match(primerMensajeDeEjemplo('video', 'x', [dos[0]]).texto, /¿Es para «Mentoría 1 a 1»\?$/);
  assert.deepEqual(primerMensajeDeEjemplo('avatar', 'x', dos).botones.at(-1), 'Ver el ejemplo completo');
});

const tarjeta = (pl: PlantillaCrear, extra: { miniatura?: (p: PlantillaCrear, activa: boolean) => unknown } = {}) =>
  renderToStaticMarkup(createElement(TarjetaPlantilla, {
    pl, activa: false, usando: null, onUsar: () => {}, onActiva: () => {},
    miniatura: extra.miniatura as ((p: PlantillaCrear, activa: boolean) => null) | undefined,
  }));

test('la tarjeta: sin los campos nuevos se ve como antes; con el ejemplo, la hoja, los chips y la cinta', () => {
  // Una tab que no pasa nada nuevo: el marco del formato con su rótulo, sin hoja, sin cinta y sin `title`.
  const antes = tarjeta({ id: 'r', nombre: 'Reel', formato: '9 / 16', rotulo: '15 s' });
  assert.match(antes, /class="cr-plantilla__marco"/);
  assert.match(antes, /class="cr-plantilla__rotulo">15 s</);
  assert.doesNotMatch(antes, /cr-plantilla__hoja|cr-plantilla__cinta|cr-plantilla__insignia|title=/);
  assert.match(antes, /aria-label="Usar la plantilla Reel"/);

  const con = tarjeta({
    id: 'pas', nombre: 'Anuncio a cámara (PAS)', insignia: '📣 Anuncio · 45 s', ayuda: 'Tráfico frío: nombra el problema',
    ejemplo: 'Cierre Consultivo', extracto: 'Si haces llamadas de venta y escuchas «lo voy a pensar»…',
    chips: ['Gancho', 'Problema', 'Agitación', 'Solución', 'CTA'], formato: '9 / 16', rotulo: '45 s',
  });
  assert.match(con, /<button[^>]*title="Tráfico frío: nombra el problema"/, 'cuándo usarla va como title');
  assert.match(con, /class="cr-plantilla__hoja"/);
  assert.match(con, /class="cr-plantilla__extracto">Si haces llamadas/);
  assert.equal([...con.matchAll(/class="cr-plantilla__chip"/g)].length, 4, 'tres chips y «+2»');
  assert.match(con, />\+2</);
  assert.match(con, /class="cr-plantilla__insignia" title="📣 Anuncio · 45 s">📣 Anuncio · 45 s</);
  assert.match(con, /class="cr-plantilla__cinta" title="Ejemplo: Cierre Consultivo \(negocio ficticio\)">Ejemplo</);
  assert.doesNotMatch(con, /cr-plantilla__marco|cr-plantilla__rotulo/, 'con la hoja, ni el marco vacío ni el rótulo');
});

test('la tarjeta: la imagen a su proporción, y la miniatura propia de una tab en lugar de todo', () => {
  const img = tarjeta({ id: 'h', nombre: 'Historia', imagen: '/cv/plantillas/h.webp', formato: '9 / 16' });
  assert.match(img, /<img src="\/cv\/plantillas\/h\.webp" alt="" loading="lazy" style="height:90%;aspect-ratio:0\.5625;max-width:none;object-fit:contain" data-caja="si"\/>/);
  const sinFormato = tarjeta({ id: 'v', nombre: 'Vieja', imagen: '/x.webp' });
  assert.match(sinFormato, /<img src="\/x\.webp" alt="" loading="lazy"\/>/, 'sin formato, como antes');

  const propia = tarjeta({ id: 'y', nombre: 'YouTube', extracto: 'algo', insignia: 'Sugerida · 24 s · 1 clip' },
    { miniatura: (p, activa) => createElement('canvas', { 'data-plantilla': p.id, 'data-activa': String(activa) }) });
  assert.match(propia, /<canvas data-plantilla="y" data-activa="false">/);
  assert.doesNotMatch(propia, /cr-plantilla__hoja/, 'la de la tab va en lugar de la hoja');
  assert.match(propia, /cr-plantilla__insignia/, 'la insignia va encima igual');
  // Una tab que devuelve null para una plantilla: esa usa lo de siempre.
  assert.match(tarjeta({ id: 'z', nombre: 'Z', extracto: 'algo' }, { miniatura: () => null }), /cr-plantilla__hoja/);
});

test('NuevaCrear: una sección por grupo con la tarjeta de ejemplo, y el CSS que la dibuja', () => {
  const src = leer('app/_crear/PantallaCrear.tsx');
  assert.match(src, /const secciones = useMemo\(\(\) => seccionesDeCrear\(plantillas\), \[plantillas\]\);/);
  assert.match(src, /<h2 id=\{`\$\{idGrilla\}-\$\{i\}`\} className="cr-plantillas__titulo">\{s\.titulo \?\? titulo\}<\/h2>/);
  assert.match(src, /<TarjetaPlantilla key=\{pl\.id\} pl=\{pl\} activa=\{activa === pl\.id\}[^>]*miniatura=\{miniatura\}/);
  assert.match(src, /miniatura=\{p\.miniatura\}/, 'PantallaCrear no le pasa la miniatura de la tab');
  const css = leer('app/_crear/crear.css');
  // La regla vieja (`object-fit: cover` al 100 %) se queda para la imagen SIN formato; con formato, un lado manda.
  assert.match(css, /\.cr-plantilla__mini img\[data-caja\] \{ width: auto; height: auto;/);
  assert.match(css, /\.cr-plantilla__chips \{[^}]*max-height: 18px; overflow: hidden;/, 'un chip que no entra se va entero');
  // La hoja se achica con SU tarjeta: los renglones ceden por `@container` (la grilla decide el ancho, no la ventana).
  assert.match(css, /\.cr-plantilla__mini \{[^}]*container-type: inline-size;/);
  // Con la fila `auto`, el 90 % de una imagen se medía contra su tamaño natural (720 px): una franja recortada (banco, 29/10).
  assert.match(css, /\.cr-plantilla__mini \{[^}]*grid-template: minmax\(0, 1fr\) \/ minmax\(0, 1fr\);/);
  assert.match(css, /@container \(max-width: 165px\) \{[^@]*\.cr-plantilla__titular \+ \.cr-plantilla__extracto \{ display: none; \}/);
  assert.match(css, /@container \(max-width: 195px\) \{[^@]*\.cr-plantilla__mini\[data-hoja="si"\] \.cr-plantilla__insignia \{ display: none; \}/);
});

test('«hace cuánto»', () => {
  const ahora = Date.UTC(2026, 9, 29, 12, 0, 0);
  assert.equal(haceCuanto(null, ahora), '');
  assert.equal(haceCuanto(ahora - 20_000, ahora), 'recién');
  assert.equal(haceCuanto(ahora - 5 * 60_000, ahora), 'hace 5 min');
  assert.equal(haceCuanto(ahora - 3 * 3_600_000, ahora), 'hace 3 h');
  assert.equal(haceCuanto(ahora - 2 * 86_400_000, ahora), 'hace 2 d');
});

/** Los ítems de Create que TODAVÍA tienen pestañas arriba, con el chat que las saca. Sólo se achica. */
const FALTAN_SIN_SECCIONES: Readonly<Record<string, string>> = {
};

const create = FAMILIAS.find((f) => f.key === 'create');

test('Create: ningún ítem con pestañas arriba (`secciones`), salvo los anotados con su chat', () => {
  assert.ok(create, 'la familia Create existe');
  const items = [...create.bloques.flat(), ...(create.grupos ?? []).flatMap((g) => g.items)];
  for (const it of items) {
    const pendiente = FALTAN_SIN_SECCIONES[it.key];
    if (pendiente) {
      assert.ok(it.secciones?.length, `«${it.label}» ya no tiene secciones: sacalo de FALTAN_SIN_SECCIONES (lo hacía el ${pendiente})`);
      continue;
    }
    assert.equal(it.secciones, undefined, `«${it.label}» volvió a tener pestañas arriba: cada tab de Create es UNA pantalla (app/_crear/PantallaCrear.tsx)`);
  }
});

test('Create: Video e Image llevan la key que miran las capas y la API', () => {
  assert.ok(create);
  const items = create.bloques.flat();
  const video = items.find((it) => it.label === 'Video');
  const image = items.find((it) => it.label === 'Image');
  assert.equal(video?.key, 'video-editor');
  assert.equal(image?.key, 'image-editor');
  assert.equal(video?.href, '/video-editor');
  assert.equal(image?.href, '/image-editor');
  // Ni Reels ni Carousels, ni las «pronto» de Image, como ítem de Create.
  const keys = new Set(items.flatMap((it) => [it.key, ...(it.secciones ?? []).map((s) => s.key)]));
  for (const ida of ['reels', 'carousels', 'image-generator', 'thumbnails']) assert.ok(!keys.has(ida), `«${ida}» se deprecó (29/10/2026)`);
});

/** Las páginas de Create y si ya montan la pantalla. Las que faltan, con su chat. Sólo se achica. */
const PAGINAS_CREATE: Readonly<Record<string, string | null>> = {
  'app/video-editor/VideoEditorCliente.tsx': null,
  'app/image-editor/ImageEditorCliente.tsx': null,
  // AI Avatar (29/10/2026, el estudio de Higgsfield): AiAvatarCliente.tsx se fue y la pantalla es Estudio.tsx.
  'app/ai-avatar/Estudio.tsx': null,
};

test('Create: cada página monta PantallaCrear (salvo las anotadas con su chat)', () => {
  for (const [ruta, pendiente] of Object.entries(PAGINAS_CREATE)) {
    if (!existsSync(join(RAIZ, ruta))) continue;
    const usa = /from '@\/app\/_crear\/PantallaCrear'/.test(leer(ruta));
    if (pendiente) assert.ok(!usa, `${ruta} ya monta PantallaCrear: sacala de la lista (lo hacía el ${pendiente})`);
    else assert.ok(usa, `${ruta} no monta PantallaCrear: el chat de MaKo a la izquierda y «Nuevo …» con plantillas`);
  }
});
