// =============================================================================
// El editor de un mensaje de WhatsApp: lo que hace y, sobre todo, lo que NO hace
// =============================================================================
// `app/automations/EditorMensajeWhatsApp.tsx` (pedido de Martín del 08/10/2026, punto 8): la burbuja
// como llega arriba, la barra de WhatsApp abajo, el mic al costado y el clip con la biblioteca.
// Lo que fija este test:
//   · NO PUBLICA. Antes, grabar o elegir un audio en el lienzo llamaba a `setAudioDePaso`, que hacía
//     PATCH de todos los pasos locales en el acto. El editor sólo escribe la BIBLIOTECA y le pasa al
//     lienzo un cambio local (`onChange`).
//   · las vueltas de lib/guion-audio.ts (la ✕ del chip, a archivo, a voz) no pierden nada: las sigue
//     usando el wizard de secuencias (PasoAudioControl);
//   · tercera tanda (09/10/2026): UNA columna como un teléfono (la `fila` se fue) y sin «Revisar
//     antes de enviar» (el dato `revisar` queda; el editor ya no lo dibuja ni lo escribe).
//   · ⚠️ CUARTA TANDA, PUNTO 15 (09/10/2026) — CAMBIÓ LO QUE ESTE TEST FIJABA: el mensaje es una LISTA
//     de partes. La barra es un borrador (modo `enviar`: «Enviar» suma la burbuja y vacía la barra);
//     cada burbuja tiene ✏️ y una papelera visible con «Deshacer» 5 s; el audio sin transcripción;
//     «{ }» EN la barra al lado del clip y «✦ MaKo» arriba (nada debajo de la barra); arriba, el
//     número de salida. Antes este test
//     fijaba el chip del audio guardado arriba del campo, el campo como «el pie», «Usar» con
//     `pasoAVozDesde` y «✦ MaKo»/«{ }» DEBAJO de la barra: se reescribió a lo nuevo.
//
// Probado rompiéndolo (08/10/2026, primera y tercera tanda): las roturas de entonces están en el
// historial de este archivo. Las de la cuarta tanda (09/10/2026, arnés del scratchpad: una por vez,
// restaurada de memoria; base 23 / 23): 8 roturas, 8 cazadas.
//   1. `enviarALista` que siempre suma al final (la edición no vuelve a su lugar) → 1 rojo.
//   2. `partesDeLaBarra` con el texto de un audio como si fuera su pie (una parte)  → 1.
//   3. la burbuja del audio con su `transcript`                                    → 1.
//   4. la papelera sin «Deshacer» (`show('Mensaje borrado')` a secas)               → 1.
//   5. «✦ MaKo» de vuelta debajo de la barra                                       → 2.
//   6. el composer de varias partes en modo `editar` (la barra vuelve a ser el mensaje) → 1.
//   7. el número de salida dibujado sin la prop `linea`                            → 2.
//   8. `aplicarPartes` sin las variantes explícitas `[]` para lo que no es un texto → 1.
// Al TERMINAR el punto 15 (09/10/2026, mismo arnés, este archivo con los otros cuatro de la tanda;
// base 69 / 0) «{ }» pasó a la barra al lado del clip y «✦ MaKo» puede ir en la cabecera. 3 roturas,
// 3 cazadas, cada una 68 / 1:
//   9. «{ }» fuera de la barra de varias partes (sin `trasClip`).
//  10. «✦ MaKo» repetido aunque lo lleve la cabecera (`makoEnCabecera` ignorado).
//  11. ComposerWhatsApp sin dibujar la ranura `trasClip`.
// SEXTA TANDA (09/10/2026, parte «whatsapp»): el número y el ✦ pasaron a la CABECERA del panel
// (`CabeceraWhatsApp`) y el ✦ abre el panel de MaKo adentro del editor; el guion de la grabación ya no se
// pide acá. Los tests de esas tres cosas se reescribieron y se re-probaron con el mismo arnés (este
// archivo, base 24/0): el ✦ que no abre el panel → 23/1; la cabecera sin el número → 22/2; la cabecera
// sin el ✦ → 23/1. Lo demás de la tanda, en tests/whatsapp-sexta-tanda.test.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  EditorMensajeWhatsApp, BotonMakoWhatsApp, CabeceraWhatsApp, mismoPaso, placeholderDe, partesDeLaBarra, enviarALista, enviarUnico, makoPosible, adaptable,
  claveDeTarjeta, alternarPanelMako, ALTO_MIN_CHAT, datosDelLead, arbolDeVariables,
  type EditorMensajeWhatsAppProps,
} from '../app/automations/EditorMensajeWhatsApp';
import { datosOfrecidos } from '../lib/variables-aviso';
import { esVariableConocida } from '../lib/template-vars';
import { pasoSinAdjunto, pasoAMedia, pasoAVozDesde, pasoAVoz, cambiosDePaso } from '../lib/guion-audio';
import type { PasoSecuenciaDto, AudioSetting } from '../app/automations/ChatAgentApp';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const EDITOR = sinComentarios(leer('app/automations/EditorMensajeWhatsApp.tsx'));

