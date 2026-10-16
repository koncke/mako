// =============================================================================
// El hub de /onboarding se retiró: cada sección se edita en UN lugar, y cada link aterriza ahí
// =============================================================================
// Pedido de Martín (15/10/2026), textual: «Si, ponlo en second brain, y deja registrado la tarea de
// perfeccionar la tab de second braind y varias cosas de allí irán a sus propias tabs, como la de Writer y
// la de Avatar con IA». El relevamiento que lo sostiene: docs/hallazgos-onboarding.md → «¿Se puede sacar el
// hub de /onboarding?» (las diez secciones ya se editaban en /second-brain con los mismos componentes).
//
// Lo que persigue este archivo es lo que un retiro rompe SIN avisar (AGENTS.md, «Retirar una RUTA es
// enumerar sus links…»):
//   · un link que sigue mandando al hub: ya no existe, y aterrizaría en la portada de Second Brain en vez
//     de en la sección que prometía;
//   · un link escrito a mano a `/second-brain?area=…`: el día que la sección se mude a su tab (Writer,
//     Avatar con IA) queda apuntando al lugar viejo. Se pide la SECCIÓN (lib/secciones-negocio.ts);
//   · una sub-pestaña que la tabla nombra y Second Brain no dibuja: el link abre otra.
//
// La ruta /onboarding SIGUE: es el wizard del primer ingreso. Lo que se tolera nombrarla está en
// `AL_WIZARD`, cada uno con su motivo.
//
// ⚠️ El barrido lee `git ls-files` (el ÍNDICE): un archivo nuevo sin `git add` no lo ve.
//
// ROTURAS (15/10/2026, base 6 de 6 en verde, restaurado de memoria): un link `href="/onboarding"` vuelto a
// Reels: 1 fallo, 5 pases · la sub-pestaña «persona» sin id en AreasHub: 1 fallo, 5 pases · la página con
// la rama del hub de vuelta (importando OnboardingTabs): 1 fallo, 5 pases · `persona` apuntando a un área
// que no existe: 1 fallo, 5 pases.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { AREAS } from '../lib/cerebro-modelo';
import { DONDE_SE_EDITA, SUBVISTAS, lugarSeccion, rutaSeccion, vistaValida, type SeccionNegocio } from '../lib/secciones-negocio';
import { TAB_VIEJA_A_SECCION, destinoDeTabVieja, DESTINO_SIN_TAB } from '../app/onboarding/tabs-catalogo';
import { USER_NAV, TODOS_LOS_ITEMS } from '../app/_components/nav';
import { seccionesNegocio } from '../lib/ajustes-secciones';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/** Los que SÍ pueden nombrar /onboarding: todos van al wizard del primer ingreso, no al hub. */
const AL_WIZARD: ReadonlyArray<{ archivo: string; por: string }> = [
  { archivo: 'lib/tab-access.ts', por: 'el guard manda al wizard mientras el onboarding esté pendiente' },
  { archivo: 'app/inicio/page.tsx', por: 'la portada manda al wizard mientras esté pendiente' },
  { archivo: 'app/_components/PanelAgencia.tsx', por: 'el reset deja el onboarding pendiente y va derecho al wizard' },
  { archivo: 'app/m/configurar/page.tsx', por: 'sólo se dibuja con el onboarding pendiente: abre el wizard' },
  { archivo: 'lib/movil-rutas.ts', por: 'el respaldo de escritorio de /configurar, que es el wizard' },
  { archivo: 'lib/movil-desvio.ts', por: 'la lista de rutas que el teléfono abre igual (el wizard)' },
  { archivo: 'lib/titulo-tab.ts', por: 'el título de la pestaña del wizard' },
];

test('cada sección tiene un lugar que existe: el área está en AREAS y la sub-pestaña en SUBVISTAS', () => {
  const secciones = Object.keys(DONDE_SE_EDITA) as SeccionNegocio[];
  assert.equal(secciones.length, 10, 'eran las diez del hub');
  for (const s of secciones) {
    const d = DONDE_SE_EDITA[s];
    assert.ok(AREAS.some((a) => a.id === d.area), `${s}: el área «${d.area}» no existe en Second Brain`);
    const subs = SUBVISTAS[d.area];
    if (subs) assert.ok(d.vista && subs.includes(d.vista), `${s}: el área «${d.area}» tiene sub-pestañas y «${d.vista}» no es una`);
    else assert.equal(d.vista, undefined, `${s}: «${d.area}» no tiene sub-pestañas`);
    assert.equal(rutaSeccion(s), `${d.ruta}?area=${d.area}${d.vista ? `&vista=${d.vista}` : ''}`);
  }
  assert.equal(rutaSeccion('persona'), '/second-brain?area=voz&vista=persona');
  assert.equal(lugarSeccion('persona'), 'Second Brain → Persona');
  assert.equal(vistaValida('voz', 'persona'), 'persona');
  assert.equal(vistaValida('voz', 'inventada'), null, 'una vista que el área no tiene no se abre');
  assert.equal(vistaValida('avatares', 'persona'), null);
});

