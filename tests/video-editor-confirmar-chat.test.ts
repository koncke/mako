// =============================================================================
// «sí, hazlo» escrito acepta la propuesta que espera, en el chat del Video Editor (9/11/2026)
// =============================================================================
// En producción, 28/10/2026 (Leandro, ws10): MaKo propuso los subtítulos, él escribió «si hazlo» y MaKo contestó «No
// entiendo qué querés hacer. "Si hazlo" es muy vago»: la IA del chat no ve la charla. Fija app/video-editor/_opencut/
// chat/confirmar.ts, que PanelChat.tsx usa antes de mandar nada a la IA:
//   · lo que dijeron los clientes y las formas de siempre del «sí» son una confirmación;
//   · un «sí» con un pedido adentro («sí, pero en amarillo») NO: va a la IA como un pedido nuevo;
//   · sólo acepta la propuesta del ÚLTIMO mensaje, y sólo si espera.
//
// PROBADO ROMPIÉNDOLO (9/11/2026, cada uno dio rojo y se volvió atrás):
//   · `every` → `some` en `esConfirmacion`: «sí, pero ponelo en amarillo» pasaba por confirmación (rojo el 2.º test);
//   · sin el chequeo de NUCLEO: «ya» y «lo» solos confirmaban (rojo el 2.º);
//   · `mensajes[mensajes.length - 1]` → `mensajes.findLast(m => m.de === "mako")`: aceptaba una tarjeta vieja con un
//     mensaje de la persona debajo (rojo el 3.º);
//   · sin `estado === "pendiente"`: un «sí» volvía a aplicar una propuesta ya aplicada (rojo el 3.º).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esConfirmacion, propuestaQueConfirma, type MensajeParaConfirmar } from '../app/video-editor/_opencut/chat/confirmar';

test('lo que escribieron los clientes y las formas del «sí» son una confirmación', () => {
  for (const t of ['si hazlo', 'Sí', 'sí, hazlo', 'Dale', 'dale hacelo', 'ok', 'Ok, va', 'aplícalo', 'Aplicalo porfa', 'perfecto, adelante',
    '¡Sí!', 'si por favor', 'de una', 'así está bien', 'listo', 'acepto', 'Sí, aplícalo ya']) {
    assert.equal(esConfirmacion(t), true, `«${t}» es un sí`);
  }
});

test('un «sí» con un pedido adentro, una negativa o algo suelto NO es una confirmación', () => {
  for (const t of ['sí, pero ponelo en amarillo', 'si y además ponele música', 'no', 'no, déjalo', 'ya', 'lo', 'entonces',
    'subtitulame el video', 'si hazlo en el segundo 10', 'dale pero más corto', '', '   ', 'sí sí sí sí sí sí sí sí']) {
    assert.equal(esConfirmacion(t), false, `«${t}» no es un sí suelto`);
  }
});

test('sólo acepta la propuesta del ÚLTIMO mensaje, y sólo si espera', () => {
  const pendiente: MensajeParaConfirmar = { id: 'p1', de: 'mako', estado: 'pendiente', propuesta: { operaciones: [] } };
  assert.equal(propuestaQueConfirma([{ id: 'y1', de: 'yo' }, pendiente])?.id, 'p1');
  // Con algo debajo de la tarjeta, el «sí» ya no le contesta a ella.
  assert.equal(propuestaQueConfirma([pendiente, { id: 'y2', de: 'yo' }]), null);
  assert.equal(propuestaQueConfirma([pendiente, { id: 'm2', de: 'mako' }]), null);
  // Aplicada, descartada o aplicándose: nada que aceptar.
  for (const estado of ['aplicada', 'descartada', 'aplicando', 'restaurada', 'sin-version']) {
    assert.equal(propuestaQueConfirma([{ ...pendiente, estado }]), null, estado);
  }
  // Una respuesta sin propuesta (una pregunta contestada): nada.
  assert.equal(propuestaQueConfirma([{ id: 'm3', de: 'mako', estado: 'pendiente' }]), null);
  assert.equal(propuestaQueConfirma([]), null);
});
