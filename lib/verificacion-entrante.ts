// =============================================================================
// verificacion-entrante — confirmar un WhatsApp SIN escribirle primero (4/11/2026)
// =============================================================================
// Martín, después del desbaneo: «en lugar de nosotros enviarle un código de seguridad, pedirles que ellos nos envíen un
// mensaje primero y ahí enviarles su código». El 3/11 la línea de MaKo cayó por spam, y lo último que había hecho era
// escribirle a gente que nunca le había escrito (docs/hallazgos-comunicacion.md, «WhatsApp BANEÓ la línea de MaKo»).
//
// Cómo queda: la pantalla muestra un link `wa.me` a la línea de MaKo con el texto ya escrito («Hola MaKo, mi código es
// K7P2QX»). La persona lo manda desde su WhatsApp; el webhook de Evolution lo lee y confirma el número de QUIEN LO MANDÓ.
// MaKo no le escribe nada: la confirmación se ve en la app.
//
// ⚠️ EL CÓDIGO SE VE EN LA PANTALLA, así que no prueba nada si se escribe en la app: lo que prueba es el NÚMERO que lo
// manda. Por eso una verificación entrante no acepta el código tipeado (`decidirCodigoTipeado`).
//
// PURO y sin `server-only`: lo usan lib/mako-grupo.ts (el estado y el webhook) y tests/verificacion-entrante.test.ts.
// =============================================================================

import { esSuTelefono } from './mako-bot-reglas';

/** Sin 0, O, 1, I ni L: se leen igual en cualquier letra. */
export const ALFABETO_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const LARGO_CODIGO = 6;
/** Cuánto vive un pedido: hay que cambiar de app, buscar el chat y mandar. */
export const MINUTOS_ENTRANTE = 30;

/** Un código con al menos una letra y un número: así no lo confunde con una palabra común («PRUEBA»). */
export function codigoNuevo(azar: () => number = Math.random): string {
  for (;;) {
    let c = '';
    for (let i = 0; i < LARGO_CODIGO; i++) c += ALFABETO_CODIGO[Math.floor(azar() * ALFABETO_CODIGO.length) % ALFABETO_CODIGO.length];
    if (/\d/.test(c) && /[A-Z]/.test(c)) return c;
  }
}

/** Lo que va escrito en el WhatsApp. Sin links: es el primer mensaje de esa persona a la línea. */
export const textoParaMandar = (codigo: string): string => `Hola MaKo, mi código es ${codigo}`;

const TOKEN = new RegExp(`(?<![A-Z0-9])([${ALFABETO_CODIGO}]{${LARGO_CODIGO}})(?![A-Z0-9])`, 'g');

/**
 * El código que trae un mensaje, o null. Tolera que lo hayan tocado (minúsculas, sin el saludo), pero exige una palabra de
 * seis con letra y número del alfabeto: casi ningún texto común lo tiene, así que el webhook no le pregunta a la base por
 * cada mensaje que llega.
 */
export function codigoDelTexto(texto: string | null | undefined): string | null {
  const t = String(texto ?? '').toUpperCase();
  if (!t || t.length > 300) return null;
  for (const m of t.matchAll(TOKEN)) {
    const c = m[1];
    if (/\d/.test(c) && /[A-Z]/.test(c)) return c;
  }
  return null;
}

/** El link que abre WhatsApp con el chat de la línea y el texto escrito. null sin número. */
export function linkWaMe(numeroDeLaLinea: string | null | undefined, texto: string): string | null {
  const n = String(numeroDeLaLinea ?? '').replace(/\D/g, '');
  if (n.length < 8) return null;
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}

