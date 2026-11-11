// =============================================================================
// Hijo de tests/grupo-leandro-2910.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// La charla de MaKo con Leandro (ws10, Fiesta Music) del 28/10 13:21 al 29/10 05:58, por la entrada REAL del grupo
// (`manejarEntranteDoer`: la cola, el candado, el lote y el turno) con los payloads REALES de `mako_doer_buffer` (316, 317, 330,
// 331, 335 y 336) en la forma de Evolution v2: `message.conversation` y la cita en el `contextInfo` de ARRIBA. Anonimizados: el
// grupo, el `@lid`, el teléfono y el audio (el de Leandro es su voz: va un ogg de mentira). Los textos son los suyos, tal cual.
// El modelo es la IA del negocio de mentira (su GPT): contesta lo que MaKo contestó de verdad en producción (1676, 1682, 1700), y
// se anota lo que le llegó (el system, lo que escribió la persona y las herramientas). La base, un PostgREST de mentira con el
// candado. Lo que sale a Evolution se ANOTA.
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
for (const k of ['GEMINI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'MAKO_EQUIPO_NOMBRES']) delete process.env[k];

const JID = '120363000000000010@g.us';
const WS = 10;
const LINEA = 'mako_superadmin_x';
const LID = '70000000000010@lid';
const ALT = '5491100000010@s.whatsapp.net';
const AUDIO_327 = '2A81E060BE438F478D26';
/** Un ogg de mentira: la cabecera de un Opus y nada más (la voz de Leandro no entra a un test). */
const OGG = Buffer.from('OggS\0\x02\0\0\0\0\0\0\0\0OpusHead\x01\x01').toString('base64');

let n = 0;
const pg = crearPostgrest({
  tablas: ['app_settings', 'workspaces', 'credenciales', 'mako_doer_buffer', 'mako_doer_lock', 'mako_doer_conv', 'mako_doer_enviados', 'anthropic_usage',
    'errores_app', 'tickets', 'tickets_eventos', 'mako_acciones_pendientes', 'ia_cuotas', 'ia_rebotes', 'ia_pc_dispositivos', 'no_pude', 'mako_turnos'],
  defaults: (t, f) => ({ id: ++n, created_at: new Date().toISOString(), ...(t === 'mako_doer_buffer' ? { estado: 'pendiente', workspace_id: WS } : {}), ...f }),
  unicos: [{ tabla: 'mako_doer_buffer', columnas: ['grupo_jid', 'wa_message_id'], donde: (f) => f.wa_message_id !== '', nombre: 'ux_doer_buffer_msg' }],
  candado: true,
});

/** Lo que hace la red en cada escena: si Groq escucha, lo que contesta el modelo, y si la IA del negocio está caída. */
const escena = { escucha: true, transcripcion: '', respuesta: '', iaCaida: false };
const red: Array<{ host: string; camino: string; cuerpo: string }> = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  red.push({ host: u.host, camino: u.pathname, cuerpo: typeof init.body === 'string' ? init.body : '' });
  const r = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  // Evolution tiene la nota de voz CITADA (la 327, por el id de la cita).
  if (u.host === 'evolution.test' && u.pathname.includes('getBase64FromMediaMessage')) {
    return String(init.body ?? '').includes(AUDIO_327) ? r(200, { base64: OGG, mimetype: 'audio/ogg; codecs=opus' }) : r(404, { error: 'no está' });
  }
  if (u.host === 'evolution.test') return r(200, { key: { id: `env-${red.length}` } });
  // Escuchar: el Groq de la plataforma y el Whisper de su GPT.
  if (u.pathname.endsWith('/audio/transcriptions')) {
    return escena.escucha ? r(200, { text: escena.transcripcion, duration: 94 }) : r(500, { error: { message: 'se cayó' } });
  }
  // La IA del negocio (su GPT): contesta el turno con lo que MaKo contestó en producción.
  if (u.host === 'api.openai.com' && u.pathname.endsWith('/chat/completions')) {
    if (escena.iaCaida) return r(503, { error: { message: 'The server is overloaded' } });
    return r(200, { id: 'c1', object: 'chat.completion', model: 'gpt-4o-mini', choices: [{ index: 0, message: { role: 'assistant', content: escena.respuesta }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } });
  }
  return r(500, { error: { message: 'red de mentira' } });
}) as typeof fetch;

/** Un mensaje de Leandro en la forma REAL de Evolution v2 (la de `mako_doer_buffer.payload`). */
// La hora de WhatsApp de cada mensaje real, corrida a AHORA con el orden de siempre (comprimida 20 veces): lo que llega con más de
// 6 h de atraso no lo atiende MaKo sola (lib/linea-demora.ts, 10/11/2026), y estas horas son del 28-29/10.
const reciente = (ts: number): number => Math.floor(Date.now() / 1000) - Math.round((1793260000 - ts) / 20);
const real = (id: string, ts: number, message: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  key: { id, fromMe: false, remoteJid: JID, participant: LID, addressingMode: 'lid', participantAlt: ALT },
  source: 'web', status: 'DELIVERY_ACK',
  message: { ...message, messageContextInfo: { threadId: [] } },
  instance: LINEA, pushName: 'Leandro', instanceId: 'e0000000-0000-0000-0000-000000000010',
  messageType: message.audioMessage ? 'audioMessage' : 'conversation', messageTimestamp: reciente(ts),
  ...extra,
});
const texto = (id: string, ts: number, t: string, extra: Record<string, unknown> = {}) => real(id, ts, { conversation: t }, extra);

