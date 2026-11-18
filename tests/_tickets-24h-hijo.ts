// =============================================================================
// Hijo de tests/tickets-24h.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// La alerta REAL de las 24 h (`avisarTicketsDeMasDe24h`, lib/tickets-cierre.ts) sobre un PostgREST de mentira, con un reloj fijo:
//   · un ticket de 25 h abierto avisa a Martín UNA vez (grupo de SuperAdmin y campanita), y la vuelta siguiente no repite;
//   · uno de 23 h no, hasta que cruza; uno cerrado no; uno que espera al cliente no; uno de antes de `ALERTA_24H_DESDE` no;
//   · sin poder leer a quién ya se avisó, no avisa (ni deja el renglón);
//   · con 55 ya avisados que siguen abiertos, el que acaba de cruzar igual entra (se leen los más nuevos primero).
// Nada sale a ningún lado: WhatsApp no está configurado (el aviso queda en el grupo de la app y en la campanita) y cualquier red
// que no sea la base contesta 500. Escribe una línea `@@24H@@<json>` al final. Necesita `--conditions=react-server`.
// =============================================================================

import { crearPostgrest, type Fila } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
for (const k of ['EVOLUTION_API_URL', 'EVOLUTION_API_KEY']) delete process.env[k];

let n = 9000;
const pg = crearPostgrest({
  tablas: ['tickets', 'ticket_eventos', 'workspaces', 'notificaciones', 'app_settings', 'grupo_mensajes', 'usuarios', 'agencia_clientes', 'grupo_invitados', 'mako_doer_conv'],
  defaults: (t, f) => ({ id: ++n, ...(t === 'ticket_eventos' || t === 'notificaciones' || t === 'grupo_mensajes' ? { at: new Date().toISOString(), created_at: new Date().toISOString() } : {}), ...f }),
  orCompleto: true,
});
let historialCaido = false;
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host !== 'supa.test') return new Response(JSON.stringify({ error: 'red de mentira' }), { status: 500 });
  // Un 500 y no un 503: postgrest-js reintenta solo los 503 de un GET.
  if (historialCaido && u.pathname.endsWith('/ticket_eventos') && (init.method ?? 'GET') === 'GET') {
    return new Response(JSON.stringify({ code: 'XX000', message: 'la base no contestó' }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
  return pg.responder(u, init);
}) as typeof fetch;

const H = 3600_000;
const AHORA = Date.parse('2026-12-01T15:00:00.000Z');
const iso = (ms: number) => new Date(ms).toISOString();

const ticket = (id: number, estado: string, creadoMs: number, extra: Fila = {}): Fila => ({
  id, created_at: iso(creadoMs), updated_at: iso(creadoMs), workspace_id: 77, usuario_id: null, usuario_nombre: 'Laura Gómez',
  usuario_email: 'laura@prueba.test', tipo: 'bug', titulo: `ticket ${id}`, descripcion: '', estado, canal: 'formulario', contexto: null,
  respuesta: null, duplicado_de: null, resuelto_at: null, decidido_at: null, avisado_at: null, ...extra,
});

async function main() {
  const { avisarTicketsDeMasDe24h } = await import('../lib/tickets-cierre');
  const { TIPO_ALERTA_24H } = await import('../lib/tickets-demora');
  const avisados = () => pg.db.ticket_eventos.filter((e) => e.tipo === TIPO_ALERTA_24H).map((e) => Number(e.ticket_id)).sort((a, b) => a - b);
  const campanitas = () => pg.db.notificaciones.filter((f) => f.tipo === 'ticket-24h');
  const vuelta = async (ms: number) => {
    const antes = campanitas().length;
    let r: number | string;
    try { r = await avisarTicketsDeMasDe24h(ms); } catch (e) { r = `tiró: ${e instanceof Error ? e.message : String(e)}`; }
    const nuevas = campanitas().slice(antes);
    return { r, avisados: avisados(), campanitas: nuevas.map((f) => ({ titulo: f.titulo, tickets: (f.payload as { tickets?: number[] } | null)?.tickets ?? null, link: f.link, ws: f.workspace_id })) };
  };

  pg.db.workspaces.push({ id: 9, capa: 'superadmin', nombre: 'MaKo', estado: 'activo' }, { id: 77, capa: 'cliente', nombre: 'Estudio Gómez', estado: 'activo' });
  pg.db.tickets.push(
    ticket(201, 'nuevo', AHORA - 25 * H, { titulo: 'No se guardan los cambios del funnel' }),
    ticket(202, 'esperando_decision', AHORA - 23 * H, { titulo: 'Quiero exportar los leads' }),
    ticket(203, 'resuelto', AHORA - 30 * H, { resuelto_at: iso(AHORA - 2 * H) }),
    ticket(204, 'esperando_cliente', AHORA - 30 * H),
    ticket(205, 'en_curso', AHORA - 26 * H, {
      canal: 'sistema', usuario_nombre: 'Ana Pérez', titulo: 'MaKo no pudo «contestarte»',
      contexto: { chat: { donde: 'error-mako', hilo: '40' }, herramienta: 'responder', error: 'responder: falló la IA' },
    }),
    ticket(206, 'nuevo', Date.parse('2026-11-10T12:00:00.000Z')),
    ticket(207, 'rechazado', AHORA - 40 * H, { resuelto_at: iso(AHORA - 39 * H) }),
  );
  const out: Record<string, unknown> = {};

  // 1. El cron de ahora: avisan el de 25 h (nuevo) y el de 26 h (en curso). Ninguno más.
  out.primera = await vuelta(AHORA);
  out.texto = String(pg.db.grupo_mensajes.at(-1)?.texto ?? '') || null;
  out.grupoWs = pg.db.grupo_mensajes.at(-1)?.workspace_id ?? null;
  out.renglones = pg.db.ticket_eventos.filter((e) => e.tipo === TIPO_ALERTA_24H).map((e) => ({ ticket: e.ticket_id, actor: e.actor, texto: e.texto }));
  // 2. Quince minutos después: nada nuevo, ni un renglón más.
  out.segunda = await vuelta(AHORA + 0.25 * H);
  // 3. Dos horas después: el de 23 h ya tiene 25 h y avisa, solo.
  out.tercera = await vuelta(AHORA + 2 * H);
  // 4. Sin poder leer el historial: no avisa al que acaba de cruzar, ni deja su renglón.
  pg.db.tickets.push(ticket(208, 'nuevo', AHORA + 3 * H - 25 * H));
  historialCaido = true;
  try { out.sinHistorial = await vuelta(AHORA + 3 * H); } finally { historialCaido = false; }
  // 5. Con el historial de vuelta, sí (una vez).
  out.conHistorial = await vuelta(AHORA + 3 * H);
  // 6. 55 abiertos ya avisados (más viejos) no le tapan la vista al que acaba de cruzar.
  for (let i = 0; i < 55; i++) {
    const id = 400 + i;
    pg.db.tickets.push(ticket(id, 'en_curso', AHORA - 5 * 24 * H + i * 60_000));
    pg.db.ticket_eventos.push({ id: ++n, ticket_id: id, at: iso(AHORA), actor: 'sistema', tipo: TIPO_ALERTA_24H, texto: 'ya avisado', datos: null });
  }
  pg.db.tickets.push(ticket(300, 'nuevo', AHORA + 4 * H - 25 * H));
  out.conMuchos = await vuelta(AHORA + 4 * H);
  out.nuevosEnLaCola = out.conMuchos && (out.conMuchos as { avisados: number[] }).avisados.includes(300);
  out.sinMock = [...pg.sinMock];
  process.stdout.write(`\n@@24H@@${JSON.stringify(out)}\n`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`\n@@24H@@${JSON.stringify({ error: e instanceof Error ? `${e.message}\n${e.stack}` : String(e) })}\n`); process.exit(0); });
