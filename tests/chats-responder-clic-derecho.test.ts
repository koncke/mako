// =============================================================================
// «Responder» del clic derecho en los chats con MaKo (P5): cada chat le pasa `onCitar` al hilo, dibuja la cita en la caja y la manda
// =============================================================================
// Roturas: un chat sin `onCitar` → su menú sólo trae Copiar, 1 fallo. Sin `arriba` → la cita no se ve, 1 fallo. Sin `con` → se
// ve pero no sale, 1 fallo. Sin `soltar` → la misma cita sale en el mensaje siguiente, 1 fallo.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { armarConCita, leerCita, separarCita } from '../lib/centro-mensajes';

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
  const s = leer('app/_chat/useCita.ts');
  assert.match(s, /guardada\.clave === clave \? guardada\.cita : null/);
});

// Lo que encontró la revisión (30/10/2026).
test('las pantallas que cambian de conversación sin remontarse le pasan su clave', () => {
  assert.match(leer('app/whatsapp/WhatsAppAdvisor.tsx'), /useCitaDelChat\(grupo\.id\)/);
  assert.match(leer('app/dashboard/PanelEditarMako.tsx'), /useCitaDelChat\(hoja\.id\)/);
  assert.match(leer('app/crm/lead-view/MakoAnalystLead.tsx'), /useCitaDelChat\(leadId\)/);
});

test('la cita no le corta el final al mensaje: se descuenta del tope', () => {
  assert.match(leer('app/image-editor/mako/chat/PanelMakoIA.tsx'), /topeTexto=\{TOPES_CHAT_IMAGEN\.instruccion - cita\.reserva\}/);
  assert.match(leer('app/video-editor/_opencut/chat/PanelChat.tsx'), /topeTexto=\{TOPES_CHAT\.instruccion - cita\.reserva\}/);
  assert.match(leer('app/dashboard/PanelEditarMako.tsx'), /texto\.trim\(\)\.slice\(0, TOPE_PEDIDO_IA - cita\.reserva\)/);
});

test('el renglón citado no se interpreta como un pedido: se lee lo escrito y se vuelve a citar', () => {
  const t = armarConCita({ de: 'Tú', texto: 'Archiva la hoja Ventas' }, 'mejor no');
  const { pedido, conCita } = separarCita(t);
  assert.equal(pedido, 'mejor no');
  assert.equal(conCita('mejor no'), t);
  assert.equal(separarCita('hola').pedido, 'hola');
  assert.equal(separarCita('hola').conCita('hola'), 'hola');
  assert.equal(conCita(''), '', 'si nada queda para esta hoja, nada sale');
  for (const r of ['app/dashboard/PanelEditarMako.tsx', 'app/video-editor/_opencut/chat/PanelChat.tsx', 'app/web-generator/editor/paneles/PanelAgente.tsx']) {
    assert.match(leer(r), /separarCita\(/);
    assert.match(leer(r), /interpretacionDe\(ri?, lemos\)/);
  }
});

test('una cita con archivos y sin texto sale igual, y el hilo la lee antes de partir lo pegado', () => {
  const hook = leer('app/_chat/useCita.ts');
  assert.match(hook, /texto\.trim\(\) \|\| \(cita && conAdjuntos \? 'Mira lo que te adjunto\.' : ''\)/);
  const hilo = leer('app/_chat/HiloMako.tsx');
  assert.ok(hilo.indexOf('leerCita(crudo)') > 0 && hilo.indexOf('leerCita(crudo)') < hilo.indexOf('partirPegados(conCita'));
});

test('Offer y Soporte: Responder, sin meter la cita donde no va', () => {
  const offer = leer('app/offer/OfferApp.tsx');
  assert.match(offer, /useCitaDelChat\(sesion\?\.id \?\? null\)/);
  assert.match(offer, /texto: cita\.con\(t\), docs: \[\], fuente: linksDe\(t\)/, 'un link del mensaje citado no cuenta como uno nuevo');
  assert.match(offer, /if \(res === 'salio'\) \{ cita\.soltar\(\); return; \}/, 'si no salió, la cita sigue');
  assert.match(offer, /arriba: arranque\?\.manda \? undefined : cita\.arriba/, 'en el arranque se contesta SU pregunta');
  assert.match(leer('app/offer/ChatOffer.tsx'), /<HiloMako[\s\S]{0,300}onCitar=\{onCitar\}/);
  const soporte = leer('app/tickets/soporte/useSoporte.ts');
  assert.match(soporte, /useCita\(abierto \?\? null\)/);
  assert.match(soporte, /dicho \?\? conCita\(texto, archivos\.length > 0\)/);
  const piezas = leer('app/tickets/soporte/PiezasSoporte.tsx');
  assert.match(piezas, /onCitar=\{s\.citar\}/);
  assert.match(piezas, /hayClave\(s\.texto\) \? <AvisoClave \/> : s\.cita \?/);
});

// Automations (6/11/2026, el barrido de pendientes): el hilo vive en ChatMakoVista, y la cita en ChatMako. Roturas: sin `onCitar` en
// la vista → 1 fallo; los pedidos interpretados con la cita adentro (sin `separarCita`) → 1 fallo; soltar la cita aunque no salió → 1 fallo.
test('Automations: Responder en su chat, y el renglón citado no se interpreta como un pedido', () => {
  const vista = leer('app/automations/ChatMakoVista.tsx');
  assert.match(vista, /<HiloMako[\s\S]{0,400}onCitar=\{p\.onCitar\}/, 'el hilo no ofrece Responder');
  const chat = leer('app/automations/ChatMako.tsx');
  assert.match(chat, /const cita = useCitaDelChat\(p\.secuenciaId \?\? null\);/, 'la cita es de ESTA automatización');
  assert.match(chat, /adjuntos: adjuntosCaja, arriba: cita\.arriba,/, 'la cita no se ve en la caja');
  assert.match(chat, /onCitar=\{cita\.citar\}/);
  assert.match(chat, /await enviarTexto\(cita\.con\(escrito, adj\.length > 0\), 'barra', adj\);/, 'la cita no sale con lo escrito');
  assert.match(chat, /if \(r === true\) cita\.soltar\(\);/, 'si no salió, la cita sigue');
  assert.match(chat, /const \{ pedido: lemos, conCita \} = separarCita\(t\);\n\s*const crudo = await pedirPedidos\(cuerpoPedidos\(lemos,/);
  assert.match(chat, /const leida = interpretacionDe\(crudo, lemos\);/);
  assert.match(chat, /const actual = conCita\(textoActual\(i\)\);/);
});
