// =============================================================================
// Soporte: lo que se adjunta llega con SU ticket, y un reintento manda lo mismo (revisión de 046d9e028, 28/10/2026)
// =============================================================================
// La revisión del Cerebro (C:/dev/revisiones/2810-ticketera-046d9e028.md) corrió el hook REAL con la subida en pausa y vio:
//   1. el ticket que se manda mientras la foto sube sale SIN la foto (y la descripción igual dice «📎 foto.jpg»), y la subida
//      que termina después se suma a la conversación NUEVA: la foto se iba con el próximo ticket de esa persona;
//   2. «Reintentar» una respuesta que no salió mandaba «📎 captura.png» como texto y sin el archivo.
// Esto corre el mismo hook (app/tickets/soporte/useSoporte.ts) con un mini runtime de hooks (los efectos corren después de cada
// dibujo), las acciones de mentira y la subida en pausa hasta que el test la suelta. Lo aprendido: docs/hallazgos-ticketera.md.
//
// Probado rompiéndolo (28/10/2026), una rotura por vez: el ticket sin esperar las subidas · el .then sin mirar la
// conversación · la línea «📎» al relato antes de subir · el reintento con el texto visto y sin archivos · el reintento que
// vuelve a subir lo ya subido · el tope por ticket sin contar lo que ya subió · la persona sin ver su archivo al responder.
// =============================================================================

import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { paraElCliente } from '../lib/tickets-reglas';
import { TOPE_DIA_ARCHIVOS_TICKET, problemaDelDiaTicket } from '../lib/tickets-adjuntos';

const raiz = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8').replace(/\r\n/g, '\n');

// ── El hook real, armado con esbuild y sus vecinos de mentira ──
const STUBS: Record<string, string> = {
  react: `
    const rt = () => globalThis.__soporte.rt;
    export function useState(init) { const r = rt(); const i = r.idx++; if (!(i in r.hooks)) r.hooks[i] = typeof init === 'function' ? init() : init;
      return [r.hooks[i], (v) => { r.hooks[i] = typeof v === 'function' ? v(r.hooks[i]) : v; }]; }
    export function useRef(init) { const r = rt(); const i = r.idx++; if (!(i in r.hooks)) r.hooks[i] = { current: init }; return r.hooks[i]; }
    export const useCallback = (fn) => fn;
    export const useMemo = (fn) => fn();
    export const useSyncExternalStore = (suscribir, leer) => leer();
    export function useEffect(fn, deps) { const r = rt(); const i = r.idx++; const antes = r.hooks[i];
      if (!antes || !deps || deps.some((d, k) => !Object.is(d, antes.deps[k]))) r.efectos.push(() => { antes?.limpiar?.(); r.hooks[i] = { deps, limpiar: fn() }; }); }`,
  acciones: `
    const g = () => globalThis.__soporte;
    export async function levantarDesdeSoporteAction(e) { const id = 101 + g().levantados.length; g().levantados.push({ id, descripcion: e.descripcion, adjuntos: (e.adjuntos ?? []).map((a) => a.nombre) }); return { ok: true, id }; }
    export async function verMiTicketAction(id) { return { id, titulo: 't', actualizado: new Date().toISOString(), puedeResponder: true, lineas: [], estado: 'recibido' }; }
    export async function contestarTicketAction(id, texto, adjuntos) { g().respuestas.push({ texto, adjuntos: (adjuntos ?? []).map((a) => a.nombre) }); return g().alContestar.shift() ?? { ok: true, ticket: null }; }`,
  navegador: 'export const contextoDelNavegador = () => ({});',
  subir: 'export function subirAdjuntosTicket(archivos) { return new Promise((resolve) => globalThis.__soporte.pendientes.push({ nombres: archivos.map((f) => f.name), resolve })); }',
  // La nota de voz (app/_chat/useNotaEnElActo.ts): la transcripción queda en pausa hasta que el test la suelta.
  preparar: 'export function prepararNota() { return new Promise((resolve) => globalThis.__soporte.notas.push(resolve)); }',
};

