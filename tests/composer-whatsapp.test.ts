// =============================================================================
// El composer de WhatsApp: UNA barra, dos modos, y lo que no se ve leyendo el JSX
// =============================================================================
// Pedido de Martín (08/10/2026, punto 8): un mismo editable tipo WhatsApp para todo. La barra
// (`app/whatsapp/_shared/ComposerWhatsApp.tsx`) la montan ChatHilo y EmpresaInbox en modo
// `enviar` y el editor del lienzo en modo `editar`. Este test EJECUTA lo que decide:
//   · Enter: manda en `enviar`, es un renglón en `editar` (`accionDeTecla`);
//   · el emoji va EN EL CURSOR (`insertarEnCursor`), no al final;
//   · el popover cae adentro de la ventana (`ubicarPopover`);
//   · la entrada animada del hilo es opt-in y sólo para lo NUEVO (`seguirEntradas`);
//   · desmontar a mitad de una grabación NO entrega el audio (`crearGrabadorVoz`, con un
//     MediaRecorder falso);
//   · la burbuja pinta las marcas, el «Dice:» y la ✦ (`BurbujaHilo`).
//
// Probado rompiéndolo (08/10/2026) con un arnés que rompe UNA cosa, corre este archivo y restaura
// de memoria: 9 roturas, 9 cazadas (14 tests; cada rotura deja 1 fallo y 13 pases):
//   1. `accionDeTecla` sin el `if (modo !== 'enviar')` (Enter manda en el editor).
//   2. el onKeyDown del composer con `e.key !== 'Enter'` a mano en vez de `accionDeTecla`.
//   3. el emoji con `onValor(valorVivo.current + em)` (al final, no en el cursor).
//   4. `insertarEnCursor` ignorando `hasta` (no reemplaza la selección).
//   5. `soltar()` sin `cancelado = true` — el bug de antes: el audio se entregaba al desmontar.
//   6. `soltar()` cancelando también lo YA parado (sin mirar `rec.state`).
//   7. `seguirEntradas` marcando todo lo del hilo como nuevo.
//   8. ChatHilo con `entrando` sin el `animarNuevos ?` (el inbox animaría el historial).
//   9. BurbujaHilo pintando `texto` crudo en vez de `TextoMarcas`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { accionDeTecla, insertarEnCursor, ubicarPopover, ComposerWhatsApp } from '../app/whatsapp/_shared/ComposerWhatsApp';
import { crearGrabadorVoz } from '../app/whatsapp/_shared/VoiceRecorder';
import { ChatHilo, seguirEntradas, vistosIniciales, contenidoDeMensaje, type HiloMsg } from '../app/whatsapp/_shared/ChatHilo';
import { BurbujaHilo } from '../app/whatsapp/_shared/BurbujaHilo';
import { datosOfrecidos } from '../lib/variables-aviso';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// ── Enter ────────────────────────────────────────────────────────────────────────────────────

test('Enter: en `editar` es un renglón; en `enviar` manda (salvo Shift o mientras se compone)', () => {
  assert.equal(accionDeTecla('editar', { key: 'Enter' }), null, 'en el editor Enter mandaba y los mensajes perdían sus renglones');
  assert.equal(accionDeTecla('editar', { key: 'Enter', shiftKey: true }), null);
  assert.equal(accionDeTecla('enviar', { key: 'Enter' }), 'enviar');
  assert.equal(accionDeTecla('enviar', { key: 'Enter', shiftKey: true }), null);
  assert.equal(accionDeTecla('enviar', { key: 'Enter', isComposing: true }), null, 'un IME a mitad de una palabra no manda');
  assert.equal(accionDeTecla('enviar', { key: 'a' }), null);
});

test('CABLEADO: el campo decide con `accionDeTecla(modo, …)` y el emoji entra por `insertar`', () => {
  const src = sinComentarios(leer('app/whatsapp/_shared/ComposerWhatsApp.tsx'));
  const tecla = src.slice(src.indexOf('onKeyDown={(e) => {'), src.indexOf('placeholder={placeholder ??'));
  assert.ok(tecla.length > 0 && tecla.length < 600, `no encontré el onKeyDown del campo (${tecla.length})`);
  assert.match(tecla, /accionDeTecla\(modo, \{ key: e\.key, shiftKey: e\.shiftKey, isComposing: e\.nativeEvent\.isComposing \}\)/);
  assert.doesNotMatch(tecla, /e\.key === 'Enter'/, 'una segunda regla de Enter al lado de accionDeTecla');
  assert.match(src, /<EmojiPicker onPick=\{\(em\) => insertar\(em\)\}/, 'el emoji tiene que ir al cursor');
});

