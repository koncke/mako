// =============================================================================
// editor-landing-despublicar — lo que se dice ANTES de despublicar (Paquete 2 de la tanda 6)
// =============================================================================
// Lo que dejó la tanda 4 de la API: el resumen de `despublicar_landing` (lib/api-mako/areas/landing.run.ts)
// sólo nombraba la URL de MaKo y callaba dos cosas: que el DOMINIO PROPIO también deja de mostrarla, y que
// volver a publicar sube lo GUARDADO (el borrador), no lo que se despublicó. La parte de motor es
// `antesDeDespublicar` (lib/editor-landing/server.ts): devuelve { version, publicado_version,
// cambiosSinPublicar, dominio }. El texto del resumen y el runner son de la API.
//
// Lo que se EJECUTA: lo puro de lib/editor-landing/dominios-reglas.ts (`dominioQueSirve`, `dominioDeLectura`).
// Lo que se LEE como fuente (server.ts es server-only y habla con la base): que el dominio se lea APARTE y
// tolerando sólo la columna que falta, que la lectura nunca salga a Vercel ni al DNS (`estadoDominio` puede
// ESCRIBIR: verifica un pendiente), y que «el dominio también deja de mostrarla» sea cierto: lo que sirve el
// dominio (la página y el paso de pago) sale de la foto publicada, que despublicar borra.
//
// PROBADO ROMPIÉNDOLO (14/10/2026): ver el pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dominioDeLectura, dominioQueSirve } from '../lib/editor-landing/dominios-reglas';
import { cambiosSinPublicar, resumenAntesDeDespublicar } from '../lib/editor-landing/server-reglas';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** El cuerpo de una función exportada de un archivo (hasta la próxima declaración de primer nivel). */
function cuerpo(src: string, firma: string): string {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  const fin = src.slice(i + firma.length).search(/\n(?:export |async function |function |const |type |\/\/ ─)/);
  return fin < 0 ? src.slice(i) : src.slice(i, i + firma.length + fin);
}

test('el dominio que sirve una landing: sólo el VERIFICADO y bien formado', () => {
  assert.equal(dominioQueSirve({ dominio: 'promo.tunegocio.com', dominio_estado: 'verificado' }), 'promo.tunegocio.com');
  assert.equal(dominioQueSirve({ dominio: 'promo.tunegocio.com', dominio_estado: 'pendiente' }), null, 'un pendiente todavía no sirve nada');
  assert.equal(dominioQueSirve({ dominio: null, dominio_estado: null }), null);
  assert.equal(dominioQueSirve({ dominio: 'hola-mako.site', dominio_estado: 'verificado' }), null, 'uno de MaKo nunca es de un cliente');
  assert.equal(dominioQueSirve({ dominio: 'no es un dominio', dominio_estado: 'verificado' }), null);
  assert.equal(dominioQueSirve({ dominio: 12, dominio_estado: 'verificado' }), null);
  assert.equal(dominioQueSirve(null), null);
  assert.equal(dominioQueSirve(undefined), null);
});

test('la lectura aparte del dominio: tolera SÓLO la columna que falta (42703); otro error tira', () => {
  assert.equal(dominioDeLectura({ dominio: 'tunegocio.com', dominio_estado: 'verificado' }, null), 'tunegocio.com');
  assert.equal(dominioDeLectura(null, null), null, 'la fila ya no está: no hay dominio que nombrar');
  assert.equal(dominioDeLectura(null, { code: '42703', message: 'column landing_docs.dominio does not exist' }), null, 'sin la mig 0263');
  assert.throws(() => dominioDeLectura(null, { code: '57014', message: 'canceling statement due to statement timeout' }), /statement timeout/, '«no pude leer» no es «no tiene dominio»');
  assert.throws(() => dominioDeLectura(null, { message: '' }), /no pude leer el dominio/);
});

