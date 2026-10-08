// =============================================================================
// El editor de un mensaje de WhatsApp: lo que hace y, sobre todo, lo que NO hace
// =============================================================================
// `app/chatbot/EditorMensajeWhatsApp.tsx` (pedido de Martín del 08/10/2026, punto 8): la burbuja
// como llega arriba, la barra de WhatsApp abajo, el mic al costado y el clip con la biblioteca.
// Lo que fija este test:
//   · USAR UN AUDIO NO PUBLICA. Antes, grabar o elegir un audio en el lienzo llamaba a
//     `setAudioDePaso`, que hacía PATCH de todos los pasos locales en el acto. El editor sólo
//     escribe la BIBLIOTECA y le pasa al lienzo un cambio local (`onChange`).
//   · la ✕ del chip vuelve a TEXTO sin perder lo escrito (`pasoSinAdjunto`), y las otras vueltas
//     (a archivo, a voz desde un archivo) tampoco pierden nada;
//   · lo que se dibuja según el paso (placeholder, ✦, «↻ N», «Revisar antes de enviar», mic y
//     clip según los permisos) y que `{{negocio}}` se resuelve con la función del MOTOR.
//
// Probado rompiéndolo (08/10/2026) con un arnés que rompe UNA cosa, corre este archivo y restaura
// de memoria: 8 roturas, 8 cazadas (13 tests):
//   1. `usarAudio` con un `fetch('/api/whatsapp/secuencias', { method: 'PATCH' })` → 1 fallo.
//   2. `pasoSinAdjunto` de un archivo con `cuerpo: ''` (perdía el caption) → 3.
//   3. `pasoSinAdjunto` de un audio sin `pasoATexto` (sólo `tipo: 'texto'`: perdía el guion) → 1.
//   4. `pasoAMedia` sin pasar por `pasoATexto` (el caption perdía el guion) → 1.
//   5. el ✦ dibujado también en un paso de audio → 1.
//   6. «Revisar antes de enviar» leyendo `paso.revisar ?? false` (sin lo heredado) → 1.
//   7. la vista previa con un replace propio de `{{negocio}}` en vez de `aplicarVariables` → 1.
//   8. `mismoPaso` comparando sólo `orden` → 1.
//
// costuras-1 (revisión del 08/10/2026), mismo arnés: 5 roturas, 5 cazadas (15 tests):
//   9. `pasoAMedia` sin `variantes: []` → 1 fallo.
//  10. `pasoAVoz` desde un texto sin `variantes: []` → 1.
//  11. `pasoAVoz` sobre un paso que ya era audio sin `variantes: []` → 1.
//  12. el editor leyendo `paso.variantes ?? []` en cualquier tipo («↻ N» en audio y archivo) → 1.
//  13. `pasoSinAdjunto` de un archivo devolviendo variantes viejas → 2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EditorMensajeWhatsApp, mismoPaso, placeholderDe, type EditorMensajeWhatsAppProps } from '../app/chatbot/EditorMensajeWhatsApp';
import { pasoSinAdjunto, pasoAMedia, pasoAVozDesde, pasoAVoz, cambiosDePaso } from '../lib/guion-audio';
import type { PasoSecuenciaDto, AudioSetting } from '../app/chatbot/ChatAgentApp';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const EDITOR = sinComentarios(leer('app/chatbot/EditorMensajeWhatsApp.tsx'));

const paso = (p: Partial<PasoSecuenciaDto> = {}): PasoSecuenciaDto => ({
  orden: 1, canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo: 'Hola, ¿cómo vas?', template_wa: null, proveedor: 'no_oficial', ...p,
});
const audio: AudioSetting = { id: 7, titulo: 'Bienvenida', media_mime: 'audio/mpeg', duracion_s: 42, transcript: 'Hola, soy yo', url: 'https://x/a.mp3' };
const dibujar = (p: Partial<EditorMensajeWhatsAppProps>) => renderToStaticMarkup(createElement(EditorMensajeWhatsApp, {
  paso: paso(), onChange: () => {}, audios: [audio], adjuntos: [], ...p,
}));

