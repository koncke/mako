// =============================================================================
// lista-reglas — lo que decide la CARCASA de Chats (bandeja, lista, drawer), sin React ni DOM
// =============================================================================
// La carcasa es lo que rodea a la ventana del chat, copiada de respond.io (docs/diseno-chats.md §3):
// ChatsApp.tsx (estado, links profundos), PanelBandejas.tsx, ListaChats.tsx y PanelContacto.tsx. Lo
// que esas piezas DECIDEN vive acá, puro, para que tests/chats-pantalla.test.ts lo EJECUTE:
//   · la hora de una fila («1:44 p. m.», «Ayer», «Viernes», «27 mar»);
//   · el texto de la segunda línea («(Imagen)», «(Audio)»…), como respond.io («(Image)», «(File)»);
//   · cómo se resuelve un link profundo (`?c=`, `?lead=`, `?linea=&chat=`) contra la lista, y por qué
//     uno que no matchea NO elige otra conversación;
//   · la clave del navegador, con el workspace adentro.
//
// Las fechas reusan las de la ventana (./ventana-reglas.ts): «hoy» y «4:22 p. m.» se escriben en UN
// lugar, así la fila y el hilo no pueden decir dos horas distintas del mismo mensaje.
//
// De lib/chats-tipos sólo tipos; lib/chats-links, lib/chats-reglas y ./ventana-reglas son puros (sin
// server-only ni React): este archivo lo carga el test en Node, tal cual.

import type { ChatResumen, FormatoMsg } from '@/lib/chats-tipos';
import { PARAM_CHATS } from '@/lib/chats-links';
import { FILTRO_INICIAL, ultimos10, type FiltroChats } from '@/lib/chats-reglas';
import { claveDia, fechaDe, horaCorta } from './ventana-reglas';

