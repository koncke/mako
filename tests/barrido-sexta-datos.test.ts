// =============================================================================
// El barrido de la sexta tanda en los archivos de la parte «datos» (segunda pasada, 09/10/2026)
// =============================================================================
// Tres pedidos de Martín que valen «en TODOS lados» y que un arreglo en un archivo no cierra:
//   · General 9: «Cambia el botón de BORRAR con ese ícono de basura que no se ve... Esto en TODOS
//     lados. Y que siempre el ícono de borrar sea rojo.» → el tacho de la casa (app/_ui/BotonBorrar.tsx).
//   · TAG 1: «En lugar de "Poner" y "Sacar", se formal escribiendo siempre... "Agregar" y "Eliminar".
//     Revisa que no esté ese error en otro lado.»
//   · DELAY 2 y la respuesta del mismo día: las esperas se cumplen a la hora exacta y el horario de
//     envío es opcional (sin límite por defecto). Los textos que decían «15-23 UTC» o «ventana 9-21»
//     quedaron viejos.
//
// ⚠️ Lee FUENTE sin comentarios: la convención de la casa es explicar en el comentario lo que se sacó,
// y un guard de «esto NO está» se acusaría a sí mismo (AGENTS.md).
//
// PROBADO ROMPIÉNDOLO (arnés w2-datos/romper.mjs del scratchpad, restaurado de memoria, base en verde):
//   B1. `<Icon name="trash"` de vuelta en GrabadorAudioPaso                     → 1 fallo
//   B2. `IconTrash` de vuelta en composer-icons                                 → 1 fallo
//   B3. «Poner una etiqueta a» de vuelta en AccionesLoteLeads                   → 1 fallo
//   B4. «15-23 UTC» de vuelta en la landing (features.ts)                       → 1 fallo
//   B5. «Sacar» de vuelta en el `title` del ✕ del chip                          → 2 fallos (éste y el
//       ENCHUFE de tests/editor-etiqueta)
// Base de este archivo: 3 / 0. Restaurado: 3 / 0.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/** Los archivos de la parte «datos» que dibujan un «borrar». */
const CON_BORRAR = [
  'app/automations/EditorMensajeWhatsApp.tsx',
  'app/automations/EditorMensajeSocial.tsx',
  'app/automations/GrabadorAudioPaso.tsx',
  'app/automations/PasoAudioControl.tsx',
  'app/whatsapp/_shared/VoiceRecorder.tsx',
  'app/whatsapp/_shared/ComposerWhatsApp.tsx',
  'app/whatsapp/_shared/composer-icons.tsx',
  'app/crm/AccionesLoteLeads.tsx',
];

test('el tacho es UNO, el de la casa, y rojo: ni `IconTrash`, ni `Icon name="trash"`, ni un tacho dibujado a mano', () => {
  for (const f of CON_BORRAR) {
    const src = sinComentarios(leer(f));
    assert.doesNotMatch(src, /\bIconTrash\b/, `${f}: volvió el tacho del composer`);
    assert.doesNotMatch(src, /<Icon name="trash"/, `${f}: volvió el tacho gris de icons.tsx`);
    assert.doesNotMatch(src, /function IconoTacho\b/, `${f}: un tacho dibujado a mano`);
    assert.doesNotMatch(src, />\s*🗑/, `${f}: el emoji del tacho`);
  }
  // Y los que borran usan el de la casa.
  for (const f of ['app/automations/EditorMensajeWhatsApp.tsx', 'app/automations/EditorMensajeSocial.tsx', 'app/whatsapp/_shared/VoiceRecorder.tsx', 'app/crm/AccionesLoteLeads.tsx']) {
    assert.match(sinComentarios(leer(f)), /<IconoBorrar size=\{\d+\} \/>/, `${f} dejó de usar IconoBorrar`);
  }
  assert.match(sinComentarios(leer('app/automations/GrabadorAudioPaso.tsx')), /<BotonBorrar onClick=\{\(\) => void borrar\(\)\} title=\{`Borrar el audio de \$\{def\.titulo\}`\} \/>/);
});

