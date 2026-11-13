// =============================================================================
// Hijo de tests/rescate-del-store.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// El 13/11/2026 el store de Evolution de la voz tenía siete mensajes de Mauricio en su grupo (ws1) que el webhook nunca vio:
// entraron EN LOTE al re-vincular la línea (17:12:27 UTC), como historial, sin `messages.upsert`. Esto corre el rescate REAL
// (`rescatarDelStore`, lib/mako-doer-in.ts) contra ese store —las mismas filas, con sus horas corridas a «ahora»— y después
// `flushHuerfanos` (el cron doer-flush), que es quien contesta. Contra el PostgREST de mentira del arnés; Evolution devuelve
// el store en `findMessages` y anota lo demás.
// =============================================================================

process.env.MAKO_DOER_VENTANA_MS = '0';
import { db, correrDespues, decirResultado, escenaNueva, red, aEvolution, alModelo, CREDITO2, OPENAI_NEGOCIO, PLATAFORMA } from './_grupos-ops-arnes';
import { decirYSalir } from './_salir-cuando-salio';

const WS = 1;
const JID = '120363411646661065@g.us';
const JID_SUPER = '120363413270045136@g.us';
const LINEA = 'mako_superadmin_muylqv8r';
const LID = '209130681839667';
const MIN = 60_000;
const clase = (c: string) => JSON.stringify({ clase: c, resumen: 'pide prender los correos', reenviado: false });
/** Un id de Evolution (cuid de Prisma) con la hora de guardado que se pide: «c» + ms en base 36 + 16 de relleno. */
const cuid = (guardadoMs: number, i: number) => `c${guardadoMs.toString(36).padStart(8, '0')}${String(i).padStart(4, '0')}o05r${'k'.repeat(8)}`;
const seg = (ms: number) => Math.floor(ms / 1000);

// El store de la voz, como estaba (lo que importa de cada fila: quién, cómo llegó, cuándo se escribió y cuándo se guardó).
const store: Array<Record<string, unknown>> = [];
function armarStore(ahora: number): void {
  store.splice(0);
  const lote = ahora - 5 * MIN; // la re-vinculación
  const historial = (id: string, texto: string, escritoHaceMin: number, i: number, message: Record<string, unknown> = { conversation: texto }) =>
    store.push({ id: cuid(lote, i), key: { id, fromMe: false, remoteJid: JID }, pushName: LID, messageType: Object.keys(message)[0], message, messageTimestamp: seg(ahora - escritoHaceMin * MIN), source: 'unknown' });
  // Lo que SÍ llegó por el webhook (el del 12/11 05:44, entregado a las 11:47): trae su `participant` y su nombre.
  store.push({ id: cuid(ahora - 12 * 60 * MIN, 1), key: { id: '3B38BD8EE406794AB38A', fromMe: false, remoteJid: JID, participant: `${LID}@lid`, participantAlt: '5216862168122@s.whatsapp.net' }, pushName: 'Mauricio Bustos Eguía', messageType: 'conversation', message: { conversation: 'mako por favor abre la capacidad de envío de correos diarios' }, messageTimestamp: seg(ahora - 18 * 60 * MIN) });
  // Lo que trajo el historial al re-vincular: una segunda fila de ése (el mismo id), el 12/11 (22 a 21 h antes) y el 13/11 (74 y 73 min).
  historial('3B38BD8EE406794AB38A', 'mako por favor abre la capacidad de envío de correos diarios', 18 * 60, 9);
  historial('3B200FF84805DFDAFC70', 'Asunto: Subir el tope de envío de email por día (hoy limitado a 500)', 22 * 60, 2);
  historial('3B62C3A6EAE4D318FCD6', 'Mako me confirmas que esta conectado y llegando mi solicitud ?', 22 * 60 - 5, 3);
  historial('3BE0210B53EADBCD2A08', 'alguna respuesta ?', 21 * 60, 10);
  historial('2AB34FBF25628F530DF5', '', 78, 4, { protocolMessage: { type: 0 }, messageContextInfo: {} });
  historial('3BE0B711A755D03C983C', 'Los envios por correo son muy importantes para el seguimiento de los leads, veo que los desconectaste sin una razon real.', 74, 5);
  historial('3BCB793D4ADA6C2873DD', 'Por ejemplo de los 67 nuevos leads, cuantos les enviamos ya correo, cuantos lo abrieron ?', 73, 6);
  // La copia de lo que MaKo mandó, que el historial también trae: no es de una persona.
  store.push({ id: cuid(lote, 7), key: { id: '3EB0912C23F04F40C74A3B', fromMe: true, remoteJid: JID }, pushName: 'Você', messageType: 'conversation', message: { conversation: '👨‍💻 *Equipo de MaKo*\n\nMauricio, perdón por no contestarte.' }, messageTimestamp: seg(ahora - 17 * 60 * MIN) });
  // Algo que una persona escribió ayer y la línea guardó hace 3 h: ya no es «hace poco», no se toca.
  store.push({ id: cuid(ahora - 3 * 60 * MIN, 8), key: { id: '3BAA00000000000000AA', fromMe: false, remoteJid: JID }, pushName: LID, messageType: 'conversation', message: { conversation: 'mensaje viejo del historial' }, messageTimestamp: seg(ahora - 26 * 60 * MIN) });
}

