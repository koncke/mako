// =============================================================================
// conocimientos-compartir — el botón de compartir POR CURSO del portal de cursos
// =============================================================================
// Lo que se LEE como fuente (sin comentarios): app/conocimientos/{Compartir,CursoPortal,
// Conocimientos,EditorConocimientos,CursoConocimientos}.tsx, app/_cursos/CursoUgc.tsx y los dos
// componentes de app/compartido/[token]/. No hay nada puro que ejecutar acá: lo que falló son
// CABLEADOS y una regla de apilamiento, y las dos viven en JSX.
//
// ⚠️ 08/10/2026: CursoReplica.tsx se BORRÓ (Conocimientos monta el dibujo de los cursos,
// app/_cursos/CursoUgc.tsx, a través de app/conocimientos/CursoConocimientos.tsx) y los dos primeros
// tests se MUDARON con él: ahora siguen el botón por el camino nuevo, desde la pantalla del admin
// hasta la barra de arriba del dibujo. Un test que leyera el archivo viejo por su ruta daría verde
// sobre un archivo que ya no manda (AGENTS.md). Por eso los asserts se escriben sobre el BLOQUE que importa y nunca sobre el
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
// git: el árbol es compartido). Con todo en su lugar: 12 pass / 0 fail. Cada rotura tumba
// SU test y sólo el suyo (11 / 1 las catorce veces):
//   · `CursoPortal` montando `<CursoReplica>` sin `compartir`         → «la rama que se dibuja»
//   · `CursoReplica` sin el `{compartir}` de su barra                 → «la barra del curso lo dibuja»
//   · `Selector` montando la tarjeta pelada (sin `compartirDe`)       → «la grilla ofrece uno por curso»
//   · el control de la tarjeta metido ADENTRO del `<Card>`            → «el control es HERMANO»
//   · `PortalCompartido` pasando `compartir` al portal                → «la vista pública no re-comparte»
//   · el overlay devuelto inline en vez de por `createPortal`         → «el modal cuelga del body»
//   · `nombreDeShare` leyendo la etiqueta en vez del id               → «la fila dice QUÉ comparte»
//   · `nombreDeShare` pudiendo devolver cadena vacía                  → «la fila dice QUÉ comparte»
//   · la tab dejando de decir «Todos los cursos»                      → «la fila dice QUÉ comparte»
//   · el GET sin el `titulo` derivado por fila                        → «lo deriva el SERVER»
//   · el mail volviendo a `share.etiqueta`                            → «lo deriva el SERVER»
//   · el filtro volviendo a comparar el id crudo                      → «el filtro resuelve el slug canónico»
//   · la fila dibujando `s.etiqueta`                                  → «la fila dibuja el nombre derivado»
//   · el renglón sin ellipsis, o las visitas cediendo, o la columna sin `flex: 1`
//                                                                      → «el renglón recorta el título»
//   · un backtick (o un `${…}`) en CUALQUIERA de las dos hojas        → «NADA de backticks»
//
// 08/10/2026, al mudarse a CursoUgc (scratchpad/cono/romper.mjs, que deshace el reemplazo sobre el
// disco): sin romper 12 / 0, y cada rotura 11 / 1 en su test. Las dos primeras de la lista de arriba
// ya no existen (CursoReplica se borró); las reemplazan:
//   · Conocimientos montando el editor SIN `compartir`                → «la pantalla del admin arma el botón»
//   · el editor sin pasarle `topbarExtra` al curso                    → «la barra del curso lo dibuja»
//   · CursoCompartido llenando `topbarExtra`                          → «la vista pública no re-comparte»
// ⚠️ La primera versión del guard del admin buscaba con `[^>]*` y dio ROJO sobre el cableado sano:
//    `onFilas={(nuevas) => …}` tiene un `>` adentro y la clase se cortaba ahí. Va por `bloque`.
//
// ⚠️ DOS DE ESTOS GUARDS DIERON VERDE SOBRE SU PROPIO BUG antes de escribirse bien, y los
// dos fallos son de la misma familia — el universo del assert era más chico que la
// pregunta. El de los backticks miraba el fuente SIN comentarios (y lo prohibido vive
// justo ahí) y después miraba UNA de las dos hojas del archivo. Un guard que no se rompió
// a propósito es una afirmación.

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
const ADMIN = sinComentarios(leer('app/conocimientos/Conocimientos.tsx'));
const EDITOR = sinComentarios(leer('app/conocimientos/EditorConocimientos.tsx'));
const CURSO = sinComentarios(leer('app/conocimientos/CursoConocimientos.tsx'));
const DIBUJO = sinComentarios(leer('app/_cursos/CursoUgc.tsx'));
const COMPARTIR = sinComentarios(leer('app/conocimientos/Compartir.tsx'));
/** El fuente TAL CUAL, con sus comentarios. Lo usa un solo guard, y su porqué está escrito
 *  al lado: cuando lo prohibido es un CARÁCTER, los comentarios son el sujeto de la
 *  pregunta y despejarlos es mirar para otro lado. */
