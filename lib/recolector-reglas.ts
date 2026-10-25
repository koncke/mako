// =============================================================================
// recolector-reglas — el recolector del Second Brain, lo puro (25/10/2026)
// =============================================================================
// Pedido de Martín (24/10/2026, textual): «Quiero que implementes en el Second Brain un "recolector de información" de
// TODOS lados... De los mensajes de WhatsApp, de absolutamente todo. Porque eso sí será un "Second Brain". Esto para todos
// los ws». El diseño: docs/diseno-second-brain-recolector.md. Acá, sin base ni red, con test: qué conversaciones tocan,
// cómo se arma lo que lee la IA, cómo se lee lo que contesta y cómo queda la entrada del conocimiento.
//
// LAS REGLAS DEL DISEÑO QUE VIVEN ACÁ:
//   · RESUME Y EXTRAE, NO COPIA (§5): lo que entra son hechos («quiere el plan de 97», «pidió que lo llamen el lunes»), nunca
//     el renglón crudo. Topes por conversación y por vuelta: «absolutamente todo» es una trampa de volumen.
//   · QUE NO SE INVENTE (§5): si de una conversación no sale nada, la respuesta es «NADA» y no se guarda una entrada vacía ni
//     una plausible.
//   · CON PROCEDENCIA (§4): cada entrada dice de qué conversación salió y de qué fechas, en su propio texto, porque el chat
//     del Second Brain sólo recibe el título y el cuerpo (lib/mako-knowledge.ts, `searchKnowledge`).
//   · SÓLO PERSONAS: un grupo de WhatsApp no es la conversación con un cliente (los grupos los mira el vigía).
//   · SÓLO CONVERSACIONES CON UN LEAD DEL CRM (algún mensaje con `lead_id`): la línea de un negocio puede ser el WhatsApp
//     PERSONAL de su dueño (la de MaKo lo es: el de Martín), y una charla con la familia no es «lo que el negocio vivió».
// =============================================================================

/** La fuente de lo recolectado (`mako_knowledge.fuente` y `second_brain_recolectado.fuente`). NUNCA se presta a otro
 *  negocio: lib/rag-prestamo.ts sólo presta `mako`. */
export const FUENTE_WHATSAPP = 'whatsapp';

/** La clave de app_settings del negocio con su interruptor y su última vuelta. */
export const CLAVE_RECOLECTOR = 'second-brain.recolector';

/** Cuántas conversaciones resume una vuelta por negocio (corre cada hora): lo que no entra, entra la próxima. */
export const MAX_CONVERSACIONES_POR_VUELTA = 6;
/** Cuántos mensajes nuevos de una conversación lee de una vez (los más recientes). */
export const MAX_MENSAJES_POR_CONVERSACION = 60;
/** Desde cuándo lee la primera vez (y una conversación que nunca se leyó). */
export const DIAS_PRIMERA_VEZ = 14;
/** Una conversación entra cuando tiene al menos esto de mensajes nuevos con texto, y alguno del cliente. */
export const MIN_MENSAJES_NUEVOS = 3;
/** El tope de lo que lee la IA de una conversación (los últimos, si hay más). */
export const MAX_CARACTERES_TRANSCRIPCION = 9000;
/** Cuántos hechos guarda de una conversación. */
export const MAX_HECHOS = 14;

export type MensajeWa = {
  chat_jid: string;
  wa_timestamp: string;
  from_me: boolean;
  tipo: string | null;
  texto: string | null;
  /** El lead del CRM de esa conversación, si lo hay. Una conversación sin ningún mensaje atado a un lead no se lee. */
  lead_id?: number | null;
};

/** ¿Es la conversación con una persona? (ni un grupo, ni un canal, ni los estados). */
export const esChatDePersona = (jid: string): boolean =>
  /@(s\.whatsapp\.net|c\.us|lid)$/.test(jid) && !/^status@/.test(jid);

/** ¿Este mensaje tiene algo que leer? (texto, y no un evento de la línea). */
export const tieneTexto = (m: Pick<MensajeWa, 'tipo' | 'texto'>): boolean => !!m.texto?.trim() && m.tipo !== 'evento';

export type Pendiente = { jid: string; nuevos: number; ultimo: string };

