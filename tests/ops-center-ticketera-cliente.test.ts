// =============================================================================
// La Ticketera del cliente en su Ops Center: levanta un ticket y ve los suyos, con su historial (22/10/2026, D2)
// =============================================================================
// Martín: «Que el Ops Center de clientes sea IGUAL que el de SuperAdmin, que tengan su ticketera, pero en este caso ellos suben
// el ticket y ven sus tickets ya subidos y el historial con el status».
//   1. el historial: cada cambio de estado con su fecha (recibido, en curso, arreglado, resuelto), de las fechas del ticket, y
//      por dónde lo levantó; se ve en el detalle, en la computadora y en el teléfono;
//   2. SÓLO LOS SUYOS: la acción no recibe nada del navegador; workspace y email salen de la sesión, y la lectura filtra por
//      los dos. Lo que llega al cliente es `paraElCliente` (nada del triage ni de la nota de Martín);
//   3. el botón «Ticketera» arriba, como el del super admin, con su número (los que esperan su respuesta), y su panel con la
//      pieza de /tickets; en el teléfono, la fila a /m/tickets.
//
// Correr: node --import tsx --test tests/ops-center-ticketera-cliente.test.ts
// PROBADO ROMPIÉNDOLO (base 3/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { esperanTuRespuesta, historialDelTicket, paraElCliente } from '../lib/tickets-reglas';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const fila = (p: Record<string, unknown> = {}) => ({
  id: 7, titulo: 'No me carga el CRM', descripcion: 'No me carga el CRM desde ayer', tipo: 'bug', estado: 'nuevo',
  created_at: '2026-10-22T10:00:00Z', updated_at: '2026-10-22T10:00:00Z', respuesta: null, despacho: null, decidido_at: null,
  resuelto_at: null, duplicado_de: null, canal: 'whatsapp', ...p,
}) as unknown as Parameters<typeof paraElCliente>[0];

