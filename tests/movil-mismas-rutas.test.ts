// LAS MISMAS RUTAS (lib/movil-rutas.ts, lib/movil-desvio.ts, proxy.ts, lib/ws-tab.ts).
// Martín, 12/10/2026, mirando /m/hoy en su celular: «lo que esta mal es que funcione por rutas, eso no
// debe ser así... Las rutas deben ser las mismas, solo debe detectar si estoy en mobile». El teléfono
// abre /crm, /general, /plan… con la MISMA URL y el proxy le sirve la página de /m (un rewrite).
//
// Lo que se EJECUTA: la ida y vuelta de CADA página de app/m (escritorio → /m → escritorio), la
// decisión pura del proxy y el PROXY DE VERDAD (`proxy(new NextRequest(...))`) con un UA de iPhone y
// una sesión firmada, como tests/alumno-sesion.test.ts.
//
// Verificado rompiéndolo (13/10/2026), de a una y restaurando desde memoria — base 14 pasan / 0 fallan:
//   · `conWs` sin `rutaEscritorio` (los links de /m vuelven a mostrar /m)       → 13 / 1
//   · el proxy con `seguir` en vez de `seguirOMovil` en la salida con sesión    → 11 / 3
//   · `rutaEscritorio` sin la rama de /m/dashboard/<hoja>                        → 12 / 2
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { NextRequest } from 'next/server';
import { rutaEscritorio, rutaInterna, rutaMovil, respaldoEscritorio } from '../lib/movil-rutas';
import { esVistaMovil, pedidoMovil, urlReescrita } from '../lib/movil-desvio';
import { conWs } from '../lib/ws-tab';
import { SESSION_COOKIE, crearToken } from '../lib/auth-session';
import { VISTA_COOKIE, VISTA_ESCRITORIO } from '../lib/movil-dispositivo';
import { proxy } from '../proxy';

// Con el secreto puesto el gate está ACTIVO, como en producción (sin él, en local deja pasar todo).
process.env.AUTH_SECRET = 'secreto-de-prueba-mismas-rutas-0123456789abcdef';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ESCRITORIO = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const UUID = '3f2b8c1e-9a4d-4c6b-8e2f-0a1b2c3d4e5f';

// ── Cada página de app/m tiene su URL de escritorio, y vuelve ─────────────────────────────────

/** Las rutas de app/m que tienen page.tsx, con un valor de ejemplo en cada segmento dinámico. */
function paginasDeM(): string[] {
  const out: string[] = [];
  const recorrer = (dir: string) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) { recorrer(p); continue; }
      if (n !== 'page.tsx') continue;
      const rel = relative(join(RAIZ, 'app'), dir).split(sep).join('/');
      out.push('/' + rel
        .replace('[id]/chat', '12/chat')
        .replace(/crm\/\[id\]/, 'crm/12')
        .replace(/video\/\[id\]/, `video/${UUID}`)
        .replace(/landing\/\[id\]/, 'landing/42')
        .replace(/dashboard\/\[hoja\]/, 'dashboard/mi-hoja'));
    }
  };
  recorrer(join(RAIZ, 'app', 'm'));
  return out.sort();
}

test('cada página de app/m tiene una URL de escritorio (sin /m) y esa URL vuelve a ELLA', () => {
  // Roto (13/10/2026) sacando la rama de /m/dashboard/<hoja> de `rutaEscritorio`: 12 / 2, nombrando
  // «/m/dashboard/mi-hoja → /m/dashboard/mi-hoja». Una página nueva de /m sin su fila falla acá.
  const paginas = paginasDeM();
  assert.ok(paginas.length >= 20, `se encontraron ${paginas.length} páginas: el barrido no está mirando app/m`);
  for (const r of paginas) {
    const url = rutaEscritorio(r);
    assert.ok(!/^\/m(\/|$|\?)/.test(url), `${r} → ${url}: la URL sigue mostrando /m`);
    // /m sólo reparte (va a la home): su vuelta es Today.
    const esperado = r === '/m' ? '/m/hoy' : r;
    assert.equal(rutaInterna(url.split('?')[0], url.split('?')[1] ?? ''), esperado, `${r} → ${url} → no vuelve`);
  }
});

