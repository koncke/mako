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
  const nuevos = [
    ...archivos('app/admin/_studio'), ...archivos('app/admin/usuarios'), ...archivos('app/admin/ingresos').filter((f) => !f.endsWith('ingresos-vista.ts')),
    // Billing (6/11/2026): la página, sus piezas y su recibo. Las acciones (actions.ts, recibos-actions.ts) son del servidor.
    ...archivos('app/admin/cobros').filter((f) => !/\/(actions|recibos-actions|page)\.tsx?$/.test(f)),
  ];
  assert.ok(nuevos.length > 50, `el barrido no está leyendo los archivos (${nuevos.length})`);
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

// ── Billing (6/11/2026): la página de finanzas de Studio Admin y su recibo ──────────────────────────────────────────────

test('7 · Billing: las cifras, el aviso, los repartos y la línea salen de lo que entró, sin inventar', async () => {
  const { avisoDe, cifrasDe, comoEntra, desdeDe, porMedio, proximosDe, serieDe } = await import('../app/admin/cobros/billing-vista');
  const hoy = '2026-11-06';
  const porCobrar = [
    { cliente: 'ws:3', fecha: '2026-11-10', usd: 97, atrasado: false },
    { cliente: 'ws:4', fecha: '2026-11-01', usd: 47, atrasado: true },
  ];
  const cifras = cifrasDe({ cobradoEsteMes: 144, cobradoMesPasado: 97, mrr: 200, mrrMesPasado: 160, porCobrar });
  assert.deepEqual(cifras.map((c) => [c.id, c.valor]), [['mes', 'US$ 144'], ['mrr', 'US$ 200'], ['vence', 'US$ 97'], ['atrasado', 'US$ 47']]);
  assert.equal(cifras[0].insignia, null, 'el mes en curso está a medias: sin % contra el pasado');
  assert.deepEqual(cifras[1].insignia, { texto: '+25%', mala: false });
  assert.deepEqual(cifras[3].insignia, { texto: '1', mala: true });

  const entradas = [
    { fecha: '2025-01-10', usd: 500, medio: 'stripe', recurrente: false, nombre: 'Viejo' },
    { fecha: '2026-10-05', usd: 97, medio: 'stripe', recurrente: true, nombre: 'A' },
    { fecha: '2026-11-02', usd: 47, medio: 'binance', recurrente: true, nombre: 'B' },
    { fecha: '2026-11-03', usd: null, medio: 'mercadopago', recurrente: false, nombre: 'C' },
  ];
  assert.equal(desdeDe('12m', hoy), '2025-12-01');
  assert.equal(desdeDe('todo', hoy), null);
  assert.deepEqual(comoEntra(entradas, desdeDe('12m', hoy), hoy).map((p) => [p.id, p.usd, p.pct]), [['recurrente', 144, 100]], 'lo de hace dos años y lo sin dólares no suman');
  assert.deepEqual(porMedio(entradas, null, hoy).map((p) => [p.rotulo, p.usd]), [['Stripe', 597], ['Binance', 47]]);
  const mes = serieDe(entradas, porCobrar, 'mes', hoy);
  assert.equal(mes.length, 60);
  const hoyPunto = mes.find((p) => p.t === Date.parse(`${hoy}T00:00:00Z`))!;
  assert.equal(hoyPunto.vence, hoyPunto.cobrado, 'la punteada arranca donde termina la llena');
  assert.equal(mes.find((p) => p.rotulo === '10 nov')?.vence, 97, 'lo que vence, en su día');
  assert.equal(mes.find((p) => p.rotulo === '2 nov')?.cobrado, 47);
  assert.ok(!mes.some((p) => p.rotulo === '1 nov' && (p.vence ?? 0) > 0), 'lo atrasado no se dibuja como lo que vence');

  const proximos = proximosDe({ porCobrar, clientes: [{ clave: 'ws:3', nombre: 'Estudio Ejemplo', ws: 3, leadId: null }] as never });
  assert.deepEqual(proximos.map((p) => [p.nombre, p.atrasado, p.ruta]), [['ws:4', true, null], ['Estudio Ejemplo', false, '/admin?tab=customers&cliente=3']]);

  assert.equal(avisoDe({ pasarelas: [], cobros: [], porCobrar: [], wsPlataforma: 9 })?.href, '/integraciones?ws=9', 'sin pasarela, a conectarla en el ws de MaKo');
  assert.equal(avisoDe({ pasarelas: ['stripe'], cobros: [{ estado: 'pagado', alta_estado: 'error' }], porCobrar, wsPlataforma: 9 })?.id, 'alta');
  assert.equal(avisoDe({ pasarelas: ['stripe'], cobros: [], porCobrar, wsPlataforma: 9 })?.id, 'atrasado');
  assert.equal(avisoDe({ pasarelas: ['stripe'], cobros: [], porCobrar: [], wsPlataforma: 9 }), null, 'sin nada que esperar, no hay aviso');
});

