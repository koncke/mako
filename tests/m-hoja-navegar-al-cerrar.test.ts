// =============================================================================
// Ticket #27 (29/10/2026): en el CRM del teléfono, elegir otro funnel en la hoja «Funnel» NO HACÍA NADA, siempre
// =============================================================================
// Joan (ws13, Código Inmobiliario), en el workspace de su cliente Natalia (ws19, funnels «Funnel principal» y «Venta
// Props»): «Desde el celular, no deja cambiar la hoja del CRM. Cliente Natalia, toco ahí en "Venta Props" para cambiar,
// y no hace nada». Siempre que lo intenta.
//
// La causa: el renglón hacía `setElegirFunnel(false); router.push('/crm?funnel=41')`. El push queda EN CURSO (pide la
// página al server) y, cuando React dibuja la hoja cerrada, SheetM saca su `?sheet=funnel` con `replaceState`. Next 16
// escucha ese replaceState (su parche de `window.history`) y lo despacha como ACTION_RESTORE, y un RESTORE DESCARTA la
// navegación en curso. El tablero se quedaba en «Funnel principal». El comentario del renglón decía que era seguro.
//
// No hay DOM ni Next en estos tests: corre el historial REAL de las hojas (app/m/_ui/hoja-historial.ts) contra un
// `window.history` que hace lo que hace Next (el parche y la cola, leídos de node_modules en el primer test).
// ── Probado rompiéndolo (29/10/2026), de a una y restaurando. Ver el pie. ──
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { navegarAlCerrar, registrarApertura, soltarAlDesmontar, soltarPorCodigo, soltarPorGesto } from '../app/m/_ui/hoja-historial';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('Next 16 hace esto de verdad: el replaceState de una hoja es un RESTORE, y un RESTORE descarta la navegación en curso', () => {
  const router = readFileSync(join(RAIZ, 'node_modules/next/dist/client/components/app-router.js'), 'utf8');
  assert.match(router, /window\.history\.replaceState = function replaceState\(data, _unused, url\) \{[\s\S]{0,400}?if \(data\?\.__NA \|\| data\?\._N\) \{\s*return originalReplaceState[\s\S]{0,200}?applyUrlFromHistoryPushReplace\(url\);/);
  assert.match(router, /const applyUrlFromHistoryPushReplace = \(url\)=>\{[\s\S]{0,300}?type: _routerreducertypes\.ACTION_RESTORE/);
  const cola = readFileSync(join(RAIZ, 'node_modules/next/dist/client/components/app-router-instance.js'), 'utf8');
  assert.match(cola, /else if \(payload\.type === _routerreducertypes\.ACTION_NAVIGATE \|\| payload\.type === _routerreducertypes\.ACTION_RESTORE\) \{[\s\S]{0,300}?actionQueue\.pending\.discarded = true;/);
});

// ── Un `window` que hace lo que hace Next con el historial ──────────────────────
type Accion = { url: string; descartada: boolean };
const nav = { url: '/crm?ws=19', pendiente: null as Accion | null };
let barra = '/crm?ws=19';
function despachar(tipo: 'navigate' | 'restore', url: string) {
  // app-router-instance.js: una navegación o un restore nuevos descartan lo que estaba en curso.
  if (nav.pendiente) nav.pendiente.descartada = true;
  nav.pendiente = null;
  if (tipo === 'restore') { nav.url = url; return; }   // restoreReducer no espera nada
  nav.pendiente = { url, descartada: false };           // navigate pide la página al server
}
/** Llega la página del server: si nadie la descartó, Next la pone (con su propio pushState, `__NA`). */
function llegaLaPagina() {
  const a = nav.pendiente;
  nav.pendiente = null;
  if (a && !a.descartada) { nav.url = a.url; barra = a.url; }
}
const parcheDeNext = (data: unknown, url?: string | null) => {
  if (url && !(data as { __NA?: boolean } | null)?.__NA) despachar('restore', url);
  if (url) barra = url;
};
(globalThis as unknown as { window: unknown }).window = {
  location: { get href() { return `https://hola-mako.com${barra}`; } },
  history: { pushState: (d: unknown, _t: string, u?: string) => parcheDeNext(d, u), replaceState: (d: unknown, _t: string, u?: string) => parcheDeNext(d, u), back: () => {} },
  addEventListener: () => {},
};
const router = { push: (url: string) => despachar('navigate', url) };
function desde(url: string) { nav.url = url; nav.pendiente = null; barra = url; }

/** La hoja «Funnel» de app/m/crm/TableroCrm.tsx, abierta: lo que hace SheetM al abrirla. */
function abrirHoja(id: string) {
  const clave = {};
  registrarApertura({ id, clave, cerrarYa: () => {}, ocupado: () => false });
  return clave;
}

test('ANTES (el ticket): cerrar la hoja y hacer router.push en el mismo toque perdía el cambio de funnel', () => {
  desde('/crm?ws=19');
  const hoja = abrirHoja('funnel');
  assert.equal(barra, '/crm?ws=19&sheet=funnel');
  // El toque en «Venta Props», como estaba: el push sale ya; el replaceState, cuando React dibuja la hoja cerrada.
  router.push('/crm?funnel=41&ws=19');
  soltarPorCodigo('funnel', hoja);
  llegaLaPagina();
  assert.equal(nav.url, '/crm?ws=19', 'se quedó en el Funnel principal: es lo que vio Joan');
});

test('AHORA: con navegarAlCerrar, el push sale DESPUÉS del replaceState de la hoja y llega a «Venta Props»', () => {
  desde('/crm?ws=19');
  const hoja = abrirHoja('funnel');
  navegarAlCerrar(() => router.push('/crm?funnel=41&ws=19'));
  assert.equal(nav.pendiente, null, 'todavía no: espera a que la hoja suelte su ?sheet=');
  soltarPorCodigo('funnel', hoja);
  llegaLaPagina();
  assert.equal(nav.url, '/crm?funnel=41&ws=19');
  assert.equal(barra, '/crm?funnel=41&ws=19');
});

test('sin una hoja abierta navega ya; un gesto la tira; desmontada, sale; y nunca se dispara tarde en la próxima apertura', () => {
  desde('/crm?ws=19');
  navegarAlCerrar(() => router.push('/crm/7'));
  llegaLaPagina();
  assert.equal(nav.url, '/crm/7', 'sin hoja no hay nada que esperar');

  desde('/crm?ws=19');
  let corrio = 0;
  const a = abrirHoja('info');
  navegarAlCerrar(() => { corrio += 1; });
  soltarPorGesto('info', a);
  assert.equal(corrio, 0, 'cerrada por un gesto, su back() la desharía igual');
  const a2 = abrirHoja('info');
  soltarPorCodigo('info', a2);
  assert.equal(corrio, 0, 'la de antes no se dispara al cerrar la próxima');

  // Una hoja que otra reemplazó con su navegación esperando, reabierta después (la misma instancia: la misma clave).
  desde('/crm?ws=19');
  const c = {};
  registrarApertura({ id: 'info', clave: c, cerrarYa: () => {}, ocupado: () => false });
  navegarAlCerrar(() => { corrio += 1; });
  const otra = abrirHoja('funnel');
  soltarPorCodigo('funnel', otra);
  registrarApertura({ id: 'info', clave: c, cerrarYa: () => {}, ocupado: () => false });
  soltarPorCodigo('info', c);
  assert.equal(corrio, 0, 'una navegación vieja no sale al cerrar la misma hoja reabierta');

  desde('/crm?ws=19');
  const b = abrirHoja('nuevo-lead');
  navegarAlCerrar(() => router.push('/crm/9'));
  soltarAlDesmontar(b);
  llegaLaPagina();
  assert.equal(nav.url, '/crm/9', 'la pantalla dejó de dibujar la hoja: sin replaceState, nada la descarta');
});

// ── La entrada real: el renglón de la hoja, y SheetM que suelta la URL al cerrarse ──
test('el renglón de la hoja «Funnel» (y los otros que cierran y navegan) pasan por navegarAlCerrar', () => {
  const t = sinComentarios(leer('app/m/crm/TableroCrm.tsx'));
  assert.match(t, /onClick=\{\(\) => \{ setElegirFunnel\(false\); if \(!es\) navegarAlCerrar\(\(\) => router\.push\(urlFunnel\(f\.id\)\)\); \}\}/);
  assert.equal((t.match(/setAlta\(false\); navegarAlCerrar\(\(\) => router\.push\(ficha\(id\)\)\);/g) ?? []).length, 2, 'onCreado y onAgregado');
  assert.match(t, /\{ texto: 'Abrir ficha', onClick: \(\) => \{ const id = r\.id; setRapida\(null\); navegarAlCerrar\(\(\) => router\.push\(ficha\(id\)\)\); \}/);
  assert.match(sinComentarios(leer('app/m/inbox/InboxM.tsx')), /const irAFicha = \(href: string\) => \{ onCerrar\(\); navegarAlCerrar\(\(\) => router\.push\(href\)\); \};/);
  // SheetM, al cerrarse por código, suelta la URL con el historial de las hojas (el que corre la navegación que espera).
  const s = sinComentarios(leer('app/m/_ui/SheetM.tsx'));
  assert.match(s, /import \{ registrarApertura, soltarAlDesmontar, soltarPorCodigo, soltarPorGesto \} from '\.\/hoja-historial';/);
  assert.match(s, /if \(abierto \|\| !montada\) return;\s*if \(!porGesto\.current\) soltarPorCodigo\(id, clave\.current\);/);
  assert.match(s, /useEffect\(\(\) => \(\) => soltarAlDesmontar\(clave\.current\),/);
  assert.doesNotMatch(s, /window\.history\./, 'el historial de las hojas vive en un solo lugar');
});

test('⚠️ en ninguna pantalla del teléfono se cierra algo y se navega pelado en el mismo toque', () => {
  const malos: string[] = [];
  const recorrer = (dir: string) => {
    for (const n of readdirSync(join(RAIZ, dir))) {
      const rel = `${dir}/${n}`;
      if (statSync(join(RAIZ, rel)).isDirectory()) { recorrer(rel); continue; }
      if (!/\.tsx?$/.test(n)) continue;
      const src = sinComentarios(leer(rel));
      for (const m of src.matchAll(/(?:set\w+\((?:false|null)\)|onCerrar\(\)|cerrar\([^)]*\));\s*(?:if \([^)]*\) )?router\.(?:push|replace)\(/g)) malos.push(`${rel}: ${m[0]}`);
    }
  };
  recorrer('app/m');
  assert.deepEqual(malos, [], 'cerrar una hoja y navegar en el mismo toque va con navegarAlCerrar (app/m/_ui/hoja-historial.ts)');
});

// ── Probado rompiéndolo (29/10/2026), de a una y restaurando. Con tests/m-crm-nuevo-lead.test.ts: base 7/0, final 7/0 ──
// R1  el renglón de «Venta Props» con el push pelado, como estaba → 5/2 · R2 soltarPorCodigo no corre la que espera → 6/1
// R3  la navegación sale ANTES del replaceState → 6/1 · R4 navegarAlCerrar navega ya con la hoja abierta → 5/2
// R5  una apertura nueva no tira la que quedó esperando → 6/1 · R6 desmontada, la navegación no sale → 6/1
// R7  SheetM sin soltarAlDesmontar → 6/1 · R8 la Bandeja con el push pelado → 5/2 · R9 el Calendario, pelado → 6/1
// R10 «Abrir ficha», pelado → 5/2 · R11 onCreado, pelado → 4/3
// (el primer test lee la regla de Next en node_modules: no se rompió, se rompe solo si Next la cambia)