// ── Los textos de Leandro, tal cual (mako_doer_buffer, ws10) ──────────────────────────────────────────────────────────────
const T317 = 'Tal cual como lo hace manychat';
const T330 = 'No me respondiste lo de este audio';
const T331 = "Hola Martin, probamos la automatización sec=680 («Comentario con 'pruebafm' en Instagram») en vivo y no mandó ningún DM.\n\nQué pasa: el disparador «El usuario comenta tu publicación o Reel» no tiene campo de palabra clave, y entre las condiciones tampoco hay ninguna para el texto del comentario. La IA del lienzo usó «Respuesta del formulario contiene «pruebafm»», pero un comentario no es una respuesta de formulario. Los dos comentarios de prueba (@aliensfilms y @martin.koncke, 28-oct) entraron a la secuencia y terminaron en «Si no → Termina», sin enviar ningún paso.\n\nEsperado: poder decir «solo cuando el comentario contiene X», con varias palabras y, si se puede, sin distinguir mayúsculas ni tildes. Si es posible, también elegir en qué publicación o Reel.\n\nDos dudas más:\n\nMientras no haya filtro, cada comentario en cualquier publicación crea un lead y lo inscribe en la secuencia. ¿Es así?\nSegún la API, «un lead no vuelve a entrar a una secuencia en la que ya estuvo». ¿Cómo hacemos para que esas dos cuentas de prueba puedan volver a probar la 680?";
const T335 = "Hola Martin, gracias por avisar lo del filtro. Lo fuimos a buscar y no lo encontramos, así que te paso todo lo que nos falta para lanzar la automatización sec=680 («Comentario con 'pruebafm' en Instagram»):\n\n1. El filtro por palabra clave en comentarios no nos aparece. Entré como admin. En el disparador «El usuario comenta tu publicación o Reel» solo veo los subtipos y «+ Nuevo CRON», sin ningún campo de palabra clave. En Configuraciones están Horario de oficina, Goteo y Tope por día. En las condiciones, si busco «comentario» o «palabra» no aparece nada. Por API, el disparador de la 680 sigue sin campo de palabra clave y en /docs no se menciona. ¿Dónde quedó? ¿Hay que hacer algo para que aparezca en nuestra cuenta? Lo que necesitamos: que el flujo arranque solo cuando el comentario contiene una palabra (mejor si acepta varias), que no distinga mayúsculas ni tildes y, si se puede, elegir en qué publicación o Reel.\n\n2. Responder públicamente al comentario. (lo mandé el 26-oct) El nodo Instagram solo manda DM. Necesitamos poder contestar el comentario que disparó el flujo, por ejemplo «¡Enviado! Revisá tus DMs».\n\n3. El nombre del botón pierde los espacios al tipear. (lo mandé el 26-oct) Si escribo «Obtener recurso» en «+ Botón», queda «Obtenerrecurso». Pegándolo sí funciona.\n\n4. Dos dudas del 28-oct:\n\nMientras no haya filtro, ¿cualquier comentario en cualquier publicación crea un lead y lo mete en la secuencia?\nUn lead que ya pasó por una secuencia no vuelve a entrar. ¿Cómo hacemos para que @aliensfilms y @martin.koncke vuelvan a probar la 680?\n5. A la documentación de la API le faltan cosas. Armamos todo por API y varias veces tuvimos que terminar en el lienzo:\n\nLos botones de los DM ya estaban en el lienzo el 26-oct, pero el endpoint para cargarlos (PATCH chatbot/secuencias/{id}/mensajes/{tarjeta}) recién apareció el 27-oct. Hoy pasa lo mismo con el filtro de palabra clave: /docs y email/disparadores no lo mencionan.\nNo hay forma de sacar la flecha directa de un paso (siguiente) para que espere el toque del botón: lo tuvimos que hacer en el lienzo.\nNo hay endpoint para responder un comentario, ni para abrir un ticket de soporte.\nPATCH .../mensajes/{tarjeta} y PUT .../activacion dicen que «proponen» el cambio, pero lo guardan directo. Así parece que hace falta confirmar. ¿Pueden mantener /docs al día con lo que sale en el lienzo? Nosotros dependemos de la API para armar los 7 flujos.";
const T336 = "sumo tres cosas al mensaje de recién:\n\n1. Una corrección. Te dije que el PATCH de botones y el PUT de activación dicen «propone» pero guardan directo. Releí /docs y está bien: con token detallado se hace en el acto. Olvidá ese punto.\n\n2. Sobre el filtro por palabra clave. Vi que entre los tipos de CRM está «DM funnel (comentan una palabra clave)». ¿El filtro va por ahí, creando un CRM de ese tipo? Si es así, ¿dónde se carga la palabra? Por API, crear un CRM no pide ninguna. Además, según /docs, la ficha de la secuencia no nombra las tarjetas «Etiqueta» ni «Acción», ni dice cómo se cargan por API.\n\n3. Lo que queremos armar cuando esto ande. Los botones, las esperas, las etiquetas y las etapas por API ya los vimos y los vamos a probar nosotros. Esto no lo encontramos y no sabemos si se puede:\n\nPedirle datos al lead y guardarlos. Por ejemplo, preguntarle su Instagram o su mail en el DM y que la respuesta quede en su ficha del CRM. ¿Se puede, y en qué campo queda?\nMover al lead de etapa desde el flujo. Que cuando toca «Obtener recurso» o cuando ya nos sigue, pase solo a la etapa que corresponda. ¿Lo hace la tarjeta «Acción»?\nAvisar a otras herramientas. Un webhook de salida cuando un lead entra, cambia de etapa o recibe una etiqueta, para conectarlo con lo nuestro. En Integraciones no vimos nada para eso.\nQue el lead comparta. Algo que lo empuje a compartir el post o pasarle el link a otro, y saber si lo hizo. ¿Hay algo pensado?\nEsperas largas en Instagram. La tarjeta «Esperar» acepta horas o días, pero Instagram solo deja escribir 24 h después del último mensaje del lead. ¿Qué pasa con un paso que cae después de esa ventana?";

