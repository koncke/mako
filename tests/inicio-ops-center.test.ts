// =============================================================================
// En la computadora se entra al Ops Center (21/10/2026)
// =============================================================================
// Martín, 21/10 22:54, desde el Ops Center: «en desktop siempre al iniciar me lleva a dashboard, cuando dijimos que debería
// ir a Ops Center siempre». MEDIDO en producción ese día: su usuario (id 1) es `rol=admin` con `workspace_id=9` (la
// plataforma), así que en /inicio `getWorkspaceActual()` daba 9 —la rama de «admin sin workspace → /clients» no corría
// nunca para él— y terminaba en el `redirect('/general')` del final, que redirige al Dashboard. El cliente iba al mismo
// lugar y el closer/setter a /crm.
//
// Lo que se fija:
//   1. la decisión (lib/ops-center-ruta.ts → casaEnLaComputadora): el super admin que opera, a /admin/operaciones; los
//      demás, al Ops Center de su negocio en TODOS los planes; sin la tab en el plan, a la casa de antes;
//   2. esas rutas son las de las filas «Ops Center» de la barra (nav.ts): si la barra muda la suya, esto cae;
//   3. el repartidor (app/inicio/page.tsx): el teléfono primero y sin tocar, después `quienOpera`, el onboarding pendiente
//      sólo para quien no opera, y la casa con `rutaConWs`; sin `/general` ni `/crm` como destino;
//   4. los otros caminos de entrada van al repartidor: «Inspeccionar» del super admin, «Entrar» de MaKo Partners, «Ir al
//      inicio» del cartel del plan, la vuelta de Google sin su cookie y el rebote de /admin/agente.
//
// Probado ROMPIÉNDOLO (21/10/2026), una rotura por vez, restaurando la copia del archivo (no de memoria; arnés `romper.py` del scratchpad).
// Base: 4 pases / 0 fallos en este archivo. Cada rotura cae donde dice:
//   · casaEnLaComputadora devolviendo /general para el que opera                        → cae 1 (3 / 1)
//   · casaEnLaComputadora sin mirar el plan (siempre /second-brain)                       → cae 1 (3 / 1)
//   · RUTA_OPS_CENTER_NEGOCIO = '/mako' (no es el href de la fila de la barra)            → cae 1 y 2 (2 / 2)
//   · el repartidor con `redirect(await rutaConWs('/general'))` de vuelta al final          → cae 3 (3 / 1)
//   · el repartidor con el onboarding ANTES de `quienOpera` (sin `!opera`)                  → cae 3 (3 / 1)
//   · el repartidor con el `if (rolWs === 'closer' …) redirect(… '/crm')` de vuelta           → cae 3 (3 / 1)
//   · «Entrar a su cuenta» de la ficha de Admin con `/general?ws=` otra vez                              → cae 4 (3 / 1)
//   · el callback de Google con `|| '/'` otra vez                                          → cae 4 (3 / 1)
//   · «Ir al inicio» del cartel del plan con `homeDeCapa(capa)` otra vez                    → cae 4 (3 / 1)

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CASA_SIN_OPS_CENTER, RUTA_OPS_CENTER, RUTA_OPS_CENTER_NEGOCIO, casaEnLaComputadora } from '../lib/ops-center-ruta';
import { CAPAS_LISTA } from '../lib/capas';
import { MAKO_NAV, OPS_CENTER } from '../app/_components/nav';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const codigo = (r: string) => leer(r).replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1: el super admin que opera entra a SU Ops Center; los demás, al de su negocio en todos los planes', () => {
  for (const capa of [...CAPAS_LISTA.map((c) => c.id), null, 'una-capa-que-no-existe']) {
    assert.equal(casaEnLaComputadora({ opera: true, capa }), '/admin/operaciones', `el super admin (${capa})`);
    assert.equal(casaEnLaComputadora({ opera: false, capa }), '/second-brain', `un negocio con la capa ${capa}`);
  }
  // Un plan sin el Ops Center (hoy no hay ninguno) no lo manda al cartel «No está en tu plan»: va a la casa de antes.
  const sinOps = (key: string) => key !== 'mako';
  assert.equal(casaEnLaComputadora({ opera: false, capa: 'pm' }, sinOps), '/general');
  assert.equal(CASA_SIN_OPS_CENTER, '/general');
  // El que opera no depende del plan del negocio: su Ops Center no es una tab de una capa.
  assert.equal(casaEnLaComputadora({ opera: true, capa: 'pm' }, () => false), '/admin/operaciones');
});

