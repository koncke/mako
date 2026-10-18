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

import { CARTERO_VIVO_MS, DESTINO_NUEVO, DESTINO_RE, TOPE_TURNO, carteroVivo, rutaParaRevisar, unirTurnos, type ChatCartero, type Cierre, type EstadoPedido, type TurnoChat } from './operaciones-reglas';
import { instanteHito, type AreaP, type PasoP, type PedidoP } from './progreso-reglas';
import { destinoDeDecision } from './decisiones-aviso';
import { textoDeRespuesta, type Decision } from '../app/admin/runway/decisiones';
import { usoDeCuenta, type Cuota } from './centro-uso';
import { preguntaDeTrabajo, resumenDeRespuesta, type PreguntaChat } from './centro-preguntas-chat';

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
  /** Es el Runner (cartero 1.10.0, 17/10/2026: «todo chat abierto se ve»): está en la lista, sin caja. */
  esRunner?: true;
  /** Está en la nube: lo anota el Runner de la app con list_sessions. Se ve con la marca «Nube», sin caja. */
  nube?: true;
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
  /** Los nombres de lo que se adjuntó (17/10/2026). */
  adjuntos?: string[];
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
export function completarChats(base: readonly ChatCentro[], { carteros, trabajos, ahora, dias = 14, pasos }: {
  carteros: readonly CarteroP[]; trabajos: readonly TrabajoP[]; ahora: number; dias?: number;
  /** Los pasos en vivo que subió la PC hace segundos (lib/centro-pasos.ts → pasosVigentes), por sesión. */
  pasos?: Readonly<Record<string, readonly unknown[]>>;
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
      if (!DESTINO_RE.test(ch.local) && !ch.nube) continue;
      const c = tomar(ch.local, ch.titulo, ch.cuenta ?? k.cuenta);
      c.titulo = ch.titulo;
      c.cuenta = ch.cuenta ?? k.cuenta;
      if (ch.esRunner) c.esRunner = true;
      if (ch.nube) c.nube = true;
      // Uno de la nube está abierto mientras el Runner lo anota (no tiene canal en la PC: `vivo` es siempre false).
      c.estado = ch.nube ? 'abierto' : !ch.vivo ? 'cerrado' : ch.estado === 'busy' ? 'trabajando' : 'abierto';
      c.vistoAt = visto;
      c.viejo = viejo;
      c.sinRunner = ch.vivo && ch.runner === false;
      mover(c, fecha(ch.actividad));
    }
  }

  // 1b. UN CHAT CON PASOS RECIENTES ESTÁ TRABAJANDO (17/10/2026, Martín: «esta tab está trabajando y no veo que el chat diga
  //     "trabajando..."»). Medido: el estado ocupado de cada chat llega con la vuelta del Runner, cada ~2 minutos (un chat que
  //     empezó después de la última vuelta no decía nada, y uno que ya terminó seguía diciendo «Trabajando…»); los pasos llegan
  //     cada ~15 s y sólo de los chats ocupados. Si subió pasos hace segundos, ES un chat ocupado y su Runner está vivo.
  for (const [local, lista] of Object.entries(pasos ?? {})) {
    const c = chats.get(local);
    if (c && lista.length > 0) { c.estado = 'trabajando'; c.viejo = false; }
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
    // Uno de la nube no se une con el de la PC que se llama igual: es OTRA sesión, y no recibe (sería elegible como destino).
    const k = c.nube ? `nube:${normal(c.titulo) || c.clave}` : esCerebro(c.titulo) ? 'cerebro' : normal(c.titulo) || c.clave;
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
      ...(lista.some((c) => c.esRunner) ? { esRunner: true as const } : {}),
      ...(lista.every((c) => c.nube) ? { nube: true as const } : {}),
    });
  }
  return out;
}

/**
 * ¿Es el chat del Runner? Lo marca la PC (`esRunner`, cartero.mjs → esElCartero) o, sin esa marca (un Runner que ya no sube, o
 * lo anotado en una bitácora), lo dice su nombre ENTERO: «Runner», «Cartero» o «Centro de Operaciones › Runner». Por nombre
 * sólo el exacto: «Offer › Runner de pruebas» es un sub-chat de Offer.
 */
export const esChatDelRunner = (c: Pick<ChatCentro, 'titulo' | 'esRunner'>): boolean =>
  c.esRunner === true || /^(centro de operaciones\s*[›>]\s*)?(runner|cartero)$/i.test(c.titulo.trim());

/**
 * Los chats que se ven en el Ops Center: sin el Runner (Martín, 17/10/2026, 19:33: «El chat de "Runner" no tiene sentido que
 * esté visible en el Center»). El Runner sigue trabajando por detrás y su estado está en «Uso y Runners». `completarChats` lo
 * sigue devolviendo (con `esRunner`: la PC lo sube marcado y de ahí sale que no se le entrega nada); lo saca la pantalla.
 */
export const sinElRunner = <T extends Pick<ChatCentro, 'titulo' | 'esRunner'>>(chats: readonly T[]): T[] =>
  chats.filter((c) => !esChatDelRunner(c));

/**
 * Lo que se sabe de un chat para dibujar su FILA: sus turnos completos si se abrió (`turnos`), y si no lo último que trajo el
 * refresco de todos (`ultimos`, por sesión; lib/operaciones-reglas.ts → `resumirTurnos`). Sin esto un «Ya está» sólo avisaba en
 * los chats abiertos antes en esa pantalla (17/10/2026). ⚠️ `miradoAhora`: el chat que se está mirando NUNCA usa lo recortado
 * (su conversación esperaría los turnos enteros con un texto cortado): sin los suyos todavía, no hay nada.
 */
