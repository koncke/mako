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

import { CARTERO_VIVO_MS, DESTINO_RE, carteroVivo, type ChatCartero, type Cierre, type EstadoPedido } from './operaciones-reglas';
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

/** Lo mínimo de un cartero (lib/operaciones.ts → Cartero). `claves`: las que acepta la PC (para la caja de escribir). */
export type CarteroP = { cuenta: string; vistoAt: string | null; chats: readonly ChatCartero[]; claves?: readonly string[] };
/** Lo mínimo de un trabajo de la cola (lib/operaciones.ts → Pedido). Lo de abajo de `created_at` es lo que dibuja la
 *  conversación (el texto que se mandó, por dónde va y el cierre que dejó el chat); la lista no lo necesita. */
export type TrabajoP = {
  id: string; destino: string; destino_titulo: string | null; destino_cuenta: string | null; created_at: string;
  texto?: string; estado?: EstadoPedido; motivo?: string | null;
  entregado_at?: string | null; cerrado_at?: string | null; cierre?: Cierre | null;
};

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
  return completarChats(chatsDeBitacoras({ areas, pedidos, ahora, dias }), { carteros, trabajos, ahora, dias });
}

const nuevoChat = (clave: string, titulo: string, cuenta: string | null): ChatCentro => ({
  clave, sesion: clave.startsWith('nombre:') ? null : clave, porNombre: clave.startsWith('nombre:'), titulo, cuenta,
  estado: 'sin_dato', vistoAt: null, viejo: false, actividad: null, pedidos: [], pidioAca: [], trabajos: [],
});
const mover = (c: ChatCentro, t: number | null) => { if (t != null && (c.actividad == null || t > c.actividad)) c.actividad = t; };

/**
 * La mitad de la lista que sale de las BITÁCORAS (lo que viaja en el build): qué chats anotaron trabajo y qué
 * pedidos tiene cada uno. Es la parte pesada y no cambia mientras la pantalla está abierta; la otra mitad
 * (`completarChats`: el estado que sube el cartero y los trabajos firmados) sí, y la pantalla la rehace sola.
 */
export function chatsDeBitacoras({ areas, pedidos, ahora, dias = 14 }: {
  areas: readonly AreaP[]; pedidos: readonly PedidoP[]; ahora: number; dias?: number;
}): ChatCentro[] {
  const desde = ahora - dias * 86_400_000;
  const chats = new Map<string, ChatCentro>();
  const tomar = (clave: string, titulo: string, cuenta: string | null) => {
    let c = chats.get(clave);
    if (!c) { c = nuevoChat(clave, titulo, cuenta); chats.set(clave, c); }
    return c;
  };
  // 1. Cada hito a su chat (por sesión, o aparte por nombre). Así un chat que el cartero no ve —de otra cuenta, o
  //    cerrado hace días— aparece igual con lo que hizo.
  for (const a of areas) {
    for (const h of a.bitacora) {
      const t = instanteHito(h.fecha, h.hora, ahora);
      if (t == null || t < desde || !h.chat || h.chat === '—') continue;
      mover(tomar(claveDe(h), h.chat, h.cuenta || null), t);
    }
  }
  // 2. Los pedidos: en cada chat que hizo un paso, y en el que se pidió si lo trabajó otro.
  for (const p of [...pedidos].sort((x, y) => y.ultimo - x.ultimo)) {
    const hicieron = new Set(p.pasos.map((s) => claveDe(s)));
    for (const clave of hicieron) {
      const c = chats.get(clave);
      if (c && !c.pedidos.includes(p.id)) c.pedidos.push(p.id);
    }
    const pidio = claveDe(p.pidioEn);
    if (!hicieron.has(pidio)) chats.get(pidio)?.pidioAca.push(p.id);
  }
  return [...chats.values()];
}

