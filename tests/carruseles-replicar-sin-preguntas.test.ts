// «Replicar» deja la pieza ENTERA sin preguntar, y se cambia DESPUÉS (12/11/2026).
//
// Martín, 11/11 (memoria `replicar-deja-todo-escrito`): una acción que crea termina con la pieza completa, con lo que haya por
// defecto (la oferta principal), y deja cambiarlo después con botones al lado del resultado. En Image, «Editar» abría tres
// preguntas (oferta, quién va en lugar de la persona, qué cambiar) antes de generar; el Cerebro lo marcó en la prueba del 12/11.
//
// Esto fija (lib/carruseles/guiado.ts y app/image-editor/carruseles/ReplicarGuiado.tsx):
//   1. lo de por defecto: la oferta principal (o la primera), su cara de marca (o su último look), sólo los textos, y ARRANCA;
//   2. sin ofertas cargadas también se escribe (el pedido sale sin oferta), y por las preguntas sigue haciendo falta una;
//   3. al lado del resultado: otra oferta, la foto, los colores; cada una rehace la pieza en otra vuelta;
//   4. la pantalla arranca con lo de por defecto y el armado lleva las opciones y una llave por vuelta.
//
// Verificado rompiéndolo (12/11/2026), cada rotura sola y restaurada: ver el pie.
//
// Correr: node --import tsx --test tests/carruseles-replicar-sin-preguntas.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  VALOR, opcionesParaRehacer, pasoDe, pedidoDelGuiado, rehacerCon, respuestasPorDefecto, type HechosGuiado,
} from '../lib/carruseles/guiado';

const hechos = (o: Partial<HechosGuiado> = {}): HechosGuiado => ({
  laminas: 6, creador: '@lifeofarjav',
  ofertas: [{ id: 14, nombre: 'WhatsApp Ads Funnel', principal: false }, { id: 31, nombre: 'MaKo Acelerador', principal: true }, { id: 40, nombre: 'Taller', principal: false }],
  persona: null, leyendo: true, fotos: { cara: true, look: false }, kit: true, ...o,
});

test('1 · lo de por defecto: la oferta principal, su cara, sólo los textos, y arranca sin preguntar', () => {
  const h = hechos();
  const r = respuestasPorDefecto(h);
  assert.deepEqual(r.oferta, { id: 31, nombre: 'MaKo Acelerador' }, 'la principal, aunque no sea la primera de la lista');
  assert.equal(r.avatar, 'cara');
  assert.equal(r.cambio, 'textos');
  assert.equal(pasoDe(h, r), 'listo', 'arrancó preguntando');
  assert.deepEqual(pedidoDelGuiado(h, r), { ofertaId: 31, ofertaLibre: null, avatar: 'cara', cambio: 'textos', pedido: null });
  // Sin principal, la primera; sin cara, el look; sin ninguna foto, sin persona.
  assert.equal(respuestasPorDefecto(hechos({ ofertas: [{ id: 7, nombre: 'Uno', principal: false }], fotos: { cara: false, look: true } })).avatar, 'look');
  assert.deepEqual(respuestasPorDefecto(hechos({ ofertas: [{ id: 7, nombre: 'Uno', principal: false }] })).oferta, { id: 7, nombre: 'Uno' });
  assert.equal(respuestasPorDefecto(hechos({ fotos: { cara: false, look: false } })).avatar, 'ninguno');
});

test('2 · sin ofertas cargadas también se escribe; por las preguntas, sin oferta no', () => {
  const h = hechos({ ofertas: [] });
  const r = respuestasPorDefecto(h);
  assert.equal(r.oferta, undefined);
  assert.deepEqual(pedidoDelGuiado(h, r), { ofertaId: null, ofertaLibre: null, avatar: 'cara', cambio: 'textos', pedido: null }, 'sin ofertas, no arrancó');
  assert.equal(pedidoDelGuiado(h, {}), null, 'por las preguntas, sin oferta no se genera');
  // Que termine la lectura no cambia el pedido (cambiarlo reiniciaba el armado que ya corría).
  const r1 = respuestasPorDefecto(hechos());
  assert.deepEqual(pedidoDelGuiado(hechos({ persona: false, leyendo: false }), r1), pedidoDelGuiado(hechos(), r1));
});

