// =============================================================================
// El chat de MaKo de Automations, con el hilo y la caja únicos: la estrella, el aire y el «+» (23/10/2026, AU4)
// =============================================================================
// Martín, por el Cerebro: «La criatura es SIEMPRE la de MaKo, la estrella, en todos lados. La caja de escribir está pegada
// abajo de todo: tiene que tener aire. Falta el "+" para adjuntar archivos e imágenes. Pasá el chat a la caja y el hilo
// únicos (CajaChat y HiloMako): eso trae el "+", el aire y la criatura». Lo que se fija:
//   · la vista (ChatMakoVista.tsx) DIBUJADA: el hilo con la estrella, la caja con el «+» y lo adjuntado, en `.co-caja-wrap`;
//   · `hiloUnico` (lo que ChatMako le pasa al hilo) EJECUTADO: lo adjuntado, lo que no salió, «✓ Listo», la pregunta viva;
//   · lo adjuntado viaja LEÍDO (texto) y aparte del pedido: el control de lo pedido sigue mirando sólo lo escrito.
//
// PROBADO ROMPIÉNDOLO: ver el pie. Correr: node --import tsx --test tests/chat-mako-caja-unica.test.ts
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as modulo from 'node:module';
import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Las piezas únicas importan su CSS: Node no lo carga (como tests/ops-center-caja-angosta.test.ts). La vista va DESPUÉS, con
// un import dinámico: los estáticos corren antes del hook.
type Loader = (url: string, ctx: unknown, next: (url: string, ctx: unknown) => unknown) => unknown;
const { registerHooks } = modulo as unknown as { registerHooks: (h: { load: Loader }) => void };
registerHooks({ load: (url, ctx, next) => (/\.css($|\?)/.test(url) ? { format: 'commonjs', source: '', shortCircuit: true } : next(url, ctx)) });

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const AT = '2026-10-23T03:00:00.000Z';

test('la vista dibujada: el hilo con la estrella de MaKo, y la caja única con el «+», lo adjuntado y su aire', async () => {
  const { default: ChatMakoVista, QUIEN_MAKO } = await import('../app/automations/ChatMakoVista');
  const { ASPECTO_MAKO } = await import('../lib/centro-munecos');
  assert.deepEqual(QUIEN_MAKO, { nombre: 'MaKo', aspecto: ASPECTO_MAKO }, 'la criatura no es la estrella');
  const html = renderToStaticMarkup(createElement(ChatMakoVista, {
    items: [
      { k: 'msg', id: 'y1', role: 'user', texto: 'Arma lo del PDF', at: AT, archivos: [{ nombre: 'guion.pdf', tipo: 'document', sinAbrir: true }] },
      { k: 'msg', id: 'm1', role: 'assistant', texto: 'Listo', at: AT },
    ],
    enMensaje: (x) => (x.id === 'm1' ? { arriba: createElement('span', { 'data-prueba-arriba': '' }, '✓') } : null),
    escribiendo: null, vacio: null, onReintentar: () => {}, encima: null,
    caja: {
      texto: '', onTexto: () => {}, onMandar: () => {}, placeholder: 'Pídele un cambio',
      adjuntos: { items: [{ id: 'a1', file: new File(['x'], 'foto.png', { type: 'image/png' }), tipo: 'image', url: 'blob:x' }], puede: true, onSumar: () => {}, onQuitar: () => {} },
    },
  }));
  assert.match(html, /class="co-hilo"/);
  assert.match(html, /class="co-caja-wrap"/, 'la caja sin su envoltorio (el aire de abajo)');
  assert.match(html, /aria-label="Más opciones"/, 'sin el «+»');
  assert.match(html, /aria-label="Quitar foto\.png"/, 'lo adjuntado no se ve en la caja');
  assert.match(html, /guion\.pdf/, 'lo adjuntado no se ve en el mensaje');
  assert.match(html, /data-prueba-arriba=""/, 'lo de ChatMako no va en el globo de MaKo');
  assert.match(html, /placeholder="Pídele un cambio"/);
  // La estrella: la forma de MaKo en el muñeco del hilo.
  assert.match(html, /M20 3\.5C22\.2 13 27 17\.8 36\.5 20/, 'la criatura del hilo no es la estrella');
});