const paso = (p: Partial<PasoSecuenciaDto> = {}): PasoSecuenciaDto => ({
  orden: 1, canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo: 'Hola, ¿cómo vas?', template_wa: null, proveedor: 'no_oficial', ...p,
});
const audio: AudioSetting = { id: 7, titulo: 'Bienvenida', media_mime: 'audio/mpeg', duracion_s: 42, transcript: 'Hola, soy yo', url: 'https://x/a.mp3' };
const dibujar = (p: Partial<EditorMensajeWhatsAppProps>) => renderToStaticMarkup(createElement(EditorMensajeWhatsApp, {
  paso: paso(), onChange: () => {}, audios: [audio], adjuntos: [], ...p,
}));

// ── NO publica ───────────────────────────────────────────────────────────────────────────────

test('el editor no publica: no le habla a la ruta de las secuencias ni hace PATCH', () => {
  assert.doesNotMatch(EDITOR, /\/api\/whatsapp\/secuencias|\/api\/chat-agent\/secuencias/, 'el editor no guarda la secuencia: eso es «Publicar»');
  assert.doesNotMatch(EDITOR, /method: 'PATCH'|setAudioDePaso/);
  // Lo único que escribe: la biblioteca de audios y la de archivos. (El guion de «✦ guion» salió con
  // la sexta tanda: lo propone el panel de MaKo, MakoRedacta.tsx, que tampoco guarda nada.)
  const rutas = [...EDITOR.matchAll(/fetch\(([^,)]+)/g)].map((m) => m[1]!.trim()).sort();
  assert.deepEqual(rutas, ["'/api/chat-agent/adjuntos'", "'/api/chat-agent/adjuntos'", "'/api/chat-agent/audios'"].sort());
  // El número de CADA mensaje lo guarda quien monta la cabecera (un cambio local del paso).
  assert.match(EDITOR, /<SalidaWhatsApp actual=\{actual\} explicita onElegir=\{\(l\) => \{ if \(l\) onLinea\(l\); \}\}/);
});

