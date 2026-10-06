// =============================================================================
// conocimientos-compartir — el botón de compartir POR CURSO del portal de cursos
// =============================================================================
// Lo que se LEE como fuente (sin comentarios): app/conocimientos/{Compartir,CursoPortal,
// CursoReplica}.tsx y app/compartido/[token]/PortalCompartido.tsx. No hay nada puro que
// ejecutar acá: lo que falló son CABLEADOS y una regla de apilamiento, y las dos viven en
// JSX. Por eso los asserts se escriben sobre el BLOQUE que importa y nunca sobre el
// archivo entero — un `cmp-ov` o un `compartir` suelto aparece en media docena de lugares
// y un guard que mire el archivo completo da verde sobre los cinco bugs de abajo.
//
// Por qué existe este archivo, y es el caso que más cuesta ver: el 06/10/2026 Martín
// reportó «me falta el botón de compartir con link cada curso, no solo todos los cursos».
// Leer el código contestaba que YA ESTABA: `Hub` dibuja `{compartir}` en su hero y
// `Conocimientos.tsx` se lo pasa a `CursoPortal`. Lo que no se veía en ninguna línea de
// ese camino es que el catálogo pone `replica: true` para TODOS los cursos, así que
// `CursoPortal` corta en `CursoReplica` antes de llegar al hub: el único call site de esa
// capacidad era CÓDIGO MUERTO, y adentro de un curso no había forma de compartirlo. Lo
// delató abrir un curso en el navegador y contar los botones, no leer el archivo.
//
// Probado ROMPIÉNDOLO (06/10/2026), una regla por vez y restaurando de MEMORIA (nunca con
// git: el árbol es compartido). Con todo en su lugar: 6 pass / 0 fail. Cada rotura tumba
// SU test y sólo el suyo:
//   · `CursoPortal` montando `<CursoReplica>` sin `compartir`         → 5 / 1 «la rama que se dibuja»
//   · `CursoReplica` sin el `{compartir}` de su barra                 → 5 / 1 «la barra del curso lo dibuja»
//   · `Selector` montando la tarjeta pelada (sin `compartirDe`)       → 5 / 1 «la grilla ofrece uno por curso»
//   · el control de la tarjeta metido ADENTRO del `<Card>`            → 5 / 1 «el control es HERMANO»
//   · `PortalCompartido` pasando `compartir` al portal                → 5 / 1 «la vista pública no re-comparte»
//   · el overlay devuelto inline en vez de por `createPortal`         → 5 / 1 «el modal cuelga del body»

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..');

/**
 * ⚠️ Los `\r\n` se normalizan ANTES de buscar. `core.autocrlf=true` deja el repo
 * MEZCLADO entre archivos —`CursoPortal.tsx` y el de al lado pueden tener saltos
 * distintos— así que un ancla copiada del propio archivo da «0 coincidencias» en un
 * worktree o en un clon nuevo, sobre un archivo idéntico.
 */
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');

/**
 * El fuente SIN comentarios, que es contra lo que se pregunta siempre.
 *
 * ⚠️ Las líneas `//` van ANTES que los bloques `/* *​/`: un `/*` que viva adentro de un
 * comentario de línea abriría un bloque que se cierra páginas después y se comería el
 * código del medio — dando verde sobre lo que nunca llegó a mirar. Y sólo las líneas que
 * ARRANCAN con `//`, para no partir un `https://` adentro de una cadena.
 *
 * Y hace falta en las DOS direcciones: la convención de esta casa es explicar en el
 * comentario lo que se arregló y CITAR el bug, así que los archivos de acá nombran
 * `compartir`, `createPortal` y `al-cardshare` en su prosa. Sin esto, el guard de «esto
 * NO está» se acusa a sí mismo y el de «esto SÍ está» pasa leyendo un comentario.
 */
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * El bloque que abre `desde` y termina en su CIERRE REAL, nunca en N caracteres.
 *
 * Un `slice(i, i + 800)` elegido a ojo es el mismo bug con otra cara: acá `compartir`
 * aparece en el `Hub` —que está a 600 líneas del `Selector`— y un recorte generoso haría
 * que un guard del selector pase leyendo el hub, que es el call site MUERTO. Además se
 * afirma el largo: si mañana mide el doble, está mirando otra cosa.
 */
