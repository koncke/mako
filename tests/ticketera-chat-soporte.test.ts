// =============================================================================
// La Ticketera del cliente es un CHAT con MaKo: cuenta, MaKo repregunta lo justo y arma el ticket (23/10/2026)
// =============================================================================
// Martín (22/10/2026): «Mira la ticketera, se ve bastante feo... Cuando podría tener el mismo diseño que un chat y que los
// usuarios le comenten a MaKo cual fue su problema... ese debe ser la principal funcionalidad». Fija:
//   1. lo que dice MaKo (lib/soporte-chat.ts, reglas sin IA): «cuéntame más» si es muy corto; dónde y si pasa siempre sólo
//      para algo que no anda, «dónde» sólo si no lo nombró, cada una UNA vez; y el ticket con todo lo que contó;
//   2. el hilo: las repreguntas con sus respuestas rápidas, la tarjeta en la última propuesta, la conversación de un ticket;
//   3. las piezas del Ops Center (PanelDeChat, HiloMako, CajaChat) en la computadora y en el teléfono, cargadas con next/dynamic
//      desde lo que leen tests; y el ticket sale con el workspace y el email de la SESIÓN, por el canal del chat.
//
// Correr: node --import tsx --test tests/ticketera-chat-soporte.test.ts
//
// ⚠️ PROBADO ROMPIENDOLO (23/10/2026): ver el pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHARLA_VACIA, LUGARES, borradorDe, contextoDeSoporte, preguntar, queSigue, sumar, type Charla } from '../lib/soporte-chat';
import { taparClaves } from '../lib/claves-en-el-chat';
import { idDelBorrador, itemsDeCharla, itemsDeTicket, placeholderDe, type Turno } from '../app/tickets/soporte/hilo-soporte';
import { paraElCliente } from '../lib/tickets-reglas';

const leer = (f: string) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

/** Lo que dice la persona, en orden, como lo hace la pantalla: lo suma, mira qué sigue y marca la repregunta. */
function charlar(...dichos: string[]): { c: Charla; pasos: ReturnType<typeof queSigue>[] } {
  let c = CHARLA_VACIA;
  const pasos: ReturnType<typeof queSigue>[] = [];
  for (const d of dichos) {
    c = sumar(c, d);
    const p = queSigue(c);
    if (p?.k === 'pregunta') c = preguntar(c, p.clave);
    pasos.push(p);
  }
  return { c, pasos };
}
const claves = (pasos: ReturnType<typeof queSigue>[]) => pasos.map((p) => (p?.k === 'pregunta' ? p.clave : p?.k ?? null));

test('1. algo que no anda: si dijo poco pide más; dónde sólo si no lo nombró; si pasa siempre; y arma el ticket con todo', () => {
  const a = charlar('no anda', 'Cuando intento mandar algo me sale un error rojo', 'Otra parte', 'Siempre que lo intento');
  assert.deepEqual(claves(a.pasos), ['mas', 'donde', 'cuando', 'ticket']);
  const fin = a.pasos[3];
  assert.ok(fin?.k === 'ticket');
  assert.equal(fin.borrador.tipo, 'bug');
  assert.equal(fin.borrador.descripcion, 'no anda\n\nCuando intento mandar algo me sale un error rojo\n\nDónde: Otra parte\nCuándo pasa: Siempre que lo intento');
  const donde = queSigue(sumar(CHARLA_VACIA, 'Me sale un error cada vez que intento guardar algo nuevo'));
  assert.ok(donde?.k === 'pregunta' && donde.clave === 'donde');
  assert.deepEqual(donde.opciones, LUGARES, 'con las partes de MaKo como respuestas rápidas');
  // Nombró dónde (el CRM): no se le pregunta.
  assert.deepEqual(claves(charlar('En el CRM no me carga la lista de leads desde ayer', 'A veces').pasos), ['cuando', 'ticket']);
});