test('Second Brain dibuja cada sub-pestaña con su id, en el orden de SUBVISTAS, y lee ?vista=', () => {
  const hub = sinComentarios(leer('app/second-brain/AreasHub.tsx'));
  for (const [area, ids] of Object.entries(SUBVISTAS)) {
    const i = hub.indexOf(`\n  ${area}: [`);
    assert.ok(i >= 0, `AreasHub no tiene el área «${area}»`);
    const bloque = hub.slice(i, hub.indexOf('\n  ],', i));
    const enHub = [...bloque.matchAll(/\bid: '(\w+)'/g)].map((m) => m[1]);
    assert.deepEqual(enHub, [...(ids ?? [])], `«${area}»: las sub-pestañas de AreasHub no son las de SUBVISTAS`);
  }
  assert.match(hub, /useState\(\(\) => indiceDe\(abierta, vistaInicial\)\)/, 'la sub-pestaña pedida no se usa al abrir');
  const vista = sinComentarios(leer('app/second-brain/VistaCerebro.tsx'));
  assert.match(vista, /vistaValida\(areaInicial, params\?\.get\('vista'\)\)/);
  assert.match(vista, /<AreasHub [^>]*vistaInicial=\{vistaInicial\}/);
});

test('los links viejos al hub llegan a la MISMA sección; sin ?tab=, a la portada', () => {
  for (const [tab, seccion] of Object.entries(TAB_VIEJA_A_SECCION)) {
    assert.equal(destinoDeTabVieja(tab), rutaSeccion(seccion), `?tab=${tab}`);
  }
  assert.equal(destinoDeTabVieja(undefined), DESTINO_SIN_TAB);
  assert.equal(destinoDeTabVieja('funnel'), DESTINO_SIN_TAB, 'la undécima se retiró el 29/09');
  assert.equal(destinoDeTabVieja('toString'), DESTINO_SIN_TAB, 'un valor del prototipo no es una pestaña');
});

test('la página ya no dibuja el hub: el chat de arranque, o un redirect con el ?ws= a la sección pedida', () => {
  assert.ok(!existsSync(join(RAIZ, 'app/onboarding/OnboardingTabs.tsx')), 'el hub volvió');
  const page = sinComentarios(leer('app/onboarding/page.tsx'));
  assert.doesNotMatch(page, /OnboardingTabs/);
  // Desde el 16/10/2026 el onboarding es el chat de arranque (el wizard se borró).
  assert.match(page, /if \(!done\) \{[\s\S]*<ChatArranque [\s\S]*\/><\/>;/, 'el chat de arranque dejó de dibujarse');
  assert.ok(!existsSync(join(RAIZ, 'app/onboarding/OnboardingWizard.tsx')), 'volvió el wizard');
  assert.match(page, /redirect\(await rutaConWs\(destinoDeTabVieja\(tab\)\)\);/, 'sin el redirect (o sin el ?ws=) al lugar nuevo');
});

test('ni el menú de la foto ni Configuraciones llevan a /onboarding', () => {
  assert.ok(!USER_NAV.some((i) => i.href === '/onboarding'), 'el ítem «Onboarding» volvió al menú de la foto');
  assert.ok(!TODOS_LOS_ITEMS.some((i) => i.href === '/onboarding'));
  // ConfigTabs.tsx se fue el 15/10/2026 con «Configuración del negocio»: su índice sale de lib/ajustes-secciones.ts.
  assert.ok(!seccionesNegocio({ general: true, integraciones: true, metodo: true, plan: true }).some((s) => s.href === '/onboarding'));
});

test('ningún archivo de producto vuelve a mandar a /onboarding, salvo los que van al wizard', () => {
  const archivos = execFileSync('git', ['ls-files', 'app', 'lib'], { cwd: RAIZ, encoding: 'utf8' })
    .split(/\r?\n/).map((f) => f.trim()).filter((f) => /\.tsx?$/.test(f));
  assert.ok(archivos.length > 300, `git ls-files devolvió ${archivos.length}: esto no corrió en el repo`);
  const tolerados = new Set(AL_WIZARD.map((x) => x.archivo));
  const malos: string[] = [];
  for (const f of archivos) {
    if (f.startsWith('app/onboarding/') || f.startsWith('app/admin/dev/') || f === 'app/admin/docs/catalogo.ts') continue;
    if (!existsSync(join(RAIZ, f))) continue;
    const src = sinComentarios(leer(f));
    // Una CADENA que arranca con /onboarding (no /api/onboarding ni ../onboarding/Componente).
    if (/['"`]\/onboarding(?=['"`?#/])/.test(src) && !tolerados.has(f)) malos.push(f);
  }
  assert.deepEqual(malos, [], `mandan al hub retirado: usá rutaSeccion() de lib/secciones-negocio.ts`);
  // Y cada tolerado sigue nombrándolo: una excepción que ya no hace falta también falla.
  for (const { archivo } of AL_WIZARD) {
    assert.match(sinComentarios(leer(archivo)), /['"`]\/onboarding(?=['"`?#/])/, `${archivo} ya no nombra /onboarding: sacalo de AL_WIZARD`);
  }
});
