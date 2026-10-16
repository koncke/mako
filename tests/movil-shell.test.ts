// =============================================================================
// MaKo Mobile — el shell de /m: lo que se rompe sin dar error
// =============================================================================
//   · la escala móvil forzada en [data-m] tiene los MISMOS valores que el
//     @media (max-width: 820px) de app/globals.css (si se separan, un iPad ve
//     otra app que un teléfono);
//   · app/m/m.css no trae hex, ni 100vh, ni `transition: all`, y toda regla
//     tiene alcance (Next deja cargada la hoja después de salir de /m);
//   · el cromo de escritorio se apaga en /m (esVistaSinChrome) sin volverlo
//     «público», y el título de la pestaña usa los nombres de la barra;
//   · el manifest abre /inicio con `id: '/'`;
//   · la cabecera por defecto y la física de los gestos (lógica pura);
//   · nadie en /m navega con next/link ni pregunta `startsWith('/m')`;
//   · v2: el cromo es CLARO (themeColor = --bg, statusBarStyle `default`), el título
//     grande existe como token (--m-titulo) y la pantalla que entra se anima con `left`,
//     nunca con `transform` (rompería todo lo `position: fixed` de adentro).
//
// Verificado ROMPIÉNDOLO (11/10/2026):
//   · `--fs-sect: 21px` en el bloque [data-m]: 1 fallo («la escala…»).
//   · un `color: #fff` en app/m/m.css: 1 fallo («m.css sin hex…»); una regla
//     `h4 { … }` sin alcance: 1 fallo (el mismo test).
//   · `|| esRutaMovil(p)` quitado de esVistaSinChrome: 1 fallo.
//   · `start_url: '/'` en el manifest: 1 fallo.
//   · la cabecera de /m/crm/12 volviendo a «Today»: 1 fallo.
//   · `UMBRAL_SWIPE = 0.5`: 1 fallo (la física del swipe).
// v2 (11/10/2026; base 14 pasan / 0 fallan), de a una y restaurando, cada una
//     13 / 1 en su test: themeColor de vuelta a '#14161B'; la columna animada con
//     `transform`; sin `--m-titulo` en [data-m]; la sección de More sin «‹ More»;
//     `nivel` contando segmentos de URL (More → Dashboard no deslizaba); `rotuloVolver`
//     sin acortar («‹ Landing Generator» se comía el título).
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { esVistaSinChrome, isPublicLandingPath } from '../app/_components/PublicRouteGate';
import { tituloDe } from '../lib/titulo-tab';
import manifest from '../app/manifest';
import { cabeceraPorRuta, llevaBarra, nivel, rotuloVolver, esTrabajo } from '../app/m/_ui/cabecera';
import { barraMovil } from '../lib/movil-rutas';
import {
  rubberband, decidirSwipe, destinoDelSheet, velocidadDe, ejeDelGesto, distanciaDePull,
} from '../app/m/_ui/gestos';

const leer = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');
const sinComentariosCss = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const sinComentariosTs = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** Parte una lista de selectores por las comas de PRIMER nivel (no las de adentro de :is()). */
function partirPorComas(s: string): string[] {
  const out: string[] = [];
  let prof = 0;
  let actual = '';
  for (const ch of s) {
    if (ch === '(') prof += 1;
    if (ch === ')') prof -= 1;
    if (ch === ',' && prof === 0) { out.push(actual); actual = ''; } else actual += ch;
  }
  out.push(actual);
  return out;
}

function vars(bloque: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of bloque.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

test('la escala de [data-m] es la misma que la del @media del teléfono', () => {
  const css = sinComentariosCss(leer('app/globals.css'));
  const media = css.match(/@media \(max-width: 820px\) \{\s*:root \{([^}]*)\}/);
  const dataM = css.match(/\n\[data-m\] \{([^}]*)\}/);
  assert.ok(media, 'no encontré el @media (max-width: 820px) de la escala');
  assert.ok(dataM, 'no encontré el bloque [data-m] de globals.css');
  const a = vars(media![1]);
  // Los `--m-*` son SÓLO de /m (el título grande): el escritorio no los tiene.
  const b = Object.fromEntries(Object.entries(vars(dataM![1])).filter(([k]) => !k.startsWith('--m-')));
  assert.ok(Object.keys(a).length >= 8, 'el @media tiene menos variables de las esperadas');
  assert.deepEqual(b, a);
});