test('la nota de voz se manda con la ➤ (ya escuchada), sube a la biblioteca y se suma al chat, en local', () => {
  // Décima tanda (WhatsApp 3): `usarAudio` recibe además a dónde iba y si es la salida del editor; lo de
  // después (el audio que vuelve, la salida) va en tests/decima-tanda-whatsapp.test.ts.
  const usar = EDITOR.slice(EDITOR.indexOf('async function usarAudio(blob: Blob, secs: number,'), EDITOR.indexOf('function devolverVoz('));
  assert.ok(usar.length > 200 && usar.length < 3000, `no encontré usarAudio (${usar.length})`);
  assert.match(usar, /fetch\('\/api\/chat-agent\/audios'/);
  assert.match(usar, /if \(!mismoPaso\(pasoVivo\.current, deQuien\)\) return;/, 'el paso cambia sólo si sigue siendo el mismo');
  assert.match(usar, /enviarALista\(partesDe\(pasoVivo\.current\), \[nueva\], dondeIba\)/);
  assert.match(EDITOR, /onAudio=\{permiteAudio \? \(blob, secs\) => usarAudio\(blob, secs\) : undefined\}/, 'lo que llega del composer es lo que la ➤ mandó');
  assert.doesNotMatch(EDITOR, /audioPendiente=\{grabado/, 'volvió el «Usar» de un audio recién grabado: ahora se escucha en la barra');
  assert.match(EDITOR, /onChange\(cambiosDePaso\(antes, despues\)\)/, 'un cambio LOCAL: el patch de lo que cambió');
});

test('lo que termina después de un await se aplica sólo al MISMO paso', () => {
  assert.equal(mismoPaso({ id: 'n1', orden: 1 }, { id: 'n1', orden: 1 }), true);
  assert.equal(mismoPaso({ id: 'n1', orden: 1 }, { id: 'n2', orden: 1 }), false, 'otro nodo con el mismo orden no es el mismo mensaje');
  assert.equal(mismoPaso({ orden: 1 }, { orden: 2 }), false);
});

// ── «Enviar»: la barra es un borrador ────────────────────────────────────────────────────────

test('lo que la barra MANDA: el archivo con su pie, el audio y su texto como DOS partes, o el texto', () => {
  assert.deepEqual(partesDeLaBarra('Hola', null), [{ tipo: 'texto', cuerpo: 'Hola' }]);
  assert.deepEqual(partesDeLaBarra('   ', null), [], 'una barra vacía no manda nada');
  assert.deepEqual(partesDeLaBarra('Los precios', { tipo: 'media', media_id: 3 }), [{ tipo: 'media', media_id: 3, cuerpo: 'Los precios' }]);
  assert.deepEqual(partesDeLaBarra('', { tipo: 'media', media_id: 3 }), [{ tipo: 'media', media_id: 3 }]);
  // WhatsApp no tiene pie de audio: el texto sale DESPUÉS, como otro mensaje.
  assert.deepEqual(partesDeLaBarra('Link', { tipo: 'audio', audio_id: 7 }), [{ tipo: 'audio', audio_id: 7 }, { tipo: 'texto', cuerpo: 'Link' }]);
});

test('«Enviar» suma al final; editando, la burbuja vuelve a SU lugar', () => {
  const a = { tipo: 'texto' as const, cuerpo: 'a' };
  const b = { tipo: 'texto' as const, cuerpo: 'b' };
  const n = { tipo: 'texto' as const, cuerpo: 'nuevo' };
  assert.deepEqual(enviarALista([a, b], [n], null), [a, b, n]);
  assert.deepEqual(enviarALista([a, b], [n], 0), [n, b], 'la que se editaba no se va al final');
  assert.deepEqual(enviarALista([a, b], [n], 9), [a, b, n], 'un índice que ya no está suma al final');
});

// ⚠️ CAMBIÓ EL 10/10/2026 (restos de versiones anteriores): el de UN mensaje (el recordatorio, «MaKo en
// WhatsApp», la vía oficial) era `modo="editar"` —la barra ERA el mensaje— y el texto se dibujaba dos
// veces, en la burbuja y en la barra (la captura del recordatorio en el ws9 de Martín). Ahora es la misma
// interfaz que el de varias partes. Probado rompiéndolo con el arnés del scratchpad (base 28 / 0):
//   · el de un mensaje de vuelta en `modo="editar"` con `valor={paso.cuerpo ?? ''}` → 2 fallos;
//   · `enviarUnico` pisando el mensaje sin estar editando                         → 1 fallo;
//   · la barra de un mensaje recordada por tarjeta (`recordarBarra = true`)       → 1 fallo;
//   · la burbuja de un mensaje sin su ✏️ (la burbuja sola de antes)               → 1 fallo.
test('la barra es un BORRADOR (modo `enviar`) con varias partes Y con un solo mensaje', () => {
  const varias = EDITOR.slice(EDITOR.indexOf('const composerNodo = varias ?'), EDITOR.indexOf('const usarPropuesta ='));
  assert.ok(varias.length > 200, 'no encontré el composer');
  const [conPartes, unaSola] = varias.split(') : (');
  assert.match(conPartes, /modo="enviar"/);
  assert.match(conPartes, /onEnviar=\{enviar\}/);
  assert.match(conPartes, /valor=\{barra\}/, 'la barra NO es el mensaje: lo enviado no se queda escrito');
  assert.match(unaSola, /modo="enviar"/, 'el de un mensaje volvió a tener la barra como el mensaje (el texto dos veces)');
  assert.match(unaSola, /valor=\{barra\}/);
  assert.match(unaSola, /onEnviar=\{enviarElUnico\}/);
  assert.match(EDITOR, /const varias = permiteAudio \|\| permiteAdjuntos;/, 'varias partes sólo por el no oficial');
  assert.match(EDITOR, /limpiarBarra\(\);\s*\};/, '«Enviar» vacía la barra');
});

test('«Enviar» con un solo mensaje: editando lo reemplaza; sin editar y con uno escrito, no lo pisa', () => {
  assert.deepEqual(enviarUnico('', 'Hola', false), { cuerpo: 'Hola' }, 'sin mensaje, la barra es el mensaje');
  assert.deepEqual(enviarUnico('Viejo', 'Nuevo', true), { cuerpo: 'Nuevo' }, 'editando, reemplaza');
  assert.equal(enviarUnico('Viejo', 'Nuevo', false), 'lleno', 'pisaría el mensaje sin que nadie lo pidiera');
  assert.equal(enviarUnico('Viejo', '   ', true), 'vacio', 'una barra vacía no manda nada');
});

test('el de un solo mensaje: la burbuja con ✏️ y 🗑, y la barra VACÍA (el texto no se dibuja dos veces)', () => {
  const html = dibujar({ paso: paso({ cuerpo: 'Te recuerdo la reunión de mañana', proveedor: 'oficial' }), permiteAudio: false, permiteAdjuntos: false });
  assert.equal(html.split('Te recuerdo la reunión de mañana').length - 1, 1, 'el texto aparece en la burbuja Y en la barra');
  assert.ok(html.includes('aria-label="Editar el mensaje 1"'), 'falta el ✏️ de la burbuja');
  assert.ok(html.includes('aria-label="Borrar el mensaje 1"'), 'falta la papelera de la burbuja');
  const vacio = dibujar({ paso: paso({ cuerpo: '' }), permiteAudio: false, permiteAdjuntos: false });
  assert.ok(vacio.includes('Sin escribir') && !vacio.includes('aria-label="Editar el mensaje 1"'));
  // Lo tipeado en la barra de UN mensaje no se recuerda por tarjeta: «MaKo en WhatsApp» se monta con un
  // paso sin identidad propia (`mako-grupo`), y lo de un aviso aparecía en la barra del siguiente.
  assert.match(EDITOR, /const recordarBarra = varias;/);
  assert.match(EDITOR, /useState\(\(\) => \(recordarBarra \? borradores\.get\(claveBorrador\) \?\? '' : ''\)\)/);
});

test('cada burbuja tiene ✏️ y una papelera VISIBLE (roja); borrar ofrece «Deshacer» con el toast de la casa', () => {
  const html = dibujar({ paso: paso({ cuerpo: 'Hola', partes: [{ tipo: 'texto', cuerpo: 'Hola' }, { tipo: 'texto', cuerpo: 'Link' }] }) });
  for (const n of [1, 2]) {
    assert.ok(html.includes(`aria-label="Editar el mensaje ${n}"`), `falta el lápiz del ${n}`);
    assert.ok(html.includes(`aria-label="Borrar el mensaje ${n}"`), `falta la papelera del ${n}`);
  }
  const papelera = /<button[^>]*aria-label="Borrar el mensaje 1"[^>]*style="([^"]*)"/.exec(html)?.[1] ?? '';
  assert.match(papelera, /color:var\(--bad\)/, 'la papelera no se notaba');
  assert.match(EDITOR, /show\('Mensaje borrado', \(\) => \{ if \(mismoPaso\(pasoVivo\.current, deQuien\)\) aplicarPartes\(antes\); \}\)/);
  assert.match(EDITOR, /<Toast state=\{toast\} onClose=\{clear\} \/>/);
});

