// =============================================================================
// La Ticketera adjunta capturas, fotos, PDF y documentos, y llegan AL TICKET (28/10/2026)
// =============================================================================
// Martín (28/10, chat del Cerebro): «las personas no están pudiendo usar la ticketera porque nuevamente el chat está mal
// configurado, solamente permite emojis, no permite adjuntar ni archivos ni capturas ni documentos». La caja de Soporte usaba
// la caja compartida SIN `adjuntos`. Lo aprendido, en docs/hallazgos-ticketera.md («Soporte sin adjuntos»).
//
// Probado rompiéndolo (28/10/2026), una rotura por vez, 1 fallo cada una: la caja sin adjuntos · el alta sin validar el negocio
// · la respuesta sin sus archivos · el triage sin adjuntos · una referencia de otro negocio que pasa.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ACCEPT_TICKET, lineaDeAdjuntos, mimeDeArchivoTicket, problemaDeAdjuntosTicket, sanearAdjuntosTicket } from '../lib/tickets-adjuntos';
import { clasificar } from '../lib/tickets-reglas';

const raiz = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8').replace(/\r\n/g, '\n');
const UUID = '0b6d5b75-4a1f-4c2d-9e3f-0123456789ab';

test('las reglas: qué se acepta, los topes, y una referencia de OTRO negocio no se guarda', () => {
  assert.equal(mimeDeArchivoTicket('captura.png', 'image/png'), 'image/png');
  assert.equal(mimeDeArchivoTicket('informe.docx', ''), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'un Android que deja el tipo vacío');
  assert.equal(mimeDeArchivoTicket('virus.exe', 'application/x-msdownload'), null);
  assert.match(problemaDeAdjuntosTicket([{ name: 'a.exe', type: '', size: 1 }]) ?? '', /no se puede adjuntar/);
  assert.match(problemaDeAdjuntosTicket(Array.from({ length: 6 }, (_, i) => ({ name: `${i}.png`, type: 'image/png', size: 1 }))) ?? '', /Hasta 5/);
  assert.match(problemaDeAdjuntosTicket([{ name: 'a.pdf', type: 'application/pdf', size: 5 * 1024 * 1024 }]) ?? '', /más de 4 MB/);
  assert.equal(problemaDeAdjuntosTicket([{ name: 'a.pdf', type: 'application/pdf', size: 1000 }]), null);
  const bueno = { path: `3/tickets/${UUID}`, nombre: 'captura.png', mime: 'image/png', bytes: 1200 };
  assert.deepEqual(sanearAdjuntosTicket([bueno], 3), [bueno]);
  assert.deepEqual(sanearAdjuntosTicket([{ ...bueno, path: `1/tickets/${UUID}` }], 3), [], 'una referencia de otro negocio se guarda en el ticket');
  assert.deepEqual(sanearAdjuntosTicket([{ ...bueno, mime: 'application/x-msdownload' }], 3), []);
  assert.match(ACCEPT_TICKET, /\.pdf/);
  assert.equal(lineaDeAdjuntos(['a.png', 'b.pdf']), '📎 a.png, b.pdf');
});

test('el triage dice que el ticket trae adjuntos', () => {
  const t = clasificar({ tipoDeclarado: null, declaradoPor: null, titulo: 'No anda el CRM', descripcion: 'mirá la captura', contexto: {}, adjuntos: 2 });
  assert.ok(t.porque.some((p) => /Trae 2 adjuntos/.test(p)), 'el triage no sabe que hay adjunto');
});

test('la caja de Soporte ofrece adjuntar, y lo adjuntado llega al ticket (computadora y teléfono, que usan la misma caja)', () => {
  assert.match(leer('app/tickets/soporte/PiezasSoporte.tsx'), /adjuntos=\{s\.adjuntosCaja\}/, 'la caja de Soporte vuelve a ofrecer sólo emojis');
  assert.match(leer('app/m/tickets/SoporteM.tsx'), /<CajaSoporte /, 'el teléfono dejó de usar la caja de Soporte');
  const hook = leer('app/tickets/soporte/useSoporte.ts');
  assert.match(hook, /const r = await contestarTicketAction\(t\.id, x, refs\);/, 'la respuesta sale sin sus archivos');
  assert.ok(hook.indexOf('await subirAdjuntosTicket(archivos)') < hook.indexOf('await contestarTicketAction(t.id, x, refs)'));
  assert.match(hook, /ref: ref\.current, adjuntos: delTicket\.current,/, 'el ticket nuevo se levanta sin lo que se adjuntó');
  const acc = leer('app/tickets/acciones.ts');
  assert.match(acc, /adjuntos: sanearAdjuntosTicket\(entrada\.adjuntos, quien\.ws\),/, 'el alta no valida contra el negocio de la sesión');
  assert.match(acc, /comentarComoCliente\(quien\.ws, quien\.email, id, texto, sanearAdjuntosTicket\(adjuntos, quien\.ws\)\)/);
  const db = leer('lib/tickets-db.ts');
  // (10/11/2026: los datos del comentario suman la firma de la API, `por`; los archivos siguen yendo adentro.)
  assert.match(db, /const datos = \{ \.\.\.\(adjuntos\.length \? \{ adjuntos \} : \{\}\)/, 'la respuesta no guarda sus archivos');
  assert.match(db, /await anotar\(id, 'cliente', 'comentario', t, Object\.keys\(datos\)\.length \? datos : undefined\);/, 'la respuesta no guarda sus archivos');
  assert.match(db, /'creado', null, \{ canal: n\.canal, \.\.\.\(n\.adjuntos\?\.length \? \{ adjuntos: n\.adjuntos \} : \{\}\) \}\);/, 'el ticket no guarda sus archivos');
  assert.match(db, /adjuntos: n\.adjuntos\?\.length \?\? 0 \}/, 'el triage no recibe los adjuntos');
  const ruta = leer('app/api/tickets/adjuntos/route.ts');
  assert.match(ruta, /if \(!\(await getUsuarioActual\(\)\)\) return/, 'la subida no pide sesión');
  assert.match(ruta, /const path = rutaDeAdjuntoTicket\(ws, randomUUID\(\)\);/, 'la subida no guarda en el negocio de la sesión');
  const ver = leer('scripts/tickets.ts');
  assert.match(ver, /select at, actor, tipo, texto, datos from ticket_eventos/, 'el Cerebro no ve los adjuntos');
  assert.match(ver, /console\.log\(`ADJUNTOS \(\$\{adjuntos\.length\}\)/);
});
