// =============================================================================
// La pieza única de chat con MaKo — las reglas, sin React y sin server (16/10/2026)
// =============================================================================
// Etapa 2 de docs/diseno-mako-ai-native.md: todos los chats con MaKo con la cara del Centro de Operaciones. Martín,
// por el coordinador: «Termina con todo, faltan mis pedidos del Second Brain». Esta es la primera tanda: el Second
// Brain (/second-brain) pasa a ser el chat con MaKo, con su barra de chats a la izquierda.
//
// EL JEFE «SECOND BRAIN» SON LAS SESIONES DEL TELÉFONO (`mako-movil:u<id>`, lib/mako-turno-app-reglas.ts →
// chartKeyDePersona): las mismas conversaciones que la persona ya tiene en /m/mako, sin migrar nada. La más VIEJA es el
// jefe; las demás son sus sub-chats («Second Brain › <título>»), como los hilos de un canal de Discord.
// ⚠️ La más vieja y no la más reciente: con la más reciente el jefe cambiaba de fila cada vez que se escribía en otro.
//
// SIN imports de valores: lo usan la pantalla ('use client') y los tests.

import type { SesionChat } from './mako-turno-app-reglas';

/** El nombre del jefe del chat con MaKo (y de la tab). */
export const JEFE_SECOND_BRAIN = 'Second Brain';
/** El título de una conversación que todavía no tiene: el modelo se lo pone después del primer turno. */
export const SIN_TITULO = 'Chat nuevo';

export type ArbolDelJefe = {
  /** La conversación que ES el jefe (la más vieja); null = la persona todavía no tiene ninguna. */
  jefe: SesionChat | null;
  /** Las demás, la que se movió último arriba (como la barra de Claude y ChatGPT). */
  subs: SesionChat[];
};

/** El jefe y sus sub-chats. Los ids son correlativos: el más chico es el más viejo, y no cambia al escribir. */
export function arbolDelJefe(sesiones: readonly SesionChat[]): ArbolDelJefe {
  if (!sesiones.length) return { jefe: null, subs: [] };
  const jefe = sesiones.reduce((a, b) => (b.id < a.id ? b : a));
  const subs = sesiones.filter((s) => s.id !== jefe.id)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || b.id - a.id);
  return { jefe, subs };
}

/** El título que se dibuja de un sub-chat (el del jefe es siempre «Second Brain»). */
export const tituloDe = (s: Pick<SesionChat, 'titulo'>): string => s.titulo?.trim() || SIN_TITULO;

/** El nombre completo de un sub-chat, con la convención del jefe («Second Brain › Precios»): de él sale su muñeco. */
export const nombreDeSub = (s: Pick<SesionChat, 'titulo'>): string => `${JEFE_SECOND_BRAIN} › ${tituloDe(s)}`;

/** La búsqueda de la barra: sin mayúsculas ni tildes. El jefe se ve siempre (es la casa). */
const normal = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
export function filtrarSubs(subs: readonly SesionChat[], busca: string): SesionChat[] {
  const b = normal(busca);
  return b ? subs.filter((s) => normal(tituloDe(s)).includes(b)) : [...subs];
}

/** La edad de una fila, corta como en Codex: «ahora», «12 min», «3 h», «2 d». */
export function edadCorta(t: number | null, ahora: number): string {
  if (t == null || !Number.isFinite(t)) return '';
  const s = Math.max(0, Math.round((ahora - t) / 1000));
  if (s < 60) return 'ahora';
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 86_400) return `${Math.round(s / 3600)} h`;
  return `${Math.round(s / 86_400)} d`;
}

/** Cuántos sub-chats se ven antes de «Mostrar N más» (los de la barra del Centro son 14). */
export const SUBS_VISIBLES = 12;

/**
 * Lo que el turno sabe de DÓNDE está la persona (va al final del system y manda sobre la voz del teléfono:
 * lib/mako-turno-app.ts → `contexto`). Sin esto, MaKo contesta en la computadora como si fuera el celular: «2-5 líneas».
 */
export const CONTEXTO_SECOND_BRAIN = `EN ESTE CHAT (el Second Brain de MaKo, en la COMPUTADORA), y esto manda sobre la voz del teléfono: la persona está en su escritorio, con la pantalla entera. Responde completo pero sin relleno: puedes usar listas cortas y negritas cuando ordenan, nunca tablas largas ni JSON. Es el chat central del negocio: si lo que pide se hace en otra pantalla de MaKo, dilo y nombra la pantalla.`;

/**
 * De quién es un chat del Second Brain: la base `mako-movil:<persona>` de su clave. Un sub-chat de otra tab lleva un
 * sufijo (`mako-movil:u5:crm:12`), y su persona es la misma. null = no es un chat del Second Brain.
 */
export function baseDeLaPersona(chartKey: string | null | undefined): string | null {
  const m = /^mako-movil:[^:]+/.exec(String(chartKey ?? ''));
  return m ? m[0] : null;
}

