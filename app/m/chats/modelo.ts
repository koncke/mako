// =============================================================================
// /m/chats — lo que DECIDE la pestaña Chats del teléfono, sin React ni server (17/10/2026)
// =============================================================================
// Desde el 17/10/2026 el teléfono lee la MISMA bandeja unificada que escritorio (`listarChats`,
// lib/chats.ts): WhatsApp de todas las líneas, Instagram, Messenger y Email, una fila por contacto. Hasta
// ese día leía sólo WhatsApp con lead, y un negocio que vende por Instagram veía «Todavía no hay chats.»
// con la bandeja de la computadora llena (docs/hallazgos-mobile.md, «Chats del teléfono»).
//
// El teléfono DESTILA la carcasa de escritorio (copiada de respond.io): las bandejas Todos · Míos · Sin
// asignar · Atiende MaKo (y Borradores y Bloqueados sólo cuando tienen algo), el filtro «Abiertas, Más
// recientes» con el canal adentro, «Sin responder» y la lupa. Los filtros son los de escritorio
// (`filtrarChats`, `contarBandejas`, lib/chats-reglas.ts): un lugar, no una copia. Los rótulos se escriben
// acá y tests/m-chats.test.ts los cruza contra el código de escritorio.
//
// Puro: lo cargan la página (server), la lista (cliente) y el test en Node.
// =============================================================================

import type { CanalChat, ChatResumen } from '@/lib/chats-tipos';
import { FILTRO_INICIAL, type FiltroChats, type MostrarChats, type OrdenChats, type VistaChats, type ConteosBandeja } from '@/lib/chats-reglas';
import { previewDe, type LinkProfundo } from '@/app/chats/lista-reglas';

/** Cuántas conversaciones viajan al teléfono (las más recientes). Lo demás, en la computadora. */
export const TOPE_FILAS_M = 150;
/** Cuántas páginas de 1000 mensajes de WhatsApp se leen por línea (las más nuevas). Ver lib/chats.ts. */
export const PAGINAS_WHATSAPP_M = 3;
/** Cuántas filas se dibujan antes de «Ver más» (el resto ya está en el teléfono). */
export const FILAS_POR_TANDA = 40;
/** Cada cuánto se vuelve a pedir el hilo abierto con la pestaña a la vista (escritorio sondea cada 15 s). */
export const CADA_MS_HILO = 15_000;

/** Una bandeja del riel de arriba. `siempre` = se ve aunque esté vacía (como las fijas de escritorio). */
export type BandejaM = { id: VistaChats; label: string; siempre: boolean };

/** Las bandejas, en el orden del panel de escritorio (app/chats/PanelBandejas.tsx). */
export const BANDEJAS_M: readonly BandejaM[] = [
  { id: 'todos', label: 'Todos', siempre: true },
  { id: 'mios', label: 'Míos', siempre: true },
  { id: 'sin-asignar', label: 'Sin asignar', siempre: true },
  { id: 'mako', label: 'Atiende MaKo', siempre: true },
  { id: 'borradores', label: 'Borradores', siempre: false },
  { id: 'bloqueados', label: 'Bloqueados', siempre: false },
];

/** «Mostrar» y «Orden», con los rótulos de escritorio (app/chats/ListaChats.tsx → MOSTRAR / ORDEN). */
export const MOSTRAR_M: ReadonlyArray<{ v: MostrarChats; label: string }> = [
  { v: 'todas', label: 'Todas' },
  { v: 'abiertas', label: 'Abiertas' },
  { v: 'cerradas', label: 'Cerradas' },
  { v: 'pospuestas', label: 'Pospuestas' },
];
export const ORDEN_M: ReadonlyArray<{ v: OrdenChats; label: string }> = [
  { v: 'recientes', label: 'Más recientes' },
  { v: 'antiguas', label: 'Más antiguas' },
];
/** Los canales, en el orden del selector de escritorio. */
export const CANALES_M: ReadonlyArray<{ v: CanalChat; label: string }> = [
  { v: 'whatsapp', label: 'WhatsApp' },
  { v: 'instagram', label: 'Instagram' },
  { v: 'messenger', label: 'Messenger' },
  { v: 'email', label: 'Email' },
];