test('lo guardado antes se ve como sus burbujas: un audio con pie son dos, y SIN la transcripción', () => {
  const html = dibujar({ paso: paso({ tipo: 'audio', audio_id: 7, cuerpo: 'Link: https://x.y' }) });
  assert.ok(html.includes('<audio'));
  assert.ok(!html.includes('Dice:'), 'la transcripción salió de la burbuja (punto 15)');
  assert.ok(html.includes('Link: https://x.y'));
  assert.ok(html.includes('aria-label="Borrar el mensaje 2"'), 'el pie es su propia burbuja');
  assert.equal(placeholderDe('texto', undefined, 'media'), 'Agrega un texto (opcional)');
  assert.equal(placeholderDe('texto', undefined, 'audio'), 'Texto después del audio');
  assert.equal(placeholderDe('ia'), 'Qué tiene que lograr');
  assert.equal(placeholderDe(undefined, 'Tu mensaje'), 'Tu mensaje');
});

test('al pasar a algo que no es UN texto, las variantes se sueltan EXPLÍCITAS (costuras-1)', () => {
  assert.match(EDITOR, /\.\.\.\(esUnTexto\(lista\) \? \{\} : \{ variantes: \[\] \}\)/);
});

// ── Las vueltas sin pérdida de lib/guion-audio.ts (las usa el wizard) ──────────────────────────

test('la ✕ del audio vuelve a texto con el guion y el pie juntos: no se pierde nada', () => {
  const voz = pasoAVoz(paso({ cuerpo: 'Te cuento cómo sigue' }), 7);
  const conPie = { ...voz, cuerpo: 'Link: https://x.y' };
  const texto = pasoSinAdjunto(conPie);
  assert.equal(texto.tipo, 'texto');
  assert.equal(texto.audio_id, null);
  assert.equal(texto.cuerpo, 'Te cuento cómo sigue\n\nLink: https://x.y');
});

test('la ✕ del archivo vuelve a texto y el caption queda como el texto', () => {
  const media = pasoAMedia(paso({ cuerpo: 'Te paso los precios' }), 3);
  assert.equal(media.tipo, 'media');
  assert.equal(media.media_id, 3);
  const texto = pasoSinAdjunto(media);
  assert.equal(texto.tipo, 'texto');
  assert.equal(texto.media_id, null);
  assert.equal(texto.cuerpo, 'Te paso los precios');
});

