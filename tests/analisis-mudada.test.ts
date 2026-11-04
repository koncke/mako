// =============================================================================
// /analisis y /experimentos se retiraron: aterrizan en el Dashboard, y Offer salió de los Analysts
// =============================================================================
// Historia: el 11/10/2026 Análisis se mudó ADENTRO de Experiments (Martín: «Elimina la tab de "Análisis", llévala
// dentro de "Experiments"»), y el 17/10/2026 Experiments se retiró entera (Martín: «Quiero que "Experiments" la
// simplifiques completamente… puede vivir dentro del chat de MaKo de "Dashboard"»). Las dos rutas redirigen al
// Dashboard; el informe congelado de /analisis/trimestre se queda en su ruta.
//
// Lo que este archivo persigue es lo que una mudanza de ruta rompe SIN avisar (AGENTS.md, «Retirar una RUTA»): un
// link que sigue apuntando a la ruta vieja y rebota, un redirect que pierde el ?ws= del cliente que mira el super
// admin, y el «Probarlo» de Offer que perdía la hipótesis en el camino.
//
// ⚠️ Los barridos leen `git ls-files`, o sea el ÍNDICE: un archivo nuevo que todavía no se agregó no lo ve nadie.
// ⚠️ La barra (app/_components/nav.ts) es del chat «Sidebar»: lo que se fija acá de ella es sólo lo de Offer y que
//    Análisis no vuelva a ser un ítem.
//
// Probado rompiéndolo (17/10/2026; base 6 / 0), una rotura por vez:
//   · /analisis vuelve a /experimentos?tab=analisis                                 -> 5 / 1
//   · /experimentos redirige al Dashboard pelado (pierde la hipótesis)               -> 5 / 1
//   · /analisis/trimestre vuelve a enlazar a "/experimentos?tab=analisis"            -> 5 / 1
//   · el «Probarlo» de Offer vuelve a /experimentos?tab=experiments&hipotesis=…       -> 5 / 1
//   · el Dashboard deja de abrir el panel con ?probar= (useState(false))              -> 5 / 1
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { FAMILIAS, TODOS_LOS_ITEMS, itemsDe, type NavItem } from '../app/_components/nav';
import { destinoDeExperimentos, hrefProbar } from '../lib/experimentos-catalogo';

const RAIZ = join(import.meta.dirname, '..');
/** Todo test que lee fuente normaliza los saltos: en un worktree los archivos llegan en CRLF. */
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
/** Las líneas PRIMERO y los bloques después: un `/*` dentro de un `//` se comería el código. */
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

function archivosDeProducto(): string[] {
  const todos = execFileSync('git', ['ls-files', 'app', 'lib'], { cwd: RAIZ, encoding: 'utf8' })
    .split(/\r?\n/)
    .map((f) => f.trim())
    .filter((f) => /\.tsx?$/.test(f) && !/\.d\.ts$/.test(f));
  // «No encontré nada que revisar» y «revisé y está todo bien» son respuestas DISTINTAS.
  assert.ok(todos.length > 300, `git ls-files devolvió ${todos.length} archivos: esto no corrió en el repo`);
  return todos;
}

/**
 * Dónde está enlazada una ruta retirada. Se busca una CADENA que ARRANQUE con la ruta y
 * termine ahí, en un `?` (o en una barra, si se pide): la prosa de los comentarios nombra la
 * ruta a cada rato y es documentación correcta, no un destino. Por eso se saltean las líneas
 * de comentario, el registro de /admin/dev (sus bitácoras cuentan en prosa, dentro de cadenas,
 * qué rutas se retiraron: es su trabajo), el catálogo de /admin/docs, el historial generado de
 * git, el propio redirect, y los `starts('/ruta')` de los matchers del nav — que la barra marque
 * la tab cuando alguien llega por un link viejo es justo lo que se quiere.
 */
