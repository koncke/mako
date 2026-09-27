// =============================================================================
// LA PORTADA: su catálogo, su guard de origen, y la CADENA de los seis lugares (mig 0173)
// =============================================================================
// «Quiero que la foto de perfil del cliente se pueda configurar y también el banner…
// Quiero que los proyectos también tengan portada» (27/09/2026).
//
// Dos cosas distintas se fijan acá, y la segunda es la que no se ve compilando:
//
//  1. EL SANEO, QUE ES UN GUARD DE SEGURIDAD. Una portada se dibuja adentro de un `url()`
//     de CSS y una foto de perfil adentro de un `<img>`, en el navegador de cualquiera que
//     abra la tab. Si el origen se comparara con `startsWith`,
//     `https://picsum.photos@evil.tld/x` pasaría — y su origen REAL es el del atacante.
//     AGENTS.md lo tiene medido («Un guard de ORIGEN se escribe con `origin`») y acá se
//     enumeran los cuatro parecidos.
//  2. LA CADENA DE LOS SEIS LUGARES. `BoardShell` es UNO y lo montan DOS tableros sobre
//     DOS tablas. Un campo nuevo son seis puertas —columna, dos mappers de lectura, dos de
//     escritura, el tipo del patch de la ruta y el `upd` del server— y cada una lo tira en
//     SILENCIO: el control se dibuja, la request contesta 200 y no se guarda nada. Ya se
//     pagó cuatro veces en este repo (prioridad, Quarter 0162, recurrencia 0164, cliente
//     0172). Ninguna de estas seis las ve el compilador.
//
// ⚠️ PROBADO ROMPIÉNDOLO, UNA ROTURA POR VEZ. Base: **10 pasan, 0 fallan**
// (`node --import tsx --test tests/portada-proyecto.test.ts`). Cada línea es un cambio
// hecho a propósito en el código de producción, corrido, y revertido:
//
//  #  Qué se rompió                                                         Result.  Qué cayó
//  1  `urlDeImagenOk` comparando con `startsWith` en vez de `.origin`        9 / 1  «el guard de origen no se escribe con un prefijo»
//  2  `portada: r.portada …` fuera de `rowToLabel`                           9 / 1  «los DOS mappers del dueño la nombran»
//  3  `portada: l.portada ?? null` fuera de `labelToRow`                      9 / 1  «los DOS mappers del dueño la nombran»
//  4  `portada: c.portada` fuera de `toLabel`                                 9 / 1  «la mitad del CLIENTE: las cuatro puertas»
//  5  `if (patch.portada !== undefined)` fuera de `editarCategoria`           9 / 1  «la mitad del CLIENTE: las cuatro puertas»
//  6  `portada?: string | null` fuera del tipo del patch de `/api/todo`       9 / 1  «la mitad del CLIENTE: las cuatro puertas»
//  7  `portada: l.portada ?? null` fuera de `saveLabel` de TodoBoard          9 / 1  «la mitad del CLIENTE: las cuatro puertas»
//  8  `saneaPortada` devolviendo el `grad:` sin chequear el catálogo          9 / 1  «un degradado inventado no se guarda»
//
// Sin ese cuadro esto sería una afirmación, no una medición: un test verde sobre la
// propiedad equivocada es la forma más cara de estar seguro.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  GRADIENTES, cssGradiente, valorGradiente, fondoPortada,
  saneaPortada, urlDeImagenOk, esFoto,
  // mig 0174 — el encuadre y el ícono
  yPortada, saneaIcono,
} from '../lib/portadas';

const RAIZ = resolve(__dirname, '..');
const leer = (...p: string[]): string => readFileSync(resolve(RAIZ, ...p), 'utf8').replace(/\r/g, '');

const PLAN_BOARD = leer('lib', 'plan-board.ts');
const TODO = leer('lib', 'todo.ts');
const RUTA_TODO = leer('app', 'api', 'todo', 'route.ts');
const TODO_BOARD = leer('app', 'plan', 'TodoBoard.tsx');
const DESDE_TODO = leer('app', 'plan', 'board', 'desde-todo.ts');
const TIPOS = leer('app', 'plan', 'board', 'types.ts');
const MIG = leer('supabase', 'migrations', '0173_portadas_y_fotos.sql');