test('a archivo desde un audio: el guion y el pie son el caption, y el audio se suelta', () => {
  const voz = { ...pasoAVoz(paso({ cuerpo: 'Escucha esto' }), 7), cuerpo: 'pie' };
  const media = pasoAMedia(voz, 4);
  assert.equal(media.tipo, 'media');
  assert.equal(media.audio_id, null, 'un paso con archivo y audio a la vez: el motor no sabría cuál mandar');
  assert.equal(media.proveedor, 'no_oficial');
  assert.equal(media.cuerpo, 'Escucha esto\n\npie');
});

test('a voz desde un archivo: el archivo se suelta y el caption pasa a ser el guion', () => {
  const voz = pasoAVozDesde(pasoAMedia(paso({ cuerpo: 'Mira el catálogo' }), 4), 7);
  assert.equal(voz.tipo, 'audio');
  assert.equal(voz.audio_id, 7);
  assert.equal(voz.media_id, null);
  assert.equal((voz as { guion?: string }).guion, 'Mira el catálogo');
});

test('un paso que pasa a audio o a archivo SUELTA sus variantes, y el patch lo dice explícito', () => {
  const conVar = paso({ cuerpo: 'Te paso los precios', variantes: ['Mira los precios', 'Aquí van los precios'] });
  assert.deepEqual(pasoAMedia(conVar, 3).variantes, [], 'el motor sortearía una variante del texto como caption');
  assert.deepEqual(pasoAVoz(conVar, 7).variantes, []);
  assert.deepEqual(pasoAVozDesde(pasoAMedia(conVar, 3), 7).variantes, []);
  assert.deepEqual(pasoAVoz(paso({ tipo: 'audio', audio_id: 7, cuerpo: '', variantes: ['x'] }), 9).variantes, []);
  assert.deepEqual(cambiosDePaso(conVar, pasoAMedia(conVar, 3)).variantes, []);
  assert.deepEqual(pasoSinAdjunto(pasoAMedia(conVar, 3)).variantes, []);
  assert.equal(pasoSinAdjunto(pasoAMedia(conVar, 3)).cuerpo, 'Te paso los precios', 'lo escrito sí vuelve');
});

test('el patch lleva sólo lo que cambió, y lo que se va viaja como null', () => {
  const antes = paso({ tipo: 'media', media_id: 3, cuerpo: 'x' });
  assert.deepEqual(cambiosDePaso(antes, pasoSinAdjunto(antes)), { tipo: 'texto', media_id: null });
  assert.deepEqual(cambiosDePaso(antes, antes), {});
});

// ── Lo que se dibuja ─────────────────────────────────────────────────────────────────────────

test('el ✦ va en la cabecera; «adaptarlo a cada persona» sólo con UN texto; «↻ N» con variantes; mic y clip', () => {
  // Sexta tanda: el editor no dibuja su ✦ (lo dibuja la cabecera, `CabeceraWhatsApp`).
  assert.ok(!dibujar({ permiteIA: true }).includes('✦ MaKo'));
  assert.equal(adaptable(paso(), true), true);
  assert.equal(adaptable(paso({ tipo: 'audio', audio_id: 7, cuerpo: '' }), true), false, 'el motor sólo reescribe UN texto');
  assert.equal(adaptable(paso({ partes: [{ tipo: 'texto', cuerpo: 'a' }, { tipo: 'texto', cuerpo: 'b' }], cuerpo: 'a' }), true), false,
    'con varias partes no hay UN texto que reescribir');
  assert.equal(adaptable(paso({ tipo: 'audio', audio_id: 7 }), false), true, 'en el oficial la barra ES el texto');
  assert.ok(dibujar({ paso: paso({ variantes: ['a', 'b'] }) }).includes('↻ 2'));
  assert.ok(!dibujar({}).includes('↻'));
  const sinNada = dibujar({ permiteAudio: false, permiteAdjuntos: false });
  assert.ok(!sinNada.includes('Grabar nota de voz'), 'el recordatorio y el oficial no graban');
  assert.ok(!sinNada.includes('Adjuntar archivo'));
  const conTodo = dibujar({});
  assert.ok(conTodo.includes('Grabar nota de voz') && conTodo.includes('Adjuntar archivo'));
});

test('«↻ N» sólo en un mensaje de texto: ni en un audio ni en un archivo (costuras-1)', () => {
  const vs = ['Mira los precios', 'Aquí van los precios'];
  assert.ok(dibujar({ paso: paso({ variantes: vs }) }).includes('↻ 2'), 'el texto sigue mostrándolas');
  assert.ok(!dibujar({ paso: paso({ tipo: 'audio', audio_id: 7, cuerpo: '', variantes: vs }) }).includes('↻'));
  assert.ok(!dibujar({ paso: paso({ tipo: 'media', media_id: 3, cuerpo: 'Te dejo la info', variantes: vs }) }).includes('↻'));
});