test('1b. un pedido o una pregunta no se interrogan: van directo al ticket, con el tipo que lee el triage', () => {
  const p = charlar('Quiero que se pueda exportar los leads a un Excel');
  assert.deepEqual(claves(p.pasos), ['ticket']);
  assert.equal(borradorDe(p.c).tipo, 'pedido');
  const q = charlar('¿Cómo hago para conectar mi WhatsApp a MaKo?');
  assert.deepEqual(claves(q.pasos), ['ticket']);
  assert.equal(borradorDe(q.c).tipo, 'pregunta');
  assert.equal(borradorDe(q.c).titulo, '¿Cómo hago para conectar mi WhatsApp a MaKo?');
});

test('1c. cada repregunta una sola vez, y lo que sigue contando se suma al ticket', () => {
  const a = charlar('error', 'no sé', 'CRM', 'Fue una vez', 'Y también se me cerró la pestaña');
  assert.deepEqual(claves(a.pasos), ['mas', 'donde', 'cuando', 'ticket', 'ticket'], '«cuéntame más» no se repite aunque siga corto');
  assert.match(borradorDe(a.c).descripcion, /Y también se me cerró la pestaña/);
  assert.equal(queSigue(CHARLA_VACIA), null, 'sin contar nada, va el saludo');
});

test('2. el hilo: la repregunta con sus respuestas rápidas, la tarjeta en la última propuesta; un ticket con sus líneas', () => {
  const at = '2026-10-23T10:00:00Z';
  const b = { tipo: 'bug' as const, titulo: 'x', descripcion: 'x' };
  const turnos: Turno[] = [
    { id: 'm1', de: 'mako', texto: 'Hola', at },
    { id: 'p1', de: 'persona', texto: 'me sale un error', at },
    { id: 'm2', de: 'mako', texto: '¿En qué parte de MaKo te pasó?', at, opciones: ['CRM', 'Otra parte'] },
    { id: 'p2', de: 'persona', texto: 'CRM', at },
    { id: 'm3', de: 'mako', texto: 'Listo', at, borrador: b },
    { id: 'p3', de: 'persona', texto: 'y otra cosa', at },
    { id: 'm4', de: 'mako', texto: 'Listo', at, borrador: b },
  ];
  const items = itemsDeCharla(turnos);
  const op = items.find((x) => x.k === 'bloque');
  assert.ok(op && op.k === 'bloque' && op.b.t === 'pregunta' && op.b.rapida === true);
  assert.equal(op.respondida, 'CRM', 'la contestada se ve contestada');
  assert.equal(idDelBorrador(turnos), 'm4', 'la tarjeta, en la última propuesta');
  const t = paraElCliente({ id: 9, titulo: 'x', descripcion: 'Lo que mandé', tipo: 'bug', estado: 'esperando_cliente', created_at: at, updated_at: at,
    respuesta: null, despacho: null, decidido_at: null, resuelto_at: null, duplicado_de: null },
  [{ at: '2026-10-23T11:00:00Z', actor: 'martin', tipo: 'comentario', texto: '¿Qué navegador usas?' }]);
  assert.deepEqual(itemsDeTicket(t).map((x) => (x.k === 'msg' ? [x.role, x.texto] : x.k)), [['user', 'Lo que mandé'], ['assistant', '¿Qué navegador usas?']]);
  assert.equal(placeholderDe(t, false), 'Contesta lo que te preguntó el equipo');
  assert.equal(placeholderDe(null, false), 'Cuéntale a MaKo qué pasó');
});