test('2: las dos casas son las filas «Ops Center» de la barra (nav.ts)', () => {
  assert.equal(OPS_CENTER.label, 'Ops Center');
  assert.equal(OPS_CENTER.href, RUTA_OPS_CENTER, 'la fila del super admin');
  const negocio = MAKO_NAV.find((it) => it.key === 'mako');
  assert.ok(negocio, 'la fila `mako` salió de MAKO_NAV');
  assert.equal(negocio.label, 'Ops Center');
  assert.equal(negocio.href, RUTA_OPS_CENTER_NEGOCIO, 'la fila de cada negocio');
  // El equipo también la ve: si closer y setter la perdieran, mandarlos ahí los rebotaría.
  assert.deepEqual([...(negocio.rolesWs ?? [])].sort(), ['closer', 'setter']);
});

test('3: el repartidor: teléfono primero, después quienOpera, el onboarding y la casa del Ops Center', () => {
  const p = codigo('app/inicio/page.tsx');
  const telefono = p.indexOf('if (telefono) redirect(await rutaConWs(ENTRADA_MOVIL));');
  const opera = p.indexOf('const opera = await quienOpera();');
  const onboarding = p.indexOf("if (!opera && (await onboardingPendiente())) redirect(await rutaConWs('/onboarding'));");
  const casa = p.indexOf('redirect(await rutaConWs(casaEnLaComputadora({ opera, capa: opera ? null : await getCapaActual() })));');
  assert.ok(telefono > 0, 'el teléfono sigue resolviéndose antes (lo lleva su propio agente)');
  assert.ok(opera > telefono, '`quienOpera` va después del teléfono');
  assert.ok(onboarding > opera, 'el onboarding pendiente va después de saber si opera, y sólo para quien no opera');
  assert.ok(casa > onboarding, 'la casa va al final, con `rutaConWs`');
  // La casa de antes ya no es destino de nadie en la computadora.
  assert.doesNotMatch(p, /redirect\([^)]*'\/general'/, '/general volvió a ser la casa');
  assert.doesNotMatch(p, /'\/crm'/, 'el closer/setter volvió a su CRM');
  // El admin SIN workspace (no hay Ops Center que abrir) sigue en su panel: la línea la fija también movil-desvio.
  // En la computadora, su grilla de negocios: Customers desde el 25/10/2026.
  assert.ok(p.includes("if (ws == null) redirect(telefono ? ENTRADA_MOVIL : '/admin');"));
});

test('4: los otros caminos de entrada van al repartidor, no a /general ni a la landing', () => {
  // Admin (la copia de Polar desde el 6/11/2026): «Entrar a su cuenta» en la ficha de un negocio y «Abrir su MaKo» en un pedido.
  const ficha = codigo('app/admin/_polar/web/Customer/CustomerPage/CustomerHeader.tsx');
  assert.match(ficha, /<a href=\{`\/inicio\?ws=\$\{negocio\.ws\}`\}>Entrar a su cuenta<\/a>/, '«Entrar a su cuenta» de la ficha');
  assert.match(codigo('app/admin/_polar/web/Orders/OrderCustomerContext.tsx'), /href=\{`\/inicio\?ws=\$\{customer\.ws\}`\}/, '«Abrir su MaKo» de un pedido');
  for (const f of ['app/admin/_polar/web/Customer/CustomerPage/CustomerHeader.tsx', 'app/admin/_polar/web/Orders/OrderCustomerContext.tsx']) {
    assert.doesNotMatch(codigo(f), /\/general\?ws=/, `${f}: a /general y no al repartidor`);
  }
  const partners = codigo('app/partners/PartnersApp.tsx');
  assert.match(partners, /if \(superAdmin\) \{ window\.location\.href = `\/inicio\?ws=\$\{ws\}`; return; \}/);
  assert.doesNotMatch(partners, /window\.location\.href = '\/general'/, 'la agencia entraba a /general');
  const plan = codigo('app/no-esta-en-tu-plan/page.tsx');
  assert.match(plan, /rutaConWs\('\/inicio'\)/, '«Ir al inicio» del cartel del plan');
  assert.doesNotMatch(plan, /homeDeCapa/);
  const google = codigo('app/api/auth/callback/google/route.ts');
  assert.match(google, /const next = req\.cookies\.get\('oauth_next'\)\?\.value;/, 'sin la cookie, `destinoSeguro` da /inicio');
  assert.doesNotMatch(google, /oauth_next'\)\?\.value \|\| '\/'/, 'la vuelta de Google caía a la landing');
  assert.match(codigo('app/admin/agente/page.tsx'), /if \(!\(await getSesionAdmin\(\)\)\) redirect\('\/inicio'\);/);
});
