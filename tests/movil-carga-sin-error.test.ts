// =============================================================================
// La app del teléfono abre en UN documento, la entrada de MaKo se gasta cuando se VIO, y si la app muere arriba de
// nuestros boundaries se avisa el error real y se reintenta UNA vez (21/10/2026)
// =============================================================================
// Martín, desde su Android (21/10, 22:54): «Aún no veo la animación de MaKo en mobile y siempre que entro me sale el
// reload». Medido (docs/hallazgos-mobile.md): la pantalla era la PROPIA de Next 16 (arriba de app/global-error.tsx); cada
// apertura eran dos documentos (/inicio → /second-brain → redirect en el stream → /admin/operaciones) y la entrada se
// gastaba en el primero; el reportador de la ventana no corría en el teléfono. Lo que fija este archivo:
//   1. el super admin entra al Centro desde el BORDE (un 307 y un solo documento), y el proxy le pasa quién es;
//   2. la marca de «ya salió» de la entrada se pone al TERMINAR la entrada, no al montarla;
//   3. el centinela (corrido de verdad, en una ventana falsa): avisa `PantallaDeNext` con el error real, recarga UNA vez y
//      no entra en bucle; sin sessionStorage no recarga; sin la pantalla de Next no hace nada;
//   4. `PantallaDeNext` nunca es ruido, aunque diga ChunkLoadError; el resto del ruido sigue siendo ruido;
//   5. el layout monta el centinela y el reportador también en el teléfono (sólo fuera de lo público), y el reportador se
//      calla cuando avisa el centinela (un choque, un ticket).
//
// ROTURAS (21/10/2026, scratchpad `romper-carga.cjs`: una por vez, restaurada y comprobada con sha256; base 5 / 0):
//   · `entradaMovil` devolviendo siempre ENTRADA_MOVIL (lo de antes)                    → 4 / 1 (test 1)
//   · el proxy sin pasarle `operador` a pedidoMovil                                     → 4 / 1 (test 1)
//   · ShellM vuelve a escribir la marca al montar                                       → 4 / 1 (test 2)
//   · el centinela sin la guarda de sessionStorage (recarga siempre)                    → 4 / 1 (test 3)
//   · el centinela recargando aunque no haya sessionStorage                             → 4 / 1 (test 3)
//   · esRuido sin la excepción de PantallaDeNext                                        → 4 / 1 (test 4)
//   · el reportador de vuelta adentro de <HideOnPublicLanding>                          → 4 / 1 (test 5)
//   · el reportador sin callarse ante la pantalla de Next                               → 4 / 1 (test 5)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { CENTRO_MOVIL, entradaMovil, pedidoMovil } from '../lib/movil-desvio';
import { ENTRADA_MOVIL } from '../lib/movil-rutas';
import { CENTINELA_ARRANQUE, CLAVE_REINTENTO, MS_REINTENTO } from '../app/_components/CentinelaArranque';
import { ID_PANTALLA_DE_NEXT, PANTALLA_DE_NEXT, esRuido } from '../lib/errores-app-reglas';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const pm = (pathname: string, o: { search?: string; metodo?: string; operador?: boolean } = {}) =>
  pedidoMovil({ pathname, search: o.search ?? '', metodo: o.metodo ?? 'GET', telefono: true, operador: o.operador });

test('el super admin abre la app derecho en el Centro: un 307 desde el borde, sin pasar por /second-brain', () => {
  assert.equal(CENTRO_MOVIL, '/admin/operaciones');
  assert.deepEqual(pm('/inicio', { operador: true }), { tipo: 'redirigir', destino: '/admin/operaciones' });
  // Con `?ws=` la pestaña es de un negocio: la decide la página, como siempre.
  assert.deepEqual(pm('/inicio', { operador: true, search: '?ws=9' }), { tipo: 'redirigir', destino: `${ENTRADA_MOVIL}?ws=9` });
  assert.deepEqual(pm('/inicio'), { tipo: 'redirigir', destino: ENTRADA_MOVIL }, 'un cliente sigue entrando a su chat');
  assert.deepEqual(pm('/inicio', { operador: true, metodo: 'POST' }), { tipo: 'seguir' });
  // Un /second-brain pelado (un link viejo) del super admin también va derecho; con query, a la página.
  assert.deepEqual(pm(ENTRADA_MOVIL, { operador: true }), { tipo: 'redirigir', destino: '/admin/operaciones' });
  assert.deepEqual(pm(ENTRADA_MOVIL, { operador: true, search: '?panel=mapa' }), { tipo: 'reescribir', destino: '/m/second-brain/mapa?panel=mapa' });
  assert.deepEqual(pm(ENTRADA_MOVIL), { tipo: 'reescribir', destino: '/m/second-brain' });
  assert.equal(entradaMovil(true, 'utm=x'), '/admin/operaciones');
  // El proxy le dice quién es (el rol de la sesión firmada), en la salida con sesión.
  const proxy = sinComentarios(leer('proxy.ts'));
  assert.match(proxy, /return seguirOMovil\(req, pathname, sesion\.rol === 'admin'\);/);
  assert.match(proxy, /pedidoMovil\(\{ pathname, search: req\.nextUrl\.search, metodo: req\.method\.toUpperCase\(\), telefono, operador \}\)/);
});