/**
 * La otra mitad: el estado de cada chat según su cartero (con la edad de la vuelta) y los trabajos firmados de la
 * cola. Recibe la lista de `chatsDeBitacoras` —o la que ya está en pantalla— y la devuelve filtrada y ordenada.
 * ⚠️ Es la MISMA función para el server y para el refresco de la pantalla: dos copias de «qué estado tiene un
 * chat» se separan en cuanto una cambia.
 */
export function completarChats(base: readonly ChatCentro[], { carteros, trabajos, ahora, dias = 14 }: {
  carteros: readonly CarteroP[]; trabajos: readonly TrabajoP[]; ahora: number; dias?: number;
}): ChatCentro[] {
  const desde = ahora - dias * 86_400_000;
  // Cada vuelta vuelve a decidir el estado y los trabajos: lo que traía la base de antes no cuenta.
  const chats = new Map<string, ChatCentro>(base.map((c) => [c.clave, {
    ...c, estado: 'sin_dato', vistoAt: null, viejo: false, trabajos: [], pedidos: [...c.pedidos], pidioAca: [...c.pidioAca],
  }]));
  const tomar = (clave: string, titulo: string, cuenta: string | null) => {
    let c = chats.get(clave);
    if (!c) { c = nuevoChat(clave, titulo, cuenta); chats.set(clave, c); }
    return c;
  };

  // 1. Lo que subió cada cartero: sesión, título (el de la app, que se puede renombrar) y estado.
  for (const k of carteros) {
    const visto = fecha(k.vistoAt);
    const viejo = visto == null || ahora - visto >= CARTERO_VIVO_MS;
    for (const ch of k.chats) {
      if (!DESTINO_RE.test(ch.local)) continue;
      const c = tomar(ch.local, ch.titulo, ch.cuenta ?? k.cuenta);
      c.titulo = ch.titulo;
      c.cuenta = ch.cuenta ?? k.cuenta;
      c.estado = !ch.vivo ? 'cerrado' : ch.estado === 'busy' ? 'trabajando' : 'abierto';
      c.vistoAt = visto;
      c.viejo = viejo;
      mover(c, fecha(ch.actividad));
    }
  }

  // 2. Los trabajos firmados: a la sesión de destino, aunque el cartero no la vea ahora.
  for (const w of trabajos) {
    if (!DESTINO_RE.test(w.destino)) continue;
    const c = tomar(w.destino, w.destino_titulo || 'Chat sin título', w.destino_cuenta);
    if (!c.trabajos.includes(w.id)) c.trabajos.push(w.id);
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
  /** Un trabajo firmado que se le mandó desde el Centro (con su texto, su estado y el cierre, si lo dejó). */
  | { tipo: 'trabajo'; instante: number; trabajo: TrabajoP };

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
    if (chat.trabajos.includes(w.id) && t != null) out.push({ tipo: 'trabajo', instante: t, trabajo: w });
  }
  return out.sort((x, y) => x.instante - y.instante);
}

/**
 * El segundo renglón de una fila de la lista, como en WhatsApp y Linear: lo ÚLTIMO que pasó en ese chat. Si es
 * un trabajo propio, con su tick; si es lo que pidió Martín por otro lado, con «Tú:». null = nada todavía.
 */
export type VistaPrevia = { texto: string; propio: boolean; tick: EstadoPedido | null; instante: number };

export function vistaPrevia(lineas: readonly LineaChat[]): VistaPrevia | null {
  let mejor: VistaPrevia | null = null;
  const ver = (v: VistaPrevia) => { if (v.texto && (!mejor || v.instante >= mejor.instante)) mejor = v; };
  const renglon = (s: string) => s.split('\n').map((x) => x.trim()).find(Boolean) ?? '';
  for (const l of lineas) {
    if (l.tipo === 'trabajo') {
      ver({ texto: renglon(l.trabajo.texto ?? ''), propio: true, tick: l.trabajo.estado ?? 'escrito', instante: l.instante });
      const c = l.trabajo.cierre;
      const t = fecha(l.trabajo.cerrado_at ?? null);
      if (c && t != null) ver({ texto: renglon(c.hecho || c.decidido), propio: false, tick: null, instante: t });
    } else {
      ver({ texto: renglon(l.pedido.texto), propio: true, tick: null, instante: l.instante });
      if (l.tipo === 'pedido') for (const s of l.pasos) if (s.instante != null) ver({ texto: renglon(s.titulo), propio: false, tick: null, instante: s.instante });
    }
  }
  return mejor;
}