test('«Revisar antes de enviar» ya no se dibuja, aunque el lienzo pase las props, y el editor no escribe `revisar`', () => {
  for (const p of [{}, { mostrarRevisar: true, revisarHeredado: true }, { mostrarRevisar: true, paso: paso({ revisar: true }) }]) {
    const html = dibujar(p);
    assert.ok(!html.includes('Revisar antes de enviar'), 'el interruptor volvió');
    assert.ok(!/type="checkbox"/.test(html), 'una casilla volvió');
  }
  assert.doesNotMatch(EDITOR, /revisar\s*:|Checkbox|revisarHeredado\s*\?\?|paso\.revisar/, 'el editor no lee ni escribe `revisar`');
});

test('`{{negocio}}` se resuelve con la función del MOTOR; lo demás queda como dato', () => {
  const html = dibujar({ negocio: 'Inmobiliaria del Valle', paso: paso({ cuerpo: 'Hola {{nombre}}, te escribo de {{negocio}}' }) });
  assert.ok(html.includes('Inmobiliaria del Valle'));
  assert.ok(html.includes('{{nombre}}'), 'el nombre lo pone el motor para cada lead');
  assert.match(EDITOR, /const conNegocio = \(t: string\) => aplicarVariables\(t, negocio\?\.trim\(\) \? \{ negocio: negocio\.trim\(\) \} : \{\}\)/);
  assert.doesNotMatch(EDITOR, /\.replace\(\/\\\{\\\{/, 'un replace propio: la pantalla y el envío dejarían de decir lo mismo');
});

test('sin rótulos encima del campo: el placeholder alcanza (punto 5 del pedido)', () => {
  assert.doesNotMatch(EDITOR, /Qué tiene que decir|El mensaje<\/label>|<label/);
});

test('el número de salida es de CADA mensaje y va en la cabecera, al lado del logo; el editor no lo repite', () => {
  // Sexta tanda (WhatsApp 2): «El número de WhatsApp, debería estar al lado del logo de WhatsApp...».
  for (const p of [{}, { linea: { actual: null, onElegir: () => {} } }]) {
    const html = dibujar(p);
    assert.ok(!html.includes('Número de WhatsApp por el que sale'), 'el editor volvió a dibujar el número');
    assert.ok(!html.includes('Toda la automatización'));
  }
  const cab = renderToStaticMarkup(createElement(CabeceraWhatsApp, { paso: paso(), lineaAutomatizacion: null, onLinea: () => {} }));
  assert.ok(cab.includes('aria-label="Número de WhatsApp por el que sale este mensaje"'), 'la cabecera no lleva el número');
  assert.ok(cab.indexOf('<svg') < cab.indexOf('Número de WhatsApp'), 'el logo va antes del número');
  assert.ok(!cab.includes('>WHATSAPP<') && !cab.includes('Toda la automatización'), 'la palabra «WhatsApp» se reemplaza por el número');
  assert.ok(cab.includes('aria-label="Que MaKo te ayude a escribirlo"'), 'el ✦ va al lado del número');
  assert.ok(!renderToStaticMarkup(createElement(CabeceraWhatsApp, { paso: paso(), lineaAutomatizacion: null, onLinea: () => {}, conMako: false })).includes('Que MaKo te ayude'));
});

// ── UNA columna, como un teléfono, y NADA debajo de la barra ─────────────────────────────────

// ⚠️ CUARTA TANDA, PUNTO 15 (09/10/2026, al terminarlo): «{ }» pasó de la fila de arriba A LA BARRA, al
// lado del clip («la opción de "{}" para insertar dato, debería estar al lado del botón de adjuntar
// archivo»), con la ranura `trasClip` de ComposerWhatsApp. «✦ MaKo» sigue arriba.
test('una sola columna: el chat, y la barra abajo de todo con «{ }» al lado del clip', () => {
  for (const disposicion of [undefined, 'columna', 'fila'] as const) {
    const html = dibujar({ disposicion, permiteIA: true });
    const chat = html.indexOf('data-chat="true"');
    const barra = html.indexOf('data-barra="true"');
    assert.ok(chat > 0 && barra > chat, `${disposicion}: el chat va ARRIBA de la barra`);
    const enChat = html.slice(chat, barra);
    assert.ok(enChat.includes('Hola, ¿cómo vas?'), 'la burbuja vive en el chat');
    assert.ok(!enChat.includes('placeholder='), 'la barra no se mete en el chat');
    const arriba = html.slice(0, chat);
    // Sexta tanda: el ✦ y el número van en la CABECERA del panel; arriba del chat no queda nada.
    assert.ok(!arriba.includes('✦ MaKo') && !arriba.includes('<button'), `${disposicion}: quedó algo arriba del chat`);
    assert.ok(!arriba.includes('Insertar un dato'), `${disposicion}: «{ }» quedó arriba`);
    const abajo = html.slice(barra);
    for (const t of ['placeholder="Escribe un mensaje"', 'Grabar nota de voz', 'Adjuntar archivo', 'aria-label="Insertar un dato"']) assert.ok(abajo.includes(t), `${disposicion}: falta ${t} en la barra`);
    // «{ }» AL LADO del clip: después del clip y antes del campo, en la MISMA fila.
    const iClip = abajo.indexOf('aria-label="Adjuntar archivo"');
    const iDatos = abajo.indexOf('aria-label="Insertar un dato"');
    const iCampo = abajo.indexOf('<textarea');
    assert.ok(iClip < iDatos && iDatos < iCampo, `${disposicion}: «{ }» no está entre el clip y el campo`);
    assert.doesNotMatch(abajo.slice(iClip, iCampo), /<div/, '«{ }» se fue a otra fila');
    // «no quiero botones ni nada abajo de donde se escriben mensajes».
    const despuesDelCampo = abajo.slice(abajo.indexOf('</textarea>'));
    for (const t of ['Insertar un dato', '✦ MaKo', '↻']) assert.ok(!despuesDelCampo.includes(t), `${disposicion}: ${t} quedó debajo de la barra`);
    assert.ok(!html.includes('mk-wa-fila') && !html.includes('<style') && !html.includes('container-type'), 'volvió algo de la fila');
  }
  assert.equal(dibujar({ disposicion: 'fila' }), dibujar({}), 'la `fila` no cambia ni un píxel');
  // En el oficial y el recordatorio (sin clip) «{ }» también va en la barra, al lado del emoji.
  const sinClip = dibujar({ permiteAudio: false, permiteAdjuntos: false });
  assert.ok(sinClip.indexOf('aria-label="Insertar un dato"') > sinClip.indexOf('data-barra="true"'));
});

test('el ✦ de la cabecera abre el panel de MaKo ADENTRO del editor de ESA tarjeta, y lo cierra', () => {
  // Sin nada que mostrar arriba (ni «↻ N»), no hay fila vacía.
  const html = dibujar({ permiteIA: true });
  assert.ok(html.indexOf('data-chat="true"') < 400, 'quedó una fila vacía arriba del chat');
  const clave = claveDeTarjeta(null, paso());
  const boton = () => renderToStaticMarkup(createElement(BotonMakoWhatsApp, { clave }));
  assert.match(boton(), /aria-pressed="false"/);
  assert.ok(!dibujar({ permiteIA: true }).includes('data-mako-redacta'));
  try {
    alternarPanelMako(clave, true);
    assert.match(boton(), /aria-pressed="true"/);
    const abierto = dibujar({ permiteIA: true });
    assert.ok(abierto.includes('data-mako-redacta'), 'el ✦ no abre el panel');
    assert.ok(abierto.includes('¿Qué quieres lograr con este mensaje?'));
    assert.ok(abierto.includes('aria-label="Dictar"'), 'sin el dictado de «Crear con IA»');
    // La barra queda MONTADA (escondida): «Grabar con este guion» graba desde el mismo clic.
    assert.match(abierto, /<div style="display:none;flex-direction:column/);
    assert.ok(abierto.includes('data-barra="true"'));
    // Otra tarjeta no se entera, y sin `permiteIA` (el oficial) no hay panel.
    assert.ok(!dibujar({ permiteIA: true, paso: paso({ id: 'otra' }) }).includes('data-mako-redacta'));
    assert.ok(!dibujar({ permiteIA: false }).includes('data-mako-redacta'));
    // «Adaptarlo a cada persona» sale sólo con UN texto.
    assert.ok(abierto.includes('Adaptarlo a cada persona'));
    assert.ok(!dibujar({ permiteIA: true, paso: paso({ tipo: 'audio', audio_id: 7, cuerpo: '' }) }).includes('Adaptarlo a cada persona'));
  } finally { alternarPanelMako(clave, false); }
  assert.ok(!dibujar({ permiteIA: true }).includes('data-mako-redacta'));
  assert.equal(makoPosible(paso(), true, true), true);
  assert.equal(makoPosible(paso({ tipo: 'audio', audio_id: 7, cuerpo: '' }), true, true), true, 'un audio también se escribe con MaKo');
  assert.equal(makoPosible(paso(), false, true), false);
});

test('el chat LLENA el alto que haya y es lo único que se achica; nada de height:100%', () => {
  const html = dibujar({});
  const raiz = /^<div style="([^"]*)"/.exec(html)?.[1] ?? '';
  assert.match(raiz, /flex:1 1 auto/, 'la raíz estira en un panel de alto fijo');
  assert.match(raiz, /min-height:0/);
  const chat = /<div data-chat="true" style="([^"]*)"/.exec(html)?.[1] ?? '';
  assert.match(chat, /flex:1 1 auto/, 'el chat se queda con lo que sobra');
  assert.match(chat, new RegExp(`min-height:${ALTO_MIN_CHAT}px`), 'el chat no se aplasta por debajo de una burbuja');
  assert.match(chat, /overflow-y:auto/, 'un mensaje largo scrollea adentro del chat');
  assert.doesNotMatch(chat, /max-height/, 'el tope de 260 de antes dejaba el chat chico en un panel alto');
  const barra = /<div data-barra="true" style="([^"]*)"/.exec(html)?.[1] ?? '';
  assert.match(barra, /flex:none/, 'la barra no se achica: en un panel bajo se recortaba la de grabar');
  assert.doesNotMatch(EDITOR, /height:\s*'100%'|height: 100%/, 'contra un alto indefinido Safari da cero (AGENTS.md)');
});