export function turnosParaLaLista(
  c: Pick<ChatCentro, 'clave' | 'miembros'>, turnos: Readonly<Record<string, readonly TurnoChat[]>>,
  ultimos: Readonly<Record<string, readonly TurnoChat[]>>, miradoAhora: boolean,
): readonly TurnoChat[] | undefined {
  if (turnos[c.clave]) return turnos[c.clave];
  if (miradoAhora) return undefined;
  const lista = c.miembros.flatMap((m) => ultimos[m] ?? []);
  return lista.length ? unirTurnos([], lista) : undefined;
}

// ── «MaKo en WhatsApp», el vigía: un cron que cada rato dice «Sin incidentes nuevos» (Martín, 17/10/2026) ─────────────────
// «No debería verse entre los chats... es como un CRON que revisa problemas... cada rato envía "Sin incidentes nuevos", no es
// necesario». Se esconde de la lista mientras está callado (como el Runner), sin avisar ni subir. Un incidente de verdad —su
// último turno ya no es «Sin incidentes nuevos»— lo hace aparecer y AVISAR como «Espera tu respuesta». Es el chat jefe de la
// vigilancia de los grupos de los clientes (memoria: vigía de MaKo en WhatsApp): por eso no se borra, se calla.
/** ¿Es el chat del vigía? Su nombre ENTERO: «MaKo en WhatsApp › algo» es un sub-chat con trabajo real. */
export const esChatVigia = (c: Pick<ChatCentro, 'titulo'>): boolean => /^mako en whatsapp$/i.test(c.titulo.trim());

/** ¿Este texto es el «todo en orden» del vigía? Sólo eso, con o sin punto, negrita o ✅ (no «Sin incidentes nuevos, pero…»). */
export const esSinIncidentes = (texto: string): boolean => /^[\s*_.\-–—✅✔·]*sin incidentes nuevos[\s.!*_]*$/i.test(texto.trim());

/**
 * El incidente de verdad que dejó el vigía: su turno MÁS NUEVO (del chat, no lo que le escriben) si no es «Sin incidentes
 * nuevos». null = está callado (o todavía no se sabe nada de él).
 */
export function incidenteDelVigia(turnos: readonly TurnoChat[] | undefined): TurnoChat | null {
  const suyos = (turnos ?? []).filter((t) => t.rol === 'el');
  const ultimo = suyos.reduce<TurnoChat | null>((m, t) => (!m || Date.parse(t.at) >= Date.parse(m.at) ? t : m), null);
  return ultimo && !esSinIncidentes(ultimo.texto) ? ultimo : null;
}

/** ¿Se esconde este chat de la lista? Sólo el vigía callado, sin nada que espere, y nunca el que se está mirando. */
export const vigiaCallado = (c: Pick<ChatCentro, 'titulo'>, turnos: readonly TurnoChat[] | undefined, espera: number, miradoAhora: boolean): boolean =>
  esChatVigia(c) && espera === 0 && !miradoAhora && incidenteDelVigia(turnos) == null;

/** ¿Trae un incidente que este dispositivo no vio? Cuenta como una respuesta que espera (`avisosDe`): mismo globito y renglón. */
export const incidenteSinVer = (c: Pick<ChatCentro, 'titulo'>, turnos: readonly TurnoChat[] | undefined, vistoEn: number): boolean => {
  if (!esChatVigia(c)) return false;
  const i = incidenteDelVigia(turnos);
  return i != null && Date.parse(i.at) > vistoEn;
};

/** El chat de una clave: la suya, o la de una de sus sesiones (un link viejo con `?chat=<sesión>` sigue abriendo). */
export const chatDeClave = (chats: readonly ChatCentro[], clave: string | null) =>
  clave ? chats.find((c) => c.clave === clave || c.miembros.includes(clave)) ?? null : null;

/**
 * El chat abierto, aunque lo hayan RENOMBRADO (Martín, 17/10/2026: «Le pedí que renombre el chat, lo hizo, pero falta que
 * automáticamente me posicione en el mismo chat que estaba»). La clave de un chat es su nombre (`nombre:crm`), así que
 * renombrarlo la cambia y la vieja deja de existir. Se busca, en orden:
 *   1. por la clave, o por una de sus sesiones (`chatDeClave`);
 *   2. por las sesiones que tenía el chat abierto (`antes`, sus `miembros` de la última vez): es el mismo chat;
 *   3. con una clave de nombre que ya no está (un link viejo, o recargar la página), por el último trabajo que se le mandó
 *      a ese nombre: `destino_titulo` es el nombre que tenía al mandarlo, y `destino` su sesión. El renombre mismo es un
 *      trabajo así (`textoDeRenombre`), así que siempre hay uno.
 * null = no hay forma de saber cuál era.
 */
export function seguirChat(
  chats: readonly ChatCentro[], clave: string | null, antes: readonly string[] | null | undefined,
  trabajos: readonly Pick<TrabajoP, 'destino' | 'destino_titulo' | 'created_at'>[],
): ChatCentro | null {
  if (!clave) return null;
  const directo = chatDeClave(chats, clave);
  if (directo) return directo;
  const sesiones = (antes ?? []).filter((m) => DESTINO_RE.test(m));
  const porSesion = sesiones.length ? chats.find((c) => c.miembros.some((m) => sesiones.includes(m))) : undefined;
  if (porSesion) return porSesion;
  if (!clave.startsWith('nombre:')) return null;
  const nombre = clave.slice('nombre:'.length);
  const mandados = trabajos
    .filter((w) => w.destino_titulo && normal(w.destino_titulo) === nombre && DESTINO_RE.test(w.destino))
    .sort((a, b) => (fecha(b.created_at) ?? 0) - (fecha(a.created_at) ?? 0));
  for (const w of mandados) {
    const c = chatDeClave(chats, w.destino);
    if (c) return c;
  }
  return null;
}