/** La conversación de un turno de la app: su clave de canal es `app:<id>` (lib/mako-turno-app-reglas.ts). */
export function sesionDelCanal(canalKey: string | null | undefined): number | null {
  const m = /^app:(\d+)$/.exec(String(canalKey ?? ''));
  const n = m ? Number(m[1]) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** El título de un chat de antes (de /mako): el suyo, o de qué era. */
export const SECCION_ANTES = 'Antes';
export const AVISO_ANTES = 'Este chat es de antes. Sigue en uno nuevo.';

/** Las preguntas de arranque, con el hilo vacío: lo que más se le pide al chat central. */
export const ARRANQUES_SECOND_BRAIN = ['¿Qué hago hoy?', '¿Cómo viene el mes?', '¿Qué sabes de mi negocio?'] as const;

// ── «Entender el pedido» en el Second Brain (tanda 10, 16/10/2026) ───────────────────────────────────────────────

/** Un link a la pantalla donde se hace algo que la persona pidió (`otra-tab` de /api/mako/pedidos). */
export type IrA = { titulo: string; link: string };
/** Como mucho, los links debajo de una respuesta. */
const MAX_IR_A = 3;

/**
 * Los links que el Second Brain deja debajo de la respuesta de MaKo: los pedidos de OTRA tab que entendió
 * /api/mako/pedidos (docs/diseno-mako-pedidos.md, «El punto de enganche»).
 *
 * ⚠️ EN EL SECOND BRAIN NO SE PARTE EL MENSAJE. En un editor, lo de otra tab se saca del mensaje y queda sólo el link;
 *    acá no hay nada abierto, así que TODO lo que nombra un área sería «otra tab», y el chat central dejaría de
 *    contestar. MaKo contesta el mensaje entero con sus herramientas (las de todas las áreas) y esto SUMA el link para
 *    ir a la pantalla («que el chat le deje ahí el link para ir a donde corresponde», Martín).
 * ⚠️ La respuesta es de la red: se lee como dato. Sólo links RELATIVOS de la app (ni `//` ni un esquema), sin repetir,
 *    y nunca el propio Second Brain.
 */
export function linksDePedidos(r: unknown): IrA[] {
  const pedidos = r && typeof r === 'object' && Array.isArray((r as { pedidos?: unknown }).pedidos) ? (r as { pedidos: unknown[] }).pedidos : [];
  const out: IrA[] = [];
  for (const p of pedidos) {
    if (!p || typeof p !== 'object') continue;
    const o = p as Record<string, unknown>;
    if (o.sobre !== 'otra-tab' || typeof o.link !== 'string' || typeof o.titulo !== 'string' || !o.titulo.trim()) continue;
    const link = o.link.trim();
    if (!link.startsWith('/') || link.startsWith('//') || link.includes('\\')) continue;
    const ruta = link.split(/[?#]/)[0];
    if (ruta === '/second-brain' || ruta.startsWith('/second-brain/')) continue;
    if (out.some((x) => x.link.split(/[?#]/)[0] === ruta)) continue;
    out.push({ titulo: o.titulo.trim().slice(0, 60), link });
    if (out.length >= MAX_IR_A) break;
  }
  return out;
}

/**
 * Cuelga los links de la respuesta de MaKo a UN mensaje de la persona (`despuesDe`, su id): del último mensaje de MaKo
 * entre ése y el siguiente de la persona (tanda 10, 17/10/2026). Los links llegan cuando llegan, y para entonces la
 * persona pudo haber escrito otra cosa: no se cuelgan de la respuesta equivocada. Si esa respuesta no trae un mensaje de
 * MaKo (sólo una tarjeta), o el mensaje ya no está (cambió de chat), no se dibujan: no se inventa una burbuja. Nada de la
 * respuesta se saca ni se cambia.
 */
export function colgarIrA<T extends { k: string; id: string; role?: string }>(items: readonly T[], links: readonly IrA[], despuesDe: string): T[] {
  const desde = items.findIndex((x) => x.id === despuesDe);
  let i = -1;
  if (links.length && desde >= 0) {
    for (let j = desde + 1; j < items.length; j++) {
      const x = items[j];
      if (x.k === 'msg' && x.role === 'user') break;
      if (x.k === 'msg' && x.role === 'assistant') i = j;
    }
  }
  return i < 0 ? [...items] : items.map((x, j) => (j === i ? { ...x, irA: [...links] } : x));
}

/** El grupo de WhatsApp de MaKo en la barra del Second Brain (tanda 8): se lee acá y se contesta allá. */
export const TITULO_GRUPO = 'MaKo en WhatsApp';
export const AVISO_GRUPO = 'Se contesta en el grupo de WhatsApp.';

/** ¿Es un momento válido para pedir la página anterior del grupo? (`?antes=` de la ruta: una fecha ISO, nada más). */
export function antesValido(v: unknown): string | null {
  if (typeof v !== 'string' || v.length > 40 || !/^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:?\d{2})$/.test(v)) return null;
  return Number.isFinite(Date.parse(v)) ? v : null;
}

// ── «Lo que hizo» (tanda 7) ──────────────────────────────────────────────────────────────────────────────────────

/** Cómo quedó una acción que MaKo dejó en el chat (lo que dibuja el riel). Los rótulos salen de PILL_PROPUESTA. */
export type EstadoHecho = 'pendiente' | 'aplicando' | 'hecho' | 'cancelada' | 'vencida' | 'fallo';
export type HechoChat = { id: number; tipo: string; resumen: string; estado: EstadoHecho; at: string; resueltoAt: string | null };

/**
 * El estado de una fila de `mako_acciones_pendientes`, en las palabras de la tarjeta del chat (`EstadoPropuesta` de
 * app/m/mako/chat-ui.ts). Una pendiente con el plazo pasado es «vencida» aunque la fila todavía diga 'pendiente':
 * nadie la venció (esto es una lectura; `vencerExpiradas` escribe).
 */
export function estadoDeLoHecho(estado: string, venceAt: string | null, ahora: number): EstadoHecho {
  if (estado === 'pendiente') {
    const t = venceAt ? Date.parse(venceAt) : NaN;
    return Number.isFinite(t) && t <= ahora ? 'vencida' : 'pendiente';
  }
  if (estado === 'confirmada') return 'aplicando';
  if (estado === 'ejecutada') return 'hecho';
  if (estado === 'cancelada') return 'cancelada';
  if (estado === 'vencida') return 'vencida';
  return 'fallo';
}