// 22/10/2026: la entrada pasó a EntradaApp, en el primer HTML (tests/movil-entrada.test.ts). La lectura de la marca vive en
// EntradaApp (al montarse) y en el script de antes de pintar; lo que este test cuida sigue igual: nadie la ESCRIBE al montar.
test('la marca de «ya salió» de la entrada se pone cuando la entrada TERMINA, no al montarla', () => {
  const shell = sinComentarios(leer('app/m/_ui/ShellM.tsx'));
  const montar = shell.slice(shell.indexOf('const [entrada, setEntrada] = useState('), shell.indexOf('const finEntrada = useCallback('));
  assert.ok(montar.length > 0, 'no encontré el estado de la entrada en ShellM');
  assert.doesNotMatch(montar, /setItem/, 'puesta al montar, la gasta un documento que se va (la apertura de dos documentos)');
  const fin = shell.slice(shell.indexOf('const finEntrada = useCallback('), shell.indexOf('// ── Toasts'));
  assert.match(fin, /sessionStorage\.setItem\(LS_ENTRADA, '1'\)/);
  assert.match(shell, /<EntradaApp destino=\{`\[\$\{DESTINO_ENTRADA\}\]`\} onFin=\{finEntrada\} \/>/);
  // La entrada lee la marca y avisa el fin; escribirla es de ShellM, al terminar.
  const entrada = sinComentarios(leer('app/m/_ui/EntradaApp.tsx'));
  assert.match(entrada, /sessionStorage\.getItem\(CLAVE_ENTRADA_MOVIL\)/);
  assert.doesNotMatch(entrada, /setItem/, 'la entrada se marca vista sola, al montarse');
});

/** Una ventana falsa donde correr el centinela de verdad. `storage: null` = sessionStorage que tira (modo privado). */
function ventana(opciones: { storage?: Map<string, string> | null; ahora?: number } = {}) {
  const oyentes: Record<string, ((e: unknown) => void)[]> = {};
  const enviados: Record<string, unknown>[] = [];
  let recargas = 0;
  let observar: (() => void) | null = null;
  const html = { id: '' };
  const storage = opciones.storage === undefined ? new Map<string, string>() : opciones.storage;
  const w: Record<string, unknown> = {
    addEventListener: (t: string, f: (e: unknown) => void) => { (oyentes[t] ??= []).push(f); },
    document: { documentElement: html },
    MutationObserver: class { constructor(f: () => void) { observar = f; } observe() {} },
    fetch: (_u: string, o: { body: string }) => { enviados.push(JSON.parse(o.body)); return Promise.resolve(); },
    sessionStorage: {
      getItem: (k: string) => { if (!storage) throw new Error('SecurityError'); return storage.get(k) ?? null; },
      setItem: (k: string, v: string) => { if (!storage) throw new Error('SecurityError'); storage.set(k, v); },
    },
    location: { pathname: '/admin/operaciones', search: '', reload: () => { recargas += 1; } },
    navigator: { userAgent: 'Android' },
    innerWidth: 412, innerHeight: 915,
    setTimeout: (f: () => void) => f(),
    Date: { now: () => opciones.ahora ?? 1_000_000 },
    JSON, String, Number,
  };
  w.window = w;
  vm.runInNewContext(CENTINELA_ARRANQUE, w);
  return {
    storage,
    error: (e: unknown) => (oyentes.error ?? []).forEach((f) => f(e)),
    rechazo: (e: unknown) => (oyentes.unhandledrejection ?? []).forEach((f) => f(e)),
    pantallaDeNext: () => { html.id = ID_PANTALLA_DE_NEXT; observar?.(); },
    otroAtributo: () => { observar?.(); },
    enviados, get recargas() { return recargas; },
  };
}