// ── El «{ }» (sexta tanda, segunda pasada, parte «datos») ─────────────────────────────────────
// WhatsApp 10: «Faltan datos que se pueden poner en el botón de "{}"... Siempre recuerda los
// desplegables tipo arbol y con los íconos al lado... Y esto para todos los lugares donde usamos el
// botón de {}, siempre lo mismo en todos lados». El árbol es el de la casa (SelectorDatos), y ofrece
// sólo lo que el motor resuelve POR ESE CAMINO.
//
// PROBADO ROMPIÉNDOLO (09/10/2026, arnés del scratchpad w2-datos, restaurado de memoria; base de este
// archivo en verde):
//   X1. `datosDelLead` devolviendo el árbol entero también sin `todos` → 1 fallo (el oficial).
//   X2. el editor ignorando `variables` (el recordatorio) y usando el del motor → 1 fallo.
//   X3. el editor con `datos` sin ganarle a `variables` → 1 fallo.
//   X4. el popover con `MenuWA` de vuelta (sin el árbol) → 2 fallos (éste y el de texto plano de
//       tests/variables-aviso).

test('el «{ }»: por el no oficial, el árbol entero del lead; por el oficial y lo social, sólo los datos de siempre', () => {
  const claves = (g: ReturnType<typeof datosDelLead>) => g.flatMap((x) => x.items.map((i) => i.key));
  assert.deepEqual(claves(datosDelLead(true)), claves(datosOfrecidos({ destino: 'lead', conLead: true })));
  assert.ok(claves(datosDelLead(true)).length > 20, 'el árbol del no oficial tiene que ser el catálogo, no la lista de cinco');
  const basicos = claves(datosDelLead(false));
  assert.deepEqual(basicos, ['nombre', 'nombre_completo', 'apellido', 'empresa'], 'la plantilla de Meta registra sólo éstos');
  assert.ok(basicos.every(esVariableConocida));
  assert.ok(!basicos.includes('negocio'), '«Tu negocio» volvió al «{ }» (WhatsApp 10: «eliminalo»)');
  assert.ok(datosDelLead(false).every((g) => g.items.length > 0), 'una rama vacía promete algo que no está');
});