/** El cuerpo de una función, hasta la próxima declaración de nivel superior. */
function cuerpo(src: string, firma: string): string {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  const resto = src.slice(i + firma.length);
  const fin = resto.search(/\n(export |function |async function )/);
  return fin >= 0 ? resto.slice(0, fin) : resto;
}

// ── 1. EL SANEO ──────────────────────────────────────────────────────────────

test('el guard de origen no se escribe con un prefijo', () => {
  // Los cuatro parecidos. El segundo es el que importa: su origen REAL es `evil.tld`, así
  // que con un `startsWith` el navegador del cliente iría a buscar la imagen a un tercero.
  for (const u of [
    'https://picsum.photos.evil.tld/x.jpg',
    'https://picsum.photos@evil.tld/x.jpg',
    'https://picsum.photosevil.tld/x.jpg',
    'https://picsum.photos:8443/x.jpg',
  ]) {
    assert.equal(urlDeImagenOk(u), null, u);
    assert.equal(saneaPortada(u), null, u);
  }
  // Y el bueno sí pasa, o el guard estaría rechazando todo y el test no diría nada.
  assert.ok(urlDeImagenOk('https://picsum.photos/id/10/1600/420'));
});

test('sólo https, y nada de esquemas activos', () => {
  assert.equal(urlDeImagenOk('http://picsum.photos/id/10/1600/420'), null, 'http no');
  assert.equal(urlDeImagenOk('javascript:alert(1)'), null);
  assert.equal(urlDeImagenOk('data:image/png;base64,AAAA'), null);
  assert.equal(urlDeImagenOk('no soy una url'), null);
  assert.equal(urlDeImagenOk(''), null);
  assert.equal(urlDeImagenOk(null), null);
});

test('un degradado inventado no se guarda', () => {
  // `grad:` es un id de un catálogo cerrado. Uno que no está no se guarda a medias: se
  // descarta, que es volver al default — nunca una portada que no se puede dibujar.
  assert.equal(saneaPortada('grad:no-existe'), null);
  assert.equal(saneaPortada('grad:'), null);
  assert.equal(saneaPortada(valorGradiente(GRADIENTES[0])), valorGradiente(GRADIENTES[0]));
  assert.equal(saneaPortada('   '), null, 'el vacío es el default, no un valor');
  assert.equal(saneaPortada(42), null, 'lo que no es texto tampoco');
});

test('el catálogo no tiene ids repetidos y todos se pueden dibujar', () => {
  // Un id repetido haría que `grad:<id>` resuelva a uno de los dos según el orden del
  // array: el mismo valor guardado pintaría distinto el día que alguien reordene.
  assert.equal(new Set(GRADIENTES.map((g) => g.id)).size, GRADIENTES.length);
  for (const g of GRADIENTES) {
    assert.match(g.id, /^[a-z-]+$/, g.id);
    assert.ok(g.nombre.trim(), g.id);
    assert.ok(cssGradiente(g).includes(g.a) && cssGradiente(g).includes(g.b), g.id);
  }
});

test('sin portada NO es una portada rota: es el color derivado del nombre', () => {
  // El default tiene que seguir siendo lo que se veía antes de la 0173, o cada tarjeta ya
  // creada cambiaría de aspecto sin que nadie la tocara.
  for (const v of [null, undefined, '']) {
    const css = fondoPortada(v, '#2F6FED');
    assert.ok(css.includes('#2F6FED'), String(v));
    assert.ok(css.includes('color-mix'), String(v));
  }
  assert.equal(esFoto(null), false);
});

test('una foto se pinta adentro de url() y sin comillas que lo cierren', () => {
  const css = fondoPortada('https://picsum.photos/id/10/1600/420', '#2F6FED');
  // `center center` y no `center`: el segundo eje es el ENCUADRE (mig 0174) y sin
  // encuadre vale «centrado», que es lo que se veía antes.
  assert.ok(css.startsWith('center center / cover no-repeat url("'), css.slice(0, 40));
  // Una comilla adentro cerraría el `url()` y lo que siguiera se leería como CSS. El
  // origen ya se validó, pero esto es lo que hace que el guard no dependa de eso.
  assert.equal(css.split('"').length - 1, 2, 'exactamente dos comillas: las del url()');
  const sucio = fondoPortada('https://picsum.photos/x"); background:red; a:url("', '#2F6FED');
  assert.equal(sucio.split('"').length - 1, 2);
});