/** Lo que el teléfono arranca mostrando: lo mismo que escritorio («Abiertas, Más recientes», Todos). */
export const FILTRO_INICIAL_M: FiltroChats = { ...FILTRO_INICIAL };

/** Cuántas cosas nuevas tiene una bandeja (la píldora azul). En «Bloqueados» no hay nuevas: es el total. */
export function conteoDeBandeja(c: ConteosBandeja, id: VistaChats): { n: number; nuevos: boolean } {
  switch (id) {
    case 'todos': return { n: c.todos.nuevos, nuevos: true };
    case 'mios': return { n: c.mios.nuevos, nuevos: true };
    case 'sin-asignar': return { n: c.sinAsignar.nuevos, nuevos: true };
    case 'mako': return { n: c.mako.nuevos, nuevos: true };
    case 'borradores': return { n: c.borradores.abiertas, nuevos: false };
    case 'bloqueados': return { n: c.bloqueados.abiertas, nuevos: false };
  }
}

/** Las bandejas que se dibujan: las fijas siempre; Borradores y Bloqueados, sólo con algo adentro. */
export function bandejasVisibles(c: ConteosBandeja): BandejaM[] {
  return BANDEJAS_M.filter((b) => b.siempre || conteoDeBandeja(c, b.id).n > 0);
}

/** «Abiertas, Más recientes»: el rótulo del botón del filtro dice las dos cosas, como escritorio. */
export function rotuloFiltro(f: Pick<FiltroChats, 'mostrar' | 'orden' | 'canal'>): string {
  const m = MOSTRAR_M.find((x) => x.v === f.mostrar)?.label ?? 'Abiertas';
  const o = ORDEN_M.find((x) => x.v === f.orden)?.label ?? 'Más recientes';
  const c = f.canal ? CANALES_M.find((x) => x.v === f.canal)?.label : null;
  return c ? `${c} · ${m}, ${o}` : `${m}, ${o}`;
}

/** Los canales que aparecen en la lista (para no ofrecer en el filtro uno que no hay). */
export function canalesPresentes(chats: readonly Pick<ChatResumen, 'canales'>[]): CanalChat[] {
  const hay = new Set<CanalChat>();
  for (const c of chats) for (const i of c.canales) hay.add(i.canal);
  return CANALES_M.map((x) => x.v).filter((v) => hay.has(v));
}

/**
 * La segunda línea de una fila: lo último, con «Tú: » si lo mandamos nosotros (como el teléfono de antes
 * y WhatsApp). Un adjunto se dice por su tipo (`previewDe`, el mismo de escritorio). Sin mensajes (un
 * contacto sin historial), «Sin mensajes».
 */
export function segundaLinea(c: Pick<ChatResumen, 'ultimoTexto' | 'ultimoTipo' | 'ultimaFecha' | 'ultimoEntrante'>): string {
  const t = previewDe(c);
  if (!t) return 'Sin mensajes';
  return c.ultimoEntrante ? t : `Tú: ${t}`;
}

/** La pantalla de UNA conversación en el teléfono. La clave lleva `:` (y `@` en un email): va codificada. */
export const rutaHiloM = (clave: string): string => `/m/chats/${encodeURIComponent(clave)}`;

/**
 * A dónde lleva un link profundo de escritorio (`/chats?c=`, `?lead=`) sin leer la lista: la clave ya
 * nombra la conversación (`lead:N` también: el hilo de un lead sin mensajes existe para escribirle). El de
 * WhatsApp (`?linea=&chat=`) no nombra una clave: se resuelve contra la lista (null acá).
 */
export function hiloDelLink(link: LinkProfundo | null): string | null {
  if (!link) return null;
  if (link.tipo === 'clave') return rutaHiloM(link.clave);
  if (link.tipo === 'lead') return rutaHiloM(`lead:${link.leadId}`);
  return null;
}