// ── El cursor ────────────────────────────────────────────────────────────────────────────────

test('el emoji (o un dato) se inserta EN EL CURSOR y reemplaza lo seleccionado', () => {
  assert.deepEqual(insertarEnCursor('Hola mundo', 4, 4, ' 👋'), { valor: 'Hola 👋 mundo', cursor: 7 });
  assert.deepEqual(insertarEnCursor('Hola mundo', 5, 10, '{{nombre}}'), { valor: 'Hola {{nombre}}', cursor: 15 });
  // Sin selección conocida, al final (lo que hace el navegador con un valor puesto por código).
  assert.deepEqual(insertarEnCursor('Hola', null, null, '!'), { valor: 'Hola!', cursor: 5 });
  // Una selección vieja más larga que el texto no rompe: se acota.
  assert.deepEqual(insertarEnCursor('Hi', 9, 12, '!'), { valor: 'Hi!', cursor: 3 });
  assert.deepEqual(insertarEnCursor('Hola', 3, 1, 'X'), { valor: 'HolXa', cursor: 4 });
});

// ── El popover ───────────────────────────────────────────────────────────────────────────────

test('el popover cae ARRIBA del botón, adentro de la ventana, y se da vuelta si arriba no entra', () => {
  const ventana = { ancho: 1000, alto: 800 };
  const panel = { ancho: 340, alto: 320 };
  // El composer abajo de todo: arriba entra.
  const abajoDeTodo = ubicarPopover({ left: 100, right: 142, top: 740, bottom: 782 }, panel, ventana);
  assert.equal(abajoDeTodo.top, 740 - 6 - 320);
  assert.equal(abajoDeTodo.left, 100);
  // Pegado al borde derecho: se corre para adentro.
  const derecha = ubicarPopover({ left: 900, right: 942, top: 740, bottom: 782 }, panel, ventana);
  assert.equal(derecha.left, 1000 - 340 - 8);
  // Arriba de la pantalla: abajo hay más lugar, se da vuelta.
  const arriba = ubicarPopover({ left: 10, right: 52, top: 60, bottom: 100 }, panel, ventana);
  assert.equal(arriba.top, 106);
  // Una ventana más chica que el panel: nunca afuera por arriba.
  assert.ok(ubicarPopover({ left: 0, right: 40, top: 200, bottom: 240 }, panel, { ancho: 320, alto: 300 }).top >= 8);
});

// ── Los dos modos, dibujados ─────────────────────────────────────────────────────────────────

test('editar: sin flecha de enviar, con el mic al costado aunque haya texto', () => {
  const html = renderToStaticMarkup(createElement(ComposerWhatsApp, { modo: 'editar', valor: 'Hola', onValor: () => {}, onAudio: () => {} }));
  assert.ok(html.includes('aria-label="Grabar nota de voz"'));
  assert.ok(!html.includes('aria-label="Enviar"'), 'en el editor no hay nada que mandar');
  const enviar = renderToStaticMarkup(createElement(ComposerWhatsApp, { modo: 'enviar', valor: 'Hola', onValor: () => {}, onEnviar: () => {}, onAudio: () => {} }));
  assert.ok(enviar.includes('aria-label="Enviar"'));
  assert.ok(!enviar.includes('aria-label="Grabar nota de voz"'), 'con texto, la flecha reemplaza al mic');
  const vacio = renderToStaticMarkup(createElement(ComposerWhatsApp, { modo: 'enviar', valor: '  ', onValor: () => {}, onEnviar: () => {}, onAudio: () => {} }));
  assert.ok(vacio.includes('aria-label="Grabar nota de voz"'));
});

