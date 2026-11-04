// =============================================================================
// mako-bot — el WhatsApp de MaKo cuando le escribe una PERSONA (no un grupo)
// =============================================================================
// Martín, 3/11/2026: un bot «que responde automáticamente», sin grupos y sin escribirle a nadie. El webhook de Evolution le pasa acá los mensajes 1 a 1 de la línea del bot
// (`mako.bot.instancia`). Los tres casos, en lib/mako-bot-reglas.ts (`queHacerCon`):
//   · no tiene cuenta (llegó por la landing) → ventas de MaKo, sin herramientas ni datos de nadie;
//   · administra un negocio → el mismo turno del doer que en su grupo, con SUS datos (`manejarEntranteDoerChat`);
//   · administra varios (una agencia) → el que nombre el mensaje o el que venía usando; si no, se pregunta UNA vez y lo que escribió se contesta después.
//
// ⚠️ EL TELÉFONO ES LA ÚNICA PRUEBA DE QUIÉN ES. Por eso sólo cuentan los que administran: alguien del equipo no ve por acá lo que su rol quizá no ve en la app.
// ⚠️ «NO PUDE LEER» NO ES «NO TIENE CUENTA»: a un cliente no se le contesta como a un desconocido porque la base no respondió.
// ⚠️ Lo que no tiene dueño va en el workspace de la PLATAFORMA (`wsSuperAdmin`), nunca en OWNER_WS, que es un cliente. Y una cola huérfana de ese workspace NO corre el doer: la
// persona no tiene por qué ver los datos de la plataforma (`huerfanoDelChat`).
//
// Todo lo que sale, sale por lib/mako-salida.ts: ahí se hace cumplir la ventana de 24 horas.
// =============================================================================

import 'server-only';
import { chatClaudeTools, type RichMsg } from './anthropic';
import { transcribirAudio } from './ai-cheap';
import { carteraDeAgencia } from './agencia';
import { clientesAprobados } from './agencia-cartera';
import { cuentasDelCreditoDeLosGrupos, marcarCuentaDeLosGruposSinCredito } from './credito-negocio';
import { aFormatoWhatsapp } from './doer-salida';
import { fetchMediaBase64EnInstancia } from './evolution';
import { encolar, esperarSilencio, marcarProcesados, pendientes, reclamar, soltar, unirMensajes, VENTANA_AUDIO_MS, VENTANA_MS } from './mako-doer-buffer';
import { guardarTurno, historialGrupo } from './mako-doer-conv';
import { CHAT_DEL_EQUIPO, TOPE_DEL_DIA, TOPE_TURNOS_DIA, VOZ_DEL_BOT, chatDelMensaje, esSuTelefono, lineaDeCambio, lineaPuedeSerDelBot, mensajeReciente, negocioElegido, numeroHabilitado, preguntaDeNegocio, promptDeVentas, queHacerCon, type ClaveDeMensaje, type NegocioDelChat, type QueHacer } from './mako-bot-reglas';
import { configDelBot, enviarAlChat, escribiendoEnElChat } from './mako-salida';
import { rolPushDeFila } from './notif-catalogo';
import { getSupabaseServer } from './supabase';
import { runWithWorkspace, wsSuperAdmin } from './workspace';

export type MsgBot = {
  key?: ClaveDeMensaje & { participant?: string };
  message?: Record<string, unknown>;
  pushName?: string;
  messageTimestamp?: unknown;
  base64?: string;
};

export type ResultadoBot = { caso?: QueHacer['caso'] | 'tope' | 'eleccion'; contesto?: boolean; skip?: string };

const KEY_NUMERO_DUENO = 'mako.numero_dueno';
/** Lo que espera a que elija el negocio: más viejo que esto ya no se contesta, y a lo sumo estos mensajes. */
const PREGUNTA_VIGENTE_MS = 2 * 3600_000;
const TOPE_MENSAJES_EN_ESPERA = 5;
/** Lo que marca el modelo cuando la persona pide a alguien del equipo. El código lo saca y le avisa a Martín. */
const MARCA_HUMANO = /\[\[humano\]\]/gi;