const fetchDelArnes = globalThis.fetch;
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'evolution.test' && u.pathname.startsWith('/chat/findMessages/')) {
    red.push({ host: u.host, camino: u.pathname, cuerpo: typeof init.body === 'string' ? init.body : '' });
    const pedido = JSON.parse(String(init.body ?? '{}')) as { where?: { key?: { remoteJid?: string } } };
    const jid = pedido.where?.key?.remoteJid;
    const filas = store.filter((r) => !jid || (r.key as { remoteJid?: string }).remoteJid === jid);
    return new Response(JSON.stringify({ messages: { total: filas.length, pages: 1, currentPage: 1, records: filas } }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return fetchDelArnes(entrada, init);
}) as typeof fetch;

async function main() {
  db.workspaces.push({ id: PLATAFORMA, capa: 'superadmin', nombre: 'MaKo', estado: 'activo' }, { id: WS, capa: 'cliente', nombre: 'Mauricio Bustos', estado: 'activo' });
  db.app_settings.push(
    { workspace_id: WS, key: 'mako.grupo_jid', value: JID },
    { workspace_id: PLATAFORMA, key: 'mako.grupo_jid', value: JID_SUPER },
    { workspace_id: 1, key: 'mako.superadmin.grupo_jid', value: JID_SUPER },
    { workspace_id: 1, key: 'mako.voz.instancia', value: LINEA },
    { workspace_id: 1, key: 'mako.canal.instancia', value: LINEA },
  );
  const { cifrarSecreto } = await import('../lib/credenciales');
  db.credenciales.push(
    { workspace_id: WS, clave: 'OPENAI_API_KEY', valor_enc: cifrarSecreto(OPENAI_NEGOCIO, WS, 'OPENAI_API_KEY'), servicio: 'openai' },
    { workspace_id: PLATAFORMA, clave: 'ANTHROPIC_CREDITO_CUENTA2', valor_enc: cifrarSecreto(CREDITO2, PLATAFORMA, 'ANTHROPIC_CREDITO_CUENTA2'), servicio: 'anthropic' },
  );
  const ahora = Date.now();
  armarStore(ahora);
  // El que llegó por el webhook está en el hilo de la app (el espejo lo escribió al llegar).
  db.grupo_mensajes.push({ id: 1, workspace_id: WS, autor_tipo: 'persona', autor_nombre: 'Mauricio Bustos Eguía', canal: 'whatsapp', texto: 'mako por favor abre la capacidad de envío de correos diarios', wa_message_id: '3B38BD8EE406794AB38A', wa_at: new Date(ahora - 18 * 60 * MIN).toISOString(), created_at: new Date(ahora - 12 * 60 * MIN).toISOString(), adjunto: null, responde_a: null, reaccion: null });

  const { rescatarDelStore, flushHuerfanos } = await import('../lib/mako-doer-in');
  const out: Record<string, unknown> = {};
  const textos = (camino: string, jid: string) => red.filter((x) => x.camino.includes(camino) && x.cuerpo.includes(jid)).map((x) => String((JSON.parse(x.cuerpo) as { text?: string }).text ?? ''));
  const reaccionadas = () => red.filter((x) => x.camino.includes('/message/sendReaction/')).map((x) => String((JSON.parse(x.cuerpo) as { key?: { id?: string } }).key?.id ?? ''));
  const cola = () => db.mako_doer_buffer.map((f) => ({ id: f.wa_message_id, estado: f.estado, participant: ((f.payload as { key?: { participant?: string } }).key ?? {}).participant, nombre: (f.payload as { pushName?: string }).pushName, instancia: (f.payload as { instance?: string }).instance }));
  const hilo = () => db.grupo_mensajes.filter((f) => f.workspace_id === WS).map((f) => ({ wa: f.wa_message_id, autor: f.autor_tipo, nombre: f.autor_nombre, canal: f.canal }));

  // ── 1. La primera vuelta del cron después de la re-vinculación ──
  escenaNueva({ clase: clase('PREGUNTA'), respuesta: 'Mauricio, ya veo lo de tus correos.' });
  const r1 = await rescatarDelStore(ahora);
  await correrDespues();
  out.primera = {
    r: r1, cola: cola(), hilo: hilo(), reacciones: reaccionadas(),
    superAdmin: textos('/message/sendText/', JID_SUPER), alGrupo: textos('/message/sendText/', JID), modelo: alModelo().length,
  };

  // ── 2. La vuelta siguiente: nada nuevo, ni otro aviso ──
  escenaNueva({ clase: clase('PREGUNTA'), respuesta: 'Mauricio, ya veo lo de tus correos.' });
  const r2 = await rescatarDelStore(ahora + 10 * MIN);
  await correrDespues();
  out.segunda = { r: r2, superAdmin: textos('/message/sendText/', JID_SUPER).length, colaN: db.mako_doer_buffer.length, hiloN: hilo().length };

  // ── 3. doer-flush, dos minutos después: MaKo le contesta UNA vez, con los dos mensajes juntos ──
  for (const f of db.mako_doer_buffer) f.created_at = new Date(Date.now() - 3 * MIN).toISOString();
  escenaNueva({ clase: clase('PREGUNTA'), respuesta: 'Mauricio, ya veo lo de tus correos.' });
  const f3 = await flushHuerfanos();
  await correrDespues();
  const llamadas = alModelo();
  out.flush = {
    r: f3, alGrupo: textos('/message/sendText/', JID), cola: cola(), llamadas: llamadas.length,
    leyo: llamadas.map((l) => l.mensajes).join('\n'), evolution: aEvolution().filter((c) => !c.includes('findMessages')),
  };
  await decirYSalir(decirResultado(out));
}

main().catch((e) => { console.error(e); process.exit(1); });