type Pendiente = { nombres: string[]; resolve: (r: unknown) => void };
type Estado = { rt: { hooks: unknown[]; idx: number; efectos: Array<() => void> }; levantados: Array<{ id: number; descripcion: string; adjuntos: string[] }>; respuestas: Array<{ texto: string; adjuntos: string[] }>; pendientes: Pendiente[]; alContestar: unknown[]; notas: Array<(r: unknown) => void> };
const g = globalThis as unknown as { __soporte: Estado };

let hook: ((p: unknown) => any) | null = null; // eslint-disable-line @typescript-eslint/no-explicit-any
let demora = 0;
async function cargar() {
  if (hook) return hook;
  const { build } = createRequire(join(raiz, 'package.json'))('esbuild') as typeof import('esbuild');
  const r = await build({
    entryPoints: [join(raiz, 'app/tickets/soporte/useSoporte.ts')], bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
    plugins: [{ name: 'vecinos', setup(b) {
      const virtual = (filter: RegExp, clave: string) => b.onResolve({ filter }, () => ({ path: clave, namespace: 'stub' }));
      virtual(/^react$/, 'react'); virtual(/^\.\.\/acciones$/, 'acciones'); virtual(/^\.\.\/navegador$/, 'navegador'); virtual(/^\.\/subir-adjuntos$/, 'subir');
      virtual(/^\.\/preparar-nota$/, 'preparar');
      b.onLoad({ filter: /.*/, namespace: 'stub' }, (a) => ({ contents: STUBS[a.path], loader: 'js' }));
      b.onResolve({ filter: /^@\// }, (a) => ({ path: ['.ts', '.tsx'].map((x) => join(raiz, `${a.path.slice(2)}${x}`)).find((x) => existsSync(x)) ?? join(raiz, `${a.path.slice(2)}.ts`) }));
    } }],
  });
  const mod = await import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`);
  hook = mod.useSoporte;
  demora = mod.MAKO_ESCRIBE_MS;
  return hook!;
}

/** Una pantalla de Soporte: `r()` la dibuja (y corre sus efectos), como React después de cada cambio. Los temporizadores son del
 *  test (MaKo «escribe» `MAKO_ESCRIBE_MS` antes de contestar); las promesas se sueltan con `setImmediate`. */
const vuelta = () => new Promise((x) => setImmediate(x));
async function pantalla(t: TestContext, props: Record<string, unknown> = { tickets: [], inicial: 'nuevo', movil: true }) {
  const useSoporte = await cargar();
  t.mock.timers.enable({ apis: ['setTimeout'] });
  g.__soporte = { rt: { hooks: [], idx: 0, efectos: [] }, levantados: [], respuestas: [], pendientes: [], alContestar: [], notas: [] };
  const r = () => {
    const rt = g.__soporte.rt;
    rt.idx = 0;
    const s = useSoporte(props);
    const ef = rt.efectos; rt.efectos = [];
    for (const f of ef) f();
    return s;
  };
  const decir = (texto: string) => { r().setTexto(texto); r().mandar(); t.mock.timers.tick(demora); return r(); };
  /** Cuenta un problema hasta que aparece la tarjeta del ticket. */
  const hastaLaTarjeta = (texto: string) => {
    let s = decir(texto);
    for (let i = 0; i < 4 && !s.borrador; i++) s = decir('Siempre, cada vez que lo intento, desde la computadora');
    assert.ok(s.borrador, 'MaKo no armó el ticket');
    return s;
  };
  /** Adjunta y manda (con lo escrito). */
  const adjuntarYMandar = (nombres: string[], texto = '') => {
    r().adjuntosCaja.onSumar(nombres.map((n) => new File([new Uint8Array(10)], n, { type: n.endsWith('.png') ? 'image/png' : 'image/jpeg' })));
    if (texto) r().setTexto(texto);
    r().mandar();
    return r();
  };
  const soltar = async (i: number, como: 'bien' | 'mal') => {
    const p = g.__soporte.pendientes[i];
    p.resolve(como === 'bien'
      ? { ok: true, adjuntos: p.nombres.map((nombre, k) => ({ path: `3/tickets/0b6d5b75-4a1f-4c2d-9e3f-01234567890${k}`, nombre, mime: 'image/jpeg', bytes: 10 })) }
      : { ok: false, error: 'No hay conexión: los archivos no subieron.' });
    await vuelta();
    t.mock.timers.tick(demora);
    return r();
  };
  const ultimoMio = (s: { items: Array<{ k: string; role?: string; texto?: string; estado?: string; id: string }> }) => [...s.items].reverse().find((x) => x.k === 'msg' && x.role === 'user')!;
  return { r, decir, hastaLaTarjeta, adjuntarYMandar, soltar, ultimoMio, e: g.__soporte, demora };
}

test('1: el ticket ESPERA a la foto que sube («Subiendo archivos…») y sale con ella; el «📎» entra al relato cuando subió', async (t) => {
  const p = await pantalla(t);
  p.hastaLaTarjeta('No me deja guardar el lead en el CRM, sale un error rojo');
  let s = p.adjuntarYMandar(['foto.jpg'], 'acá va la captura');
  assert.equal(p.ultimoMio(s).estado, 'enviando');
  assert.match(p.ultimoMio(s).texto ?? '', /acá va la captura\n📎 foto\.jpg/, 'se ve en el acto, con su archivo');
  assert.doesNotMatch(s.borrador?.descripcion ?? '', /📎/, 'el «📎» entró al relato antes de que la foto subiera');
  const mandado = s.mandarTicket();
  s = p.r();
  assert.equal(s.subiendo, true, 'la tarjeta no dice que espera los archivos');
  assert.equal(p.e.levantados.length, 0, 'el ticket salió sin esperar la foto');
  await p.soltar(0, 'bien');
  await mandado;
  assert.deepEqual(p.e.levantados[0].adjuntos, ['foto.jpg']);
  assert.match(p.e.levantados[0].descripcion, /foto\.jpg/, 'la descripción no nombra lo que va con el ticket');
});

test('1b: una subida que termina en OTRA conversación no se suma a ella (la foto no se va con el próximo ticket)', async (t) => {
  const p = await pantalla(t);
  p.hastaLaTarjeta('No me deja guardar el lead en el CRM, sale un error rojo');
  p.adjuntarYMandar(['foto.jpg']);
  p.r().nuevo();
  await p.soltar(0, 'bien');
  const s = p.hastaLaTarjeta('Quiero pedir que el calendario muestre los feriados de Argentina');
  await s.mandarTicket();
  assert.deepEqual(p.e.levantados[0].adjuntos, [], 'la foto de la conversación anterior se fue con este ticket');
  assert.doesNotMatch(p.e.levantados[0].descripcion, /📎/);
});

test('1c: si la foto no subió, el ticket no dice «📎»; el turno lo dice y «Reintentar» la vuelve a subir', async (t) => {
  const p = await pantalla(t);
  p.hastaLaTarjeta('No me deja guardar el lead en el CRM, sale un error rojo');
  p.adjuntarYMandar(['foto.jpg']);
  let s = await p.soltar(0, 'mal');
  const turno = p.ultimoMio(s);
  assert.equal(turno.estado, 'error');
  assert.doesNotMatch(s.borrador?.descripcion ?? '', /📎/, 'un «📎» sin archivo detrás');
  s.reintentar(turno.id);
  s = p.r();
  assert.deepEqual(p.e.pendientes[1]?.nombres, ['foto.jpg'], 'el reintento no vuelve a subir la foto');
  s = await p.soltar(1, 'bien');
  await s.mandarTicket();
  assert.deepEqual(p.e.levantados[0].adjuntos, ['foto.jpg']);
});

test('2: en un ticket, «Reintentar» manda lo escrito y SUS archivos, nunca «📎 captura.png» como texto; lo ya subido no se sube otra vez', async (t) => {
  const ticket = { id: 7, titulo: 't', actualizado: new Date().toISOString(), puedeResponder: true, lineas: [], estado: 'tu_respuesta' };
  const p = await pantalla(t, { tickets: [ticket], inicial: 7, movil: false });
  p.r();
  let s = p.adjuntarYMandar(['captura.png']);
  s = await p.soltar(0, 'mal');
  s.reintentar(p.ultimoMio(s).id);
  s = p.r();
  assert.deepEqual(p.e.pendientes[1]?.nombres, ['captura.png'], 'el reintento salió sin la captura');
  await p.soltar(1, 'bien');
  assert.deepEqual(p.e.respuestas, [{ texto: '', adjuntos: ['captura.png'] }]);
  // Subió, pero la respuesta no llegó: el reintento usa lo subido.
  p.e.alContestar.push({ ok: false, error: 'No salió: revisa tu conexión y vuelve a mandarlo.' });
  s = p.adjuntarYMandar(['otra.png'], 'mira esto');
  s = await p.soltar(2, 'bien');
  assert.equal(p.ultimoMio(s).estado, 'error');
  s.reintentar(p.ultimoMio(s).id);
  await vuelta();
  assert.equal(p.e.pendientes.length, 3, 'lo ya subido se subió otra vez (un huérfano más en el bucket)');
  assert.deepEqual(p.e.respuestas.at(-1), { texto: 'mira esto', adjuntos: ['otra.png'] });
  assert.ok(p.e.respuestas.every((x) => !/📎/.test(x.texto)), 'la línea «📎» salió como texto de la persona');
});

test('el tope es POR TICKET en la conversación nueva (el alta no recorta el sexto en silencio)', async (t) => {
  const p = await pantalla(t);
  p.hastaLaTarjeta('No me deja guardar el lead en el CRM, sale un error rojo');
  p.adjuntarYMandar(['1.png', '2.png', '3.png']);
  await p.soltar(0, 'bien');
  p.r().adjuntosCaja.onSumar(['4.png', '5.png', '6.png'].map((n) => new File([new Uint8Array(1)], n, { type: 'image/png' })));
  assert.match(p.r().errorAdjunto ?? '', /Hasta 5 archivos por ticket: ya van 3\./);
  assert.match(leer('app/tickets/acciones.ts'), /if \(deMas\(entrada\.adjuntos\)\) return \{ ok: false/, 'el alta recorta sin decirlo');
});

test('los 3 puntos: MaKo escribe antes de contestar, y su respuesta no cae en OTRA conversación', async (t) => {
  const p = await pantalla(t);
  p.r().setTexto('No me deja guardar el lead en el CRM, sale un error rojo');
  p.r().mandar();
  let s = p.r();
  assert.deepEqual(s.escribiendo, { segs: 0 }, 'sin los 3 puntos');
  const antes = s.items.length;
  t.mock.timers.tick(p.demora);
  s = p.r();
  assert.equal(s.escribiendo, null);
  assert.ok(s.items.length > antes, 'MaKo no contestó');
  p.r().setTexto('Y el calendario tampoco anda');
  p.r().mandar();
  p.r().nuevo();
  t.mock.timers.tick(p.demora);
  s = p.r();
  assert.equal(s.items.length, 1, 'la respuesta de la conversación anterior cayó en la nueva (sólo va el saludo)');
  assert.match(leer('app/tickets/soporte/PiezasSoporte.tsx'), /escribiendo=\{s\.escribiendo\}/, 'el hilo de Soporte no muestra los puntos');
});

test('la nota de voz queda atada a SU conversación: el ticket la espera, y no sale en la conversación siguiente (la revisión de chats-unificados)', async (t) => {
  const p = await pantalla(t);
  p.hastaLaTarjeta('No me deja guardar el lead en el CRM, sale un error rojo');
  // Graba una nota con la tarjeta a la vista: mientras se pasa a texto, el ticket no sale.
  p.r().onGrabada({ audio: new Blob(['x']), segundos: 3 });
  let s = p.r();
  assert.equal(s.notasPendientes, true);
  await s.mandarTicket();
  assert.equal(p.e.levantados.length, 0, 'el ticket salió sin la nota que se estaba pasando a texto');
  // Llega el texto: entra al relato, MaKo contesta, y recién ahí sale el ticket, con lo que dijo.
  p.e.notas.shift()!({ mp3: new Blob(['y']), texto: 'y también pasa en el celular' });
  await vuelta();
  p.r();
  t.mock.timers.tick(p.demora);
  s = p.r();
  s = p.r();
  assert.equal(s.notasPendientes, false);
  await s.mandarTicket();
  assert.match(p.e.levantados[0]?.descripcion ?? '', /celular/, 'el ticket no lleva lo que dijo en la nota');
});

test('una nota grabada en una conversación que se deja (otra conversación) no sale en la nueva', async (t) => {
  const p = await pantalla(t);
  p.decir('No me deja guardar el lead en el CRM, sale un error rojo');
  p.r().onGrabada({ audio: new Blob(['x']), segundos: 3 });
  p.r();
  p.r().nuevo();
  p.e.notas.shift()!({ mp3: new Blob(['y']), texto: 'y también pasa en el celular' });
  await vuelta();
  p.r();
  t.mock.timers.tick(p.demora);
  const s = p.r();
  assert.ok(!s.items.some((x: { texto?: string }) => /celular/.test(x.texto ?? '')), 'la nota de la conversación anterior salió en la nueva');
  assert.equal(s.notasPendientes, false, 'la nota de la otra conversación traba la nueva');
});

test('la persona ve sus archivos en el ticket aunque haya escrito algo (sólo los nombres, nunca un link)', () => {
  const t = paraElCliente(
    { id: 9, titulo: 'x', descripcion: 'No anda', estado: 'en_curso', created_at: '2026-10-28T10:00:00Z', actualizado: '2026-10-28T10:05:00Z' } as never,
    [{ at: '2026-10-28T10:05:00Z', actor: 'cliente', tipo: 'comentario', texto: 'mira esto', datos: { adjuntos: [{ path: '3/tickets/x', nombre: 'captura.png', mime: 'image/png', bytes: 9 }] } }],
  );
  const mia = t.lineas.find((l) => l.quien === 'tu' && l.texto.startsWith('mira esto'));
  assert.equal(mia?.texto, 'mira esto\n📎 captura.png');
  assert.ok(!JSON.stringify(t).includes('3/tickets'), 'el path del bucket llegó al cliente');
});

test('el tope del día por negocio: lo cuenta la ruta en el bucket y lo dice en texto', () => {
  assert.equal(problemaDelDiaTicket([], [{ size: 10 }]), null);
  assert.match(problemaDelDiaTicket(Array.from({ length: TOPE_DIA_ARCHIVOS_TICKET }, () => ({ bytes: 1 })), [{ size: 1 }]) ?? '', /tope es 30 por día/);
  assert.match(problemaDelDiaTicket([{ bytes: 49 * 1024 * 1024 }], [{ size: 2 * 1024 * 1024 }]) ?? '', /más de 50 MB/);
  const ruta = leer('app/api/tickets/adjuntos/route.ts');
  assert.match(ruta, /const delDia = problemaDelDiaTicket\(hoy, archivos\);\n\s+if \(delDia\) return Response\.json\(\{ ok: false, error: delDia \}, \{ status: 429 \}\);/);
  assert.ok(ruta.indexOf('problemaDelDiaTicket(hoy') < ruta.indexOf('bucket.upload('), 'el tope se mira después de subir');
});