/** Lo que se guarda de una verificación (`mako.contacto.verificacion`, por negocio). Los campos de `entrante` son de este flujo. */
export type EstadoVerificacion = {
  telefono: string;
  codigo: string;
  expira: number;
  verificado: boolean;
  /** El número en la forma de WhatsApp (o su jid). */
  destino?: string;
  /** El del negocio, para armar el grupo al verificar. */
  nombre?: string;
  /** La persona escribe primero (4/11/2026). Sin esto, es un código que MaKo mandó por DM (antes del 4/11). */
  entrante?: true;
  /** La instancia que tiene que recibir el mensaje: la del número del link. */
  linea?: string;
  /** El número de esa línea, para el link. */
  numeroLinea?: string;
  /** Escribió el código desde OTRO número (no se confirma: la pantalla se lo dice). */
  otroNumero?: string;
  /** Cuándo se confirmó. */
  confirmadoAt?: string;
  /** EL ONBOARDING V2 (19/11/2026): la persona manda «Hola, quiero confirmar mi WhatsApp.» y MaKo le CONTESTA con el código en
   *  el chat privado; ella lo pega en la app. El código es de 6 números y nunca se ve en la pantalla. */
  v2?: true;
  /** MaKo ya le contestó con el código (por eso ya hay a quién reenviárselo). */
  respondido?: boolean;
  /** Los códigos equivocados que pegó: al llegar al tope, pide uno nuevo. */
  intentos?: number;
};

export type Llegada = {
  /** El código que traía el mensaje. */
  codigo: string;
  /** La instancia que lo recibió. */
  instancia: string;
  /** El número de quien lo mandó; null si WhatsApp no lo dio (un `@lid` sin el alternativo). */
  telefono: string | null;
  ahora: number;
};

export type Decision =
  | { tipo: 'confirmar'; telefono: string }
  | { tipo: 'otro-numero'; telefono: string }
  | { tipo: 'ignorar'; porque: 'no-es-este' | 'ya-verificado' | 'vencido' | 'otra-linea' | 'sin-numero' };

/**
 * ¿Este mensaje confirma esta verificación? Sólo una entrante, vigente, por la misma línea del link, con el mismo código, y
 * desde el número que se dio (`esSuTelefono`: el país tiene que coincidir). Si lo manda otro número, NO se confirma: el
 * número que recibe los avisos tiene que ser el que se probó.
 */
export function decidirLlegada(v: EstadoVerificacion | null | undefined, l: Llegada): Decision {
  if (!v || !v.entrante || v.codigo !== l.codigo) return { tipo: 'ignorar', porque: 'no-es-este' };
  if (v.verificado) return { tipo: 'ignorar', porque: 'ya-verificado' };
  if (l.ahora > v.expira) return { tipo: 'ignorar', porque: 'vencido' };
  if (v.linea && v.linea !== l.instancia) return { tipo: 'ignorar', porque: 'otra-linea' };
  if (!l.telefono) return { tipo: 'ignorar', porque: 'sin-numero' };
  return esSuTelefono(v.telefono, l.telefono) ? { tipo: 'confirmar', telefono: l.telefono } : { tipo: 'otro-numero', telefono: l.telefono };
}

/** Lo que se contesta cuando alguien escribe en la app el código de una verificación entrante. */
export const NO_SE_TIPEA = 'Mándame el mensaje por WhatsApp: aquí no hace falta escribir el código.';

/** El código tipeado vale sólo para un pedido de antes del 4/11 (MaKo mandó el código). */
export function decidirCodigoTipeado(v: EstadoVerificacion | null | undefined, codigo: string, ahora: number):
  { ok: true } | { ok: false; error: string } {
  if (!v) return { ok: false, error: 'Todavía no se envió ningún código.' };
  if (v.entrante) return { ok: false, error: NO_SE_TIPEA };
  if (ahora > v.expira) return { ok: false, error: 'El código expiró. Solicita uno nuevo.' };
  if (codigo.trim() !== v.codigo) return { ok: false, error: 'El código no coincide.' };
  return { ok: true };
}

/** Cómo está, para la pantalla. */
export type VistaEntrante = {
  estado: 'esperando' | 'verificado' | 'otro-numero' | 'vencido';
  link: string | null;
  numeroLinea: string | null;
  telefono: string;
  otroNumero: string | null;
};