test('⚠️ EL ENCUADRE LLEGA AL CSS — si no, «Reposicionar» guarda y no se ve nada', () => {
  // Éste es el bug que la mig 0174 vino a evitar y que casi sale: `fondoPortada`
  // cableaba `center` y los SEIS lugares que dibujan una portada ignoraban la
  // posición. El botón habría funcionado —guardaba— y en pantalla no pasaba nada.
  const FOTO = 'https://picsum.photos/id/10/1600/420';
  assert.ok(fondoPortada(FOTO, '#2F6FED', 0).startsWith('center 0% /'), 'arriba de todo');
  assert.ok(fondoPortada(FOTO, '#2F6FED', 35).startsWith('center 35% /'), 'a 35');
  assert.ok(fondoPortada(FOTO, '#2F6FED', 100).startsWith('center 100% /'), 'abajo de todo');
  // `null` es «nadie lo movió», y se dibuja como siempre.
  assert.ok(fondoPortada(FOTO, '#2F6FED', null).startsWith('center center /'), 'sin encuadre');
  // Un número fuera de rango se acota acá y NO llega al CSS: la base tiene el mismo
  // CHECK, que es la segunda capa, pero la pantalla no puede depender de un round-trip.
  assert.ok(fondoPortada(FOTO, '#2F6FED', 9999).startsWith('center 100% /'), 'se acota');
  assert.ok(fondoPortada(FOTO, '#2F6FED', -50).startsWith('center 0% /'), 'se acota');
  // Y a un DEGRADADO el encuadre no lo toca: no hay imagen que mover.
  assert.ok(!fondoPortada('grad:indigo', '#2F6FED', 80).includes('80%'), 'un degradado no se encuadra');
});

test('el encuadre se sanea a un entero 0-100, y `null` NO es 50', () => {
  // «Nadie lo movió» y «lo dejó justo al medio» son dos hechos distintos: el primero
  // se puede reencuadrar solo el día que cambie el alto de la banda, el segundo no.
  assert.equal(yPortada(null), null);
  assert.equal(yPortada(undefined), null);
  assert.equal(yPortada(''), null);
  assert.equal(yPortada('no'), null);
  assert.equal(yPortada(NaN), null);
  assert.equal(yPortada(0), 0, 'CERO ES UN VALOR, no un vacío');
  assert.equal(yPortada(35.7), 36);
  assert.equal(yPortada('35'), 35);
  assert.equal(yPortada(-1), 0);
  assert.equal(yPortada(101), 100);
});

test('`saneaIcono` acepta el catálogo y una foto del bucket, y NADA más', () => {
  assert.equal(saneaIcono('icon:lucide:rocket'), 'icon:lucide:rocket');
  assert.equal(saneaIcono('https://picsum.photos/id/1/64'), 'https://picsum.photos/id/1/64');
  // ⚠️ UN EMOJI NO. Un glifo va en la columna `emoji`, que es la que leen el prompt de
  // reuniones, el export y la API de MaKo. Aceptarlo acá dejaría dos respuestas a
  // «¿qué se dibuja?» y la de texto se quedaría vieja.
  assert.equal(saneaIcono('🚀'), null);
  assert.equal(saneaIcono('icon:solar:rocket'), null, 'un set que pide atribución');
  assert.equal(saneaIcono('http://picsum.photos/x'), null, 'http pelado');
  assert.equal(saneaIcono('https://evil.tld/x.png'), null, 'un origen que no está en la lista');
  assert.equal(saneaIcono(''), null);
  assert.equal(saneaIcono(null), null);
});

// ── 2. LA CADENA ─────────────────────────────────────────────────────────────

test('la migración toca las DOS tablas de proyecto, no una', () => {
  // `BoardShell` es UNO y lo montan dos tableros. Con la columna en una sola mitad el
  // control se dibuja en las dos y guarda en una.
  assert.match(MIG, /alter table plan_proyectos\s+add column if not exists portada/);
  assert.match(MIG, /alter table tarea_categorias add column if not exists portada/);
  // Y el cliente, que es un lead ganado: no hay tabla de clientes.
  assert.match(MIG, /alter table leads add column if not exists avatar_url/);
  assert.match(MIG, /alter table leads add column if not exists portada/);
});