test('la URL de escritorio de cada pantalla es la que ya usa la computadora', () => {
  const casos: [string, string][] = [
    ['/m/hoy', '/general'], ['/m/crm', '/crm'], ['/m/crm/12', '/crm/12'], ['/m/inbox', '/mako/pendientes'],
    ['/m/plan', '/plan'], ['/m/mako', '/mako'], ['/m/cuenta', '/perfil'], ['/m/dashboard', '/dashboard'],
    ['/m/ads', '/ads-manager'], ['/m/cs', '/customer-success'], ['/m/automations', '/automations'],
    ['/m/video', '/video-generator'], [`/m/video/${UUID}`, `/video-generator?plan=${UUID}`],
    ['/m/landing', '/landing-generator'], ['/m/landing/42', '/landing-generator/42'],
    ['/m/dashboard/mi%20hoja', '/dashboard?hoja=mi+hoja'],
    // Lo que sólo existe en el teléfono lleva una URL sin /m, y la computadora la manda a lo suyo.
    ['/m/mas', '/mas'], ['/m/configurar', '/configurar'], ['/m/cuenta/instalar', '/perfil/instalar'], ['/m/crm/12/chat', '/crm/12/chat'],
  ];
  for (const [interna, url] of casos) assert.equal(rutaEscritorio(interna), url, interna);
  // La query y el `#` viajan; lo que no es /m no se toca.
  assert.equal(rutaEscritorio('/m/inbox?vista=avisos&ws=3#x'), '/mako/pendientes?vista=avisos&ws=3#x');
  assert.equal(rutaEscritorio('/m/dashboard?hoja=comercial'), '/dashboard?hoja=comercial');
  for (const h of ['/mako', '/marketing', '/m.js', '/crm', 'https://x.com/m/crm', '']) assert.equal(rutaEscritorio(h), h, h);
});

test('una pantalla SÓLO del teléfono, abierta en la computadora, lleva a lo suyo', () => {
  assert.equal(respaldoEscritorio('/mas'), '/general');
  assert.equal(respaldoEscritorio('/configurar'), '/onboarding');
  assert.equal(respaldoEscritorio('/crm/12/chat'), '/crm/12');
  // /perfil/instalar dejó de ser sólo del teléfono el 15/10/2026: «Tu cuenta» › Instalar la app.
  for (const p of ['/crm', '/crm/12', '/perfil', '/perfil/instalar', '/general', '/mako']) assert.equal(respaldoEscritorio(p), null, p);
  // Y en el teléfono esas URLs son las páginas de /m.
  assert.equal(rutaMovil('/mas'), '/m/mas');
  assert.equal(rutaMovil('/crm/12/chat'), '/m/crm/12/chat');
  assert.equal(rutaMovil('/perfil/instalar'), '/m/cuenta/instalar');
});

// ── Las cinco formas de navegar pasan por conWs: ningún link muestra /m ────────────────────

test('conWs saca /m con y sin workspace (Link, router, rutaConWs, window.location y linkApp)', () => {
  // Roto (13/10/2026) sacando `rutaEscritorio` de `conWs`: 13 / 1 (éste).
  assert.equal(conWs('/m/crm/12', null), '/crm/12');
  assert.equal(conWs('/m/crm/12', 3), '/crm/12?ws=3');
  assert.equal(conWs('/m/hoy', 9), '/general?ws=9');
  assert.equal(conWs('/m/ads?periodo=7d', 3), '/ads-manager?periodo=7d&ws=3');
  // Lo de siempre no cambia.
  assert.equal(conWs('/crm', 3), '/crm?ws=3');
  assert.equal(conWs('/mako', null), '/mako');
});

// ── La decisión del proxy (pura) ───────────────────────────────────────────────────────────

const pm = (pathname: string, o: { search?: string; metodo?: string; telefono?: boolean } = {}) =>
  pedidoMovil({ pathname, search: o.search ?? '', metodo: o.metodo ?? 'GET', telefono: o.telefono ?? true });

test('el teléfono ve la página de /m en la MISMA URL (rewrite), con la query original entera', () => {
  assert.deepEqual(pm('/crm'), { tipo: 'reescribir', destino: '/m/crm' });
  assert.deepEqual(pm('/crm/12', { search: '?ws=3' }), { tipo: 'reescribir', destino: '/m/crm/12?ws=3' });
  assert.deepEqual(pm('/general'), { tipo: 'reescribir', destino: '/m/hoy' });
  assert.deepEqual(pm('/comercial', { search: 'ws=3' }), { tipo: 'reescribir', destino: '/m/dashboard?ws=3&hoja=comercial' });
  assert.deepEqual(pm('/dashboard', { search: '?hoja=mi-hoja&periodo=7d' }), { tipo: 'reescribir', destino: '/m/dashboard/mi-hoja?hoja=mi-hoja&periodo=7d' });
  assert.deepEqual(pm('/mako/pendientes', { search: '?vista=avisos' }), { tipo: 'reescribir', destino: '/m/inbox?vista=avisos' });
  // Una server action de la página del teléfono también va a /m: su respuesta trae el árbol de /m.
  assert.deepEqual(pm('/crm/12', { metodo: 'POST' }), { tipo: 'reescribir', destino: '/m/crm/12' });
});