/**
 * Qué conversaciones tocan esta vuelta: las de PERSONAS con mensajes con texto posteriores a lo que ya se leyó
 * (`hasta` de su fila; sin fila, todo lo de la ventana), con al menos `MIN_MENSAJES_NUEVOS` y alguno del cliente (lo que
 * sólo escribió el negocio no dice nada del cliente). Las de movimiento más reciente primero, hasta el tope.
 */
export function conversacionesPendientes(
  mensajes: readonly MensajeWa[],
  leidas: ReadonlyMap<string, string>,
  tope = MAX_CONVERSACIONES_POR_VUELTA,
): Pendiente[] {
  const porChat = new Map<string, { nuevos: number; delCliente: number; ultimo: string }>();
  const conLead = new Set(mensajes.filter((m) => m.lead_id != null).map((m) => m.chat_jid));
  for (const m of mensajes) {
    if (!esChatDePersona(m.chat_jid) || !conLead.has(m.chat_jid) || !tieneTexto(m)) continue;
    const hasta = leidas.get(m.chat_jid);
    if (hasta && Date.parse(m.wa_timestamp) <= Date.parse(hasta)) continue;
    const c = porChat.get(m.chat_jid) ?? { nuevos: 0, delCliente: 0, ultimo: m.wa_timestamp };
    c.nuevos += 1;
    if (!m.from_me) c.delCliente += 1;
    if (Date.parse(m.wa_timestamp) > Date.parse(c.ultimo)) c.ultimo = m.wa_timestamp;
    porChat.set(m.chat_jid, c);
  }
  return [...porChat.entries()]
    .filter(([, c]) => c.nuevos >= MIN_MENSAJES_NUEVOS && c.delCliente > 0)
    .sort((a, b) => Date.parse(b[1].ultimo) - Date.parse(a[1].ultimo) || a[0].localeCompare(b[0]))
    .slice(0, tope)
    .map(([jid, c]) => ({ jid, nuevos: c.nuevos, ultimo: c.ultimo }));
}

/** «24/10 14:03» en la zona del negocio. */
function cuando(iso: string, tz: string): string {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(iso));
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? '00';
  return `${v('day')}/${v('month')} ${v('hour') === '24' ? '00' : v('hour')}:${v('minute')}`;
}

/**
 * Lo que lee la IA: la conversación en orden, «[24/10 14:03] Cliente: …» / «Negocio: …». Si se pasa del tope, se quedan
 * los ÚLTIMOS mensajes (lo nuevo es lo que importa) y se dice que hubo más.
 */
export function transcripcion(mensajes: readonly Pick<MensajeWa, 'wa_timestamp' | 'from_me' | 'texto' | 'tipo'>[], tz: string, tope = MAX_CARACTERES_TRANSCRIPCION): string {
  const lineas = [...mensajes]
    .filter(tieneTexto)
    .sort((a, b) => Date.parse(a.wa_timestamp) - Date.parse(b.wa_timestamp))
    .map((m) => `[${cuando(m.wa_timestamp, tz)}] ${m.from_me ? 'Negocio' : 'Cliente'}: ${m.texto!.replace(/\s+/g, ' ').trim()}`);
  const out: string[] = [];
  let largo = 0;
  for (let i = lineas.length - 1; i >= 0; i--) {
    if (largo + lineas[i].length + 1 > tope) { out.unshift('(…mensajes anteriores sin incluir)'); break; }
    out.unshift(lineas[i]);
    largo += lineas[i].length + 1;
  }
  return out.join('\n');
}