test('en una pantalla táctil de cualquier ancho (iPad horizontal), 44 de toque y campos de 16', () => {
  // Decisión del 15/10/2026 (la regla de AGENTS.md: lo táctil se decide por capacidad, no por
  // ancho). Sin el bloque, un iPad horizontal quedaba con 40 px de toque y 14 px en los campos,
  // y iOS hace zoom al enfocarlos. Probado rompiéndolo (sin el bloque, y con --fs-md en 15px):
  // 1 fallo cada vez.
  const css = sinComentariosCss(leer('app/globals.css'));
  const tactil = css.match(/@media \(pointer: coarse\) \{\s*:root \{([^}]*)\}/);
  const media = css.match(/@media \(max-width: 820px\) \{\s*:root \{([^}]*)\}/);
  assert.ok(tactil, 'no encontré el @media (pointer: coarse) de la escala táctil');
  const t = vars(tactil![1]);
  assert.equal(t['--touch'], '44px');
  assert.equal(t['--fs-md'], '16px', 'un campo de menos de 16 px hace zoom en iOS');
  // Las mismas variables que el teléfono, con los mismos valores; y los títulos NO bajan.
  const tel = vars(media![1]);
  for (const [k, v] of Object.entries(t)) assert.equal(v, tel[k], `${k} se separó de la escala del teléfono`);
  for (const k of ['--fs-page', '--fs-sect', '--fs-kpi']) assert.ok(!(k in t), `${k} no baja en un iPad: es del teléfono angosto`);
});

test('el título grande de la v2 es un token de [data-m]: 32 px', () => {
  const css = sinComentariosCss(leer('app/globals.css'));
  const dataM = css.match(/\n\[data-m\] \{([^}]*)\}/);
  assert.equal(vars(dataM![1])['--m-titulo'], '32px');
  // Y m.css lo usa (un token que nadie lee es uno que se borra «porque sobra»).
  assert.match(sinComentariosCss(leer('app/m/m.css')), /font-size:\s*var\(--m-titulo\)/);
});

test('los tokens del shell existen UNA vez en :root', () => {
  const css = sinComentariosCss(leer('app/globals.css'));
  for (const t of ['--ease-out', '--ease-in-out', '--ease-drawer', '--dur-press', '--dur-pop', '--dur-sheet',
    '--dur-sheet-out', '--m-header', '--m-tabbar', '--m-gutter', '--scrim']) {
    const n = css.split(new RegExp(`\\n\\s*${t}\\s*:`)).length - 1;
    assert.equal(n, 1, `${t} declarado ${n} veces`);
  }
});