test('los DOS mappers del dueño la nombran', () => {
  // ⚠️ OLVIDARLA EN LA LECTURA ES DESTRUCTIVO, no inerte: `guardarPlanProyecto` sube la
  // fila ENTERA armada desde el navegador, así que un campo que la lectura no trae vuelve
  // como `undefined`, sale como `null` y BORRA la columna en el próximo guardado de
  // cualquier otro campo.
  assert.match(cuerpo(PLAN_BOARD, 'export function rowToLabel('), /portada: r\.portada/, 'la lectura');
  // ⚠️ Y LA ESCRITURA AHORA SANEA. Hasta el 27/09/2026 este camino ponía `l.portada ??
  // null` crudo, con un comentario que decía que «lo sanea quien recibe la elección» —
  // y medido, el ÚNICO call site de `saneaPortada` en todo el repo era el de la ficha
  // del cliente. O sea que por acá entraba cualquier `https://`: la portada de un
  // proyecto podía apuntar a un tercero y cargarse con el referer de quien abriera el
  // tablero, que es exactamente lo que `ORIGENES_OK` existe para impedir.
  assert.match(cuerpo(PLAN_BOARD, 'function labelToRow('), /portada: saneaPortada\(l\.portada\)/, 'la escritura SANEA');
});

test('la mitad del CLIENTE: las cuatro puertas', () => {
  // Cada una la tira en silencio. Son las mismas cuatro que ya se olvidaron con
  // `recurrente` (0164) y con el cliente (0172).
  assert.match(TIPOS, /\n  portada\?: string \| null;/, 'el tipo Label');
  assert.match(DESDE_TODO, /portada: c\.portada/, 'toLabel: la puerta de ENTRADA del tablero del cliente');
  assert.match(TODO, /\n  portada: string \| null;/, 'el tipo Categoria');
  assert.match(cuerpo(TODO, 'export const catRow = '), /c\.portada = /, 'catRow normaliza el vacío');
  assert.match(cuerpo(TODO, 'export async function editarCategoria('),
    /if \(patch\.portada !== undefined\) upd\.portada = saneaPortada/, 'el upd se arma campo por campo, y SANEA');
  assert.match(RUTA_TODO, /cliente_nombre\?: string \| null; portada\?: string \| null/, 'el tipo del patch ES la puerta');
  assert.match(RUTA_TODO, /recurrencia, cliente, portada, portadaY, icono\)/, 'el alta de un proyecto del cliente');
  // ⚠️ ANCLADO EN LA ACCIÓN, NO EN EL CAMPO DE AL LADO. La primera versión de estas dos
  // líneas se colgaba de `cliente_nombre: l.clienteNombre ?? null`, y se rompió al día
  // siguiente cuando ese campo ganó un `?? clienteFijo?.nombre` por otro motivo: un test
  // que falla por un cambio que no tiene nada que ver es ruido, y el ruido se termina
  // silenciando. Lo que este test persigue es que `portada` VIAJE en los dos payloads.
  assert.match(TODO_BOARD, /action: 'categoria-editar'[^;]*portada: l\.portada \?\? null/, 'saveLabel');
  assert.match(TODO_BOARD, /action: 'categoria-crear'[^;]*portada: l\.portada \?\? null/, 'createLabel');
});

test('`undefined` (no la toques) nunca se colapsa con `null` (sacala)', () => {
  // Si se colara un `?? null` en el patch del server, editar cualquier otro campo del
  // proyecto le borraría la portada sin que nadie la tocara.
  assert.ok(!/patch\.portada \?\? null/.test(TODO));
  assert.ok(!/patch\.portada \?\? null/.test(RUTA_TODO));
});

