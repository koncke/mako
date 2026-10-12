// =============================================================================
// Análisis se mudó ADENTRO de Experiments, y Offer salió de los Analysts
// =============================================================================
// Pedido de Martín (11/10/2026), textual: «Implementa completamente la funcionalidad de
// "Offer Analyst" y "Offer Generator" pero todo en una misma tab que se llame "Offer"...
// Elimina la tab de "Análisis", llévala dentro de "Experiments"».
//
// Lo que este archivo persigue es lo que una mudanza de ruta rompe SIN avisar (AGENTS.md,
// «Retirar una RUTA»): un link que sigue apuntando a la ruta vieja y rebota, un redirect que
// pierde la query (el rango de un análisis compartido) o el ?ws= del cliente que mira el
// super admin, una barra que deja de marcar la tab, y el valor que el server necesita
// importado desde un módulo 'use client' (el bug que dejó /onboarding roto en producción
// con el build en verde).
//
// ⚠️ Los barridos leen `git ls-files`, o sea el ÍNDICE: un archivo nuevo que todavía no se
// agregó no lo ve nadie. Los de la tab Offer los escriben otras sesiones en paralelo y está
// bien que queden afuera hasta que entren.
//
// Probado rompiéndolo (11/10/2026; base en verde: 8 pasan, 0 fallan). Cada rotura se aplicó,
// se corrió este archivo y se restauró desde memoria (pasan / fallan):
//   · /analisis con `{ tab: 'analisis', ...sp }` (un ?tab= viejo pisa el destino)  -> 7 / 1
//   · VistaAnalisis vuelve a enlazar `/analisis?desde=…`                            -> 6 / 2
//   · el match de Experiments deja de aceptar /analisis                             -> 7 / 1
//   · el ítem 'offer' vuelve a href '/offer-analyst'                                -> 7 / 1
//   · app/experimentos/tabs.ts con 'use client' arriba                              -> 7 / 1
//   · la page devuelve `return <PanelActivacion …/>` antes de dibujar nada          -> 7 / 1
//   · la page devuelve `if (panelSinMeta) return panelSinMeta;`                      -> 7 / 1
//     (la primera versión buscaba sólo el literal y ésta pasó en VERDE: 8 / 0)
//   · /analisis/trimestre vuelve a enlazar a "/analisis"                            -> 6 / 2
//   · ExperimentsTab deja la hipótesis en la URL                                    -> 7 / 1

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { FAMILIAS, TODOS_LOS_ITEMS, itemsDe, type NavItem } from '../app/_components/nav';
import { tabDeUrl } from '../app/experimentos/tabs';
import { destinoConQuery } from '../lib/ruta-automations';

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

const ANALYZE = FAMILIAS.find((f) => f.key === 'analyze');
const itemNav = (key: string): NavItem | undefined => TODOS_LOS_ITEMS.find((i) => i.key === key);

