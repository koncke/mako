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
  const base = { link: linkWaMe(v.numeroLinea, textoParaMandar(v.codigo)), numeroLinea: v.numeroLinea ?? null, telefono: v.telefono, otroNumero: v.otroNumero ?? null };
  if (v.verificado) return { ...base, estado: 'verificado' };
  if (ahora > v.expira) return { ...base, estado: 'vencido' };
  return { ...base, estado: v.otroNumero ? 'otro-numero' : 'esperando' };
}