// ── Lo que MaKo contestó en producción (mako_doer_conv, ws10), sin la línea del ticket que agrega el código ─────────────────
const R1676 = 'Te soy directo: en este mensaje no puedo escuchar audios ni tengo la transcripción del tuyo.\n\nMándame el texto exacto de lo que dijiste o pégame lo que necesitas que veamos y te lo reviso ahora mismo.';
const R1682 = 'Te soy sincero: tienes toda la razón. El disparador de comentarios en Instagram hoy está pensado de forma muy general y, al no filtrar por palabra clave, se traga cualquier mención y se cae en el primer nodo de condición porque busca un campo de formulario que nunca va a existir.\n\nYendo a tus dos dudas:\n1. Sí, tal como lo notas, hoy cualquier comentario en cualquier publicación los mete a todos en la misma bolsa y los inscribe.\n2. Para que las cuentas de prueba vuelvan a entrar a la misma secuencia, tienes que ir a la ficha de cada lead en el CRM, buscar sus inscripciones pasadas y darles de baja o reetiquetarlos manualmente, porque el motor frena la reentrada automática para evitar bucles.';
const R1700 = 'Te entiendo perfecto y tienes toda la razón en cada punto. Cuando estás automatizando por API y dependiendo de los hilos finos, que la documentación no vaya al mismo ritmo que el lienzo te frena el desarrollo en seco.\n\n1. Sobre el filtro por palabra clave, la respuesta pública y los espacios en los botones: son limitaciones reales actuales del motor de Instagram y del panel que ya están escaladas al equipo para cerrarlas.\n2. Para que @aliensfilms y @martin.koncke puedan volver a entrar a la secuencia 680, entra a la ficha de cada uno en el CRM y borra el registro de la inscripción anterior; así el motor los deja pasar de nuevo sin bloquearlos por duplicados.\n3. Y para los baches en la documentación de la API que nos mencionas, ya queda el registro técnico para alinear los endpoints pendientes.';
/** Lo que contesta el modelo cuando no importa qué (las escenas que miran lo que le LLEGA). */
const NEUTRA = 'Soy MaKo: lo de los flujos de Instagram lo ve Martín. Por lo que veo en tu cuenta, la automatización 680 está activa.';