test('el proxy no toca /api, lo público, el login, el repartidor ni lo que se usa en la computadora', () => {
  for (const p of ['/api/crm', '/api/v1/leads', '/privacidad', '/vsl', '/login', '/onboarding', '/integraciones', '/m.js', '/']) {
    assert.deepEqual(pm(p), { tipo: 'seguir' }, p);
  }
  // El repartidor en un TELÉFONO se resuelve en el borde (14/10/2026): un 307 a General, con la query.
  // Hecho en la página, /inicio se dibujaba con el layout de escritorio antes de su redirect (Vercel:
  // GET /inicio 200 y recién después /general), y Martín veía la Sidebar y el resto en blanco.
  // Probado rompiéndolo: sin la regla de /inicio en pedidoMovil → 13 / 1.
  assert.deepEqual(pm('/inicio'), { tipo: 'redirigir', destino: '/general' });
  assert.deepEqual(pm('/inicio', { search: '?ws=3' }), { tipo: 'redirigir', destino: '/general?ws=3' });
  assert.deepEqual(pm('/inicio', { telefono: false }), { tipo: 'seguir' }, 'la computadora reparte en la página, como siempre');
  assert.deepEqual(pm('/inicio', { metodo: 'POST' }), { tipo: 'seguir' });
  // /whatsapp dejó de ser «de la computadora» (v3): en el teléfono es la pestaña Chats.
  assert.deepEqual(pm('/whatsapp'), { tipo: 'reescribir', destino: '/m/chats' });
});

test('una URL /m vieja se REDIRIGE a la de escritorio (sólo GET y HEAD), para todos', () => {
  assert.deepEqual(pm('/m/crm/12', { search: '?ws=3' }), { tipo: 'redirigir', destino: '/crm/12?ws=3' });
  assert.deepEqual(pm('/m/hoy', { telefono: false }), { tipo: 'redirigir', destino: '/general' });
  assert.deepEqual(pm('/m', { metodo: 'HEAD' }), { tipo: 'redirigir', destino: '/general' });
  assert.deepEqual(pm('/m/crm/12', { metodo: 'POST' }), { tipo: 'seguir' });
  // Una /m que no está en la tabla no rebota en bucle.
  assert.deepEqual(pm('/m/inventada'), { tipo: 'seguir' });
});

test('la computadora (y el teléfono con «Versión completa») no se reescribe; lo sólo-teléfono se redirige', () => {
  assert.deepEqual(pm('/crm', { telefono: false }), { tipo: 'seguir' });
  assert.deepEqual(pm('/mas', { telefono: false }), { tipo: 'redirigir', destino: '/general' });
  assert.deepEqual(pm('/crm/12/chat', { telefono: false, search: 'ws=3' }), { tipo: 'redirigir', destino: '/crm/12?ws=3' });
});

test('urlReescrita: la query original entera, y lo que lee la página de /m gana', () => {
  assert.equal(urlReescrita('/m/dashboard?hoja=comercial', '?hoja=x&ws=3'), '/m/dashboard?hoja=comercial&ws=3');
  assert.equal(urlReescrita('/m/crm', ''), '/m/crm');
});

test('¿es la vista del teléfono?: /m siempre; una URL de escritorio, sólo en un teléfono', () => {
  assert.equal(esVistaMovil('/m/crm', '', false), true);
  assert.equal(esVistaMovil('/crm', '', true), true);
  assert.equal(esVistaMovil('/crm', '', false), false);
  assert.equal(esVistaMovil('/configuraciones', 'tab=notif', true), true);
  for (const p of ['/integraciones', '/onboarding', '/privacidad', '/inicio']) assert.equal(esVistaMovil(p, '', true), false, p);
  // La ruta interna que lee el shell.
  assert.equal(rutaInterna('/crm/12/resumen'), '/m/crm/12');
  assert.equal(rutaInterna('/video-generator', `plan=${UUID}`), `/m/video/${UUID}`);
  assert.equal(rutaInterna('/integraciones'), null);
});

// ── El proxy DE VERDAD ─────────────────────────────────────────────────────────────────────

