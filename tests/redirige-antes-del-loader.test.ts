// =============================================================================
// Una página con loader que REDIRIGE lo hace en su layout, antes del loader (23/10/2026, ticket #7)
// =============================================================================
// Un `redirect()` adentro de una página con `loading.tsx` va adentro del stream (200 + meta refresh, no 307). En /general
// la carrera con la hidratación tiró «Minified React error #310» en el router de Next (errores_app id 5; /general dejó el
// loader). /plan y /second-brain redirigen al super admin y se quedan con el loader (Martín lo pidió): la redirección va en
// su LAYOUT, que queda afuera del loading.tsx y devuelve el 307. El layout no recibe la query ni sabe la ruta: las dos las
// pone el proxy en headers que pisa (lib/pedido-actual.ts).
// ROTURAS (23/10/2026, una por vez y restaurada; base 5 / 0): el proxy sin HEADER_QUERY → 4 / 1; el layout de /plan sin el
// chequeo de la ruta exacta (redirigiría también /plan/agencia: un bucle) → 4 / 1; el de /second-brain sin `quienOpera` →
// 4 / 1; `queryComoSearchParams` que pierde los repetidos → 4 / 1.
// LOS DASHBOARDS (25/10/2026; base 9 / 0): el layout de /dashboard sin su redirect → 7 / 2; el de /m/dashboard sin el suyo
// → 7 / 2; `paginaDelPedido` sin la tabla del proxy (`rutaMovil`) → 8 / 1; `sinSuHoja` al revés → 8 / 1; la página de la
// hoja sin `tableroDelPedido` → 8 / 1; /dashboard otra vez en la lista de conocidas → 8 / 1.
// LAS PUERTAS (25/10/2026, chat «Landings», romper-puertas.mjs del scratchpad; base 12 / 0): sin el layout de /offer → 10 / 2;
// el de /chats con las puertas al revés → 10 / 2; el de /dashboard con la puerta otra vez adentro del `if` → 11 / 1; el de
// /web-generator con la puerta adentro de `if (cual)` → 10 / 2; /plan/agencia fuera de DECIDEN_POR_RUTA → 11 / 1;
// requireMovil fuera de PUERTAS → 11 / 1; sin el layout de /m/crm → 11 / 1; el de /plan sin el onboarding de revisar →
// 11 / 1; la página de /automations con otra puerta → 10 / 2; una conocida que ya cumple en la lista → 11 / 1.
// ADMIN (6/11/2026, punto 31 de docs/admin/revision-cerebro-6-11.md; base 14 / 0): el layout de (polar) sin su redirect → 13 / 1;
// sin una página de Admin en DECIDEN_POR_RUTA → 13 / 1.
// Correr: node --import tsx --test tests/redirige-antes-del-loader.test.ts
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { queryComoSearchParams } from '../lib/pedido-actual-reglas';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('la query llega al layout como la recibe una página: un valor, o la lista si se repite', () => {
  assert.deepEqual(queryComoSearchParams('?tarea=abc&cliente=7'), { tarea: 'abc', cliente: '7' });
  assert.deepEqual(queryComoSearchParams('?chat=1&chat=2&chat=3'), { chat: ['1', '2', '3'] });
  assert.deepEqual(queryComoSearchParams(''), {});
});

test('el proxy pone la ruta Y la query, pisando las que mande el cliente', () => {
  const proxy = sinComentarios(leer('proxy.ts'));
  assert.match(proxy, /headers\.set\(HEADER_RUTA, req\.nextUrl\.pathname\);\n\s*headers\.set\(HEADER_QUERY, req\.nextUrl\.search\);/);
  assert.match(leer('lib/api-tab.ts'), /export const HEADER_QUERY = 'x-mako-query';/);
});