export function vistaDeEntrante(v: EstadoVerificacion | null | undefined, ahora: number): VistaEntrante | null {
  if (!v || !v.entrante) return null;
  // En el V2 el link lleva el pedido, NUNCA el código: el código lo manda MaKo por WhatsApp y eso es lo que prueba el número.
  const base = { link: linkWaMe(v.numeroLinea, v.v2 ? TEXTO_CONFIRMAR_V2 : textoParaMandar(v.codigo)), numeroLinea: v.numeroLinea ?? null, telefono: v.telefono, otroNumero: v.otroNumero ?? null };
  if (v.verificado) return { ...base, estado: 'verificado' };
  if (ahora > v.expira) return { ...base, estado: 'vencido' };
  return { ...base, estado: v.otroNumero ? 'otro-numero' : 'esperando' };
}

// =============================================================================
// EL WHATSAPP DEL ONBOARDING V2 (19/11/2026): el código por el CHAT PRIVADO, sin grupo
// =============================================================================
// Martín (16/11, la maqueta del onboarding): «Para confirmar tu WhatsApp, toca Abrir WhatsApp y envía el mensaje de confirmación.
// Te contesto con un código y lo pegas aquí abajo»; el mensaje escrito es «Hola, quiero confirmar mi WhatsApp» y MaKo contesta
// «Hola {nombre}, soy MaKo. Tu código…». Y el 19/11, probándolo en producción: «le envié el mensaje a MaKo y me creó un grupo de
// WhatsApp, que eso ya no debería hacerlo… directamente por el chat privado».
// Así que en el V2: la persona escribe primero (nunca MaKo: el baneo del 3/11), MaKo le contesta en ESE chat con un código de 6
// números, ella lo pega en la app y el número queda probado. Nadie arma un grupo. El flujo de antes (el código en el link y la
// confirmación sola con el grupo) sigue igual para quien no está en el V2.
// =============================================================================

/** Lo que va escrito en su WhatsApp: el pedido, sin el código. */
export const TEXTO_CONFIRMAR_V2 = 'Hola, quiero confirmar mi WhatsApp.';
/** Lo que MaKo le manda después del código, con su tarjeta de contacto (17/11, Martín: agendado baja el riesgo de baneo). */
export const AGENDAR_V2 = 'Guárdame en tus contactos para que pueda mandarte avances de tu negocio. Si no estoy guardado, WhatsApp puede frenar mis mensajes.';
/** Cuántos códigos equivocados se aceptan antes de pedir uno nuevo. */
export const TOPE_INTENTOS_V2 = 5;

