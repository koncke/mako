// =============================================================================
// El Centro como app de chats — la lista y lo que hizo cada chat, sin base y sin React (15/10/2026)
// =============================================================================
// Martín (15/10/2026): «Al principio debería haber una tab que simule los chats... copia el diseño del
// grok... "En curso" podría ser el ícono verde en los chats de grok... "Pushes" podría estar en un apartado
// tipo historial de cada chat». Esto arma la lista (con su punto) y lo de cada chat; la pantalla es aparte.
//
// ⚠️ UN HITO SE JUNTA CON SU SESIÓN, Y LAS SESIONES SE JUNTAN POR NOMBRE. Hasta el 15/10 a la noche la lista era una
// fila por sesión (con 5 títulos repetidos en el cartero: «CRM», «General», «Ads Manager»…). Martín, ese día:
// «todos los chats de todas las cuentas se llamen igual», y el Centro los une: el «CRM» de la cuenta 1 y el de la 3 son
// UN chat con dos sesiones (`sesiones`), que escribe a la que está abierta (`sesion`). Lo que sigue valiendo es cómo se
// llega al nombre: un hito con `sesion` va a esa sesión y toma el título que tiene HOY en la app (el cartero lo sube),
// así un chat renombrado no se parte en dos; uno sin `sesion` (los anteriores al 16/10) usa el nombre que anotó.
// Dos chats distintos con el mismo nombre se separan RENOMBRANDO uno («⋯ → Renombrar»), no adivinando.
//
// ⚠️ EL PUNTO TIENE EDAD. Ocupado / abierto / cerrado lo sube el cartero en cada vuelta; si el cartero no dio
// vuelta en CARTERO_VIVO_MS, el estado es una foto (`viejo`) y se dibuja con su «visto hace…». Un chat que
// ningún cartero vio no tiene estado (`sin_dato`), y eso no es «cerrado».
//
// ⚠️ LA LISTA DICE DE DÓNDE SALE. Hoy sólo la cuenta 1 tiene cartero: los chats abiertos de las otras cuentas
// no están. `cuentasConCartero` lo dice para que la pantalla no parezca completa.
//
// ⚠️ SIN `server-only`, a propósito: lo leen el servidor, las pantallas y los tests.

import { CARTERO_VIVO_MS, DESTINO_RE, carteroVivo, rutaParaRevisar, type ChatCartero, type Cierre, type EstadoPedido } from './operaciones-reglas';
import { instanteHito, type AreaP, type PasoP, type PedidoP } from './progreso-reglas';
import { destinoDeDecision } from './decisiones-aviso';
import { textoDeRespuesta, type Decision } from '../app/admin/runway/decisiones';
import type { Cuota } from './centro-uso';

export type EstadoChat = 'trabajando' | 'abierto' | 'cerrado' | 'sin_dato';

export type ChatCentro = {
  /** `nombre:<título normalizado>`: un chat es un NOMBRE, con una sesión por cuenta (ver `unirPorNombre`). */
  clave: string;
  /** La sesión a la que se le escribe: la abierta y más reciente de sus `sesiones` (null = ninguna conocida). */
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
  /** Las claves de las que se armó (sesiones y nombres): con ellas se buscan sus pasos y sus tarjetas. */
  miembros: string[];
  /** Una por cuenta en la que vive (puede haber dos en la misma), la que recibe primero. */
  sesiones: SesionDeChat[];
  /** Abierta, pero sin un Runner en su carpeta de config: nadie le puede entregar (cartero 1.4.0). */
  sinRunner?: boolean;
  /** La tab de su bitácora (el título del área donde más anotó). Lo anotado con un nombre que ningún chat vivo tiene va
   *  al jefe que se llama así (`completarChats`, el paso 3). */
  area?: string;
  /** Sus pedidos sin terminar (ids de PedidoP): un chat sin sesión sólo se lista si tiene alguno. */
  abiertos?: string[];
};

export type SesionDeChat = {
  sesion: string; cuenta: string | null; estado: EstadoChat; vistoAt: number | null; viejo: boolean; actividad: number | null;
  sinRunner?: boolean;
};

/** Lo mínimo de un cartero (lib/operaciones.ts → Cartero). `claves`: las que acepta la PC (para la caja de escribir). */
export type CarteroP = { cuenta: string; vistoAt: string | null; chats: readonly ChatCartero[]; claves?: readonly string[]; cuota?: Cuota | null };
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

/** Los chats que dicen lo buscado, sin tildes ni mayúsculas: la barra del Centro y la sección «Claude Code» del Second
 *  Brain (17/10/2026). Sin nada buscado, todos. */
export function buscarChats<T extends { titulo: string }>(chats: readonly T[], busca: string): T[] {
  const f = normal(busca);
  return f ? chats.filter((c) => normal(c.titulo).includes(f)) : [...chats];
}

/** A qué chat pertenece un paso o un hito: su sesión si la trae; si no, su título, aparte. */
export function claveDe(x: { chat: string; sesion?: string | null }): string {
  return x.sesion && DESTINO_RE.test(x.sesion) ? x.sesion : claveDeNombre(x.chat);
}

/** Los pasos de un pedido que hizo ESTE chat (un pedido repartido se ve en cada uno con lo suyo). Recibe la clave o
 *  las claves de las que se armó el chat (`miembros`). */
