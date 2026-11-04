// =============================================================================
// mako-salida-reglas — LO QUE NO SALE por una línea de WhatsApp no oficial (4/11/2026)
// =============================================================================
// Martín, después del desbaneo del 4/11: «implementa medidas para que no nos baneen… revisa todo». El ban del 3/11 no fue por
// volumen: lo último que hizo la línea fue sumar gente a grupos e invitar por DM a alguien que nunca le había escrito
// (docs/hallazgos-comunicacion.md, «WhatsApp BANEÓ la línea de MaKo» y «Para que no nos vuelvan a banear»).
//
// Las reglas, en UN lugar. Las hace cumplir lib/mako-salida.ts (la puerta del bot), lib/mako-grupo.ts (la línea de MaKo) y
// lib/linea-freno.ts (el freno de todas las líneas, también las de los clientes):
//   1. La línea de MaKo no le escribe primero a alguien que nunca le escribió (`puedeEscribirleAPersona`).
//   2. Sin invitaciones por mensaje directo a desconocidos: es la misma regla, para el link de un grupo.
//   3. Altas en grupos con tope (lib/mako-linea-tope.ts: por negocio, por línea cada 10 minutos y por línea por día).
//   4. Ritmo: «escribiendo…» antes de soltar, proporcional al largo y con variación (`pausaDeEscritura`), y el mismo texto
//      no sale a muchos chats distintos en una hora (`TOPE_MISMO_TEXTO`).
//   5. Sin links en el primer mensaje a quien nunca escribió (`primerMensajeOk`).
//   6. Si WhatsApp dice «rate-overlimit», 463 o 403, la línea frena sola un rato y se avisa (`senalDeRiesgo`).
//
// ⚠️ Qué está documentado por Meta y qué es folclore (los números de 4, 3 y 6 son nuestros, no de Meta): la tabla en
// docs/hallazgos-comunicacion.md. Lo que sí dice Meta: el envío automatizado o masivo y los clientes no oficiales van contra sus
// términos; una cuenta restringida «no puede iniciar chats con contactos nuevos, crear grupos ni agregar miembros».
//
// PURO y sin `server-only`: lo ejecuta tests/mako-salida-reglas.test.ts.
// =============================================================================

// ── 1, 2 y 5: a quién y qué ─────────────────────────────────────────────────

/** `null` = no se pudo saber. Ante la duda, no se escribe: la línea es de todos. */
export type QuienRecibe = { leEscribio: boolean | null };

export const NO_LE_ESCRIBE_PRIMERO = 'MaKo no le escribe primero a alguien que nunca le escribió.';

/** ¿La línea de MaKo le puede escribir a esta persona? Sólo si ella escribió antes. */
export function puedeEscribirleAPersona(p: QuienRecibe): boolean {
  return p.leEscribio === true;
}

const LINK = /(?:https?:\/\/|www\.|wa\.me\/|chat\.whatsapp\.com\/|\b[a-z0-9-]+\.(?:com|net|org|io|co|app|site|link|ly|me|mx|ar|es)(?:\/|\b))/i;

/** ¿El texto lleva un link? (Un dominio pelado también cuenta: WhatsApp le arma la tarjeta igual.) */
export function tieneLink(texto: string | null | undefined): boolean {
  return LINK.test(String(texto ?? ''));
}

export const SIN_LINK_A_DESCONOCIDOS = 'El primer mensaje a alguien que nunca escribió no lleva links.';

/** Un mensaje a una persona: sólo si escribió antes, y a quien no escribió, sin links (regla 5, para quien sí pueda escribirle primero). */
export function primerMensajeOk(m: { texto: string; leEscribio: boolean | null; puedeEscribirPrimero?: boolean }):
  { ok: true } | { ok: false; motivo: string } {
  if (m.leEscribio === true) return { ok: true };
  if (!m.puedeEscribirPrimero) return { ok: false, motivo: NO_LE_ESCRIBE_PRIMERO };
  return tieneLink(m.texto) ? { ok: false, motivo: SIN_LINK_A_DESCONOCIDOS } : { ok: true };
}

// ── 4: el ritmo ─────────────────────────────────────────────────────────────

/**
 * Cuánto muestra «escribiendo…» (o «grabando…») antes de soltar el mensaje: proporcional al largo, con tope y con ±20 % de
 * variación. Es el `delay` de Evolution. ⚠️ El white paper de WhatsApp (2019) nombra la falta de «escribiendo» como una señal de
 * cuenta automatizada; que simularlo proteja no lo dice nadie: es folclore razonable.
 */
export function pausaDeEscritura(largo: number, tipo: 'texto' | 'media' | 'audio' = 'texto', azar: () => number = Math.random): number {
  const n = Math.max(0, Number(largo) || 0);
  const base = tipo === 'texto' ? Math.min(1500 + n * 45, 9000)
    : tipo === 'media' ? Math.min(1200 + Math.floor(n / 120), 6000)
    : Math.min(2000 + Math.floor(n / 90), 8000);
  const a = Math.min(1, Math.max(0, azar()));
  return Math.round(base * (0.8 + a * 0.4));
}

/** El mismo texto a más de estos chats DISTINTOS en la ventana, por una línea de MaKo, no sale. Número nuestro, no de Meta. */
export const TOPE_MISMO_TEXTO = 5;
export const VENTANA_MISMO_TEXTO_MIN = 60;
export const MISMO_TEXTO_A_MUCHOS = 'Ese mismo texto ya salió a muchos chats en la última hora.';