test('el centinela: avisa el error real como PantallaDeNext y recarga UNA vez, sin bucle', () => {
  // Parsea solo, como lo va a correr el navegador.
  assert.doesNotThrow(() => new vm.Script(CENTINELA_ARRANQUE));
  const v = ventana();
  const err = Object.assign(new Error('boom'), { name: 'TypeError' });
  v.error({ error: err, message: 'Uncaught TypeError: boom', target: undefined });
  v.otroAtributo();
  assert.equal(v.enviados.length, 0, 'sin la pantalla de Next no hay nada que avisar');
  v.pantallaDeNext();
  assert.equal(v.enviados.length, 1);
  assert.equal(v.enviados[0].nombre, PANTALLA_DE_NEXT);
  assert.equal(v.enviados[0].mensaje, 'TypeError: boom');
  assert.equal(v.enviados[0].ruta, '/admin/operaciones');
  assert.equal(v.recargas, 1);
  v.pantallaDeNext();
  assert.equal(v.enviados.length, 1, 'una vez por documento');

  // El documento recargado vuelve a caer enseguida: avisa, pero NO recarga (la marca de sessionStorage).
  const otra = ventana({ storage: v.storage, ahora: 1_000_000 + 5_000 });
  otra.rechazo({ reason: Object.assign(new Error('Failed to fetch dynamically imported module'), { name: 'TypeError' }) });
  otra.pantallaDeNext();
  assert.equal(otra.enviados.length, 1);
  assert.equal(otra.recargas, 0, 'un bucle de recargas');
  // Pasada la ventana, vuelve a reintentar.
  const despues = ventana({ storage: v.storage, ahora: 1_000_000 + MS_REINTENTO + 1 });
  despues.pantallaDeNext();
  assert.equal(despues.recargas, 1);
  assert.equal(despues.enviados[0].mensaje, '(sin error capturado)');
  assert.ok(v.storage?.has(CLAVE_REINTENTO));

  // Sin sessionStorage no hay con qué cortar un bucle: avisa y no recarga.
  const privado = ventana({ storage: null });
  privado.pantallaDeNext();
  assert.equal(privado.enviados.length, 1);
  assert.equal(privado.recargas, 0);

  // Un archivo que no cargó (un chunk) queda nombrado, sin su query.
  const chunk = ventana();
  chunk.error({ target: { src: 'https://hola-mako.com/_next/static/chunks/abc.js?dpl=dpl_x' } });
  chunk.pantallaDeNext();
  assert.equal(chunk.enviados[0].mensaje, 'RecursoNoCargo: https://hola-mako.com/_next/static/chunks/abc.js');
});

test('PantallaDeNext nunca es ruido; el ruido de siempre sigue siéndolo', () => {
  assert.equal(esRuido({ nombre: PANTALLA_DE_NEXT, mensaje: 'ChunkLoadError: Loading chunk 12 failed', stack: '' }), false);
  assert.equal(esRuido({ nombre: PANTALLA_DE_NEXT, mensaje: 'TypeError: Failed to fetch' }), false);
  assert.equal(esRuido({ nombre: 'ChunkLoadError', mensaje: 'Loading chunk 12 failed' }), true);
  assert.equal(esRuido({ nombre: 'TypeError', mensaje: 'Failed to fetch' }), true);
});

test('el layout monta el centinela con sesión, y el reportador también en el teléfono (fuera de lo público)', () => {
  const layout = sinComentarios(leer('app/layout.tsx'));
  assert.match(layout, /\{sesion && <CentinelaArranque \/>\}/);
  assert.match(layout, /\{sesion && <FueraDeLoPublico><ReportadorDeErrores \/><\/FueraDeLoPublico>\}/);
  assert.doesNotMatch(layout, /<HideOnPublicLanding><ReportadorDeErrores/, 'HideOnPublicLanding lo apaga en todo teléfono');
  const gate = sinComentarios(leer('app/_components/PublicRouteGate.tsx'));
  const fuera = gate.slice(gate.indexOf('export function FueraDeLoPublico'));
  assert.match(fuera, /if \(isPublicLandingPath\(pathname\)\) return null;/);
  assert.doesNotMatch(fuera, /useTelefono|useVistaMovil|esVistaSinChrome/);
  // Un choque, un ticket: el reportador se calla cuando la pantalla es la de Next (lo avisa el centinela).
  const rep = sinComentarios(leer('app/_components/ReportarErrores.tsx'));
  assert.match(rep, /if \(document\.documentElement\.id === ID_PANTALLA_DE_NEXT\) return;/);
});