export function pasosDelChat(p: PedidoP, claves: string | readonly string[]): PasoP[] {
  const de = typeof claves === 'string' ? [claves] : claves;
  return p.pasos.filter((s) => de.includes(claveDe(s)));
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
  miembros: [clave], sesiones: [],
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
  //    cerrado hace días— aparece igual con lo que hizo. Y de qué tab es: el área donde más anotó.
  const porArea = new Map<string, Map<string, number>>();
  for (const a of areas) {
    for (const h of a.bitacora) {
      const t = instanteHito(h.fecha, h.hora, ahora);
      if (t == null || t < desde || !h.chat || h.chat === '—') continue;
      const c = tomar(claveDe(h), h.chat, h.cuenta || null);
      mover(c, t);
      const m = porArea.get(c.clave) ?? new Map<string, number>();
      m.set(a.titulo, (m.get(a.titulo) ?? 0) + 1);
      porArea.set(c.clave, m);
    }
  }
  for (const [clave, m] of porArea) chats.get(clave)!.area = [...m].sort((x, y) => y[1] - x[1])[0][0];
  // 2. Los pedidos: en cada chat que hizo un paso. El que nadie empezó, en el chat donde se pidió, que es el que lo
  //    tiene que hacer (Martín, 16/10/2026: «Sobre todo me interesa ver las cosas que pedí y están pendientes»).
  for (const p of [...pedidos].sort((x, y) => y.ultimo - x.ultimo)) {
    const pidio = claveDe(p.pidioEn);
    const van = p.pasos.length ? new Set(p.pasos.map((s) => claveDe(s))) : new Set([pidio]);
    for (const clave of van) {
      const c = chats.get(clave);
      if (!c || c.pedidos.includes(p.id)) continue;
      c.pedidos.push(p.id);
      if (p.estado !== 'hecho') (c.abiertos ??= []).push(p.id);
    }
    if (!van.has(pidio)) chats.get(pidio)?.pidioAca.push(p.id);
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
    ...(c.abiertos ? { abiertos: [...c.abiertos] } : {}),
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
      c.sinRunner = ch.vivo && ch.runner === false;
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

  // 3. Lo anotado sin sesión con un nombre que hoy no tiene ningún chat («Chatbot», «Funnel y oferta del CRM», un
  //    sub-chat que ya se cerró) va al JEFE de su tab: el que se llama como el área de su bitácora. Martín (16/10/2026):
  //    «Elimina lo de "Antes del 16/10"... Eso debería estar dentro de los mismos chats, como el historial y el
  //    progreso». ⚠️ Medido ese día: 75 de los 81 chats de las bitácoras eran así, y por eso el avance de casi todos los
  //    chats vivos estaba vacío. El Cerebro no se toca: sus nombres de antes ya son él (`esCerebro`).
  const grupo = (t: string) => (esCerebro(t) ? 'cerebro' : normal(t));
  const conSesion = new Set([...chats.values()].filter((c) => c.sesion).map((c) => grupo(c.titulo)));
  for (const c of chats.values()) {
    if (c.sesion || !c.area || esCerebro(c.titulo) || conSesion.has(grupo(c.titulo))) continue;
    c.titulo = c.area;
  }

  const peso: Record<EstadoChat, number> = { trabajando: 0, abierto: 1, cerrado: 2, sin_dato: 2 };
  return unirPorNombre([...chats.values()])
    // Uno sin sesión (el jefe de una tab que hoy no tiene chat abierto) se lista sólo con algo sin terminar: es lo que
    // Martín quiere ver, y le dice que ese jefe hace falta. Lo terminado queda en su historial, para cuando se abra.
    .filter((c) => c.estado === 'trabajando' || c.estado === 'abierto' || c.trabajos.length > 0
      || (c.sesion ? (c.actividad ?? 0) >= desde : (c.abiertos?.length ?? 0) > 0))
    .sort((x, y) => {
      // Lo vivo arriba sólo si el dato es fresco: con el cartero quieto, todos ordenan por actividad.
      const px = x.viejo ? 2 : peso[x.estado];
      const py = y.viejo ? 2 : peso[y.estado];
      return px - py || (y.actividad ?? 0) - (x.actividad ?? 0) || x.titulo.localeCompare(y.titulo);
    });
}

/** Qué tan lista está una sesión para recibir: trabajando o abierta con el dato fresco gana; después, la más reciente. */
const PESO_ESTADO: Record<EstadoChat, number> = { trabajando: 0, abierto: 1, cerrado: 2, sin_dato: 3 };
/** Una abierta SIN Runner en su carpeta recibe peor que una abierta con él (aunque esté trabajando), y mejor que una
 *  cerrada: con el mismo chat abierto en dos cuentas, se le escribe a la que alguien puede entregar. */
const pesoSesion = (s: Pick<SesionDeChat, 'estado' | 'viejo' | 'sinRunner'>) => {
  const abierta = s.estado !== 'cerrado' && s.estado !== 'sin_dato';
  if (s.viejo && abierta) return 2;
  return abierta && s.sinRunner ? 1.5 : PESO_ESTADO[s.estado];
};

/**
 * EL CEREBRO, el chat orquestador (Martín, 16/10/2026: «todos los chats que se llaman "Estrategia 3 cuentas" deberían ser
 * un chat orquestador de todo... allí podría ir tirando ideas de todo tipo... se encargará de delegarlo con algún "jefe"...
 * no debería llamarse "Estrategia 3 cuentas"»). Se llama «Cerebro»; los que todavía se llaman como antes (en las otras
 * cuentas, hasta que se renombren) son EL MISMO chat. No es un jefe: va aparte, arriba de la lista (`seccionesDeChats`).
 */
export const CEREBRO = 'Cerebro';
const NOMBRES_DEL_CEREBRO = new Set(['cerebro', 'estrategia 3 cuentas', 'estrategia']);
export const esCerebro = (titulo: string) => NOMBRES_DEL_CEREBRO.has(normal(titulo));

/**
 * Junta en UN chat todo lo que se llama igual (sin mayúsculas ni tildes): sus sesiones de las tres cuentas, lo que
 * trabajó cada una y lo anotado sin sesión con ese nombre. Martín (15/10/2026): «todos los chats de todas las cuentas
 * se llamen igual». Se le escribe a la sesión que mejor recibe (`pesoSesion`, y a igual peso la más reciente); su
 * estado y su cuenta son los de esa sesión, y `sesiones` las lista todas (la cabecera las muestra como chips).
 */
export function unirPorNombre(chats: readonly ChatCentro[]): ChatCentro[] {
  const grupos = new Map<string, ChatCentro[]>();
  for (const c of chats) {
    const k = esCerebro(c.titulo) ? 'cerebro' : normal(c.titulo) || c.clave;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k)!.push(c);
  }
  const out: ChatCentro[] = [];
  for (const [k, lista] of grupos) {
    const sesiones: SesionDeChat[] = lista
      .filter((c) => c.sesion)
      .map((c) => ({ sesion: c.sesion!, cuenta: c.cuenta, estado: c.estado, vistoAt: c.vistoAt, viejo: c.viejo, actividad: c.actividad, ...(c.sinRunner ? { sinRunner: true } : {}) }))
      .sort((a, b) => pesoSesion(a) - pesoSesion(b) || (b.actividad ?? 0) - (a.actividad ?? 0));
    const mejor = sesiones[0];
    const nombre = lista.find((c) => c.sesion === mejor?.sesion) ?? lista[0];
    const unica = <T,>(xs: T[]) => [...new Set(xs)];
    out.push({
      clave: `nombre:${k}`,
      sesion: mejor?.sesion ?? null,
      porNombre: !mejor,
      titulo: k === 'cerebro' ? CEREBRO : nombre.titulo,
      cuenta: mejor?.cuenta ?? nombre.cuenta,
      estado: mejor?.estado ?? 'sin_dato',
      vistoAt: mejor?.vistoAt ?? null,
      viejo: mejor?.viejo ?? false,
      ...(mejor?.sinRunner ? { sinRunner: true } : {}),
      actividad: Math.max(...lista.map((c) => c.actividad ?? 0)) || null,
      pedidos: unica(lista.flatMap((c) => c.pedidos)),
      ...(lista.some((c) => c.abiertos?.length) ? { abiertos: unica(lista.flatMap((c) => c.abiertos ?? [])) } : {}),
      ...(lista.find((c) => c.area)?.area ? { area: lista.find((c) => c.area)!.area } : {}),
      pidioAca: unica(lista.flatMap((c) => c.pidioAca)),
      trabajos: unica(lista.flatMap((c) => c.trabajos)),
      miembros: unica(lista.flatMap((c) => c.miembros)),
      sesiones,
    });
  }
  return out;
}

