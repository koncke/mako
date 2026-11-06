// =============================================================================
// Admin con el diseño de Studio Admin: lo que el porte no puede perder (5/11/2026)
// =============================================================================
// Martín rechazó el Admin anterior (5/11/2026: «copies tanto el diseño como la funcionalidad de alguna otra aplicación o
// repositorio de GitHub») y Admin pasó a ser el código de Studio Admin (arhamkhnz/next-shadcn-admin-dashboard, MIT) portado
// en app/admin/_studio, app/admin/usuarios y app/admin/ingresos. Lo que fija, ejecutando lo que se puede y leyendo lo demás:
//   1. el tema de Studio vive en `.sa` y no se derrama: nada de `:root`, el oscuro es el de MaKo, y las variantes de shadcn
//      (`data-open:`…) tienen su rama de siempre afuera de `.sa`;
//   2. todo portal de radix va al contenedor de adentro de `.sa` (en <body> se dibuja sin colores) y el shell lo dibuja;
//   3. las seis secciones del sidebar son las de siempre, por `?tab=` (los links viejos siguen andando);
//   4. la letra es Geist local (nunca `next/font/google`, que tiró builds) y las pantallas no usan app/_ui salvo el Link y
//      «Reportar a Soporte»;
//   5. Users: las opciones de los filtros salen de las personas, el texto del estado es uno solo, la fecha no depende de la
//      zona de la máquina, y el «…» trae «Ver su negocio» sólo con un negocio;
//   6. la estrella de MaKo se corre al costado del sidebar de Studio.
//
// Probado rompiéndolo el 5/11/2026 (base: 6/6; renombrar una variable local de los filtros: 6/6). Cada rotura, sola:
//   · `.sa {` del tema cambiado por `:root {`                                         → 1 fallo (1)
//   · la rama `:not(:where(.sa, .sa *))[data-active]` borrada de `data-active`        → 1 fallo (1)
//   · `container={portalSa()}` sacado del Portal del select                           → 1 fallo (2)
//   · `<div id={ID_PORTAL_SA} />` sacado del shell                                    → 1 fallo (2)
//   · Users en `/admin?tab=usuarios` (una sección que no existe)                      → 1 fallo (3)
//   · `fonts.ts` con `next/font/google`                                               → 1 fallo (4)
//   · `filtrosDe` con la lista de roles escrita a mano                                → 1 fallo (5)
//   · `fechaHoraTxt` sin `timeZone`                                                    → 1 fallo (5)
//   · `data-barra-de-la-tab` sacado del contenedor del sidebar                         → 1 fallo (6)
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sidebarItems } from '../app/admin/_studio/shell/sidebar-items';
import { rutaPestanaAdmin, PESTANAS_BARRA } from '../app/admin/pestanas-reglas';
import { estadoTxt, fechaHoraTxt, filtrosDe, minutosDesde, negocioTxt, type UserRow } from '../app/admin/usuarios/data';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const AHORA = Date.parse('2026-11-05T15:00:00Z');