/** La dirección del chat abierto en la URL: su sesión, que no cambia al renombrarlo; el que no tiene (un jefe anotado sólo
 *  por nombre, el Cerebro sin sesión), su clave. */
export const claveParaUrl = (c: Pick<ChatCentro, 'clave' | 'sesion'>): string => (c.sesion && DESTINO_RE.test(c.sesion) ? c.sesion : c.clave);

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
  | { tipo: 'respuesta'; instante: number; decision: Decision }
  /** Lo que se le dijo al chat y lo que contestó, sacado de su transcript (17/10/2026: «los chats no se entienden»). */
  | { tipo: 'turno'; instante: number; turno: TurnoChat }
  /** Una pregunta del chat, con sus opciones (17/10/2026: el formulario de `cartero.mjs preguntar`). `trabajo` = el trabajo
   *  firmado que la contestó, si ya salió: la respuesta se dibuja en la pregunta, no como una burbuja aparte. */
  | { tipo: 'pregunta'; instante: number; pregunta: PreguntaChat; trabajo: TrabajoP | null };

/**
 * Lo que se DIBUJA en la conversación (17/10/2026, Martín: «los chats no se entienden... No se entiende la conversación
 * que se tiene»): lo que se le dijo y lo que contestó (los turnos), los trabajos del Centro y las respuestas a sus
 * preguntas. Los pedidos de la bitácora y sus hitos («Corrección · 19:32 — …», «Lo pediste en …») NO: son el Plan, y
 * van a su barra (`avanceDelChat` los sigue leyendo de `historialDelChat`). Un turno que trajo un trabajo tampoco: ese
 * trabajo ya está, con sus ticks.
 */
export const lineasDeConversacion = (lineas: readonly LineaChat[]): LineaChat[] =>
  lineas.filter((l) => l.tipo === 'trabajo' || l.tipo === 'respuesta' || l.tipo === 'pregunta' || (l.tipo === 'turno' && !(l.turno.rol === 'yo' && l.turno.trabajo)));

/** Un chat que trabaja y todavía no escribió nada lo dice (Martín, 17/10/2026: «No puede haber un chat en "trabajando"
 *  sin nada escrito»): nunca una conversación vacía. null = escribió algo, o no está trabajando. */
export const trabajaSinEscribir = (c: Pick<ChatCentro, 'estado' | 'viejo'>, lineas: readonly LineaChat[]): string | null =>
  c.estado === 'trabajando' && !c.viejo && !lineasDeConversacion(lineas).length ? 'Está trabajando: todavía no escribió nada' : null;

/** La conversación de un chat, la más vieja arriba (como un chat). */
export function historialDelChat(
  chat: ChatCentro, pedidos: ReadonlyMap<string, PedidoP>, trabajos: readonly TrabajoP[],
  /** Sus preguntas ya contestadas (`respuestasDelChat`, lib/centro-preguntas.ts). */
  respuestas: readonly Decision[] = [],
  /** Lo que se dijo en sus sesiones (lib/centro-turnos-db.ts): sólo del chat abierto, los demás no los traen. */
  turnos: readonly TurnoChat[] = [],
  /** Sus preguntas (lib/centro-preguntas-chat-db.ts): también sólo del chat abierto. */
  preguntas: readonly PreguntaChat[] = [],
): LineaChat[] {
  const out: LineaChat[] = [];
  // El trabajo que contesta una pregunta va ADENTRO de la pregunta: dibujado aparte sería el texto firmado con su marca.
  const suyas = preguntas.filter((p) => chat.miembros.includes(p.local));
  const respuestaDe = new Map<string, TrabajoP>();
  for (const w of trabajos) {
    const id = preguntaDeTrabajo(w.texto);
    if (id && chat.trabajos.includes(w.id) && suyas.some((p) => p.id === id)) respuestaDe.set(id, w);
  }
  for (const p of suyas) {
    const t = fecha(p.at);
    if (t != null) out.push({ tipo: 'pregunta', instante: t, pregunta: p, trabajo: respuestaDe.get(p.id) ?? null });
  }
  const contestan = new Set([...respuestaDe.values()].map((w) => w.id));
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
    if (chat.trabajos.includes(w.id) && t != null && !contestan.has(w.id)) out.push({ tipo: 'trabajo', instante: t, trabajo: w });
  }
  for (const d of respuestas) {
    const t = fecha(d.respondidaAt);
    if (t != null) out.push({ tipo: 'respuesta', instante: t, decision: d });
  }
  for (const u of turnos) {
    const t = fecha(u.at);
    if (t != null && chat.miembros.includes(u.local)) out.push({ tipo: 'turno', instante: t, turno: u });
  }
  return out.sort((x, y) => x.instante - y.instante);
}

/**
 * El segundo renglón de una fila de la lista, como en WhatsApp y Linear: lo ÚLTIMO que pasó en ese chat. Si es
 * un trabajo propio, con su tick; si es lo que pidió Martín por otro lado, con «Tú:». null = nada todavía.
 */
/** `ya`: lo último es un «Ya está» del chat (17/10/2026, Martín: «un aviso en la tarjeta del chat cuando trae un "Ya está"»).
 *  Su texto va sin el «Ya está» de adelante: la fila lo dibuja con su sello «Completado». */