// =============================================================================
// mig 0174 — el ENCUADRE y el ÍCONO pasan por las MISMAS seis puertas
// =============================================================================
// Son el sexto y el séptimo campo que cruzan esta frontera, y el modo de falla no
// cambió en ninguna de las cinco anteriores (prioridad, Quarter 0162, recurrencia
// 0164, cliente 0172, portada 0173): el control se dibuja, la request contesta 200
// y no se guarda nada. Olvidarlo en la LECTURA es peor — el `upsert` sube la fila
// entera desde el navegador, así que lo que el mapper no trae vuelve `undefined`,
// sale `null` y BORRA la columna en el próximo guardado de cualquier otra cosa.

test('mig 0174 · el ENCUADRE (portada_y) cruza las seis puertas', () => {
  assert.match(TIPOS, /^ {2}portadaY\?: number \| null;$/m, 'el tipo Label');
  assert.match(cuerpo(PLAN_BOARD, 'export function rowToLabel('), /portadaY: yPortada\(r\.portada_y\)/, 'lectura del dueño');
  assert.match(cuerpo(PLAN_BOARD, 'function labelToRow('), /portada_y: yPortada\(l\.portadaY\)/, 'escritura del dueño');
  assert.match(DESDE_TODO, /portadaY: c\.portada_y/, 'toLabel: la entrada del tablero del cliente');
  assert.match(TODO, /^ {2}portada_y: number \| null;$/m, 'el tipo Categoria');
  assert.match(cuerpo(TODO, 'export const catRow = '), /c\.portada_y = /, 'catRow');
  assert.match(cuerpo(TODO, 'export async function editarCategoria('),
    /if \(patch\.portada_y !== undefined\) upd\.portada_y = /, 'el upd del cliente');
  assert.match(RUTA_TODO, /portada\?: string \| null; portada_y\?: number \| null/, 'el tipo del patch ES la puerta');
  assert.match(TODO_BOARD, /action: 'categoria-editar'[^;]*portada_y: l\.portadaY \?\? null/, 'saveLabel');
  assert.match(TODO_BOARD, /action: 'categoria-crear'[^;]*portada_y: l\.portadaY \?\? null/, 'createLabel');
});

test('mig 0174 · el ÍCONO cruza las seis, y NO se guarda en `emoji`', () => {
  assert.match(TIPOS, /^ {2}icono\?: string \| null;$/m, 'el tipo Label');
  assert.match(cuerpo(PLAN_BOARD, 'export function rowToLabel('), /icono: r\.icono/, 'lectura del dueño');
  assert.match(cuerpo(PLAN_BOARD, 'function labelToRow('), /icono: saneaIcono\(l\.icono\)/, 'escritura del dueño, saneada');
  assert.match(DESDE_TODO, /icono: c\.icono/, 'toLabel');
  assert.match(TODO, /^ {2}icono: string \| null;$/m, 'el tipo Categoria');
  assert.match(cuerpo(TODO, 'export const catRow = '), /c\.icono = /, 'catRow');
  assert.match(cuerpo(TODO, 'export async function editarCategoria('),
    /if \(patch\.icono !== undefined\) upd\.icono = saneaIcono/, 'el upd del cliente');
  assert.match(RUTA_TODO, /portada_y\?: number \| null; icono\?: string \| null/, 'la puerta');
  assert.match(TODO_BOARD, /action: 'categoria-editar'[^;]*icono: l\.icono \?\? null/, 'saveLabel');
  assert.match(TODO_BOARD, /action: 'categoria-crear'[^;]*icono: l\.icono \?\? null/, 'createLabel');
});

test('⚠️ EL ÍCONO NO PUEDE TERMINAR EN LA COLUMNA `emoji`', () => {
  // Es la razón de existir de la columna nueva, y está medida: `lib/todo.ts` trunca
  // `emoji` a CUATRO caracteres, así que una URL ahí queda en «http» — con 200 y sin
  // un solo error. La mitad del dueño NO trunca, o sea que el mismo componente
  // guardaría bien en un tablero y destruiría en el otro.
  assert.match(TODO, /upd\.emoji = \(patch\.emoji \|\| '🏷'\)\.slice\(0, 4\)/,
    'si esto deja de estar, releé por qué existe `icono` antes de festejar');
  // Y los payloads del navegador mandan el ícono en SU campo, no en el del emoji.
  assert.ok(!/emoji: l\.icono/.test(TODO_BOARD), 'el ícono se está colando en `emoji`');
});