test('3. las piezas del Ops Center, en la computadora y en el teléfono, y cargadas aparte de lo que leen los tests', () => {
  const panel = sinComentarios(leer('app/second-brain/TicketeraDelCliente.tsx'));
  assert.match(panel, /dynamic\(\(\) => import\('@\/app\/tickets\/soporte\/ChatSoporte'\)/, 'la Ticketera del Ops Center es el chat de Soporte');
  assert.match(panel, /return <ChatSoporte tickets=\{mis\.tickets\} onVolver=\{onVolver\} \/>;/);
  assert.doesNotMatch(panel, /from '@\/app\/tickets\/soporte\/(ChatSoporte|PiezasSoporte)'/, 'importado directo: el CSS de las piezas tira abajo los tests que leen el Ops Center');
  const chat = sinComentarios(leer('app/tickets/soporte/ChatSoporte.tsx'));
  assert.match(chat, /<PanelDeChat\s+cabecera=\{\{ clave: 'soporte', titulo: 'Soporte', criatura: QUIEN_SOPORTE\.nombre, aspecto: QUIEN_SOPORTE\.aspecto,/, 'la cabecera de Soporte, con la criatura de MaKo');
  // 23/10/2026, Martín: sus tickets detrás del botón con el ícono de lista, al lado de «Soporte» (no en una tira de chips abajo).
  assert.match(chat, /acciones: <ListaTickets s=\{s\} \/>/, 'sus tickets, en la cabecera');
  assert.match(chat, /arriba=\{s\.ticket \? <div className="sp-arriba"><EstadoDelTicket s=\{s\} \/><\/div> : undefined\}/, 'arriba, sólo en qué anda el ticket abierto');
  // La caja adentro de `.co-caja`, como la del Cerebro (sin ella salía sin marco y con el tirador del textarea).
  assert.match(chat, /caja=\{<div className="co-caja"><CajaSoporte s=\{s\} campo=\{campo\} seguir=\{seguir\} \/><\/div>\}/);
  const piezas = sinComentarios(leer('app/tickets/soporte/PiezasSoporte.tsx'));
  assert.match(piezas, /import \{ CajaChat \} from '@\/app\/_chat\/CajaChat';/);
  assert.match(piezas, /<HiloMako items=\{s\.items\} quien=\{QUIEN_SOPORTE\}/);
  assert.match(piezas, /export const QUIEN_SOPORTE = \{ nombre: 'MaKo', aspecto: ASPECTO_MAKO \};/, 'la criatura es la de MaKo (la estrella)');
  assert.match(piezas, /<Dropdown\n\s*value=\{s\.abierto === NUEVO \? NUEVO : String\(s\.abierto\)\}/, 'la lista es el desplegable de la casa');
  assert.match(piezas, /sub: t\.rotulo, color: TONO\[TONO_ESTADO\[t\.estado\]\]\.fill/, 'cada ticket con su estado');
  assert.match(piezas, /x\.id === s\.idTarjeta && !s\.ticket \? \{ abajo: <TarjetaTicket s=\{s\} \/> \}/, 'cada conversación termina en un ticket');
  assert.match(sinComentarios(leer('app/tickets/page.tsx')), /<SoporteDeLaPagina /, '/tickets es el mismo chat');
  // El teléfono: la lista con «Contarle a MaKo» (la hoja) y cada ticket como su conversación.
  const m = sinComentarios(leer('app/m/tickets/TicketsM.tsx'));
  assert.match(m, /const s = useSoporte\(\{ tickets, movil: true \}\);/);
  assert.match(m, /onClick=\{\(\) => \{ s\.nuevo\(\); setAbierta\(true\); \}\}>Contarle a MaKo</);
  assert.match(sinComentarios(leer('app/m/tickets/[id]/page.tsx')), /<ChatTicketM t=\{t\} \/>/);
});

test('3b. el ticket del chat sale con el workspace y el email de la SESIÓN, por el canal del chat, y el tipo sólo si lo eligió', () => {
  const acc = sinComentarios(leer('app/tickets/acciones.ts'));
  const cuerpo = acc.slice(acc.indexOf('export async function levantarDesdeSoporteAction('), acc.indexOf('export async function misTicketsAction('));
  assert.match(cuerpo, /const quien = await yo\(\);\n\s*if \(!quien\) return \{ ok: false, error: SIN_SESION \};/);
  assert.match(cuerpo, /identidad: await identidadDe\(quien\.ws, quien\.email, quien\.nombre\)/);
  assert.match(cuerpo, /sanearAlta\(\{ tipo: entrada\.elegido \? entrada\.tipo : null,/, 'el tipo que adivinó la pantalla no pesa como si lo hubiera dicho');
  assert.match(cuerpo, /canal: entrada\.movil \? 'chat_movil' : 'chat_app'/);
  assert.match(cuerpo, /`soporte-chat:\$\{entrada\.ref\}`/, 'con su clave de idempotencia (un doble toque)');
  const motor = sinComentarios(leer('app/tickets/soporte/useSoporte.ts'));
  assert.match(motor, /contexto: contextoDelNavegador\(movil \? 'soporte-movil' : 'soporte'\)/);
  assert.match(sinComentarios(leer('app/tickets/navegador.ts')), /if \(document\.referrer && !donde\.startsWith\('soporte'\)\)/, 'de dónde venía no es dónde le pasó');
});

test('4. lo que encontró la revisión de Integración (23/10/2026): el contexto lo arma el servidor, el aviso no se traba, las claves se tapan', () => {
  // M1: del navegador, sólo lo que sabe de sí. Un `chat.hilo` de afuera escribía la respuesta de Martín en el chat de MaKo del
  // dueño; `error`, `herramienta`, `ruta` y `noExiste` cambian el triage.
  const c = contextoDeSoporte({ chat: { donde: 'soporte', hilo: '123' }, error: 'MaKo falló', herramienta: 'borrar_lead', ruta: '/pagos',
    noExiste: true, navegador: 'Mozilla/5.0 (X11)', pantalla: '390x844', zona: 'UTC', idioma: 'es', hora: '2026-10-23T10:00:00Z' }, true);
  assert.deepEqual(c, { chat: { donde: 'soporte-movil' }, navegador: 'Mozilla/5.0 (X11)', pantalla: '390x844', zona: 'UTC', idioma: 'es', hora: '2026-10-23T10:00:00.000Z' });
  const acc = sinComentarios(leer('app/tickets/acciones.ts'));
  assert.match(acc, /contexto: contextoDeSoporte\(entrada\.contexto, entrada\.movil\), ref,/);
  assert.doesNotMatch(acc, /contexto: entrada\.contexto/, 'ninguna acción guarda el contexto del navegador tal cual');
  // M2: un ticket del chat sin hilo cuenta como avisado (su conversación ES /tickets); si no, 30 así trababan el cron.
  assert.match(sinComentarios(leer('lib/tickets-cierre.ts')),
    /if \(\(f\.canal === 'chat_app' \|\| f\.canal === 'chat_movil'\) && !\/\^\\d\{1,12\}\$\/\.test\(hilo\)\) salio\.push\('tickets'\);/);
  // M3: lo que escribe la persona se guarda con las claves tapadas, en el alta y en lo que contesta.
  const db = sinComentarios(leer('lib/tickets-db.ts'));
  assert.match(db, /const titulo = taparClaves\(n\.titulo\.trim\(\)\)\.texto\.slice\(0, TOPES\.titulo\);/);
  assert.match(db, /const descripcion = taparClaves\(n\.descripcion\.trim\(\)\)\.texto\.slice\(0, TOPES\.descripcion\);/);
  // La clave se tapa igual; con archivos y sin texto, el historial dice cuáles (28/10/2026, tests/ticketera-adjuntos.test.ts).
  assert.match(db, /const t = taparClaves\(texto\.trim\(\)\)\.texto \|\| lineaDeAdjuntos\(adjuntos\.map\(\(a\) => a\.nombre\)\);/);
  assert.ok(!taparClaves('mi clave es sk-ant-api03-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789 y no anda').texto.includes('AbCdEfGh'));
  assert.match(sinComentarios(leer('app/tickets/soporte/PiezasSoporte.tsx')), /arriba=\{hayClave\(s\.texto\) \? <AvisoClave \/> : undefined\}/);
});

// PROBADO ROMPIÉNDOLO (23/10/2026, base 6/0, de a una; cada una → 5/1):
//   · «dónde» aunque nombró la tab                       → 1
//   · un pedido también se interroga                     → 1b
//   · la tarjeta en la PRIMERA propuesta                 → 2
//   · la Ticketera del Ops Center importa el chat directo → 3
//   · el tipo adivinado viaja como si lo hubiera dicho   → 3b
// Y los de la revisión de Integración (test 4, base 7/0; cada una → 6/1): el contexto del navegador entero en
// `contextoDeSoporte`; la acción guardando `entrada.contexto` tal cual; el ticket del chat sin hilo sin contar como avisado;
// `comentarComoCliente` sin tapar las claves.