function linksVivos(ruta: string, conBarra: boolean, redirect: string): string[] {
  const DOCUMENTACION = [
    /^app\/admin\/dev\/.*bitacora\.ts$/, /^app\/admin\/dev\/areas\.ts$/,
    /^app\/admin\/dev\/_historial\.generado\.ts$/, /^app\/admin\/docs\/catalogo\.ts$/,
  ];
  const esc = ruta.replace(/[-/]/g, '\\$&');
  const re = new RegExp(`['"\`]${esc}['"\`?${conBarra ? '/' : ''}]`);
  const malos: string[] = [];
  for (const f of archivosDeProducto()) {
    if (f === redirect) continue;
    if (DOCUMENTACION.some((d) => d.test(f))) continue;
    if (!existsSync(join(RAIZ, f))) continue; // en el índice y borrado del disco: otra sesión trabajando
    leer(f).split('\n').forEach((linea, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(linea)) return;
      const sinMatchers = linea.replace(/starts\(\s*['"`][^'"`]+['"`]\s*\)/g, '');
      if (re.test(sinMatchers)) malos.push(`${f}:${i + 1}`);
    });
  }
  return malos;
}

// Analyze se deprecó el 17/10/2026 (docs/diseno-sidebar.md): Dashboard pasó a Operate y Experiments salió de la barra.
const ANALYZE = FAMILIAS.find((f) => f.key === 'analyze');
const itemNav = (key: string): NavItem | undefined => TODOS_LOS_ITEMS.find((i) => i.key === key);

test('/analisis y /experimentos redirigen al Dashboard con rutaConWs; la hipótesis de un link viejo viaja', () => {
  const an = sinComentarios(leer('app/analisis/page.tsx'));
  assert.match(an, /redirect\(await rutaConWs\('\/dashboard'\)\)/, '/analisis no redirige al Dashboard con rutaConWs');
  assert.doesNotMatch(an, /analisisNegocio|<VistaAnalisis|\/experimentos/, '/analisis volvió a dibujar el informe o a mandar a la tab retirada');
  const ex = sinComentarios(leer('app/experimentos/page.tsx'));
  assert.match(ex, /redirect\(await rutaConWs\(destinoDeExperimentos\(await searchParams\)\)\)/);
  assert.match(sinComentarios(leer('app/m/experimentos/page.tsx')), /redirect\(await rutaConWs\('\/m\/dashboard'\)\)/);
  assert.equal(destinoDeExperimentos({ tab: 'retro' }), '/dashboard');
  assert.equal(destinoDeExperimentos({ tab: 'experiments', hipotesis: 'Un  anuncio con testimonio ' }), '/dashboard?probar=Un%20anuncio%20con%20testimonio');
});
test('ningún archivo del producto enlaza a /analisis (el trimestre sí puede)', () => {
  assert.deepEqual(linksVivos('/analisis', false, 'app/analisis/page.tsx'), [],
    'hay links vivos a /analisis, que hoy sólo redirige: van al Dashboard');
});

// Desde el 17/10/2026 Experiments tampoco es una fila (Analyze se deprecó; su trabajo va al chat de MaKo): su ítem vive en
// SIN_FILA, para que el teléfono, el título de la pestaña y la API de MaKo lo sigan encontrando por key y por ruta.
test('la barra: Análisis ya no es un ítem, Experiments no es una fila, y /analisis es del Dashboard', () => {
  assert.equal(ANALYZE, undefined, 'volvió la familia Analyze');
  const todos = FAMILIAS.flatMap(itemsDe);
  assert.ok(!todos.some((i) => i.key === 'analisis'), 'volvió el ítem «Análisis» a la barra');
  assert.ok(!todos.some((i) => i.key === 'experimentos'), 'Experiments volvió a ser una fila de la barra');
  // /analisis (y el informe congelado del trimestre) son del Dashboard desde que Experiments se fue: la barra marca Dashboard.
  const dash = todos.find((i) => i.key === 'graphics');
  assert.equal(dash?.match('/analisis/trimestre'), true, 'el informe del trimestre no marca el Dashboard');
  assert.ok(!TODOS_LOS_ITEMS.some((i) => i.href === '/analisis' || i.href.startsWith('/analisis?')),
    'un ítem de la barra vuelve a apuntar a /analisis');
});
test('el informe congelado del trimestre se queda en su ruta, con la puerta y la vuelta del Dashboard', () => {
  const tri = sinComentarios(leer('app/analisis/trimestre/page.tsx'));
  assert.match(tri, /href="\/dashboard"/, '«← El Dashboard» no vuelve al Dashboard');
  assert.match(tri, /nav:\s*'graphics'/, 'el trimestre dejó de pedir la capa del Dashboard');
  assert.doesNotMatch(tri, /\/experimentos/, 'el trimestre vuelve a mandar a la tab retirada');
});

// Desde el 12/10/2026 Offer es el PRIMER bloque de Sales Machine (Martín: «Pon Offer en Sales Machine»); antes iba
// suelta en Analyze, pegada a Second Brain. Verificado rompiéndolo: con Offer de vuelta en Analyze cae «Offer no es el
// primer bloque de Sales Machine»; con Offer al final del bloque de Capturar, también.
test('Offer: el primer bloque de Sales Machine apunta a /offer, y /offer-analyst sólo redirige', () => {
  // Desde el 17/10/2026 noche (la sidebar del prototipo) Offer abre MARKETING: lo que atrae a la gente.
  const SALES = FAMILIAS.find((f) => f.key === 'marketing');
  assert.ok(SALES, 'desapareció la familia Marketing');
  const offer = itemNav('offer');
  assert.ok(offer, 'desapareció el ítem con key «offer» (la key es contrato con la base)');
  assert.equal(offer!.href, '/offer');
  assert.equal(offer!.label, 'Offer');
  assert.ok(!offer!.comingSoon, 'Offer sigue marcada como «próximamente»');
  assert.equal(offer!.match('/offer'), true);
  assert.equal(offer!.match('/offer-analyst'), true, 'la barra no marca Offer al llegar por la ruta vieja');
  // Una sola Offer en toda la barra, y en el primer bloque de Sales Machine (la oferta va antes que lo que la vende).
  // Desde el 17/10/2026 es una tab UNIFICADA (Strategy y Playbook son sus secciones para el super admin) y Offer es la
  // primera sección: a la que lleva la tab.
  // Sigue siendo UNA sola: el ítem no se borró. Lo que cambió el 2/11/2026 es que no se DIBUJA.
  assert.equal(FAMILIAS.flatMap(itemsDe).filter((i) => i.key === 'offer').length, 1, 'hay dos Offer en la barra');
  // ⚠️ Y NO SE VE. Martín: «elimina las tabs de offer… la de offer no la quiero». Se saca con
  // `fueraDeLaBarra` y no borrando la entrada, porque la key es contrato con la base: los permisos
  // por capa, el onboarding por tab y el móvil la resuelven con `itemNav('offer')`, y sin la entrada
  // les devuelve `undefined`. El daño no sería la barra: sería un negocio perdiendo el permiso de
  // una tab porque su key dejó de existir.
  assert.equal(offer!.fueraDeLaBarra, true, 'Offer volvió a verse en la barra');
  assert.equal(SALES!.bloques[0][0].secciones?.[0]?.key ?? SALES!.bloques[0][0].key, 'offer', 'Offer no es la primera fila de Marketing');

  const red = sinComentarios(leer('app/offer-analyst/page.tsx'));
  assert.match(red, /redirect\(await rutaConWs\('\/offer'\)\)/, '/offer-analyst dejó de redirigir a /offer con rutaConWs');
  assert.deepEqual(linksVivos('/offer-analyst', true, 'app/offer-analyst/page.tsx'), [],
    'hay links vivos a /offer-analyst, que hoy sólo redirige: van a /offer');
});

test('el link «Probarlo» de Offer abre «Editar con MaKo» en el Dashboard, con la hipótesis escrita', () => {
  assert.equal(hrefProbar('Si cambio el gancho, sube el CTR'), '/dashboard?probar=Si%20cambio%20el%20gancho%2C%20sube%20el%20CTR');
  assert.match(sinComentarios(leer('app/offer/Conclusion.tsx')), /<ButtonLink href=\{hrefProbar\(c\.hipotesis\)\}/);
  // El teléfono no lo ofrece: /m/dashboard no tiene «Editar con MaKo» (tests/m-offer.test.ts lo mira en el HTML).
  assert.doesNotMatch(sinComentarios(leer('app/m/offer/HojasOfferM.tsx')), /probarlo|hrefProbar/i);
  // El Dashboard lee `?probar=` y abre el panel con «Probemos: …» (una vez).
  assert.match(sinComentarios(leer('app/dashboard/page.tsx')), /probarInicial=\{unica \? null : probar\}/);
  assert.match(sinComentarios(leer('app/dashboard/EditorInforme.tsx')), /useState\(!!probarInicial\)/);
});
