// =============================================================================
// El Centro como app de chats — la lista y lo que hizo cada chat, sin base y sin React (15/10/2026)
// =============================================================================
// Martín (15/10/2026): «Al principio debería haber una tab que simule los chats... copia el diseño del
// grok... "En curso" podría ser el ícono verde en los chats de grok... "Pushes" podría estar en un apartado
// tipo historial de cada chat». Esto arma la lista (con su punto) y lo de cada chat; la pantalla es aparte.
//
// ⚠️ UN CHAT ES UNA SESIÓN, NUNCA UN TÍTULO. Medido el 15/10: de los 37 chats que anotaron en sus bitácoras
// en 14 días, sólo 17 coinciden por título con los 53 que subió el cartero, y el cartero tiene 5 títulos
// repetidos («CRM», «General», «Ads Manager»…). Juntar por nombre pega el trabajo de un chat a otro. Un hito
// se junta con un chat sólo si trae `sesion`; si no la trae (todos los anteriores al 16/10), va a un chat
// «por nombre» aparte (`porNombre`), que la pantalla muestra como tal y nunca se mezcla con uno del cartero.
//
// ⚠️ EL PUNTO TIENE EDAD. Ocupado / abierto / cerrado lo sube el cartero en cada vuelta; si el cartero no dio
// vuelta en CARTERO_VIVO_MS, el estado es una foto (`viejo`) y se dibuja con su «visto hace…». Un chat que
// ningún cartero vio no tiene estado (`sin_dato`), y eso no es «cerrado».
//
// ⚠️ LA LISTA DICE DE DÓNDE SALE. Hoy sólo la cuenta 1 tiene cartero: los chats abiertos de las otras cuentas
// no están. `cuentasConCartero` lo dice para que la pantalla no parezca completa.
//
// ⚠️ SIN `server-only`, a propósito: lo leen el servidor, las pantallas y los tests.

import { CARTERO_VIVO_MS, DESTINO_RE, type ChatCartero } from './operaciones-reglas';
import { instanteHito, type AreaP, type PasoP, type PedidoP } from './progreso-reglas';

export type EstadoChat = 'trabajando' | 'abierto' | 'cerrado' | 'sin_dato';

export type ChatCentro = {
  /** La sesión (`local_…`/`cli_…`) o, para lo anotado sin sesión, `nombre:<título normalizado>`. */
  clave: string;
  sesion: string | null;
  /** true = se conoce sólo por el título de la bitácora: no se juntó con ninguna sesión. */
  porNombre: boolean;
  titulo: string;
  cuenta: string | null;
  estado: EstadoChat;
  /** Cuándo vio un cartero ese estado (null = ninguno lo vio). */
  vistoAt: number | null;
  /** El cartero que lo vio no da vuelta hace rato: el estado es una foto vieja. */
  viejo: boolean;
  /** Lo último que se sabe de él: la actividad que ve la app o su último hito. */
  actividad: number | null;
  /** Los pedidos que trabajó (ids de PedidoP), el más reciente primero. Uno puede estar en varios chats. */
  pedidos: string[];
  /** Los pedidos que Martín le hizo a ESTE chat y trabajó otro (el coordinador reparte). */
  pidioAca: string[];
  /** Los trabajos firmados que se le mandaron (ids de la cola). */
  trabajos: string[];
};

/** Lo mínimo de un cartero (lib/operaciones.ts → Cartero). */
export type CarteroP = { cuenta: string; vistoAt: string | null; chats: readonly ChatCartero[] };
/** Lo mínimo de un trabajo de la cola (lib/operaciones.ts → Pedido). */
export type TrabajoP = { id: string; destino: string; destino_titulo: string | null; destino_cuenta: string | null; created_at: string };

const normal = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
const fecha = (v: string | null | undefined) => { const t = v ? Date.parse(v) : NaN; return Number.isFinite(t) ? t : null; };

/** La clave de un chat conocido sólo por su título (lo anotado sin `sesion`). */
export const claveDeNombre = (titulo: string) => `nombre:${normal(titulo)}`;

/** A qué chat pertenece un paso o un hito: su sesión si la trae; si no, su título, aparte. */
export function claveDe(x: { chat: string; sesion?: string | null }): string {
  return x.sesion && DESTINO_RE.test(x.sesion) ? x.sesion : claveDeNombre(x.chat);
}

/** Los pasos de un pedido que hizo ESTE chat (un pedido repartido se ve en cada uno con lo suyo). */
export function pasosDelChat(p: PedidoP, clave: string): PasoP[] {
  return p.pasos.filter((s) => claveDe(s) === clave);
}

/**
 * La lista de chats del Centro: los que subieron los carteros (con sesión y estado) y los que sólo aparecen
 * en las bitácoras, con lo que trabajó cada uno. Entran los que se movieron en los últimos `dias`, los que
 * están abiertos y los que tienen trabajos. Primero los que están trabajando; después, por actividad.
 */