// ── Los datos azules al editar (undécima tanda, punto 7) ─────────────────────────────────────────
// La barra con `datos` (los editores de las automatizaciones) pinta cada `{{dato}}` con el espejo de CampoConDatos
// (tests/campo-con-datos.test.ts lo ejecuta entero); sin `datos` (los chats de /whatsapp), el campo es el de siempre.
// PROBADO ROMPIÉNDOLO (11/10/2026): el composer sin pasarle `datos` a CampoConDatos → 14 pases / 1 fallo (éste), y
// 1 más en tests/campo-con-datos (el CABLEADO).
test('con `datos`, el campo pinta sus {{datos}}; sin ellos, el campo de siempre (los chats de /whatsapp)', () => {
  const base = { modo: 'enviar' as const, valor: 'Hola {{nombre}}', onValor: () => {}, onEnviar: () => {} };
  const con = renderToStaticMarkup(createElement(ComposerWhatsApp, { ...base, datos: datosOfrecidos({ destino: 'lead', conLead: true }) }));
  assert.match(con, /<div data-campo-datos=""/);
  assert.match(con, /<span data-dato="nombre" data-ini="5" data-fin="15" style="color:var\(--primary-strong\)">\{\{nombre\}\}<\/span>/);
  assert.ok(con.includes('>Hola {{nombre}}</textarea>'), 'el texto del campo cambió');
  const sin = renderToStaticMarkup(createElement(ComposerWhatsApp, base));
  assert.ok(!sin.includes('data-campo-datos') && !sin.includes('data-dato'), 'el chat de /whatsapp no tiene datos que pintar');
  assert.match(sin, /<textarea[^>]*style="flex:1;min-width:0;[^"]*color:var\(--ink\)/, 'el campo del chat dejó de ser el de siempre');
});

// ── El grabador ──────────────────────────────────────────────────────────────────────────────

class RecFalso {
  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  start() { this.state = 'recording'; }
  stop() {
    if (this.state === 'inactive') return;
    this.state = 'inactive';
    // Como el navegador: el `onstop` llega DESPUÉS, no en el mismo tick.
    setTimeout(() => { this.ondataavailable?.({ data: new Blob(['voz']) }); this.onstop?.(); }, 5);
  }
  pause() { this.state = 'paused'; }
  resume() { this.state = 'recording'; }
}

function armar() {
  const rec = new RecFalso();
  let pistasCortadas = 0;
  const stream = { getTracks: () => [{ stop: () => { pistasCortadas++; } }] };
  const entregas: Array<{ blob: Blob; secs: number }> = [];
  const errores: string[] = [];
  const g = crearGrabadorVoz(() => {}, {
    pedirMicrofono: async () => stream as unknown as MediaStream,
    crearRecorder: () => rec as unknown as MediaRecorder,
  });
  const onSend = (blob: Blob, secs: number) => { entregas.push({ blob, secs }); };
  return { g, rec, entregas, errores, onSend, onError: (m: string) => errores.push(m), pistas: () => pistasCortadas };
}
const esperar = () => new Promise((r) => setTimeout(r, 20));

test('desmontar A MITAD de una grabación NO entrega el audio, y suelta el micrófono', async () => {
  const t = armar();
  await t.g.start(t.onSend, t.onError);
  assert.equal(t.rec.state, 'recording');
  t.g.soltar();
  await esperar();
  assert.equal(t.entregas.length, 0, 'cerrar el panel a mitad de una grabación subía el audio y lo asignaba al paso');
  assert.deepEqual(t.errores, [], 'tampoco es un error: la persona se fue');
  assert.ok(t.pistas() >= 1, 'el micrófono quedó prendido');
});

test('lo que la persona TERMINÓ se entrega aunque el componente se vaya antes del onstop', async () => {
  const t = armar();
  await t.g.start(t.onSend, t.onError);
  t.g.stop(false);
  t.g.soltar();
  await esperar();
  assert.equal(t.entregas.length, 1, 'apretó la flecha: lo pidió mandar');
});

test('la papelera de la barra cancela, y terminar entrega UNA vez', async () => {
  const a = armar();
  await a.g.start(a.onSend, a.onError);
  a.g.stop(true);
  await esperar();
  assert.equal(a.entregas.length, 0);
  const b = armar();
  await b.g.start(b.onSend, b.onError);
  b.g.stop(false);
  await esperar();
  assert.equal(b.entregas.length, 1);
  assert.ok(b.entregas[0]!.blob.size > 0);
});

test('CABLEADO: el hook suelta el grabador al desmontar', () => {
  const src = sinComentarios(leer('app/whatsapp/_shared/VoiceRecorder.tsx'));
  assert.match(src, /useEffect\(\(\) => \(\) => grabador\.soltar\(\), \[grabador\]\)/);
});

// ── La entrada animada ───────────────────────────────────────────────────────────────────────

