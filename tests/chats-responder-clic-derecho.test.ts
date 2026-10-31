// =============================================================================
// «Responder» del clic derecho en los chats con MaKo (P5): cada chat le pasa `onCitar` al hilo, dibuja la cita en la caja y la manda
// =============================================================================
// Roturas: un chat sin `onCitar` → su menú sólo trae Copiar, 1 fallo. Sin `arriba` → la cita no se ve, 1 fallo. Sin `con` → se
// ve pero no sale, 1 fallo. Sin `soltar` → la misma cita sale en el mensaje siguiente, 1 fallo.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { armarConCita, leerCita } from '../lib/centro-mensajes';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const CHATS = [
  'app/image-editor/mako/chat/PanelMakoIA.tsx',
  'app/video-editor/_opencut/chat/PanelChat.tsx',
  'app/dashboard/PanelEditarMako.tsx',
  'app/whatsapp/WhatsAppAdvisor.tsx',
  'app/crm/lead-view/MakoAnalystLead.tsx',
];

for (const r of CHATS) {
  test(`${r}: citar, verla en la caja, mandarla y soltarla`, () => {
    const s = leer(r);
    assert.match(s, /useCitaDelChat\(/);
    assert.match(s, /<HiloMako[\s\S]{0,500}onCitar=\{cita\.citar\}/, 'el hilo no ofrece Responder');
    assert.match(s, /arriba=\{cita\.arriba\}/, 'la cita no se ve en la caja');
    assert.match(s, /cita\.con\(/, 'la cita no sale con lo escrito');
    assert.match(s, /cita\.soltar\(\)/, 'la cita saldría también en el mensaje siguiente');
  });
}

test('lo que sale se lee como cita en el hilo', () => {
  const t = armarConCita({ de: 'MaKo', texto: 'Cambié el fondo.' }, 'hacelo más oscuro');
  assert.deepEqual(leerCita(t), { cita: { de: 'MaKo', texto: 'Cambié el fondo.' }, resto: 'hacelo más oscuro' });
  assert.equal(armarConCita(null, 'hola'), 'hola', 'sin cita, tal cual');
});

test('una cita no viaja a otra conversación', () => {
  const s = leer('app/_chat/useCitaDelChat.tsx');
  assert.match(s, /guardada\.clave === clave \? guardada\.cita : null/);
});