export function chatsDelCentro({ carteros, areas, pedidos, trabajos, ahora, dias = 14 }: {
  carteros: readonly CarteroP[];
  areas: readonly AreaP[];
  pedidos: readonly PedidoP[];
  trabajos: readonly TrabajoP[];
  ahora: number;
  dias?: number;
}): ChatCentro[] {
  const desde = ahora - dias * 86_400_000;
  const chats = new Map<string, ChatCentro>();
  const nuevo = (clave: string, titulo: string, cuenta: string | null): ChatCentro => ({
    clave, sesion: clave.startsWith('nombre:') ? null : clave, porNombre: clave.startsWith('nombre:'), titulo, cuenta,
    estado: 'sin_dato', vistoAt: null, viejo: false, actividad: null, pedidos: [], pidioAca: [], trabajos: [],
  });
  const tomar = (clave: string, titulo: string, cuenta: string | null) => {
    let c = chats.get(clave);
    if (!c) { c = nuevo(clave, titulo, cuenta); chats.set(clave, c); }
    return c;
  };
  const mover = (c: ChatCentro, t: number | null) => { if (t != null && (c.actividad == null || t > c.actividad)) c.actividad = t; };

  // 1. Lo que subió cada cartero: sesión, título y estado, con la edad de su vuelta.
  for (const k of carteros) {
    const visto = fecha(k.vistoAt);
    const viejo = visto == null || ahora - visto >= CARTERO_VIVO_MS;
    for (const ch of k.chats) {
      if (!DESTINO_RE.test(ch.local)) continue;
      const c = tomar(ch.local, ch.titulo, ch.cuenta ?? k.cuenta);
      c.estado = !ch.vivo ? 'cerrado' : ch.estado === 'busy' ? 'trabajando' : 'abierto';
      c.vistoAt = visto;
      c.viejo = viejo;
      mover(c, fecha(ch.actividad));
    }
  }

  // 2. Las bitácoras: cada hito a su chat (por sesión, o aparte por nombre). Así un chat que el cartero no ve
  //    —de otra cuenta, o cerrado hace días— aparece igual con lo que hizo.
  for (const a of areas) {
    for (const h of a.bitacora) {
      const t = instanteHito(h.fecha, h.hora, ahora);
      if (t == null || t < desde || !h.chat || h.chat === '—') continue;
      mover(tomar(claveDe(h), h.chat, h.cuenta || null), t);
    }
  }

  // 3. Los pedidos: en cada chat que hizo un paso, y en el que se pidió si lo trabajó otro.
  for (const p of [...pedidos].sort((x, y) => y.ultimo - x.ultimo)) {
    const hicieron = new Set(p.pasos.map((s) => claveDe(s)));
    for (const clave of hicieron) {
      const c = chats.get(clave);
      if (c && !c.pedidos.includes(p.id)) c.pedidos.push(p.id);
    }
    const pidio = claveDe(p.pidioEn);
    if (!hicieron.has(pidio)) chats.get(pidio)?.pidioAca.push(p.id);
  }

  // 4. Los trabajos firmados: a la sesión de destino, aunque el cartero no la vea ahora.
  for (const w of trabajos) {
    if (!DESTINO_RE.test(w.destino)) continue;
    const c = tomar(w.destino, w.destino_titulo || 'Chat sin título', w.destino_cuenta);
    c.trabajos.push(w.id);
    mover(c, fecha(w.created_at));
  }

  const peso: Record<EstadoChat, number> = { trabajando: 0, abierto: 1, cerrado: 2, sin_dato: 2 };
  return [...chats.values()]
    .filter((c) => c.estado === 'trabajando' || c.estado === 'abierto' || c.trabajos.length > 0 || (c.actividad ?? 0) >= desde)
    .sort((x, y) => {
      // Lo vivo arriba sólo si el dato es fresco: con el cartero quieto, todos ordenan por actividad.
      const px = x.viejo ? 2 : peso[x.estado];
      const py = y.viejo ? 2 : peso[y.estado];
      return px - py || (y.actividad ?? 0) - (x.actividad ?? 0) || x.titulo.localeCompare(y.titulo);
    });
}

/** Una línea de la conversación de un chat, como en Grok: lo que pidió Martín y lo que hizo el chat. */
export type LineaChat =
  /** Un pedido que trabajó ESTE chat, con sus pasos (sólo los suyos). `desde` = el chat donde se pidió, si fue otro. */
  | { tipo: 'pedido'; instante: number; pedido: PedidoP; pasos: PasoP[]; desde: string | null }
  /** Un pedido que Martín le hizo a ESTE chat y trabajó otro: quedó repartido. */
  | { tipo: 'derivado'; instante: number; pedido: PedidoP; trabajaron: string[] }
  /** Un trabajo firmado que se le mandó desde el Centro. */
  | { tipo: 'trabajo'; instante: number; id: string };

/** La conversación de un chat, la más vieja arriba (como un chat). */
export function historialDelChat(chat: ChatCentro, pedidos: ReadonlyMap<string, PedidoP>, trabajos: readonly TrabajoP[]): LineaChat[] {
  const out: LineaChat[] = [];
  for (const id of chat.pedidos) {
    const p = pedidos.get(id);
    if (!p) continue;
    const pidio = claveDe(p.pidioEn);
    out.push({ tipo: 'pedido', instante: p.instante, pedido: p, pasos: pasosDelChat(p, chat.clave), desde: pidio === chat.clave ? null : p.pidioEn.chat });
  }
  for (const id of chat.pidioAca) {
    const p = pedidos.get(id);
    if (p) out.push({ tipo: 'derivado', instante: p.instante, pedido: p, trabajaron: [...new Set(p.pasos.map((s) => s.chat))] });
  }
  for (const w of trabajos) {
    const t = fecha(w.created_at);
    if (chat.trabajos.includes(w.id) && t != null) out.push({ tipo: 'trabajo', instante: t, id: w.id });
  }
  return out.sort((x, y) => x.instante - y.instante);
}

/** Qué cuentas tienen cartero (para decir en la pantalla de dónde sale la lista). */
export function cuentasConCartero(carteros: readonly CarteroP[]): string[] {
  return [...new Set(carteros.map((k) => k.cuenta))].sort();
}