test('la entrada anima SÓLO lo nuevo, y lo deja marcado mientras siga en el hilo', () => {
  const v0 = vistosIniciales(['1', '2']);
  assert.equal(v0.entrando.size, 0, 'lo que ya estaba al montar es historial: no se anima');
  const v1 = seguirEntradas(v0, ['1', '2', '3']);
  assert.deepEqual([...v1.entrando], ['3']);
  // Un render más con lo mismo: nada cambia (no se reinicia la animación).
  assert.equal(seguirEntradas(v1, ['1', '2', '3']), v1);
  // Llega otro: el 3 sigue marcado (sacarle la clase la reiniciaría), el 4 entra.
  const v2 = seguirEntradas(v1, ['1', '2', '3', '4']);
  assert.deepEqual([...v2.entrando].sort(), ['3', '4']);
  // ↻ del «Probar»: se vacía y vuelven los mismos ids — entran de nuevo.
  const v3 = seguirEntradas(seguirEntradas(v2, []), ['1']);
  assert.deepEqual([...v3.entrando], ['1']);
});

const msgs: HiloMsg[] = [
  { id: 1, fromMe: false, texto: 'Hola' },
  { id: 2, fromMe: true, texto: 'Buenas *tardes*' },
];

test('sin `animarNuevos` el hilo no cambia: ni clase ni keyframes (el inbox y los grupos reales)', () => {
  const sin = renderToStaticMarkup(createElement(ChatHilo, { mensajes: msgs }));
  assert.ok(!sin.includes('mk-hilo-entra'), 'el hilo de siempre animaría el historial en cada carga');
  const con = renderToStaticMarkup(createElement(ChatHilo, { mensajes: msgs, animarNuevos: true }));
  assert.ok(con.includes('@keyframes mk-hilo-entra'));
  assert.ok(!con.includes('class="mk-hilo-entra"'), 'lo que ya estaba al montar no entra animado');
  assert.ok(con.includes('prefers-reduced-motion'), 'con «reducir movimiento» va sólo el fundido');
});

// ── La burbuja ───────────────────────────────────────────────────────────────────────────────

test('la burbuja pinta las marcas de WhatsApp y deja los {{datos}} enteros', () => {
  const html = renderToStaticMarkup(createElement(BurbujaHilo, { contenido: { texto: '*Hola* {{nombre_completo}}, mira {{negocio}}' } }));
  assert.match(html, /font-weight:700/);
  assert.ok(!html.includes('*Hola*'), 'los asteriscos crudos se leen como un error de tipeo');
  assert.ok(html.includes('{{nombre_completo}}') && html.includes('{{negocio}}'));
});

test('audio con su «Dice:», ✦ si lo adapta MaKo, y un documento con su caption', () => {
  const audio = renderToStaticMarkup(createElement(BurbujaHilo, { contenido: { audio: { url: 'https://x/a.mp3', transcript: 'Te cuento rápido' } } }));
  assert.ok(audio.includes('<audio'));
  assert.ok(audio.includes('Dice: «Te cuento rápido»'));
  const ia = renderToStaticMarkup(createElement(BurbujaHilo, { contenido: { texto: 'Hola', ia: true } }));
  assert.ok(ia.includes('✦'));
  const doc = renderToStaticMarkup(createElement(BurbujaHilo, { contenido: { media: { url: 'https://x/p.pdf', mime: 'application/pdf', nombre: 'Precios.pdf' }, texto: 'Te paso los precios' } }));
  assert.ok(doc.includes('Precios.pdf') && doc.includes('Te paso los precios') && doc.includes('<a '));
  // En la tarjeta del lienzo un link se comería el clic que abre el editor.
  const chica = renderToStaticMarkup(createElement(BurbujaHilo, { compacta: true, contenido: { media: { url: 'https://x/p.pdf', mime: 'application/pdf', nombre: 'Precios.pdf' } } }));
  assert.ok(!chica.includes('<a '));
});

test('el hilo arma la burbuja igual que antes: el texto de un documento es su NOMBRE', () => {
  assert.deepEqual(contenidoDeMensaje({ id: 1, fromMe: true, tipo: 'document', texto: 'Contrato.pdf', mediaUrl: 'u', mediaMime: 'application/pdf' }),
    { media: { url: 'u', mime: 'application/pdf', nombre: 'Contrato.pdf', tipo: 'document' }, ia: undefined });
  const conCaption = contenidoDeMensaje({ id: 1, fromMe: true, tipo: 'document', texto: 'Mira esto', nombreArchivo: 'Contrato.pdf', mediaUrl: 'u' });
  assert.equal(conCaption.texto, 'Mira esto');
  assert.equal(conCaption.media?.nombre, 'Contrato.pdf');
  assert.equal(contenidoDeMensaje({ id: 2, fromMe: false, tipo: 'audio', mediaUrl: 'a', transcript: 'hola' }).audio?.transcript, 'hola');
});