// ── Usar un audio NO publica ─────────────────────────────────────────────────────────────────

test('el editor no publica: no le habla a la ruta de las secuencias ni hace PATCH', () => {
  assert.doesNotMatch(EDITOR, /\/api\/whatsapp\/secuencias|\/api\/chat-agent\/secuencias/, 'el editor no guarda la secuencia: eso es «Publicar»');
  assert.doesNotMatch(EDITOR, /method: 'PATCH'|setAudioDePaso/);
  // Lo único que escribe: la biblioteca de audios, la de archivos y el guion (que no persiste).
  const rutas = [...EDITOR.matchAll(/fetch\(([^,)]+)/g)].map((m) => m[1]!.trim()).sort();
  assert.deepEqual(rutas, ["'/api/chat-agent/adjuntos'", "'/api/chat-agent/adjuntos'", "'/api/chat-agent/audios'", 'RUTA_GUION'].sort());
});

test('«Usar» sube el audio y le pasa al lienzo un cambio LOCAL con `pasoAVoz`', () => {
  const usar = EDITOR.slice(EDITOR.indexOf('async function usarAudio()'), EDITOR.indexOf('const base = guionParaLeer('));
  assert.ok(usar.length > 200 && usar.length < 2500, `no encontré usarAudio (${usar.length})`);
  assert.match(usar, /fetch\('\/api\/chat-agent\/audios'/);
  assert.match(usar, /if \(mismoPaso\(pasoVivo\.current, deQuien\)\) aplicar\(pasoAVozDesde\(pasoVivo\.current, audio\.id\)\)/,
    'el paso cambia sólo si sigue siendo el mismo, y por pasoAVoz (el texto se vuelve el guion)');
  assert.match(EDITOR, /const aplicar = \(despues: PasoSecuenciaDto\) => onChange\(cambiosDePaso\(pasoVivo\.current, despues\)\)/);
});

test('lo que termina después de un await se aplica sólo al MISMO paso', () => {
  assert.equal(mismoPaso({ id: 'n1', orden: 1 }, { id: 'n1', orden: 1 }), true);
  assert.equal(mismoPaso({ id: 'n1', orden: 1 }, { id: 'n2', orden: 1 }), false, 'otro nodo con el mismo orden no es el mismo mensaje');
  assert.equal(mismoPaso({ orden: 1 }, { orden: 2 }), false);
});

// ── Las vueltas sin pérdida ──────────────────────────────────────────────────────────────────

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

// costuras-1 (revisión del 08/10/2026): un texto con variantes al que se le adjuntaba un PDF las
// conservaba, y el motor las sorteaba como CAPTION: 3 de cada 4 leads recibían el archivo con el
// texto viejo debajo (y con el caption vacío, todos). «Probar» mostraba el bueno.
test('un paso que pasa a audio o a archivo SUELTA sus variantes, y el patch lo dice explícito', () => {
  const conVar = paso({ cuerpo: 'Te paso los precios', variantes: ['Mira los precios', 'Aquí van los precios'] });
  assert.deepEqual(pasoAMedia(conVar, 3).variantes, [], 'el motor sortearía una variante del texto como caption');
  assert.deepEqual(pasoAVoz(conVar, 7).variantes, []);
  assert.deepEqual(pasoAVozDesde(pasoAMedia(conVar, 3), 7).variantes, []);
  // Un audio que ya las arrastraba también las suelta al cambiarle el audio.
  assert.deepEqual(pasoAVoz(paso({ tipo: 'audio', audio_id: 7, cuerpo: '', variantes: ['x'] }), 9).variantes, []);
  // Viajan EXPLÍCITAS (`[]`, no ausentes): es lo que le dice al server «ya no tiene».
  assert.deepEqual(cambiosDePaso(conVar, pasoAMedia(conVar, 3)).variantes, []);
  // Y volver a texto no las resucita: eran del texto de antes, y el caption pudo cambiar.
  assert.deepEqual(pasoSinAdjunto(pasoAMedia(conVar, 3)).variantes, []);
  assert.equal(pasoSinAdjunto(pasoAMedia(conVar, 3)).cuerpo, 'Te paso los precios', 'lo escrito sí vuelve');
});

test('el patch lleva sólo lo que cambió, y lo que se va viaja como null', () => {
  const antes = paso({ tipo: 'media', media_id: 3, cuerpo: 'x' });
  assert.deepEqual(cambiosDePaso(antes, pasoSinAdjunto(antes)), { tipo: 'texto', media_id: null });
  assert.deepEqual(cambiosDePaso(antes, antes), {});
});

// ── Lo que se dibuja ─────────────────────────────────────────────────────────────────────────

test('un paso de audio: el reproductor arriba, su chip con ✕, y el campo es el pie', () => {
  const html = dibujar({ paso: paso({ tipo: 'audio', audio_id: 7, cuerpo: '' }) });
  assert.ok(html.includes('<audio'));
  assert.ok(html.includes('Dice: «Hola, soy yo»'));
  assert.ok(html.includes('aria-label="Quitar audio"'));
  assert.ok(html.includes('placeholder="Texto junto al audio"'));
  assert.equal(placeholderDe('media'), 'Agrega un texto (opcional)');
  assert.equal(placeholderDe('ia'), 'Qué tiene que lograr');
  assert.equal(placeholderDe(undefined, 'Tu mensaje'), 'Tu mensaje');
});

test('✦ sólo en texto y si se permite; «↻ N» con variantes; mic y clip según los permisos', () => {
  assert.ok(dibujar({ permiteIA: true }).includes('✦ MaKo'));
  assert.ok(!dibujar({ permiteIA: false }).includes('✦ MaKo'));
  assert.ok(!dibujar({ permiteIA: true, paso: paso({ tipo: 'audio', audio_id: 7 }) }).includes('✦ MaKo'), 'el motor sólo reescribe la rama de texto');
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
  assert.ok(!dibujar({ paso: paso({ tipo: 'audio', audio_id: 7, cuerpo: '', variantes: vs }) }).includes('↻'),
    'en un audio el campo es el pie: no hay texto que variar');
  assert.ok(!dibujar({ paso: paso({ tipo: 'media', media_id: 3, cuerpo: 'Te dejo la info', variantes: vs }) }).includes('↻'),
    'en un archivo el campo es el caption: mostrarlas invita a editar lo que el motor sorteaba debajo del PDF');
});

test('«Revisar antes de enviar»: ausente en el paso = lo que hereda de la secuencia', () => {
  const marcado = (html: string) => /<input[^>]*type="checkbox"[^>]*checked/.test(html);
  assert.ok(marcado(dibujar({ mostrarRevisar: true, revisarHeredado: true })), 'sin `revisar` en el paso vale lo de la secuencia');
  assert.ok(!marcado(dibujar({ mostrarRevisar: true, revisarHeredado: true, paso: paso({ revisar: false }) })));
  assert.ok(marcado(dibujar({ mostrarRevisar: true, revisarHeredado: false, paso: paso({ revisar: true }) })));
  assert.ok(!dibujar({}).includes('Revisar antes de enviar'));
});

test('`{{negocio}}` se resuelve con la función del MOTOR; lo demás queda como dato', () => {
  const html = dibujar({ negocio: 'Inmobiliaria del Valle', paso: paso({ cuerpo: 'Hola {{nombre}}, te escribo de {{negocio}}' }) });
  assert.ok(html.includes('Inmobiliaria del Valle'));
  assert.ok(html.includes('{{nombre}}'), 'el nombre lo pone el motor para cada lead');
  assert.match(EDITOR, /aplicarVariables\(paso\.cuerpo \?\? '', negocio\?\.trim\(\) \? \{ negocio: negocio\.trim\(\) \} : \{\}\)/);
  assert.doesNotMatch(EDITOR, /\.replace\(\/\\\{\\\{/, 'un replace propio: la pantalla y el envío dejarían de decir lo mismo');
});

test('sin rótulos encima del campo: el placeholder alcanza (punto 5 del pedido)', () => {
  assert.doesNotMatch(EDITOR, /Qué tiene que decir|El mensaje<\/label>|<label/);
});