function pedir(metodo: string, ruta: string, o: { ua?: string; rol?: 'admin' | 'usuario'; vista?: boolean; sinSesion?: boolean } = {}) {
  // `mfa`: desde el 2FA (14/10/2026) un token de admin sin segundo factor no es una sesión.
  const token = o.sinSesion ? null : crearToken({ sub: '7', email: 'x@y.com', nombre: 'X', rol: o.rol ?? 'usuario', ws: 3, mfa: 'totp' });
  const cookies = [token ? `${SESSION_COOKIE}=${token}` : '', o.vista ? `${VISTA_COOKIE}=${VISTA_ESCRITORIO}` : ''].filter(Boolean).join('; ');
  return proxy(new NextRequest(`http://localhost:3010${ruta}`, {
    method: metodo,
    headers: { 'user-agent': o.ua ?? IPHONE, ...(cookies ? { cookie: cookies } : {}) },
  }));
}
const reescrita = (r: Response) => {
  const u = r.headers.get('x-middleware-rewrite');
  return u ? new URL(u).pathname + new URL(u).search : null;
};

test('proxy: un iPhone con sesión pide /crm/12 y recibe la página de /m/crm/12 en esa URL', () => {
  // Roto (13/10/2026) dejando `return seguir(req)` en la salida con sesión: 11 / 3 (los tres del proxy).
  const r = pedir('GET', '/crm/12');
  assert.equal(r.status, 200);
  assert.equal(reescrita(r), '/m/crm/12', 'sin rewrite');
  // La computadora, con la misma sesión, ve su CRM.
  const e = pedir('GET', '/crm/12', { ua: ESCRITORIO });
  assert.equal(reescrita(e), null);
  assert.equal(e.headers.get('x-middleware-next'), '1');
  // Y el teléfono con «Versión completa», también.
  assert.equal(reescrita(pedir('GET', '/crm/12', { vista: true })), null);
});

test('proxy: el rewrite lleva el workspace SÓLO de un admin, como cualquier otra salida', () => {
  const admin = pedir('GET', '/crm?ws=13', { rol: 'admin' });
  assert.equal(reescrita(admin), '/m/crm?ws=13');
  assert.equal(admin.headers.get('x-middleware-request-x-mako-ws'), '13');
  const user = pedir('GET', '/crm?ws=13');
  assert.equal(reescrita(user), '/m/crm?ws=13');
  assert.equal(user.headers.get('x-middleware-request-x-mako-ws'), null, 'un ?ws= de un no-admin no puede elegir workspace');
});

test('proxy: sin sesión va al login, /api y lo público no se reescriben, y /m vieja redirige', () => {
  const sin = pedir('GET', '/crm', { sinSesion: true });
  assert.equal(sin.status, 307);
  assert.equal(new URL(sin.headers.get('location') ?? 'http://x/').pathname, '/login');
  assert.equal(reescrita(pedir('GET', '/api/notificaciones')), null);
  assert.equal(reescrita(pedir('GET', '/privacidad')), null);
  const vieja = pedir('GET', '/m/crm/12?ws=13', { rol: 'admin' });
  assert.equal(vieja.status, 307);
  const destino = new URL(vieja.headers.get('location') ?? 'http://x/');
  assert.equal(destino.pathname + destino.search, '/crm/12?ws=13');
});

// ── Lo que mira el navegador ───────────────────────────────────────────────────────────────

test('nadie navega a /m: el desvío sólo tapa, el shell lee la ruta interna, el cromo pregunta si es teléfono', () => {
  const desvio = leer('app/_components/DesvioMovil.tsx');
  assert.ok(!/router\.replace\(destinoMovil\(d\.destino/.test(desvio) && !desvio.includes('useEffect'), 'el desvío volvió a navegar');
  assert.ok(desvio.includes("if (desvio.tipo !== 'computadora') return null;"), 'el desvío tapa algo que no es «en la computadora»');
  const shell = leer('app/m/_ui/ShellM.tsx');
  assert.ok(shell.includes('const pathname = useRutaInterna();') && !shell.includes('usePathname('), 'el shell lee la URL y no la ruta interna');
  // Y en un teléfono el cromo de escritorio no se dibuja NUNCA, tampoco en una pantalla sin versión del
  // teléfono (/inicio pintado antes de su redirect: la Sidebar angosta y el resto en blanco, 14/10/2026).
  assert.ok(leer('app/_components/PublicRouteGate.tsx').includes('if (movil || telefono || esVistaSinChrome(pathname)) return null;'), 'el Sidebar se dibuja sobre la página del teléfono');
  assert.ok(leer('app/_components/NotificationsProvider.tsx').includes('const enMovil = (p: string) => telefonoRef.current || esRutaMovil(p);'), 'los pollers de escritorio corren en el teléfono');
  // Los atajos de la app instalada y el link por default de un push no muestran /m.
  assert.ok(!/url: '\/m\//.test(leer('app/manifest.ts')), 'un atajo del manifest apunta a /m');
  assert.ok(!readFileSync(join(RAIZ, 'public', 'sw.js'), 'utf8').includes("'/m/"), 'el service worker abre una URL /m');
});