type FilaContacto = {
  jid: string; telefono: string | null; nombre: string | null; ws_elegido: number | null;
  /** Es la primera vez que escribe: el equipo se entera una sola vez. */
  primera: boolean;
  pregunta: { at: string; opciones: NegocioDelChat[]; mensajes: MsgBot[] } | null;
  dia: string | null; turnos_dia: number; tope_avisado: boolean;
};

// ── Quién es ─────────────────────────────────────────────────────────────────

/**
 * Los negocios de este teléfono: los de su fila de `usuarios` (`perfil.telefono`), los que lo tienen como dueño verificado (`mako.numero_dueno`) y, si administra una
 * agencia, los de su cartera aprobada. Sólo los activos. TIRA si no se pudo leer: «no sé» no es «no tiene cuenta».
 */
export async function negociosDelTelefono(telefono: string): Promise<NegocioDelChat[]> {
  const db = getSupabaseServer();
  const [u, s] = await Promise.all([
    db.from('usuarios').select('workspace_id, rol, rol_ws, estado, perfil').neq('estado', 'suspendido').limit(5000),
    db.from('app_settings').select('workspace_id, value').eq('key', KEY_NUMERO_DUENO).limit(5000),
  ]);
  if (u.error) throw new Error(u.error.message);
  if (s.error) throw new Error(s.error.message);
  const admin = new Map<number, boolean>();
  for (const f of (u.data ?? []) as Array<{ workspace_id: number | null; rol: string | null; rol_ws: string | null; perfil: { telefono?: unknown } | null }>) {
    if (f.workspace_id == null || !esSuTelefono(f.perfil?.telefono, telefono)) continue;
    const ws = Number(f.workspace_id);
    admin.set(ws, admin.get(ws) === true || rolPushDeFila(f) === 'admin');
  }
  for (const f of (s.data ?? []) as Array<{ workspace_id: number; value: string | null }>) {
    if (esSuTelefono(f.value, telefono)) admin.set(Number(f.workspace_id), true);
  }
  // Una agencia maneja los negocios de sus clientes: quien la administra también.
  for (const ws of [...admin.entries()].filter(([, a]) => a).map(([w]) => w)) {
    for (const cliente of clientesAprobados(ws, await carteraDeAgencia(ws))) admin.set(cliente, true);
  }
  if (!admin.size) return [];
  const { data, error } = await db.from('workspaces').select('id, nombre, estado').in('id', [...admin.keys()]);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{ id: number; nombre: string | null; estado: string | null }>)
    .filter((w) => w.estado === 'activo')
    .map((w) => ({ ws: Number(w.id), nombre: String(w.nombre ?? '').trim() || `Negocio ${w.id}`, admin: admin.get(Number(w.id)) === true }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

// ── La ventana ───────────────────────────────────────────────────────────────

/** Anota que escribió: esto es lo que abre la ventana de 24 horas. Tira si no se pudo: sin la fila, la puerta de salida no deja contestar, y mejor saberlo acá. */
async function anotarEntrante(chat: { jid: string; telefono: string | null }, nombre: string | null, ahora = new Date()): Promise<FilaContacto> {
  const db = getSupabaseServer();
  const { data, error } = await db.from('mako_bot_contactos').select('*').eq('jid', chat.jid).maybeSingle();
  if (error) throw new Error(error.message);
  const previa = data as FilaContacto | null;
  const hoy = ahora.toISOString().slice(0, 10);
  const mismoDia = previa?.dia === hoy;
  const fila = {
    jid: chat.jid, telefono: chat.telefono, nombre: nombre || previa?.nombre || null,
    ultimo_entrante_at: ahora.toISOString(), updated_at: ahora.toISOString(),
    dia: hoy, turnos_dia: (mismoDia ? previa!.turnos_dia ?? 0 : 0) + 1, tope_avisado: mismoDia ? !!previa!.tope_avisado : false,
  };
  const { error: errU } = await db.from('mako_bot_contactos').upsert(fila, { onConflict: 'jid' });
  if (errU) throw new Error(errU.message);
  return { ...fila, ws_elegido: previa?.ws_elegido ?? null, pregunta: previa?.pregunta ?? null, primera: !previa };
}

async function actualizarContacto(jid: string, cambios: Partial<Pick<FilaContacto, 'ws_elegido' | 'pregunta' | 'tope_avisado'>>): Promise<void> {
  const { error } = await getSupabaseServer().from('mako_bot_contactos').update({ ...cambios, updated_at: new Date().toISOString() }).eq('jid', jid);
  if (error) console.error(`[mako-bot] no pude actualizar ${jid}: ${error.message}`);
}

// ── El turno sin datos de nadie (ventas y el equipo de un negocio) ───────────

function textoPlano(m: MsgBot): string {
  const msg = m.message ?? {};
  if (typeof msg.conversation === 'string') return msg.conversation.trim();
  const ext = msg.extendedTextMessage as { text?: string } | undefined;
  return typeof ext?.text === 'string' ? ext.text.trim() : '';
}

const tieneAudio = (m: MsgBot): boolean => !!m.message?.audioMessage || !!m.message?.pttMessage;

/** Claude, como el turno del grupo: el de la plataforma y, si no tiene, el crédito de los grupos de cuenta en cuenta. Sin herramientas. */
async function claudeDelBot(system: string, mensajes: RichMsg[], motivo: string): Promise<string> {
  const una = async (cuenta?: string) => (await chatClaudeTools(system, mensajes, [], async () => '', {
    feature: 'mako-doer-in', soloSuClaude: true, cuentaDeLosGrupos: cuenta, maxSteps: 1, maxTokens: 500, motivo: `${motivo}${cuenta ? ` (${cuenta})` : ''}`,
  })).text ?? '';
  try { return await una(); } catch (e) {
    if (!/no tiene su clave de Claude/.test(e instanceof Error ? e.message : String(e))) throw e;
  }
  for (const cuenta of await cuentasDelCreditoDeLosGrupos()) {
    try { return await una(cuenta); } catch (e) {
      if (/credit balance is too low/i.test(e instanceof Error ? e.message : String(e))) marcarCuentaDeLosGruposSinCredito(cuenta);
    }
  }
  throw new Error('ningún Claude contestó en el WhatsApp de MaKo');
}

/** Los planes de verdad, de la misma fuente que la vitrina: un precio escrito en un prompt es un precio que se queda viejo. */
async function planesEnTexto(): Promise<string> {
  const { planesParaLanding } = await import('./compra-plan');
  const planes = await planesParaLanding().catch(() => []);
  if (!planes.length) return 'No tienes los precios a mano: manda a https://hola-mako.com/planes.';
  return planes.map((p) => `- ${p.nombre}: US$${p.precioUsd}${p.resumen ? `. ${p.resumen}` : ''}`).join('\n');
}

/** Le avisa a Martín en la app: alguien nuevo, o alguien que pidió a una persona. La bandeja es donde «el equipo lo ve». */
async function avisarAlEquipo(plataforma: number, chat: { jid: string; telefono: string | null }, nombre: string | null, texto: string, pideHumano: boolean): Promise<void> {
  try {
    const { avisoSoloEnLaApp } = await import('./aviso-en-la-app');
    const quien = `${nombre || 'Alguien'}${chat.telefono ? ` (+${chat.telefono})` : ''}`;
    await avisoSoloEnLaApp(plataforma, `${quien}: ${texto}`, {
      tipo: pideHumano ? 'bot-pide-persona' : 'bot-contacto-nuevo',
      titulo: pideHumano ? 'Pide hablar con alguien' : 'Escribieron al WhatsApp de MaKo',
    });
  } catch (e) { console.error(`[mako-bot] no pude avisar al equipo: ${e instanceof Error ? e.message : String(e)}`); }
}

/**
 * El turno de quien no ve datos: ventas, o alguien del equipo de un negocio. Corre en la PLATAFORMA con la misma cola que el doer: tres mensajes seguidos, una respuesta.
 * Sin herramientas: el modelo no puede tocar nada aunque se lo pidan.
 */
async function turnoSinDatos(plataforma: number, instance: string, chat: { jid: string; telefono: string | null }, data: MsgBot, system: string, primera: boolean): Promise<ResultadoBot> {
  return runWithWorkspace(plataforma, async () => {
    const texto = textoPlano(data);
    const audio = tieneAudio(data);
    if (!texto && !audio) {
      const env = await enviarAlChat(chat.jid, 'Por aquí leo texto y notas de voz. ¿Me lo cuentas así?');
      return { contesto: env.ok };
    }
    const nuevo = await encolar(chat.jid, { waId: data.key?.id ?? '', texto, tieneAudio: audio, payload: { ...data, instance } as unknown });
    if (!nuevo && data.key?.id) return { skip: 'ya estaba en la cola' };
    const quien = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    if (!(await reclamar(chat.jid, quien))) return { skip: 'encolado: ya hay alguien juntando' };
    void escribiendoEnElChat(chat.jid, 20_000);
    try {
      const cola = await esperarSilencio(chat.jid, audio ? VENTANA_AUDIO_MS : VENTANA_MS);
      const r = await contestarLaCola(plataforma, instance, chat, data, system, cola, primera);
      await marcarProcesados(cola.map((m) => m.id));
      return r;
    } finally { await soltar(chat.jid, quien); }
  });
}

async function contestarLaCola(plataforma: number, instance: string, chat: { jid: string; telefono: string | null }, data: MsgBot, system: string, cola: Array<{ id: number; texto: string; payload: unknown }>, primera: boolean): Promise<ResultadoBot> {
  if (!cola.length) return { skip: 'la cola quedó vacía' };
  const textos: Array<{ texto: string }> = [];
  for (const m of cola) {
    const p = (m.payload as MsgBot) ?? {};
    let t = m.texto.trim();
    if (!t && tieneAudio(p) && p.key?.id) {
      const media = await fetchMediaBase64EnInstancia(instance, chat.jid, p.key.id, false).catch(() => null);
      if (media) t = (await transcribirAudio(media.base64, media.mimetype || 'audio/ogg', { language: 'es', feature: 'MaKo · nota de voz', motivo: 'Transcribir nota de voz del WhatsApp de MaKo', pii: true, notaDeVozDelGrupo: true }).catch(() => '')).trim();
    }
    if (t) textos.push({ texto: t });
  }
  if (!textos.length) {
    const env = await enviarAlChat(chat.jid, 'No pude escuchar tu audio. ¿Me lo escribes?');
    return { contesto: env.ok };
  }
  const unido = textos.length === 1 ? textos[0].texto : unirMensajes(textos);
  await guardarTurno(plataforma, chat.jid, 'user', unido, data.key?.id).catch(() => {});
  if (primera) await avisarAlEquipo(plataforma, chat, data.pushName ?? null, unido.slice(0, 300), false);
  const historial = await historialGrupo(plataforma, chat.jid).catch(() => []);
  // El último turno ya está en el historial: si no se pudo leer, va igual.
  // Claude no acepta una charla que arranca con su propio turno, y el corte de las últimas 24 filas puede dejarla así.
  const desde = historial.findIndex((t) => t.role === 'user');
  const mensajes: RichMsg[] = desde >= 0 ? historial.slice(desde).map((t) => ({ role: t.role, content: t.content })) : [{ role: 'user', content: unido }];
  let respuesta = '';
  try {
    respuesta = (await claudeDelBot(`${system}\n\nSi pide hablar con una persona, termina tu mensaje con [[humano]].`, mensajes, `WhatsApp de MaKo «${unido.slice(0, 60)}»`)).trim();
  } catch (e) {
    console.error(`[mako-bot] la IA no contestó: ${e instanceof Error ? e.message : String(e)}`);
  }
  const pideHumano = MARCA_HUMANO.test(respuesta);
  MARCA_HUMANO.lastIndex = 0;
  const limpia = aFormatoWhatsapp(respuesta.replace(MARCA_HUMANO, '').trim());
  // Sin respuesta, se lo dice y lo ve el equipo: una pregunta de venta sin contestar es una venta perdida.
  const salida = limpia || 'Se me cortó algo de este lado. Le paso tu mensaje al equipo.';
  if (pideHumano || !limpia) await avisarAlEquipo(plataforma, chat, data.pushName ?? null, unido.slice(0, 300), true);
  const env = await enviarAlChat(chat.jid, salida);
  if (env.ok) await guardarTurno(plataforma, chat.jid, 'assistant', salida, env.id).catch(() => {});
  return { contesto: env.ok };
}

async function promptSinDatos(caso: Extract<QueHacer, { caso: 'ventas' | 'equipo' }>): Promise<string> {
  if (caso.caso === 'ventas') return promptDeVentas(await planesEnTexto());
  return `Eres MaKo y atiendes el WhatsApp de MaKo (hola-mako.com). Quien te escribe es de ${caso.negocio.nombre}.\n\n${CHAT_DEL_EQUIPO}\n\n${VOZ_DEL_BOT}`;
}

// ── La entrada ───────────────────────────────────────────────────────────────

/** El mensaje como lo espera el turno del doer: el chat ya canónico, y el que escribe en `participant` (ahí mira quién pide). */
function paraElDoer(data: MsgBot, jid: string): MsgBot {
  return { ...data, key: { ...data.key, remoteJid: jid, fromMe: false, participant: jid } };
}

/**
 * Al turno del doer. Lo que esperaba a que eligiera el negocio va como UN mensaje si es todo texto: dos preguntas seguidas son una conversación, y dos turnos serían dos respuestas
 * sueltas. Con una nota de voz o un archivo no se puede juntar: van de a uno.
 */
async function alDoer(ws: number, instance: string, jid: string, mensajes: readonly MsgBot[]): Promise<ResultadoBot> {
  const { manejarEntranteDoerChat } = await import('./mako-doer-in');
  const textos = mensajes.map(textoPlano);
  const todoTexto = mensajes.length > 1 && textos.every(Boolean) && mensajes.every((m) => !tieneAudio(m));
  const aMandar: readonly MsgBot[] = todoTexto
    ? [{ ...mensajes[mensajes.length - 1], message: { conversation: unirMensajes(textos.map((texto) => ({ texto }))) } }]
    : mensajes;
  let contesto = false;
  for (const m of aMandar) {
    const r = await manejarEntranteDoerChat(ws, instance, paraElDoer(m, jid) as never);
    contesto = contesto || r.engaged;
  }
  return { caso: 'negocio', contesto };
}

/** Un mensaje 1 a 1 que llegó a la línea del bot. Nunca lanza: el webhook no tiene a quién devolverle un error. */
export async function manejarEntranteBot(instance: string, data: MsgBot): Promise<ResultadoBot> {
  try {
    if (!lineaPuedeSerDelBot(instance)) return { skip: 'línea de un negocio' };
    const c = await configDelBot();
    if (!c.activo || (c.salida === 'evolution' && c.instancia !== instance)) return { skip: 'no es la línea del bot' };
    const chat = chatDelMensaje(data.key);
    if (!chat) return { skip: 'no es un chat' };
    // Lo que Evolution reentrega al reconectar: contestarlo sería escribirle de la nada a gente que ya no espera nada.
    if (!mensajeReciente(data.messageTimestamp)) return { skip: 'mensaje viejo' };
    if (!numeroHabilitado(c.solo, chat.telefono)) return { skip: 'fuera de la lista de prueba' };

    const plataforma = await wsSuperAdmin();
    const fila = await anotarEntrante(chat, data.pushName ?? null);
    if (fila.turnos_dia > TOPE_TURNOS_DIA) {
      if (fila.tope_avisado) return { caso: 'tope', skip: 'tope del día, ya avisado' };
      await actualizarContacto(chat.jid, { tope_avisado: true });
      const env = await enviarAlChat(chat.jid, TOPE_DEL_DIA);
      return { caso: 'tope', contesto: env.ok };
    }

    let negocios: NegocioDelChat[];
    try {
      negocios = chat.telefono ? await negociosDelTelefono(chat.telefono) : [];
    } catch (e) {
      // ⚠️ Sin saber quién es, no se le vende nada: podría ser un cliente.
      console.error(`[mako-bot] no pude leer de quién es ${chat.jid}: ${e instanceof Error ? e.message : String(e)}`);
      const env = await enviarAlChat(chat.jid, 'Se me cortó algo de este lado. ¿Me escribes de nuevo en un rato?');
      return { contesto: env.ok };
    }

    const texto = textoPlano(data);
    const pregunta = fila.pregunta && Date.now() - Date.parse(fila.pregunta.at) < PREGUNTA_VIGENTE_MS ? fila.pregunta : null;
    // ¿Contesta a «de cuál negocio»? Sólo vale lo que sigue administrando hoy.
    if (pregunta) {
      const vigentes = pregunta.opciones.filter((o) => negocios.some((n) => n.ws === o.ws && n.admin));
      const elegido = negocioElegido(texto, vigentes);
      if (elegido) {
        await actualizarContacto(chat.jid, { ws_elegido: elegido.ws, pregunta: null });
        await enviarAlChat(chat.jid, lineaDeCambio(elegido.nombre), 0);
        return { ...(await alDoer(elegido.ws, instance, chat.jid, pregunta.mensajes)), caso: 'eleccion' };
      }
    }

    const decision = queHacerCon(negocios, texto, fila.ws_elegido);
    if (decision.caso === 'ventas' || decision.caso === 'equipo') {
      return { ...(await turnoSinDatos(plataforma, instance, chat, data, await promptSinDatos(decision), fila.primera)), caso: decision.caso };
    }
    if (decision.caso === 'negocio') {
      if (decision.negocio.ws !== fila.ws_elegido || pregunta) await actualizarContacto(chat.jid, { ws_elegido: decision.negocio.ws, pregunta: null });
      if (decision.cambio) await enviarAlChat(chat.jid, lineaDeCambio(decision.negocio.nombre), 0);
      return alDoer(decision.negocio.ws, instance, chat.jid, pregunta ? [...pregunta.mensajes, data] : [data]);
    }
    // Varios y ninguno claro: se guarda lo que escribió, para contestarlo después de elegir. Sólo una vez: lo siguiente se suma sin repetir la pregunta.
    const yaEstaba = pregunta?.mensajes.some((m) => m.key?.id && m.key.id === data.key?.id);
    await actualizarContacto(chat.jid, {
      pregunta: { at: pregunta?.at ?? new Date().toISOString(), opciones: decision.negocios, mensajes: [...(pregunta?.mensajes ?? []), ...(yaEstaba ? [] : [data])].slice(-TOPE_MENSAJES_EN_ESPERA) },
    });
    if (pregunta) return { caso: 'preguntar', skip: 'la pregunta ya está hecha' };
    const env = await enviarAlChat(chat.jid, preguntaDeNegocio(decision.negocios));
    return { caso: 'preguntar', contesto: env.ok };
  } catch (e) {
    console.error(`[mako-bot] ${e instanceof Error ? e.message : String(e)}`);
    return { skip: 'error' };
  }
}

/**
 * Una cola de un chat 1 a 1 que quedó sin nadie (la invocación murió). ¿Corre el doer? Sólo si esta persona administra ESE negocio.
 *
 * ⚠️ VENTAS ENCOLA EN EL WORKSPACE DE LA PLATAFORMA: sin esto, el cron de los huérfanos corría el doer con los datos de la plataforma para un desconocido.
 * Si no administra ese negocio, la contesta el turno sin datos, y queda resuelta.
 */
export async function huerfanoDelChat(ws: number, jid: string): Promise<'doer' | 'resuelto'> {
  const chat = chatDelMensaje({ remoteJid: jid });
  const negocios = chat?.telefono ? await negociosDelTelefono(chat.telefono) : [];
  if (negocios.some((n) => n.ws === ws && n.admin)) return 'doer';
  await runWithWorkspace(ws, async () => {
    const quien = `cron${Date.now().toString(36)}`;
    if (!(await reclamar(jid, quien))) return;
    try {
      const cola = await pendientes(jid);
      if (!cola.length || !chat) { if (cola.length) await marcarProcesados(cola.map((m) => m.id)); return; }
      const c = await configDelBot();
      const ultimo = (cola[cola.length - 1].payload as MsgBot & { instance?: string }) ?? {};
      const decision = queHacerCon(negocios, '', null);
      const system = decision.caso === 'equipo' || decision.caso === 'ventas' ? await promptSinDatos(decision) : promptDeVentas(await planesEnTexto());
      await contestarLaCola(ws, ultimo.instance ?? c.instancia ?? '', chat, ultimo, system, cola, false);
      await marcarProcesados(cola.map((m) => m.id));
    } finally { await soltar(jid, quien); }
  });
  return 'resuelto';
}