const COMPARTIR_CRUDO = leer('app/conocimientos/Compartir.tsx');
const PUBLICO = sinComentarios(leer('app/compartido/[token]/PortalCompartido.tsx'));
const UNO = sinComentarios(leer('app/compartido/[token]/CursoCompartido.tsx'));

// ── El cableado que faltaba ─────────────────────────────────────────────────────────
// (Mudado el 08/10/2026: antes seguía `compartir` por CursoPortal → CursoReplica, y el caso que lo
// originó —el `Hub` que lo dibujaba y no se alcanzaba nunca— se fue con esas dos.)
test('la pantalla del admin arma el botón de ESTE curso y se lo pasa al curso, edite o no', () => {
  // El botón comparte el curso ABIERTO: su slug, y su título de hoy (con lo que el super admin le cambió).
  assert.match(ADMIN, /const compartir = <Compartir recurso="curso" recursoId=\{base\.slug\} etiqueta=\{curso\.titulo\} \/>;/,
    'el botón de compartir del curso abierto no se arma');
  // Las DOS ramas lo reciben: la del editor (el super admin) y la de sólo lectura (si no se pudieron
  // leer los ajustes). Si una no lo pasa, ahí no hay forma de compartir el curso desde adentro.
  // El BLOQUE de cada elemento hasta su cierre, no un `[^>]*`: una flecha (`=>`) adentro de un prop
  // corta esa clase en el primer `>` y el guard daría rojo sobre un cableado sano.
  assert.match(bloque(ADMIN, '<EditorConocimientos', '/>', 600), /\scompartir=\{compartir\}/, 'el editor no recibe el botón');
  assert.match(bloque(ADMIN, '<CursoConocimientos', '/>', 800), /\stopbarExtra=\{compartir\}/, 'la vista de sólo lectura no recibe el botón');
});