test('/analisis redirige a la tab, con la query entera, el ?ws= y la tab que no se puede pisar', () => {
  const src = sinComentarios(leer('app/analisis/page.tsx'));
  assert.match(src, /redirect\(await rutaConWs\(/, '/analisis dejó de redirigir con rutaConWs (perdería el ?ws=)');
  // `tab` va DESPUÉS del spread: un link viejo con un ?tab= basura no puede mandar a otro lado.
  assert.match(
    src,
    /destinoConQuery\(\s*'\/experimentos'\s*,\s*\{\s*\.\.\.\(await searchParams\)\s*,\s*tab:\s*'analisis'\s*\}\s*\)/,
    'el redirect de /analisis no arma /experimentos con la query y tab=analisis AL FINAL',
  );
  assert.doesNotMatch(src, /analisisNegocio|<VistaAnalisis/, '/analisis volvió a dibujar el informe por su cuenta');
  // Y lo que ese objeto produce: el rango sobrevive y la tab es la de Análisis.
  const sp = { desde: '2026-06-01', hasta: '2026-08-31', tab: 'basura', ws: '13' };
  const destino = destinoConQuery('/experimentos', { ...sp, tab: 'analisis' });
  const u = new URL(destino, 'https://x');
  assert.equal(u.pathname, '/experimentos');
  assert.equal(u.searchParams.get('tab'), 'analisis');
  assert.equal(u.searchParams.get('desde'), '2026-06-01');
  assert.equal(u.searchParams.get('ws'), '13');
});

test('ningún archivo del producto enlaza a /analisis (el trimestre sí puede)', () => {
  assert.deepEqual(linksVivos('/analisis', false, 'app/analisis/page.tsx'), [],
    'hay links vivos a /analisis, que hoy sólo redirige: van a /experimentos?tab=analisis');
});

test('la barra: Análisis ya no es un ítem, y Experiments se marca en las rutas viejas', () => {
  assert.ok(ANALYZE, 'desapareció la familia Analyze');
  const todos = itemsDe(ANALYZE!);
  assert.ok(!todos.some((i) => i.key === 'analisis'), 'volvió el ítem «Análisis» a la barra');
  assert.ok(!TODOS_LOS_ITEMS.some((i) => i.href === '/analisis' || i.href.startsWith('/analisis?')),
    'un ítem de la barra vuelve a apuntar a /analisis');
  const exp = itemNav('experimentos');
  assert.ok(exp, 'desapareció el ítem de Experiments');
  for (const p of ['/experimentos', '/analisis', '/analisis/trimestre']) {
    assert.equal(exp!.match(p), true, `Experiments no se marca en ${p}`);
  }
  // El título de la pestaña sale del primer ítem que matchea (lib/titulo-tab.ts): con
  // /analisis/trimestre sin dueño caía a «MaKo - Analisis», sin tilde.
  assert.equal(TODOS_LOS_ITEMS.find((i) => i.match('/analisis/trimestre'))?.label, 'Experiments');
});

test('el informe de Análisis enlaza su rango a la tab, no a la ruta vieja', () => {
  const src = sinComentarios(leer('app/experimentos/VistaAnalisis.tsx'));
  assert.match(src, /href=\{`\/experimentos\?tab=analisis&desde=/, 'los rangos de Análisis no van a /experimentos?tab=analisis');
  assert.doesNotMatch(src, /`\/analisis\?/, 'un rango de Análisis vuelve a apuntar a /analisis');
  // El informe congelado vive en su ruta (tests/informe-congelado.test.ts la fija) y vuelve a la tab.
  const tri = sinComentarios(leer('app/analisis/trimestre/page.tsx'));
  assert.match(tri, /href="\/experimentos\?tab=analisis"/, '«← Análisis en vivo» no vuelve a la tab de Experiments');
  assert.match(tri, /nav:\s*'experimentos'/, 'el trimestre dejó de pedir la capa de Experiments');
});

// Desde el 12/10/2026 Offer es el PRIMER bloque de Sales Machine (Martín: «Pon Offer en Sales Machine»); antes iba
// suelta en Analyze, pegada a Second Brain. Verificado rompiéndolo: con Offer de vuelta en Analyze cae «Offer no es el
// primer bloque de Sales Machine»; con Offer al final del bloque de Capturar, también.
test('Offer: el primer bloque de Sales Machine apunta a /offer, y /offer-analyst sólo redirige', () => {
  assert.ok(ANALYZE, 'desapareció la familia Analyze');
  const SALES = FAMILIAS.find((f) => f.key === 'create');
  assert.ok(SALES, 'desapareció la familia Sales Machine');
  const offer = itemNav('offer');
  assert.ok(offer, 'desapareció el ítem con key «offer» (la key es contrato con la base)');
  assert.equal(offer!.href, '/offer');
  assert.equal(offer!.label, 'Offer');
  assert.ok(!offer!.comingSoon, 'Offer sigue marcada como «próximamente»');
  assert.equal(offer!.match('/offer'), true);
  assert.equal(offer!.match('/offer-analyst'), true, 'la barra no marca Offer al llegar por la ruta vieja');
  // Una sola Offer en toda la barra, y en el primer bloque de Sales Machine (la oferta va antes que lo que la vende).
  const analysts = ANALYZE!.grupos?.find((g) => g.key === 'analysts');
  assert.ok(!analysts?.items.some((i) => i.key === 'offer'), 'Offer volvió al desplegable de Analysts');
  assert.ok(!ANALYZE!.bloques.some((b) => b.some((i) => i.key === 'offer')), 'Offer volvió a Analyze');
  assert.deepEqual(SALES!.bloques[0].map((i) => i.key), ['offer'], 'Offer no es el primer bloque de Sales Machine');

  const red = sinComentarios(leer('app/offer-analyst/page.tsx'));
  assert.match(red, /redirect\(await rutaConWs\('\/offer'\)\)/, '/offer-analyst dejó de redirigir a /offer con rutaConWs');
  assert.deepEqual(linksVivos('/offer-analyst', true, 'app/offer-analyst/page.tsx'), [],
    'hay links vivos a /offer-analyst, que hoy sólo redirige: van a /offer');
});

test('las tabs de Experiments viven en un módulo de DATOS, sin use client', () => {
  const src = leer('app/experimentos/tabs.ts');
  assert.doesNotMatch(src, /^\s*['"]use client['"]/m, 'app/experimentos/tabs.ts volvió a ser un módulo de cliente');
  assert.equal(tabDeUrl('analisis'), 'analisis');
  assert.equal(tabDeUrl('experiments'), 'experiments');
  assert.equal(tabDeUrl('basura'), 'retro');
  assert.equal(tabDeUrl(undefined), 'retro');
  // La page lo importa a ÉL, nunca un valor del shell 'use client'.
  const page = sinComentarios(leer('app/experimentos/page.tsx'));
  assert.match(page, /import \{ tabDeUrl \} from '\.\/tabs'/);
  assert.doesNotMatch(page, /import \{[^}]*tabDeUrl[^}]*\} from '\.\/ExperimentosApp'/);
});

test('el corte de Meta no esconde Análisis: el panel ocupa sólo las tres tabs que lo necesitan', () => {
  const page = sinComentarios(leer('app/experimentos/page.tsx'));
  // La page tiene UN solo return: el que monta el shell. Buscar sólo «return <PanelActivacion»
  // dio VERDE con «if (panelSinMeta) return panelSinMeta;» (medido al romperlo): lo que hay que
  // fijar es que no haya NINGUNA salida temprana, se escriba como se escriba.
  const ini = page.indexOf('export default async function ExperimentosPage');
  assert.ok(ini >= 0, 'no encontré la page de /experimentos');
  const cuerpo = page.slice(ini);
  assert.equal((cuerpo.match(/\breturn\b/g) ?? []).length, 1,
    'la page tiene una salida temprana: el panel de Meta (o lo que sea) vuelve a tapar la pantalla entera');
  assert.match(cuerpo, /return \(\s*<main[\s\S]*<ExperimentosApp/, 'el único return de la page dejó de montar el shell');
  assert.match(page, /panelSinMeta=\{panelSinMeta\}/, 'la page no le pasa el panel de Meta al shell');
  // El análisis (lento) sólo corre cuando la URL lo pide.
  assert.match(page, /tab === 'analisis' \? informeAnalisis\(sp\) : null/, 'el análisis corre aunque la tab no sea Análisis');
  const app = sinComentarios(leer('app/experimentos/ExperimentosApp.tsx'));
  assert.match(app, /const sinMeta = panelSinMeta != null && tab !== 'analisis'/, 'el panel de Meta tapa también la tab Análisis');
});

test('el link «Probarlo» de Offer aterriza en el alta, con la hipótesis escrita, una vez', () => {
  const page = sinComentarios(leer('app/experimentos/page.tsx'));
  assert.match(page, /hipotesisInicial=\{hipotesis\}/, 'la page no le pasa la hipótesis del link al shell');
  const tab = sinComentarios(leer('app/experimentos/ExperimentsTab.tsx'));
  assert.match(tab, /useState\(\(\) => !!hipotesisInicial\)/, 'con una hipótesis en el link el alta no nace abierta');
  assert.match(tab, /searchParams\.delete\('hipotesis'\)/, 'la hipótesis queda en la URL: un F5 vuelve a abrir el alta');
  assert.match(tab, /onHipotesisAbierta\?\.\(\)/, 'el shell no se entera de que la hipótesis ya se usó: volver a la tab la reabre');
});
