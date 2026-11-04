// =============================================================================
// El grupo de la app en la PANTALLA: el orden en la lista y lo que depende del rol (3/11/2026)
// =============================================================================
// Martín: «tipo grupos de WhatsApp dentro del Ops Center... que esté posicionado arriba». Lo que se fija acá:
//   1. lo que ve cada uno: invitar y sacar quien administra, salir sólo quien entró invitado, lo anterior de WhatsApp nunca un invitado;
//   2. la lista: el grupo es el primer chat, debajo de «Nuevo chat», en las CUATRO listas, y se dibuja de verdad;
//   3. el hilo: lo de otra persona a la izquierda con su nombre (sin esto sale con la foto de quien mira), los avisos con su marca, lo del sistema en píldora;
//   4. el motor: lo nuevo sin recargar, un fallo mantiene lo dibujado, un 404 lo dice, reintentar lleva el MISMO id y el cursor nunca sale de lo que uno escribió;
//   5. nunca una pantalla en blanco ni un error técnico, y los links del push llegan al grupo.
//
// La autorización NO se prueba acá: es del servidor (tests/grupos-ops-puerta.test.ts). Esto es lo que se dibuja, con las piezas reales armadas con esbuild y el React de verdad.
//
// Correr: node --import tsx --test tests/grupos-ops-pantalla.test.ts
// PROBADO ROMPIÉNDOLO: ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GrupoDeLaLista } from '../app/_chat/grupo/pantalla';
import { mensajeWADe } from '../app/m/mako/chat-ui';
import type { MensajeDelHilo } from '../lib/grupo-reglas';
import {
  FRASES_DEL_GRUPO, GRUPOS_VISIBLES, citaDeMensaje, cursorNuevo, edadDelGrupo, filasVisibles, itemsDelGrupo, mezclarMensajes, negritaDeWhatsApp, noLeidosEnFila, previaDelGrupo, quePuede, quienesEstan, urlDelSondeo,
} from '../app/_chat/grupo/pantalla';
import { armarHook, dibujador } from './hook-en-node';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const msg = (id: number, tipo: MensajeDelHilo['autor']['tipo'], nombre: string, propio: boolean, texto: string, extra: Partial<MensajeDelHilo> = {}): MensajeDelHilo => ({
  id, autor: { tipo, nombre, propio }, canal: 'app', texto, adjunto: null, respondeA: null, reaccion: null, avisoTipo: null, creadoEn: new Date(Date.UTC(2026, 10, 3, 12, id % 60)).toISOString(), ...extra,
});
const fila = (ws: number, extra: Partial<GrupoDeLaLista> = {}): GrupoDeLaLista => ({ ws, administra: true, invitado: false, titulo: `MaKo <> Negocio ${ws}`, ultimo: null, noLeidos: 0, hastaId: 0, ...extra });

// ── 1. Lo que ve cada uno ─────────────────────────────────────────────────────────────────────────────────────

test('1. lo que depende del rol: quien administra invita y saca; sólo un invitado sale; un invitado no ve lo de antes', () => {
  assert.deepEqual(quePuede({ administra: true, invitado: false }), { invitar: true, sacar: true, salir: false, verWhatsApp: true }, 'quien administra');
  assert.deepEqual(quePuede({ administra: false, invitado: true }), { invitar: false, sacar: false, salir: true, verWhatsApp: false }, 'un invitado de otro negocio');
  // El grupo de la plataforma: el super admin no administra (no se invita a nadie) y tampoco entró invitado.
  assert.deepEqual(quePuede({ administra: false, invitado: false }), { invitar: false, sacar: false, salir: false, verWhatsApp: true }, 'el grupo de la plataforma');
  assert.deepEqual(quePuede(null), { invitar: false, sacar: false, salir: false, verWhatsApp: false }, 'sin saber quién es, lo mínimo');
});

test('2. la fila dice quién y qué, sin marcas ni «Espera tu respuesta»', () => {
  assert.equal(previaDelGrupo({ invitado: false, ultimo: msg(1, 'persona', 'Joan', false, 'Hola  a\ntodos') }), 'Joan: Hola a todos');
  assert.equal(previaDelGrupo({ invitado: false, ultimo: msg(1, 'persona', 'Ana', true, 'Mío') }), 'Tú: Mío');
  assert.equal(previaDelGrupo({ invitado: false, ultimo: msg(1, 'mako', 'MaKo', false, '*Ventas*\nNueva venta') }), 'MaKo: Ventas Nueva venta');
  assert.equal(previaDelGrupo({ invitado: false, ultimo: msg(1, 'sistema', '', false, 'Joan entró al grupo.') }), 'Joan entró al grupo.');
  const nota = msg(1, 'persona', 'Joan', false, '', { adjunto: { tipo: 'audio', nombre: null, mime: null, bytes: null, secs: 3, listo: true } });
  assert.equal(previaDelGrupo({ invitado: false, ultimo: nota }), 'Joan: Nota de voz');
  assert.equal(previaDelGrupo({ invitado: true, ultimo: null }), 'Te invitaron a este grupo', 'quien entra por primera vez, con el grupo sin nada');
  assert.equal(previaDelGrupo({ invitado: false, ultimo: null }), 'Aquí caen los avisos de MaKo');
  assert.equal(noLeidosEnFila(0), null, 'cero no se dibuja');
  assert.equal(noLeidosEnFila(3), '3');
  assert.equal(noLeidosEnFila(250), '99+');
  assert.equal(edadDelGrupo({ ultimo: null }, Date.now()), '');
});

// ── 2. El orden en la lista ───────────────────────────────────────────────────────────────────────────────────

test('3. con muchos grupos se ven los primeros, en el orden del servidor, y el abierto no se esconde', () => {
  const g = [1, 2, 3, 4, 5].map((ws) => ({ ws }));
  assert.equal(GRUPOS_VISIBLES, 3);
  assert.deepEqual(filasVisibles(g, { todos: false, abierto: null }), { visibles: [{ ws: 1 }, { ws: 2 }, { ws: 3 }], resto: 2 });
  assert.deepEqual(filasVisibles(g, { todos: false, abierto: 5 }).visibles.map((x) => x.ws), [1, 2, 3, 5]);
  assert.deepEqual(filasVisibles(g, { todos: true, abierto: null }), { visibles: g, resto: 0 });
  assert.deepEqual(filasVisibles(g.slice(0, 3), { todos: false, abierto: null }).resto, 0, 'tres no piden «Ver más»');
});