test('la barra del curso lo dibuja, y al lado del nombre del curso', () => {
  // El editor lo pasa al curso, el curso al dibujo, y el dibujo lo pone en su barra de arriba.
  assert.match(bloque(EDITOR, '<CursoConocimientos', '/>', 600), /\stopbarExtra=\{compartir\}/, 'el editor no se lo pasa al curso');
  assert.match(bloque(CURSO, '<CursoUgc', '/>', 1600), /\stopbarExtra=\{topbarExtra\}/, 'el curso no se lo pasa al dibujo');
  // La barra de arriba del dibujo: el buscador, el hueco de la pantalla y el nombre del curso. El
  // cierre es lo que ABRE el bloque siguiente y no un `</div>` contado a mano: sacar los
  // comentarios cambia los saltos y la sangría, así que cualquier ancla que los incluya
  // encuentra el archivo del disco y no el que este test está leyendo.
  const barra = bloque(DIBUJO, '<div className="ugc-topbar">', '<div className="ugc-content">', 1600);
  assert.match(barra, /props\.topbarExtra != null && <div className="ugc-topbar-extra">\{props\.topbarExtra\}<\/div>/,
    'el botón de compartir no se dibuja en la barra del curso');
  // Pegado a lo que NOMBRA: comparte ESTE curso, no la tab. Con CursoReplica iba a la derecha del
  // nombre; el dibujo de los cursos lo pone a su izquierda (el mismo hueco que «Invitar alumnos»
  // en la tab Curso). Lo que importa es que entre los dos no se cuele nada.
  const hueco = barra.indexOf('ugc-topbar-extra');
  const nombre = barra.indexOf('ugc-topbar-curso');
  assert.ok(hueco > -1 && nombre > hueco, 'el botón va al lado del nombre del curso');
  assert.doesNotMatch(barra.slice(hueco, nombre), /<input|ugc-search/, 'entre el botón y el nombre del curso se coló otra cosa');
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
  // Los DOS componentes públicos: la tab entera y un curso suelto.
  for (const [nombre, src] of [['PortalCompartido', PUBLICO], ['CursoCompartido', UNO]] as const) {
    assert.doesNotMatch(src, /\bcompartir=/, `${nombre} no puede pasar compartir`);
    assert.doesNotMatch(src, /\bcompartirDe=/, `${nombre} no puede pasar compartirDe`);
    // Ni el hueco de la barra de arriba del curso, que es por donde entra el botón ahora.
    assert.doesNotMatch(src, /\btopbarExtra=/, `${nombre} no puede llenar la barra de arriba del curso`);
    // Y que no importe el componente por otro camino.
    assert.doesNotMatch(src, /from '.*\/Compartir'/, `${nombre} no importa el botón de Compartir`);
  }
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

// =============================================================================
// QUÉ comparte cada fila de «quién tiene acceso» (06/10/2026)
// =============================================================================
// Pedido de Martín: «Donde dice "Cualquiera con el enlace" debería decir también el título
// de lo que estoy compartiendo si es todos los cursos o uno en específico».
//
// Lo caro no fue el copy: fue de DÓNDE sale ese título. `shares.etiqueta` se escribe una
// sola vez en el insert y ningún update la vuelve a tocar, así que es la foto del día en
// que se emitió el link — y ya divergió en producción (el share id=4 dice «Curso
// AVATARHYPE» y ese curso hoy se llama «AvatarHype»). Por eso el nombre se DERIVA de la
// clave (recurso + recurso_id) y la etiqueta queda de respaldo.
//
// Y al medirlo apareció algo que no se había pedido: ese mismo share id=4 estaba VIVO, de
// invitados, con 13 visitas y su link funcionando, y NO LO LISTABA NINGÚN MODAL — el filtro
// comparaba el id crudo y `avatarhype` se había reemplazado por `creativos-ugc-realistas`,
// así que ninguna pantalla podía pasar ese id. No se podía ver ni revocar.

import { nombreDeShare, TODOS_LOS_CURSOS, SIN_NOMBRE } from '../lib/share-nombre';

const RUTA_COMPARTIR = sinComentarios(leer('app/api/compartir/route.ts'));

/** El resolvedor que la ruta le pasa en producción es `buscarCurso`. Acá va uno de
 *  mentira para no cargar los 132 cursos en un test — y además deja declarar el caso que
 *  importa: un slug REEMPLAZADO que resuelve al título del curso nuevo. */
const CATALOGO: Record<string, string> = {
  'claude-ai-rodrigo-rojo': 'Curso de Claude AI - Rodrigo Rojo',
  // `avatarhype` ya no está en la grilla: buscarCurso lo salta por REEMPLAZADOS y
  // devuelve el curso que lo absorbió, con su título de hoy.
  avatarhype: 'AvatarHype',
};
const resolver = (slug: string) => CATALOGO[slug];

test('nombreDeShare: la fila dice QUÉ comparte, con el nombre de hoy', () => {
  // La tab entera: no apunta a ninguna cosa (recurso_id null en las 17 filas de prod).
  assert.equal(
    nombreDeShare({ recurso: 'conocimientos', recurso_id: null, etiqueta: 'lo que sea' }, resolver),
    TODOS_LOS_CURSOS,
  );

  // Un curso: manda la CLAVE, no la foto. Este es el caso que ya divergió en producción.
  assert.equal(
    nombreDeShare({ recurso: 'curso', recurso_id: 'avatarhype', etiqueta: 'Curso AVATARHYPE' }, resolver),
    'AvatarHype',
    'el título sale del id resuelto, no de la etiqueta guardada',
  );

  // Y cuando coinciden, da lo mismo de dónde salga: tiene que seguir dando el título.
  assert.equal(
    nombreDeShare({ recurso: 'curso', recurso_id: 'claude-ai-rodrigo-rojo', etiqueta: 'viejo' }, resolver),
    'Curso de Claude AI - Rodrigo Rojo',
  );

  // Un curso que el catálogo ya no resuelve: la etiqueta es lo mejor que queda.
  assert.equal(
    nombreDeShare({ recurso: 'curso', recurso_id: 'borrado', etiqueta: 'Curso que ya no está' }, resolver),
    'Curso que ya no está',
  );

  // Branding: su id no lo resuelve ningún catálogo importable desde ahí.
  assert.equal(
    nombreDeShare({ recurso: 'branding', recurso_id: 'marca', etiqueta: 'Branding MaKo · La marca' }, resolver),
    'Branding MaKo · La marca',
  );

  // NUNCA vacío: una fila sin nombre en una lista es una fila que no se puede decidir si
  // revocar. Y una etiqueta de espacios no cuenta como nombre.
  assert.equal(nombreDeShare({ recurso: 'branding', recurso_id: 'x', etiqueta: '   ' }, resolver), 'x');
  assert.equal(nombreDeShare({ recurso: 'branding', recurso_id: null, etiqueta: null }, resolver), SIN_NOMBRE);
  assert.equal(nombreDeShare({ recurso: 'curso', recurso_id: null, etiqueta: null }, resolver), SIN_NOMBRE);
});

test('el nombre lo deriva el SERVER, y el mail lee el mismo', () => {
  // Del lado del server y no del navegador: resolverlo en el cliente obligaría a mandarle
  // el catálogo de cursos a quien abra el modal, y Compartir también viaja en
  // /compartido/[token]. Y sobre todo: con dos resolvedores, el modal y el mail dicen
  // cosas distintas de la MISMA fila.
  assert.match(RUTA_COMPARTIR, /titulo: nombreDeShare\(s, tituloDeCurso\)/,
    'cada fila del GET tiene que viajar con su nombre derivado');

  // ⚠️ El mail sale a un TERCERO. Pasarle `share.etiqueta` mandaba «Te compartieron: Curso
  // AVATARHYPE», un curso que no se llama más así.
  const sumar = bloque(RUTA_COMPARTIR, 'const invitados = await invitar(', ')', 200);
  assert.doesNotMatch(sumar, /share\.etiqueta/, 'el mail no puede mandar la etiqueta guardada');
  assert.match(sumar, /nombreDeShare\(share, tituloDeCurso\)/, 'el mail usa el mismo nombre que la fila');
});

test('el filtro resuelve el slug canónico: un share del slug viejo se puede ver y revocar', () => {
  // El bug: `todos.filter((s) => s.recurso_id === recursoId)` compara el string crudo, y
  // ninguna pantalla puede pasar el slug de un curso que ya no está en la grilla. Medido
  // en producción: 3 filas con recurso_id='avatarhype', una VIVA con 13 visitas, invisible
  // desde todos los modales.
  const get = bloque(RUTA_COMPARTIR, 'const todos = await listarShares', 'const conInvitados', 500);
  assert.doesNotMatch(get, /s\.recurso_id === recursoId/,
    'comparar el id crudo esconde los shares de un slug reemplazado');
  assert.match(get, /canonico\(recurso, s\.recurso_id\) === pedido/, 'el filtro compara slugs canónicos');

  // Y por los DOS lados: el reemplazo puede estar guardado en la fila o venir en el pedido.
  const can = bloque(RUTA_COMPARTIR, 'const canonico =', ';', 200);
  assert.match(can, /buscarCurso\(id\)\?\.slug/, 'el canónico sale de buscarCurso, que ya salta REEMPLAZADOS');
  assert.match(RUTA_COMPARTIR, /const pedido = canonico\(recurso, recursoId\)/, 'lo que pide la pantalla también se resuelve');
});

test('la fila dibuja el nombre derivado, nunca la etiqueta guardada', () => {
  // `.cmp-item-in` sólo contiene spans, así que el primer `</div>` que sigue ES su cierre.
  // Nada de anclas con sangría adentro: sacar los comentarios cambia los saltos, y entonces
  // el ancla encuentra el archivo del disco y no el que este test está leyendo.
  const fila = bloque(COMPARTIR, '<div className="cmp-item-in">', '</div>', 1800);
  assert.match(fila, /className="cmp-item-q" title=\{s\.titulo\}>\{s\.titulo\}/,
    'la fila nombra lo que comparte con el título derivado');
  assert.doesNotMatch(fila, /\{s\.etiqueta\}/, 'la etiqueta guardada es la foto: no se dibuja');
  // El nombre entero queda a mano aunque el renglón recorte.
  assert.match(fila, /title=\{s\.titulo\}/, 'el nombre completo va en el title del renglón');
});

test('el renglón recorta el título y nunca las visitas', () => {
  // El título más largo del catálogo son 82 caracteres y pide 431 px sobre un renglón de
  // 285 (medido en Chrome). Se declara QUIÉN CEDE en vez de acertarle a una cuenta.
  const css = bloque(COMPARTIR, '.cmp-item-m {', '.cmp-item-v {', 500);
  assert.match(css, /\.cmp-item-m \{[^}]*display: flex/, 'el renglón es un flex o no hay quién ceda');
  assert.match(css, /\.cmp-item-q \{[^}]*flex: 0 1 auto/, 'el que cede es el título');
  assert.match(css, /\.cmp-item-q \{[^}]*text-overflow: ellipsis/, 'y cede recortando, no envolviendo');
  assert.match(css, /\.cmp-item-q \{[^}]*white-space: nowrap/, 'sin nowrap el texto envuelve y la fila crece de alto');
  assert.match(COMPARTIR, /\.cmp-item-v \{ flex: none; \}/, 'las visitas van enteras: son el dato');

  // Sin `flex: 1` en la columna, el space-between del padre reparte el sobrante en DOS
  // huecos y uno queda ENTRE los dos botones (59,5 px medidos antes; 10 después).
  assert.match(COMPARTIR, /\.cmp-item-in \{[^}]*flex: 1/, 'la columna se lleva el sobrante o no hay qué recortar');
});

test('NADA de backticks adentro de la hoja de estilos', () => {
  // Esta hoja es un template literal: un backtick en un comentario la cierra a la mitad.
  // No es hipotético — pasó escribiendo el renglón de arriba, el 06/10/2026, con la regla
  // ya escrita en AGENTS.md. El síntoma no es un error de CSS: es el typecheck quejándose
  // de un token inesperado en una línea que no tiene nada que ver.
  //
  // ⚠️ ESTE GUARD ES EL ÚNICO QUE LEE EL FUENTE CRUDO, y la primera versión daba VERDE
  // sobre un backtick de verdad. El motivo es que lo prohibido vive JUSTAMENTE en los
  // comentarios, y `sinComentarios` los borra antes de que el assert los mire. Un
  // `doesNotMatch` se pregunta sin comentarios; éste es la excepción exacta, porque la
  // pregunta no es «¿qué hace este código?» sino «¿hay un carácter prohibido en el
  // archivo?» — y ahí los comentarios SON el sujeto. Probado rompiéndolo: con el fuente
  // despejado, insertar un backtick real daba 12 pass / 0 fail.
  //
  // ⚠️ Y LA SEGUNDA VERSIÓN TAMBIÉN DABA VERDE, por el otro lado: este archivo tiene DOS
  // bloques `<style jsx>` —el del avatar, de 324 caracteres, y el del modal, que es el
  // grande— y mirar `indexOf` era auditar el primero mientras el bug vivía en el segundo.
  // Un guard que mira UNA instancia de algo que aparece N veces es un cero perfectamente
  // correcto sobre la pregunta equivocada. Se recorren TODOS.
  const ABRE = '<style jsx>{';
  const hojas: string[] = [];
  for (let i = COMPARTIR_CRUDO.indexOf(ABRE); i > -1; i = COMPARTIR_CRUDO.indexOf(ABRE, i + 1)) {
    const desde = i + ABRE.length;
    const fin = COMPARTIR_CRUDO.indexOf('}</style>', desde);
    assert.ok(fin > -1, 'una hoja de estilos quedó sin cierre');
    // El primer y el último carácter son los backticks del literal; adentro no va ninguno.
    hojas.push(COMPARTIR_CRUDO.slice(desde, fin).replace(/^`/, '').replace(/`$/, ''));
  }
  assert.ok(hojas.length >= 2, `esperaba las dos hojas del archivo y encontré ${hojas.length}`);

  for (const [n, hoja] of hojas.entries()) {
    assert.equal((hoja.match(/`/g) || []).length, 0,
      `hoja ${n + 1}: un backtick adentro la parte al medio y se lleva medio componente`);
    assert.equal((hoja.match(/\$\{/g) || []).length, 0,
      `hoja ${n + 1}: una interpolación adentro la convierte en código, no en CSS`);
  }
});