test('1 · el tema de Studio vive en `.sa`: sin :root, con el oscuro de MaKo, y las variantes de shadcn sólo adentro', () => {
  const css = sinComentarios(leer('app/admin/_studio/studio-theme.css'));
  assert.doesNotMatch(css, /:root\b/, 'un token de Studio en :root le cambia los colores a todo MaKo');
  assert.match(css, /^\.sa \{[^}]*--radius: 0\.625rem;[^}]*--sidebar: oklch\(0\.985 0 0\);/m, 'los valores de Studio, en .sa');
  assert.match(css, /^\[data-tema="oscuro"\] \.sa \{[^}]*--background: oklch\(0\.145 0 0\);/m, 'su .dark es el oscuro de MaKo');
  assert.doesNotMatch(css, /\.dark\b/, 'MaKo no usa la clase .dark');
  for (const v of ['open', 'closed', 'checked', 'unchecked', 'selected', 'disabled', 'active', 'horizontal', 'vertical']) {
    const bloque = css.slice(css.indexOf(`@custom-variant data-${v} {`), css.indexOf('}', css.indexOf(`@custom-variant data-${v} {`) + 30) + 200);
    assert.match(bloque, new RegExp(`&:not\\(:where\\(\\.sa, \\.sa \\*\\)\\)\\[data-${v}\\] \\{ @slot; \\}`), `data-${v}: afuera de .sa, la de Tailwind`);
    assert.match(bloque, /&:where\(\.sa, \.sa \*\):where\(/, `data-${v}: adentro, la de shadcn`);
  }
  assert.match(leer('app/globals.css'), /@import "\.\/admin\/_studio\/studio-theme\.css";/);
  // La regla de la barra de MaKo sobre [data-sidebar] no alcanza al sidebar de Studio (le ponía un filete en cada grupo).
  const ui = leer('app/_ui/ui.css');
  assert.match(ui, /\[data-sidebar\]:not\(\.sa \[data-sidebar\]\) > div \{/);
});

test('2 · todo portal va al contenedor de adentro de `.sa`, y el shell lo dibuja', () => {
  const dir = 'app/admin/_studio/components/ui';
  let portales = 0;
  for (const f of readdirSync(join(RAIZ, dir))) {
    const src = sinComentarios(leer(`${dir}/${f}`));
    for (const m of src.matchAll(/<\w+Primitive\.Portal\b[^>]*>/g)) {
      portales++;
      assert.match(m[0], /container=\{portalSa\(\)\}/, `${f}: ${m[0]} sale a <body>, sin los colores de Studio`);
    }
  }
  assert.ok(portales >= 7, `el barrido no encontró los portales (${portales})`);
  const shell = sinComentarios(leer('app/admin/_studio/shell/AdminShell.tsx'));
  assert.match(shell, /<div className=\{cn\("sa min-w-0 flex-1", geistSa\.variable\)\}>/, 'la raíz es .sa');
  assert.match(shell, /<div id=\{ID_PORTAL_SA\} \/>/, 'el contenedor de los portales, adentro de .sa');
});

test('3 · las seis secciones del sidebar son las de siempre, por ?tab= (los links viejos andan)', () => {
  const items = sidebarItems.flatMap((g) => g.items);
  assert.deepEqual(items.map((i) => ('tab' in i ? i.tab : null)).sort(), [...PESTANAS_BARRA].sort());
  for (const i of items) if ('tab' in i && i.tab) assert.equal(i.url, rutaPestanaAdmin(i.tab), `${i.title}: la URL sale de rutaPestanaAdmin`);
  const page = sinComentarios(leer('app/admin/page.tsx'));
  assert.match(page, /<AdminShell /, 'Admin se dibuja con el shell de Studio');
  assert.doesNotMatch(page, /PestanasAdmin|<Pagina|PageHeader/, 'la barra de pestañas y la cabecera de antes se borraron');
  const nav = sinComentarios(leer('app/admin/_studio/shell/nav-main.tsx'));
  assert.match(nav, /return path === "\/admin" && item\.tab === seccion;/, 'el ítem activo es el de la sección');
});

test('4 · la letra es Geist local, y las pantallas portadas no usan app/_ui (salvo el Link y «Reportar a Soporte»)', () => {
  const fonts = sinComentarios(leer('app/admin/_studio/fonts.ts'));
  assert.match(fonts, /from "next\/font\/local"/);
  assert.doesNotMatch(fonts, /next\/font\/google/, 'un build que depende de Google se cae');
  const archivos = (d: string): string[] => readdirSync(join(RAIZ, d), { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? archivos(`${d}/${e.name}`) : /\.tsx?$/.test(e.name) ? [`${d}/${e.name}`] : []));
  const nuevos = [...archivos('app/admin/_studio'), ...archivos('app/admin/usuarios'), ...archivos('app/admin/ingresos').filter((f) => !f.endsWith('ingresos-vista.ts'))];
  assert.ok(nuevos.length > 30, `el barrido no está leyendo los archivos (${nuevos.length})`);
  for (const f of nuevos) {
    for (const m of leer(f).matchAll(/from ["']@\/app\/_ui([^"']*)["']/g)) {
      assert.ok(['/Link', '/ReportarASoporte'].includes(m[1]), `${f}: importa app/_ui${m[1]} (las pantallas de Admin son las de Studio)`);
    }
    assert.doesNotMatch(leer(f), /app\/admin\/estilos/, `${f}: usa los estilos de antes`);
  }
});

const u = (p: Partial<UserRow>): UserRow => ({
  id: 1, email: 'a@ejemplo.com', nombre: 'Ana Ruiz', rol: 'usuario', rolWs: 'admin', estado: 'activo', ultimoLogin: '2026-11-03T15:00:00Z',
  creado: '2026-06-20T13:20:00Z', invitacionEnviada: null, workspaceId: 3, negocio: 'Estudio Ejemplo', mfa: false, foto: null, tipo: 'Cliente', ...p,
});

test('5 · Users: los filtros salen de las personas, el estado se dice igual en todos lados y la fecha no depende de la máquina', async () => {
  const filas = [u({}), u({ id: 2, rolWs: 'closer', tipo: 'Agencia', negocio: 'Agencia Ejemplo' }), u({ id: 3, rol: 'admin', rolWs: null, workspaceId: null, negocio: null, tipo: 'Plataforma' })];
  const f = filtrosDe(filas);
  assert.deepEqual(f.role, ['Todos', 'Admin', 'Closer', 'Super admin']);
  assert.deepEqual(f.team, ['Todos', 'Plataforma', 'Agencia', 'Cliente']);
  assert.deepEqual(f.workspace, ['Todos', 'Agencia Ejemplo', 'Estudio Ejemplo', 'Plataforma']);
  assert.deepEqual(f.status, ['Todos', 'Activo', 'Inactivo', 'Invitado', 'Suspendido']);
  assert.equal(negocioTxt(filas[2]), 'Plataforma');
  assert.equal(estadoTxt(u({ ultimoLogin: null, estado: 'invitado' }), AHORA), 'Invitado');
  assert.equal(estadoTxt(u({ estado: 'suspendido' }), AHORA), 'Suspendido');
  assert.equal(fechaHoraTxt('2026-06-20T13:20:00Z', 'America/Argentina/Buenos_Aires'), '20 jun 2026, 10:20');
  assert.equal(fechaHoraTxt('2026-06-20T13:20:00Z', 'UTC'), '20 jun 2026, 13:20');
  assert.equal(fechaHoraTxt(null, 'UTC'), '—');
  assert.equal(minutosDesde(null, AHORA), Number.POSITIVE_INFINITY, 'quien nunca entró, la marca gris');
  assert.equal(Math.round(minutosDesde('2026-11-05T14:00:00Z', AHORA)), 60);
  const { accionesDelMenu } = await import('../app/admin/usuarios/users-columns');
  assert.deepEqual(accionesDelMenu(u({}), AHORA), ['ver', 'inspeccionar', 'suspender']);
  assert.deepEqual(accionesDelMenu(u({ rol: 'admin', workspaceId: null }), AHORA), ['suspender'], 'sin negocio, ni ver ni entrar');
});

test('6 · la estrella de MaKo se corre al costado del sidebar de Studio', () => {
  assert.match(sinComentarios(leer('app/admin/_studio/components/ui/sidebar.tsx')), /data-slot="sidebar-container"\s+data-barra-de-la-tab=""/);
  const tab = sinComentarios(leer('app/_chat/MakoEnLaTab.tsx'));
  assert.match(tab, /const propia = document\.querySelector\('\[data-barra-de-la-tab\]'\);/);
  assert.match(tab, /return Math\.round\(r && r\.width > 0 \? r\.right : medida\?\.getBoundingClientRect\(\)\.right \?\? 0\);/, 'escondida (el teléfono), vale la de MaKo');
});