test('4. el grupo es el primer chat, debajo de «Nuevo chat», en las cuatro listas', () => {
  const entre = (src: string, ...partes: string[]) => {
    let desde = 0;
    for (const p of partes) {
      const i = src.indexOf(p, desde);
      assert.ok(i >= 0, `falta, o está fuera de orden: ${p}`);
      desde = i + p.length;
    }
  };
  const sb = sinComentarios(leer('app/second-brain/ChatSecondBrain.tsx'));
  // Las dos ramas de la computadora: el super admin en lo suyo y el cliente (también el super admin mirando a un cliente).
  entre(sb.slice(sb.indexOf('{!listaSB && centro && (')), '<NuevoChatCentro onNuevo={abrirNuevoCentro}', '<FilasDelGrupo g={grupos}', '{coaches}', '<ListaCentro');
  entre(sb.slice(sb.indexOf('{listaSB && (<>')), "<NuevoChatCentro onNuevo={() => elegir({ virtual: 'nuevo' })}", '<FilasDelGrupo g={grupos}', '{k.errorLista', '{k.sesiones != null && (', '{fila(cerebroFila)}');
  // Afuera de `k.sesiones != null`: no espera a la lista de chats ni cae con su error.
  const rama = sb.slice(sb.indexOf('{listaSB && (<>'));
  assert.ok(rama.indexOf('<FilasDelGrupo') < rama.indexOf('k.sesiones != null'), 'el grupo no espera a la lista');
  entre(sinComentarios(leer('app/m/second-brain/ChatClienteM.tsx')), 'titulo="Nuevo chat"', '<FilasDelGrupoM g={grupos}', '{cerebro && fila(cerebro)}');
  const ops = sinComentarios(leer('app/m/operaciones/ChatsMovil.tsx'));
  const lista = ops.slice(ops.indexOf('{conLista && ('));
  entre(lista, '{!parte && <FilaM leading={<CirculoNuevo size={40} />} titulo="Nuevo chat"', '{!parte && <FilasDelGrupoM g={grupos}', 'gurusConCharla.map', 'filas.map');
  // En dos partes, esta lista va debajo de la del cliente, que ya lo dibuja: saldría doble.
  assert.match(ops, /const grupos = useGrupos\(!parte\);/, 'en dos partes no se pide');
  assert.match(lista, /\{!parte && <FilasDelGrupoM/);
});

// ── La pantalla de verdad ─────────────────────────────────────────────────────────────────────────────────────

type Dibujo = { html: (nodo: unknown) => string; m: Record<string, (p: Record<string, unknown>) => unknown>; react: { createElement: (...a: unknown[]) => unknown } };

/** Las piezas REALES con su React: lo de Next y lo del servidor, de mentira. El CSS, vacío. `useGrupos` da lo que pide cada caso (`globalThis.__grupos`). */
async function armarPiezas(): Promise<Dibujo> {
  const { build } = createRequire(join(RAIZ, 'package.json'))('esbuild') as typeof import('esbuild');
  const conExt = (b: string) => ['.ts', '.tsx', '/index.ts', '/index.tsx'].map((x) => b + x).find((x) => existsSync(x)) ?? (existsSync(b) ? b : null);
  const stubs: Record<string, string> = {
    'server-only': '', 'client-only': '',
    'next/navigation': `export const usePathname = () => '/second-brain'; export const useSearchParams = () => new URLSearchParams(globalThis.__url ?? ''); const R = { push() {}, replace() {}, refresh() {}, back() {}, prefetch() {} }; export const useRouter = () => R; export const redirect = () => {}; export const notFound = () => {}; export const useParams = () => ({});`,
    'next/link': `import { createElement } from 'react'; export default function L({ href, prefetch, replace, scroll, ...r }) { return createElement('a', { href: typeof href === 'string' ? href : '#', ...r }); }`,
    'next/image': `import { createElement } from 'react'; export default function I({ fill, priority, ...p }) { return createElement('img', p); }`,
    'next/dynamic': `export default function dynamic() { return () => null; }`,
    'next/server': `export const after = (f) => f(); export const NextResponse = {};`,
    'next/headers': `export const cookies = async () => ({ get() {} }); export const headers = async () => ({ get() {} });`,
  };
  const entrada = `
    export { renderToStaticMarkup as html } from 'react-dom/server';
    export * as react from 'react';
    export { ChatClienteM } from '@/app/m/second-brain/ChatClienteM';
    export { ChatSecondBrain } from '@/app/second-brain/ChatSecondBrain';
    export { FilasDelGrupo } from '@/app/_chat/grupo/FilasDelGrupo';
    export { VistaParticipantes } from '@/app/_chat/grupo/Participantes';
    export { HiloDelGrupo } from '@/app/_chat/grupo/HiloDelGrupo';
    export { CajaDelGrupo } from '@/app/_chat/grupo/CajaDelGrupo';
    export { ChatDelGrupo } from '@/app/second-brain/ChatDelGrupo';
  `;
  const r = await build({
    stdin: { contents: entrada, resolveDir: RAIZ, loader: 'ts' }, bundle: true, write: false, format: 'cjs', platform: 'node', logLevel: 'silent', jsx: 'automatic',
    loader: { '.css': 'empty', '.png': 'empty', '.svg': 'empty', '.woff2': 'empty', '.jpg': 'empty' }, external: ['react', 'react-dom', 'react-dom/server', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
    plugins: [{ name: 'piezas', setup(b) {
      for (const spec of Object.keys(stubs)) b.onResolve({ filter: new RegExp(`^${spec.replace(/[/.]/g, '\\$&')}$`) }, () => ({ path: spec, namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, (a) => ({ contents: stubs[a.path], loader: 'js', resolveDir: RAIZ }));
      // Lo que devuelve la lista lo pone cada caso: el motor, sin pedidos, no llegaría a dibujarla.
      b.onResolve({ filter: /grupo\/useGrupos$/ }, () => ({ path: 'useGrupos', namespace: 'grupos' }));
      b.onLoad({ filter: /.*/, namespace: 'grupos' }, () => ({ contents: `export const useGrupos = () => globalThis.__grupos;`, loader: 'js' }));
      b.onResolve({ filter: /^@\// }, (a) => { const p = conExt(join(RAIZ, a.path.slice(2))); return p ? { path: p } : null; });
      b.onLoad({ filter: /\.(ts|tsx)$/ }, (a) => {
        const src = readFileSync(a.path, 'utf8');
        if (!/^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*['"]use server['"]/.test(src)) return null;
        const nombres = [...src.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+([A-Za-z0-9_]+)/g)].map((m) => m[1]);
        return { contents: nombres.map((n) => `export const ${n} = async () => ({ ok: false });`).join('\n'), loader: 'js' };
      });
    } }],
  });
  const mod: { exports: Record<string, unknown> } = { exports: {} };
  const requerir = createRequire(join(RAIZ, 'package.json'));
  new Function('module', 'exports', 'require', '__dirname', '__filename', r.outputFiles[0].text)(mod, mod.exports, requerir, RAIZ, join(RAIZ, 'x.js'));
  const m = mod.exports as Record<string, (p: Record<string, unknown>) => unknown>;
  return { html: m.html as unknown as (n: unknown) => string, m, react: m.react as unknown as Dibujo['react'] };
}
let piezas: Promise<Dibujo> | null = null;
const dibujo = () => (piezas ??= armarPiezas());
const conGrupos = (grupos: readonly GrupoDeLaLista[] | null, cargando = false) => {
  (globalThis as unknown as { __grupos: unknown }).__grupos = { grupos, cargando, ahora: Date.UTC(2026, 10, 3, 13), recargar() {}, anotarLeido() {} };
};
const enOrden = (html: string, ...partes: string[]) => {
  let desde = 0;
  for (const p of partes) {
    const i = html.indexOf(p, desde);
    assert.ok(i >= 0, `no se dibujó, o está fuera de orden: ${p}`);
    desde = i + p.length;
  }
};

test('5. dibujado de verdad, en el teléfono y en la computadora: «Nuevo chat», el grupo y después el resto', async () => {
  const { html, m, react } = await dibujo();
  conGrupos([fila(7, { titulo: 'MaKo &lt;&gt; Inmobiliaria', ultimo: msg(9, 'persona', 'Joan', false, 'Yo entro'), noLeidos: 3 })]);
  const tel = html(react.createElement(m.ChatClienteM, { sesionesIniciales: [{ id: 1, titulo: 'Plan de la semana', pinned: false, updatedAt: '2026-11-03T10:00:00Z' }], opcionArmar: '' }));
  enOrden(tel, 'Nuevo chat', 'Inmobiliaria', 'Joan: Yo entro', 'aria-label="3 sin leer"', 'Ops Center');
  const pc = html(react.createElement(m.ChatSecondBrain, { veMapa: true, mapa: null, chatInicial: null, opcionArmar: '', centro: null, centroInicial: null, inicio: 'second-brain' }));
  enOrden(pc, 'Nuevo chat', 'Inmobiliaria', 'Joan: Yo entro', 'aria-label="3 sin leer"');
  // Un closer sin invitar no recibe ninguno: no hay fila, y el resto sigue.
  conGrupos([]);
  const sinGrupo = html(react.createElement(m.ChatClienteM, { sesionesIniciales: [], opcionArmar: '' }));
  assert.ok(!sinGrupo.includes('sin leer') && sinGrupo.includes('Nuevo chat') && !sinGrupo.includes('Inmobiliaria'), 'sin grupo, no hay fila');
});

test('6. un invitado de otro negocio también lo tiene primero, con el título de invitado', async () => {
  const { html, m, react } = await dibujo();
  conGrupos([fila(7, { titulo: 'Invitación de Inmobiliaria', administra: false, invitado: true })]);
  const tel = html(react.createElement(m.ChatClienteM, { sesionesIniciales: [], opcionArmar: '' }));
  enOrden(tel, 'Nuevo chat', 'Invitación de Inmobiliaria', 'Te invitaron a este grupo', 'Ops Center');
  const pc = html(react.createElement(m.FilasDelGrupo, { g: (globalThis as unknown as { __grupos: unknown }).__grupos, abierto: null, onElegir() {} }));
  enOrden(pc, 'Invitación de Inmobiliaria', 'Te invitaron a este grupo');
});

test('7. mientras llega hay un lugar; sin poder leerla, nada; y con muchos grupos, «Ver N grupos más»', async () => {
  const { html, m, react } = await dibujo();
  const pc = (g: unknown) => html(react.createElement(m.FilasDelGrupo, { g, abierto: null, onElegir() {} }));
  assert.match(pc({ grupos: null, cargando: true, ahora: 0 }), /gr-esqueleto/, 'la lista no salta');
  assert.equal(pc({ grupos: null, cargando: false, ahora: 0 }), '', 'sin poder leerla, no inventa una fila');
  const cinco = pc({ grupos: [1, 2, 3, 4, 5].map((ws) => fila(ws)), cargando: false, ahora: 0 });
  assert.equal((cinco.match(/co-fila-wrap/g) ?? []).length, 3);
  assert.match(cinco, /Ver 2 grupos más/);
});

const VISTA = { email: '', onEmail() {}, onInvitar() {}, invitando: false, aviso: null, error: null, onSacar() {}, sacando: null, onSalir() {}, confirmaSalir: false, onConfirmaSalir() {}, saliendo: false };
const FRASE = 'Ve lo que cae en este grupo.';

test('8. los participantes: quien administra invita y saca; un invitado sólo sale, y no le llega ningún email', async () => {
  const { html, m, react } = await dibujo();
  const admin = html(react.createElement(m.VistaParticipantes, { ...VISTA, datos: {
    administra: true, invitado: false, frase: FRASE, topeInvitados: 30, sugeridos: [{ nombre: 'Carla', email: 'carla@x.com' }],
    participantes: [
      { nombre: 'Ana', tipo: 'admin', propio: true, email: 'ana@x.com', porQue: 'Administra el negocio' },
      { nombre: 'joan@y.com', tipo: 'invitado', propio: false, email: 'joan@y.com' },
    ],
  } }));
  assert.match(admin, /id="gr-invitar-email"/, 'invitar por email');
  assert.ok(admin.includes(FRASE), 'lo que ve quien invita');
  assert.match(admin, /Sumar a Carla/, 'closer y setter, con un toque');
  assert.equal((admin.match(/>Sacar</g) ?? []).length, 1, 'sólo se saca a quien entró invitado: quien entra por su rol no tiene fila');
  assert.doesNotMatch(admin, /Salir del grupo/, 'quien entra por su rol no tiene de dónde salir');
  const invitado = html(react.createElement(m.VistaParticipantes, { ...VISTA, datos: {
    administra: false, invitado: true, frase: FRASE, topeInvitados: 30, sugeridos: [],
    participantes: [
      { nombre: 'Ana', tipo: 'admin', propio: false, porQue: 'Administra el negocio' },
      { nombre: 'Invitado', tipo: 'invitado', propio: true },
    ],
  } }));
  assert.doesNotMatch(invitado, /gr-invitar-email|Sacar|Sumar a/, 'un invitado no invita ni saca');
  assert.match(invitado, /Salir del grupo/);
  assert.doesNotMatch(invitado, /@/, 'ningún email');
  assert.equal((invitado.match(/>Invitado</g) ?? []).length, 1, 'el rótulo no repite lo que ya dice el nombre');
});

const K = (extra: Record<string, unknown> = {}) => ({
  ws: 7, estado: 'listo', mensajes: [], pendientes: [], hayAntes: false, trayendo: false, pensando: false, ahora: Date.UTC(2026, 10, 3, 13), cita: null, setCita() {},
  deWhatsApp: { mensajes: [], hayMas: true, pidiendo: false, nada: false }, enviar() {}, enviarNota() {}, reintentar() {}, descartar() {}, verAnteriores() {}, verDeWhatsApp() {}, sondear() {}, recargar() {}, marcarLeido() {}, ...extra,
});
const ADMIN = { invitado: false, administra: true };
const INVITADO = { invitado: true, administra: false };
const HILO_BASE = { rol: ADMIN, desdeLeido: null, nuevos: 0, onBajar() {} };

test('9. el hilo: lo de otra persona a la izquierda con su nombre, lo propio a la derecha, los avisos con su marca', async () => {
  const { html, m, react } = await dibujo();
  const mensajes = [
    msg(1, 'mako', 'MaKo', false, '*Ventas*\nNueva *venta* hoy', { avisoTipo: 'venta-nueva' }),
    msg(2, 'mako', 'MaKo', false, 'Te contesto'),
    msg(3, 'persona', 'Joan', false, 'Hola', { canal: 'whatsapp' }),
    msg(4, 'persona', 'Joan', false, 'Sigo yo'),
    msg(5, 'persona', 'Ana', true, 'Mío', { reaccion: '👍' }),
    msg(6, 'sistema', '', false, 'Joan entró al grupo.'),
    msg(7, 'equipo', 'Equipo de MaKo', false, 'Quedó arreglado'),
  ];
  const h = html(react.createElement(m.HiloDelGrupo, { ...HILO_BASE, k: K({ mensajes }) }));
  assert.equal((h.match(/co-aviso-grupo/g) ?? []).length, 1, 'un solo aviso: lo que contesta MaKo no lleva la marca');
  assert.match(h, /<strong[^>]*>(?:<[^>]+>)*venta/, 'el *negrita* de WhatsApp, en negrita');
  assert.doesNotMatch(h, /\*Ventas|\*venta/, 'sin los asteriscos');
  assert.match(h, /co-otro[^>]*>[\s\S]*Joan[\s\S]*WhatsApp[\s\S]*Hola/, 'el nombre adentro, y de dónde vino');
  assert.equal((h.match(/class="co-otro[ "]/g) ?? []).length, 2, 'los dos de Joan a la izquierda');
  assert.equal((h.match(/class="co-otro co-otro--sigue/g) ?? []).length, 1, 'el segundo seguido, sin repetir la inicial');
  assert.equal((h.match(/class="co-yo/g) ?? []).length, 1, 'sólo lo propio a la derecha');
  assert.match(h, /aria-label="MaKo reaccionó 👍"/, 'la reacción de MaKo');
  assert.match(h, /co-dia--sistema[^>]*>Joan entró al grupo\./, 'lo del sistema, una píldora');
  assert.match(h, />Equipo de MaKo</, 'el equipo se nombra: no es MaKo');
  // La caja, sin `ocupado`: dos personas tienen que poder escribir mientras MaKo piensa.
  assert.doesNotMatch(sinComentarios(leer('app/_chat/grupo/CajaDelGrupo.tsx')), /\bocupado=|\benviando=/);
});

test('10. lo anterior de WhatsApp: a quien administra sí, a un invitado no', async () => {
  const { html, m, react } = await dibujo();
  const mensajes = [msg(5, 'persona', 'Joan', false, 'Hola')];
  assert.match(html(react.createElement(m.HiloDelGrupo, { ...HILO_BASE, k: K({ mensajes }) })), /Ver lo anterior de WhatsApp/);
  const inv = html(react.createElement(m.HiloDelGrupo, { ...HILO_BASE, rol: INVITADO, k: K({ mensajes }) }));
  assert.doesNotMatch(inv, /WhatsApp/, 'un invitado ve desde que entró');
  assert.ok(inv.includes(FRASES_DEL_GRUPO.invitadoDesde), 'y se lo dice');
  // Sin su fila todavía (un link, la lista que no llegó): no se le ofrece lo que podría darle 404.
  assert.doesNotMatch(html(react.createElement(m.HiloDelGrupo, { ...HILO_BASE, rol: null, k: K({ mensajes }) })), /WhatsApp/);
  assert.ok(html(react.createElement(m.HiloDelGrupo, { ...HILO_BASE, rol: INVITADO, invitacion: true, k: K({ mensajes }) })).includes(FRASES_DEL_GRUPO.invitacion), 'si no es su negocio, puede salir');
});

test('11. nunca una pantalla en blanco ni un error técnico', async () => {
  const { html, m, react } = await dibujo();
  const dib = (extra: Record<string, unknown>) => html(react.createElement(m.HiloDelGrupo, { ...HILO_BASE, k: K(extra) }));
  const vacio = dib({});
  assert.ok(vacio.includes(FRASES_DEL_GRUPO.vacio) && vacio.includes(FRASES_DEL_GRUPO.vacioDetalle));
  const error = dib({ estado: 'error' });
  assert.ok(error.includes(FRASES_DEL_GRUPO.noAbre) && error.includes('Reintentar'));
  const fuera = html(react.createElement(m.HiloDelGrupo, { ...HILO_BASE, onVolver() {}, k: K({ estado: 'fuera' }) }));
  assert.ok(fuera.includes(FRASES_DEL_GRUPO.fuera) && fuera.includes('Volver a los chats'), 'con su salida');
  assert.ok(dib({ estado: 'cargando' }).length > 0, 'cargando, no vacío');
  // Un error con algo ya dibujado no lo borra: se sigue viendo.
  assert.match(dib({ estado: 'error', mensajes: [msg(1, 'persona', 'Joan', false, 'Hola')] }), /Hola/);
  for (const f of Object.values(FRASES_DEL_GRUPO)) assert.doesNotMatch(f, /503|404|fetch|tabla|base de datos|supabase/i, f);
});

// ── 3. Lo que se le pasa al hilo ──────────────────────────────────────────────────────────────────────────────

test('12. los mensajes como filas del hilo único: de quién es cada uno', () => {
  const items = itemsDelGrupo({
    ws: 7, desdeLeido: 2,
    mensajes: [
      msg(1, 'persona', 'Ana', true, 'Mío viejo'),
      msg(2, 'persona', 'Joan', false, 'De Joan viejo'),
      msg(3, 'persona', 'Ana', true, 'Mío nuevo'),
      msg(4, 'persona', 'Joan', false, 'Primero sin leer', { respondeA: 3, reaccion: '👍' }),
      msg(5, 'persona', 'Joan', false, 'Otro sin leer'),
      msg(6, 'mako', 'MaKo', false, '*Aviso*', { avisoTipo: 'x' }),
      msg(7, 'sistema', '', false, 'Joan salió.'),
      msg(8, 'persona', 'Mau', false, '', { adjunto: { tipo: 'imagen', nombre: 'a.png', mime: 'image/png', bytes: 1, secs: null, listo: true }, canal: 'whatsapp' }),
      msg(9, 'mako', 'MaKo', false, '', { adjunto: { tipo: 'pdf', nombre: 'b.pdf', mime: null, bytes: 1, secs: null, listo: false } }),
      msg(10, 'persona', 'Mau', false, '', { adjunto: { tipo: 'audio', nombre: null, mime: null, bytes: 1, secs: 9, listo: true } }),
      msg(11, 'persona', 'Mau', false, '', { adjunto: { tipo: 'audio', nombre: null, mime: null, bytes: 1, secs: null, listo: false } }),
      msg(12, 'persona', 'Joan', false, 'Citando', { respondeA: 999 }),
    ],
  });
  const de = (id: string) => items.find((x) => x.id === id) as Extract<(typeof items)[number], { k: 'msg' }>;
  assert.equal(de('g1').role, 'user');
  assert.equal(de('g1').grupo?.autor, null, 'lo propio no lleva autor: va a la derecha');
  assert.equal(de('g2').grupo?.autor, 'Joan', 'lo de otra persona es de ella');
  assert.deepEqual([mensajeWADe(de('g2'), 'MaKo').de, mensajeWADe(de('g2'), 'MaKo').propio], ['Joan', false], 'el menú y la cita, también');
  assert.deepEqual([mensajeWADe(de('g1'), 'MaKo').de, mensajeWADe(de('g1'), 'MaKo').propio], ['Tú', true]);
  assert.equal(de('g4').grupo?.sinLeer, true, 'el primero sin leer');
  assert.equal(de('g3').grupo?.sinLeer, false, 'lo propio nunca es «sin leer»');
  assert.equal(de('g5').grupo?.sinLeer, false, 'una sola marca');
  assert.equal(de('g5').grupo?.sigue, true, 'seguido del mismo');
  assert.deepEqual(de('g4').grupo?.cita && { de: de('g4').grupo!.cita!.de, texto: de('g4').grupo!.cita!.texto }, { de: 'Tú', texto: 'Mío nuevo' }, 'la cita viene como dato');
  assert.equal(de('g4').grupo?.reaccion, '👍');
  assert.equal(de('g6').role, 'assistant', 'lo de MaKo, con la criatura');
  assert.equal(de('g6').grupo?.aviso, true);
  assert.equal(de('g6').texto, '**Aviso**');
  const sistema = items.find((x) => x.id === 's7');
  assert.ok(sistema && sistema.k === 'aviso' && sistema.tono === 'sistema', 'lo del sistema no lo dijo nadie');
  assert.equal(de('g8').archivos?.[0].local, '/api/grupos/7/adjunto/8', 'se pide por el grupo: un invitado recibiría 404 por la ruta de su negocio');
  assert.equal(de('g8').grupo?.chip, 'WhatsApp');
  assert.equal(de('g9').archivos?.[0].nota, 'Subiendo…', 'sin archivo todavía, lo dice');
  assert.equal(de('g10').voz?.url, '/api/grupos/7/adjunto/10');
  assert.equal(de('g11').voz, undefined, 'una nota sin archivo no se puede escuchar');
  assert.equal(de('g11').texto, 'Nota de voz', 'y no es un globo vacío');
  assert.equal(de('g12').grupo?.cita?.id, null, 'el citado no está dibujado: no lleva a ningún lado');
  // Nunca lo abrió: «Sin leer» arriba de todo no dice nada, y abre en lo último.
  const nuevo = itemsDelGrupo({ ws: 7, desdeLeido: 0, mensajes: [msg(1, 'mako', 'MaKo', false, 'Hola')] });
  assert.equal((nuevo[0] as Extract<(typeof nuevo)[number], { k: 'msg' }>).grupo?.sinLeer, false);
});

test('13. lo de antes de WhatsApp no tiene autor ni se puede confundir con lo propio', () => {
  const items = itemsDelGrupo({ ws: 7, mensajes: [], deWhatsApp: [{ rol: 'user', texto: 'Viejo', creadoEn: '2026-10-01T10:00:00Z' }, { rol: 'assistant', texto: '*Vieja*', creadoEn: '2026-10-01T10:01:00Z' }] });
  const [a, b] = items as Array<Extract<(typeof items)[number], { k: 'msg' }>>;
  assert.equal(a.grupo?.autor, 'En WhatsApp', 'si no, saldría a la derecha, con la foto de quien mira');
  assert.equal(b.grupo?.chip, 'En WhatsApp');
  assert.equal(b.texto, '**Vieja**');
});

test('14. la negrita de WhatsApp, la mezcla y el cursor', () => {
  assert.equal(negritaDeWhatsApp('*Hola* mundo'), '**Hola** mundo');
  assert.equal(negritaDeWhatsApp('Pagó *$1.500*.'), 'Pagó **$1.500**.');
  assert.equal(negritaDeWhatsApp('* uno\n* dos'), '* uno\n* dos', 'una lista no');
  assert.equal(negritaDeWhatsApp('2*3*4'), '2*3*4', 'una cuenta no');
  assert.equal(negritaDeWhatsApp('**ya**'), '**ya**', 'lo que ya es Markdown no');
  const a = msg(1, 'persona', 'J', false, 'a');
  const c = msg(3, 'persona', 'J', false, 'c');
  assert.deepEqual(mezclarMensajes([c, a], [msg(2, 'persona', 'J', false, 'b')]).map((m) => m.id), [1, 2, 3], 'en orden: una fila ajena puede entrar con un id menor');
  assert.equal(mezclarMensajes([a], [{ ...a, reaccion: '👍' }])[0].reaccion, '👍', 'lo que vuelve reemplaza');
  assert.equal(urlDelSondeo(7, 100), '/api/grupos/7/mensajes?despues=70', 'con solape');
  assert.equal(urlDelSondeo(7, 5), '/api/grupos/7/mensajes?despues=0');
  assert.equal(cursorNuevo(100, 70), 100, 'una vuelta sin nada no lo baja');
  assert.equal(cursorNuevo(100, 130), 130);
  assert.deepEqual(citaDeMensaje(msg(4, 'persona', 'Ana', true, '')).de, 'Tú');
});

// ── 4. El motor ───────────────────────────────────────────────────────────────────────────────────────────────

/**
 * El React de mentira de tests/hook-en-node.ts, con `useCallback` de verdad: el motor cuelga sus efectos de funciones memorizadas, y sin esto cada dibujo volvería a cargar el hilo.
 */
const REACT_CON_MEMO = `
  const rt = () => globalThis.__hookEnNode;
  export function useState(init) { const r = rt(); const i = r.idx++; if (!(i in r.hooks)) r.hooks[i] = typeof init === 'function' ? init() : init;
    return [r.hooks[i], (v) => { r.hooks[i] = typeof v === 'function' ? v(r.hooks[i]) : v; }]; }
  export function useRef(init) { const r = rt(); const i = r.idx++; if (!(i in r.hooks)) r.hooks[i] = { current: init }; return r.hooks[i]; }
  export function useCallback(fn, deps) { const r = rt(); const i = r.idx++; const a = r.hooks[i]; if (a && deps.every((d, k) => Object.is(d, a.dd[k]))) return a.fn; r.hooks[i] = { dd: deps, fn }; return fn; }
  export const useMemo = (fn) => fn();
  export function useEffect(fn, deps) { const r = rt(); const i = r.idx++; const antes = r.hooks[i];
    if (!antes || !deps || deps.some((d, k) => !Object.is(d, antes.deps[k]))) { r.hooks[i] = { deps, limpiar: antes?.limpiar }; r.efectos.push(() => { antes?.limpiar?.(); r.hooks[i] = { deps, limpiar: fn() }; }); } }
`;

type Respuesta = { status?: number; json: unknown } | Error;
type Motor = {
  estado: string; mensajes: MensajeDelHilo[]; pendientes: Array<{ id: string; estado: string; clienteId: string; error?: string }>; pensando: boolean;
  enviar: (t: string, a?: File[]) => void; reintentar: (id: string) => void; sondear: () => Promise<void>; marcarLeido: () => void; recargar: () => Promise<void>;
};

async function motor(responder: (url: string, init?: RequestInit) => Respuesta, visible = true) {
  const g = globalThis as unknown as Record<string, unknown>;
  const pedidos: Array<{ url: string; init?: RequestInit }> = [];
  const intervalos: Array<() => void> = [];
  const antes = { window: g.window, document: g.document, fetch: g.fetch };
  g.window = { setInterval: (f: () => void) => { intervalos.push(f); return intervalos.length; }, clearInterval() {}, setTimeout: () => 0, clearTimeout() {} };
  g.document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} };
  g.fetch = async (url: string, init?: RequestInit) => {
    pedidos.push({ url, init });
    const r = responder(url, init);
    if (r instanceof Error) throw r;
    return new Response(JSON.stringify(r.json), { status: r.status ?? 200 });
  };
  const mod = await armarHook(RAIZ, 'app/_chat/grupo/useHiloDelGrupo.ts', { react: REACT_CON_MEMO, '@/app/second-brain/nota-de-voz': 'export const notaEnMp3 = async (b) => b;' });
  const d = dibujador(mod.useHiloDelGrupo as (p: unknown) => Motor);
  const props = { ws: 7, visible, onLeido: () => {} };
  const dibujar = () => d.dibujar(props);
  const asentar = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r)); return dibujar(); };
  return { dibujar, asentar, pedidos, intervalos, cerrar: () => { d.desmontar(); g.window = antes.window; g.document = antes.document; g.fetch = antes.fetch; } };
}

test('15. lo nuevo sin recargar: pide con solape, mezcla, y un fallo no borra lo dibujado', async () => {
  let responde: Respuesta = { json: { ok: true, mensajes: [msg(100, 'persona', 'Joan', false, 'Primero')], hayMas: false, cursor: 100, makoPensando: false } };
  const m = await motor(() => responde);
  try {
    m.dibujar();
    let k = await m.asentar();
    assert.equal(k.estado, 'listo');
    assert.equal(m.pedidos[0].url, '/api/grupos/7/mensajes', 'el ws es el del grupo, en la URL');
    responde = { json: { ok: true, mensajes: [msg(120, 'mako', 'MaKo', false, 'Llegó solo')], hayMas: false, cursor: 120, makoPensando: true } };
    await k.sondear();
    k = await m.asentar();
    assert.ok(m.pedidos.some((p) => p.url === '/api/grupos/7/mensajes?despues=70'), 'con solape');
    assert.deepEqual(k.mensajes.map((x) => x.id), [100, 120], 'sin recargar');
    assert.equal(k.pensando, true);
    assert.ok(m.intervalos.length > 0, 'se lee solo');
    // Un fallo (el 503 de cada deploy) mantiene lo dibujado.
    responde = { status: 503, json: { ok: false, error: 'No pude leer el grupo.' } };
    await k.sondear();
    k = await m.asentar();
    assert.equal(k.estado, 'listo');
    assert.equal(k.mensajes.length, 2);
    responde = new Error('sin red');
    await k.sondear();
    k = await m.asentar();
    assert.equal(k.mensajes.length, 2, 'sin red, tampoco');
    // Lo sacaron del grupo: lo dice.
    responde = { status: 404, json: { ok: false, error: 'No existe.' } };
    await k.sondear();
    k = await m.asentar();
    assert.equal(k.estado, 'fuera');
  } finally { m.cerrar(); }
});

test('16. mandar no espera a MaKo; reintentar lleva el MISMO id; el cursor no sale de lo que uno escribió', async () => {
  let postOk = false;
  const m = await motor((url, init) => {
    if (init?.method === 'POST') return postOk ? { json: { ok: true, mensaje: msg(500, 'persona', 'Ana', true, 'Hola') } } : { status: 502, json: { ok: false } };
    return { json: { ok: true, mensajes: [msg(100, 'persona', 'Joan', false, 'Primero')], hayMas: false, cursor: 100, makoPensando: false } };
  });
  try {
    m.dibujar();
    let k = await m.asentar();
    k.enviar('Hola');
    k = m.dibujar();
    assert.equal(k.pendientes.length, 1, 'se ve en el acto');
    assert.equal(k.pendientes[0].estado, 'enviando');
    k = await m.asentar();
    assert.equal(k.pendientes[0].estado, 'error', 'no se pierde');
    assert.doesNotMatch(k.pendientes[0].error ?? '', /502|gateway/i, 'sin error técnico');
    const posts = () => m.pedidos.filter((p) => p.init?.method === 'POST').map((p) => JSON.parse(String(p.init?.body)) as { clienteId: string });
    postOk = true;
    k.reintentar(k.pendientes[0].id);
    k = await m.asentar();
    assert.equal(k.pendientes.length, 0, 'salió');
    assert.deepEqual(k.mensajes.map((x) => x.id), [100, 500]);
    assert.equal(posts().length, 2);
    assert.equal(posts()[0].clienteId, posts()[1].clienteId, 'el servidor reconoce el reintento: no duplica ni vuelve a llamar a MaKo');
    await k.sondear();
    assert.ok(m.pedidos.some((p) => p.url === '/api/grupos/7/mensajes?despues=70'), 'el cursor sigue en lo que devolvió el GET: uno de otro con id menor no se saltea');
  } finally { m.cerrar(); }
});

test('15b. montado y escondido (se fue a otro chat) carga una vez y no sondea', async () => {
  const m = await motor(() => ({ json: { ok: true, mensajes: [msg(100, 'persona', 'Joan', false, 'Hola')], hayMas: false, cursor: 100, makoPensando: false } }), false);
  try {
    m.dibujar();
    const k = await m.asentar();
    assert.equal(k.mensajes.length, 1);
    assert.equal(m.intervalos.length, 0);
    assert.equal(m.pedidos.length, 1);
  } finally { m.cerrar(); }
});

test('17. leído: hasta lo dibujado, una vez, y sólo con la pestaña al frente', async () => {
  const m = await motor(() => ({ json: { ok: true, mensajes: [msg(100, 'persona', 'Joan', false, 'Hola')], hayMas: false, cursor: 100, makoPensando: false } }));
  try {
    m.dibujar();
    const k = await m.asentar();
    const leidos = () => m.pedidos.filter((p) => p.url.endsWith('/leido'));
    (globalThis as unknown as { document: { visibilityState: string } }).document.visibilityState = 'hidden';
    k.marcarLeido();
    assert.equal(leidos().length, 0, 'con la pestaña atrás no se leyó');
    (globalThis as unknown as { document: { visibilityState: string } }).document.visibilityState = 'visible';
    k.marcarLeido();
    k.marcarLeido();
    assert.equal(leidos().length, 1);
    assert.deepEqual(JSON.parse(String(leidos()[0].init?.body)), { hastaId: 100 });
  } finally { m.cerrar(); }
});

// ── 5. Los links y el resto de las piezas ─────────────────────────────────────────────────────────────────────

test('18. el push llega al grupo: `?grupo=` abre la hoja o el panel y sobrevive a cada redirect', async () => {
  const { rutaMovilOHome } = await import('../lib/movil-rutas');
  const { rutaDelSecondBrainEnOpsCenter } = await import('../lib/ops-center-ruta');
  assert.equal(rutaMovilOHome('/second-brain?grupo=7'), '/m/second-brain?grupo=7');
  assert.equal(rutaMovilOHome('/admin/operaciones?grupo=7'), '/m/operaciones?grupo=7');
  assert.equal(rutaDelSecondBrainEnOpsCenter({ grupo: '7' }), '/admin/operaciones?grupo=7', 'sin el grafo');
  const pm = sinComentarios(leer('app/m/second-brain/page.tsx'));
  assert.match(pm, /`\$\{RUTA_CENTRO_M\}\?grupo=\$\{grupoPedido\}`/, 'el super admin en lo suyo no lo pierde');
  assert.match(pm, /grupoInicial: entero\(sp\.grupo\)/, 'el cliente tampoco');
  const po = sinComentarios(leer('app/m/operaciones/page.tsx'));
  assert.match(po, /<CentroAppMovil \{\.\.\.datos\} grupoInicial=\{/);
  assert.match(sinComentarios(leer('app/m/operaciones/CentroAppMovil.tsx')), /<ChatsMDelCentro centro=\{k\} grupoInicial=\{grupoInicial\} \/>/);
  assert.match(sinComentarios(leer('app/admin/operaciones/page.tsx')), /`\$\{RUTA_OPS_CENTER_NEGOCIO\}\?grupo=\$\{q\.grupo\}`/, 'mirando a un cliente tampoco');
  const sb = sinComentarios(leer('app/second-brain/ChatSecondBrain.tsx'));
  assert.match(sb, /useSearchParams\(\)\.get\('grupo'\)/);
  assert.match(sb, /poner\('grupo', grupo\);/, 'la URL dice qué está abierto');
  assert.match(sb, /router\.push\(`\$\{base\}\?grupo=\$\{ws\}`\)/, 'desde el grafo se navega');
});

test('19. queda montado como un gurú, y nadie más pide por este motor', () => {
  const sb = sinComentarios(leer('app/second-brain/ChatSecondBrain.tsx'));
  assert.match(sb, /gruposMontados\.map\(\(ws\) => \{\s*const seVe = ws === grupo && !verMapa && !ticketera;/);
  assert.match(sb, /<ChatDelGrupo ws=\{ws\}[\s\S]{0,120}visible=\{seVe\}/, 'escondido no sondea');
  // La regla del 18/10: una cita va en un renglón, y sin este tope la burbuja se sale de su fila. Sólo se vio en una foto a 390.
  assert.match(leer('app/_chat/grupo/grupo.css'), /\.co-otro \.ch-plegable, \.co-otro \.co-burbuja \{ max-width: 100%; min-width: 0; \}/);
  assert.doesNotMatch(sb, /fetch\(/, 'la pantalla no hace pedidos propios');
  const m = sinComentarios(leer('app/m/second-brain/HojaDelGrupo.tsx'));
  assert.match(m, /<SheetM abierto onCerrar=\{onCerrar\} snap="alto" id=\{`grupo-\$\{ws\}`\}/, 'el «atrás» de Android la cierra');
  assert.doesNotMatch(m, /<SheetM[\s\S]*<SheetM/, 'una sola hoja: Participantes va adentro');
  // ⚠️ El motor no lleva `?ws=`: el ws va en la URL y un invitado sigue parado en su negocio.
  for (const f of ['app/_chat/grupo/useHiloDelGrupo.ts', 'app/_chat/grupo/pantalla.ts', 'app/_chat/grupo/Participantes.tsx']) assert.doesNotMatch(sinComentarios(leer(f)), /conWs\(|[?&]ws=/, f);
});

test('20. como un grupo de WhatsApp (4/11/2026, Martín: «"Participantes" debería estar al final a la derecha... no veo el botón de invitar»)', async () => {
  const { html, m, react } = await dibujo();
  // La cabecera de la computadora, dibujada: el nombre, y a la derecha Invitar y Participantes. A un invitado no se le ofrece invitar.
  const pc = (g: GrupoDeLaLista) => html(react.createElement(m.ChatDelGrupo, { ws: 7, grupo: g, onVolver() {}, onLeido() {}, onCambio() {}, onSalio() {} }));
  const admin = pc(fila(7, { titulo: 'MaKo &lt;&gt; Inmobiliaria' }));
  enOrden(admin, 'co-cab__titulo', 'gr-cab-acciones', '>Invitar<', '>Participantes<');
  const inv = pc(fila(7, { administra: false, invitado: true, titulo: 'Invitación de Ana' }));
  assert.match(inv, />Participantes</);
  assert.doesNotMatch(inv, />Invitar</, 'un invitado no invita');
  // Debajo del nombre, quiénes están: los demás y «Tú» al final.
  assert.equal(quienesEstan([{ nombre: 'Ana', propio: true }, { nombre: 'Joan', propio: false }, { nombre: ' Juanfran ', propio: false }]), 'Joan, Juanfran, Tú');
  // La hoja: el resultado en su lugar, entre el formulario y la lista, aunque no haya nada que decir; y la lista dice cuántos son.
  const datos = { administra: true, invitado: false, frase: FRASE, topeInvitados: 30, sugeridos: [], participantes: [{ nombre: 'Ana', tipo: 'admin', propio: true }, { nombre: 'Joan', tipo: 'invitado', propio: false, email: 'joan@y.com' }] };
  enOrden(html(react.createElement(m.VistaParticipantes, { ...VISTA, datos })), 'gr-invitar', 'gr-resultado', '2 participantes', 'gr-lista');
  enOrden(html(react.createElement(m.VistaParticipantes, { ...VISTA, datos, aviso: 'Listo. Si usa MaKo, lo verá en sus chats.' })), 'gr-invitar', 'gr-resultado', 'Listo.', 'gr-lista');
  // El Modal no cambia de alto al invitar: alto fijo, y en él sólo la lista scrollea. En el teléfono scrollea la hoja entera.
  assert.match(sinComentarios(leer('app/second-brain/ChatDelGrupo.tsx')), /<Modal titulo="Participantes"[^\n]*alto="min\(85vh, 640px\)"/);
  const css = leer('app/_chat/grupo/grupo.css');
  assert.match(css, /\.mk-modal__cuerpo \.gr-miembros > \.gr-lista \{ flex: 1; min-height: 0; overflow-y: auto; \}/);
  // El 👍 montado sobre el borde del globo, no colgando debajo; y en lo tuyo, del lado que no tapa la hora.
  assert.match(css, /\.gr-hilo \.co-yo > \.co-wa__reaccion--de-mako, \.gr-hilo \.co-otro > \.co-wa__reaccion--de-mako \{ margin-top: -16px; \}/);
  // El hilo: lo tuyo sin tu foto, y lo que MaKo contesta lleva la cita del mensaje al que contesta.
  const h = html(react.createElement(m.HiloDelGrupo, { ...HILO_BASE, k: K({ mensajes: [
    msg(3, 'persona', 'Joan', false, 'mako estas vivo?'), msg(4, 'mako', 'MaKo', false, 'Sí, aquí estoy.', { respondeA: 3 }), msg(5, 'persona', 'Ana', true, 'Gracias'),
  ] }) }));
  assert.ok(!h.includes('class="co-mifoto"'), 'lo tuyo va sin tu foto, como en WhatsApp');
  assert.equal((h.match(/class="co-yo/g) ?? []).length, 1);
  enOrden(h, 'mako estas vivo?', 'co-cita', 'Joan', 'mako estas vivo?', 'Sí, aquí estoy.');
  assert.match(h, /class="gr-hilo"/, 'el hilo del grupo tiene su envoltorio de estilo');
});

// PROBADO ROMPIÉNDOLO (4/11/2026, el diseño de WhatsApp), base 21/0: ocho roturas, una por vez y restaurada, las ocho 20/1 (el test 20):
//   · Participantes pegado al título (sin `gr-cab-acciones`) · Invitar a un invitado · sin `alto` en el Modal · la lista sin scroll propio en el Modal
//   · lo tuyo con tu foto · MaKo sin la cita · el resultado sólo cuando hay algo (sin `gr-resultado`) · la reacción con su margen de antes
// PROBADO ROMPIÉNDOLO (4/11/2026, base 20/0): 41 roturas, una por vez sobre el código real y restaurada; todas dieron rojo. Entre paréntesis, el test que cayó.
//   · El orden: el grupo debajo del Cerebro en el teléfono (4, 5, 6) · adentro de la lista del cliente, que lo haría esperar y caer con ella (4, 5) · debajo de los coaches en lo del
//     super admin (4) · doble en el teléfono del super admin mirando un cliente (4) · sin «Ver más» para una agencia (7) · la lista salta mientras carga (7)
//   · El rol: cualquiera puede salir (1) · cualquiera puede invitar (1) · lo de WhatsApp para un invitado, en la regla (1, 10) y en la pantalla (10) · un invitado ve Invitar (8) · quien
//     administra ve Salir (8) · Sacar a quien entra por su rol (8) · el rótulo repite «Invitado» (8)
//   · El hilo: lo de otra persona con la fila propia (9) · sin autor (9, 12) · lo propio con autor (9, 12) · los avisos sin su marca (9, 12) · el menú dice «Tú» de lo ajeno (12) · lo propio
//     cuenta como sin leer (12) · la negrita sin convertir (9, 12, 13, 14) · el adjunto por la ruta del negocio (12) · la caja se apaga mientras MaKo piensa (9) · la burbuja ajena sin tope (19)
//   · El motor: un fallo borra lo dibujado (15) · un 404 no se dice (15) · el sondeo con la pantalla escondida (15b) · el cursor sale de lo que uno escribió (16) · reintentar con otro id (16) ·
//     dice el error de la red (16) · marca leído con la pestaña atrás (17) · el sondeo sin solape (14, 15, 16) · una vuelta sin nada baja el cursor (14) · el grupo escondido sondea (19)
//   · Los links: el push del super admin (18) · el del teléfono (18) · CentroAppMovil no lo pasa (18) · mirando un cliente (18)
//   · En blanco: un error borra lo que ya se ve (11) · sacado del grupo (11) · vacío (11)