/** Lo que se le pide a la IA del negocio: hechos, en viñetas, o NADA. Con lo que ya se sabía de esa persona. */
export function pedidoAlaIA(p: { etiqueta: string; previo: string[]; transcripcion: string }): { system: string; user: string } {
  const system = [
    'Eres el asistente que alimenta el Second Brain de un negocio: su memoria. Lees una conversación de WhatsApp entre el negocio y un cliente o prospecto, y anotas los HECHOS que al dueño le sirve recordar.',
    'Un hecho es algo concreto y verificable en la conversación: quién es la persona y a qué se dedica, qué quiere o qué le duele, qué le ofrecieron y a qué precio, qué objetó, qué se acordó (fechas, llamadas, pagos), en qué quedó.',
    'Reglas: sólo lo que la conversación DICE (nunca supongas ni completes); cada hecho en una línea que empieza con «- »; frases cortas en español; sin saludos ni relleno; sin repetir hechos; como mucho 14.',
    'Si te paso lo que ya se sabía de esta persona, devuelve la lista COMPLETA actualizada: conserva lo que sigue valiendo, corrige lo que cambió y suma lo nuevo.',
    'Si la conversación no tiene ningún hecho que valga la pena recordar, responde exactamente: NADA',
  ].join('\n');
  const user = [
    `Conversación de WhatsApp con: ${p.etiqueta}`,
    p.previo.length ? `\nLo que ya se sabía:\n${p.previo.map((h) => `- ${h}`).join('\n')}` : '',
    `\nMensajes:\n${p.transcripcion}`,
  ].join('\n');
  return { system, user };
}

/** Lo que contestó la IA: los hechos, o «nada». Una respuesta que no se entiende (sin viñetas) cuenta como nada. */
export function leerRespuesta(texto: string): { nada: true } | { nada: false; hechos: string[] } {
  const t = texto.trim();
  if (!t || /^\W*nada\W*$/i.test(t)) return { nada: true };
  const vistos = new Set<string>();
  const hechos: string[] = [];
  for (const l of t.split(/\r?\n/)) {
    const m = /^\s*(?:[-*•]|\d+[.)])\s+(.+)$/.exec(l);
    if (!m) continue;
    const h = m[1].replace(/\s+/g, ' ').trim().slice(0, 300);
    const clave = h.toLowerCase();
    if (!h || vistos.has(clave)) continue;
    vistos.add(clave);
    hechos.push(h);
    if (hechos.length >= MAX_HECHOS) break;
  }
  return hechos.length ? { nada: false, hechos } : { nada: true };
}

/** Los hechos de una entrada guardada (para pasárselos a la IA la vuelta siguiente). */
export function hechosDeLaEntrada(cuerpo: string): string[] {
  const antesDeLaFuente = cuerpo.split(/\n\s*Fuente:/)[0];
  return antesDeLaFuente.split(/\r?\n/).map((l) => /^\s*-\s+(.+)$/.exec(l)?.[1]?.trim()).filter((x): x is string => !!x);
}

export const tituloDeLaEntrada = (etiqueta: string): string => `WhatsApp · ${etiqueta}`.slice(0, 160);

/** «24/10/2026» de un instante, en la zona del negocio. */
function fechaCorta(iso: string, tz: string): string {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(new Date(iso));
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return `${v('day')}/${v('month')}/${v('year')}`;
}

/**
 * El cuerpo de la entrada del conocimiento: los hechos y, al final, DE DÓNDE SALIERON (la conversación, las fechas de lo
 * leído y cuándo se recolectó), para que el chat del Second Brain lo pueda citar.
 */
export function cuerpoDeLaEntrada(p: { etiqueta: string; hechos: readonly string[]; desde: string | null; hasta: string; ahora: string; tz: string }): string {
  // `desde` null: una entrada que se ACTUALIZA junta lo de antes (de otras vueltas) con lo nuevo, así que se dice hasta cuándo.
  const rango = p.desde == null
    ? `hasta el ${fechaCorta(p.hasta, p.tz)}`
    : fechaCorta(p.desde, p.tz) === fechaCorta(p.hasta, p.tz) ? `del ${fechaCorta(p.hasta, p.tz)}` : `del ${fechaCorta(p.desde, p.tz)} al ${fechaCorta(p.hasta, p.tz)}`;
  return [
    `Lo que se sabe de ${p.etiqueta}, por su conversación de WhatsApp con el negocio:`,
    ...p.hechos.map((h) => `- ${h}`),
    '',
    `Fuente: la conversación de WhatsApp con ${p.etiqueta}, mensajes ${rango}. Lo recolectó MaKo el ${fechaCorta(p.ahora, p.tz)}.`,
  ].join('\n');
}

// ── El estado del negocio (app_settings `second-brain.recolector`) ───────────────────────────────────────────────────