export type VistaPrevia = { texto: string; propio: boolean; tick: EstadoPedido | null; instante: number; ya?: true };

/**
 * Qué dice el segundo renglón de la fila de un chat, en este orden, en la computadora y en el teléfono: en qué trabaja, que
 * espera una respuesta, que trae un «Completado» sin ver (`revisar`), el borrador sin mandar («Borrador: …», como WhatsApp,
 * 17/10/2026), un «Completado» ya visto, o lo último. null = la fila va de un renglón.
 *
 * ⚠️ `revisar` es el MISMO aviso que `espera` (Martín, 17/10/2026, 19:33: «Cuando tengo algo pendiente que revisar de
 * "Completado" la misma notif de "Espera tu respuesta"»): mismo lugar, mismo estilo y el mismo globito en la criatura
 * (`avisosDe`). Desaparece cuando se abre el chat (`avisaYaEsta`).
 */
export type SegundoRenglon = 'vivo' | 'espera' | 'revisar' | 'borrador' | 'ya' | 'previa' | null;
export function segundoRenglon(
  c: Pick<ChatCentro, 'estado' | 'viejo'>, espera: number, borrador: string | null | undefined, p: VistaPrevia | null | undefined,
  /** Su «Completado» llegó y este dispositivo todavía no lo vio (`avisaYaEsta`). */
  sinVer = false,
): SegundoRenglon {
  if (c.estado === 'trabajando' && !c.viejo) return 'vivo';
  if (espera > 0) return 'espera';
  if (sinVer && p?.ya) return 'revisar';
  if (borrador) return 'borrador';
  if (!p) return null;
  return p.ya ? 'ya' : 'previa';
}

/**
 * Cuánto avisa un chat en su fila (el globito de la criatura y el orden de la lista): las tarjetas y preguntas que esperan
 * una respuesta, más UNO si trae un «Completado» sin ver. Es el mismo aviso: lo que está esperando a Martín.
 */
export const avisosDe = (esperas: number, yaSinVer: boolean): number => esperas + (yaSinVer ? 1 : 0);

/** Lo que este dispositivo ya vio de cada chat: `desde` = la primera vez que abrió el Ops Center; `chats` = cuándo abrió cada uno. */
export type VistosDeChats = { desde: number; chats: Record<string, number> };

/** ¿La fila de este chat avisa su «Ya está»? Sólo si lo último es un «Ya está» que llegó después de la última vez que se abrió
 *  el chat (o, si nunca se abrió, después de `desde`). Sin saber qué se vio (`vistos` null, antes de leer), no avisa. */
export function avisaYaEsta(p: VistaPrevia | null | undefined, vistos: VistosDeChats | null, clave: string): boolean {
  if (!p?.ya || !vistos) return false;
  return p.instante > (vistos.chats[clave] ?? vistos.desde);
}

/**
 * El texto de un renglón de la lista SIN la marca del Markdown (17/10/2026, Martín: «nada de asteriscos ni almohadillas a la
 * vista»): la fila es de un solo renglón y no dibuja formato, así que `**Ya está:** el filtro` se lee «Ya está: el filtro».
 */
