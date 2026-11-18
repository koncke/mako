// =============================================================================
// El chat del Image Editor entiende lo que NO es del diseño abierto (18/11/2026, F136 tanda 3)
// =============================================================================
// docs/pendientes-verificados-17-11.md F136: el chat le mandaba el mensaje ENTERO a su IA, aunque pidiera otro diseño o algo de
// otra tab. Ahora, como el Video Editor (app/video-editor/_opencut/chat/pedidos.ts), le pregunta a POST /api/mako/pedidos con
// `tab: 'imagen'` ANTES de la IA (app/image-editor/mako/chat/acciones.ts → `pedirEdicion`): lo del abierto sigue a la IA, lo
// demás vuelve como una burbuja de MaKo con su link; si la ruta falla, todo va a la IA, como antes.
// Correr: node --import tsx --test tests/image-editor-pedidos-chat.test.ts
// PROBADO ROMPIÉNDOLO (base 3/0):
//   · `pedirEdicion` sin pasar por la ruta (el mensaje entero a la IA)     → 2/1 (2)
//   · una sugerencia que también pasa por la ruta (`interpretar` ignorado) → 2/1 (3)
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { RUTA_LISTA, TEXTOS, burbujasDe, cuerpoPedidos, interpretacionDe, rutaDeDiseno, textoActual } from '../app/image-editor/mako/chat/pedidos';
import { pedirEdicion } from '../app/image-editor/mako/chat/acciones';
import { leerHilo, type MensajeMako } from '../app/image-editor/mako/chat/hilo';

const ABIERTO = '11111111-2222-4333-8444-555555555555';
const OTRO = { id: '66666666-7777-4888-9999-aaaaaaaaaaaa', nombre: 'Promo de verano' };
const OTRO2 = { id: '66666666-7777-4888-9999-bbbbbbbbbbbb', nombre: 'Historia del lanzamiento' };

test('1. el cuerpo es de la tab imagen, y cada pedido de afuera vuelve como una burbuja con su link de adentro', () => {
  assert.deepEqual(cuerpoPedidos('  cambia el título  ', { id: ABIERTO, nombre: ' Mi diseño ' }), { texto: 'cambia el título', tab: 'imagen', actualId: ABIERTO, actualNombre: 'Mi diseño' });
  const i = interpretacionDe({
    ok: true, origen: 'reglas', pedidos: [
      { sobre: 'actual', texto: 'cambia el título' },
      { sobre: 'nuevo', texto: 'y créame otro diseño', operacion: null },
      { sobre: 'otro', texto: 'en la promo', verbo: 'editar', objeto: OTRO, candidatos: [], operacion: null, confirmar: false, pregunta: null },
      { sobre: 'otro', texto: 'borra la del lanzamiento', verbo: 'borrar', objeto: OTRO2, candidatos: [], operacion: null, confirmar: false, pregunta: null },
      { sobre: 'otro', texto: 'borra éste', verbo: 'borrar', objeto: { id: ABIERTO, nombre: 'Mi diseño' }, candidatos: [], operacion: null, confirmar: false, pregunta: null },
      { sobre: 'otra-tab', texto: 'mándalo por WhatsApp', area: 'chats', titulo: 'Chats', link: '/chats', operacion: null, confirmar: false },
    ],
  }, 'x');
  assert.equal(textoActual(i), 'cambia el título');
  assert.deepEqual(burbujasDe(i, ABIERTO), [
    { texto: TEXTOS.propuesta, links: [{ texto: TEXTOS.crear, href: RUTA_LISTA }] },
    { texto: 'Eso va en «Promo de verano».', links: [{ texto: 'Abrir «Promo de verano»', href: `/image-editor/${OTRO.id}` }] },
    { texto: '«Historia del lanzamiento» se borra desde la lista de diseños.', links: [{ texto: TEXTOS.lista, href: RUTA_LISTA }] },
    { texto: TEXTOS.abiertoBorrar, links: [{ texto: TEXTOS.lista, href: RUTA_LISTA }] },
    { texto: 'Eso se hace en Chats.', links: [{ texto: 'Ir a Chats', href: '/chats' }] },
  ]);
  // Sin un diseño claro, se pregunta: nunca se elige el primero de una lista.
  const tres = interpretacionDe({ ok: true, pedidos: [{ sobre: 'otro', texto: 'en la otra', verbo: 'editar', objeto: null, candidatos: [OTRO, OTRO2, { id: '66666666-7777-4888-9999-cccccccccccc', nombre: 'C' }], operacion: null, confirmar: false, pregunta: null }] }, 'x');
  assert.deepEqual(burbujasDe(tres, ABIERTO), [{ texto: TEXTOS.cual, links: [] }]);
  // Un id que no es un diseño no arma link; una ruta que falla deja todo como antes.
  assert.equal(rutaDeDiseno({ id: '../../admin', nombre: 'x' }), null);
  assert.equal(textoActual(interpretacionDe(null, 'todo esto')), 'todo esto');
});