test('m.css sin hex, sin 100vh, sin transition: all, y todo con alcance', () => {
  const css = sinComentariosCss(leer('app/m/m.css'));
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/, 'un hex en m.css: sólo var(--token)');
  assert.doesNotMatch(css, /100vh/, '100vh en m.css: va 100dvh');
  assert.doesNotMatch(css, /transition\s*:\s*all/);
  // Cada selector de primer nivel tiene alcance de /m.
  const sinAt = css
    .replace(/@keyframes[^{]*\{(?:[^{}]*\{[^}]*\})*\s*\}/g, '')
    .replace(/@(media|starting-style)[^{]*\{/g, '')
    .replace(/\{[^}]*\}/g, '{}');
  const selectores = sinAt.split('{}').map((s) => s.trim()).filter(Boolean)
    .flatMap((s) => partirPorComas(s).map((x) => x.trim().replace(/^\}+\s*/, '')))
    .filter(Boolean);
  const conAlcance = /^(\[data-m\]|\.m-|:root:has\(#m-root\)|:root:has\(\.m-sheet-capa\)|\[data-tema="oscuro"\] \.m-)/;
  const sueltos = selectores.filter((s) => !conAlcance.test(s));
  assert.deepEqual(sueltos, [], 'reglas sin alcance de /m');
});

test('el viewport de /m: cover, sin bloquear el zoom, themeColor = --bg (cromo claro)', () => {
  const src = sinComentariosTs(leer('app/m/layout.tsx'));
  assert.match(src, /viewportFit:\s*'cover'/);
  assert.match(src, /interactiveWidget:\s*'resizes-content'/);
  assert.doesNotMatch(src, /maximumScale|userScalable/);
  // El PRIMER --bg de globals.css es el del tema claro (:root), que es el de por defecto.
  const bg = leer('app/globals.css').match(/\n\s*--bg:\s*(#[0-9A-Fa-f]{6});/)![1];
  assert.match(src, new RegExp(`themeColor:\\s*'${bg}'`, 'i'));
  // Con el encabezado claro, el reloj de iOS va en oscuro: `default`, no `black-translucent`.
  assert.match(sinComentariosTs(leer('app/layout.tsx')), /statusBarStyle:\s*'default'/);
  // Y el cromo no vuelve a ser oscuro: ni el encabezado ni la barra pintan --sidebar.
  const css = sinComentariosCss(leer('app/m/m.css'));
  for (const sel of ['m-cabecera', 'm-barra']) {
    const bloque = css.match(new RegExp(`\\n\\.${sel} \\{([^}]*)\\}`));
    assert.ok(bloque, `no encontré .${sel} en m.css`);
    assert.doesNotMatch(bloque![1], /--sidebar/, `.${sel} volvió al cromo oscuro de la v1`);
  }
});

test('la pantalla que entra se anima con `left`, nunca con `transform` (los fixed de adentro saltarían)', () => {
  const src = sinComentariosTs(leer('app/m/_ui/ShellM.tsx'));
  assert.match(src, /el\.animate\(\[\{ left: '100%' \}, \{ left: '0px' \}\]/);
  assert.doesNotMatch(src, /el\.animate\([^)]*transform/, 'un transform en la columna descoloca el composer y el pie fijo');
  assert.match(sinComentariosCss(leer('app/m/m.css')), /\.m-columna \{[^}]*position: relative/);
});

test('/m apaga el cromo de escritorio sin volverse público', () => {
  for (const p of ['/m', '/m/hoy', '/m/crm/3']) {
    assert.equal(esVistaSinChrome(p), true, p);
    assert.equal(isPublicLandingPath(p), false, p);
  }
  assert.equal(esVistaSinChrome('/mako'), false);
  assert.equal(esVistaSinChrome('/marketing'), false);
});

test('el título de la pestaña en /m usa los nombres de la barra', () => {
  assert.equal(tituloDe('/m/hoy'), 'MaKo - General');
  assert.equal(tituloDe('/m/chats'), 'MaKo - Chats');
  assert.equal(tituloDe('/m/inbox'), 'MaKo - Avisos', 'la campana se titula Avisos (prototipo v3), como su cabecera');
  assert.equal(tituloDe('/m/mako'), 'Pregúntale a MaKo', 'el nombre de la sidebar, que ya dice MaKo');
  assert.equal(tituloDe('/m/crm/12'), 'MaKo - CRM');
  assert.equal(tituloDe('/m/cuenta'), 'MaKo - Tu cuenta');
  assert.equal(tituloDe('/m'), 'MaKo');
});

test('el manifest abre el repartidor y conserva la identidad', () => {
  const m = manifest();
  assert.equal(m.id, '/');
  assert.equal(m.start_url, '/inicio');
  assert.equal(m.scope, '/');
  assert.equal(m.display, 'standalone');
  assert.ok((m.icons ?? []).length >= 3, 'se perdieron los íconos');
  // LAS MISMAS RUTAS (13/10/2026): los atajos son las URLs de escritorio; el proxy le sirve /m al teléfono.
  assert.deepEqual((m.shortcuts ?? []).map((s) => [s.name, s.url]),
    [['General', '/general'], ['Avisos', '/mako/pendientes'], ['CRM', '/crm']]);
});

test('la cabecera por defecto: título en la raíz, volver fijo en la subpantalla', () => {
  const t = (titulo: string, padre: { href: string; label: string } | null, trabajo = false, conBarra = true) => ({ titulo, padre, trabajo, conBarra });
  // Las raíces de la barra: el nombre, sin volver.
  assert.deepEqual(cabeceraPorRuta('/m/hoy'), t('General', null));
  assert.deepEqual(cabeceraPorRuta('/m/crm'), t('CRM', null));
  assert.deepEqual(cabeceraPorRuta('/m/chats'), t('Chats', null));
  // Inbox dejó la barra (v3): es la campana de General, se titula Avisos y vuelve a General.
  // Probado rompiéndolo (15/10/2026): TITULO_INBOX = 'Inbox' → 14 / 2 (pestaña y cabecera); el atajo del
  // manifest con 'Inbox' → 15 / 1. Base 16 / 0.
  assert.deepEqual(cabeceraPorRuta('/m/inbox'), t('Avisos', { href: '/m/hoy', label: 'General' }));
  assert.deepEqual(cabeceraPorRuta('/m/mas'), t('More', null));
  // Una subpantalla vuelve a su raíz; el título lo pone la página.
  assert.deepEqual(cabeceraPorRuta('/m/crm/12'), t('', { href: '/m/crm', label: 'CRM' }));
  // Las secciones de More vuelven a More; sus subpantallas, a la sección.
  assert.deepEqual(cabeceraPorRuta('/m/dashboard'), t('Dashboard', { href: '/m/mas', label: 'More' }));
  assert.deepEqual(cabeceraPorRuta('/m/cs'), t('Clientes', { href: '/m/mas', label: 'More' }));
  assert.deepEqual(cabeceraPorRuta('/m/ads/9'), t('', { href: '/m/ads', label: 'Ads Manager' }));
  // La cuenta es la primera fila de More.
  assert.deepEqual(cabeceraPorRuta('/m/cuenta'), t('Tu cuenta', { href: '/m/mas', label: 'More' }));
  assert.deepEqual(cabeceraPorRuta('/m/cuenta/instalar'), t('', { href: '/m/cuenta', label: 'Tu cuenta' }));
  assert.deepEqual(cabeceraPorRuta('/m/raro'), t('', { href: '/m/hoy', label: 'General' }));
  // Pantallas de trabajo: sin título grande y sin barra de abajo.
  assert.deepEqual(cabeceraPorRuta('/m/mako'), t('Pregúntale a MaKo', { href: '/m/mas', label: 'More' }, true, false));
  assert.deepEqual(cabeceraPorRuta('/m/video/7'), t('', { href: '/m/video', label: 'Video' }, true, false));
  assert.deepEqual(cabeceraPorRuta('/m/landing/3'), t('', { href: '/m/landing', label: 'Web Generator' }, true, false));
  assert.equal(esTrabajo('/m/video'), false, 'la LISTA de videos es una sección normal');
  // El chat de WhatsApp de un lead: de trabajo desde el server, y vuelve a SU ficha.
  assert.deepEqual(cabeceraPorRuta('/m/crm/12/chat'), t('', { href: '/m/crm/12', label: 'Ficha' }, true, false));
  assert.equal(esTrabajo('/m/crm/12'), false, 'la ficha no es de trabajo');
  assert.equal(llevaBarra('/m/configurar'), false);
  assert.equal(llevaBarra('/m/hoy'), true);
  assert.equal(llevaBarra('/m/video/7'), false);
  // Una sección que subió a la barra es una raíz: sin volver y CON barra (aunque sea de trabajo).
  assert.deepEqual(cabeceraPorRuta('/m/mako', barraMovil('setter', 'pm')), t('Pregúntale a MaKo', null, true, true));
  assert.deepEqual(cabeceraPorRuta('/m/dashboard', barraMovil('admin', 'pm')), t('Dashboard', null));
});

test('el nivel de una pantalla: ir más adentro desliza; cambiar de tab y volver, no', () => {
  // Cambiar de tab: 0 → 0.
  for (const p of ['/m/hoy', '/m/crm', '/m/chats', '/m/plan', '/m/mas']) assert.equal(nivel(p), 0, p);
  // Inbox se abre desde la campana de General: un nivel más adentro.
  assert.equal(nivel('/m/inbox'), 1);
  // More → una sección (la MISMA profundidad de URL, pero un nivel más adentro).
  assert.equal(nivel('/m/dashboard'), 1);
  assert.equal(nivel('/m/cuenta'), 1);
  assert.equal(nivel('/m/crm/12'), 1);
  assert.equal(nivel('/m/crm/12/chat'), 2);
  assert.equal(nivel('/m/video/7'), 2);
  assert.equal(nivel('/m/cuenta/instalar'), 2);
  // Subida a la barra, una sección es raíz.
  assert.equal(nivel('/m/dashboard', barraMovil('admin', 'pm')), 0);
  assert.equal(nivel('/m/dashboard/x', barraMovil('admin', 'pm')), 1);
});

test('el «volver» corto: un padre largo pasa a «Atrás» (el nombre entero va en el aria-label)', () => {
  assert.equal(rotuloVolver('More'), 'More');
  assert.equal(rotuloVolver('CRM'), 'CRM');
  assert.equal(rotuloVolver('Perfil'), 'Perfil');
  assert.equal(rotuloVolver('Landing Generator'), 'Atrás');
  assert.equal(rotuloVolver('Customer Success'), 'Atrás');
});

test('la física de los gestos', () => {
  // Rubber-band: menos que el dedo, conserva el signo, 0 sin sobrante.
  assert.ok(rubberband(100, 1000) < 100 && rubberband(100, 1000) > 40);
  assert.ok(rubberband(-100, 1000) < 0);
  assert.equal(rubberband(0, 1000), 0);
  assert.equal(distanciaDePull(-20, 800), 0);
  // Eje: nada antes de 10 px, el vertical gana los empates.
  assert.equal(ejeDelGesto(5, 3), null);
  assert.equal(ejeDelGesto(20, 4), 'x');
  assert.equal(ejeDelGesto(12, 12), 'y');
  // Swipe: 35% del ancho, o un flick EN el mismo sentido.
  assert.equal(decidirSwipe(36, 100, 0), 'derecha');
  assert.equal(decidirSwipe(30, 100, 0), null);
  assert.equal(decidirSwipe(20, 100, 0.2), 'derecha');
  assert.equal(decidirSwipe(60, 100, -0.2), null);
  assert.equal(decidirSwipe(-40, 100, 0), 'izquierda');
  // Velocidad: con una muestra no se inventa un flick.
  assert.equal(velocidadDe([{ v: 0, t: 0 }]), 0);
  assert.equal(velocidadDe([{ v: 0, t: 0 }, { v: 50, t: 100 }]), 0.5);
  // Sheet: un flick hacia abajo desde «medio» cierra; quieto en alto, queda.
  const alturas = { medio: 400, alto: 800 };
  assert.equal(destinoDelSheet({ visible: 380, velocidad: 0.5, alturas, desde: 'medio' }), 'cerrado');
  assert.equal(destinoDelSheet({ visible: 790, velocidad: 0, alturas, desde: 'alto' }), 'alto');
  assert.equal(destinoDelSheet({ visible: 420, velocidad: -0.5, alturas, desde: 'medio' }), 'alto');
  assert.equal(destinoDelSheet({ visible: 700, velocidad: 0.05, alturas, desde: 'alto' }), 'alto');
  assert.equal(destinoDelSheet({ visible: 500, velocidad: 0.05, alturas, desde: 'alto' }), 'medio');
});

function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(join(__dirname, '..', dir))) {
    const rel = `${dir}/${n}`;
    if (statSync(join(__dirname, '..', rel)).isDirectory()) out.push(...archivos(rel));
    else if (/\.(ts|tsx)$/.test(n)) out.push(rel);
  }
  return out;
}

test('nadie en /m navega con next/link ni pregunta startsWith(\'/m\')', () => {
  const propios = [
    ...archivos('app/m'),
    'lib/movil-rutas.ts', 'lib/movil-guard.ts', 'lib/movil-dispositivo.ts', 'lib/movil-instalar.ts', 'lib/haptico.ts',
    'app/_components/PublicRouteGate.tsx', 'app/_components/NotificationsProvider.tsx', 'lib/titulo-tab.ts',
  ];
  for (const f of propios) {
    const src = sinComentariosTs(leer(f));
    assert.doesNotMatch(src, /startsWith\(\s*['"]\/m['"]\s*\)/, `${f}: startsWith('/m') atrapa /mako y /m.js`);
    if (f.startsWith('app/m/')) {
      assert.doesNotMatch(src, /from\s+['"]next\/link['"]/, `${f}: Link va de @/app/_ui/Link`);
      assert.doesNotMatch(src, /import\s*\{[^}]*\buseRouter\b[^}]*\}\s*from\s*['"]next\/navigation['"]/, `${f}: useRouter va de @/app/_ui/Link`);
    }
  }
});

// Martín (14/10/2026): llegar a las decisiones desde el teléfono como super admin sin saberse la URL.
// Esa misma noche la renombró «Ticketera» y pidió entrar directo al mazo (la lista es secundaria).
// Probado rompiéndolo: sin el `ctx.sesion.rol === 'admin'` delante de la fila → 14 / 1.
// Desde el 15/10/2026 la sección también se apaga mientras el super admin MIRA a un cliente
// (`!ctx.impersonando`, como el Sidebar), y lleva además el Centro de Operaciones.
test('More: «Ticketera» (el mazo de decisiones) sólo para el super admin, y fuera de SECCIONES_MAS', () => {
  const mas = leer('app/m/mas/page.tsx').replace(/\/\/.*$/gm, '');
  assert.match(mas, /ctx\.sesion\.rol === 'admin' && !ctx\.impersonando && \(\s*<SeccionM titulo="Super admin">[\s\S]*?titulo="Ticketera" href=\{RUTA_TICKETERA\}/,
    'la fila va detrás de la pregunta de super admin (la misma de getSesionAdmin), sin mirar a un cliente');
  assert.match(mas, /const RUTA_TICKETERA = '\/m\/tickets\/decisiones'/);
  // No es una tab del negocio: si estuviera en SECCIONES_MAS podría subir a la barra de un rol.
  assert.doesNotMatch(leer('lib/movil-rutas.ts'), /id: 'decisiones'/);
});