export type ResultadoVuelta = 'ok' | 'sin-ia' | 'error' | 'apagado' | 'sin-tabla';

export type EstadoRecolector = {
  /** El interruptor del negocio. Sin escribir, `porDefecto` (`prendidoPorDefecto`): apagado para un cliente, prendido para MaKo. */
  prendido: boolean;
  ultima: { at: string; resultado: ResultadoVuelta; motivo?: string; nuevas: number; actualizadas: number; leidas: number } | null;
};

const RESULTADOS: ReadonlySet<string> = new Set(['ok', 'sin-ia', 'error', 'apagado', 'sin-tabla']);

/**
 * Cómo arranca un negocio que nunca tocó el interruptor (el Cerebro, 25/10/2026, con Martín pidiendo no preguntar): un
 * CLIENTE, APAGADO — el recolector gasta SU IA cada hora y la regla es que cada negocio paga su IA: no se la gastamos sin que
 * lo elija; lo prende en «Aprende solo». El espacio de MaKo (la plataforma, el negocio de Martín), PRENDIDO.
 */
export const prendidoPorDefecto = (esPlataforma: boolean): boolean => esPlataforma;

/** Lo que dice el setting, saneado: un valor roto es «como arranca», sin vueltas. */
export function leerEstadoRecolector(crudo: string | null | undefined, porDefecto = false): EstadoRecolector {
  try {
    const o = crudo ? (JSON.parse(crudo) as Record<string, unknown>) : {};
    const u = o.ultima as Record<string, unknown> | undefined;
    const n = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 ? (v as number) : 0);
    const ultima = u && typeof u.at === 'string' && !Number.isNaN(Date.parse(u.at)) && RESULTADOS.has(String(u.resultado))
      ? { at: u.at, resultado: u.resultado as ResultadoVuelta, ...(typeof u.motivo === 'string' && u.motivo ? { motivo: u.motivo.slice(0, 300) } : {}), nuevas: n(u.nuevas), actualizadas: n(u.actualizadas), leidas: n(u.leidas) }
      : null;
    return { prendido: typeof o.prendido === 'boolean' ? o.prendido : porDefecto, ultima };
  } catch {
    return { prendido: porDefecto, ultima: null };
  }
}

/** Lo que ve la pantalla (el Mapa del Second Brain): lo arma `resumenDelRecolector` (lib/recolector.ts). */
export type ResumenRecolector = {
  estado: EstadoRecolector;
  /** Conversaciones leídas alguna vez, y cuántas dejaron algo en el conocimiento. */
  conversaciones: number;
  conEntrada: number;
  /** Entradas que el chat todavía no puede usar (sin índice: suele ser que el negocio no conectó su Gemini). */
  sinIndice: number;
  /** Las últimas conversaciones que dejaron algo: con quién, cuándo y qué aprendió. */
  ultimas: Array<{ etiqueta: string; cuando: string; hechos: string[] }>;
  /** La tabla todavía no existe en este entorno (falta la migración 0333). */
  sinTabla?: true;
};

/** Lo que se le dice a la persona de la última vuelta. */
export function textoDeLaVuelta(e: EstadoRecolector): string {
  if (!e.prendido) return 'Apagado. Préndelo para que MaKo aprenda de tus conversaciones con tus leads; usa tu propia IA.';
  const u = e.ultima;
  if (!u) return 'Todavía no leyó nada: la primera vuelta corre en la próxima hora.';
  if (u.resultado === 'sin-ia') return 'No corre: conecta tu propia IA para que MaKo pueda leer y resumir tus conversaciones.';
  if (u.resultado === 'sin-tabla') return 'Todavía no está listo en tu cuenta. Corre apenas se active.';
  if (u.resultado === 'error') return `La última vuelta no pudo terminar${u.motivo ? `: ${u.motivo}` : ''}. Lo vuelve a intentar en la próxima hora.`;
  if (u.nuevas + u.actualizadas === 0) return 'Al día: no había conversaciones nuevas que resumir.';
  return `En la última vuelta aprendió de ${u.nuevas + u.actualizadas} ${u.nuevas + u.actualizadas === 1 ? 'conversación' : 'conversaciones'}.`;
}
