// El aviso de «MaKo en WhatsApp» lleva a la CONVERSACIÓN, no sólo a la ficha (21/10/2026)
// =============================================================================
// La prospección del Sprint de Mauricio: «cuando alguien responde, MaKo le avisa a Mauricio y él sigue A MANO desde
// Chats». El aviso llevaba el link a la ficha (/crm/<id>) y de ahí había que buscar la charla: un clic de más por
// cada respuesta. Ahora:
//   · el dato `{{link_chat_lead}}` («Link a su conversación», /chats?lead=<id>) está en el «{ }» de la tarjeta y se
//     resuelve (lib/variables-resolver.ts), como `{{link_lead}}`;
//   · el aviso armado (la tarjeta de antes, la de la API) suma la línea «💬 <link>» debajo del de la ficha;
//   · la plantilla «Un Lead Te Escribió» la trae.
// ⚠️ PROBADO ROMPIÉNDOLO: los números van al pie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { armarAvisoDeTarjeta } from '../lib/mako-tarjeta';
import { datoDe, tokensFueraDe } from '../lib/variables-aviso';
import { rutaChatsDeLead } from '../lib/chats-links';
import { PLANTILLAS } from '../lib/plantillas-automatizaciones';

const leer = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');
const lead = { id: 5, nombre: 'Ana López', telefono: '+52 664 000 0000' };
const FICHA = 'https://hola-mako.com/crm/5?ws=1';
const CHARLA = 'https://hola-mako.com/chats?lead=5&ws=1';

test('la ruta de la charla de un lead es la que abre ESA conversación en Chats', () => {
  assert.equal(rutaChatsDeLead(5), '/chats?lead=5');
});

test('el aviso armado lleva la ficha Y la charla', () => {
  const a = armarAvisoDeTarjeta({ leadId: 5, mensaje: 'Te respondió.' }, {
    desdeUnFlujo: true, respuesta: 'Me interesa', lead, linkLead: FICHA, linkChat: CHARLA, textos: { titulo: 'Respondió', mensaje: 'Te respondió.' }, partes: null,
  });
  const lineas = a.texto.split('\n');
  assert.ok(lineas.includes(`👉 ${FICHA}`));
  assert.equal(lineas[lineas.indexOf(`👉 ${FICHA}`) + 1], `💬 ${CHARLA}`, 'la charla, justo debajo de la ficha');
  // Sin el link (quien no lo pasa) queda EXACTAMENTE como antes.
  const sin = armarAvisoDeTarjeta({ leadId: 5, mensaje: 'x' }, { desdeUnFlujo: true, respuesta: '', lead, linkLead: FICHA, textos: { titulo: 'T', mensaje: 'x' }, partes: null });
  assert.ok(!sin.texto.includes('💬'));
});

test('«Link a su conversación» es un dato del equipo sobre el lead, como el de la ficha, y una tarjeta MaKo lo acepta', () => {
  const d = datoDe('link_chat_lead');
  assert.ok(d, 'no está en el catálogo: el «{ }» no lo ofrece');
  assert.equal(d.soloPara, 'equipo', 'un lead no entra a la bandeja del negocio');
  assert.equal(d.fuente, 'evento');
  assert.equal(d.alcance, datoDe('link_lead')!.alcance);
  assert.deepEqual(tokensFueraDe('Respondió {{nombre_completo}}: {{link_chat_lead}}', { destino: 'equipo', conLead: true }), []);
  assert.deepEqual(tokensFueraDe('{{link_chat_lead}}', { destino: 'lead', conLead: true }), ['{{link_chat_lead}}'], 'al lead no');
});

test('el resolvedor y la acción lo arman con la ruta de la charla y el ?ws= del negocio', () => {
  assert.match(leer('lib/variables-resolver.ts'), /if \(ctx\.leadId\) out\.link_chat_lead = linkApp\(rutaChatsDeLead\(ctx\.leadId\), ctx\.ws\);/);
  assert.match(leer('lib/api-mako/areas/chatbot.run.ts'), /linkChat: lead \? linkApp\(rutaChatsDeLead\(lead\.id\), ctx\.ws\) : null,/);
});

test('la plantilla «Un Lead Te Escribió» trae el link a la charla', () => {
  const p = PLANTILLAS.find((x) => JSON.stringify(x).includes('mc_aviso'));
  assert.ok(p, 'no encontré la plantilla del aviso «te escribió»');
  assert.match(JSON.stringify(p), /\{\{link_chat_lead\}\}/);
});

// ── Las roturas (5 tests; sin romper nada: 5 pases, 0 fallos) ──────────────────────────────────────────────────────
// 1. La tarjeta sin la línea «💬»: 1 fallo / 4 pases.
// 2. El dato sin `soloPara: 'equipo'` (lo vería el lead): 1 fallo / 4 pases.
// 3. El resolvedor sin `link_chat_lead`: 1 fallo / 4 pases.
// 4. La plantilla sin el link: 1 fallo / 4 pases.