/** ¿Este mensaje es el pedido de confirmación? Tolera que lo hayan tocado (sin tildes, sin el «Hola», con otra puntuación). */
export function esPedidoDeConfirmacion(texto: string | null | undefined): boolean {
  const t = String(texto ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  if (!t || t.length > 300) return false;
  return /confirm\w*\s+(mi\s+)?(whats?app|wsp|numero|telefono)/.test(t);
}

/** Un código de 6 números (el campo de la app los pide así: «El código de 6 números»). */
export function codigoNumerico(azar: () => number = Math.random): string {
  let c = '';
  for (let i = 0; i < LARGO_CODIGO; i++) c += String(Math.floor(azar() * 10) % 10);
  return c;
}

/** La respuesta de MaKo en su WhatsApp, con el código. */
export const mensajeDelCodigoV2 = (nombre: string, codigo: string): string =>
  `Hola${nombre.trim() ? ` ${nombre.trim()}` : ''}, soy MaKo.\nTu código para confirmar tu WhatsApp es ${codigo}.`;

/**
 * ¿Hay que armar un código NUEVO? (19/11/2026) Con el código vencido o con el tope de intentos lleno, los dos carteles de la app le dicen
 * «vuelve a mandarme el mensaje: te mando uno nuevo». Pero MaKo se callaba con el vencido (`'vencido'`) y con el tope le mandaba el MISMO
 * código, que la app seguía rechazando. Martín volvió a probar 30 minutos después del primer intento y cayó justo ahí.
 */
export function hayQueRenovarV2(v: Pick<EstadoVerificacion, 'expira' | 'intentos'>, ahora: number): boolean {
  return ahora > v.expira || (v.intentos ?? 0) >= TOPE_INTENTOS_V2;
}

/** El código nuevo: otro número, otra media hora, y los intentos en cero. Lo demás (el teléfono, la línea, el destino) no cambia. */
export function renovarCodigoV2<V extends EstadoVerificacion>(v: V, ahora: number, codigo: string): V {
  return { ...v, codigo, expira: ahora + MINUTOS_ENTRANTE * 60_000, intentos: 0 };
}

/** ¿A este pedido le contesta MaKo con el código de esta verificación? Sólo un V2 sin confirmar, por la línea del link y desde el número
 *  que dio (`esSuTelefono`). Si ya le contestó, le contesta otra vez (lo volvió a mandar: perdió el mensaje). Con el código vencido o el
 *  tope lleno, `renovar`: le contesta con uno NUEVO. Nunca se calla con quien sí es (19/11/2026). */
export function decidirPedidoV2(v: EstadoVerificacion | null | undefined, l: { instancia: string; telefono: string | null; ahora: number }):
  'responder' | 'renovar' | 'no-es-este' | 'ya-verificado' {
  if (!v || !v.v2 || !v.entrante) return 'no-es-este';
  if (v.verificado) return 'ya-verificado';
  if (v.linea && v.linea !== l.instancia) return 'no-es-este';
  if (!l.telefono || !esSuTelefono(v.telefono, l.telefono)) return 'no-es-este';
  if (hayQueRenovarV2(v, l.ahora)) return 'renovar';
  return 'responder';
}

/** Los textos de los errores del código, como en la maqueta (rojos, arriba de la caja, y que se entienda qué hacer). */
export const E_SIN_CODIGO_V2 = 'Todavía no tienes el código: toca «Abrir WhatsApp» y te lo mando.';
export const E_CODIGO_V2 = 'Ese no es el código. Copia los 6 números de mi último mensaje en tu WhatsApp y pégalos aquí.';
export const E_CODIGO_LARGO_V2 = 'El código tiene 6 números. Revisa que esté completo.';
export const E_CODIGO_VENCIDO_V2 = 'Ese código venció. Toca «Abrir WhatsApp» y vuelve a mandarme el mensaje: te mando uno nuevo.';
export const E_CODIGO_TOPE_V2 = 'Probaste muchos códigos. Toca «Abrir WhatsApp» y vuelve a mandarme el mensaje: te mando uno nuevo.';
/** «Reenviar el código» cuando MaKo no le puede escribir (no encuentra que le haya escrito): que lo pida desde su WhatsApp. */
export const E_REESCRIBIR_V2 = 'No pude mandártelo desde acá. Toca «Abrir WhatsApp» y mándame el mensaje otra vez: te contesto con un código nuevo.';

/** El código pegado en la app (V2). `intentos`: cuántos equivocados lleva con éste. */
export function decidirCodigoV2(v: EstadoVerificacion | null | undefined, escrito: string, ahora: number):
  { ok: true } | { ok: false; error: string; suma?: true } {
  const digitos = String(escrito ?? '').replace(/\D/g, '');
  if (!v || !v.v2) return { ok: false, error: E_SIN_CODIGO_V2 };
  if (v.verificado) return { ok: true };
  if (digitos.length !== LARGO_CODIGO) return { ok: false, error: E_CODIGO_LARGO_V2 };
  if (!v.respondido) return { ok: false, error: E_SIN_CODIGO_V2 };
  if ((v.intentos ?? 0) >= TOPE_INTENTOS_V2) return { ok: false, error: E_CODIGO_TOPE_V2 };
  if (ahora > v.expira) return { ok: false, error: E_CODIGO_VENCIDO_V2 };
  if (digitos !== v.codigo) return { ok: false, error: E_CODIGO_V2, suma: true };
  return { ok: true };
}