export function sinMarkdown(s: string): string {
  return s
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1')
    .replace(/`+/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|[\s(])\*([^*\s](?:[^*]*[^*\s])?)\*(?=$|[\s.,;:!?)])/g, '$1$2')
    .replace(/^\s*(?:#{1,6}\s+|>\s*|[-*•]\s+|\d+[.)]\s+)/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function vistaPrevia(lineas: readonly LineaChat[]): VistaPrevia | null {
  let mejor: VistaPrevia | null = null;
  const ver = (v: VistaPrevia) => { if (v.texto && (!mejor || v.instante >= mejor.instante)) mejor = v; };
  const renglon = (s: string) => sinMarkdown(s.split('\n').map((x) => x.trim()).find(Boolean) ?? '');
  for (const l of lineas) {
    if (l.tipo === 'trabajo') {
      ver({ texto: renglon(l.trabajo.texto ?? ''), propio: true, tick: l.trabajo.estado ?? 'escrito', instante: l.instante });
      const c = l.trabajo.cierre;
      const t = fecha(l.trabajo.cerrado_at ?? null);
      if (c && t != null) ver({ texto: renglon(c.hecho || c.decidido), propio: false, tick: null, instante: t });
    } else if (l.tipo === 'respuesta') {
      ver({ texto: renglon(textoDeRespuesta(l.decision)), propio: true, tick: null, instante: l.instante });
    } else if (l.tipo === 'pregunta') {
      const r = l.pregunta.respuesta;
      ver({ texto: renglon(l.pregunta.pregunta), propio: false, tick: null, instante: l.instante });
      const t = fecha(r?.at ?? null);
      if (r && t != null) ver({ texto: renglon(resumenDeRespuesta(l.pregunta, r)), propio: true, tick: null, instante: t });
    } else if (l.tipo === 'turno') {
      // Lo que contestó (o lo que se le dijo): lo último que pasó en la conversación. El turno de un trabajo ya está.
      if (l.turno.rol === 'el' && esYaEsta(l.turno.texto)) {
        const titulo = renglon(l.turno.texto).replace(/^[\s*_#>✅✔·\-–—]*ya est[áa][\s*_.:!,;\-–—]*/i, '').trim();
        ver({ texto: titulo || 'Completado', propio: false, tick: null, instante: l.instante, ya: true });
      } else if (!(l.turno.rol === 'yo' && l.turno.trabajo)) ver({ texto: renglon(l.turno.texto), propio: l.turno.rol === 'yo', tick: null, instante: l.instante });
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
  /** Es el Runner o un chat de la nube (17/10/2026): se ven en la lista, pero no se les escribe desde acá. */
  | { puede: false; por: 'runner' }
  | { puede: false; por: 'nube' }
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
  // El Runner y los de la nube, antes que nada: lo dice lo que subió la PC de esa sesión.
  const subido = chat.sesion ? carteros.flatMap((k) => k.chats ?? []).find((x) => x.local === chat.sesion) : undefined;
  if (subido?.esRunner) return { puede: false, por: 'runner' };
  if (subido?.nube) return { puede: false, por: 'nube' };
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

/**
 * Cuándo dio su última vuelta un Runner, si NINGUNO da vueltas ahora: el estado de los chats es una foto de ese momento
 * (Martín, 17/10/2026: «aparecen todos los chats como que no están haciendo nada, cuando no es así»; el Runner se había
 * caido con la app). null = alguno da vueltas, o ninguno dio nunca: no hay nada que avisar.
 */
export function sinNoticiasDesde(carteros: readonly Pick<CarteroP, 'vistoAt'>[], ahora: number): number | null {
  if (!carteros.length || carteros.some((k) => carteroVivo(k, ahora))) return null;
  const vistos = carteros.map((k) => fecha(k.vistoAt)).filter((t): t is number => t != null);
  return vistos.length ? Math.max(...vistos) : null;
}

// ── En qué está lo que mandó Martín (17/10/2026) ──────────────────────────────────────────────────────────────
// Martín: «Envié un mensaje y no pasó nada por varios segundos... Debería automáticamente comenzar a trabajar». Desde
// el cartero 1.12.0 (`vigilar`) un trabajo sale en segundos; la pantalla lo cuenta paso por paso, sin silencio:
// «Enviado» (está en MaKo) → «La PC lo recibió» (el Runner lo tomó) → «Trabajando…» (el chat lo tiene). Y si tarda,
// dice POR QUÉ, con lo que Martín puede hacer: la cuenta sin cuota, la PC que no responde (ningún Runner da noticias),
// el Runner de esa cuenta cerrado, o el chat cerrado.

/** Hasta acá, un trabajo `escrito` no tarda: `vigilar` consulta cada ~4 s y la pantalla se refresca cada 2,5 s. */
export const TARDA_MS = 30_000;
/** Lo `tomado` lo entrega el Runner con SendMessage: más que esto es que está ocupado. */
export const TARDA_TOMADO_MS = 90_000;
/** Recién entregado, el chat ya lo tiene aunque el Runner todavía no haya subido que está ocupado. */
export const RECIEN_ENTREGADO_MS = 3 * 60_000;

const horaAR = (t: number) => new Date(t).toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

export type FaseEnvio = 'enviado' | 'recibido';
/** La línea debajo de lo que mandó Martín. `porQue` sólo cuando tarda. */
export type EstadoDelEnvio = { fase: FaseEnvio; texto: string; porQue: string | null };

/** Por qué no sale (o no llega) un trabajo, en lo que Martín puede hacer. null = no hay nada que lo frene. */
function porQueTarda(
  w: Pick<TrabajoP, 'destino' | 'destino_cuenta'>,
  chat: Pick<ChatCentro, 'estado' | 'viejo' | 'sinRunner'> | null,
  carteros: readonly Pick<CarteroP, 'cuenta' | 'vistoAt' | 'chats' | 'cuota'>[],
  ahora: number,
): string | null {
  if (w.destino === DESTINO_NUEVO) return 'Se abre cuando prendas la apertura de chats en el Runner.';
  const subido = carteros.flatMap((k) => k.chats.map((c) => ({ ...c, cuenta: c.cuenta ?? k.cuenta }))).find((c) => c.local === w.destino);
  const cuenta = subido?.cuenta ?? w.destino_cuenta;
  const n = cuenta ? cuenta.replace(/^claude/, '') : '?';
  const suyo = carteros.find((k) => k.cuenta === cuenta);
  // Sin cuota, ni el Runner ni el chat corren: va primero, porque si no parecería que la PC no responde.
  const uso = usoDeCuenta(suyo?.cuota ?? null, ahora);
  const lleno = [uso.cinco, uso.semana].find((v) => v?.pct != null && v.pct >= 100);
  if (lleno) return `La cuenta ${n} llegó a su límite${lleno.reinicia ? `: sigue a las ${horaAR(lleno.reinicia)}` : ''}.`;
  if (!carteroVivo(suyo, ahora)) {
    const pc = sinNoticiasDesde(carteros, ahora);
    if (pc != null) return `La PC no responde desde las ${horaAR(pc)}: puede estar dormida.`;
    const visto = fecha(suyo?.vistoAt);
    return visto != null ? `El Runner de la cuenta ${n} no responde desde las ${horaAR(visto)}: ábrelo para que salga.` : `Abre el Runner de la cuenta ${n} para que salga.`;
  }
  const estado = chat?.estado ?? (subido ? (subido.vivo ? 'abierto' : 'cerrado') : 'sin_dato');
  if (estado !== 'trabajando' && estado !== 'abierto') return `Abre este chat en la cuenta ${n} para que lo reciba.`;
  if (chat?.sinRunner || subido?.runner === false) return `Abre el Runner de la cuenta ${n} para que salga.`;
  return null;
}

/**
 * La línea de estado de un trabajo del Centro, debajo de su burbuja: «Enviado» o «La PC lo recibió», y por qué tarda si
 * tarda. null = ya lo tiene el chat (los ✓✓ lo dicen, y «Trabajando…» va al pie de la conversación: `chatTrabajando`), o
 * terminó, o no salió (eso lo dice su nota roja).
 */
export function estadoDelEnvio(
  w: Pick<TrabajoP, 'destino' | 'destino_cuenta' | 'created_at' | 'estado'>,
  chat: Pick<ChatCentro, 'estado' | 'viejo' | 'sinRunner'> | null,
  carteros: readonly Pick<CarteroP, 'cuenta' | 'vistoAt' | 'chats' | 'cuota'>[],
  ahora: number,
): EstadoDelEnvio | null {
  const estado = w.estado ?? 'escrito';
  if (estado !== 'escrito' && estado !== 'tomado') return null;
  const desde = fecha(w.created_at) ?? ahora;
  if (estado === 'escrito') {
    return { fase: 'enviado', texto: 'Enviado', porQue: ahora - desde > TARDA_MS ? porQueTarda(w, chat, carteros, ahora) ?? 'El Runner lo toma en segundos.' : null };
  }
  return { fase: 'recibido', texto: 'La PC lo recibió', porQue: ahora - desde > TARDA_TOMADO_MS ? porQueTarda(w, chat, carteros, ahora) ?? 'El Runner se lo está pasando al chat.' : null };
}

/**
 * ¿Va «Trabajando…» al pie de la conversación? Sí si el Runner lo ve ocupado AHORA (no una foto vieja), o si el último
 * trabajo se le entregó hace poco y todavía no contestó: el estado ocupado llega con la vuelta completa del Runner, y entre
 * una cosa y la otra la pantalla no puede quedar callada.
 */
export function chatTrabajando(chat: Pick<ChatCentro, 'estado' | 'viejo'>, lineas: readonly LineaChat[], ahora: number): boolean {
  if (chat.estado === 'trabajando' && !chat.viejo) return true;
  const trabajos = lineas.filter((l): l is Extract<LineaChat, { tipo: 'trabajo' }> => l.tipo === 'trabajo');
  const ultimo = trabajos[trabajos.length - 1]?.trabajo;
  if (!ultimo || ultimo.estado !== 'entregado' || ultimo.cierre) return false;
  const entregado = fecha(ultimo.entregado_at ?? null);
  if (entregado == null || ahora - entregado > RECIEN_ENTREGADO_MS) return false;
  return !lineas.some((l) => l.tipo === 'turno' && l.turno.rol === 'el' && l.instante > entregado);
}

/** ¿Hay algo en camino (escrito o tomado, de hace poco)? Mientras tanto la pantalla se refresca más seguido. */
export const hayEnCamino = (trabajos: readonly Pick<TrabajoP, 'estado' | 'created_at'>[], ahora: number): boolean =>
  trabajos.some((w) => (w.estado === 'escrito' || w.estado === 'tomado') && ahora - (fecha(w.created_at) ?? 0) < 5 * 60_000);

/** «Cuenta 3», o null si no se sabe. */
export const nombreCuenta =(c: string | null | undefined): string | null => (c ? `Cuenta ${c.replace(/^claude/, '')}` : null);

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
    if (e.por === 'runner') return 'El Runner entrega lo que escribes: no se le escribe.';
    if (e.por === 'nube') return 'Este chat está en la nube: escríbele desde la app de Claude.';
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

/** Cuántas cosas esperan a Martín en un chat (sus preguntas sin contestar): lo que lo sube en la lista. */
export type AvisosDe = (c: ChatCentro) => number;

/**
 * El lugar de un chat en la lista (Martín, 17/10/2026: «que los chats trabajando siempre estén arriba... Y los que tienen
 * notificaciones también»): 0 = trabajando AHORA (no una foto vieja), 1 = espera algo de Martín, 2 = el resto.
 */
export function prioridadEnLista(c: ChatCentro, avisos?: AvisosDe): 0 | 1 | 2 {
  if (c.estado === 'trabajando' && !c.viejo) return 0;
  return avisos && avisos(c) > 0 ? 1 : 2;
}
/** Lo que trabaja o espera a Martín nunca queda escondido detrás de «Mostrar más». */
export const esPrioritario = (c: ChatCentro, avisos?: AvisosDe) => prioridadEnLista(c, avisos) < 2;

/**
 * Las secciones de la barra: el Cerebro arriba y fijo, y UNA lista con los demás (17/10/2026, Martín: «No entiendo el
 * desplegable de "Sin asignar", no tiene sentido, elimínalo»). Adentro, primero los que trabajan, después los que
 * esperan a Martín, después el resto por actividad; los sub-chats van con su jefe (`porJefe`), que sube con ellos.
 * ⚠️ Un chat que no se llama como una tab ya no va aparte: está en la lista, y renombrándolo pasa a su jefe.
 */
export function seccionesDeChats(chats: readonly ChatCentro[], avisos?: AvisosDe): SeccionChats[] {
  const cerebro = chats.filter((c) => esCerebro(c.titulo));
  const resto = chats
    .filter((c) => !esCerebro(c.titulo))
    .map((c, i) => ({ c, i, p: prioridadEnLista(c, avisos) }))
    .sort((a, b) => a.p - b.p || (a.p === 2 ? (b.c.actividad ?? 0) - (a.c.actividad ?? 0) : 0) || a.i - b.i)
    .map((x) => x.c);
  const out: SeccionChats[] = [];
  if (cerebro.length) out.push({ clave: SECCION_CEREBRO, titulo: null, chats: cerebro });
  if (resto.length) out.push({ clave: SECCION_CHATS, titulo: null, chats: resto });
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
  /** pedido = lo trabajó este chat · derivado = se lo pediste acá y lo trabajó otro · trabajo = se lo mandaste desde el Centro
   *  · ya_esta = el chat dijo «Ya está» en su conversación (sólo en Review: `yaEstaDelChat`). */
  origen: 'pedido' | 'derivado' | 'trabajo' | 'ya_esta';
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
  // Una respuesta a una pregunta no es algo que se le pidió: no es un nodo del avance. Un turno de la conversación,
  // tampoco: el Plan son los pedidos y los trabajos.
  return lineas.flatMap((l): NodoAvance[] => (l.tipo === 'respuesta' || l.tipo === 'turno' || l.tipo === 'pregunta' ? [] : [nodoDe(l)]));
}

function nodoDe(l: Exclude<LineaChat, { tipo: 'respuesta' | 'turno' | 'pregunta' }>): NodoAvance {
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

// ── «Nuevo chat» con un clic (Ops Center, 17/10/2026, docs/diseno-nuevo-chat-un-clic.md) ──────────────────────────────

/** El primer mensaje de un chat nuevo cuando Martín no escribe nada (el del diseño). */
export const primerMensajeNuevo = (nombre: string) => `Hola, eres el chat «${nombre}». Lee AGENTS.md y espera instrucciones.`;

/**
 * Cómo va el último chat que se pidió abrir, para «Nuevo chat»: un trabajo `nuevo` no es de ningún chat de la lista, así
 * que su estado se dice ahí. null = no se pidió ninguno.
 */
export function estadoDeApertura(trabajos: readonly Pick<TrabajoP, 'destino' | 'destino_titulo' | 'created_at' | 'estado' | 'motivo'>[]): string | null {
  const nuevos = trabajos.filter((w) => w.destino === DESTINO_NUEVO);
  if (!nuevos.length) return null;
  const w = nuevos.reduce((a, b) => (Date.parse(b.created_at) > Date.parse(a.created_at) ? b : a));
  const nombre = `«${w.destino_titulo ?? 'Nuevo chat'}»`;
  switch (w.estado ?? 'escrito') {
    case 'escrito': return `${nombre}: espera al Runner. Si en 2 minutos no se abre, pídele al Runner «prende la apertura de chats».`;
    case 'tomado': return `${nombre}: abriéndose en la PC.`;
    case 'entregado': case 'hecho': case 'comprobado': return w.motivo ? `${nombre}: ${w.motivo.replace(/^Se pidió abrir «[^»]*»/, 'se pidió abrir')}` : `${nombre}: se pidió abrir.`;
    case 'cancelado': return `${nombre}: cancelado.`;
    default: return `${nombre}: no se abrió${w.motivo ? ` · ${w.motivo}` : ''}`;
  }
}

// ── Los «Ya está» de cada chat, en Review (Ops Center, 17/10/2026) ──────────────────────────────────────────────────
// La regla de Martín (AGENTS.md): cada chat cierra lo que llegó a producción con «Ya está» en SU chat, con la ruta donde se
// prueba. Llegaban sólo como texto de la conversación (el último texto del turno, del transcript: cartero.mjs →
// turnosDeLineas). Ahora cada uno es un HECHO de Review, con su ruta en «Revisar». NO entran al Plan: el Plan son los
// pedidos y los trabajos, y un «Ya está» cierra uno de ésos (contarlo dos veces inflaría el «8/13»).

/** ¿Este texto es un «Ya está»? Su primer renglón empieza así, con o sin negrita, tilde o un ✅ adelante. */
export const esYaEsta = (texto: string): boolean =>
  /^[\s*_#>✅✔·\-–—]*ya est[áa](?![a-zñáéíóú])/i.test(texto.trim().split('\n')[0] ?? '');

/** Lo que hay en el texto que parece un archivo o una carpeta de la PC, no una página de MaKo. */
const ES_ARCHIVO = /^\/(c|d|tmp|usr|home|users|mnt|dev|etc|var|opt|private)(\/|$)|\.(tsx?|m?js|json|md|css|sql|txt|log|ps1|sh)(\?|#|$)/i;

/**
 * La ruta de MaKo que dejó un «Ya está» («Pruébalo en /crm?lead=12», un link de hola-mako.com o `[aquí](/offer)`): la
 * primera que es una ruta interna y no un archivo. null = no dejó ninguna (Review lleva a la tab de su área).
 */
export function rutaDeYaEsta(texto: string): string | null {
  const absolutas = [...texto.matchAll(/https?:\/\/(?:www\.)?hola-mako\.com(\/[^\s)\]»"'`<>]*)/gi)].map((m) => m[1]);
  const sueltas = [...texto.matchAll(/(?:^|[\s(«"'`[])(\/[a-z0-9][^\s)\]»"'`<>]*)/gi)].map((m) => m[1]);
  for (const c of [...absolutas, ...sueltas]) {
    const r = rutaParaRevisar(c.replace(/[.,;:!?]+$/, ''));
    if (r && !ES_ARCHIVO.test(r)) return r;
  }
  return null;
}

/** Lo que va ANTES del texto en el primer renglón de un «Ya está»: el ✅, la negrita, «Ya está» y su puntuación. */
// ⚠️ La negrita que ABRE antes de «Ya está» es la única que se come al cerrarse (`\1`): «**Ya está:** el filtro» deja «el filtro»,
// pero «Ya está: **el filtro** del CRM» deja «**el filtro** del CRM» y no «el filtro** del CRM» (antes el `*` de después de los dos
// puntos se tragaba la apertura del título, y quedaba una negrita cruda a la vista).
const PREFIJO_YA_ESTA = /^[\s>#✅✔·\-–—]*(\*\*|__|\*|_)?[\s>#✅✔·\-–—]*ya est[áa][.:!,;]*(?:\1)?[\s.:!,;\-–—]*/i;

/** Hasta cuántos caracteres un primer renglón se dibuja como TÍTULO de la tarjeta; más largo es un párrafo. */
export const TITULO_YA_ESTA = 110;
/** Desde cuántos caracteres el cuerpo de un «Completado» se puede plegar (sólo si tiene una cola que queda a la vista). */
export const CUERPO_PLEGABLE = 1500;
/** Cuánto detalle tiene que haber antes de la cola para que valga la pena plegarlo. */
const DETALLE_PLEGABLE = 600;

/**
 * El «Completado» partido para dibujarlo ENTERO (17/10/2026, Martín: «tienen 3 puntos al final y no llego a leer todo, esos
 * son los mensajes más importantes que me permiten revisar y dar feedback»). El título de la FILA de Review/lista es
 * `tituloDeTexto` (72 caracteres y «…»): servía para una lista y se usaba también en la tarjeta, donde el resto del primer
 * renglón se perdía. Acá el título es el primer renglón COMPLETO si cabe como título; si no cabe (un párrafo), no hay título
 * y ese renglón va primero en el cuerpo, entero. Nunca se corta ni se agrega «…».
 */
export function partesDeYaEsta(texto: string): { titulo: string | null; cuerpo: string } {
  const lineas = texto.trim().split('\n');
  const resto = (lineas[0] ?? '').replace(PREFIJO_YA_ESTA, '').trim();
  const demas = lineas.slice(1).join('\n').trim();
  if (!resto) return { titulo: null, cuerpo: demas };
  if (resto.length <= TITULO_YA_ESTA) return { titulo: resto, cuerpo: demas };
  return { titulo: null, cuerpo: demas ? `${resto}\n\n${demas}` : resto };
}

/** Un renglón que abre lo PENDIENTE de un cierre: «Sigue:», «Qué sigue», «Pendiente», «Falta» (con su puntuación, para no
 *  confundirlo con una frase que sólo empieza así). */
const ABRE_LO_PENDIENTE_ESTRICTO = /^[\s>*_#\-•·]*(?:\d+[.)]\s*)?[*_`]*(?:(?:lo que |qué |que )?sigue|(?:queda )?pendiente|falta)[*_`]*\s*(?::|—|–|-|$)/i;
/** «Prueba:», «Pruébalo en /crm»: cómo probarlo. */
const ABRE_LA_PRUEBA = /^[\s>*_#\-•·]*(?:\d+[.)]\s*)?[*_`]*pr[uú]eba(?:lo|la|los|las)?\b/i;

/**
 * El cuerpo largo de un «Completado» en DOS: el detalle (decidido, hecho, comprobado) y la COLA, que es lo que Martín tiene
 * que ver siempre (lo que sigue pendiente y cómo probarlo). La cola empieza en el primer renglón que abre «Sigue», «Pendiente»,
 * «Falta» o «Prueba» (fuera de un bloque de código); sin esa marca, es el último párrafo. `null` = no se puede plegar sin
 * esconder algo (corto, sin cola, o casi todo es cola): se dibuja entero.
 */
export function partirPendiente(cuerpo: string): { detalle: string; cola: string } | null {
  if (cuerpo.length <= CUERPO_PLEGABLE) return null;
  const lineas = cuerpo.split('\n');
  let dentro = false;
  let corte = -1;
  let ultimoParrafo = -1;
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    if (/^\s*(```|~~~)/.test(l)) { dentro = !dentro; continue; }
    if (dentro) continue;
    if (i > 0 && !lineas[i - 1].trim() && l.trim()) ultimoParrafo = i;
    if (corte < 0 && (ABRE_LO_PENDIENTE_ESTRICTO.test(l) || ABRE_LA_PRUEBA.test(l))) corte = i;
  }
  if (corte < 0) corte = ultimoParrafo;
  if (corte <= 0) return null;
  const detalle = lineas.slice(0, corte).join('\n').trim();
  const cola = lineas.slice(corte).join('\n').trim();
  if (detalle.length < DETALLE_PLEGABLE || !cola) return null;
  return { detalle, cola };
}

/** ¿La PC cortó este turno al subirlo? Sube hasta `TOPE_TURNO` caracteres (cartero.mjs) y el resto no llega, sin avisar. */
export const cortadoPorLaPC = (texto: string): boolean => texto.length >= TOPE_TURNO;

/** Los «Ya está» de la conversación de un chat, como hechos de Review (lo más nuevo arriba lo ordena `porRevisar`). */
export function yaEstaDelChat(lineas: readonly LineaChat[]): NodoAvance[] {
  return lineas.flatMap((l): NodoAvance[] => {
    if (l.tipo !== 'turno' || l.turno.rol !== 'el' || !esYaEsta(l.turno.texto)) return [];
    const t = l.turno.texto.trim();
    // El título es lo que sigue al «Ya está» (o «Ya está», si no dijo más).
    const resto = t.replace(PREFIJO_YA_ESTA, '').trim();
    const ruta = rutaDeYaEsta(t);
    return [{
      id: `y:${l.turno.uuid}`, origen: 'ya_esta', titulo: resto ? tituloDeTexto(resto) : 'Ya está', prompt: t, instante: l.instante,
      estado: 'hecho', cuentas: [], pasos: [], commits: [], trabajaron: [], cierre: t, motivo: null,
      revisar: ruta ? { pagina: ruta, sesion: DESTINO_RE.test(l.turno.local) ? l.turno.local : null } : null,
    }];
  });
}

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