test('8 · Cargar pago: lo que se valida antes, y lo que viaja al servidor', async () => {
  const { pedidoDe, problemaDe, recibido, totalDetalle, valoresIniciales, diferenciaDe } = await import('../app/admin/cobros/recibo/data');
  const f = valoresIniciales('2026-11-06');
  assert.equal(problemaDe(f, false), 'Elige la cuenta.');
  f.cuenta = '13';
  f.aNombre = ' Agencia Ejemplo ';
  assert.equal(problemaDe(f, false), 'Cada renglón necesita concepto e importe.');
  f.lineas = [{ id: 'l1', concepto: 'Plan Pro', mes: 'noviembre', monto: 97 }, { id: 'l2', concepto: 'Cuenta de un cliente', mes: '', monto: 47 }];
  assert.equal(problemaDe(f, false), 'La orden de Binance son los 18 dígitos del «Order ID».');
  f.pagos[0] = { ...f.pagos[0], referencia: '123456789012345678', monto: 144, moneda: 'USDT' };
  assert.equal(problemaDe(f, true), 'Espera a que termine de subir el comprobante.');
  assert.equal(problemaDe(f, false), null);
  assert.equal(totalDetalle(f), 144);
  assert.deepEqual(recibido(f), [{ moneda: 'USDT', monto: 144 }]);
  assert.equal(diferenciaDe(f), null, 'USD contra USDT no se compara: no se inventa una tasa');
  assert.equal(diferenciaDe({ ...f, moneda: 'USDT' }), 0);
  assert.equal(diferenciaDe({ ...f, moneda: 'USDT', pagos: [{ ...f.pagos[0], monto: 150 }] }), 6, 'de más');
  const p = pedidoDe(f, 'form-1', true);
  assert.equal(p.destinoWs, 13);
  assert.equal(p.aNombre, 'Agencia Ejemplo');
  assert.deepEqual(p.lineas.map((l) => [l.concepto, l.mes, l.monto, l.moneda]), [['Plan Pro', 'noviembre', 97, 'USD'], ['Cuenta de un cliente', null, 47, 'USD']], 'una sola moneda por recibo');
  assert.equal(p.pagos[0].fecha, '2026-11-06T12:00', 'la fecha y la hora, como las mandaba la pantalla de antes');
  assert.equal(p.enviar, true);
});

test('9 · Billing: la pestaña viaja en ?vista=, el recibo en ?recibo=nuevo, y la impresión no deja en blanco otras pantallas', () => {
  const page = sinComentarios(leer('app/admin/page.tsx'));
  assert.match(page, /tab === 'billing' \? <Billing vista=\{sp\.vista\} recibo=\{sp\.recibo\} \/>/);
  const billing = sinComentarios(leer('app/admin/cobros/billing.tsx'));
  assert.match(billing, /if \(recibo === "nuevo"\) \{/);
  const finance = sinComentarios(leer('app/admin/cobros/_components/finance.tsx'));
  assert.match(finance, /url\.searchParams\.set\("vista", nueva\);\s*window\.history\.replaceState\(window\.history\.state, "", url\);/);
  const css = sinComentarios(leer('app/admin/_studio/studio-theme.css'));
  assert.match(css, /body:has\(> \[data-print-root\]\) > \*:not\(\[data-print-root\]\) \{/);
  assert.doesNotMatch(css, /^\s*body > \*:not\(\[data-print-root\]\)/m, 'sin el :has(), imprimir cualquier pantalla de MaKo da una hoja en blanco');
});