test('antesDeDespublicar: la versión y el dominio en dos lecturas, y nunca sale a Vercel ni al DNS', () => {
  const src = sinComentarios(leer('lib/editor-landing/server.ts'));
  const f = cuerpo(src, 'export async function antesDeDespublicar(ws: number, id: number): Promise<AntesDeDespublicar | null> {');
  // La versión: con publicado_at, o `cambiosSinPublicar` daría siempre false (lo mira primero).
  const cols = /leerFilaDoc\(ws, id, '([^']+)'\)/.exec(f)?.[1] ?? '';
  for (const c of ['version', 'publicado_at', 'publicado_version']) assert.ok(cols.split(/,\s*/).includes(c), `la lectura de la versión no trae ${c}`);
  assert.doesNotMatch(cols, /dominio/, 'el dominio NO va en el mismo select: sin la 0263 tiraría la lectura entera');
  // El dominio: aparte, de ESTE negocio, y por la regla que tolera sólo el 42703.
  assert.match(f, /\.select\('dominio, dominio_estado'\)\.eq\('workspace_id', ws\)\.eq\('id', id\)\.maybeSingle\(\);/);
  // Verificación de la tanda 6: la FORMA sale de la función pura (el test de abajo la ejecuta), y una
  // landing de otro negocio da null ANTES de cualquier otra lectura (sin eso, tiraba).
  const sinFila = f.indexOf('if (!f) return null;');
  assert.ok(sinFila > 0 && sinFila < f.indexOf('getTenantDb()'), 'una landing que no es de este negocio no da null antes de leer el dominio');
  assert.match(f, /return resumenAntesDeDespublicar\(f, dominioDeLectura\(data, error\)\);/);
  // Sólo LEE: nada de Vercel, el DNS ni escrituras.
  assert.doesNotMatch(f, /estadoDominio|comprobar|configVercel|resolveTxt|fetch\(|\.update\(|\.insert\(|\.delete\(|\.upsert\(/);
  assert.doesNotMatch(src, /import \{[^}]*\bestadoDominio\b[^}]*\} from '\.\/dominios'/, 'server.ts no trae la lectura que sale a Vercel');
  // La lista del Panel dice lo mismo: una sola definición de «el dominio que sirve».
  assert.match(src, /dominio: dominioQueSirve\(f\),/);
});

test('la forma de lo que devuelve antesDeDespublicar (se EJECUTA): cada versión en su campo', () => {
  // Verificación de la tanda 6 (rotura B1: cruzar `version` con `publicado_version` quedaba en verde aquí, en
  // editor-landing-server y en api-mako-landing-editor).
  assert.deepEqual(resumenAntesDeDespublicar({ version: 9, publicado_at: '2026-10-14T10:00:00Z', publicado_version: 7 }, 'promo.tunegocio.com'),
    { version: 9, publicado_version: 7, cambiosSinPublicar: true, dominio: 'promo.tunegocio.com' });
  assert.deepEqual(resumenAntesDeDespublicar({ version: 7, publicado_at: '2026-10-14T10:00:00Z', publicado_version: 7 }, null),
    { version: 7, publicado_version: 7, cambiosSinPublicar: false, dominio: null });
});

test('«volver a publicar sube el borrador»: cambiosSinPublicar compara la versión guardada con la publicada', () => {
  assert.equal(cambiosSinPublicar({ publicado_at: '2026-10-14T10:00:00Z', publicado_version: 3, version: 5 }), true);
  assert.equal(cambiosSinPublicar({ publicado_at: '2026-10-14T10:00:00Z', publicado_version: 5, version: 5 }), false);
  assert.equal(cambiosSinPublicar({ publicado_at: null, publicado_version: 3, version: 5 }), false, 'sin publicación no hay nada que despublicar');
});

test('es cierto que el dominio también deja de mostrarla: lo que sirve sale de la foto publicada, que despublicar borra', () => {
  const pub = sinComentarios(leer('lib/editor-landing/publicar.ts'));
  const despublicar = cuerpo(pub, 'export async function despublicar(idRaw: unknown): Promise<Resultado<\'despublicar\'>> {');
  assert.match(despublicar, /\.update\(\{ publicado: null, publicado_at: null, publicado_version: null \}\)/);
  for (const [archivo, firma] of [['lib/editor-landing/publicar.ts', 'export async function leerPublicado('], ['lib/editor-landing/pago-landing-server.ts', 'export async function leerLandingDePago(']] as const) {
    const f = cuerpo(sinComentarios(leer(archivo)), firma);
    assert.match(f, /if \(!f \|\| !f\.publicado \|\| !f\.sitio_activo \|\| f\.papelera_at\) return null;/, `${firma}: sin foto publicada no se sirve`);
  }
  const ruta = sinComentarios(leer('app/api/landing-generator/dominio/route.ts'));
  assert.match(ruta, /const sitio = await leerPublicado\(slug, ruta\);/, 'la página del dominio');
  assert.match(ruta, /const l = await leerLandingDePago\(slug\);/, 'el paso de pago del dominio');
});

// =============================================================================
// PROBADO ROMPIÉNDOLO (14/10/2026), una rotura por vez con un arnés en el scratchpad que guarda el archivo
// en memoria, lo rompe, corre ESTE archivo y lo reescribe (sha256 igual después). Base: 5 / 0.
//   · dominioQueSirve acepta un pendiente                        → 4 / 1 «el dominio que sirve una landing…»
//   · dominioDeLectura tolera cualquier error                    → 4 / 1 «la lectura aparte del dominio…»
//   · el dominio en el MISMO select que la versión               → 4 / 1 «antesDeDespublicar: …»
//   · la versión sin publicado_at (cambiosSinPublicar siempre false) → 4 / 1 «antesDeDespublicar: …»
//   · antesDeDespublicar ignora el error de la lectura           → 4 / 1 «antesDeDespublicar: …»
//   · el Panel con su propia definición del dominio              → 4 / 1 «antesDeDespublicar: …»
// Restaurado: 5 / 0.
// =============================================================================

// ── VERIFICACIÓN DE LA TANDA 6 (14/10/2026): PROBADO ROMPIÉNDOLO ──────────────────────────────
// Base: 6 / 0. Las dos que la verificación encontró en VERDE en los tres archivos:
//   B1 `version` y `publicado_version` cruzados → despublicar 5 / 1 «la forma de lo que devuelve…»;
//      editor-landing-server 25 / 0 y api-mako-landing-editor 25 / 0 (siguen sin verlo: lo ve ÉSTE)
//   B2 sin el `if (!f) return null;`            → despublicar 5 / 1 «antesDeDespublicar: …»; los otros dos, en verde
// Restaurado: 6 / 0.
