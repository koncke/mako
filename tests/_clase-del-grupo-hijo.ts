// =============================================================================
// Hijo de tests/clase-del-grupo.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// La clase del mensaje del grupo, decidida por la IA, por la entrada REAL (`manejarEntranteDoer`: la cola, el candado, el lote y el
// turno) en la forma de Evolution v2. El clasificador es Claude con el crédito de los grupos (la cuenta 2 de la plataforma, en el ws9,
// como producción): Anthropic de mentira contesta la clase que pone cada escena. El turno es el GPT del negocio (ws10), que contesta lo
// que pone la escena. Lo que sale a Evolution, lo que le llega a cada modelo y los tickets se ANOTAN. Los textos son los reales del
// banco (tests/fixtures/banco-grupos-2910.json), con el grupo, el `@lid` y el teléfono de mentira.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';
import { decirYSalir } from './_salir-cuando-salio';

// El turno NO espera el reloj: la ventana de silencio de verdad (8-20 s por escena, y acá son varias) hacía que este
// archivo tardara MINUTOS y el vigía de tandas de tests-afectados matara la tanda entera con 99 — ver
// lib/mako-doer-buffer.ts, «EL RELOJ DE LA VENTANA». El lote se junta igual: ya está en la cola cuando el turno espera.
process.env.MAKO_DOER_VENTANA_MS = '0';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
process.env.EVOLUTION_BASE_URL = 'http://evolution.test';
process.env.EVOLUTION_API_KEY = 'evo-de-prueba';
process.env.NEXT_PUBLIC_APP_URL = 'https://hola-mako.com';
process.env.GROQ_API_KEY = `gsk_${'p'.repeat(48)}`;
for (const k of ['GEMINI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'MAKO_EQUIPO_NOMBRES', 'ANTHROPIC_CREDITO_CUENTA1', 'ANTHROPIC_CREDITO_CUENTA2', 'ANTHROPIC_CREDITO_CUENTA3', 'ANTHROPIC_CREDITO_CUENTA4', 'ANTHROPIC_CREDITO_CUENTA5']) delete process.env[k];

const JID = '120363000000000010@g.us';
/** El grupo de SuperAdmin (la plataforma, ws9): el único donde hay DEBUG. */
const JID_PLATAFORMA = '120363000000000009@g.us';
const WS = 10;
const PLATAFORMA = 9;
const LINEA = 'mako_superadmin_x';
const LID = '70000000000010@lid';
const ALT = '5491100000010@s.whatsapp.net';
/** El teléfono de Martín (admin de MaKo): el DEBUG lo habilita quien escribe (M3 de la revisión de privacidad), no el grupo. */
const ALT_MARTIN = '5491100000001@s.whatsapp.net';
/** Alguien del grupo cuyo teléfono no está en ningún perfil: sin permiso para el «hazlo» de un pedido delegado (A2). */
const ALT_SIN_PERFIL = '5491199999999@s.whatsapp.net';
const CREDITO2 = `sk-ant-api03-credito-cuenta2-${'d'.repeat(40)}`;

let n = 0;
const pg = crearPostgrest({
  tablas: ['app_settings', 'workspaces', 'credenciales', 'mako_doer_buffer', 'mako_doer_lock', 'mako_doer_conv', 'mako_doer_enviados', 'anthropic_usage',
    'errores_app', 'tickets', 'ticket_eventos', 'mako_acciones_pendientes', 'ia_cuotas', 'ia_rebotes', 'ia_pc_dispositivos', 'no_pude', 'mako_turnos', 'usuarios'],
  defaults: (t, f) => ({ id: ++n, created_at: new Date().toISOString(), ...(t === 'mako_doer_buffer' ? { estado: 'pendiente', workspace_id: WS } : {}), ...(t === 'tickets' ? { estado: 'esperando_decision' } : {}), ...f }),
  unicos: [{ tabla: 'mako_doer_buffer', columnas: ['grupo_jid', 'wa_message_id'], donde: (f) => f.wa_message_id !== '', nombre: 'ux_doer_buffer_msg' }],
  candado: true,
  // Los pedidos del negocio (`ticketsDelNegocio`: `estado.not.in.(…)` y `and(estado.eq.resuelto,updated_at.gte."…")`): sin esto la
  // lectura caía en silencio y el bloque de pedidos salía vacío en todas las escenas.
  orCompleto: true,
});

/** Lo que hace la red en cada escena: la clase que contesta el clasificador (o que se cae), y lo que contesta el turno. */
/** `herramienta` (29/10/2026, la llamada con Thiago): la PRIMERA llamada del turno pide esa herramienta (un `tool_call` de OpenAI) y la
 *  segunda contesta `respuesta`; así el turno real corre la herramienta del registro. */
const escena: { clase: string; claseCaida: boolean; respuesta: string; herramienta?: { nombre: string; args: Record<string, unknown> } } = { clase: '', claseCaida: false, respuesta: '' };
let llamadasAlTurno = 0;
const red: Array<{ host: string; camino: string; cuerpo: string; clave?: string }> = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  red.push({ host: u.host, camino: u.pathname, cuerpo: typeof init.body === 'string' ? init.body : '', clave: new Headers(init.headers).get('x-api-key')?.slice(0, 29) });
  const r = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  if (u.host === 'evolution.test') return r(200, { key: { id: `env-${red.length}` } });
  // El clasificador: Claude con el crédito de los grupos.
  if (u.host === 'api.anthropic.com') {
    if (escena.claseCaida || new Headers(init.headers).get('x-api-key') !== CREDITO2) return r(500, { type: 'error', error: { type: 'api_error', message: 'Overloaded' } });
    let modelo = '';
    try { modelo = String(JSON.parse(String(init.body ?? '{}')).model ?? ''); } catch { /* sin cuerpo */ }
    return r(200, { id: 'msg_1', type: 'message', role: 'assistant', model: modelo, stop_reason: 'end_turn', content: [{ type: 'text', text: escena.clase }], usage: { input_tokens: 900, output_tokens: 40 } });
  }
  // El turno: la IA del negocio (su GPT).
  if (u.host === 'api.openai.com' && u.pathname.endsWith('/chat/completions')) {
    if (escena.herramienta && ++llamadasAlTurno === 1) {
      const call = { id: 'call_1', type: 'function', function: { name: escena.herramienta.nombre, arguments: JSON.stringify(escena.herramienta.args) } };
      return r(200, { id: 'c0', object: 'chat.completion', model: 'gpt-4o-mini', choices: [{ index: 0, message: { role: 'assistant', content: null, tool_calls: [call] }, finish_reason: 'tool_calls' }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } });
    }
    return r(200, { id: 'c1', object: 'chat.completion', model: 'gpt-4o-mini', choices: [{ index: 0, message: { role: 'assistant', content: escena.respuesta }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } });
  }
  return r(500, { error: { message: 'red de mentira' } });
}) as typeof fetch;

const VIDEO_B64 = Buffer.from('video de prueba').toString('base64');
const real = (id: string, ts: number, t: string, jid = JID, video = false, alt = ALT) => ({
  key: { id, fromMe: false, remoteJid: jid, participant: LID, addressingMode: 'lid', participantAlt: alt },
  source: 'web', status: 'DELIVERY_ACK',
  message: video ? { videoMessage: { caption: t, mimetype: 'video/mp4', base64: VIDEO_B64 }, messageContextInfo: { threadId: [] } } : { conversation: t, messageContextInfo: { threadId: [] } },
  instance: LINEA, pushName: 'Leandro', instanceId: 'e0000000-0000-0000-0000-000000000010', messageType: 'conversation', messageTimestamp: ts,
});

async function main() {
  pg.db.workspaces.push({ id: PLATAFORMA, capa: 'superadmin', nombre: 'MaKo' }, { id: WS, capa: 'cliente', nombre: 'Fiesta Music' }, { id: 1, capa: 'cliente', nombre: 'Dueño' });
  pg.db.app_settings.push({ workspace_id: WS, key: 'mako.grupo_jid', value: JID }, { workspace_id: PLATAFORMA, key: 'mako.grupo_jid', value: JID_PLATAFORMA }, { workspace_id: 1, key: 'mako.voz.instancia', value: LINEA });
  // Martín (admin de MaKo) y Leandro (admin de su negocio): los teléfonos en el perfil, como producción (`identidadDelActor`).
  pg.db.usuarios.push(
    { id: 501, email: 'martin@mako.test', nombre: 'Martín', rol: 'admin', estado: 'activo', workspace_id: PLATAFORMA, rol_ws: null, perfil: { telefono: '+54 9 11 0000-0001' } },
    { id: 510, email: 'leandro@fiesta.test', nombre: 'Leandro', rol: 'usuario', estado: 'activo', workspace_id: WS, rol_ws: 'admin', perfil: { telefono: '+54 9 11 0000-0010' } },
  );
  const { cifrarSecreto } = await import('../lib/credenciales');
  const OPENAI = `sk-proj-${'T3BlbkFJ'.repeat(4)}${'x9Y8z7W6'.repeat(5)}`;
  pg.db.credenciales.push(
    { workspace_id: WS, clave: 'OPENAI_API_KEY', valor_enc: cifrarSecreto(OPENAI, WS, 'OPENAI_API_KEY'), servicio: 'openai' },
    // El crédito de los grupos: la cuenta 2 de la plataforma, como producción.
    { workspace_id: PLATAFORMA, clave: 'ANTHROPIC_CREDITO_CUENTA2', valor_enc: cifrarSecreto(CREDITO2, PLATAFORMA, 'ANTHROPIC_CREDITO_CUENTA2'), servicio: 'anthropic' },
  );
  const { manejarEntranteDoer } = await import('../lib/mako-doer-in');

  const out: Record<string, unknown> = {};
  const salio = () => red.filter((x) => x.camino.includes('/message/sendText/')).map((x) => String((JSON.parse(x.cuerpo || '{}') as { text?: string }).text ?? ''));
  const turno = () => red.filter((x) => x.host === 'api.openai.com' && x.camino.endsWith('/chat/completions')).map((x) => {
    const b = JSON.parse(x.cuerpo) as { messages: Array<{ role: string; content: unknown }>; tools?: Array<{ function?: { name?: string } }> };
    return {
      system: String(b.messages.find((m) => m.role === 'system')?.content ?? ''), tools: (b.tools ?? []).map((t) => t.function?.name ?? ''),
      deHerramientas: b.messages.filter((m) => m.role === 'tool').map((m) => String(m.content ?? '')),
      usuario: String([...b.messages].reverse().find((m) => m.role === 'user')?.content ?? '').slice(0, 2000),
    };
  });
  const clasificador = () => red.filter((x) => x.host === 'api.anthropic.com').map((x) => {
    const b = JSON.parse(x.cuerpo || '{}') as { model?: string; system?: unknown; messages?: Array<{ content: unknown }> };
    return { modelo: b.model ?? '', clave: x.clave, mensaje: JSON.stringify(b.messages?.[0]?.content ?? '').slice(0, 400) };
  });
  // Una hora reciente: lo que llega con más de 6 h de atraso no lo atiende MaKo sola (lib/linea-demora.ts, 10/11/2026).
  let ts = Math.floor(Date.now() / 1000) - 3600;
  const correr = async (k: string, e: Partial<typeof escena>, texto: string, { limpiar = true, jid = JID, antes, video = false, alt = ALT }: { limpiar?: boolean; jid?: string; antes?: () => void; video?: boolean; alt?: string } = {}) => {
    Object.assign(escena, { clase: '', claseCaida: false, respuesta: '', herramienta: undefined }, e);
    llamadasAlTurno = 0;
    red.splice(0);
    if (limpiar) { pg.db.mako_doer_conv.splice(0); pg.db.tickets.splice(0); }
    antes?.();
    pg.db.mako_doer_lock.splice(0);
    const r = await manejarEntranteDoer(LINEA, real(`3EB0CLASE${String(++ts).slice(-10)}`, ts, texto, jid, video, alt) as never);
    out[k] = {
      r, salio: salio(), turno: turno(), clasificador: clasificador(),
      reacciones: red.filter((x) => x.camino.includes('/message/sendReaction/')).length,
      tickets: pg.db.tickets.map((t) => ({
        id: t.id, tipo: t.tipo ?? null, titulo: t.titulo, descripcion: t.descripcion, contexto: t.contexto, estado: t.estado, despacho: t.despacho ?? null,
        email: t.usuario_email ?? null, porque: ((t.triage as { porque?: string[] } | null)?.porque ?? []).join(' '),
      })),
      pendientes: pg.db.mako_acciones_pendientes.map((p) => ({ tipo: p.tipo, resumen: p.resumen })),
    };
  };

  // TICKET (el «solamente soluciona estos problemas» de Leandro, 1718): lo abre el código, sin turno, con la respuesta fija.
  await correr('ticket', { clase: '{"clase":"TICKET","resumen":"Arreglar los dos problemas de la automatización 680","reenviado":false,"secundaria":null}' },
    'no entiendo eso, solamente soluciona estos problemas porfa');
  // …y lo que sigue, recién nombrado el ticket: se SUMA a ése.
  await correr('sumado', { clase: '{"clase":"TICKET","resumen":"El DM de rechazo tampoco sale","reenviado":false}' },
    'y además el DM de rechazo tampoco sale', { limpiar: false });
  // CHARLA: el 👍 y nada más (los «Bien ahí por la velocidad» de la semana).
  // ⚠️ CAMBIADO A PROPÓSITO el 12/11/2026: el mensaje era «Excelente, ya le escribimos al propietario, gracias», que trae un dato, y Martín:
  // «no tomes absolutamente nada como charla del tipo gracias, ok, al menos que sean literalmente del tipo gracias, ok» (lib/doer-para-quien.ts,
  // `charlaQueCalla`). Ahora ese se contesta; lo que esta escena fija es la charla literal.
  await correr('charla', { clase: '{"clase":"CHARLA","resumen":"agradece","reenviado":false}', respuesta: 'Bien ahí por la velocidad. Anota esto…' },
    'Excelente, gracias por la velocidad');
  // NO_REPLY: le habla a otra persona del grupo.
  await correr('noReply', { clase: '{"clase":"NO_REPLY","resumen":"le contesta a otra persona","reenviado":false}', respuesta: 'Tiene todo el sentido separar las aguas…' },
    'basicamente si, despues creamos otro grupo, este es para cuando lleguen los leads');
  // PREGUNTA: el turno corre sólo con lecturas, con su bloque, y la muletilla no sale.
  await correr('pregunta', { clase: '{"clase":"PREGUNTA","resumen":"cuántos leads entraron hoy","reenviado":false}', respuesta: 'Te voy a ser directo: hoy no entró ningún lead nuevo.' },
    '¿cuántos leads entraron hoy?');
  // PREGUNTA que además reporta: se contesta y el ticket se abre igual, con su línea.
  await correr('preguntaYTicket', { clase: '{"clase":"PREGUNTA","resumen":"El botón de pagar no anda","reenviado":false,"secundaria":"TICKET"}', respuesta: 'Hoy no entró ningún lead nuevo.' },
    '¿cuántos leads entraron hoy? y el botón de pagar no anda');
  // Una PREGUNTA que afirma un número que no vio (ninguna herramienta lo devolvió): no sale.
  await correr('inventado', { clase: '{"clase":"PREGUNTA","resumen":"cuántos leads entraron hoy","reenviado":false}', respuesta: 'Hoy entraron 137 leads, 12 más que ayer.' },
    '¿cuántos leads entraron hoy?');
  // ACCIÓN: el turno corre con las lecturas y las escrituras SIMPLES; si pregunta un dato que falta, sale su pregunta.
  await correr('accionPregunta', { clase: '{"clase":"ACCION","resumen":"Agendar una reunión con Juan el viernes","reenviado":false}', respuesta: '¿A qué hora la agendo?' },
    'agéndame una reunión con Juan Pérez el viernes');
  // ACCIÓN que MaKo no hizo (ni propuso ni escribió nada): no sale su texto, se DELEGA como pedido.
  await correr('accionDelegada', { clase: '{"clase":"ACCION","resumen":"Crear una automatización de bienvenida para los leads nuevos","reenviado":false}', respuesta: 'Listo, ya quedó creada la automatización de bienvenida.' },
    'créame una automatización que le dé la bienvenida a los leads nuevos');
  // Lo SEGURO (una landing), pedido por un admin del negocio (Leandro): sigue por su regla, con el «hazlo».
  await correr('delegadoSeguro', { clase: '{"clase":"ACCION","resumen":"Duplicar la landing del webinar con el título Masterclass","reenviado":false}', respuesta: 'Listo, ya quedó duplicada la landing.' },
    'duplícame la landing del webinar con el título Masterclass');
  // A2 (la revisión de privacidad): un pedido delegado con PLATA espera a Martín aunque el negocio tenga su regla (Leandro).
  await correr('delegadoPlata', { clase: '{"clase":"ACCION","resumen":"Subirle el presupuesto a la campaña Verano a 50 dólares","reenviado":false}', respuesta: 'Listo, ya le subí el presupuesto a 50 dólares.' },
    'súbele el presupuesto a la campaña Verano a 50 dólares por día');
  // …y uno sin plata, pedido por alguien del grupo que no está en ningún perfil del negocio: también espera a Martín.
  await correr('delegadoSinPermiso', { clase: '{"clase":"ACCION","resumen":"Crear una automatización de bienvenida para los leads nuevos","reenviado":false}', respuesta: 'Listo, ya quedó creada la automatización de bienvenida.' },
    'créame una automatización que le dé la bienvenida a los leads nuevos', { alt: ALT_SIN_PERFIL });
  // DEBUG en el grupo de SuperAdmin: sin decir de qué negocio, lo pregunta el código (sin turno).
  await correr('debugSinNegocio', { clase: '{"clase":"DEBUG","resumen":"Ver por qué a un cliente no le conecta Facebook","reenviado":true,"negocio":null}', respuesta: 'Te doy un consejo genérico.' },
    'Che Tincho, te hago una consulta: pegué el token del pixel y le doy a conectar Facebook y no me hace nada', { jid: JID_PLATAFORMA, alt: ALT_MARTIN });
  // DEBUG con el negocio: lo mira `diagnosticar_negocio` (con la base de mentira, no lo encuentra) y lo dice el código.
  await correr('debugNegocio', { clase: '{"clase":"DEBUG","resumen":"Ver qué le pasa a Leila con Facebook","reenviado":false,"negocio":"Leila"}', respuesta: 'Te doy un consejo genérico.' },
    'fíjate por qué a Leila no le conecta Facebook', { jid: JID_PLATAFORMA, alt: ALT_MARTIN });
  // M3 (la revisión de privacidad): en el grupo de la plataforma, el DEBUG de alguien que NO es admin de MaKo es una PREGUNTA, y el
  // modelo no tiene `diagnosticar_negocio` (los grupos de prueba de la allowlist también dan la plataforma).
  await correr('debugDeOtro', { clase: '{"clase":"DEBUG","resumen":"Ver qué le pasa a Leila con Facebook","reenviado":false,"negocio":"Leila"}', respuesta: 'No lo puedo ver desde aquí.' },
    'fíjate por qué a Leila no le conecta Facebook', { jid: JID_PLATAFORMA });
  // Un DEBUG fuera del grupo de SuperAdmin es una PREGUNTA (el deny gana): corre el turno, sólo con lecturas.
  await correr('debugAfuera', { clase: '{"clase":"DEBUG","resumen":"Ver qué le pasa a Leila","reenviado":false,"negocio":"Leila"}', respuesta: 'No lo puedo ver desde acá.' },
    'fíjate por qué a Leila no le conecta Facebook');
  // El #30 de Leandro (29/10/2026): una PREGUNTA por el estado de un arreglo, con el pedido resuelto y su hito en la bitácora de
  // mako-doer (`tickets: [30]`). El modelo contesta lo que contestó en producción: «no tengo acceso» y un «ya quedó reportado» falso.
  await correr('estadoArreglo', {
    clase: '{"clase":"PREGUNTA","resumen":"si actualizó la documentación de la API","reenviado":false}',
    respuesta: 'No tengo acceso directo para editar la documentación de la API desde aquí. Ya quedó reportado al equipo de desarrollo para que actualicen los detalles de las palabras clave y los botones.',
  }, 'lo actulizaste en la documentación api?', {
    antes: () => pg.db.tickets.push({
      id: 30, workspace_id: WS, estado: 'resuelto', tipo: 'bug', titulo: 'MaKo no pudo hacer lo que le pidieron, en WhatsApp',
      respuesta: 'Ya está arreglado: Automations: «Ya te sigo» vuelve a preguntar y entrega el recurso.', canal: 'whatsapp',
      created_at: new Date(Date.now() - 3600_000).toISOString(), updated_at: new Date().toISOString(),
    }),
  });
  // LA LLAMADA CON THIAGO (29/10/2026, docs/promesas/2910-llamada-thiago.md): «replicame esta landing» desde el grupo la hace MaKo (la
  // propone y la arma con el «sí»), no la delega. El turno pide `replicar_landing` y el registro deja la pendiente.
  await correr('replicarLanding', {
    clase: '{"clase":"ACCION","resumen":"Replicar la landing de ejemplo.com","reenviado":false}',
    herramienta: { nombre: 'replicar_landing', args: { url: 'https://ejemplo.com/oferta', formato: 'landing' } },
    respuesta: 'Te dejo la réplica de la landing propuesta: respóndeme «sí» y la armo.',
  }, 'replícame esta landing https://ejemplo.com/oferta en formato landing');
  // Pausar una campaña y cambiarle el presupuesto: las dos herramientas viajan en el turno (la pausa directa, el presupuesto por pantalla).
  await correr('campanas', {
    clase: '{"clase":"ACCION","resumen":"Pausar la campaña Verano y subirle el presupuesto","reenviado":false,"partes":["pausar la campaña Verano","subirle el presupuesto a 50 por día"]}',
    respuesta: '¿Cuál campaña Verano, la de Meta o la de Google?',
  }, 'pausame la campaña Verano y subile el presupuesto a 50 por día');
  // EL PEDIDO COMPUESTO: hace lo que puede (la réplica) y lo demás (la automatización) lo delega, con lo que ya hizo. Nunca en silencio.
  await correr('compuesto', {
    clase: '{"clase":"ACCION","resumen":"Replicar una landing y crear una automatización","reenviado":false,"partes":["replicar la landing https://ejemplo.com/oferta","crear una automatización de bienvenida"]}',
    herramienta: { nombre: 'replicar_landing', args: { url: 'https://ejemplo.com/oferta', formato: 'landing' } },
    respuesta: 'Te dejo la réplica de la landing propuesta.',
  }, 'replícame https://ejemplo.com/oferta como landing y además créame una automatización de bienvenida para los leads nuevos');
  // «SÚBEME ESTE ANUNCIO» CON UN VIDEO (29/10/2026, la llamada con Thiago): el doer acepta el videoMessage, el turno pide
  // `proponer_anuncio_desde_archivo` y, con ZERNIO_ANUNCIOS_PROBADO apagada, la operación dice que falta la prueba (no baja ni sube nada).
  await correr('anuncioVideo', {
    clase: '{"clase":"ACCION","resumen":"Subir el video como anuncio en el conjunto 120210000000000001","reenviado":false}',
    herramienta: { nombre: 'proponer_anuncio_desde_archivo', args: { adsetId: '120210000000000001', nombre: 'Video fiesta', origen: 'mensaje', primary_text: 'Ven a la fiesta', destination_url: 'https://fiestamusic.com' } },
    respuesta: 'Todavía no puedo subir un anuncio desde un archivo: falta la prueba de anuncios por Zernio. Mientras, súbelo desde el Media Buyer.',
  }, 'súbeme este video como anuncio en el conjunto 120210000000000001, que lleve a https://fiestamusic.com', { video: true });
  // Una respuesta que era TODO relleno: no sale nada (va la reacción).
  await correr('relleno', { clase: '{"clase":"PREGUNTA","resumen":"cómo va","reenviado":false}', respuesta: 'Excelente, quedo atento.' },
    '¿cómo vamos con lo de la campaña?');
  // El clasificador CAÍDO: mandan las reglas, el turno de siempre.
  await correr('caido', { claseCaida: true, respuesta: 'Hoy entraron 3 leads.' }, '¿cuántos leads entraron hoy?');
  decirYSalir(`@@CLASE@@${JSON.stringify(out)}\n`);
}

main().then(() => decirYSalir(''), (e) => decirYSalir(`@@CLASE@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}\n`));