test('/plan: el layout manda al super admin a /plan/agencia SÓLO en la ruta exacta, con la misma decisión que la página', () => {
  const lay = sinComentarios(leer('app/plan/layout.tsx'));
  assert.match(lay, /if \(ruta === '\/plan'\) \{/, 'sin la ruta exacta redirigiría también /plan/agencia: un bucle');
  const pag = sinComentarios(leer('app/plan/page.tsx'));
  // La condición y el destino, iguales en los dos.
  for (const pedazo of ["if (sesion?.rol === 'admin' && !(await estaImpersonando())) {", 'redirect(await rutaConWs(`/plan/agencia${qs ? `?${qs}` : \'\'}`));', "else if (Array.isArray(v) && v[0]) sp.set(k, v[0]);"]) {
    assert.ok(lay.includes(pedazo), `el layout no tiene «${pedazo}»`);
    assert.ok(pag.includes(pedazo), `la página no tiene «${pedazo}» (el layout la copia: cambiar los dos)`);
  }
  // Después del salto del super admin, la puerta de la tab y el onboarding: el orden de la página.
  assert.match(lay, /redirect\(await rutaConWs\(`\/plan\/agencia\$\{qs \? `\?\$\{qs\}` : ''\}`\)\);\n\s*\}\n\s*await requireCapa\('todo'\);\n\s*await guardOnboarding\(\);\n\s*\}/);
  // /plan/agencia: el espejo, con la condición de su página.
  const agencia = sinComentarios(leer('app/plan/agencia/page.tsx'));
  for (const pedazo of ["if (sesion?.rol !== 'admin' || (await estaImpersonando())) {", 'redirect(await rutaConWs(`/plan${qs ? `?${qs}` : \'\'}`));']) {
    assert.ok(lay.includes(pedazo), `el layout no tiene «${pedazo}» para /plan/agencia`);
    assert.ok(agencia.includes(pedazo), `/plan/agencia no tiene «${pedazo}» (el layout la copia: cambiar los dos)`);
  }
  assert.match(lay, /if \(ruta === '\/plan\/agencia'\) \{/);
  // /plan/revisar/<id>: sin sesión a /inicio, y el onboarding. Sólo esa ruta (no /plan/revisar pelado ni más abajo).
  const revisar = sinComentarios(leer('app/plan/revisar/[id]/page.tsx'));
  assert.match(lay, /if \(ruta != null && \/\^\\\/plan\\\/revisar\\\/\[\^\/\]\+\$\/\.test\(ruta\)\) \{\n\s*const sesion = await getUsuarioActual\(\);\n\s*if \(!sesion\) redirect\(await rutaConWs\('\/inicio'\)\);\n\s*await guardOnboarding\(\);/);
  assert.match(revisar, /if \(!sesion\) redirect\(await rutaConWs\('\/inicio'\)\);/);
  const ruta = /^\/plan\/revisar\/[^/]+$/;
  assert.ok(ruta.test('/plan/revisar/abc-123') && !ruta.test('/plan/revisar') && !ruta.test('/plan/revisar/a/b'));
  assert.match(lay, /return children;\n\}/);
});

test('/second-brain: el layout manda a quien opera al Ops Center SÓLO en la ruta exacta, con la decisión de la página', () => {
  const lay = sinComentarios(leer('app/second-brain/layout.tsx'));
  assert.match(lay, /if \(ruta === '\/second-brain' && \(await quienOpera\(\)\)\) redirect\(await rutaConWs\(rutaDelSecondBrainEnOpsCenter\(query\)\)\);/);
  assert.match(sinComentarios(leer('app/second-brain/page.tsx')), /if \(opera\) redirect\(await rutaConWs\(rutaDelSecondBrainEnOpsCenter\(q\)\)\);/);
  // La puerta de la página, primero y a la vista (la carpeta tiene una sola página).
  assert.match(lay, /\{ children: ReactNode \}\) \{\s*await requireRolWs\(\['closer', 'setter'\], \{ nav: 'mako' \}\);\s*const \{ ruta, query \} = await pedidoActual\(\);/);
});