test('1. el historial: cada cambio de estado con su fecha, y por dónde lo levantó; se ve en el detalle', () => {
  assert.deepEqual(historialDelTicket(fila()).map((p) => p.paso), ['recibido']);
  // `arreglado` es «commiteado, sin desplegar»: al cliente se le dice «En curso», y el paso «Arreglado» espera a que se resuelva.
  const arreglado = fila({ estado: 'arreglado', despachado_at: '2026-10-22T10:05:00Z', arreglado_at: '2026-10-22T12:00:00Z' });
  assert.deepEqual(historialDelTicket(arreglado).map((p) => [p.rotulo, p.at]), [
    ['Recibido', '2026-10-22T10:00:00Z'], ['En curso', '2026-10-22T10:05:00Z'],
  ]);
  const resuelto = fila({ estado: 'resuelto', decidido_at: '2026-10-22T11:00:00Z', arreglado_at: '2026-10-22T12:00:00Z', resuelto_at: '2026-10-22T13:00:00Z' });
  assert.deepEqual(historialDelTicket(resuelto).map((p) => p.paso), ['recibido', 'en_curso', 'arreglado', 'resuelto']);
  // Rechazado: no pasó por «en curso» aunque tenga su decisión, y queda cerrado.
  assert.deepEqual(historialDelTicket(fila({ estado: 'rechazado', decidido_at: '2026-10-22T11:00:00Z' })).map((p) => p.paso), ['recibido', 'cerrado']);
  const t = paraElCliente(arreglado);
  assert.equal(t.canal, 'Por WhatsApp');
  assert.equal(paraElCliente(fila({ canal: 'chat_app' })).canal, 'Desde el chat de MaKo', 'los canales de verdad (CANALES)');
  assert.equal(paraElCliente(fila({ canal: 'sistema' })).canal, null, '«lo abrió el sistema» no se dice');
  assert.equal(paraElCliente(fila({ canal: 'raro' })).canal, null, 'un canal que no se conoce no se inventa');
  // Arriba de la conversación de un ticket, en la computadora y en el teléfono: desde el 23/10/2026 es el chat de Soporte, con
  // UNA pieza para el estado (EstadoDelTicket, app/tickets/soporte/PiezasSoporte.tsx). Se mira el código (trae CSS).
  const piezas = sinComentarios(leer('app/tickets/soporte/PiezasSoporte.tsx'));
  assert.match(piezas, /<ol className="tickets-historial sp-historial" aria-label="Historial del ticket">\n\s*\{t\.historial\.map\(\(p\) => \(/, 'el historial');
  assert.match(piezas, /<span className="tickets-historial__rotulo">\{p\.rotulo\}<\/span>\n\s*<span className="tickets-historial__cuando">\{hace\(p\.at\)\}<\/span>/, 'con su fecha');
  assert.match(piezas, /\{t\.canal && <span className="sp-estado__canal">\{t\.canal\}<\/span>\}/, 'y por dónde lo levantó');
  for (const f of ['app/tickets/soporte/ChatSoporte.tsx', 'app/m/tickets/SoporteM.tsx']) assert.match(sinComentarios(leer(f)), /<EstadoDelTicket s=\{s\} \/>/, `${f}: se ve el estado`);
});

test('2. sólo los suyos: la acción no recibe nada del navegador; workspace y email de la sesión; lo que llega es paraElCliente', () => {
  const acc = sinComentarios(leer('app/tickets/acciones.ts'));
  assert.match(acc, /export async function misTicketsAction\(\): Promise</, 'sin parámetros: nada del navegador dice de quién son');
  const cuerpo = acc.slice(acc.indexOf('export async function misTicketsAction('), acc.indexOf('export async function verMiTicketAction('));
  assert.match(cuerpo, /const quien = await yo\(\);\n\s*if \(!quien\) return/);
  assert.match(cuerpo, /await misTickets\(quien\.ws, quien\.email\);/);
  assert.match(cuerpo, /tickets: r\.datos\.map\(\(t\) => paraElCliente\(t\)\)/, 'sólo lo que ve el cliente');
  assert.match(cuerpo, /if \(!tabEnCapa\('tickets', await getCapaActual\(\)\)\) return \{ ok: false, error: '[^']+', fueraDelPlan: true \};/, 'con la puerta de /tickets');
  assert.match(acc, /const s = await getUsuarioActual\(\);\n\s*const ws = await getWorkspaceActual\(\);/, 'quién es sale de la sesión');
  const db = sinComentarios(leer('lib/tickets-db.ts'));
  const mis = db.slice(db.indexOf('export async function misTickets('), db.indexOf('export async function miTicket('));
  assert.match(mis, /\.eq\('workspace_id', ws\)\.eq\('usuario_email', email\.trim\(\)\.toLowerCase\(\)\)/, 'filtra por su workspace Y su email');
  // Lo que viaja: nada interno.
  const t = paraElCliente(fila({ triage: { x: 1 }, decision_nota: 'nota de Martín', contexto: { ruta: '/crm' } }));
  for (const k of ['triage', 'decision_nota', 'contexto', 'usuario_email', 'despacho']) assert.ok(!(k in t), `«${k}» no llega al cliente`);
});

test('3. el botón «Ticketera» arriba, con su número, y su panel; en el teléfono, la fila', () => {
  assert.equal(esperanTuRespuesta([paraElCliente(fila({ estado: 'esperando_cliente' })), paraElCliente(fila())]), 1, 'el número: los que esperan su respuesta');
  const sb = sinComentarios(leer('app/second-brain/ChatSecondBrain.tsx'));
  assert.match(sb, /\{!centro && !misTickets\.fueraDelPlan && \(\n\s*<button type="button" className="co-acceso co-acceso--ticketera" aria-pressed=\{ticketera != null\}/, 'el mismo botón que el del super admin');
  assert.match(sb, /\{misTickets\.esperanTuRespuesta > 0 && <span className="co-acceso__n">\{misTickets\.esperanTuRespuesta\}<\/span>\}/);
  assert.match(sb, /: !centro && ticketera \? \(\n\s*<TicketeraDelCliente mis=\{misTickets\}/);
  assert.match(sb, /const misTickets = useMisTickets\(!ops\);/, 'sólo para el cliente');
  assert.match(sinComentarios(leer('app/second-brain/TicketeraDelCliente.tsx')), /<ChatSoporte tickets=\{mis\.tickets\} onVolver=\{onVolver\} \/>/, 'el chat de Soporte (el mismo de /tickets)');
  // Un chip arriba de los chats desde el 13/11/2026 (el prototipo aprobado), con los que esperan su respuesta.
  assert.match(sinComentarios(leer('app/m/second-brain/ChatClienteM.tsx')), /<Link className="m-ops-chip" href="\/m\/tickets">Ticketera\{misTickets\.esperanTuRespuesta > 0 && <span className="m-ops-chip__n">/);
});

// PROBADO ROMPIÉNDOLO (22/10/2026, base 3/0):
//   · el historial sin «Arreglado»                  → 2/1 (1)
//   · un rechazado pasa por «en curso»              → 2/1 (1)
//   · la acción recibe el email del navegador       → 2/1 (2)
//   · la lectura sin filtrar por email              → 2/1 (2)
//   · el panel no va para el cliente                → 2/1 (3)
//   · «Arreglado» antes de resolverse               → 2/1 (1)
//   · la acción sin la puerta del plan              → 2/1 (2)