function bloque(src: string, desde: string, hasta: string, topeLargo: number): string {
  const i = src.indexOf(desde);
  assert.ok(i > -1, `no encontré el ancla «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > -1, `no encontré el cierre «${hasta}» después de «${desde}»`);
  const b = src.slice(i, j + hasta.length);
  assert.ok(b.length <= topeLargo, `el bloque de «${desde}» mide ${b.length} y el tope es ${topeLargo}: está mirando otra cosa`);
  return b;
}

const PORTAL = sinComentarios(leer('app/conocimientos/CursoPortal.tsx'));
const REPLICA = sinComentarios(leer('app/conocimientos/CursoReplica.tsx'));
const COMPARTIR = sinComentarios(leer('app/conocimientos/Compartir.tsx'));
const PUBLICO = sinComentarios(leer('app/compartido/[token]/PortalCompartido.tsx'));

// ── El cableado que faltaba ─────────────────────────────────────────────────────────
test('la rama que se dibuja de verdad recibe el botón: CursoReplica lleva `compartir`', () => {
  // `replica: true` está en el catálogo para TODOS los cursos (no curso por curso), así
  // que este return es el ÚNICO camino de un curso abierto y el `Hub` de abajo nunca
  // corre. Si el prop no baja por acá, no hay botón de compartir adentro de ningún curso.
  assert.match(
    bloque(PORTAL, 'if (curso.replica)', '/>', 400),
    /<CursoReplica[^>]*\scompartir=\{compartir\}/,
    'CursoPortal corta en CursoReplica antes del Hub: si no le pasa `compartir`, la capacidad queda en código muerto',
  );

  // Y el flag es del catálogo entero, no de un curso: el día que deje de serlo, el Hub
  // vuelve a ser alcanzable y este test deja de ser el único que cubre el caso.
  const cat = sinComentarios(leer('app/conocimientos/catalogo.ts'));
  assert.match(cat, /\breplica:\s*true/, 'si `replica` dejó de estar en el catálogo, revisá qué rama dibuja un curso');
});

test('la barra del curso lo dibuja, y al lado del nombre del curso', () => {
  // La barra de arriba de CursoReplica: el buscador, el nombre del curso y el botón. El
  // cierre es lo que ABRE el bloque siguiente y no un `</div>` contado a mano: sacar los
  // comentarios cambia los saltos y la sangría, así que cualquier ancla que los incluya
  // encuentra el archivo del disco y no el que este test está leyendo.
  const barra = bloque(REPLICA, '<div className="ugc-topbar">', '<div className="ugc-content">', 1600);
  assert.match(barra, /\{compartir\s*&&/, 'el botón de compartir no se dibuja en la barra del curso');
  // Pegado a lo que NOMBRA: comparte ESTE curso, no la tab.
  assert.ok(
    barra.indexOf('ugc-topbar-curso') < barra.indexOf('{compartir'),
    'el botón va DESPUÉS del nombre del curso, que es lo que comparte',
  );
});

// ── La grilla ──────────────────────────────────────────────────────────────────────
test('la grilla ofrece uno por curso, y el control es HERMANO de la tarjeta', () => {
  const grilla = bloque(PORTAL, '<div className="al-grid">\n            {list.map', '</div>', 1400);

  assert.match(grilla, /compartirDe\(c\)/, 'la tarjeta de la grilla no monta el botón por curso');
  assert.match(grilla, /className="al-rescard-wrap"/, 'falta el envoltorio relativo que apoya el control sobre la tarjeta');

  // ⚠️ `Card` ES un `<button>`. Un botón adentro de otro no es HTML válido: el navegador
  // reparenta y el de adentro deja de recibir clicks — o sea un botón que existe, se ve,
  // está habilitado y no hace nada. Lo que lo fija es el ORDEN: el `<Card>` se cierra
  // antes de que empiece el control.
  const card = grilla.indexOf('<Card');
  const cierreCard = grilla.indexOf('/>', card);
  const control = grilla.indexOf('compartirDe(c)');
  assert.ok(card > -1 && cierreCard > -1 && control > cierreCard,
    'el control de compartir quedó ADENTRO del <Card>, que es un <button>: anidado no recibe clicks');

  // Sin `compartirDe` la tarjeta va pelada: una caja de más cambia el layout de la
  // grilla de la vista pública sin que nadie la haya pedido.
  assert.match(grilla, /if \(!compartirDe\)/, 'sin `compartirDe` la tarjeta tiene que ir sin envoltorio');
});

// ── Lo que NO va a la vista pública ─────────────────────────────────────────────────
test('la vista pública no re-comparte lo que te compartieron', () => {
  // Las dos puertas, en el fuente sin comentarios: el archivo EXPLICA en su cabecera que
  // no hay botón de Compartir, así que sin despejar la prosa este guard pasa siempre.
  assert.doesNotMatch(PUBLICO, /\bcompartir=/, 'PortalCompartido no puede pasar `compartir`');
  assert.doesNotMatch(PUBLICO, /\bcompartirDe=/, 'PortalCompartido no puede pasar `compartirDe`');
  // Y que no importe el componente por otro camino.
  assert.doesNotMatch(PUBLICO, /from '.*\/Compartir'/, 'PortalCompartido no importa el botón de Compartir');
});

// ── El apilamiento, que es lo que no da error ──────────────────────────────────────
test('el modal cuelga del body, no de donde vive el botón', () => {
  // `.cmp-ov` es `position: fixed; inset: 0; z-index: 120`, y eso promete la ventana
  // entera. Las dos cosas se las come cualquier ancestro posicionado: uno con `z-index`
  // abre un contexto de apilamiento y le clampea el 120 contra SU nivel, y uno con
  // `transform` pasa a ser el bloque contenedor del `fixed`, así que el `inset: 0` se
  // mide contra ÉSE. Los dos ancestros de este botón los tienen: el de la tarjeta es un
  // span absolute con z-index que se mueve en el hover, y la barra del curso es
  // `position: sticky; z-index: 20`.
  //
  // Medido sin el portal: el modal abría DETRÁS de las tarjetas de más abajo y el
  // navegador contestaba que «Cerrar» estaba visible y habilitado mientras el clic no le
  // llegaba nunca (`.al-rescard-resumen … intercepts pointer events`, 51 reintentos).
  // No hay error, no hay consola, y la pantalla se lee como un modal que no se cierra.
  const i = COMPARTIR.indexOf('createPortal((');
  assert.ok(i > -1, 'el overlay tiene que salir por createPortal: inline se lo come el apilamiento del ancestro');
  const cierre = COMPARTIR.indexOf('), document.body)', i);
  assert.ok(cierre > -1, 'el destino del portal es document.body');

  const dentro = COMPARTIR.slice(i, cierre);
  assert.match(dentro, /className="cmp-ov"/, 'lo que viaja al portal es el overlay, no otra cosa');

  // Y que no haya quedado una segunda copia del overlay fuera del portal.
  const fuera = COMPARTIR.slice(0, i) + COMPARTIR.slice(cierre);
  assert.doesNotMatch(fuera, /className="cmp-ov"/, 'hay un overlay dibujado fuera del portal');
});

test('el disparador compacto es el MISMO componente, con otro tamaño', () => {
  // Un «CompartirChico» aparte sería la copia que se queda vieja: acá ya pasó con el
  // contrato del `detalle`. Lo único que cambia es la clase del botón.
  assert.match(COMPARTIR, /compacto\?: boolean/, 'el modo compacto es un prop de Compartir');
  assert.match(COMPARTIR, /className=\{`cmp-btn\$\{compacto \? ' chico' : ''\}`\}/,
    'el modo compacto cambia la clase del disparador, no el componente');

  // Y dice «Compartir», no un ícono solo: en la esquina de una tarjeta un glifo suelto no
  // se entiende, y una palabra no viola ningún techo de texto de pantalla.
  const boton = bloque(COMPARTIR, 'className={`cmp-btn${compacto', '</button>', 500);
  assert.match(boton, />\s*Compartir\s*</, 'el disparador compacto sigue diciendo Compartir');
  // En la grilla el título del curso no está en el botón: lleva su `title` para que se
  // sepa QUÉ se comparte sin abrir el modal.
  assert.match(boton, /title=\{compacto \?/, 'el disparador compacto nombra el curso en su title');
});