test('«Agregar» y «Eliminar», nunca «Poner» ni «Sacar», en lo que se lee de una etiqueta', () => {
  const lote = sinComentarios(leer('app/crm/AccionesLoteLeads.tsx'));
  assert.match(lote, /ariaLabel=\{`Agregar una etiqueta a \$\{cuantos\}`\}/);
  const ficha = sinComentarios(leer('app/crm/lead-view/EtiquetasDelLead.tsx'));
  assert.match(ficha, /ariaLabel="Agregar una etiqueta"/);
  const chip = sinComentarios(leer('app/_components/etiquetas-cliente.tsx'));
  assert.match(chip, /aria-label=\{`Eliminar \$\{nombre\}`\} title="Eliminar"/);
  // En lo que se DIBUJA o se lee con el lector de pantalla (rótulos, títulos, placeholders).
  for (const [f, src] of [['AccionesLoteLeads', lote], ['EtiquetasDelLead', ficha], ['etiquetas-cliente', chip]] as const) {
    const leido = [...src.matchAll(/(?:ariaLabel|aria-label|title|placeholder|label)=(?:"([^"]*)"|\{`([^`]*)`\})/g)].map((m) => m[1] ?? m[2] ?? '');
    assert.ok(leido.length > 0, `${f}: el regex no encontró rótulos (quedó viejo)`);
    for (const t of leido) assert.doesNotMatch(t, /\b(Poner|Ponerle|Sacar|Sacarle)\b/, `${f}: «${t}»`);
  }
});

test('las opciones de los desplegables llevan su ícono del set, no un emoji pegado al nombre (general 10)', () => {
  // PROBADO ROMPIÉNDOLO (09/10/2026): devolverle «⏳ Delay» al ＋ de Notificaciones → 1 fallo (éste);
  // el «🎙» de vuelta en los audios guardados del paso → 1 fallo (éste). Restaurado → verde.
  const aviso = sinComentarios(leer('app/agencia/FlujoAviso.tsx'));
  const agregar = aviso.slice(aviso.indexOf('opcionesAgregar={['), aviso.indexOf(']}', aviso.indexOf('opcionesAgregar={[')));
  assert.ok(agregar.length > 0 && agregar.length < 900, `el recorte del ＋ mide ${agregar.length}`);
  const filas = agregar.match(/\{ value: '[a-z]+', label: '[^']*'[^}]*\}/g) ?? [];
  assert.equal(filas.length, 5, 'las cinco opciones del ＋');
  for (const f of filas) {
    assert.match(f, /icono: '[a-z]+'/, `sin ícono: ${f}`);
    assert.doesNotMatch(f, /label: '[^']*\p{Extended_Pictographic}/u, `un emoji en el nombre: ${f}`);
  }
  assert.match(aviso, /icono: ICONO_EVENTO\[e\.key\]/, 'los eventos del disparador sin ícono');
  const audio = sinComentarios(leer('app/automations/PasoAudioControl.tsx'));
  assert.doesNotMatch(audio, /🎙/);
  assert.match(audio, /label: a\.titulo, icono: 'audio'/);
  assert.match(sinComentarios(leer('app/automations/EditorMensajeWhatsApp.tsx')), /label: rotuloPausa\(x\), icono: 'cronometro'/);
});

test('los textos del horario dicen lo de ahora: esperas a la hora exacta, horario opcional', () => {
  const landing = sinComentarios(leer('app/vsl/_detalle/features.ts'));
  assert.doesNotMatch(landing, /15-23 UTC/, 'la landing dice que el motor corre de 15 a 23 UTC');
  assert.match(landing, /cada espera se cumple a la hora exacta/);
  assert.match(landing, /El horario de envío es opcional: sin límite por defecto\./);
  assert.doesNotMatch(sinComentarios(leer('app/admin/dev/pricing/modelo.ts')), /ventana 9-21/, 'el modelo de precios nombra la ventana del motor de antes');
});