test('`hiloUnico`: lo adjuntado, lo que no salió (con su Reintentar), «✓ Listo» arriba y la pregunta viva abajo', async () => {
  const { hiloUnico, hiloDeChat, NO_SE_ENVIO } = await import('../app/automations/ChatMako');
  const { rondaAbierta } = await import('../lib/flujo-ia-cliente');
  const PREG = { id: 'p1', sobre: 'canal', texto: '¿Por dónde?', opciones: [{ valor: 'whatsapp', label: 'WhatsApp' }, { valor: 'email', label: 'Email' }] };
  const mensajes = [
    { id: 'y1', de: 'yo' as const, texto: 'Arma esto', at: AT, via: 'app' as const, adjuntos: ['guion.pdf', 'captura.png'] },
    { id: 'm1', de: 'mako' as const, texto: 'Cambié 1', at: AT, via: 'app' as const, cambios: { cambiadas: 1, quitadas: 0, agregadas: 0 } },
    { id: 'y2', de: 'yo' as const, texto: 'Y el canal', at: AT, via: 'app' as const },
    { id: 'm2', de: 'mako' as const, texto: PREG.texto, at: AT, via: 'app' as const, pregunta: PREG },
  ];
  const porId = new Map(mensajes.map((m, i) => [m.id, { m, i }] as const));
  const extra = { id: 'pedido:x', at: AT, yo: 'Esto no salió', fallido: 'Sin conexión', adjuntos: [{ nombre: 'a.pdf', texto: 'hola' }] };
  const { items, enGlobo } = hiloUnico({
    hilo: [...hiloDeChat(mensajes as never), { id: extra.id, fromMe: true, texto: extra.yo, fecha: AT }],
    porId: porId as never, extraPorId: new Map([[extra.id, extra]]) as never, total: mensajes.length,
    preguntaViva: rondaAbierta(mensajes as never)?.pregunta ?? null, ultimoMako: 3, deshabilitado: false, trabajando: false,
    elegir: () => {}, tocarBurbuja: () => {},
  });
  const msg = (id: string) => items.find((x) => x.id === id) as Extract<(typeof items)[number], { k: 'msg' }>;
  assert.deepEqual(msg('y1').archivos?.map((a) => [a.nombre, a.tipo]), [['guion.pdf', 'document'], ['captura.png', 'image']]);
  assert.equal(msg('pedido:x').estado, 'error');
  assert.equal(msg('pedido:x').error, NO_SE_ENVIO);
  assert.deepEqual(msg('pedido:x').archivos?.map((a) => a.nombre), ['a.pdf']);
  const html = (id: string) => renderToStaticMarkup(createElement(Fragment, null, enGlobo.get(id)?.arriba ?? null, enGlobo.get(id)?.abajo ?? null));
  assert.match(html('m1'), /data-listo-mako=""[^>]*>✓ Listo</);
  assert.match(html('m2'), /data-pregunta-mako="canal"/);
  assert.match(html('m2'), /data-opcion="whatsapp"/);
});

test('lo adjuntado viaja LEÍDO y aparte del pedido; queda su nombre en el mensaje guardado', async () => {
  const { sanearAdjuntos, bloqueDeAdjuntos, TOPE_TEXTO_ADJUNTO, TOPE_ADJUNTOS_AUTOMATIZACION } = await import('../lib/chat-adjuntos-automatizacion');
  const { sanearMensaje } = await import('../lib/automatizacion-chat');
  const largo = 'x'.repeat(TOPE_TEXTO_ADJUNTO + 50);
  const s = sanearAdjuntos([{ nombre: 'a.pdf', texto: largo }, { nombre: 'b.png', texto: '' }, null, { texto: 'sin nombre' }, { nombre: 'c', texto: 'c' }, { nombre: 'd', texto: 'd' }]);
  assert.deepEqual(s.map((a) => a.nombre), ['a.pdf', 'archivo', 'c', 'd'], 'uno vacío o malformado pasó, o le quitó el lugar a uno bueno');
  assert.ok(s[0].texto.endsWith('[…sigue: lo corté acá]'));
  assert.equal(s[1].nombre, 'archivo');
  assert.ok(s.length <= TOPE_ADJUNTOS_AUTOMATIZACION);
  assert.match(bloqueDeAdjuntos([{ nombre: 'guion.pdf', texto: 'Paso 1' }]), /^LO QUE ADJUNTÓ EL DUEÑO[^\n]*\n\n«guion\.pdf»:\nPaso 1$/);
  assert.equal(bloqueDeAdjuntos([]), '');
  assert.deepEqual(sanearMensaje({ id: 'y', de: 'yo', texto: 't', at: AT, via: 'app', adjuntos: ['a.pdf', 3, ''] })?.adjuntos, ['a.pdf']);
  // La ruta: el bloque al modelo (editar y explicar como un extra; crear al final del pedido) y el nombre en el turno.
  const ruta = leer('app/api/chat-agent/secuencias/ia/route.ts');
  assert.match(ruta, /const adjuntos = sanearAdjuntos\(body\.adjuntos\);/);
  assert.match(ruta, /const extras = \[\.\.\.extrasDelUser\(intencion, historial\), \.\.\.\(adjuntos\.length \? \[bloqueDeAdjuntos\(adjuntos\)\] : \[\]\)\];/);
  assert.match(ruta, /crearFlujoConIA\(\{ ws, pedido: conAdjuntos\(pedido\),/);
  assert.match(ruta, /await anotar\(\[yo && adjuntos\.length \? \{ \.\.\.yo, adjuntos: adjuntos\.map\(\(a\) => a\.nombre\) \} : yo\]\);/);
  // El control de lo pedido sigue con `pedido` (lo escrito), no con lo adjuntado.
  assert.doesNotMatch(ruta, /faltantesDelPedido\(conAdjuntos/);
  // El cliente: se lee al adjuntar y viaja con el turno.
  const chat = leer('app/automations/ChatMako.tsx');
  assert.match(chat, /void leerArchivoParaPedido\(a\.file\)\.then\(/);
  assert.match(chat, /\.\.\.\(adj\.length \? \{ adjuntos: adj \} : \{\}\),\n\s+\}, \{ siNadieMira \}\);/);
  assert.match(chat, /if \(adjuntosRef\.current\.some\(\(a\) => a\.estado === 'leyendo'\)\) \{ setError\(\{ texto: 'Espera a que termine de leer el archivo\.' \}\); return; \}/);
});

// ── ROTURAS (23/10/2026) ───────────────────────────────────────────────────────────────────────────
// Con romper.mjs del scratchpad, una por vez. Base 3 / 0:
//   U1. la criatura del hilo vuelve a ser otra (sin `ASPECTO_MAKO`)                            → rojo
//   U2. la caja sin el «+» (sin `adjuntos`)                                                     → rojo
//   U3. lo adjuntado no queda en el mensaje (sin `archivos`)                                   → rojo
//   U4. el bloque de lo adjuntado no llega al modelo                                           → rojo
//   U5. se puede mandar mientras se lee un archivo                                             → rojo