test('el «{ }» de quien pasa SUS variables (el recordatorio) es una rama con ésas, ni una más', () => {
  const g = arbolDeVariables([{ key: 'cuando', label: 'Cuándo', ejemplo: 'mañana' }, { key: 'hora', label: 'Hora' }]);
  assert.equal(g.length, 1);
  assert.deepEqual(g[0]!.items.map((i) => [i.key, i.label, i.ejemplo]), [['cuando', 'Cuándo', 'mañana'], ['hora', 'Hora', '{{hora}}']]);
  assert.deepEqual(arbolDeVariables([]), [], 'sin variables no hay rama (ni botón)');
  // Y el editor elige en ese orden: `datos` > `variables` > lo del motor.
  const elige = EDITOR.slice(EDITOR.indexOf('const grupos = useMemo('), EDITOR.indexOf('[datos, variables, varias],'));
  assert.match(elige, /datos \?\? \(variables \? arbolDeVariables\(variables\) : datosDelLead\(varias\)\)/);
  assert.match(EDITOR, /<ArbolDeDatos grupos=\{grupos\} onElegir=/, 'el popover del «{ }» no es el árbol de la casa');
  assert.doesNotMatch(EDITOR, /<MenuWA\b|\bVARIABLES_NEGOCIO\b|\bVARIABLES_LEAD\b/, 'volvió la lista plana del motor viejo');
  // El botón se dibuja en la barra (con datos), y sin datos no hay botón.
  assert.ok(dibujar({}).includes('aria-label="Insertar un dato"'));
  assert.ok(!dibujar({ variables: [] }).includes('aria-label="Insertar un dato"'), 'un «{ }» que abre un árbol vacío se lee roto');
});