// ── La hora de la fila ───────────────────────────────────────────────────────────────────────

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/** Medianoche local del día de `d`: para contar días de calendario, no de 24 h. */
function inicioDia(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * La hora a la derecha del nombre, como respond.io (15-conv-list, 34-contact-assignment):
 *   hoy → «1:44 p. m.» · ayer → «Ayer» · los últimos 6 días → el día («Viernes») ·
 *   este año → «27 mar» · antes → «27 mar 2025».
 * ⚠️ Los días se cuentan por CALENDARIO (medianoche local), no de a 24 h: un mensaje de anoche a las
 *    23:50 visto a las 00:10 es «Ayer», aunque hayan pasado 20 minutos.
 */
export function horaDeFila(iso: string | null | undefined, ahora: Date): string {
  const d = fechaDe(iso);
  if (!d) return '';
  if (claveDia(d) === claveDia(ahora)) return horaCorta(d);
  const dias = Math.round((inicioDia(ahora) - inicioDia(d)) / 86_400_000);
  if (dias === 1) return 'Ayer';
  if (dias > 1 && dias <= 6) return DIAS[d.getDay()];
  const base = `${d.getDate()} ${MESES[d.getMonth()]}`;
  return d.getFullYear() === ahora.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

// ── La segunda línea ─────────────────────────────────────────────────────────────────────────

/** Lo que dice la fila de un adjunto (respond.io: «(Image)», «(Audio)», «(File)», «(Unsupported Message)»). */
const ADJUNTO: Record<Exclude<FormatoMsg, 'text'>, string> = {
  image: '(Imagen)',
  audio: '(Audio)',
  video: '(Video)',
  document: '(Archivo)',
  sticker: '(Sticker)',
  otro: '(Mensaje no compatible)',
};

/**
 * El texto de la segunda línea. Un adjunto se dice por su tipo y NO por su texto: en un documento el
 * texto es el NOMBRE del archivo (lib/evolution-mensajes.ts), y «contrato_final_v3.pdf» en la lista se
 * lee como si la persona lo hubiera escrito. Sin último mensaje (un lead de la búsqueda), ''.
 */
export function previewDe(c: Pick<ChatResumen, 'ultimoTexto' | 'ultimoTipo' | 'ultimaFecha'>): string {
  const tipo = c.ultimoTipo ?? 'text';
  if (tipo !== 'text') return ADJUNTO[tipo];
  const t = (c.ultimoTexto ?? '').replace(/\s+/g, ' ').trim();
  return t;
}

// ── La pestaña «Actividad» del drawer ────────────────────────────────────────────────────────

/** Qué dibujo lleva la tarjeta de un evento (el ícono lo elige la pantalla por este nombre). */
export type ClaseEvento = 'cerrada' | 'reabierta' | 'pospuesta' | 'reanudada' | 'etapa' | 'asignada' | 'sin-asignar' | 'closer' | 'otro';

/**
 * El título de la tarjeta de un evento, como las de respond.io («Assigned», «Snoozed», «Contact»…).
 * El evento llega como TEXTO en partes (`MensajeChat.partes`), sin su tipo: se reconoce por cómo
 * empieza, que es el copy que escribe lib/chats-reglas.ts (`partesDeEvento`, `partesDeAudit`). Si
 * ese copy cambia, cae en «Actividad» con su texto intacto — nunca un título equivocado.
 */
export function claseDeEvento(texto: string | null | undefined): { clase: ClaseEvento; titulo: string } {
  const t = (texto ?? '').trim();
  if (t.startsWith('Cerrada')) return { clase: 'cerrada', titulo: 'Cerrada' };
  if (t.startsWith('Reabierta')) return { clase: 'reabierta', titulo: 'Reabierta' };
  if (t.startsWith('Pospuesta')) return { clase: 'pospuesta', titulo: 'Pospuesta' };
  if (t.startsWith('Reanudada')) return { clase: 'reanudada', titulo: 'Reanudada' };
  if (t.startsWith('Etapa')) return { clase: 'etapa', titulo: 'Etapa' };
  if (t.startsWith('Asignación quitada')) return { clase: 'sin-asignar', titulo: 'Sin asignar' };
  if (t.startsWith('Asignada')) return { clase: 'asignada', titulo: 'Asignado' };
  if (t.startsWith('Closer')) return { clase: 'closer', titulo: 'Closer' };
  return { clase: 'otro', titulo: 'Actividad' };
}

// ── Links profundos ──────────────────────────────────────────────────────────────────────────

/** Un link que pide abrir UNA conversación (docs/diseno-chats.md §4, lib/chats-links.ts). */
export type LinkProfundo =
  | { tipo: 'clave'; clave: string }
  | { tipo: 'lead'; leadId: number }
  | { tipo: 'whatsapp'; linea: string | null; chat: string };

/**
 * Lee el link de la URL. `?c=` gana sobre los otros dos (es la selección de la propia pantalla); un
 * `?lead=` que no es un entero positivo no es un link (no se adivina).
 */
export function leerLinkProfundo(get: (k: string) => string | null): LinkProfundo | null {
  const clave = get(PARAM_CHATS.clave)?.trim();
  if (clave) return { tipo: 'clave', clave };
  const lead = get(PARAM_CHATS.lead)?.trim();
  if (lead) {
    const id = Number(lead);
    return Number.isInteger(id) && id > 0 ? { tipo: 'lead', leadId: id } : null;
  }
  const chat = get(PARAM_CHATS.chat)?.trim();
  if (chat) return { tipo: 'whatsapp', linea: get(PARAM_CHATS.linea)?.trim() || null, chat };
  return null;
}

/**
 * Los últimos 10 dígitos de un jid o un teléfono (la llave con que la bandeja de WhatsApp junta las
 * variantes de un jid), o null con menos de 8: un grupo o un @lid corto no matchea por dígitos. Sólo
 * la parte de antes de la `@`: los dígitos del dominio no son del número. La regla de los 10 es la
 * de lib/chats-reglas.ts (`ultimos10`), no una copia.
 */
function digitosDe(s: string | null | undefined): string | null {
  const d = ultimos10((s ?? '').split('@')[0]);
  return d.length >= 8 ? d : null;
}

/**
 * La conversación que pide el link, o null. ⚠️ NUNCA OTRA: null es «todavía no está», y quien llama
 * espera la próxima lectura o no selecciona nada. La bandeja vieja de /whatsapp abría `convs[0]` con un
 * `?lead=` que no encontraba, o sea la conversación de OTRA persona (relevamiento, whatsapp.md §5.6).
 *
 * WhatsApp matchea por `ref` (el jid) en esa línea, y si no por los últimos 10 dígitos del jid contra
 * los de la identidad: el jid representante de un chat CAMBIA cuando llega con otra variante (@lid,
 * 549/54, 521/52) y el aviso que armó el link pudo ver la otra. Es la misma persona en la misma línea.
 */
export function resolverLinkProfundo(chats: readonly ChatResumen[], link: LinkProfundo): ChatResumen | null {
  if (link.tipo === 'clave') return chats.find((c) => c.clave === link.clave) ?? null;
  if (link.tipo === 'lead') {
    return chats.find((c) => c.clave === `lead:${link.leadId}`) ?? chats.find((c) => c.leadId === link.leadId) ?? null;
  }
  const enLinea = (c: ChatResumen) => c.canales.filter((i) => i.canal === 'whatsapp' && (link.linea == null || i.cuenta === link.linea));
  const exacto = chats.find((c) => enLinea(c).some((i) => i.ref === link.chat));
  if (exacto) return exacto;
  const u10 = digitosDe(link.chat);
  if (!u10) return null;
  return chats.find((c) => enLinea(c).some((i) => digitosDe(i.ref) === u10 || digitosDe(i.telefono) === u10)) ?? null;
}

/** Qué hacer con un link pendiente después de una lectura de la lista. */
export type PasoLink =
  | { paso: 'elegir'; chat: ChatResumen }
  | { paso: 'esperar' }
  /** No apareció en dos lecturas: se suelta y NO se elige nada (la clave exacta, a lo sumo, se pide sola). */
  | { paso: 'soltar' };

/**
 * El link contra una lectura. `lecturasSinVerlo` = cuántas lecturas ANTERIORES ya no lo encontraron.
 * Espera UNA más (el aviso de un mensaje nuevo puede llegar antes que la fila a la lista) y suelta.
 */
export function pasoDelLink(chats: readonly ChatResumen[], link: LinkProfundo, lecturasSinVerlo: number): PasoLink {
  const chat = resolverLinkProfundo(chats, link);
  if (chat) return { paso: 'elegir', chat };
  return lecturasSinVerlo < 1 ? { paso: 'esperar' } : { paso: 'soltar' };
}

/** La clave EXACTA que nombra un link (para pedirla sola cuando no está en la lista), o null. */
export function claveDelLink(link: LinkProfundo): string | null {
  if (link.tipo === 'clave') return link.clave;
  if (link.tipo === 'lead') return `lead:${link.leadId}`;
  return null;
}

// ── El navegador ─────────────────────────────────────────────────────────────────────────────

/**
 * La clave del navegador para las comodidades de la carcasa (secciones plegadas, el drawer, el filtro).
 * ⚠️ LLEVA EL WORKSPACE (AGENTS.md, «lo que se guarda en el navegador lleva el workspace en la clave»):
 * el super admin abre un cliente por pestaña, y sin el ws el filtro de uno aparece en el otro. El ws
 * sale del server (prop), nunca de leer `?ws=` de la URL.
 */
export const claveLocalChats = (ws: number | null, nombre: string): string => `mako-chats:ws${ws ?? 'propio'}:${nombre}`;

/**
 * El filtro de la lista que se recuerda entre visitas: «Mostrar», «Orden» y «Sin responder» (lo que la
 * persona elige en la barra de la lista). La BANDEJA no se recuerda: una etapa o una línea guardada que
 * ya no existe dejaría la lista vacía con un ítem del panel que no se ve marcado.
 */
export function filtroRecordado(raw: string | null): Pick<FiltroChats, 'mostrar' | 'orden' | 'sinResponder'> {
  const base = { mostrar: FILTRO_INICIAL.mostrar, orden: FILTRO_INICIAL.orden, sinResponder: FILTRO_INICIAL.sinResponder };
  if (!raw) return base;
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    const mostrar = (['todas', 'abiertas', 'cerradas', 'pospuestas'] as const).find((m) => m === j?.mostrar) ?? base.mostrar;
    const orden = (['recientes', 'antiguas'] as const).find((o) => o === j?.orden) ?? base.orden;
    return { mostrar, orden, sinResponder: j?.sinResponder === true };
  } catch {
    return base;
  }
}

type Almacen = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * El localStorage, o null. ⚠️ El ACCESO puede tirar (Safari en privado, sitio con datos bloqueados):
 * por eso se pide acá adentro de un try y no como `window.localStorage` suelto en cada pantalla.
 */
export function almacenLocal(): Almacen | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Lee una comodidad de la carcasa. null = no hay, o el navegador no deja leer (se dibuja el default). */
export function leerLocal(st: Almacen | null, ws: number | null, nombre: string): string | null {
  if (!st) return null;
  try {
    return st.getItem(claveLocalChats(ws, nombre));
  } catch {
    return null;
  }
}

/** Guarda una comodidad de la carcasa. Nunca tira: lleno o bloqueado, vive lo que dura la pestaña. */
export function guardarLocal(st: Almacen | null, ws: number | null, nombre: string, valor: string): void {
  if (!st) return;
  try {
    st.setItem(claveLocalChats(ws, nombre), valor);
  } catch {
    /* lleno o bloqueado */
  }
}