// ── La caja de escribir: si se puede mandar y qué espera ─────────────────────────────────────────
// Martín (15/10/2026): «NO es funcional, no puedo mandar un prompt por allí a mis otras cuentas». La caja
// está abajo de cada conversación, como en cualquier app de chat; lo que decide si manda es esto.
//
// ⚠️ UNA CAJA QUE MANDA ALGO QUE LA PC VA A RECHAZAR ES PEOR QUE UNA APAGADA: la firma la verifica el
// cartero contra las claves cargadas A MANO en la PC (`cartero.mjs clave`). Si los carteros ya dijeron qué
// claves aceptan y la de este dispositivo no está, el trabajo saldría «No se pudo» en la primera vuelta: la
// caja no manda y ofrece copiar la clave. Las claves son de la PC (un solo `claves.txt` para las tres
// cuentas), así que alcanza con que UN cartero la haya visto: el de otra cuenta puede tener la foto vieja.
// ⚠️ Y LO QUE ESPERA SE DICE, no se esconde: un trabajo para un chat cerrado, o de una cuenta que no está
// corriendo, queda escrito y sale cuando se abra. Eso es «espera», nunca «falló».

export type Envio =
  /** Lo anotado sin sesión no tiene a quién entregarle (`porNombre`). */
  | { puede: false; por: 'sin_direccion' }
  /** Todavía no se leyó la clave de este dispositivo. */
  | { puede: false; por: 'leyendo_clave' }
  /** Este dispositivo no tiene clave de firma: se crea una. */
  | { puede: false; por: 'sin_clave' }
  /** La PC no acepta la clave de este dispositivo: se copia y se carga allá. */
  | { puede: false; por: 'clave_no_aceptada' }
  /** Sale: ya (`espera: null`), cuando el cartero de su cuenta dé una vuelta, o cuando se abra el chat. */
  | { puede: true; espera: null | 'cartero' | 'chat_cerrado'; cuenta: string | null };

export function comoSale(
  chat: Pick<ChatCentro, 'sesion' | 'cuenta' | 'estado'>,
  carteros: readonly Pick<CarteroP, 'cuenta' | 'vistoAt' | 'claves'>[],
  /** El id corto de la clave de ESTE dispositivo; null = no tiene; undefined = todavía no se sabe. */
  claveId: string | null | undefined,
  ahora: number,
): Envio {
  if (!chat.sesion || !DESTINO_RE.test(chat.sesion)) return { puede: false, por: 'sin_direccion' };
  if (claveId === undefined) return { puede: false, por: 'leyendo_clave' };
  if (claveId === null) return { puede: false, por: 'sin_clave' };
  // Sin ningún cartero que haya dicho qué acepta, no se sabe: se deja salir, y espera al cartero.
  const informaron = carteros.filter((k) => Array.isArray(k.claves));
  if (informaron.length && !informaron.some((k) => k.claves!.includes(claveId))) return { puede: false, por: 'clave_no_aceptada' };
  const suyo = carteros.find((k) => k.cuenta === chat.cuenta);
  if (!carteroVivo(suyo, ahora)) return { puede: true, espera: 'cartero', cuenta: chat.cuenta };
  if (chat.estado !== 'trabajando' && chat.estado !== 'abierto') return { puede: true, espera: 'chat_cerrado', cuenta: chat.cuenta };
  return { puede: true, espera: null, cuenta: chat.cuenta };
}

/** «Cuenta 3», o null si no se sabe. */
export const nombreCuenta = (c: string | null | undefined): string | null => (c ? `Cuenta ${c.replace(/^claude/, '')}` : null);