test('las páginas con loader que redirigen al super admin tienen su layout que redirige antes', () => {
  for (const seg of ['plan', 'second-brain']) {
    assert.ok(leer(`app/${seg}/loading.tsx`).length > 0, `${seg} sin loader: este test ya no hace falta para él`);
    assert.match(leer(`app/${seg}/layout.tsx`), /redirect\(/, `${seg} tiene loader y redirige sólo adentro: el redirect va al stream`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Ticket #9 (24/10/2026): el mismo #310 en /web-generator, que redirigía desde la página con loader desde el 24/10.
// ─────────────────────────────────────────────────────────────────────────────

test('/web-generator: el layout redirige ANTES del loader en las tres rutas que redirigen, con la regla de las páginas', async () => {
  const { redireccionDelLayout, esPanelPelado } = await import('../app/web-generator/panel-reglas');
  assert.equal(redireccionDelLayout('/web-generator', {}), 'ultima');
  assert.equal(redireccionDelLayout('/web-generator', { ws: '10' }), 'ultima');
  assert.equal(redireccionDelLayout('/web-generator', { panel: '1' }), null, '?panel=1 es el Panel: no salta');
  assert.equal(redireccionDelLayout('/web-generator', { diagnostico: '3' }), null);
  assert.equal(redireccionDelLayout('/web-generator/analizar', { url: 'https://x.test' }), 'analizar');
  assert.equal(redireccionDelLayout('/web-generator/crear', {}), 'crear');
  assert.equal(redireccionDelLayout('/web-generator/32', {}), null, 'el editor de una landing no redirige');
  assert.equal(redireccionDelLayout(null, {}), null, 'sin el header del proxy no se adivina');
  assert.equal(esPanelPelado({ ws: '3' }), true);
  const lay = sinComentarios(leer('app/web-generator/layout.tsx'));
  assert.match(lay, /const cual = redireccionDelLayout\(ruta, query\);/);
  assert.match(lay, /\{ children: ReactNode \}\) \{\s*await requireRolWs\(\[\], \{ nav: 'landing-writer' \}\);\s*const \{ ruta, query \} = await pedidoActual\(\);/,
    'la puerta de la tab va primero y para TODAS las rutas (el editor y ?panel=1 también redirigen por ella)');
  assert.match(lay, /if \(cual === 'analizar'\) redirect\(await rutaConWs\(destinoAnalizar\(query\)\)\);/);
  assert.match(lay, /if \(cual === 'crear'\) redirect\(await rutaConWs\(destinoCrear\(query\)\)\);/);
  assert.match(lay, /if \(ultima\) redirect\(await rutaConWs\(`\/web-generator\/\$\{ultima\.id\}`\)\);/);
  // Lo que dibuja: la tab y los tooltips flotantes de toda la tab (25/10/2026, editor/TooltipsFlotantes.tsx).
  assert.match(lay, /return <>\{children\}<TooltipsFlotantes \/><\/>;\n\}/);
  // La página usa LA MISMA regla de «pelada».
  assert.match(sinComentarios(leer('app/web-generator/page.tsx')), /if \(!errorLista && esPanelPelado\(sp\)\) \{/);
});

// ─────────────────────────────────────────────────────────────────────────────
// EL GUARD, CON LAS PUERTAS (25/10/2026, chat «Landings»; lo midió CRM, docs/hallazgos-infra.md). Hasta ese día buscaba sólo
// un `redirect(` en la página y daba por bueno un layout con CUALQUIER `redirect(`. Dos agujeros:
//   · las PUERTAS redirigen por dentro (lib/tab-access.ts y compañía: «no está en tu plan», el onboarding pendiente, sin
//     sesión) y no se veían: seis tabs redirigían SÓLO por su puerta, debajo de su loader;
//   · un layout que redirige en UNA ruta «cubría» a todas: /web-generator/<id> pasaba sin que nadie le pasara la puerta.
// La regla, para cada página debajo de un loading.tsx (el de más afuera; su layout queda afuera del Suspense):
//   1. sus puertas, escritas igual y en el mismo orden, están en ese layout;
//   2. y la cubren: o van A LA VISTA (primer nivel de la función del layout, sin `if`: valen para toda ruta), o la carpeta
//      decide por ruta y está en DECIDEN_POR_RUTA con la lista de sus páginas y el test que lo prueba ruta por ruta;
//   3. un `redirect(` a la vista en la página, igual: el layout redirige y la carpeta está en DECIDEN_POR_RUTA.
// ─────────────────────────────────────────────────────────────────────────────

/** Las puertas: funciones que REDIRIGEN por dentro. Una nueva va acá (el test de abajo las busca solas en lib/ y app/). */
const PUERTAS = ['requireSesion', 'requireCapa', 'requireRolWs', 'guardOnboarding', 'requireMovil', 'requireAiAvatar', 'requireAiAvatarM', 'requireEditorImagen', 'requireEditorVideo', 'requireCopywriter', 'requireCopywriterM'];
const LLAMADA = new RegExp(`\\b(${PUERTAS.join('|')})\\(`, 'g');

/** Las llamadas a una puerta, en orden, como texto: con sus argumentos y los espacios normalizados. */
function puertasDe(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(LLAMADA)) {
    let i = m.index! + m[0].length;
    for (let prof = 1; i < src.length && prof > 0; i++) { if (src[i] === '(') prof++; else if (src[i] === ')') prof--; }
    out.push(src.slice(m.index!, i).replace(/\s+/g, ' '));
  }
  return out;
}

/** Las puertas A LA VISTA de un layout: al primer nivel de su función (dos espacios), sin un `if` que las condicione. */
function puertasALaVista(src: string): Set<string> {
  const out = new Set<string>();
  for (const l of src.split('\n')) {
    const m = /^ {2}(?:const \w+ = )?await (.+);\s*$/.exec(l);
    if (m) for (const x of puertasDe(m[1])) out.add(x);
  }
  return out;
}

/** ¿`chica` está adentro de `grande` en el mismo orden (no necesariamente seguidas)? */
function enOrden(chica: string[], grande: string[]): boolean {
  let j = 0;
  for (const x of grande) if (j < chica.length && x === chica[j]) j++;
  return j === chica.length;
}

/**
 * Las carpetas cuyo layout DECIDE POR RUTA (una puerta o un salto distinto en cada ruta): sus páginas que redirigen, y el
 * test que prueba ruta por ruta que el layout hace lo de cada una. Una página nueva que redirige ahí, sin anotarse, falla.
 */
const DECIDEN_POR_RUTA: Record<string, { test: string; paginas: string[] }> = {
  'app/crm': {
    test: 'tests/crm-redirige-antes-del-loader.test.ts',
    paginas: ['app/crm/page.tsx', 'app/crm/new/page.tsx', 'app/crm/[id]/page.tsx', 'app/crm/revisar/page.tsx',
      'app/crm/revisar/[id]/page.tsx', 'app/crm/[id]/resumen/page.tsx'],
  },
  'app/plan': { test: 'tests/redirige-antes-del-loader.test.ts', paginas: ['app/plan/page.tsx', 'app/plan/agencia/page.tsx', 'app/plan/revisar/[id]/page.tsx'] },
  'app/second-brain': { test: 'tests/redirige-antes-del-loader.test.ts', paginas: ['app/second-brain/page.tsx'] },
  'app/web-generator': {
    test: 'tests/redirige-antes-del-loader.test.ts',
    paginas: ['app/web-generator/page.tsx', 'app/web-generator/analizar/page.tsx', 'app/web-generator/crear/page.tsx'],
  },
  'app/dashboard': { test: 'tests/redirige-antes-del-loader.test.ts', paginas: ['app/dashboard/page.tsx'] },
  'app/m/dashboard': { test: 'tests/redirige-antes-del-loader.test.ts', paginas: ['app/m/dashboard/page.tsx', 'app/m/dashboard/[hoja]/page.tsx'] },
  // Las tres del Ops Center (25/10/2026): el test de abajo, «/admin/operaciones, /m/chats y /m/second-brain».
  'app/admin/operaciones': { test: 'tests/redirige-antes-del-loader.test.ts', paginas: ['app/admin/operaciones/page.tsx'] },
  'app/m/chats': { test: 'tests/redirige-antes-del-loader.test.ts', paginas: ['app/m/chats/page.tsx'] },
  'app/m/second-brain': {
    test: 'tests/redirige-antes-del-loader.test.ts',
    paginas: ['app/m/second-brain/page.tsx', 'app/m/second-brain/mapa/page.tsx'],
  },
  // Admin (6/11/2026, punto 31 de docs/admin/revision-cerebro-6-11.md): el layout de (polar) repite en la carga lo que redirige
  // cada página (app/admin/(polar)/layout-reglas.ts), y tests/admin-polar-armazon.test.ts lo prueba ruta por ruta.
  'app/admin/(polar)': {
    test: 'tests/admin-polar-armazon.test.ts',
    paginas: [
      'app/admin/(polar)/page.tsx',
      'app/admin/(polar)/finance/page.tsx',
      'app/admin/(polar)/analytics/page.tsx',
      'app/admin/(polar)/analytics/metrics/page.tsx',
      'app/admin/(polar)/analytics/costs/page.tsx',
      'app/admin/(polar)/analytics/events/page.tsx',
      'app/admin/(polar)/customers/[id]/events/page.tsx',
      'app/admin/(polar)/sales/checkouts/[id]/page.tsx',
    ],
  },
};

/**
 * LO QUE YA ESTABA ASÍ, de otras tabs: páginas que redirigen debajo de un loader sin un layout que lo haga antes. Cada una
 * tiene el mismo riesgo del #310 (en una carga directa, la redirección va en el stream); se anotaron en
 * docs/hallazgos-infra.md. Una página NUEVA así hace fallar el test, y una de éstas que ya cumple también: sale de acá.
 */
// Vacía desde el 25/10/2026: las tres últimas (/admin/operaciones, /m/chats y /m/second-brain) las resolvió el Ops Center con su
// layout por ruta. Se deja la lista (y el test que obliga a sacar las que ya cumplen) por si una tab necesita entrar con su motivo.
const CONOCIDAS_SIN_LAYOUT = new Set<string>([]);

function paginasDeApp(): string[] {
  const paginas: string[] = [];
  const recorrer = (rel: string) => {
    for (const e of readdirSync(join(RAIZ, rel), { withFileTypes: true })) {
      if (e.isDirectory()) { if (!e.name.startsWith('.') && e.name !== 'node_modules') recorrer(`${rel}/${e.name}`); }
      else if (e.name === 'page.tsx') paginas.push(`${rel}/page.tsx`);
    }
  };
  recorrer('app');
  return paginas;
}

/** Lo que le falta a una página debajo de un loader para redirigir antes (vacío = cumple; null = no redirige o sin loader). */
function faltaAntesDelLoader(p: string): { afuera: string; falta: string[] } | null {
  const src = sinComentarios(leer(p));
  const puertas = puertasDe(src);
  const aLaVista = /\bredirect\(/.test(src);
  if (!puertas.length && !aLaVista) return null;
  // El loader de más AFUERA: todo lo de adentro queda en su Suspense; el layout de esa carpeta queda afuera.
  let dir = p.slice(0, p.lastIndexOf('/'));
  let afuera: string | null = null;
  while (dir.startsWith('app')) {
    if (existsSync(join(RAIZ, dir, 'loading.tsx'))) afuera = dir;
    dir = dir.includes('/') ? dir.slice(0, dir.lastIndexOf('/')) : '';
  }
  if (!afuera) return null;
  const lay = `${afuera}/layout.tsx`;
  if (!existsSync(join(RAIZ, lay))) return { afuera, falta: [`no hay ${lay}`] };
  const srcLay = sinComentarios(leer(lay));
  const falta: string[] = [];
  if (!enOrden(puertas, puertasDe(srcLay))) falta.push(`el layout no repite sus puertas en el mismo orden (${puertas.join(' > ')})`);
  if (aLaVista && !/\bredirect\(/.test(srcLay)) falta.push('redirige a la vista y el layout no redirige');
  const vista = puertasALaVista(srcLay);
  const decide = DECIDEN_POR_RUTA[afuera];
  if ((aLaVista || !puertas.every((x) => vista.has(x))) && !decide?.paginas.includes(p)) {
    falta.push(`el layout decide por ruta y la página no está en DECIDEN_POR_RUTA['${afuera}'] (con el test que lo prueba)`);
  }
  return { afuera, falta };
}

test('ninguna página redirige debajo de un loader —a la vista o por una PUERTA— sin que el layout de afuera lo haga antes', () => {
  const mal: string[] = [];
  const conocidasArregladas: string[] = [];
  for (const p of paginasDeApp()) {
    const r = faltaAntesDelLoader(p);
    if (!r) continue;
    if (CONOCIDAS_SIN_LAYOUT.has(p)) { if (!r.falta.length) conocidasArregladas.push(p); continue; }
    for (const f of r.falta) mal.push(`${p} (loader: ${r.afuera}/loading.tsx): ${f}`);
  }
  assert.deepEqual(mal, [], 'estas páginas redirigen adentro de un loader: React #310 en una carga directa (redirigí en el layout de esa carpeta)');
  // Una conocida que ya cumple sale de la lista: si no, una regresión suya pasaría callada.
  assert.deepEqual(conocidasArregladas, [], 'estas ya redirigen en su layout: sacalas de CONOCIDAS_SIN_LAYOUT');
});

test('DECIDEN_POR_RUTA no miente: cada página existe y redirige, y el test de la carpeta lee su layout', () => {
  for (const [carpeta, { test: t, paginas }] of Object.entries(DECIDEN_POR_RUTA)) {
    assert.ok(existsSync(join(RAIZ, t)), `${carpeta}: no existe ${t}`);
    assert.ok(leer(t).includes(`${carpeta}/layout.tsx`), `${t} no lee ${carpeta}/layout.tsx: nadie prueba ruta por ruta`);
    for (const p of paginas) {
      assert.ok(existsSync(join(RAIZ, p)), `${carpeta}: ${p} ya no existe`);
      assert.ok(faltaAntesDelLoader(p), `${p} ya no redirige (o no tiene loader): sacala de DECIDEN_POR_RUTA`);
    }
  }
});

test('las PUERTAS son todas: ninguna función require…/guard… que redirige por dentro falta en la lista', () => {
  const faltan: string[] = [];
  const recorrer = (rel: string) => {
    for (const e of readdirSync(join(RAIZ, rel), { withFileTypes: true })) {
      if (e.isDirectory()) { if (!e.name.startsWith('.') && e.name !== 'node_modules') recorrer(`${rel}/${e.name}`); continue; }
      if (!/\.tsx?$/.test(e.name)) continue;
      const crudo = leer(`${rel}/${e.name}`);
      if (!/export async function (?:require|guard)[A-Z]/.test(crudo)) continue;
      const src = sinComentarios(crudo);
      for (const m of src.matchAll(/^export async function ((?:require|guard)[A-Z]\w*)\(/gm)) {
        const desde = src.indexOf('{\n', m.index!);
        const hasta = src.indexOf('\n}\n', desde);
        const cuerpo = src.slice(desde, hasta < 0 ? undefined : hasta);
        if ((/\bredirect\(/.test(cuerpo) || puertasDe(cuerpo).length) && !PUERTAS.includes(m[1])) faltan.push(`${m[1]} (${rel}/${e.name})`);
      }
    }
  };
  recorrer('lib');
  recorrer('app');
  assert.deepEqual(faltan, [], 'estas funciones redirigen por dentro: sumalas a PUERTAS');
});

test('las cinco tabs de una sola página repiten su puerta a la vista, igual que su página', () => {
  const casos: Array<[string, string[]]> = [
    ['ads-writer', ["requireRolWs([], { nav: 'ads-writer' })"]],
    ['automations', ["requireRolWs(['setter'], { nav: 'setting' })"]],
    ['calendario', ["requireRolWs([], { nav: 'calendario' })"]],
    ['chats', ["requireCapa('chats')", 'guardOnboarding()']],
    ['offer', ["requireRolWs([], { nav: 'offer' })"]],
  ];
  for (const [seg, puertas] of casos) {
    assert.deepEqual(puertasDe(sinComentarios(leer(`app/${seg}/page.tsx`))), puertas, `${seg}: la página cambió de puerta (cambiar el layout con ella)`);
    const lay = sinComentarios(leer(`app/${seg}/layout.tsx`));
    assert.deepEqual(puertasDe(lay), puertas, `${seg}: el layout no tiene la puerta de la página`);
    assert.deepEqual([...puertasALaVista(lay)], puertas, `${seg}: la puerta del layout no va a la vista`);
    assert.match(lay, /return children;\n\}/);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Los dashboards (25/10/2026): /dashboard, /m/dashboard y /m/dashboard/[hoja] salieron de la lista de conocidas.
// ─────────────────────────────────────────────────────────────────────────────

test('/dashboard: el layout redirige al rol sin la capa de su hoja ANTES del loader, con la decisión de la página', async () => {
  const { sinSuHoja } = await import('../app/dashboard/redireccion');
  const { CAPAS_LISTA, tabEnCapa } = await import('../lib/capas');
  for (const { id } of CAPAS_LISTA) {
    assert.equal(sinSuHoja('admin', id), false, 'el admin no tiene hoja única');
    assert.equal(sinSuHoja('closer', id), !tabEnCapa('closing', id), `el closer en ${id}`);
    assert.equal(sinSuHoja('setter', id), !tabEnCapa('whatsapp', id), `el setter en ${id}`);
  }
  // Medido el 25/10/2026: «pm» no incluye ni Closing ni WhatsApp. Es el caso que redirige.
  assert.equal(sinSuHoja('closer', 'pm'), true);
  const lay = sinComentarios(leer('app/dashboard/layout.tsx'));
  assert.match(lay, /if \(ruta === '\/dashboard'\) \{/);
  assert.match(lay, /\{ children: ReactNode \}\) \{\s*await requireRolWs\(\['closer', 'setter'\], \{ nav: 'graphics' \}\);\s*const \{ ruta \} = await pedidoActual\(\);/,
    'la puerta de la tab va primero y SIEMPRE: también redirige (el onboarding pendiente), y adentro del loader es el #310');
  assert.match(lay, /if \(sinSuHoja\(rol, capa\)\) redirect\(await rutaConWs\(homeDeCapa\(capa\)\)\);/, 'el layout no redirige');
  assert.match(lay, /return children;\n\}/);
  assert.match(sinComentarios(leer('app/dashboard/page.tsx')), /if \(sinSuHoja\(rol, capa\)\) redirect\(await rutaConWs\(homeDeCapa\(capa\)\)\);/,
    'la página decide otra cosa que el layout');
});

test('/m/dashboard y su hoja: el layout sabe qué página es con la URL de escritorio, y redirige ANTES del loader', async () => {
  const { paginaDelPedido } = await import('../app/m/dashboard/redireccion');
  const { decidirDesvio } = await import('../lib/movil-desvio');
  // En el teléfono la URL es la de ESCRITORIO: el proxy la reescribe. Lo que decide el layout es lo que reescribe el proxy.
  const casos: Array<[string, Record<string, string | string[]>, unknown]> = [
    ['/dashboard', {}, { pagina: 'dashboard' }],
    ['/dashboard', { ws: '3', hoja: 'comercial' }, { pagina: 'dashboard' }],
    ['/marketing', {}, { pagina: 'dashboard' }],
    ['/comercial', {}, { pagina: 'dashboard' }],
    ['/dashboard', { hoja: 'h_ventas 2' }, { pagina: 'hoja', id: 'h_ventas 2' }],
    ['/graficos', { hoja: 'closing' }, { pagina: 'hoja', id: 'closing' }],
    ['/dashboard', { hoja: 'focus' }, null],
  ];
  for (const [ruta, query, esperado] of casos) {
    assert.deepEqual(paginaDelPedido(ruta, query), esperado, `${ruta} ${JSON.stringify(query)}`);
    const d = decidirDesvio(ruta, new URLSearchParams(query as Record<string, string>).toString());
    const delProxy = d.tipo === 'movil' ? d.destino.split('?')[0] : null;
    const delLayout = esperado == null ? null : (esperado as { pagina: string; id?: string }).pagina === 'dashboard' ? '/m/dashboard' : `/m/dashboard/${encodeURIComponent((esperado as { id: string }).id)}`;
    if (delLayout) assert.equal(delProxy, delLayout, `el proxy reescribe ${ruta} a otra página`);
  }
  assert.deepEqual(paginaDelPedido('/dashboard', { hoja: ['h1', 'h2'] }), { pagina: 'hoja', id: 'h1' }, 'como el proxy: la primera');
  assert.deepEqual(paginaDelPedido('/m/dashboard/h%20x', {}), { pagina: 'hoja', id: 'h x' });
  assert.equal(paginaDelPedido('/crm', {}), null);
  assert.equal(paginaDelPedido(null, {}), null, 'sin el header del proxy no se adivina');

  const lay = sinComentarios(leer('app/m/dashboard/layout.tsx'));
  assert.match(lay, /const cual = paginaDelPedido\(ruta, query\);/);
  assert.match(lay, /if \(sinSuHoja\(ctx\.rol, ctx\.capa\)\) destino = HOME_MOVIL;/);
  assert.match(lay, /\} else if \(hojaDeRol\(ctx\.rol\)\) \{\s*destino = VOLVER_AL_DASHBOARD;/);
  assert.match(lay, /puedeVerKey\('graphics', ctx\.rol, ctx\.capa\) && !hojaPropiaDe\(\(await tableroDelPedido\(\)\)\.tablero, cual\.id\)/,
    'el informe se lee para quien no tiene la tab, o la hoja se decide con otra cuenta');
  assert.match(lay, /\{ children: ReactNode \}\) \{\s*const ctx = await requireMovil\(\{ navKey: 'graphics' \}\);\s*const \{ ruta, query \} = await pedidoActual\(\);/,
    'la puerta de la tab va primero y SIEMPRE: también redirige (el onboarding pendiente), y adentro del loader es el #310');
  assert.match(lay, /if \(destino\) redirect\(await rutaConWs\(destino\)\);/);
  assert.match(lay, /return children;\n\}/);
  // Las páginas, con la MISMA decisión (por si se llega navegando), y la hoja con el informe que ya leyó el layout.
  assert.match(sinComentarios(leer('app/m/dashboard/page.tsx')), /if \(sinSuHoja\(ctx\.rol, ctx\.capa\)\) redirect\(await rutaConWs\(HOME_MOVIL\)\);/);
  const hoja = sinComentarios(leer('app/m/dashboard/[hoja]/page.tsx'));
  assert.match(hoja, /if \(hojaDeRol\(ctx\.rol\)\) redirect\(await rutaConWs\(VOLVER_AL_DASHBOARD\)\);/);
  assert.match(hoja, /const h = hojaPropiaDe\(lectura\.tablero, id\);\s*if \(!h\) redirect\(await rutaConWs\(VOLVER_AL_DASHBOARD\)\);/);
  assert.match(hoja, /tableroDelPedido\(\)\]\);/, 'la página vuelve a leer el informe en vez de reusar el del layout');
  assert.match(sinComentarios(leer('app/m/dashboard/datos.ts')), /export const tableroDelPedido = cache\(leerTablero\);/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 25/10/2026 (chat «Ops Center», claude5): /admin/operaciones, /m/chats y /m/second-brain redirigen en su layout.
// PROBADO ROMPIÉNDOLO (base 9/0): `pedidoInterno` sin traducir la URL de escritorio → 1 rojo (la regla); el layout de /m/chats
// mirando la ruta del navegador en vez de la de su página → 1 rojo (los layouts); el de /m/second-brain con otra condición que la
// página → 1 rojo (los layouts); sin el layout de /admin/operaciones → 2 rojos (los layouts y el barrido).
// ─────────────────────────────────────────────────────────────────────────────

test('/m: el layout decide con la ruta y la query que recibe SU página (el proxy sirve la URL de escritorio con /m)', async () => {
  const { pedidoInterno } = await import('../lib/movil-desvio');
  assert.deepEqual(pedidoInterno('/chats', '?linea=2&chat=549@s.whatsapp.net&ws=3'), { ruta: '/m/chats', search: 'linea=2&chat=549%40s.whatsapp.net&ws=3' });
  assert.deepEqual(pedidoInterno('/chats', '?c=ig:5'), { ruta: '/m/chats/ig%3A5', search: 'c=ig%3A5' }, 'un `?c=` es el chat, no la lista');
  assert.deepEqual(pedidoInterno('/whatsapp', ''), { ruta: '/m/chats', search: '' });
  assert.deepEqual(pedidoInterno('/second-brain', '?area=ventas&ws=3'), { ruta: '/m/second-brain', search: 'area=ventas&ws=3' });
  assert.equal(pedidoInterno('/second-brain', '?panel=mapa')?.ruta, '/m/second-brain/mapa', 'el Mapa es su propia página');
  assert.deepEqual(pedidoInterno('/m/second-brain', '?ws=3'), { ruta: '/m/second-brain', search: 'ws=3' }, 'una URL que ya es /m');
  assert.equal(pedidoInterno('/login', ''), null);
  assert.equal(pedidoInterno(null, ''), null, 'sin el header del proxy no se adivina');
});

test('/admin/operaciones, /m/chats y /m/second-brain: el layout redirige antes del loader, con la decisión de la página', () => {
  const ops = sinComentarios(leer('app/admin/operaciones/layout.tsx'));
  const opsPag = sinComentarios(leer('app/admin/operaciones/page.tsx'));
  for (const pedazo of ["if (!admin) redirect('/inicio');", 'redirect(await rutaConWs(RUTA_OPS_CENTER_NEGOCIO));']) {
    assert.ok(ops.includes(pedazo), `el layout de /admin/operaciones no tiene «${pedazo}»`);
    assert.ok(opsPag.includes(pedazo), `la página de /admin/operaciones no tiene «${pedazo}» (el layout la copia: cambiar los dos)`);
  }
  assert.match(ops, /if \(puedeOperar\(admin, propio\)\) \{/, 'a quien no opera la página le muestra el cartel: el layout no lo manda a ningún lado');

  const chats = sinComentarios(leer('app/m/chats/layout.tsx'));
  const chatsPag = sinComentarios(leer('app/m/chats/page.tsx'));
  assert.match(chats, /if \(pedido\?\.ruta === RUTA_CHATS\) \{/, 'sólo la LISTA: el layout envuelve también a cada chat');
  assert.match(chats, /\{ children: ReactNode \}\) \{\s*await requireMovil\(\{ navKey: 'chats' \}\);\s*const pedido = await pedidoMovilActual\(\);/,
    'la puerta, primero y para las dos (la lista y cada chat)');
  for (const pedazo of ['if (directo) redirect(await rutaConWs(directo));', 'if (chat) redirect(await rutaConWs(rutaHiloM(chat.clave)));']) {
    assert.ok(chats.includes(pedazo), `el layout de /m/chats no tiene «${pedazo}»`);
    assert.ok(chatsPag.includes(pedazo), `la página de /m/chats no tiene «${pedazo}»`);
  }

  const sb = sinComentarios(leer('app/m/second-brain/layout.tsx'));
  const sbPag = sinComentarios(leer('app/m/second-brain/page.tsx'));
  assert.match(sb, /if \(pedido\?\.ruta === RUTA_OPS_CENTER_M\) \{/, 'sólo el chat: el layout envuelve también al Mapa');
  for (const pedazo of [
    "if (veMapa && (uno(sp.panel) === 'mapa' || uno(sp.area))) {",
    "for (const k of ['area', 'vista'] as const) { const v = uno(sp[k]); if (v) q.set(k, v); }",
    "redirect(await rutaConWs(`/m/second-brain/mapa${q.size ? `?${q}` : ''}`));",
    "if (ctx.sesion.rol === 'admin' && !ctx.impersonando) redirect(await rutaConWs(RUTA_CENTRO_M));",
  ]) {
    assert.ok(sb.includes(pedazo), `el layout de /m/second-brain no tiene «${pedazo}»`);
    assert.ok(sbPag.includes(pedazo), `la página de /m/second-brain no tiene «${pedazo}» (el layout la copia: cambiar los dos)`);
  }
  for (const lay of [chats, sb]) assert.match(lay, /const pedido = await pedidoMovilActual\(\);/, 'un layout de /m mira la ruta de SU página, no la del navegador');
  assert.match(sb, /if \(pedido\?\.ruta === `\$\{RUTA_OPS_CENTER_M\}\/mapa`\) await requireMovil\(\{ navKey: 'second-brain' \}\);/, 'el Mapa pasa por otra puerta');
});
