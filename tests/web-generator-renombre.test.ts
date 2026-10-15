// =============================================================================
// La tab «Landing Generator» pasó a llamarse «Web Generator» (15/10/2026): la ruta, la carpeta y el nombre
// =============================================================================
// Pedido de Martín (feedback de la tanda 6, punto 1), textual: «Quiero que todo se llame ahora
// "Web Generator", la ruta, en la sidebar, todo...»
//
// El molde es el renombre de /chatbot a /automations (tests/ruta-automations.test.ts) y el guard
// de /funnel (tests/funnel-estructura.test.ts). Lo que este archivo fija:
//   1. /landing-generator y TODO lo de abajo (/<id>, /crear, /analizar…) REDIRIGE al MISMO camino
//      bajo /web-generator con la query ENTERA: el link del editor que MaKo ya mandó por chat
//      (`/landing-generator/<id>?ws=N`) tiene que abrir ESA landing, no el Panel.
//   2. El alias /landing-writer va DIRECTO a /web-generator (sin el salto por /landing-generator).
//   3. Lo que se LEE dice «Web Generator» (el nav, la pestaña, MaKo Mobile, el onboarding, lo que
//      MaKo cuenta de la tab, la API de MaKo) y las CLAVES siguen iguales (la key `landing-writer`
//      del nav y del onboarding con sus pasos, el área `landing`, /api/landing-generator, el
//      registro de /admin/dev/landing-generator).
//   4. EL GUARD: nada del producto vuelve a enlazar la PÁGINA vieja. Se busca una CADENA que
//      ARRANQUE con `/landing-generator` (así no cazan /api/landing-generator ni
//      /admin/dev/landing-generator, que no se renombran), salteando los comentarios.
//   5. Y nada importa de la carpeta vieja: app/landing-generator es SÓLO el redirect.
//
// PROBADO ROMPIÉNDOLO (15/10/2026), una rotura por vez contra la base en verde de este archivo
// (7 pasan / 0 fallan), con un arnés que restaura DE MEMORIA y verifica con md5 (pasan / fallan):
//   · `href: '/landing-generator'` de vuelta en el item del nav                  → 5 / 2 (lo que se lee + guard)
//   · `linkPantalla(«/landing-generator/${id}», ws)` en la API de MaKo            → 6 / 1 (guard)
//   · `irDuro(«/landing-generator/${r.id}», ws)` en crear/Replicar.tsx            → 5 / 2 (guard + links de adentro)
//   · el redirect sin el camino (`destinoWebGenerator(undefined, …)`)             → 6 / 1 (redirect)
//   · `destinoWebGenerator` que pierde la query (devuelve la ruta pelada)         → 6 / 1 (destino)
//   · /landing-writer redirige a '/landing-generator' (el doble salto)            → 5 / 2 (alias + guard)
//   · un import `@/app/landing-generator/CajaPedido` en app/dashboard/NuevaHoja   → 6 / 1 (carpeta)
//   · el onboarding con `nombre: 'Landing Generator'`                             → 6 / 1 (lo que se lee)
//   · el teléfono sin las rutas viejas (`rutaMovil('/landing-writer')` = null)    → 6 / 1 (lo que se lee)
//   · un comentario `// … '/landing-generator/12' …` en lib/mako-capacidades.ts   → 7 / 0 (la prosa no es un link)
// Restaurado: 7 / 0.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, posix } from 'node:path';
import { RUTA_WEB_GENERATOR, RUTAS_VIEJAS_WEB_GENERATOR, destinoWebGenerator } from '../lib/ruta-web-generator';
import { FAMILIAS, itemsDe, ADMIN_NAV } from '../app/_components/nav';
import { tituloDe } from '../lib/titulo-tab';
import { TAB_ONBOARDINGS } from '../lib/tab-onboarding-catalogo';
import { rutaEscritorio, rutaMovil, SECCIONES_MAS } from '../lib/movil-rutas';
import { AREA_INFO } from '../lib/api-mako/tipos';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')   // las líneas PRIMERO (un `/*` adentro de un `//` abre un bloque falso)
  .replace(/\/\*[\s\S]*?\*\//g, '');

/** Los .ts/.tsx de `app/` y `lib/` (y proxy.ts) que están EN GIT (un archivo nuevo va con `git add -N`). */
function archivosDeProducto(): string[] {
  const todos = execFileSync('git', ['ls-files', 'app', 'lib', 'proxy.ts'], { cwd: RAIZ, encoding: 'utf8' })
    .split(/\r?\n/).map((f) => f.trim())
    .filter((f) => /\.tsx?$/.test(f) && !/\.d\.ts$/.test(f));
  // «No encontré nada que revisar» y «revisé y está todo bien» son respuestas DISTINTAS.
  assert.ok(todos.length > 500, `git ls-files devolvió ${todos.length} archivos: esto no corrió en el repo`);
  return todos;
}

/**
 * Las líneas de CÓDIGO de un fuente, con su número: sin las de comentario (`//`, `*`, `/*`, `{/*`)
 * ni las que siguen adentro de un bloque abierto al principio de una línea. Por línea y no con un
 * regex sobre el archivo entero: un `accept="image/*"` en el medio de una línea de código abriría un
 * bloque falso y escondería al guard todo lo que viene después.
 */
function lineasDeCodigo(src: string): Array<[number, string]> {
  const out: Array<[number, string]> = [];
  let enBloque = false;
  src.replace(/\r\n/g, '\n').split('\n').forEach((l, i) => {
    const t = l.trim();
    if (enBloque) { if (t.includes('*/')) enBloque = false; return; }
    if (/^(\/\/|\*)/.test(t)) return;
    if (/^(\{\s*)?\/\*/.test(t)) { if (!t.includes('*/')) enBloque = true; return; }
    out.push([i + 1, l]);
  });
  return out;
}

/**
 * Un LINK a la página vieja: `/landing-generator` ARRANCA una cadena (comillas o backtick) y sigue
 * con el fin de la cadena, `?`, `#` o un `/` (sus subrutas: `/<id>`, `/crear`, `/analizar`).
 * `/api/landing-generator/…` y `/admin/dev/landing-generator` arrancan con otra cosa: no cazan.
 */
const LINK_VIEJO = /['"`]\/landing-generator(['"`?#/]|$)/;

test('destinoWebGenerator: el MISMO camino bajo /web-generator, con la query ENTERA', () => {
  assert.equal(RUTA_WEB_GENERATOR, '/web-generator');
  assert.equal(destinoWebGenerator(undefined, {}), '/web-generator');
  assert.equal(destinoWebGenerator([], { ws: '3' }), '/web-generator?ws=3');
  // El link del editor que MaKo ya mandó: abre ESA landing, en ese negocio.
  assert.equal(destinoWebGenerator(['12'], { ws: '3' }), '/web-generator/12?ws=3');
  assert.equal(destinoWebGenerator(['crear'], { url: 'https://a.com/x', objetivo: 'agendar' }), '/web-generator/crear?url=https%3A%2F%2Fa.com%2Fx&objetivo=agendar');
  assert.equal(destinoWebGenerator(['analizar'], { diagnostico: '7', a: ['1', '2'] }), '/web-generator/analizar?diagnostico=7&a=1&a=2');
  // Nunca sale de /web-generator: los tramos van codificados y `.`/`..`/vacíos se descartan.
  assert.equal(destinoWebGenerator(['..', '..', 'admin'], {}), '/web-generator/admin');
  assert.equal(destinoWebGenerator(['a b', 'c/d'], {}), '/web-generator/a%20b/c%2Fd');
});

test('/landing-generator es SÓLO el redirect (un catch-all): al mismo camino, con `rutaConWs` y la query entera', () => {
  // Nada más vive en la carpeta vieja: los componentes se mudaron con `git mv` a app/web-generator.
  assert.deepEqual(readdirSync(join(RAIZ, 'app/landing-generator')), ['[[...resto]]']);
  assert.deepEqual(readdirSync(join(RAIZ, 'app/landing-generator/[[...resto]]')), ['page.tsx']);
  const page = sinComentarios(leer('app/landing-generator/[[...resto]]/page.tsx'));
  assert.match(page, /const \{ resto \} = await params;/);
  assert.match(page, /redirect\(await rutaConWs\(destinoWebGenerator\(resto, await searchParams\)\)\)/,
    'el redirect de /landing-generator perdió el camino (`/<id>`), la query o el `?ws=`');
  // La pantalla de verdad vive en app/web-generator, con el MISMO guard y la MISMA key de siempre.
  assert.match(sinComentarios(leer('app/web-generator/page.tsx')), /requireRolWs\(\[\], \{ nav: 'landing-writer' \}\)/);
});

test('el alias /landing-writer va DIRECTO a /web-generator (sin el salto por /landing-generator)', () => {
  const src = sinComentarios(leer('app/landing-writer/page.tsx'));
  assert.match(src, /redirect\(await rutaConWs\(destinoConQuery\(RUTA_WEB_GENERATOR, await searchParams\)\)\)/,
    '/landing-writer no va directo a /web-generator con la query');
  assert.doesNotMatch(src, /\/landing-generator/, '/landing-writer todavía nombra /landing-generator');
  assert.deepEqual([...RUTAS_VIEJAS_WEB_GENERATOR], ['/landing-generator', '/landing-writer']);
});

test('lo que se LEE dice «Web Generator», y las CLAVES siguen iguales', () => {
  // El nav: el nombre y la ruta nuevos, la key de siempre, y las URLs viejas siguen marcando la tab.
  const items = FAMILIAS.flatMap(itemsDe);
  const it = items.find((i) => i.key === 'landing-writer');
  assert.ok(it, 'se fue el item `landing-writer` del nav (la key está escrita en la base: capas, onboarding)');
  assert.equal(it.label, 'Web Generator');
  assert.equal(it.href, '/web-generator');
  for (const p of ['/web-generator', '/web-generator/12', '/landing-generator', '/landing-generator/12', '/landing-writer']) {
    assert.ok(it.match(p), `el nav no marca la tab en ${p}`);
  }
  assert.deepEqual(items.filter((i) => i.href === '/landing-generator' || i.href.startsWith('/landing-generator?')).map((i) => i.key), []);
  // La pestaña del navegador sale del nav (lib/titulo-tab.ts): la ruta vieja dice lo mismo.
  for (const p of ['/web-generator', '/web-generator/12', '/landing-generator', '/landing-writer', '/m/landing']) {
    assert.equal(tituloDe(p), 'MaKo - Web Generator', p);
  }
  // El onboarding de la tab: la key y los pasos de siempre, el nombre y el href nuevos.
  const ob = TAB_ONBOARDINGS['landing-writer'];
  assert.equal(ob.key, 'landing-writer');
  assert.deepEqual(ob.pasos.map((p) => p.key), ['generar', 'guardar', 'lg_publicar']);
  assert.equal(ob.nombre, 'Web Generator');
  assert.equal(ob.titulo, 'Configuración del Web Generator');
  assert.equal(ob.href, '/web-generator');
  assert.equal(TAB_ONBOARDINGS['landing-an'].href, '/web-generator/analizar');
  // La API de MaKo: el ÁREA sigue siendo `landing`; la tab y la ruta que nombra, las nuevas.
  assert.deepEqual([AREA_INFO.landing.tab, AREA_INFO.landing.ruta], ['Web Generator', '/web-generator']);
  // MaKo Mobile: el nombre de More, y el teléfono reescribe la nueva Y las viejas; vuelve a la nueva.
  assert.equal(SECCIONES_MAS.find((s) => s.id === 'landing')?.label, 'Web Generator');
  for (const [d, m] of [['/web-generator', '/m/landing'], ['/web-generator/12', '/m/landing/12'], ['/landing-generator/12', '/m/landing/12'], ['/landing-writer', '/m/landing']]) {
    assert.equal(rutaMovil(d), m, d);
  }
  assert.equal(rutaEscritorio('/m/landing/12'), '/web-generator/12');
  assert.equal(rutaEscritorio('/m/landing'), '/web-generator');
  // Lo que NO se renombra: la API interna y el registro de /admin/dev (sólo su rótulo).
  assert.ok(existsSync(join(RAIZ, 'app/api/landing-generator/route.ts')), 'la API interna /api/landing-generator no se mueve');
  assert.ok(existsSync(join(RAIZ, 'app/admin/dev/landing-generator/bitacora.ts')), 'el registro de /admin/dev no se mueve');
  const dev = ADMIN_NAV.find((i) => i.key === 'dev-landing-generator');
  assert.ok(dev, 'se fue el item del registro de /admin/dev');
  assert.deepEqual([dev.label, dev.href], ['Web Generator', '/admin/dev/landing-generator']);
});

test('⚠️ nada del producto ENLAZA la página vieja: es un redirect, y la única lista que la nombra es la de alias', () => {
  // El patrón no caza lo que SÍ puede nombrarse así (la lista positiva, que no se renombra).
  for (const ok of ["'/api/landing-generator/replicar'", '`/api/landing-generator/diagnostico/pagina?url=`', "'/admin/dev/landing-generator'", "'./landing-generator/bitacora'"]) {
    assert.doesNotMatch(ok, LINK_VIEJO, ok);
  }
  for (const malo of ["'/landing-generator'", '`/landing-generator/${id}`', "'/landing-generator?diagnostico=1'", '"/landing-generator/crear"']) {
    assert.match(malo, LINK_VIEJO, malo);
  }
  // Las únicas excepciones del producto: la página que redirige y la lista de alias.
  const PERMITIDOS = new Set(['app/landing-generator/[[...resto]]/page.tsx', 'lib/ruta-web-generator.ts']);
  // Las bitácoras de /admin/dev y el historial generado son DOCUMENTACIÓN: cuentan en prosa lo que
  // pasó y nombran la ruta como era, sólo que la prosa vive en una cadena.
  const DOCUMENTACION = [/^app\/admin\/(dev|ui)\/.*bitacora\.ts$/, /^app\/admin\/dev\/_historial\.generado\.ts$/, /^app\/conocimientos\//];
  const malos: string[] = [];
  for (const f of archivosDeProducto()) {
    if (PERMITIDOS.has(f) || DOCUMENTACION.some((re) => re.test(f))) continue;
    for (const [n, l] of lineasDeCodigo(readFileSync(join(RAIZ, f), 'utf8'))) {
      if (LINK_VIEJO.test(l)) malos.push(`${f}:${n} — ${l.trim().slice(0, 120)}`);
    }
  }
  assert.deepEqual(malos, [], 'hay links vivos a /landing-generator, que hoy sólo redirige: van a /web-generator (RUTA_WEB_GENERATOR)');
  // Y la lista de alias sigue nombrándola (si no, el nav dejaría de marcar la tab en los links viejos).
  assert.match(leer('lib/ruta-web-generator.ts'), /RUTAS_VIEJAS_WEB_GENERATOR = \['\/landing-generator', '\/landing-writer'\]/);
});

test('nada importa de la carpeta vieja (app/landing-generator): ni `@/app/landing-generator`, ni un relativo que resuelva ahí', () => {
  const malos: string[] = [];
  for (const f of archivosDeProducto()) {
    if (f.startsWith('app/landing-generator/')) continue;
    for (const [n, l] of lineasDeCodigo(readFileSync(join(RAIZ, f), 'utf8'))) {
      if (/['"]@\/app\/landing-generator\//.test(l)) malos.push(`${f}:${n}`);
      for (const m of l.matchAll(/['"]((?:\.\.?\/)+)landing-generator\//g)) {
        // `./landing-generator/bitacora` desde app/admin/dev es el REGISTRO del área, que no se movió.
        if (posix.normalize(posix.join(posix.dirname(f), m[1] + 'landing-generator')) === 'app/landing-generator') malos.push(`${f}:${n}`);
      }
    }
  }
  assert.deepEqual(malos, [], 'un import de la carpeta vieja: la pantalla vive en app/web-generator');
});

test('los links de adentro de la pantalla (Panel, editor, Replicar) apuntan a /web-generator', () => {
  const carpeta = execFileSync('git', ['ls-files', 'app/web-generator'], { cwd: RAIZ, encoding: 'utf8' })
    .split(/\r?\n/).map((f) => f.trim()).filter((f) => /\.tsx?$/.test(f));
  assert.ok(carpeta.length > 50, `app/web-generator tiene ${carpeta.length} archivos en git: ¿se hizo el git mv?`);
  const conLaRuta = carpeta.filter((f) => /\/web-generator/.test(sinComentarios(leer(f))));
  // Los links de adentro (el Panel, el editor, Replicar, el Diagnóstico) ya apuntan a la ruta nueva.
  for (const f of ['app/web-generator/panel-reglas.ts', 'app/web-generator/Inicio.tsx', 'app/web-generator/editor/EditorLanding.tsx', 'app/web-generator/crear/Replicar.tsx']) {
    assert.ok(conLaRuta.includes(f), `${f} ya no enlaza /web-generator`);
  }
  assert.match(sinComentarios(leer('app/web-generator/panel-reglas.ts')), /export const RUTA_PANEL = '\/web-generator';/);
});