/** Lo que dice la caja debajo, en una línea. null = nada que decir (sale ya). */
export function textoDeEnvio(e: Envio): string | null {
  if (!e.puede) {
    if (e.por === 'sin_direccion') return 'Este chat no tiene dirección: es lo anotado antes del 16/10.';
    if (e.por === 'sin_clave') return 'Este dispositivo todavía no firma.';
    if (e.por === 'clave_no_aceptada') return 'La PC todavía no acepta la clave de este dispositivo.';
    return null;
  }
  const n = e.cuenta ? e.cuenta.replace(/^claude/, '') : '?';
  if (e.espera === 'cartero') return `Sale cuando el cartero de la cuenta ${n} dé su vuelta.`;
  if (e.espera === 'chat_cerrado') return `Sale cuando abras este chat en la cuenta ${n}.`;
  return null;
}

/**
 * El grupo de un chat en la lista, como la barra de conversaciones de ChatGPT o Claude: arriba los que están
 * trabajando AHORA (sólo con el dato fresco: una foto vieja no es «ahora»), después por su última actividad.
 */
export type GrupoChat = 'ahora' | 'hoy' | 'ayer' | 'semana' | 'antes';
export const GRUPOS_CHAT: readonly GrupoChat[] = ['ahora', 'hoy', 'ayer', 'semana', 'antes'];
export const ROTULO_GRUPO_CHAT: Record<GrupoChat, string> = {
  ahora: 'Trabajando ahora', hoy: 'Hoy', ayer: 'Ayer', semana: 'Esta semana', antes: 'Antes',
};
const DESFASE_AR = 3 * 3_600_000;

export function grupoDeChat(c: Pick<ChatCentro, 'estado' | 'viejo' | 'actividad'>, ahora: number): GrupoChat {
  if (c.estado === 'trabajando' && !c.viejo) return 'ahora';
  if (c.actividad == null) return 'antes';
  const dia = (t: number) => Math.floor((t - DESFASE_AR) / 86_400_000);
  const d = dia(ahora) - dia(c.actividad);
  return d <= 0 ? 'hoy' : d === 1 ? 'ayer' : d < 7 ? 'semana' : 'antes';
}

/**
 * Las secciones de la barra, como los proyectos de Codex: una por CUENTA —con tres cuentas hay tres «CRM», y la
 * cuenta es lo que los separa—, la que tiene chats abiertos primero. Lo anotado sin sesión (antes del 16/10) va
 * en su propia sección al final: no recibe trabajos y repetiría el título de su sesión al lado de ella. La usan la
 * computadora y el teléfono, así las dos agrupan igual.
 */
export const SECCION_ANTES = 'antes';
export type SeccionChats = { clave: string; titulo: string; chats: ChatCentro[] };

export function seccionesDeChats(chats: readonly ChatCentro[]): SeccionChats[] {
  const m = new Map<string, ChatCentro[]>();
  const antes: ChatCentro[] = [];
  for (const c of chats) {
    if (c.porNombre || !c.sesion) { antes.push(c); continue; }
    const k = c.cuenta ?? '';
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(c);
  }
  const vivas = (l: ChatCentro[]) => l.some((c) => !c.viejo && (c.estado === 'trabajando' || c.estado === 'abierto'));
  const out = [...m.entries()]
    .sort(([ka, la], [kb, lb]) => Number(vivas(lb)) - Number(vivas(la)) || (ka ? 0 : 1) - (kb ? 0 : 1) || ka.localeCompare(kb, 'es', { numeric: true }))
    .map(([k, l]) => ({ clave: k || 'sin-cuenta', titulo: nombreCuenta(k) ?? 'Sin cuenta', chats: l }));
  if (antes.length) out.push({ clave: SECCION_ANTES, titulo: 'Antes del 16/10', chats: antes });
  return out;
}

/** Qué cuentas tienen cartero (para decir en la pantalla de dónde sale la lista). */
export function cuentasConCartero(carteros: readonly CarteroP[]): string[] {
  return [...new Set(carteros.map((k) => k.cuenta))].sort();
}