/** El chat de una clave: la suya, o la de una de sus sesiones (un link viejo con `?chat=<sesión>` sigue abriendo). */
export const chatDeClave = (chats: readonly ChatCentro[], clave: string | null) =>
  clave ? chats.find((c) => c.clave === clave || c.miembros.includes(clave)) ?? null : null;

/** Cuántas tarjetas espera un chat: la suma de las de sus miembros (`esperasPorChat` cuenta por sesión). */
export const esperaDe = (c: Pick<ChatCentro, 'miembros'>, esperas: Readonly<Record<string, number>>) =>
  c.miembros.reduce((n, k) => n + (esperas[k] ?? 0), 0);

// ── El chat jefe (Martín, 15/10/2026) ───────────────────────────────────────────────────────────────────────
// «quiero que cada chat esté englobado en su chat "jefe" que siempre se debe llamar como la tab en la que estamos
// trabajando, como CRM... dentro de CRM podría tener un chat de Lead Detail, Funnels, etc... ESO no lo quiero decidir
// yo, lo decide el chat jefe». LA CONVENCIÓN ES EL NOMBRE: un sub-chat se llama «<Jefe> › <Sub>» («CRM › Lead
// Detail»; también vale «>»). No hay registro aparte: el nombre lo ve Martín en la app de Claude, lo pone el jefe con
// set_session_title (o Martín con «⋯ → Renombrar»), y funciona igual si el sub-chat lo crea él con un clic. Ver
// AGENTS.md → el Centro de Operaciones.

export const SEPARADOR_JEFE = ' › ';
/** «CRM › Lead Detail» → { jefe: 'CRM', sub: 'Lead Detail' }; «CRM» → { jefe: 'CRM', sub: null }. */
export function partesDelNombre(titulo: string): { jefe: string; sub: string | null } {
  const [jefe, ...resto] = titulo.split(/\s*[›>]\s*/);
  const sub = resto.join(SEPARADOR_JEFE).trim();
  return { jefe: (jefe ?? '').trim() || titulo.trim(), sub: sub || null };
}

export type GrupoJefe = { clave: string; jefe: string; chat: ChatCentro | null; subs: ChatCentro[] };

/**
 * La lista agrupada por jefe, en el orden en que llega (lo que trabaja arriba): el grupo va donde aparece el primero
 * de los suyos. Un sub-chat cuyo jefe no está en la lista igual se agrupa bajo su nombre (`chat: null`).
 */
export function porJefe(chats: readonly ChatCentro[]): GrupoJefe[] {
  const grupos = new Map<string, GrupoJefe>();
  for (const c of chats) {
    const { jefe, sub } = partesDelNombre(c.titulo);
    const k = normal(jefe);
    if (!grupos.has(k)) grupos.set(k, { clave: `jefe:${k}`, jefe, chat: null, subs: [] });
    const g = grupos.get(k)!;
    if (sub) g.subs.push(c); else { g.chat = c; g.jefe = c.titulo; }
  }
  return [...grupos.values()];
}