/** La huella con que se compara «el mismo texto»: sin mayúsculas, sin espacios de más. Textos cortos (un «👍», «ok») no cuentan. */
export function huellaDeTexto(texto: string | null | undefined): string | null {
  const t = String(texto ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (t.length < 20) return null;
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (Math.imul(h, 31) + t.charCodeAt(i)) | 0;
  return `${t.length}-${(h >>> 0).toString(36)}`;
}

// ── 6: las señales de riesgo ────────────────────────────────────────────────

/** Lo que escribe en WhatsApp (o le pregunta a WhatsApp por un número). Leer la base de Evolution no cuenta. */
export function esEscritura(ruta: string): boolean {
  return /^\/(?:message\/|group\/(?:create|updateParticipant|sendInvite|updateGroup|updateSetting|leaveGroup)|chat\/(?:whatsappNumbers|markMessageAsRead|sendPresence|updateProfile))/.test(ruta);
}

/** La instancia de una ruta de Evolution (`/message/sendText/<instancia>?…`), o null. */
export function instanciaDeRuta(ruta: string): string | null {
  const sinQuery = ruta.split('?')[0];
  const partes = sinQuery.split('/').filter(Boolean);
  if (partes.length < 3) return null;
  try { return decodeURIComponent(partes[partes.length - 1]) || null; } catch { return null; }
}

export type TipoSenal = 'rate' | 'restringida' | 'bloqueo';
export type Senal = { tipo: TipoSenal; pausaMin: number };

/** Cuánto frena cada señal. Nuestros números: WhatsApp no publica cuánto dura un límite. */
export const PAUSA_MIN: Readonly<Record<TipoSenal, number>> = { rate: 30, restringida: 24 * 60, bloqueo: 6 * 60 };

/**
 * ¿Lo que contestó Evolution es una señal de que WhatsApp está frenando a esta línea?
 *  · «rate-overlimit»: el límite de pedidos de WhatsApp (Evolution lo devuelve como 500). Medido el 3/11 en `fetchAllGroups`.
 *  · 463: «NackCallerReachoutTimelocked», un límite a escribirle a desconocidos que viene de una cuenta restringida (lo dice el
 *    equipo de Baileys, issue #2441). La restricción sí está en el FAQ de WhatsApp.
 *  · 403 al MANDAR un mensaje: la cuenta no puede escribir. Un 403 por participante adentro de un 200 (la privacidad de quien no
 *    deja que lo sumen a un grupo) NO es esto, y tampoco el 403 de leer un grupo donde la línea no es admin.
 * Sólo en una escritura: una lectura que falla no dice nada de la cuenta.
 */
export function senalDeRiesgo(e: { ruta: string; status: number; cuerpo: unknown }): Senal | null {
  if (!esEscritura(e.ruta) || e.status === 0 || (e.status >= 200 && e.status < 300)) return null;
  const texto = (typeof e.cuerpo === 'string' ? e.cuerpo : JSON.stringify(e.cuerpo ?? '')).toLowerCase();
  if (texto.includes('rate-overlimit') || texto.includes('rate_overlimit') || e.status === 429) return { tipo: 'rate', pausaMin: PAUSA_MIN.rate };
  if (/\b463\b/.test(texto) || texto.includes('reachout')) return { tipo: 'restringida', pausaMin: PAUSA_MIN.restringida };
  if (e.status === 403 && e.ruta.startsWith('/message/')) return { tipo: 'bloqueo', pausaMin: PAUSA_MIN.bloqueo };
  return null;
}

/** El freno guardado de una línea (`linea.freno.<instancia>`, en el workspace de la plataforma). */
export type Freno = { tipo: TipoSenal; desde: string; hasta: string; ruta?: string };

/** El freno que sigue vigente, o null. Un valor ilegible no frena: el freno es una red, y un JSON roto no puede callar una línea para siempre. */
export function frenoVigente(raw: string | null | undefined, ahora: number = Date.now()): Freno | null {
  if (!raw) return null;
  try {
    const f = JSON.parse(raw) as Freno;
    const hasta = Date.parse(f.hasta);
    if (!Number.isFinite(hasta) || hasta <= ahora) return null;
    if (f.tipo !== 'rate' && f.tipo !== 'restringida' && f.tipo !== 'bloqueo') return null;
    return f;
  } catch { return null; }
}

export function nuevoFreno(s: Senal, ruta: string, ahora: number = Date.now()): Freno {
  return { tipo: s.tipo, desde: new Date(ahora).toISOString(), hasta: new Date(ahora + s.pausaMin * 60_000).toISOString(), ruta: ruta.split('?')[0] };
}

const QUE_DIJO: Readonly<Record<TipoSenal, string>> = {
  rate: 'WhatsApp avisó que esta línea está mandando demasiado',
  restringida: 'WhatsApp no deja que esta línea le escriba a gente nueva',
  bloqueo: 'WhatsApp rechazó un mensaje de esta línea',
};

/** Lo que vuelve como error de un envío frenado, y la primera línea del aviso. Corto. */
export function textoDelFreno(f: Freno): string {
  const hasta = new Date(f.hasta);
  const hh = `${String(hasta.getUTCHours()).padStart(2, '0')}:${String(hasta.getUTCMinutes()).padStart(2, '0')} UTC`;
  return `${QUE_DIJO[f.tipo]}. Frené los envíos hasta las ${hh}.`;
}
