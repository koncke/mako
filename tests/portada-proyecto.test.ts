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
  assert.ok(css.startsWith('center / cover no-repeat url("'));
  // Una comilla adentro cerraría el `url()` y lo que siguiera se leería como CSS. El
  // origen ya se validó, pero esto es lo que hace que el guard no dependa de eso.
  assert.equal(css.split('"').length - 1, 2, 'exactamente dos comillas: las del url()');
  const sucio = fondoPortada('https://picsum.photos/x"); background:red; a:url("', '#2F6FED');
  assert.equal(sucio.split('"').length - 1, 2);
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
  assert.match(cuerpo(PLAN_BOARD, 'function labelToRow('), /portada: l\.portada \?\? null/, 'la escritura');
});

test('la mitad del CLIENTE: las cuatro puertas', () => {
  // Cada una la tira en silencio. Son las mismas cuatro que ya se olvidaron con
  // `recurrente` (0164) y con el cliente (0172).
  assert.match(TIPOS, /\n  portada\?: string \| null;/, 'el tipo Label');
  assert.match(DESDE_TODO, /portada: c\.portada/, 'toLabel: la puerta de ENTRADA del tablero del cliente');
  assert.match(TODO, /\n  portada: string \| null;/, 'el tipo Categoria');
  assert.match(cuerpo(TODO, 'export const catRow = '), /c\.portada = /, 'catRow normaliza el vacío');
  assert.match(cuerpo(TODO, 'export async function editarCategoria('),
    /if \(patch\.portada !== undefined\) upd\.portada = /, 'el upd se arma campo por campo');
  assert.match(RUTA_TODO, /cliente_nombre\?: string \| null; portada\?: string \| null/, 'el tipo del patch ES la puerta');
  assert.match(RUTA_TODO, /recurrencia, cliente, portada\)/, 'el alta de un proyecto del cliente');
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