/** Una línea de la conversación de un chat, como en Grok: lo que pidió Martín y lo que hizo el chat. */
export type LineaChat =
  /** Un pedido que trabajó ESTE chat, con sus pasos (sólo los suyos). `desde` = el chat donde se pidió, si fue otro. */
  | { tipo: 'pedido'; instante: number; pedido: PedidoP; pasos: PasoP[]; desde: string | null }
  /** Un pedido que Martín le hizo a ESTE chat y trabajó otro: quedó repartido. */
  | { tipo: 'derivado'; instante: number; pedido: PedidoP; trabajaron: string[] }
  /** Un trabajo firmado que se le mandó desde el Centro (con su texto, su estado y el cierre, si lo dejó). */
  | { tipo: 'trabajo'; instante: number; trabajo: TrabajoP }
  /** Lo que Martín contestó a una pregunta de ESTE chat (la de arriba de la caja o la Ticketera): es su respuesta. */
  | { tipo: 'respuesta'; instante: number; decision: Decision };

/** La conversación de un chat, la más vieja arriba (como un chat). */
export function historialDelChat(
  chat: ChatCentro, pedidos: ReadonlyMap<string, PedidoP>, trabajos: readonly TrabajoP[],
  /** Sus preguntas ya contestadas (`respuestasDelChat`, lib/centro-preguntas.ts). */
  respuestas: readonly Decision[] = [],
): LineaChat[] {
  const out: LineaChat[] = [];
  for (const id of chat.pedidos) {
    const p = pedidos.get(id);
    if (!p) continue;
    const pidio = claveDe(p.pidioEn);
    out.push({ tipo: 'pedido', instante: p.instante, pedido: p, pasos: pasosDelChat(p, chat.miembros), desde: chat.miembros.includes(pidio) ? null : p.pidioEn.chat });
  }
  // ⚠️ Lo que este chat le pasó a otro NO va en su conversación ni en su avance (Martín, 16/10/2026: «dentro de ese chat
  // dice "Lo trabajó Centro de Operaciones"... Si lo trabajó otro, no debería salir allí»): un pedido sale SÓLO en el chat
  // que lo trabajó. `pidioAca` sigue calculándose (dice de dónde vino), pero no se dibuja acá.
  for (const w of trabajos) {
    const t = fecha(w.created_at);
    if (chat.trabajos.includes(w.id) && t != null) out.push({ tipo: 'trabajo', instante: t, trabajo: w });
  }
  for (const d of respuestas) {
    const t = fecha(d.respondidaAt);
    if (t != null) out.push({ tipo: 'respuesta', instante: t, decision: d });
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
    } else if (l.tipo === 'respuesta') {
      ver({ texto: renglon(textoDeRespuesta(l.decision)), propio: true, tick: null, instante: l.instante });
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
  /** Sale: ya (`espera: null`), cuando el cartero de su cuenta dé una vuelta, o cuando se abra el chat. `donde`:
   *  si la sesión es de la app o de una terminal, que es donde hay que abrir su Runner. */
  | { puede: true; espera: null | 'cartero' | 'chat_cerrado'; cuenta: string | null; donde: 'app' | 'terminal' };

export function comoSale(
  chat: Pick<ChatCentro, 'sesion' | 'cuenta' | 'estado'>,
  carteros: readonly (Pick<CarteroP, 'cuenta' | 'vistoAt' | 'claves'> & { chats?: CarteroP['chats'] })[],
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
  const donde = chat.sesion.startsWith('cli_') ? 'terminal' : 'app';
  const sale = (espera: null | 'cartero' | 'chat_cerrado'): Envio => ({ puede: true, espera, cuenta: chat.cuenta, donde });
  const suyo = carteros.find((k) => k.cuenta === chat.cuenta);
  if (!carteroVivo(suyo, ahora)) return sale('cartero');
  if (chat.estado !== 'trabajando' && chat.estado !== 'abierto') return sale('chat_cerrado');
  // ⚠️ El cartero de la cuenta puede estar dando vueltas desde OTRA carpeta: SendMessage no cruza carpetas de config
  // (16/10/2026), así que una sesión abierta sin un Runner en la suya espera a ese Runner (`runner`, cartero 1.4.0).
  const sesion = carteros.flatMap((k) => k.chats ?? []).find((x) => x.local === chat.sesion && x.vivo);
  if (sesion?.runner === false) return sale('cartero');
  return sale(null);
}

/** «Cuenta 3», o null si no se sabe. */
export const nombreCuenta = (c: string | null | undefined): string | null => (c ? `Cuenta ${c.replace(/^claude/, '')}` : null);

/**
 * Lo que dice la caja debajo, en una línea. null = nada que decir (sale ya).
 *
 * ⚠️ DICE QUÉ HACER Y PARA QUÉ, NUNCA EL ESTADO INTERNO. Martín (15/10/2026): «Jamás pongas mensajes no claros
 * como "Este dispositivo todavía no firma.", es mucho mejor "Crea tu Token para comenzar a chatear"». Esa frase
 * es suya y va textual. La clave de firma del dispositivo, en pantalla, es «tu Token»; el cartero es el Runner
 * (lib/runner.ts). Lo fija tests/centro-textos.test.ts.
 */
export function textoDeEnvio(e: Envio): string | null {
  if (!e.puede) {
    if (e.por === 'sin_direccion') return 'Abre este chat en la app de Claude para poder escribirle.';
    if (e.por === 'sin_clave') return 'Crea tu Token para comenzar a chatear.';
    if (e.por === 'clave_no_aceptada') return 'Pégale tu Token al Runner para comenzar a chatear.';
    return null;
  }
  const n = e.cuenta ? e.cuenta.replace(/^claude/, '') : '?';
  if (e.espera === 'cartero') {
    return e.donde === 'terminal' ? `Abre el Runner en la terminal de la cuenta ${n} para que salga.` : 'Abre el chat Runner en la app de Claude para que salga.';
  }
  if (e.espera === 'chat_cerrado') return `Abre este chat en la cuenta ${n} para que lo reciba.`;
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
 * Las secciones de la barra: el Cerebro arriba, UNA lista con los jefes y sus sub-chats (en el orden de
 * `completarChats`: lo que trabaja arriba, después por actividad), y «Sin asignar». La usan la computadora y el teléfono.
 * ⚠️ Ya no hay «Antes del 16/10» (Martín, 16/10/2026: «Elimina lo de "Antes del 16/10"... Eso debería estar dentro de
 * los mismos chats»): lo anotado sin sesión va adentro del jefe de su tab (`completarChats`, el paso 3), y un jefe que
 * hoy no tiene chat abierto se lista sólo si tiene algo sin terminar.
 *
 * ⚠️ SIN SECCIONES POR CUENTA. Martín (15/10/2026): «No quiero que exista "cuenta 1, cuenta 2, 3" en la sidebar de
 * chats... eso debe estar dentro de cada chat, con un chip». La cuenta va en la cabecera de la conversación y en el
 * detalle de cada nodo del avance; y como los chats se unen por nombre (`unirPorNombre`), no hay dos «CRM» que
 * distinguir. Adentro de la lista, cada sub-chat va con su jefe (`porJefe`).
 */
export const SECCION_CHATS = 'chats';
export type SeccionChats = { clave: string; titulo: string | null; chats: ChatCentro[] };

export const SECCION_CEREBRO = 'cerebro';
export const SECCION_SIN_ASIGNAR = 'sin-asignar';

/**
 * Martín (16/10/2026): «No estás aplicando la modularización y organización de chats... Quiero chats con los nombres de las
 * tabs que sean "jefes"... Y no veo que ningún "jefe" tenga sus chats», y que el orquestador no es un jefe más. Con
 * `tabs` (app/admin/operaciones/tabs.ts), un chat cuyo jefe no se llama como ninguna tab («dashboard-marketing-7d», un
 * título que inventó la app) va a «Sin asignar», que nace plegado: se renombra con su «⋯» y pasa a su jefe. Sin `tabs`,
 * todos van a la lista (como antes).
 */
export function seccionesDeChats(chats: readonly ChatCentro[], tabs?: readonly string[]): SeccionChats[] {
  const cerebro = chats.filter((c) => esCerebro(c.titulo));
  const resto = chats.filter((c) => !esCerebro(c.titulo));
  const conocidas = tabs ? new Set(tabs.map(normal)) : null;
  const deTab = (c: ChatCentro) => !conocidas || conocidas.has(normal(partesDelNombre(c.titulo).jefe));
  const out: SeccionChats[] = [];
  if (cerebro.length) out.push({ clave: SECCION_CEREBRO, titulo: null, chats: cerebro });
  if (resto.some(deTab)) out.push({ clave: SECCION_CHATS, titulo: null, chats: resto.filter(deTab) });
  if (resto.some((c) => !deTab(c))) out.push({ clave: SECCION_SIN_ASIGNAR, titulo: 'Sin asignar', chats: resto.filter((c) => !deTab(c)) });
  return out;
}

// ── Renombrar (Martín, 15/10/2026: «Y que yo tenga los 3 puntos en cada chat para poder configurar cosas, como
// cambiarle el nombre») ─────────────────────────────────────────────────────────────────────────────────────
// El nombre de un chat lo tiene la app de Claude, y lo cambia `set_session_title`. El Centro no lo puede cambiar
// desde la nube: le MANDA a cada sesión del chat (las de las tres cuentas, porque se llaman igual) un trabajo firmado
// que se lo pide. Va por el mismo camino que cualquier otro (mandar.ts → la firma del dispositivo → el Runner), así
// que no hay una puerta nueva a la PC, y una sesión cerrada lo recibe cuando se abre.

export const TOPE_NOMBRE = 80;
/** Un nombre nuevo: un renglón, con texto y hasta TOPE_NOMBRE caracteres (se rechaza, no se recorta: AGENTS.md). */
export function nombreValido(v: string): { ok: true; nombre: string } | { ok: false; error: string } {
  const nombre = v.replace(/\s+/g, ' ').trim();
  if (!nombre) return { ok: false, error: 'Escribe el nombre nuevo para renombrarlo.' };
  if (nombre.length > TOPE_NOMBRE) return { ok: false, error: `Acórtalo a ${TOPE_NOMBRE} caracteres para renombrarlo.` };
  return { ok: true, nombre };
}
/** Lo que se le manda a cada sesión del chat. */
/** ⚠️ En la TERMINAL no hay set_session_title (es de la app) y `/rename` lo escribe Martín, no el modelo (16/10/2026):
 *  ahí el chat se lo dice en el cierre, que es lo que el Centro muestra de ese trabajo. */
export const textoDeRenombre = (nombre: string) =>
  `Renombra este chat a «${nombre}»: usa set_session_title sobre esta misma sesión. Si no la tienes (en la terminal no está), no la busques: deja en el cierre --sigue "Escribe /rename ${nombre} en la terminal de este chat". No hagas nada más.`;

// ── El avance de UN chat (Martín, 15/10/2026) ─────────────────────────────────────────────────────────────────
// «quiero que cada chat tenga arriba, en su topbar un botón para ver los avances, que despliegue la sidebar derecha,
// que sea algo similar a lo que tenemos en "offer"». Un roadmap simple: un nodo por cosa que se le pidió a ESTE chat,
// con un título corto, y su estado es el COLOR del rombo (gris = no empezado). Copiado del panel «Project Milestones»
// de Linear: el rombo cambia según el estado y el que está en curso va en amarillo. Abierto, cada nodo trae el prompt
// textual, cuándo se pidió, en qué cuenta se trabajó y lo que subió a producción.

/** El estado de un nodo, que es el color de su rombo. */
export type EstadoNodo = 'sin_empezar' | 'en_curso' | 'hecho' | 'no_salio';
export const ROTULO_NODO: Record<EstadoNodo, string> = {
  sin_empezar: 'Sin empezar', en_curso: 'En curso', hecho: 'Terminado', no_salio: 'No salió',
};

export type NodoAvance = {
  id: string;
  /** pedido = lo trabajó este chat · derivado = se lo pediste acá y lo trabajó otro · trabajo = se lo mandaste desde el Centro. */
  origen: 'pedido' | 'derivado' | 'trabajo';
  titulo: string;
  /** El texto entero que se pidió o se mandó. */
  prompt: string;
  instante: number;
  estado: EstadoNodo;
  /** Las cuentas de Claude donde se trabajó (o a la que se mandó). */
  cuentas: string[];
  /** Lo que hizo este chat, en orden (el título de cada paso de la bitácora). */
  pasos: Array<{ tipo: string; titulo: string; instante: number | null }>;
  /** Los commits de ESTE chat (de todos, si lo trabajó otro). */
  commits: Array<{ sha: string; msg: string }>;
  /** Los chats que lo trabajaron, si no fue éste. */
  trabajaron: string[];
  /** Lo que dejó escrito el chat al cerrar un trabajo, y el motivo si no salió. */
  cierre: string | null;
  motivo: string | null;
  /** La página de MaKo para revisar lo que hizo (su cierre o su bitácora la dejan), y la sesión que lo hizo: a ella
   *  vuelve la devolución del visor. null = no dejó nada para mirar. */
  revisar: { pagina: string; sesion: string | null } | null;
};

const ESTADO_DE_PEDIDO: Record<PedidoP['estado'], EstadoNodo> = { pendiente: 'sin_empezar', en_curso: 'en_curso', hecho: 'hecho' };
function estadoDeTrabajo(e: EstadoPedido | undefined): EstadoNodo {
  if (e === 'hecho' || e === 'comprobado') return 'hecho';
  if (e === 'entregado') return 'en_curso';
  if (e === 'no_entregado' || e === 'incierto' || e === 'cancelado') return 'no_salio';
  return 'sin_empezar';
}
const unicas = (xs: ReadonlyArray<string | null | undefined>) => [...new Set(xs.filter((x): x is string => !!x))];
const sinRepetir = (cs: ReadonlyArray<{ sha: string; msg: string }>) => {
  const vistos = new Set<string>();
  return cs.filter((c) => (vistos.has(c.sha) ? false : (vistos.add(c.sha), true)));
};

/** El título de un trabajo firmado (no lo tiene): su primer renglón, cortado en una palabra entera. */
export function tituloDeTexto(texto: string, tope = 72): string {
  const linea = texto.trim().split('\n')[0].trim();
  if (linea.length <= tope) return linea || 'Sin texto';
  const corte = linea.slice(0, tope);
  return `${corte.slice(0, corte.lastIndexOf(' ') > 30 ? corte.lastIndexOf(' ') : tope).trimEnd()}…`;
}

/** La línea de un commit en palabras: sin el prefijo convencional («feat(operaciones): »), con mayúscula. */
export function mensajeDeCommit(msg: string): string {
  const s = msg.replace(/^[a-z]+(\([^)]*\))?!?:\s*/i, '').trim();
  return s ? s[0].toUpperCase() + s.slice(1) : msg;
}

/** El avance de un chat: un nodo por línea de su historial, el más viejo arriba (como un roadmap). */
export function avanceDelChat(lineas: readonly LineaChat[]): NodoAvance[] {
  // Una respuesta a una pregunta no es algo que se le pidió: no es un nodo del avance.
  return lineas.flatMap((l): NodoAvance[] => (l.tipo === 'respuesta' ? [] : [nodoDe(l)]));
}

function nodoDe(l: Exclude<LineaChat, { tipo: 'respuesta' }>): NodoAvance {
  if (l.tipo === 'trabajo') {
    const w = l.trabajo;
    const texto = (w.texto ?? '').trim();
    return {
      id: `t:${w.id}`, origen: 'trabajo', titulo: tituloDeTexto(texto), prompt: texto, instante: l.instante,
      estado: estadoDeTrabajo(w.estado), cuentas: unicas([w.destino_cuenta]), pasos: [], commits: [], trabajaron: [],
      cierre: w.cierre ? (w.cierre.hecho || w.cierre.decidido || null) : null,
      motivo: estadoDeTrabajo(w.estado) === 'no_salio' ? w.motivo ?? null : null,
      revisar: paraRevisar(w.cierre?.revisar, w.destino),
    };
  }
  const p = l.pedido;
  if (l.tipo === 'derivado') {
    return {
      id: `d:${p.id}`, origen: 'derivado', titulo: p.titulo, prompt: p.texto, instante: l.instante, estado: ESTADO_DE_PEDIDO[p.estado],
      cuentas: unicas(p.pasos.map((s) => s.cuenta)), pasos: [], commits: sinRepetir(p.commits), trabajaron: l.trabajaron, cierre: null, motivo: null,
      revisar: null,
    };
  }
  return {
    id: `p:${p.id}`, origen: 'pedido', titulo: p.titulo, prompt: p.texto, instante: l.instante, estado: ESTADO_DE_PEDIDO[p.estado],
    cuentas: unicas(l.pasos.map((s) => s.cuenta)),
    pasos: l.pasos.map((s) => ({ tipo: s.tipo, titulo: s.titulo, instante: s.instante })),
    commits: sinRepetir(l.pasos.flatMap((s) => s.commits)), trabajaron: [], cierre: null, motivo: null,
    // La última página que dejó uno de SUS pasos.
    revisar: [...l.pasos].reverse().map((s) => paraRevisar(s.revisar, s.sesion)).find(Boolean) ?? null,
  };
}

const paraRevisar = (pagina: unknown, sesion: string | null): NodoAvance['revisar'] => {
  const r = rutaParaRevisar(pagina);
  return r ? { pagina: r, sesion: sesion && DESTINO_RE.test(sesion) ? sesion : null } : null;
};

// ── «Review» (Martín, 16/10/2026, punto 6): lo que el chat implementó y hay que ir a revisar ─────────────────
// «que graficamente me diga que tengo que ir a revisar de las cosas que ha implementado, si puede dejarme el link...».
// El visor es de «Centro de Operaciones › Review»; el contrato (qué recibe y adónde vuelve la devolución) está en
// docs/relevo/centro-operaciones.md.
//
// ⚠️ UN NODO VA A REVIEW CUANDO ESTÁ TERMINADO, DEJE O NO UNA PÁGINA (Martín, 17/10/2026, mirando producción: «Se
// terminaron y pushearon cosas y no las puedo ver en Review, me dice "Nada para revisar todavía"»). Hasta el 16/10 la
// regla era «terminado Y con `revisar`», y como el `revisar` sólo lo deja un chat que lo escribe en su cierre o en su
// bitácora (casi ninguno lo hacía), la sub-tab quedaba vacía con el trabajo ya en producción. Sin página propia, el link
// es la TAB de su área (`rutaDeLaTab`): la del jefe del chat; un chat «Sin asignar» no tiene tab y la fila va sin botón.

/** Todo lo terminado, deje o no una página para mirar, lo más nuevo arriba. */
export const porRevisar = (nodos: readonly NodoAvance[]): NodoAvance[] =>
  nodos.filter((n) => n.estado === 'hecho').sort((a, b) => b.instante - a.instante);

/**
 * La ruta de la tab que se llama como el jefe de un chat («CRM» para «CRM › Lead Detail», ver `partesDelNombre`):
 * la del primer ítem de `items` con ese nombre, sin mayúsculas ni tildes (la misma comparación que `seccionesDeChats`).
 * null = el jefe no es una tab.
 * ⚠️ El ORDEN de `items` manda, porque un nombre se repite: «CRM» es `/crm` en la barra del cliente y `/admin/dev/crm`
 * en la del super admin. La tab del producto va primero (`[...TODOS_LOS_ITEMS, ...MAKO_NAV, ...ADMIN_NAV]`, como
 * `nombresDeTabs`); con el orden al revés, Review mandaría a la ficha de desarrollo en vez de a la pantalla.
 */
export function rutaDeLaTab(jefe: string, items: ReadonlyArray<{ label: string; href: string }>): string | null {
  const k = normal(jefe);
  if (!k) return null;
  const it = items.find((i) => normal(i.label) === k);
  // Sólo una ruta interna: un href que no empieza con «/» (o es «//host») no es una tab de MaKo.
  return it && it.href.startsWith('/') && !it.href.startsWith('//') ? it.href : null;
}

/** Adónde lleva el «Revisar» de una fila de Review: al visor, a su página, o a la tab del jefe (`via`). */
export type DestinoReview = { href: string; via: 'visor' | 'pagina' | 'tab' };

/**
 * El destino de una fila de Review. Con página propia (`revisar`): igual que siempre (`hrefRevisar`). Sin ella: la tab
 * del jefe del chat. null = no hay a dónde llevarlo (sin página y el jefe no es una tab, o no se sabe el chat): la fila se
 * ve igual, sin botón.
 */
export function destinoDeReview(
  n: Pick<NodoAvance, 'id' | 'revisar'>, chat: Pick<ChatCentro, 'clave' | 'sesion' | 'titulo'> | undefined,
  items: ReadonlyArray<{ label: string; href: string }>,
): DestinoReview | null {
  const propio = chat ? hrefRevisar(n, chat) : n.revisar?.pagina ?? null;
  if (propio) return { href: propio, via: chat && VISOR_REVISAR ? 'visor' : 'pagina' };
  const tab = chat ? rutaDeLaTab(partesDelNombre(chat.titulo).jefe, items) : null;
  return tab ? { href: tab, via: 'tab' } : null;
}

export const RUTA_REVISAR = '/admin/operaciones/revisar';
/**
 * ¿Ya existe el visor (`app/admin/operaciones/revisar/page.tsx`, lo hace «Centro de Operaciones › Review»)? Mientras
 * no, «Revisar» abre la página misma en otra pestaña: un link al visor daría 404. Lo enciende ese chat en el MISMO commit
 * que crea la página; tests/centro-revisar.test.ts falla si el archivo y el interruptor no dicen lo mismo.
 */
export const VISOR_REVISAR = false;
/** Adónde lleva «Revisar»: al visor si existe; si no, a la página. */
export const hrefRevisar = (n: Pick<NodoAvance, 'id' | 'revisar'>, chat: Pick<ChatCentro, 'clave' | 'sesion'>): string | null =>
  !n.revisar ? null : VISOR_REVISAR ? enlaceRevisar(n, chat) : n.revisar.pagina;
/** El link «Revisar»: `?pagina=<ruta interna>&chat=<clave del chat>&sesion=<la que lo hizo>&nodo=<id del nodo>`. */
export function enlaceRevisar(n: Pick<NodoAvance, 'id' | 'revisar'>, chat: Pick<ChatCentro, 'clave' | 'sesion'>): string | null {
  if (!n.revisar) return null;
  const q = new URLSearchParams({ pagina: n.revisar.pagina, chat: chat.clave, nodo: n.id });
  const sesion = n.revisar.sesion ?? chat.sesion;
  if (sesion) q.set('sesion', sesion);
  return `${RUTA_REVISAR}?${q}`;
}

/**
 * En qué está trabajando un chat, para el segundo renglón de su fila (Martín, 16/10/2026: «Cuando un chat dice
 * "Trabajando..." debo saber en qué está trabajando»): el título corto de lo último que tiene EN CURSO (un pedido
 * empezado y sin terminar, o un trabajo entregado y sin cierre). null = no se sabe (la fila dice «trabajando…»).
 */
export function enQueTrabaja(lineas: readonly LineaChat[], tope = 56): string | null {
  const enCurso = avanceDelChat(lineas).filter((n) => n.estado === 'en_curso');
  if (!enCurso.length) return null;
  const ultimo = enCurso.reduce((a, b) => (b.instante >= a.instante ? b : a));
  return tituloDeTexto(ultimo.titulo, tope);
}

/** El conteo del encabezado, como el «8/13» de Offer: los terminados sobre el total. */
export const conteoAvance = (nodos: readonly NodoAvance[]) => ({ hechos: nodos.filter((n) => n.estado === 'hecho').length, total: nodos.length });

/**
 * La lista del avance, LO PENDIENTE PRIMERO (Martín, 16/10/2026: «Sobre todo me interesa ver las cosas que pedí y están
 * pendientes»): arriba lo que falta (en curso, sin empezar y lo que no salió, que hay que volver a mandar), abajo lo
 * terminado; cada grupo con lo más nuevo arriba, porque con todas las fechas el historial es largo.
 * `avanceDelChat` sigue en el orden de la conversación: lo usan también el conteo y `enQueTrabaja`.
 */
export type GrupoAvance = { clave: 'pendiente' | 'hecho'; titulo: string; nodos: NodoAvance[] };
const PESO_NODO: Record<EstadoNodo, number> = { en_curso: 0, sin_empezar: 1, no_salio: 2, hecho: 3 };
export function gruposDelAvance(nodos: readonly NodoAvance[]): GrupoAvance[] {
  const orden = (a: NodoAvance, b: NodoAvance) => PESO_NODO[a.estado] - PESO_NODO[b.estado] || b.instante - a.instante;
  const falta = nodos.filter((n) => n.estado !== 'hecho').sort(orden);
  const hechos = nodos.filter((n) => n.estado === 'hecho').sort(orden);
  const out: GrupoAvance[] = [];
  if (falta.length) out.push({ clave: 'pendiente', titulo: 'Pendiente', nodos: falta });
  if (hechos.length) out.push({ clave: 'hecho', titulo: 'Terminado', nodos: hechos });
  return out;
}

/**
 * Las tarjetas de la Ticketera que esperan una respuesta de Martín, por chat (la clave de la lista). Es lo que
 * Grok Bot llama «volver a pedir aprobación»: el empleado no avanza hasta que se le contesta.
 * ⚠️ A qué chat va una tarjeta lo decide `destinoDeDecision` (lib/decisiones-aviso.ts), la MISMA regla con la que
 * el cartero avisa la respuesta: por su `destino` (la sesión) o, sin él, por un título EXACTO y único. Con dos
 * chats del mismo nombre no adivina, y la tarjeta no se le pega a ninguno.
 */
/** Las tarjetas de la Ticketera como las tiene el Centro: enteras (16/10/2026), porque cada chat dibuja SUS preguntas
 *  arriba de la caja (app/admin/operaciones/Pregunta.tsx) y sus respuestas en la conversación. */
export type DecisionEspera = Decision;

export function esperasPorChat(
  decisiones: readonly Pick<Decision, 'chat' | 'destino' | 'respuesta'>[], carteros: readonly Pick<CarteroP, 'cuenta' | 'chats'>[],
): Record<string, number> {
  const chats = carteros.flatMap((k) => k.chats.map((c) => ({ ...c, cuenta: c.cuenta ?? k.cuenta })));
  const out: Record<string, number> = {};
  for (const d of decisiones) {
    if (d.respuesta != null) continue;
    // Con su sesión es exacto, aunque ningún cartero vea ese chat ahora: la clave de la lista ES la sesión.
    if (d.destino && DESTINO_RE.test(d.destino)) { out[d.destino] = (out[d.destino] ?? 0) + 1; continue; }
    const r = destinoDeDecision({ chat: d.chat, destino: d.destino ?? null }, chats);
    if (r.ok) out[r.chat.local] = (out[r.chat.local] ?? 0) + 1;
  }
  return out;
}

/** Qué cuentas tienen cartero (para decir en la pantalla de dónde sale la lista). */
export function cuentasConCartero(carteros: readonly CarteroP[]): string[] {
  return [...new Set(carteros.map((k) => k.cuenta))].sort();
}