/** La nota de voz 316 (13:21, 9 s), con su audio adentro como la manda Evolution. */
const audio316 = () => real('2AB13825A881F1712F82', 1793193666, { base64: OGG, audioMessage: { ptt: true, seconds: 9, mimetype: 'audio/ogg; codecs=opus', contextInfo: { mentionedJid: [], groupMentions: [], statusAttributions: [] } } },
  { source: 'unknown', contextInfo: { mentionedJid: [], groupMentions: [], statusAttributions: [] } });

async function main() {
  pg.db.workspaces.push({ id: 9, capa: 'superadmin', nombre: 'MaKo' }, { id: WS, capa: 'cliente', nombre: 'Fiesta Music' }, { id: 1, capa: 'cliente', nombre: 'Dueño' });
  pg.db.app_settings.push({ workspace_id: WS, key: 'mako.grupo_jid', value: JID });
  const { cifrarSecreto } = await import('../lib/credenciales');
  const OPENAI = `sk-proj-${'T3BlbkFJ'.repeat(4)}${'x9Y8z7W6'.repeat(5)}`;
  pg.db.credenciales.push({ workspace_id: WS, clave: 'OPENAI_API_KEY', valor_enc: cifrarSecreto(OPENAI, WS, 'OPENAI_API_KEY'), servicio: 'openai' });
  const { manejarEntranteDoer } = await import('../lib/mako-doer-in');

  const out: Record<string, unknown> = {};
  const salio = () => red.filter((x) => x.camino.includes('/message/sendText/')).map((x) => String((JSON.parse(x.cuerpo || '{}') as { text?: string }).text ?? ''));
  /** Cada llamada al modelo: su system, lo último que escribió la persona y las herramientas que viajaron. */
  const alModelo = () => red.filter((x) => x.host === 'api.openai.com' && x.camino.endsWith('/chat/completions')).map((x) => {
    const b = JSON.parse(x.cuerpo) as { messages: Array<{ role: string; content: unknown }>; tools?: Array<{ function?: { name?: string } }> };
    const ms = b.messages.filter((m) => m.role === 'user');
    const c = ms[ms.length - 1]?.content;
    return { system: String(b.messages.find((m) => m.role === 'system')?.content ?? ''), persona: typeof c === 'string' ? c : JSON.stringify(c), tools: (b.tools ?? []).map((t) => t.function?.name ?? '') };
  });
  const escuchas = () => red.filter((x) => x.camino.endsWith('/audio/transcriptions')).map((x) => x.host);
  /** Una escena: limpia lo de la anterior, corre `f` y anota lo que salió, lo que vio el modelo y los tickets. */
  /** `ESCENAS=f6,f6equipo` corre sólo ésas (para mirar una sin esperar las ocho). */
  const solo = process.env.ESCENAS?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  const correr = async (k: string, e: Partial<typeof escena>, f: () => Promise<unknown>) => {
    if (solo.length && !solo.includes(k)) return;
    Object.assign(escena, { escucha: true, transcripcion: '', respuesta: NEUTRA, iaCaida: false }, e);
    red.splice(0);
    pg.db.mako_doer_conv.splice(0); pg.db.tickets.splice(0); pg.db.mako_doer_lock.splice(0);
    const r = await f();
    out[k] = {
      r, salio: salio(), modelo: alModelo(), escuchas: escuchas(), reacciones: red.filter((x) => x.camino.includes('/message/sendReaction/')).length,
      ias: red.filter((x) => x.host !== 'evolution.test').map((x) => `${x.host}${x.camino}`),
      tickets: pg.db.tickets.map((t) => ({ titulo: t.titulo, descripcion: t.descripcion, ref: t.ref })),
    };
  };

  // F1 (1702). Las cinco preguntas de «sumo tres cosas…»: ¿llega con la herramienta que arma el borrador del Plan?
  await correr('f1', {}, () => manejarEntranteDoer(LINEA, texto('3EB040F648AA5CEF526216', 1793253400, T336) as never));
  // F2 (1682). «Hola Martin, probamos la automatización…» y el modelo indica «darles de baja».
  await correr('f2', { respuesta: R1682 }, () => manejarEntranteDoer(LINEA, texto('3EB0D57F828E6C43D44774', 1793221522, T331) as never));
  // F3 (1700). «Hola Martin, gracias por avisar lo del filtro…» y el modelo afirma limitaciones, escalados y «borra el registro».
  await correr('f3', { respuesta: R1700 }, () => manejarEntranteDoer(LINEA, texto('3EB0AEE039261106E9EB73', 1793252997, T335) as never));
  // F4 (1676). «No me respondiste lo de este audio» citando la nota de voz 327 (94 s): se escucha, y el «no puedo escuchar» no sale.
  const cita = { contextInfo: { stanzaId: AUDIO_327, quotedType: 0, participant: LID, mentionedJid: [], groupMentions: [], statusAttributions: [],
    quotedMessage: { audioMessage: { ptt: true, seconds: 94, mimetype: 'audio/ogg; codecs=opus' } } } };
  await correr('f4', { transcripcion: 'Quiero que cuando comenten fiesta en un reel le responda el comentario en público y le mande el recurso por DM.', respuesta: R1676 },
    () => manejarEntranteDoer(LINEA, { ...texto('2A84FEBE22DE84119659', 1793216458, T330, cita), source: 'unknown' } as never));
  // F5 (1643). La nota de voz 316 y, 12 s después, «Tal cual como lo hace manychat» (317): un lote. Groq no escucha.
  const lote = async (idAudio: string, idTexto: string) => {
    pg.db.mako_doer_buffer.push({ id: ++n, workspace_id: WS, grupo_jid: JID, wa_message_id: idAudio, texto: '', tiene_audio: true, estado: 'pendiente',
      payload: { ...audio316(), key: { ...audio316().key, id: idAudio } }, created_at: new Date(Date.now() - 12_000).toISOString() });
    return manejarEntranteDoer(LINEA, { ...texto(idTexto, 1793193678, T317), source: 'unknown' } as never);
  };
  await correr('f5', { escucha: false }, () => lote('2AB13825A881F1712F82', '2A97BEF1E7002B485EE8'));
  // …y si Groq la escucha, lo que dice va antes del «tal cual».
  await correr('f5escucha', { transcripcion: 'Quiero que el bot responda los comentarios de Instagram.' }, () => lote('2AB13825A881F1712F8X', '2A97BEF1E7002B485EEX'));
  // F6. El mensaje para Martín, con una respuesta del modelo SIN marca: el ticket lo deja el código. Y un «gracias» suelto a Martín.
  await correr('f6', {}, () => manejarEntranteDoer(LINEA, texto('3EB0AEE039261106E9EB7X', 1793252998, T335) as never));
  await correr('f6gracias', {}, () => manejarEntranteDoer(LINEA, texto('3EB0AEE039261106E9EB7Y', 1793252999, '¡Gracias Martín!') as never));
  // F1 con la IA del negocio CAÍDA: lo que se guarda crudo como borrador del Plan es una carga, no una lista de preguntas.
  await correr('f1caida', { iaCaida: true }, () => manejarEntranteDoer(LINEA, texto('3EB040F648AA5CEF52621X', 1793253401, T336) as never));
  // La ALTA 2 de la verificación de c358fd0c4: el equipo le pregunta a Leandro por su nombre (firmado, por la línea de MaKo) y él,
  // sin citar, le PIDE algo a MaKo (su pedido real de la verificación). El turno corre y la respuesta sale al grupo.
  const { FIRMA_DESARROLLADOR } = await import('../lib/aviso-arreglo-reglas');
  await correr('alta2', {}, async () => {
    // El equipo escribe por la LÍNEA de MaKo (`mako.voz.instancia`): sin ella, su mensaje no es un eco y corre como del dueño.
    pg.db.app_settings.push({ workspace_id: 1, key: 'mako.voz.instancia', value: LINEA });
    await manejarEntranteDoer(LINEA, { key: { remoteJid: JID, id: '3EB0EQUIPO0000000000L1', fromMe: true }, instance: LINEA,
      message: { conversation: `${FIRMA_DESARROLLADOR}\nLeandro, ¿nos confirmás si el flujo es el de pruebafm?` } } as never);
    return manejarEntranteDoer(LINEA, texto('3EB0A1A2A3A4A5A6A7A8A9', 1793253500, 'Quiero que cuando comenten guía les mande el PDF por DM') as never);
  });
  // Lo REENVIADO (29/10/2026, el grupo de SuperAdmin): el mensaje de otra persona, con la marca de WhatsApp donde la trae Evolution
  // v2 (arriba). El turno lo lee como de otra persona.
  // Sin la pregunta del equipo que deja viva la escena `alta2` (lo que el equipo escribió en el grupo): con ella, el reenvío se toma
  // por la respuesta de Leandro al equipo, y esta escena mide la marca de lo reenviado, no la ALTA 2 (29/10, tests-afectados).
  await correr('reenvio', {}, () => {
    for (let i = pg.db.app_settings.length - 1; i >= 0; i--) if (String(pg.db.app_settings[i].key).startsWith('mako.equipo.')) pg.db.app_settings.splice(i, 1);
    return manejarEntranteDoer(LINEA, texto('3EB0FWD0000000000000R1', 1793253600, 'Che Tincho, le doy a conectar Facebook y no me hace nada',
      { contextInfo: { isForwarded: true, forwardingScore: 1 } }) as never);
  });
  // Una captura y un texto JUNTOS (29/10/2026, el reenvío de Martín: el audio y la captura del cliente): un lote de dos. La captura
  // se baja y se lee como una suelta; antes decía «llegó junto a otros mensajes y no la pudiste mirar».
  const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  await correr('loteImagen', { respuesta: NEUTRA }, async () => {
    pg.db.mako_doer_buffer.push({ id: ++n, workspace_id: WS, grupo_jid: JID, wa_message_id: '3EB0IMG00000000000000I1', texto: '', tiene_media: true, estado: 'pendiente',
      payload: real('3EB0IMG00000000000000I1', 1793253700, { imageMessage: { mimetype: 'image/png', caption: '' } }, { base64: PNG, messageType: 'imageMessage' }),
      created_at: new Date(Date.now() - 12_000).toISOString() });
    return manejarEntranteDoer(LINEA, texto('3EB0IMG00000000000000T1', 1793253712, 'mirá esta captura, no me deja conectar') as never);
  });
  decirYSalir(`@@LEANDRO@@${JSON.stringify(out)}\n`);
}

main().then(() => decirYSalir(''), (e) => decirYSalir(`@@LEANDRO@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}\n`));