test('3 · al lado del resultado: otra oferta, la foto y los colores; cada una rehace en otra vuelta', () => {
  const h = hechos({ persona: true, leyendo: false });
  const r = respuestasPorDefecto(h);
  const ops = opcionesParaRehacer(h, r);
  assert.deepEqual(ops.map((o) => o.rotulo), ['Para «WhatsApp Ads Funnel»', 'Para «Taller»', 'Sin mi foto', 'Con mis colores']);
  const otra = rehacerCon(h, r, VALOR.oferta(14));
  assert.deepEqual(otra.oferta, { id: 14, nombre: 'WhatsApp Ads Funnel' });
  assert.equal(otra.vuelta, 1, 'rehacer es otra vuelta del armado');
  assert.equal(otra.listo, true);
  const sinFoto = rehacerCon(h, otra, VALOR.avatar('ninguno'));
  assert.equal(sinFoto.avatar, 'ninguno');
  assert.equal(sinFoto.vuelta, 2);
  assert.ok(opcionesParaRehacer(h, sinFoto).some((o) => o.rotulo === 'Con mi foto'), 'sin foto, se ofrece ponerla');
  assert.equal(rehacerCon(h, r, VALOR.oferta(999)), r, 'una opción que no se ofrecía no cambia nada');
  // Sin persona medida, la foto no se ofrece; sin kit, los colores tampoco.
  const sinNada = opcionesParaRehacer(hechos({ persona: false, leyendo: false, kit: false }), r).map((o) => o.rotulo);
  assert.ok(!sinNada.includes('Sin mi foto') && !sinNada.includes('Con mis colores'), sinNada.join(', '));
});

test('4 · la pantalla arranca con lo de por defecto y el armado lleva las opciones y una llave por vuelta', () => {
  const src = readFileSync(new URL('../app/image-editor/carruseles/ReplicarGuiado.tsx', import.meta.url), 'utf8');
  assert.match(src, /useState<RespuestasGuiado>\(\(\) => respuestasPorDefecto\(base\)\)/, 'el guiado arranca vacío (preguntando)');
  assert.match(src, /setR\(respuestasPorDefecto\(base\)\)/, 'otro carrusel vuelve a preguntar');
  assert.match(src, /key=\{`\$\{g\.c\.id\}:armado:\$\{g\.r\.vuelta \?\? 0\}`\}/, 'rehacer no vuelve a armar (misma llave)');
  assert.match(src, /rehacer=\{\(g\.opciones \?\? \[\]\)\.map/, 'las opciones no llegan al lado del resultado');
  const armado = readFileSync(new URL('../app/image-editor/carruseles/EditarCarrusel.tsx', import.meta.url), 'utf8');
  assert.match(armado, /rehacer\.map\(\(o\) => <button/, 'el armado no dibuja las opciones');
  const ruta = readFileSync(new URL('../app/api/image-editor/carruseles/replicar/route.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(ruta, /return fallo\('Falta elegir la oferta\.'/, 'la ruta rechaza la réplica sin oferta');
});

test('5 · «Usar plantilla» abre pidiendo que MaKo la escriba entera con lo del negocio, y queda escrita sin «Aceptar»', () => {
  const leer = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
  const cliente = leer('../app/image-editor/ImageEditorCliente.tsx');
  assert.match(cliente, /conContenido\?\.carrusel \|\| conContenido\?\.real \? `\$\{ruta\}\$\{ruta\.includes\('\?'\) \? '&' : '\?'\}\$\{ESCRIBIR_PLANTILLA\}=1` : ruta/,
    'una plantilla con contenido no pide escribirse (o un formato en blanco sí)');
  const panel = leer('../app/image-editor/mako/chat/PanelMakoIA.tsx');
  assert.match(panel, /pedirEdicion\(editorRef\.current, PEDIDO_ESCRIBIR_PLANTILLA, 'diseno', \[\], \{ kit, conNegocio: true \}\)/, 'no pide escribir con el negocio');
  assert.match(panel, /url\.searchParams\.delete\(ESCRIBIR_PLANTILLA\)/, 'recargar volvería a escribir encima');
  assert.match(panel, /if \(m\) void aceptarPropuesta\(editorRef\.current, m\)/, 'lo escrito sobre la plantilla sin tocar queda esperando «Aceptar»');
  const ia = leer('../lib/image-editor/chat/ia.ts');
  assert.match(ia, /p\.conNegocio === true && !discutir \? negocioParaEscribir\(\)/, 'el chat no recibe el negocio al escribir la plantilla');
  assert.match(ia, /\[DATO: qué va\]/, 'sin la regla de [DATO], la IA inventa cifras');
  assert.match(leer('../app/api/image-editor/ia/route.ts'), /conNegocio: body\.conNegocio/, 'la ruta no le pasa `conNegocio` al chat');
});

// ── Probado rompiéndolo (12/11/2026; cada rotura sola, restaurada después) ──────────────────────────────────────────────
//   R1 `respuestasPorDefecto` sin `listo: true`                        → falla el 1
//   R2 `pedidoDelGuiado` sin el `!r.porDefecto`                         → falla el 2
//   R3 `rehacerCon` sin sumar la vuelta                                 → falla el 3
//   R4 el hook arrancando con `{}`                                      → falla el 4