type Pedido = { url: string; cuerpo: Record<string, unknown> | null };
function editorDeMentira() {
  const doc = { width: 1080, height: 1080, pages: [{ id: 'pag-1', background: { type: 'solid', color: '#ffffff' }, objects: [{ type: 'textbox', id: 'obj-t', text: 'Hola', fontFamily: '"Inter", sans-serif', fontSize: 40, originX: 'left', originY: 'top', left: 0, top: 0, width: 300, height: 48 }] }] };
  return {
    designId: ABIERTO,
    state: { selection: { ids: [] as string[] }, docVersion: 1, activePageId: 'pag-1', title: 'Mi diseño' },
    getDocument: () => doc,
  };
}
function fetchDeMentira(pedidos: Pedido[], ruta: unknown) {
  globalThis.fetch = (async (url: string, init?: { body?: string }) => {
    pedidos.push({ url: String(url), cuerpo: init?.body ? JSON.parse(init.body) : null });
    if (String(url).startsWith('/api/mako/pedidos')) return { json: async () => ruta };
    if (String(url).startsWith('/api/image-editor/ia')) return { json: async () => ({ ok: true, resumen: 'Cambio el título.', operaciones: [] }) };
    return { json: async () => ({ ok: false }) };
  }) as unknown as typeof fetch;
}

test('2. pedirEdicion pregunta ANTES de la IA: a la IA va lo del abierto y lo demás queda como burbuja', async () => {
  const pedidos: Pedido[] = [];
  fetchDeMentira(pedidos, { ok: true, pedidos: [{ sobre: 'actual', texto: 'cambia el título' }, { sobre: 'nuevo', texto: 'y créame otro', operacion: null }] });
  const editor = editorDeMentira();
  await pedirEdicion(editor as never, 'cambia el título y créame otro', 'diseno');
  const iP = pedidos.findIndex((p) => p.url === '/api/mako/pedidos');
  const iIA = pedidos.findIndex((p) => p.url === '/api/image-editor/ia');
  assert.ok(iP >= 0 && iIA > iP, `primero la ruta de pedidos, después la IA: ${pedidos.map((p) => p.url).join(' → ')}`);
  assert.deepEqual(pedidos[iP].cuerpo, { texto: 'cambia el título y créame otro', tab: 'imagen', actualId: ABIERTO, actualNombre: 'Mi diseño' });
  assert.equal(pedidos[iIA].cuerpo?.instruccion, 'cambia el título', 'a la IA, sólo lo del diseño abierto');
  const ultimo = leerHilo(ABIERTO).mensajes.at(-1) as MensajeMako;
  assert.deepEqual([ultimo.texto, ultimo.links], [TEXTOS.propuesta, [{ texto: TEXTOS.crear, href: RUTA_LISTA }]]);

  // Todo de otra tab: no se llama a la IA del chat.
  const otros: Pedido[] = [];
  fetchDeMentira(otros, { ok: true, pedidos: [{ sobre: 'otra-tab', texto: 'mándalo por WhatsApp', area: 'chats', titulo: 'Chats', link: '/chats', operacion: null, confirmar: false }] });
  await pedirEdicion(editorDeMentira() as never, 'mándalo por WhatsApp', 'diseno');
  assert.equal(otros.some((p) => p.url === '/api/image-editor/ia'), false);
  assert.equal((leerHilo(ABIERTO).mensajes.at(-1) as MensajeMako).texto, 'Eso se hace en Chats.');
});

test('3. una sugerencia (nuestra) y «Discutir» no pasan por la ruta: van enteras a la IA', async () => {
  for (const op of [{ interpretar: false }, { intencion: 'discutir' as const }]) {
    const pedidos: Pedido[] = [];
    fetchDeMentira(pedidos, { ok: true, pedidos: [{ sobre: 'nuevo', texto: 'otro', operacion: null }] });
    await pedirEdicion(editorDeMentira() as never, 'Mejora el contraste de los textos', 'diseno', [], op);
    assert.equal(pedidos.some((p) => p.url === '/api/mako/pedidos'), false, JSON.stringify(op));
    assert.equal(pedidos.find((p) => p.url === '/api/image-editor/ia')?.cuerpo?.instruccion, 'Mejora el contraste de los textos');
  }
});
