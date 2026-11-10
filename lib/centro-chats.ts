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

import { CARTERO_VIVO_MS, CUENTA_RE, DESTINO_NUEVO, DESTINO_RE, TOPE_TURNO, TOPE_TURNO_VIEJO, carteroVivo, comoEstaElDestino, esParaMartin, fotoAlDia, noticiaDe, rutaParaRevisar, unirTurnos, type ChatCartero, type Cierre, type EstadoPedido, type TurnoChat, textoDelEncargo } from './operaciones-reglas';
import { hace, instanteHito, type AreaP, type PasoP, type PedidoP } from './progreso-reglas';
import { destinoDeDecision } from './decisiones-aviso';
import { esperaAMartin, textoDeRespuesta, type Decision } from '../app/admin/runway/decisiones';
import { usoDeCuenta, type Cuota } from './centro-uso';
import { esperaAMartinEnElChat, estaAbierta, preguntaDeTrabajo, resumenDeRespuesta, seContestaEnLaApp, type PreguntaChat } from './centro-preguntas-chat';
import { llegaAMartin } from './pregunta-para-martin';
import { listasEnRenglones } from './respuesta-como-claude';
import { haceCuanto } from './centro-limbo';
import { rotuloDia } from './centro-fechas';

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
export type CarteroP = { cuenta: string; /** La última vuelta de un RUNNER (`carteroVivo`). */ vistoAt: string | null; /** La última vuelta de cualquiera, también del servicio de la PC. Sin el dato, vale `vistoAt`. */ noticiasAt?: string | null; chats: readonly ChatCartero[]; claves?: readonly string[]; cuota?: Cuota | null };
/** Lo mínimo de un trabajo de la cola (lib/operaciones.ts → Pedido). Lo de abajo de `created_at` es lo que dibuja la
 *  conversación (el texto que se mandó, por dónde va y el cierre que dejó el chat); la lista no lo necesita. */
export type TrabajoP = {
  id: string; destino: string; destino_titulo: string | null; destino_cuenta: string | null; created_at: string;
  texto?: string; estado?: EstadoPedido; motivo?: string | null;
  entregado_at?: string | null; cerrado_at?: string | null; cierre?: Cierre | null;
  /** Los nombres de lo que se adjuntó (17/10/2026). */
  adjuntos?: string[];
  /** De esos, los que son FOTOS (23/10/2026): sólo su burbuja le pide la miniatura al servidor (FotosEnviadas.tsx). */
  fotos?: string[];
  /** Lo mandó como NOTA DE VOZ (26/10/2026): se dibuja el reproductor y `texto` (su transcripción) va en el menú. */
  voz?: { segundos: number };
  /** Todavía está SALIENDO, sólo en este navegador (27/10/2026, app/admin/operaciones/envios-en-curso.ts): se dibuja en el
   *  acto con su reloj, y la subida, la transcripción y la firma corren por detrás. `fallo`: no salió, con su porqué. */
  local?: { fase: 'enviando' | 'transcribiendo' | 'fallo'; error?: string; clave: string };
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
    // De cuándo es esta foto: de la última vuelta de CUALQUIERA. Con el servicio de la PC, el estado está al día aunque no haya Runner.
    const visto = fecha(noticiaDe(k));
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

/** Con qué se juntan dos chats en uno (`unirPorNombre`): el nombre sin mayúsculas ni tildes; el Cerebro, con sus nombres de
 *  antes. Uno de la nube no se une con el de la PC que se llama igual: es OTRA sesión, y no recibe (sería elegible como destino). */
export const grupoDeNombre = (c: { titulo: string; nube?: boolean }, sinNombre: string): string =>
  c.nube ? `nube:${normal(c.titulo) || sinNombre}` : esCerebro(c.titulo) ? 'cerebro' : normal(c.titulo) || sinNombre;

/**
 * Las sesiones de la MISMA CADENA (25/10/2026): las que el Ops Center junta en un chat por el nombre (`unirPorNombre`), como un
 * chat que siguió en otra cuenta. Por sesión, todas las de su cadena (ella incluida). La usa `superarPreguntas`: «Ventas de MaKo»
 * preguntó con AskUserQuestion en la cuenta 2 (23/10, 19:20), la conversación siguió en la cuenta 1, y la pregunta quedó «Espera
 * tu respuesta» para siempre: sólo la superaba un turno de la MISMA sesión. Los Runners no son chats: no van.
 */
export function cadenasDeSesiones(carteros: ReadonlyArray<{ chats: readonly ChatCartero[] }>): Map<string, string[]> {
  const grupos = new Map<string, string[]>();
  for (const cartero of carteros) {
    for (const ch of cartero.chats) {
      if (ch.esRunner) continue;
      const k = grupoDeNombre(ch, ch.local);
      grupos.set(k, [...(grupos.get(k) ?? []), ch.local]);
    }
  }
  const out = new Map<string, string[]>();
  for (const sesiones of grupos.values()) {
    const unicas = [...new Set(sesiones)];
    for (const s of unicas) out.set(s, unicas);
  }
  return out;
}

/** Un chat del Ops Center que dice «Completado» (para la API de MaKo, 25/10/2026): su clave (la de su ✓), su nombre, su cuenta,
 *  sus sesiones y el instante de su último «Ya está» sin ✓. */
export type CompletadoDeChat = { clave: string; titulo: string; cuenta: string | null; locales: string[]; instante: number };

/**
 * Los chats que dicen «Completado», con LO MISMO que la lista del Ops Center: sus sesiones juntas por el nombre (la clave de
 * `unirPorNombre`, que es la de su ✓), los últimos turnos de cada sesión (`leerUltimosTurnos`) y los ✓ (`leerYaVistosDe`). Lo usa
 * la API de MaKo (lib/api-mako/areas/operaciones.run.ts, «Todo MaKo se debe poder utilizar por API», Martín, 25/10/2026). El más
 * nuevo primero. Ni los Runners ni la nube (no son chats de Martín que cierran).
 */
/** Un chat de la lista, juntado por su nombre (todas sus sesiones, de todas las cuentas), con lo que necesita la API. */
export type ChatPorNombre = { clave: string; titulo: string; cuenta: string | null; locales: string[] };

/** Los chats de las cuentas juntados por su nombre, como la lista del Ops Center (sin el Runner ni lo de la nube). Lo usan los
 *  «Completado» y los mensajes de un chat por la API: las dos miran el MISMO chat que la pantalla. */
export function chatsPorNombre(carteros: ReadonlyArray<{ cuenta: string; chats: readonly ChatCartero[] }>): ChatPorNombre[] {
  return [...gruposPorNombre(carteros)].map(([g, x]) => ({ clave: `nombre:${g}`, titulo: x.titulo, cuenta: x.cuenta, locales: [...new Set(x.locales)] }));
}

function gruposPorNombre(carteros: ReadonlyArray<{ cuenta: string; chats: readonly ChatCartero[] }>) {
  const grupos = new Map<string, { titulo: string; cuenta: string | null; locales: string[]; actividad: number }>();
  for (const k of carteros) {
    for (const ch of k.chats) {
      if (ch.esRunner || ch.nube) continue;
      const g = grupoDeNombre(ch, ch.local);
      const actividad = ch.actividad ? Date.parse(ch.actividad) || 0 : 0;
      const ya = grupos.get(g);
      if (!ya) { grupos.set(g, { titulo: g === 'cerebro' ? CEREBRO : ch.titulo, cuenta: k.cuenta, locales: [ch.local], actividad }); continue; }
      ya.locales.push(ch.local);
      // El nombre y la cuenta, los de la sesión más reciente (como la fila); el Cerebro se llama siempre «Cerebro».
      if (actividad > ya.actividad) { if (g !== 'cerebro') ya.titulo = ch.titulo; ya.cuenta = k.cuenta; ya.actividad = actividad; }
    }
  }
  return grupos;
}

export function completadosDeLasCuentas(
  carteros: ReadonlyArray<{ cuenta: string; chats: readonly ChatCartero[] }>,
  ultimos: Readonly<Record<string, readonly TurnoChat[]>>,
  vistos: Readonly<YaVistos>,
): CompletadoDeChat[] {
  const out: CompletadoDeChat[] = [];
  for (const [g, x] of gruposPorNombre(carteros)) {
    const clave = `nombre:${g}`;
    const lineas: LineaChat[] = x.locales.flatMap((l) => (ultimos[l] ?? []).map((t) => ({ tipo: 'turno' as const, instante: Date.parse(t.at), turno: t })));
    const t = completadoSinVer(lineas, vistos[clave]);
    if (t) out.push({ clave, titulo: x.titulo, cuenta: x.cuenta, locales: [...new Set(x.locales)], instante: Date.parse(t.at) });
  }
  return out.sort((a, b) => b.instante - a.instante);
}

/**
 * Junta en UN chat todo lo que se llama igual (sin mayúsculas ni tildes): sus sesiones de las tres cuentas, lo que
 * trabajó cada una y lo anotado sin sesión con ese nombre. Martín (15/10/2026): «todos los chats de todas las cuentas
 * se llamen igual». Se le escribe a la sesión que mejor recibe (`pesoSesion`, y a igual peso la más reciente); su
 * estado y su cuenta son los de esa sesión, y `sesiones` las lista todas (la cabecera las muestra como chips).
 */
export function unirPorNombre(chats: readonly ChatCentro[]): ChatCentro[] {
  const grupos = new Map<string, ChatCentro[]>();
  for (const c of chats) {
    const k = grupoDeNombre(c, c.clave);
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
//
// 18/10/2026, Martín: se llama «MaKo Alert», vigila TODA la app (no sólo WhatsApp) y NO se ve en el Ops Center nunca: «no creo
// que sea útil que esté visible dentro del Center, ya que es mero informativo y en todo caso le manda mensajes a los otros chats
// para que se encarguen». Se esconde siempre, con incidente o sin él, y no avisa. Sólo se ve si alguien lo abre por su link.
/** ¿Es el chat del vigía? Su nombre ENTERO, el nuevo o el de antes: «MaKo Alert › algo» es un sub-chat con trabajo real. */
export const esChatVigia = (c: Pick<ChatCentro, 'titulo'>): boolean => /^(mako alert|mako en whatsapp)$/i.test(c.titulo.trim());

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

/** ¿Se esconde este chat de la lista? El vigía, SIEMPRE (18/10/2026), salvo el que se está mirando. Los otros dos datos quedan por la firma. */
export const vigiaCallado = (c: Pick<ChatCentro, 'titulo'>, _turnos: readonly TurnoChat[] | undefined, _espera: number, miradoAhora: boolean): boolean =>
  esChatVigia(c) && !miradoAhora;

/** ¿Trae un incidente que este dispositivo no vio? Cuenta como una respuesta que espera (`avisosDe`): mismo globito y renglón. */
export const incidenteSinVer = (_c: Pick<ChatCentro, 'titulo'>, _turnos: readonly TurnoChat[] | undefined, _vistoEn: number): boolean =>
  false; // 18/10/2026: el vigía ya no avisa en el Ops Center; los incidentes se los pasa al chat que se encarga.

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

export type GrupoJefe<T extends { titulo: string } = ChatCentro> = { clave: string; jefe: string; chat: T | null; subs: T[] };

// ── UN CHAT POR TAB (10/11/2026) ────────────────────────────────────────────────────────────────────────────────────────────
// Martín: «se están creando una cantidad de chats impresionante… La idea era tener un chat por cada tab de MaKo o cada funcionalidad
// que se esté desarrollando». La cuenta 1 tenía 178 chats, casi todos con título de tarea («Borrar la co-edición del editor de
// imágenes»), y cada uno era una fila. Ahora la fila es la TAB: el chat que se llama como ella es su cabeza y los demás —sus
// sub-chats y los de tarea— van adentro, plegados (PiezasCentro.tsx y ChatsMovil.tsx). La regla de AGENTS.md («UN CHAT POR TAB») es
// cómo se nombra; esto es cómo se ve cuando no se cumplió.

/** Una tab y los nombres que la nombran, normalizados (app/admin/operaciones/tabs.ts → indiceDeTabs, en el servidor). */
export type TabDelIndice = { tab: string; nombres: readonly string[] };
/** De qué tab es un chat, y si es SU chat (se llama como ella, sin sub-chat). */
export type TabDelChat = { tab: string; jefe: boolean };

/** Los nombres de una palabra que son castellano de todos los días: buscados adentro de un título agruparían cualquier tarea
 *  («arreglar el plan de pagos», «los chats», «el video del curso»). Como el nombre ENTERO del chat, sí valen. */
const NOMBRES_COMUNES = new Set(['plan', 'general', 'chats', 'api', 'ideas', 'today', 'sales', 'create', 'marketing', 'dev', 'docs', 'grafo', 'web', 'copy', 'retro', 'email', 'video', 'mindset', 'calendario', 'pricing', 'perfil', 'documentacion']);
const palabras = (s: string) => ` ${normal(s).replace(/[^a-z0-9ñ]+/g, ' ').trim()} `;
const indicesArmados = new WeakMap<readonly TabDelIndice[], { porNombre: Map<string, string>; frases: Array<{ frase: string; tab: string }> }>();
function armarIndice(indice: readonly TabDelIndice[]) {
  let a = indicesArmados.get(indice);
  if (!a) {
    const porNombre = new Map<string, string>();
    const frases: Array<{ frase: string; tab: string }> = [];
    for (const t of indice) {
      for (const n of t.nombres) {
        const k = normal(n);
        if (!k || porNombre.has(k)) continue;
        porNombre.set(k, t.tab);
        const f = palabras(k);
        if (f.trim().length >= 3 && (f.trim().includes(' ') || !NOMBRES_COMUNES.has(f.trim()))) frases.push({ frase: f, tab: t.tab });
      }
    }
    frases.sort((x, y) => y.frase.length - x.frase.length);
    a = { porNombre, frases };
    indicesArmados.set(indice, a);
  }
  return a;
}

/**
 * La tab de un chat (10/11/2026), en este orden, del dato más firme al más flojo:
 *   1. su nombre: «CRM» o «CRM › Lead Detail» (la convención del jefe), o un nombre de la tab («Image Editor» es «Image»);
 *   2. el área de su bitácora (`area`: donde más anotó), que es lo medido;
 *   3. una tab nombrada ADENTRO de su título, la frase más larga («Arreglar el kanban del CRM», «… del editor de imágenes»).
 * null = no se sabe: va solo en la lista, como hasta ahora. El Cerebro no pasa por acá (`seccionesDeChats` lo separa antes).
 */
export function tabDeChat(c: { titulo: string; area?: string }, indice: readonly TabDelIndice[] | undefined): TabDelChat | null {
  const { jefe, sub } = partesDelNombre(c.titulo);
  // El Cerebro y sus sub-chats son del Cerebro, aunque su título nombre una tab («Cerebro › Integración»).
  if (esCerebro(jefe)) return { tab: CEREBRO, jefe: !sub };
  if (!indice?.length) return null;
  const { porNombre, frases } = armarIndice(indice);
  const porSuNombre = porNombre.get(normal(jefe));
  if (porSuNombre) return { tab: porSuNombre, jefe: !sub };
  if (c.area) {
    const porArea = porNombre.get(normal(c.area));
    if (porArea) return { tab: porArea, jefe: false };
  }
  const titulo = palabras(c.titulo);
  const f = frases.find((x) => titulo.includes(x.frase));
  return f ? { tab: f.tab, jefe: false } : null;
}

/**
 * La lista agrupada por jefe, en el orden en que llega (lo que trabaja arriba): el grupo va donde aparece el primero
 * de los suyos. Un sub-chat cuyo jefe no está en la lista igual se agrupa bajo su nombre (`chat: null`).
 * Con `tabDe` (10/11/2026, `tabDeChat`) el grupo es la TAB: también se juntan ahí los chats de tarea de esa tab, y la cabeza es el que
 * se llama como ella. Sin tab, el de siempre: por la parte de antes del «›».
 */
export function porJefe<T extends { titulo: string } = ChatCentro>(chats: readonly T[], tabDe?: (c: T) => TabDelChat | null): GrupoJefe<T>[] {
  const grupos = new Map<string, GrupoJefe<T>>();
  for (const c of chats) {
    const { jefe, sub } = partesDelNombre(c.titulo);
    const t = tabDe?.(c) ?? null;
    const nombre = t ? t.tab : jefe;
    const esCabeza = t ? t.jefe : !sub;
    const k = normal(nombre);
    if (!grupos.has(k)) grupos.set(k, { clave: `jefe:${k}`, jefe: nombre, chat: null, subs: [] });
    const g = grupos.get(k)!;
    // Dos que se llaman como la tab («Image» y «Image Editor»): la cabeza es el primero, el otro va adentro.
    if (esCabeza && !g.chat) { g.chat = c; g.jefe = c.titulo; } else g.subs.push(c);
  }
  // Por tab, un chat de tarea SOLO en su tab es su propia fila: con el nombre de la tab arriba y él adentro, una tab de un chat
  // ocupaba dos renglones (y plegado, uno que no decía nada).
  if (tabDe) for (const g of grupos.values()) if (!g.chat && g.subs.length === 1) { g.chat = g.subs[0]; g.subs = []; }
  return [...grupos.values()];
}

/**
 * Lo que se ve de un grupo con sus chats PLEGADOS (10/11/2026): la cabeza (o el nombre de la tab), los de adentro que no se pueden
 * esconder —los que esperan a Martín, trabajan o se están mirando (`siempre`)— y cuántos quedan detrás de «Mostrar N chats». Abierto,
 * todos. Lo usan la computadora y el teléfono.
 */
export function plegarGrupo<T extends { titulo: string }>(g: GrupoJefe<T>, abierto: boolean, siempre: (c: T) => boolean): { subs: T[]; ocultos: number } {
  // Uno solo sin cabeza no se pliega: plegado no quedaría nada que diga de qué es el «Mostrar 1 chat».
  if (abierto || (!g.chat && g.subs.length <= 1)) return { subs: g.subs, ocultos: 0 };
  const subs = g.subs.filter(siempre);
  return { subs, ocultos: g.subs.length - subs.length };
}

/** Un renglón de la lista del teléfono: un chat (corrido si es de adentro), el nombre de una tab sin chat propio, o «Ver N más». */
export type FilaDeGrupos<T> = { tipo: 'chat'; c: T; sub: boolean } | { tipo: 'tab'; clave: string; nombre: string } | { tipo: 'plegados'; clave: string; n: number };

/**
 * Los grupos en renglones, plegados (10/11/2026; el teléfono, app/m/operaciones/ChatsMovil.tsx). La cabeza (o, sin chat que se llame
 * como la tab, su nombre, cuando son varios), los de adentro que se ven, y «Ver N más» si quedan plegados. Un sub-chat solo cuyo jefe
 * no está va con su nombre entero, sin correrse (23/10/2026: corrido, parecía colgado del de arriba).
 */
export function filasDeGrupos<T extends { titulo: string }>(grupos: readonly GrupoJefe<T>[], abiertos: ReadonlySet<string>, siempre: (c: T) => boolean): FilaDeGrupos<T>[] {
  return grupos.flatMap((g): FilaDeGrupos<T>[] => {
    const { subs, ocultos } = plegarGrupo(g, abiertos.has(g.clave), siempre);
    const varios = subs.length + ocultos > 1;
    const cabeza: FilaDeGrupos<T>[] = g.chat ? [{ tipo: 'chat', c: g.chat, sub: false }] : varios ? [{ tipo: 'tab', clave: g.clave, nombre: g.jefe }] : [];
    const adentro: FilaDeGrupos<T>[] = subs.map((c) => ({ tipo: 'chat', c, sub: !!g.chat || varios }));
    return [...cabeza, ...adentro, ...(ocultos > 0 ? [{ tipo: 'plegados' as const, clave: g.clave, n: ocultos }] : [])];
  });
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
  /** Lo que se le dijo al chat y lo que contestó, sacado de su transcript (17/10/2026: «los chats no se entienden»).
   *  `plegado`: un turno que el chat le escribió a OTRO chat, no a Martín (`turnosParaOtro`): va en una línea, «Avance: …». */
  | { tipo: 'turno'; instante: number; turno: TurnoChat; plegado?: boolean }
  /** Una pregunta del chat, con sus opciones (17/10/2026: el formulario de `cartero.mjs preguntar`). `trabajo` = el trabajo
   *  firmado que la contestó, si ya salió: la respuesta se dibuja en la pregunta, no como una burbuja aparte. */
  | { tipo: 'pregunta'; instante: number; pregunta: PreguntaChat; trabajo: TrabajoP | null };

/**
 * Lo que se DIBUJA en la conversación (17/10/2026, Martín: «los chats no se entienden... No se entiende la conversación
 * que se tiene»): lo que se le dijo y lo que contestó (los turnos), los trabajos del Centro y las respuestas a sus
 * preguntas. Los pedidos de la bitácora y sus hitos («Corrección · 19:32 — …», «Lo pediste en …») NO: son el Plan, y
 * van a su barra (`avanceDelChat` los sigue leyendo de `historialDelChat`). Un turno que trajo un trabajo tampoco: ese
 * trabajo ya está, con sus ticks.
 * ⚠️ NI LO QUE SE DICEN LOS CHATS ENTRE ELLOS (22/10/2026, `esParaMartin`, lib/operaciones-reglas.ts): un mensaje de otro
 *    chat y el resumen de una compactación no se dibujan, en la computadora ni en el teléfono (los dos pasan por acá).
 */
/** La versión plegada de cada línea, UNA por línea (23/10/2026): armada de nuevo en cada dibujo, la línea plegada nunca era la
 *  misma y el hilo memorizado la volvía a dibujar en cada refresco. Con la línea estable (lib/centro-estable.ts), la plegada
 *  también. */
const plegadas = new WeakMap<LineaChat, LineaChat>();
const plegada = (l: LineaChat): LineaChat => {
  let p = plegadas.get(l);
  if (!p) { p = { ...l, plegado: true } as LineaChat; plegadas.set(l, p); }
  return p;
};
export const lineasDeConversacion = (lineas: readonly LineaChat[]): LineaChat[] => {
  const paraOtro = turnosParaOtro(lineas);
  return lineas.filter((l) => l.tipo === 'trabajo' || l.tipo === 'respuesta' || l.tipo === 'pregunta'
    || (l.tipo === 'turno' && esParaMartin(l.turno) && !(l.turno.rol === 'yo' && l.turno.trabajo)))
    .map((l) => (l.tipo === 'turno' && paraOtro.has(l.turno.uuid) ? plegada(l) : l));
};

/**
 * LO QUE EL CHAT LE ESCRIBIÓ A OTRO CHAT, Y NO A MARTÍN (22/10/2026, el Cerebro con captura del chat «CRM»: los mensajes técnicos y
 * largos que el CRM le escribe al Cerebro son la respuesta a un pedido DEL CEREBRO): los turnos del chat entre un mensaje de otro
 * chat y el próximo de Martín. Se dibujan plegados («Avance: …»), y la fila no los toma por lo último. Un «Ya está» no: ése es
 * para Martín, aunque lo haya pedido otro chat (AGENTS.md, «el Ya está lo dice cada chat»).
 */
export function turnosParaOtro(lineas: readonly LineaChat[]): Set<string> {
  const out = new Set<string>();
  // El Completado del tramo no se pliega (27/10/2026, `completadosDelChat`): el cierre de verdad, aunque no empiece con «Ya está».
  const completados = new Set(completadosDelChat(lineas).map((x) => x.turno.uuid));
  let deOtro = false;
  for (const l of [...lineas].sort((a, b) => a.instante - b.instante)) {
    if (l.tipo !== 'turno') continue;
    if (l.turno.rol === 'yo') deOtro = false;
    else if (l.turno.rol === 'otro') deOtro = !l.turno.encargo;
    else if (deOtro && !completados.has(l.turno.uuid)) out.add(l.turno.uuid);
  }
  return out;
}

// ── Los «Avance» seguidos, en UNA burbuja (25/10/2026) ───────────────────────────────────────────────────────────────
// Martín, desde el Centro y con captura del chat «Cerebro» en el teléfono: «me llegan una cantidad impresionante de mensajes de
// "avance", podrían agruparlos todos en 1 de ultima y que dentro tenga varios desplegables». Una fila entera (muñeco, burbuja y
// hora) por cada uno: siete seguidos llenaban la pantalla.

/** Dos o más «Avance» seguidos de un chat, del mismo día: una burbuja (app/admin/operaciones/Hilo.tsx → Avances). */
export type GrupoDeAvances = { tipo: 'avances'; instante: number; avances: readonly LineaChat[] };
/** Lo que dibuja el hilo: una línea, o un grupo de avances. */
export type PiezaDelHilo = LineaChat | GrupoDeAvances;
/** ¿Es un «Avance»? Un turno que el chat le escribió a OTRO chat (`turnosParaOtro`): lo que se dibuja plegado. */
export const esAvance = (l: LineaChat): boolean => l.tipo === 'turno' && l.plegado === true;
const diaDeAR = (t: number) => Math.floor((t - 3 * 3_600_000) / 86_400_000);

/**
 * Junta en un grupo los «Avance» que van uno detrás del otro en lo que se dibuja (`lineasDeConversacion`), del mismo día.
 * Cualquier otra línea corta el grupo: una pregunta, un «Completado» (un «Ya está» nunca es un avance), lo que escribió
 * Martín. El cambio de día también, porque entre medio va la píldora del día. Uno solo queda como estaba.
 * ⚠️ NO SACA NI AGREGA NADA: es cómo se dibujan. Lo «sin ver», el «Completado» y lo que dice la fila miran las LÍNEAS, no esto.
 */
export function agruparAvances(lineas: readonly LineaChat[]): PiezaDelHilo[] {
  const out: PiezaDelHilo[] = [];
  let tanda: LineaChat[] = [];
  const cerrar = () => {
    if (tanda.length >= 2) out.push({ tipo: 'avances', instante: tanda[tanda.length - 1].instante, avances: tanda });
    else out.push(...tanda);
    tanda = [];
  };
  for (const l of lineas) {
    if (esAvance(l)) {
      if (tanda.length && diaDeAR(tanda[0].instante) !== diaDeAR(l.instante)) cerrar();
      tanda.push(l);
    } else {
      cerrar();
      out.push(l);
    }
  }
  cerrar();
  return out;
}

/**
 * Lo que dice un chat para la API (`ver_mensajes_operaciones`), con lo MISMO que la conversación de la pantalla
 * (`historialDelChat`): sus turnos, sus preguntas, y lo que Martín le mandó desde el Ops Center. El trabajo que contesta una
 * pregunta va ADENTRO de ella; uno con la marca de una pregunta que no se conoce sale como trabajo, para no perderlo. El turno
 * que la PC guardó de un trabajo no se repite: `lineasDeConversacion` lo saca.
 * ⚠️ SIN LAS PREGUNTAS, LA API CONTABA OTRA CONVERSACIÓN (26/10/2026, la revisión del tren-m): la respuesta de Martín no salía
 *    por ningún lado (su trabajo se descartaba y su turno lo saca `lineasDeConversacion`), y dos tandas de avances que la
 *    pregunta separa en la pantalla salían juntas.
 */
export function lineasParaLaApi(turnos: readonly TurnoChat[], trabajos: readonly TrabajoP[], preguntas: readonly PreguntaChat[] = []): LineaChat[] {
  const out: LineaChat[] = [];
  const conocidas = new Set(preguntas.map((p) => p.id));
  const respuestaDe = new Map<string, TrabajoP>();
  for (const w of trabajos) { const id = preguntaDeTrabajo(w.texto); if (id && conocidas.has(id)) respuestaDe.set(id, w); }
  const contestan = new Set([...respuestaDe.values()].map((w) => w.id));
  for (const u of turnos) { const t = fecha(u.at); if (t != null) out.push({ tipo: 'turno', instante: t, turno: u }); }
  for (const p of preguntas) { const t = fecha(p.at); if (t != null) out.push({ tipo: 'pregunta', instante: t, pregunta: p, trabajo: respuestaDe.get(p.id) ?? null }); }
  for (const w of trabajos) {
    const t = fecha(w.created_at);
    if (t != null && !contestan.has(w.id)) out.push({ tipo: 'trabajo', instante: t, trabajo: w });
  }
  return out.sort((x, y) => x.instante - y.instante);
}

/**
 * Una pieza de la conversación como la devuelve la API (`ver_mensajes_operaciones`): lo de Martín y lo del chat, un avance
 * suelto, o un grupo con el último entero y los anteriores del más nuevo al más viejo, cada uno con su primera oración (lo
 * que se ve en la fila cerrada) y su texto entero (lo que se ve al abrirla). Una nota de voz de Martín dice que es un audio,
 * con lo que dura y su transcripción aparte (26/10/2026). Ningún turno queda afuera.
 */
export function piezaParaLaApi(p: PiezaDelHilo, chat: string) {
  // Lo del chat, como se dibuja (26/10/2026): un «1) … 2) …» corrido, en renglones (lib/respuesta-como-claude.ts).
  const delChat = (t: TurnoChat) => (t.rol === 'el' ? listasEnRenglones(t.texto) : t.texto);
  if (p.tipo === 'avances') {
    const turnos = p.avances.flatMap((l) => (l.tipo === 'turno' ? [l.turno] : []));
    const ultimo = turnos[turnos.length - 1];
    return {
      tipo: 'avances' as const, cantidad: turnos.length, at: ultimo.at,
      ultimo: { at: ultimo.at, texto: delChat(ultimo) },
      anteriores: turnos.slice(0, -1).reverse().map((t) => ({ at: t.at, resumen: primeraOracion(t.texto), texto: delChat(t) })),
    };
  }
  if (p.tipo === 'turno') {
    return { tipo: p.plegado ? ('avance' as const) : ('mensaje' as const), de: p.turno.rol === 'yo' ? 'Martín' : chat, at: p.turno.at, texto: delChat(p.turno) };
  }
  if (p.tipo === 'pregunta') {
    // Lo que contestó Martín: lo que guardó la pregunta, o el texto de su trabajo sin la marca si no se llegó a guardar.
    const q = p.pregunta;
    const respuesta = q.respuesta ? resumenDeRespuesta(q, q.respuesta) : p.trabajo ? (p.trabajo.texto ?? '').replace(/\[pregunta [0-9a-f-]{36}\]\s*/, '').trim() : null;
    // `id` (5/11/2026): con él se ignora o se vuelve a mostrar (`ignorar_pregunta_operaciones`); `ignorada`, desde cuándo.
    return {
      tipo: 'pregunta' as const, de: chat, id: q.id, at: q.at, pregunta: q.pregunta, opciones: q.opciones.map((o) => o.titulo),
      respuesta, abierta: !q.respuesta && !(p.trabajo && p.trabajo.estado !== 'cancelado') && estaAbierta(q),
      ...(q.ignorada && !q.respuesta ? { ignorada: q.ignorada } : {}),
      // La técnica que llegó igual (10/11/2026): abierta para su chat, y Martín no la ve. Para el Cerebro: la decide el chat.
      ...(estaAbierta(q) && !llegaAMartin(q) ? { para_el_chat: true } : {}),
    };
  }
  if (p.tipo === 'trabajo') {
    const w = p.trabajo;
    if (w.voz) return { tipo: 'audio' as const, de: 'Martín', at: w.created_at, segundos: w.voz.segundos, transcripcion: w.texto ?? '' };
    return { tipo: 'mensaje' as const, de: 'Martín', at: w.created_at, texto: w.texto ?? '', ...(w.adjuntos?.length ? { adjuntos: w.adjuntos } : {}) };
  }
  return { tipo: p.tipo, at: new Date(p.instante).toISOString() };
}

/** La primera oración de un texto, sin el formato del Markdown, para el renglón plegado de un turno («Avance: …»). */
export function primeraOracion(texto: string, tope = 140): string {
  const renglon = texto.split('\n').map((r) => r.replace(/[*_`#>]+/g, '').replace(/\s+/g, ' ').trim()).find((r) => r.length > 0) ?? '';
  const m = /^(.+?[.!?])(?:\s|$)/.exec(renglon);
  const o = (m ? m[1] : renglon).trim();
  return o.length > tope ? `${o.slice(0, tope - 1).trimEnd()}…` : o;
}

/** ¿La respuesta de esta línea está en camino? Un trabajo CANCELADO no lo está (lo canceló Martín en la cola, o salió de una pregunta
 *  ignorada: `MOTIVO_IGNORADA`): la pregunta vuelve a poder contestarse si sigue abierta (5/11/2026). */
const respuestaEnCamino = (l: Extract<LineaChat, { tipo: 'pregunta' }>): boolean => !!l.trabajo && l.trabajo.estado !== 'cancelado';
/** Las abiertas de este chat cuya respuesta todavía no salió (la línea no tiene su trabajo), la más vieja primero. `todas`: también
 *  las técnicas (10/11/2026): no le llegan a Martín, pero una de la app de Claude igual traba al chat (`chatTrabadoEnLaApp`). */
const abiertasSinRespuesta = (lineas: readonly LineaChat[], todas = false): PreguntaChat[] =>
  lineas.flatMap((l) => (l.tipo === 'pregunta' && !respuestaEnCamino(l) && (todas ? estaAbierta(l.pregunta) : esperaAMartinEnElChat(l.pregunta)) ? [l] : []))
    .sort((a, b) => a.instante - b.instante).map((l) => l.pregunta);

/** Las de este chat que Martín IGNORÓ (5/11/2026), la última ignorada primero: van a «Ignoradas», con «Volver a mostrar». */
export const preguntasIgnoradas = (lineas: readonly LineaChat[]): PreguntaChat[] =>
  lineas.flatMap((l) => (l.tipo === 'pregunta' && l.pregunta.ignorada && !l.pregunta.respuesta ? [l.pregunta] : []))
    .sort((a, b) => Date.parse(b.ignorada ?? '') - Date.parse(a.ignorada ?? ''));

/**
 * Las preguntas que van al BLOQUE de arriba de la caja (22/10/2026, Martín: «Las decisiones deben salir como en Claude, un bloque
 * arriba del chat con las opciones… respondo 1 y va a la siguiente»): las de `cartero preguntar` y las de botones del cierre con
 * wrap_up, que se contestan acá. Las de un AskUserQuestion van aparte (`preguntasDeLaApp`): se ven, y se contestan en la app.
 */
export const preguntasParaElBloque = (lineas: readonly LineaChat[]): PreguntaChat[] => abiertasSinRespuesta(lineas).filter((p) => !seContestaEnLaApp(p));
/** Las que el chat le hizo con AskUserQuestion en la app de Claude (cartero 1.18.0): se VEN arriba de la caja, de sólo lectura. */
export const preguntasDeLaApp = (lineas: readonly LineaChat[]): PreguntaChat[] => abiertasSinRespuesta(lineas).filter(seContestaEnLaApp);
/** ¿El chat está trabado en un AskUserQuestion? Con CUALQUIERA abierta, también una técnica que Martín no ve: lo que se le escribe
 *  espera igual, y la línea del envío lo tiene que decir (Conversacion.tsx y ChatsMovil.tsx → `trabado`). */
export const chatTrabadoEnLaApp = (lineas: readonly LineaChat[]): boolean => abiertasSinRespuesta(lineas, true).some(seContestaEnLaApp);

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
 * Qué dice el segundo renglón de la fila de un chat, en la computadora y en el teléfono. SÓLO TRES COSAS (20/10/2026, Martín,
 * con captura de la lista: «Jamás debe decir el subtitulo las cosas que ponen... O debe decir "Trabajando..." o "Espera tu
 * respuesta" o no tener subtitulo»): «Trabajando…» si el chat está ocupado, «Espera tu respuesta» si algo espera a Martín
 * (una pregunta, una tarjeta, un «Completado» sin su ✓), o nada. NUNCA el texto de un paso, de un mensaje, de una
 * herramienta ni de un borrador: el paso en curso sigue ADENTRO del chat, en el «Trabajando ••• …» del hilo.
 *
 * ⚠️ `revisar` es el MISMO aviso que `espera` (Martín, 17/10/2026, 19:33: «Cuando tengo algo pendiente que revisar de
 * "Completado" la misma notif de "Espera tu respuesta"»): mismo lugar, mismo estilo y el mismo globito en la criatura
 * (`avisosDe`). Desde el 18/10/2026 dice «Espera tu respuesta» y NO desaparece al abrir el chat: sólo con el ✓ de Martín
 * en la tarjeta del «Completado» (`esperaCheck`, guardado en MaKo).
 */
export type SegundoRenglon = 'vivo' | 'espera' | 'revisar' | null;
export function segundoRenglon(
  c: Pick<ChatCentro, 'estado' | 'viejo'>, espera: number,
  /** Su último «Completado» espera el ✓ de Martín (`esperaCheck`), aunque el chat haya escrito algo después. */
  sinVer = false,
): SegundoRenglon {
  if (c.estado === 'trabajando' && !c.viejo) return 'vivo';
  if (espera > 0) return 'espera';
  return sinVer ? 'revisar' : null;
}
/** Lo que dice la fila de cada uno (las mismas palabras en la computadora y en el teléfono). */
export const TEXTO_SEGUNDO_RENGLON: Record<NonNullable<SegundoRenglon>, string> = {
  // EL ESTADO ES HONESTO (22/10/2026, Martín: «hay muchos chats que dicen "Espera tu respuesta" y cuando entro, no veo el mensaje
  // de "Completado" o el bloque de preguntas»): «Espera tu respuesta» SÓLO con una pregunta abierta para él; un «Ya está» sin ver
  // dice «Completado». Medido ese día: una sola sesión tenía preguntas abiertas; las demás filas eran «Completado» sin ver.
  vivo: 'Trabajando…', espera: 'Espera tu respuesta', revisar: 'Completado',
};

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

// ── El ✓ del «Completado» (18/10/2026, pedido 1d15877a) ─────────────────────────────────────────
// Martín: «No me aparece el mensaje de "Completado" y la notificación de todos los chats siempre debe ser "Espera tu
// respuesta", y no desaparecer hasta que yo le dé un check al mensaje de completado». Medido ese día: los «Ya está» SÍ
// estaban en MaKo, pero el aviso (`avisaYaEsta`) se guardaba por dispositivo y se apagaba al abrir el chat, sólo contaba
// si el «Ya está» era lo ÚLTIMO del chat, y la lista recibía sólo los últimos 3 turnos (`resumirTurnos`).
// Ahora: un chat espera el ✓ mientras su ÚLTIMO «Ya está» (aunque después haya escrito otra cosa) sea más nuevo que el ✓
// guardado en MaKo para ese chat (lib/centro-ya-vistos-db.ts): el mismo en la computadora y en el teléfono.

/** Desde cuándo un «Completado» espera el ✓: los de antes no vuelven todos juntos a pedirlo. */
export const YA_VISTOS_DESDE = Date.parse('2026-10-18T00:00:00-03:00');
/** El ✓ de cada chat (su clave): hasta qué «Ya está» (su instante) ya lo vio Martín. */
export type YaVistos = Record<string, number>;
export const MAX_YA_VISTOS = 500;

/** Lo guardado, saneado: claves cortas e instantes finitos; los más nuevos si hay de más. */
export function leerYaVistos(v: unknown): YaVistos {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const pares = Object.entries(v as Record<string, unknown>)
    .filter((e): e is [string, number] => e[0].length > 0 && e[0].length <= 300 && typeof e[1] === 'number' && Number.isFinite(e[1]));
  return Object.fromEntries(pares.sort((a, b) => b[1] - a[1]).slice(0, MAX_YA_VISTOS));
}

/**
 * LOS «COMPLETADO» DE UN CHAT: cada «Ya está», salvo que sea un renglón de A MITAD DE SU RONDA (27/10/2026).
 * Martín, con la tarjeta «COMPLETADO · Ayer 13:59» del CRM: «la info no me dice nada... No sirve de nada si no sé en qué se
 * trabajó claramente, sin rodeos». Medido en la base (los turnos del CRM del 26/10): a las 13:59 el chat escribió, a mitad del
 * trabajo, «Ya está probado: … Ahora dejo escrito lo aprendido en los documentos del repo», y a las 14:01 cerró con lo que
 * hizo («**Punta: ca01d4c82** …»). Un «Ya está» se reconoce por cómo EMPIEZA el texto (`esYaEsta`), así que el Completado era
 * el renglón de las 13:59, y el cierre de verdad quedaba plegado como «Avance» (venía después de un mensaje del Cerebro:
 * `turnosParaOtro`). ⚠️ El diagnóstico obvio («el cartero sube el último renglón suelto») era el equivocado: el cartero subió
 * bien los dos.
 * Desde el cartero 1.21.0 cada texto del chat dice de qué RONDA es (`inicio`: el primero de la ronda) y el que la cierra lleva
 * `fin`. Un «Ya está» que no cierra su ronda cede el lugar al cierre de ESA ronda (con su resumen del wrap_up). ⚠️ Sólo de esa
 * ronda: lo que el chat escribe en otra (un «Recibido, sigo con…») no le saca el lugar al «Ya está», que espera su ✓ aunque el
 * chat haya escrito después (la regla del 18/10, tests/centro-ya-visto.test.ts). Sin las marcas (un cartero de antes), como
 * siempre: el «Ya está».
 */
export function completadosDelChat(lineas: readonly LineaChat[]): Array<{ instante: number; turno: TurnoChat }> {
  const delChat = lineas.filter((l): l is Extract<LineaChat, { tipo: 'turno' }> => l.tipo === 'turno' && l.turno.rol === 'el');
  const cierres = new Map<string, Extract<LineaChat, { tipo: 'turno' }>>();
  for (const l of delChat) if (l.turno.fin && l.turno.inicio) cierres.set(l.turno.inicio, l);
  const out = new Map<string, { instante: number; turno: TurnoChat }>();
  for (const l of delChat) {
    if (!esYaEsta(l.turno.texto)) continue;
    const c = l.turno.fin ? null : cierres.get(l.turno.inicio ?? l.turno.uuid);
    const x = c && c.instante >= l.instante ? c : l;
    // Con trabajo de fondo vivo la ronda no terminó (cartero 1.21.0, 27/10 23:07): sigue «Trabajando», no es un Completado.
    if (x.turno.fondo) continue;
    out.set(x.turno.uuid, { instante: x.instante, turno: x.turno });
  }
  return [...out.values()].sort((a, b) => a.instante - b.instante);
}
const ultimoCompletado = (lineas: readonly LineaChat[]) => completadosDelChat(lineas).at(-1) ?? null;

/** El instante del último «Ya está» que escribió el chat, aunque después haya escrito otra cosa. null = ninguno.
 *  ⚠️ «Aunque después»: es la regla de Martín del 18/10/2026 (tests/centro-ya-visto.test.ts), el «Completado» no se va hasta su ✓.
 *  Lo que le faltaba el 22/10 era VERLO al entrar: la fila decía «Espera tu respuesta» y el «Ya está» quedaba tapado por lo
 *  que el chat escribió después. Ahora la fila dice «Completado», lo de otros chats va plegado y el hilo va a él (`yaEstaSinVer`). */
export function ultimoYaEsta(lineas: readonly LineaChat[]): number | null {
  return ultimoCompletado(lineas)?.instante ?? null;
}

/** El turno del último «Ya está» si todavía no tiene su ✓ (`visto`: el instante del ✓ de este chat): adonde va el hilo al abrir
 *  el chat (Conversacion.tsx). null = no hay, o ya lo vio. */
export function yaEstaSinVer(lineas: readonly LineaChat[], visto: number | null | undefined): string | null {
  return completadoSinVer(lineas, visto)?.uuid ?? null;
}

/** El turno del último «Ya está» si todavía no tiene su ✓: el que hace que la fila diga «Completado», y el que va en el bloque
 *  de arriba de la caja (app/admin/operaciones/BloqueCompletado.tsx, 25/10/2026). null = no hay, o ya lo vio. */
export function completadoSinVer(lineas: readonly LineaChat[], visto: number | null | undefined): TurnoChat | null {
  const u = ultimoCompletado(lineas);
  return u && !tieneCheck(u.instante, visto) ? u.turno : null;
}

/** Cuántos «Completado» sin ver muestra el bloque, como mucho (los más nuevos). Los de antes no se pierden: el ✓ es «hasta
 *  éste», así que darle el ✓ al primero que se ve también se lo pone a ellos. */
export const MAX_COMPLETADOS_EN_BLOQUE = 8;

/** Los «Ya está» del chat que esperan el ✓, del más viejo al más nuevo (los últimos `max`): el bloque de arriba de la caja los
 *  muestra de a uno, con las flechas de las preguntas (25/10/2026, Martín: «si tengo varios "completados" pendientes, para eso
 *  ya tenemos la opción de "espera tu respuesta" tipo modular... con las flechitas»). El último es `completadoSinVer`. */
export function completadosSinVer(lineas: readonly LineaChat[], visto: number | null | undefined, max = MAX_COMPLETADOS_EN_BLOQUE): TurnoChat[] {
  return completadosDelChat(lineas).filter((x) => !tieneCheck(x.instante, visto)).slice(-max).map((x) => x.turno);
}

/**
 * Cuántos de los últimos mensajes dibujar para que entre ese turno (el «Ya está» sin su ✓), con `margen` de antes como contexto;
 * null si no está. Sobre la conversación que dibuja el hilo (`lineasDeConversacion`). Antes se dibujaba TODO el historial para
 * llegar a él (22/10/2026), y con un chat largo eso era un render de segundos al entrar al Ops Center (23/10/2026).
 */
export function tandaHasta(lineas: readonly LineaChat[], uuid: string, margen = 5): number | null {
  const conv = lineasDeConversacion(lineas);
  const i = conv.findIndex((l) => l.tipo === 'turno' && l.turno.uuid === uuid);
  return i < 0 ? null : conv.length - i + margen;
}

/** ¿El chat espera el ✓ de Martín? Sin saber qué tiene ✓ (`vistos` null, antes de leer), no avisa: nada de parpadeos. */
export function esperaCheck(ultimo: number | null, vistos: YaVistos | null, clave: string): boolean {
  if (ultimo == null || !vistos || ultimo < YA_VISTOS_DESDE) return false;
  return ultimo > (vistos[clave] ?? 0);
}

/** ¿Este «Ya está» ya tiene su ✓? Los de antes de `YA_VISTOS_DESDE`, sí. */
export const tieneCheck = (instante: number, visto: number | null | undefined): boolean =>
  instante < YA_VISTOS_DESDE || instante <= (visto ?? 0);

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
  const completados = new Set(completadosDelChat(lineas).map((x) => x.turno.uuid));
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
      if (l.turno.rol === 'el' && completados.has(l.turno.uuid)) {
        const titulo = renglon(l.turno.texto).replace(/^[\s*_#>✅✔·\-–—]*ya est[áa][\s*_.:!,;\-–—]*/i, '').trim();
        ver({ texto: titulo || 'Completado', propio: false, tick: null, instante: l.instante, ya: true });
      } else if (!(l.turno.rol === 'yo' && l.turno.trabajo) && esParaMartin(l.turno)) {
        // Lo que un chat le dijo a otro no es «lo último que pasó» para Martín (22/10/2026, `esParaMartin`).
        // Una captura sola, sin texto (20/10/2026): la fila dice «Foto» o «Archivo», como WhatsApp.
        const solo = l.turno.adjuntos?.length ? (l.turno.adjuntos.every((a) => a.mime.startsWith('image/')) ? 'Foto' : 'Archivo') : '';
        ver({ texto: renglon(l.turno.texto) || solo, propio: l.turno.rol === 'yo', tick: null, instante: l.instante });
      }
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
 * ¿Se le puede mandar ahora a este chat, sabiendo que lo va a recibir? ⚠️ `envio.puede` NO LO DICE: `comoSale` devuelve `espera: 'cartero'`
 * ANTES de mirar el estado, así que sin Runner un chat cerrado «puede». Y con la foto vieja, `abierto` es de hace rato. La usan los
 * que ofrecen o eligen un chat por lo que está abierto (CartelLimbo.tsx, useCentro.ts → mandarDelLimbo). Puede salir con `espera: 'cartero'`: el
 * chat está abierto y falta el Runner, que es otra cosa. Para la bandeja de tickets, `chatCerrado`.
 */
export const chatRecibe = (c: Pick<ChatCentro, 'estado' | 'viejo'>, envio: Envio): boolean =>
  envio.puede && envio.espera !== 'chat_cerrado' && !chatCerrado(c) && !c.viejo;

/** ¿El estado de este chat no dice que esté abierto? Vale también con la foto vieja y con `sin_dato`. */
export const chatCerrado = (c: Pick<ChatCentro, 'estado'>): boolean => c.estado !== 'abierto' && c.estado !== 'trabajando';

/**
 * Cuándo dio la PC su última vuelta, si NO da ninguna ahora: el estado de los chats es una foto de ese momento (Martín, 17/10/2026:
 * «aparecen todos los chats como que no están haciendo nada, cuando no es así»; el Runner se había caido con la app). null = alguna
 * llega, o no llegó nunca: no hay nada que avisar. ⚠️ Es la pregunta de la PC, no la del Runner: con el servicio, la PC da noticias sin Runner.
 */
export function sinNoticiasDesde(carteros: readonly Pick<CarteroP, 'vistoAt' | 'noticiasAt'>[], ahora: number): number | null {
  if (!carteros.length || carteros.some((k) => carteroVivo({ vistoAt: noticiaDe(k) }, ahora))) return null;
  const vistos = carteros.map((k) => fecha(noticiaDe(k))).filter((t): t is number => t != null);
  return vistos.length ? Math.max(...vistos) : null;
}

// ── El estado de la PC, en el Uso (30/10/2026; 31/10, adentro del panel) ────────────────────────────────────────
// El Runner estuvo parado del 24/10 al 30/10 y nadie se enteró. La ausencia la dice MaKo con sus propios datos, porque lo que depende de la
// PC calla justo cuando la PC no está. Iba como un cartel rojo arriba del Ops Center, y Martín lo pidió en otro lugar: «Si, ponlo pero en
// USO». Se consulta cuando se quiere saber, no interrumpe.
// ⚠️ DICE EL HECHO CON SU EDAD, NO LA CONCLUSIÓN: «Sin noticias de la PC desde las 17:20», nunca «no responde» (31/10/2026: con la PC prendida
//    salió «no responde», porque la tolerancia era menor que el intervalo de las vueltas).

/** `cuenta`: la del pedido más viejo, la que hay que abrir primero. */
export type EstadoPc =
  | { tipo: 'al_dia'; desde: number; texto: string; hacer: null }
  | { tipo: 'sin_noticias'; desde: number; cuenta: string | null; texto: string; hacer: string }
  | { tipo: 'sin_runner'; desde: number | null; pedidos: number; masViejo: number | null; cuenta: string | null; texto: string; hacer: string };

/** «las 23:47» hoy, «ayer a las 23:47» o «el 24 oct a las 23:47»: una hora sola, de hace días, miente. */
function cuandoFue(t: number, ahora: number): string {
  const dia = rotuloDia(t, ahora);
  if (dia === 'Hoy') return `las ${horaAR(t)}`;
  return `${dia === 'Ayer' ? 'ayer' : `el ${dia}`} a las ${horaAR(t)}`;
}

/**
 * Uno solo, o ninguno. La PC sin ninguna vuelta reciente → «sin noticias». Con vueltas (el servicio sube) y ningún Runner → «sin Runner», con
 * los pedidos en «escrito». Con un Runner dando vueltas → al día, con su edad. null = una PC que nunca dio noticias.
 * ⚠️ Cuenta TODOS los «escrito», también los de un chat abierto y los de un chat nuevo: sin Runner no sale ninguno.
 */
export function estadoDeLaPc(
  carteros: readonly Pick<CarteroP, 'vistoAt' | 'noticiasAt'>[],
  pedidos: readonly { estado: string; created_at: string; destino_cuenta: string | null }[],
  ahora: number,
): EstadoPc | null {
  if (!carteros.length) return null;
  const esperan = pedidos.filter((p) => p.estado === 'escrito' && Number.isFinite(Date.parse(p.created_at)))
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const cuenta = esperan.find((p) => !!p.destino_cuenta && CUENTA_RE.test(p.destino_cuenta))?.destino_cuenta ?? null;
  const runner = `el Runner${cuenta ? ` de la cuenta ${cuenta.replace(/^claude/, '')}` : ''}`;
  const desde = sinNoticiasDesde(carteros, ahora);
  if (desde != null) {
    return { tipo: 'sin_noticias', desde, cuenta, texto: `Sin noticias de la PC desde ${cuandoFue(desde, ahora)}`, hacer: `Mira si está prendida y abre ${runner}.` };
  }
  if (!carteros.some((k) => carteroVivo({ vistoAt: noticiaDe(k) }, ahora))) return null; // Nunca llegó nada: es una PC sin conectar.
  if (carteros.some((k) => carteroVivo(k, ahora))) {
    const ultima = Math.max(...carteros.map((k) => fecha(noticiaDe(k)) ?? 0));
    return { tipo: 'al_dia', desde: ultima, texto: `La PC dio noticias ${hace(ultima, ahora)}`, hacer: null };
  }
  const n = esperan.length;
  const masViejo = n ? Date.parse(esperan[0].created_at) : null;
  const edad = masViejo != null ? haceCuanto(ahora - masViejo) : '';
  const cuantos = !n ? '' : n === 1 ? `: 1 pedido tuyo espera (de ${edad})` : `: ${n} pedidos tuyos esperan (el más viejo, de ${edad})`;
  const vistos = carteros.map((k) => fecha(k.vistoAt)).filter((t): t is number => t != null);
  const ultimoRunner = vistos.length ? Math.max(...vistos) : null;
  return { tipo: 'sin_runner', desde: ultimoRunner, pedidos: n, masViejo, cuenta, texto: `Sin Runner${ultimoRunner != null ? ` desde ${cuandoFue(ultimoRunner, ahora)}` : ''}${cuantos}`, hacer: `Abre ${runner}.` };
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
    // ⚠️ Dice lo que se sabe, no lo que se supone (31/10/2026): con la PC prendida salió «no responde», y una mentira en esta pantalla cuesta más que el silencio.
    if (pc != null) return `Sin noticias de la PC desde las ${horaAR(pc)}: puede estar dormida.`;
    const visto = fecha(suyo?.vistoAt);
    return visto != null ? `Sin noticias del Runner de la cuenta ${n} desde las ${horaAR(visto)}: ábrelo para que salga.` : `Abre el Runner de la cuenta ${n} para que salga.`;
  }
  const estado = chat?.estado ?? (subido ? (subido.vivo ? 'abierto' : 'cerrado') : 'sin_dato');
  if (estado !== 'trabajando' && estado !== 'abierto') return `Abre este chat en la cuenta ${n} para que lo reciba.`;
  if (chat?.sinRunner || subido?.runner === false) return `Abre el Runner de la cuenta ${n} para que salga.`;
  return null;
}

/**
 * ¿Contestar esta pregunta firmaría hacia un chat cerrado? (30/10/2026) Lo dice ANTES de firmar: la tarjeta lo muestra y
 * `contestarPregunta` no sale. Una respuesta a un chat cerrado se quedaba `escrito` hasta vencer, sin que nadie se enterara. Mira la
 * SESIÓN de la pregunta, no el chat: un chat del Centro junta sesiones de varias cuentas, y puede estar abierto en otra.
 * Con la cuenta sin noticias, no se sabe (`vivo` es de la última vuelta): null, como `comoSale`. null = sale.
 */
export function preguntaDeChatCerrado(
  local: string, cuenta: string | null, carteros: readonly Pick<CarteroP, 'cuenta' | 'vistoAt' | 'noticiasAt' | 'chats'>[], ahora: number,
): string | null {
  // `vivo` es de la última vuelta de cualquiera: lo que importa es que la foto esté al día, no que haya un Runner.
  if (comoEstaElDestino(local, cuenta, carteros, ahora) !== 'cerrado') return null;
  if (!carteros.some((k) => k.cuenta === cuenta && fotoAlDia(k, ahora))) return null;
  const n = cuenta?.replace(/^claude/, '');
  return `Este chat está cerrado: ábrelo${n ? ` en la cuenta ${n}` : ''} para contestarle.`;
}

/**
 * El chat está trabado en una pregunta de la app de Claude (un AskUserQuestion abierto, `preguntasDeLaApp`): mientras espera
 * no le entra ningún mensaje (medido el 22/10 en 27 casos), y desde el Ops Center no se contesta. Lo dice EN EL ACTO, sin
 * esperar `TARDA_MS`: es lo que pasó el 24/10, cuando Martín escribió desde el teléfono, no pasó nada y concluyó «no se envió».
 */
export const POR_QUE_TRABADO = 'El chat espera que contestes su pregunta en la app de Claude, en la computadora: hasta entonces no lee este mensaje.';

/** Cuándo dio la última vuelta la PC de la cuenta de ese trabajo (`vistoAt` de su cartero). null = no se sabe. */
function ultimaVuelta(
  w: Pick<TrabajoP, 'destino' | 'destino_cuenta'>,
  carteros: readonly Pick<CarteroP, 'cuenta' | 'vistoAt' | 'chats'>[],
): number | null {
  const subido = carteros.flatMap((k) => k.chats.map((c) => ({ ...c, cuenta: c.cuenta ?? k.cuenta }))).find((c) => c.local === w.destino);
  const cuenta = subido?.cuenta ?? w.destino_cuenta;
  return fecha(carteros.find((k) => k.cuenta === cuenta)?.vistoAt);
}

/**
 * La línea de estado de un trabajo del Centro, debajo de su burbuja: «Enviado» o «La PC lo recibió», y por qué tarda si
 * tarda. null = ya lo tiene el chat (los ✓✓ lo dicen, y «Trabajando…» va al pie de la conversación: `chatTrabajando`), o
 * terminó, o no salió (eso lo dice su nota roja). `trabado`: el chat tiene abierta una pregunta de la app de Claude.
 * ⚠️ Sin nada que lo frene, NO promete segundos (24/10/2026): la PC lo toma en su vuelta, que puede ser de minutos; se dice
 * cuándo fue la última.
 */
export function estadoDelEnvio(
  w: Pick<TrabajoP, 'destino' | 'destino_cuenta' | 'created_at' | 'estado'>,
  chat: Pick<ChatCentro, 'estado' | 'viejo' | 'sinRunner'> | null,
  carteros: readonly Pick<CarteroP, 'cuenta' | 'vistoAt' | 'chats' | 'cuota'>[],
  ahora: number,
  trabado = false,
): EstadoDelEnvio | null {
  const estado = w.estado ?? 'escrito';
  if (estado !== 'escrito' && estado !== 'tomado') return null;
  const desde = fecha(w.created_at) ?? ahora;
  const fase: FaseEnvio = estado === 'escrito' ? 'enviado' : 'recibido';
  const texto = estado === 'escrito' ? 'Enviado' : 'La PC lo recibió';
  if (trabado) return { fase, texto, porQue: POR_QUE_TRABADO };
  if (estado === 'escrito') {
    if (ahora - desde <= TARDA_MS) return { fase, texto, porQue: null };
    const vuelta = ultimaVuelta(w, carteros);
    return { fase, texto, porQue: porQueTarda(w, chat, carteros, ahora) ?? (vuelta != null ? `La PC lo toma en su próxima vuelta (la última, a las ${horaAR(vuelta)}).` : 'La PC lo toma en su próxima vuelta.') };
  }
  return { fase, texto, porQue: ahora - desde > TARDA_TOMADO_MS ? porQueTarda(w, chat, carteros, ahora) ?? 'El Runner se lo está pasando al chat.' : null };
}

/**
 * ¿Va «Trabajando…» al pie de la conversación? Sí si el Runner lo ve ocupado AHORA (no una foto vieja), o si el último
 * trabajo se le entregó hace poco y todavía no contestó: el estado ocupado llega con la vuelta completa del Runner, y entre
 * una cosa y la otra la pantalla no puede quedar callada.
 */
export function chatTrabajando(chat: Pick<ChatCentro, 'estado' | 'viejo'>, lineas: readonly LineaChat[], ahora: number): boolean {
  if (chat.estado === 'trabajando' && !chat.viejo) return true;
  // Terminó su turno con trabajo de FONDO vivo (cartero 1.21.0, `fondo`) y nadie le escribió después: sigue trabajando.
  const ultima = [...lineas].sort((a, b) => a.instante - b.instante).at(-1);
  if (ultima?.tipo === 'turno' && ultima.turno.rol === 'el' && ultima.turno.fondo && ahora - ultima.instante < FONDO_VIVO_MS) return true;
  const trabajos = lineas.filter((l): l is Extract<LineaChat, { tipo: 'trabajo' }> => l.tipo === 'trabajo');
  const ultimo = trabajos[trabajos.length - 1]?.trabajo;
  if (!ultimo || ultimo.estado !== 'entregado' || ultimo.cierre) return false;
  const entregado = fecha(ultimo.entregado_at ?? null);
  if (entregado == null || ahora - entregado > RECIEN_ENTREGADO_MS) return false;
  return !lineas.some((l) => l.tipo === 'turno' && l.turno.rol === 'el' && l.instante > entregado);
}

/** Copia de `FONDO_VIVO_MS` del cartero: una tarea de fondo que no avisó en tantas horas ya no cuenta. */
export const FONDO_VIVO_MS = 3 * 60 * 60 * 1000;

/**
 * Lo TERMINADO que dice un «Completado» cuando el turno no trae el resumen de su wrap_up (27/10/2026, Martín: «El cuadro de
 * COMPLETADO debe ser dopamínico: se completó una funcionalidad, se debuggeó A, B, C»): el «hecho» del cierre del trabajo que
 * respondía (`cartero cierre --hecho`), si se cerró en ese tramo. null = no hay.
 */
export function hechoDelCompletado(lineas: readonly LineaChat[], ya: Pick<TurnoChat, 'at'>): string | null {
  const hasta = Date.parse(ya.at);
  const desde = desdeDelTramo(lineas, hasta);
  let mejor: { t: number; hecho: string } | null = null;
  for (const l of lineas) {
    if (l.tipo !== 'trabajo' || !l.trabajo.cierre) continue;
    const t = fecha(l.trabajo.cerrado_at ?? null);
    const hecho = (l.trabajo.cierre.hecho || '').trim();
    // Cerrado en el tramo: después del Completado de antes, y hasta 10 minutos después de éste (el cierre llega por otro camino).
    if (t == null || !hecho || t <= desde || t > hasta + 10 * 60_000) continue;
    if (!mejor || t > mejor.t) mejor = { t, hecho };
  }
  return mejor?.hecho ?? null;
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

/**
 * ¿Duerme? Sin actividad hace `DIAS_DORMIDO` días y sin estar trabajando AHORA (10/11/2026, Martín: «se están creando una cantidad de
 * chats impresionante»; ese día la cuenta 1 tenía 178 chats y 93 con actividad en tres días). Un chat dormido sale de la lista (se
 * encuentra buscándolo) y lo que preguntó no espera a Martín: no sale en el bloque ni sube el globito. La actividad es la de la app,
 * su último hito o lo último que se le mandó (`completarChats`): escribirle lo despierta.
 */
export const DIAS_DORMIDO = 3;
export const chatDormido = (c: Pick<ChatCentro, 'estado' | 'viejo' | 'actividad'>, ahora: number): boolean =>
  !(c.estado === 'trabajando' && !c.viejo) && (c.actividad == null || ahora - c.actividad >= DIAS_DORMIDO * 86_400_000);

/**
 * Lo que espera a Martín en cada sesión, SIN los chats dormidos (`chatDormido`, 10/11/2026): sus preguntas viejas no suben el globito
 * ni dicen «Espera tu respuesta». El Cerebro nunca duerme. Devuelve el MISMO objeto si no sacó nada.
 */
export function esperasSinDormidos(esperas: Readonly<Record<string, number>>, chats: readonly ChatCentro[], ahora: number): Readonly<Record<string, number>> {
  let out: Record<string, number> | null = null;
  for (const c of chats) {
    if (esCerebro(partesDelNombre(c.titulo).jefe) || !chatDormido(c, ahora)) continue;
    for (const k of c.miembros) {
      if (!(k in esperas)) continue;
      out ??= { ...esperas };
      delete out[k];
    }
  }
  return out ?? esperas;
}

/** ¿Va en la lista? Lo que no duerme, el Cerebro y el chat que se está mirando (10/11/2026). Buscando, todo. */
export const vaEnLaLista = (c: ChatCentro, ahora: number, actual: string | null, buscando: boolean): boolean =>
  buscando || c.clave === actual || esCerebro(partesDelNombre(c.titulo).jefe) || !chatDormido(c, ahora);

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

/** Cuántas cosas esperan a Martín en un chat (sus preguntas sin contestar y un «Completado» sin ✓): lo que lo sube en la lista. */
export type AvisosDe = (c: ChatCentro) => number;
/** Cuántas preguntas suyas esperan a Martín en un chat, SIN el «Completado»: lo que dice «Espera tu respuesta» y va PRIMERO. */
export type EsperasDe = (c: ChatCentro) => number;

/**
 * El lugar de un chat en la lista. Martín, 17/10/2026: «que los chats trabajando siempre estén arriba... Y los que tienen
 * notificaciones también». Y el 24/10/2026, 23:39: «el tema de los chats de MaKo cuando tienen [...] un espera tu respuesta
 * deberían posicionarse arriba porque había muchos que estaban abajo y yo no los veo». Así: 0 = espera su respuesta (una
 * pregunta abierta), 1 = trabaja AHORA (no una foto vieja), 2 = un «Completado» sin ✓, 3 = el resto. Sin `esperas` (quien no
 * las distingue de un «Completado») no hay 0: lo de antes.
 */
export function prioridadEnLista(c: ChatCentro, avisos?: AvisosDe, esperas?: EsperasDe): 0 | 1 | 2 | 3 {
  if (esperas && esperas(c) > 0) return 0;
  if (c.estado === 'trabajando' && !c.viejo) return 1;
  return avisos && avisos(c) > 0 ? 2 : 3;
}
/** Lo que trabaja o espera a Martín nunca queda escondido detrás de «Mostrar más». */
export const esPrioritario = (c: ChatCentro, avisos?: AvisosDe, esperas?: EsperasDe) => prioridadEnLista(c, avisos, esperas) < 3;

/** Una lista en el orden de `prioridadEnLista`: lo que espera su respuesta y el resto, de lo más reciente a lo más viejo; lo que
 *  trabaja y los «Completado», en el orden en que llegan. */
function enOrdenDeLista(chats: readonly ChatCentro[], avisos?: AvisosDe, esperas?: EsperasDe): ChatCentro[] {
  const porActividad = (p: number) => p === 0 || p === 3;
  return chats
    .map((c, i) => ({ c, i, p: prioridadEnLista(c, avisos, esperas) }))
    .sort((a, b) => a.p - b.p || (porActividad(a.p) ? (b.c.actividad ?? 0) - (a.c.actividad ?? 0) : 0) || a.i - b.i)
    .map((x) => x.c);
}

/**
 * Las secciones de la barra: el Cerebro arriba y fijo, y UNA lista con los demás (17/10/2026, Martín: «No entiendo el
 * desplegable de "Sin asignar", no tiene sentido, elimínalo»). Adentro, primero los que esperan su respuesta, después los que
 * trabajan, después los «Completado» y el resto por actividad (`prioridadEnLista`); los sub-chats van con su jefe (`porJefe`),
 * que sube con el primero de los suyos. Los del Cerebro, con el mismo orden debajo de él.
 * ⚠️ Un chat que no se llama como una tab ya no va aparte: está en la lista, y renombrándolo pasa a su jefe.
 */
export function seccionesDeChats(chats: readonly ChatCentro[], avisos?: AvisosDe, esperas?: EsperasDe): SeccionChats[] {
  // ⚠️ LOS SUB-CHATS DEL CEREBRO VAN CON ÉL (23/10/2026, Martín: «a veces cambian los chats»). «Cerebro › Integración» no se llama
  // «Cerebro»: quedaba en la otra lista, donde `porJefe` le armaba un grupo SIN su fila jefe y el teléfono lo dibujaba suelto
  // («↳ Integración») debajo de lo que tocara arriba, que esa vez era «Integraciones». El Cerebro primero, sus sub-chats debajo.
  const delCerebro = (c: ChatCentro) => esCerebro(partesDelNombre(c.titulo).jefe);
  const cerebro = chats.filter((c) => esCerebro(c.titulo)).concat(enOrdenDeLista(chats.filter((c) => delCerebro(c) && !esCerebro(c.titulo)), avisos, esperas));
  const resto = enOrdenDeLista(chats.filter((c) => !delCerebro(c)), avisos, esperas);
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
/** Lo que sigue al «Ya está» empieza con mayúscula: sin el «Ya está:» de adelante, «traer de un grupo…» se leía cortado (25/10/2026,
 *  medido en el «Completado» de Offer). Sólo una letra: un `código` o un **formato** de adelante quedan como están. */
const conMayuscula = (s: string): string => s.replace(/^\p{Ll}/u, (c) => c.toLocaleUpperCase('es'));
const PREFIJO_YA_ESTA = /^[\s>#✅✔·\-–—]*(\*\*|__|\*|_)?[\s>#✅✔·\-–—]*ya est[áa][.:!,;]*(?:\1)?[\s.:!,;\-–—]*/i;

/** Hasta cuántos caracteres un primer renglón se dibuja como TÍTULO de la tarjeta; más largo es un párrafo. */
export const TITULO_YA_ESTA = 110;
/** Desde cuántos caracteres el cuerpo de un «Completado» se puede plegar (sólo si tiene una cola que queda a la vista). */
export const CUERPO_PLEGABLE = 1500;
/** Cuánto detalle tiene que haber antes de la cola para que valga la pena plegarlo. */
const DETALLE_PLEGABLE = 600;
/** Arriba de la caja (BloqueCompletado.tsx) el «Completado» va más corto: desde acá se pliega a su resumen y se abre tocándolo
 *  (25/10/2026, Martín: «achica el mensaje y hazlo más claro»), con su cola a la vista desde `DETALLE_PLEGABLE_EN_BLOQUE`. */
export const CUERPO_PLEGABLE_EN_BLOQUE = 500;
export const DETALLE_PLEGABLE_EN_BLOQUE = 200;

/**
 * El «Completado» partido para dibujarlo ENTERO (17/10/2026, Martín: «tienen 3 puntos al final y no llego a leer todo, esos
 * son los mensajes más importantes que me permiten revisar y dar feedback»). El título de la FILA de Review/lista es
 * `tituloDeTexto` (72 caracteres y «…»): servía para una lista y se usaba también en la tarjeta, donde el resto del primer
 * renglón se perdía. Acá el título es el primer renglón COMPLETO si cabe como título; si no cabe (un párrafo), no hay título
 * y ese renglón va primero en el cuerpo, entero. Nunca se corta ni se agrega «…».
 */
export function partesDeYaEsta(texto: string): { titulo: string | null; cuerpo: string } {
  const lineas = texto.trim().split('\n');
  const resto = conMayuscula((lineas[0] ?? '').replace(PREFIJO_YA_ESTA, '').trim());
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
export function partirPendiente(cuerpo: string, desde = CUERPO_PLEGABLE, detalleMinimo = DETALLE_PLEGABLE): { detalle: string; cola: string } | null {
  if (cuerpo.length <= desde) return null;
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
  if (detalle.length < detalleMinimo || !cola) return null;
  return { detalle, cola };
}

/** ¿La PC cortó este turno al subirlo? Un cartero de antes de la 1.19.0 cortaba a `TOPE_TURNO_VIEJO` (4000); desde esa, sólo el
 *  tope técnico (`TOPE_TURNO`). Lo cortado no llega, sin avisar.
 *  ⚠️ No se AVISA en pantalla (25/10/2026, Martín: «que no haya nunca un limite de caracteres, en todo caso achica el mensaje»):
 *  el «Completado» largo va plegado a su resumen, y uno cortado termina en «…» (Avance.tsx). */
export const cortadoPorLaPC = (texto: string): boolean => texto.length === TOPE_TURNO_VIEJO || texto.length >= TOPE_TURNO;

/** Lo que respondió un «Completado»: el texto, y quién se lo pidió (null = Martín; si no, el chat que se lo mandó). */
export type PedidoDelCompletado = { texto: string; de: string | null };

/** El nombre del chat que mandó un mensaje, para leerlo: el cartero lo trae de la etiqueta del mensaje, a veces con el «›» del
 *  jefe y su sub-chat convertido en espacios («Cerebro   Integración»). */
export const nombreDeOtroChat = (de: string | null): string => de?.trim().replace(/\s{2,}/g, ' › ') || 'Otro chat';

/**
 * Lo que respondió ese «Completado» (25/10/2026, Martín: «Por ejemplo dice "no, no era todo." si no pones antes cual fue mi
 * prompt no se entiende... Podrias ponerlo con mi foto de perfil allí para que se entienda que fue mio y ahí la respuesta»).
 * En el TRAMO que cierra (desde el «Ya está» de antes del chat):
 *   1. lo último que le dijo Martín: un turno suyo (en la app o por la caja) o un trabajo firmado del Ops Center. Un turno que
 *      trajo un trabajo no cuenta: ese trabajo ya está, con su texto;
 *   2. si Martín no le dijo nada, lo último que le mandó OTRO chat (`otro`, el Cerebro casi siempre), con su nombre;
 *   3. si nadie le dijo nada (un segundo «Ya está» de lo mismo), lo último de Martín de antes.
 * ⚠️ MEDIDO EL 25/10/2026 en producción: el «Completado» de Offer respondía a Integración y no tenía pedido, porque sólo se
 *    buscaba lo de Martín; casi todo lo que hacen los chats se lo manda el Cerebro. null = no hay nada antes.
 */
export function pedidoDelCompletado(lineas: readonly LineaChat[], ya: Pick<TurnoChat, 'at'>): PedidoDelCompletado | null {
  const hasta = Date.parse(ya.at);
  const desde = desdeDelTramo(lineas, hasta);
  let martin: { instante: number; texto: string } | null = null;
  let otro: { instante: number; texto: string; de: string | null } | null = null;
  for (const l of lineas) {
    if (!(l.instante < hasta)) continue;
    const suyo = deMartin(l);
    if (suyo && (!martin || l.instante > martin.instante)) martin = { instante: l.instante, texto: suyo };
    if (l.tipo === 'turno' && l.turno.rol === 'otro' && l.instante > desde && l.turno.texto.trim() && (!otro || l.instante > otro.instante)) {
      // El encargo con el que abrieron el chat (27/10/2026): su tarea, no el «Background…» de arriba.
      otro = { instante: l.instante, texto: l.turno.encargo ? textoDelEncargo(l.turno.texto) : l.turno.texto.trim(), de: l.turno.de };
    }
  }
  if (martin && martin.instante > desde) return { texto: martin.texto, de: null };
  if (otro) return { texto: otro.texto, de: nombreDeOtroChat(otro.de) };
  return martin ? { texto: martin.texto, de: null } : null;
}

/** Dónde empieza el tramo que cierra un «Ya está»: el «Ya está» de antes del chat (-Infinity = no hay). */
function desdeDelTramo(lineas: readonly LineaChat[], hasta: number): number {
  let desde = -Infinity;
  for (const x of completadosDelChat(lineas)) if (x.instante < hasta && x.instante > desde) desde = x.instante;
  return desde;
}
/** Lo que dijo Martín en una línea: un turno suyo (en la app o por la caja) o un trabajo firmado. Un turno que trajo un trabajo
 *  no cuenta: ese trabajo ya está, con su texto. '' = no es suyo. */
const deMartin = (l: LineaChat): string =>
  (l.tipo === 'turno' && l.turno.rol === 'yo' && !l.turno.trabajo ? l.turno.texto : l.tipo === 'trabajo' ? l.trabajo.texto ?? '' : '').trim();

/** Cuántos mensajes de Martín muestra como mucho un «Completado»: los últimos de su tramo. */
export const TOPE_PEDIDOS_DEL_COMPLETADO = 4;

/**
 * TODO lo que le dijo Martín en el tramo que cierra ese «Completado», del más viejo al más nuevo, cada uno por su lado (26/10/2026,
 * Martín: «si necesitas poner más de 1 mensaje mio, para que se entienda el contexto, hazlo. No todo en el mismo mensaje, sino
 * varias cajitas de mensaje con mi foto de perfil»). Los últimos `TOPE_PEDIDOS_DEL_COMPLETADO`. Si Martín no le dijo nada en
 * el tramo, lo de `pedidoDelCompletado` (lo de otro chat, o lo último de Martín de antes): uno solo, o ninguno.
 */
export function pedidosDelCompletado(lineas: readonly LineaChat[], ya: Pick<TurnoChat, 'at'>): PedidoDelCompletado[] {
  const hasta = Date.parse(ya.at);
  const desde = desdeDelTramo(lineas, hasta);
  const suyos = lineas.filter((l) => l.instante > desde && l.instante < hasta).sort((a, b) => a.instante - b.instante).map(deMartin).filter(Boolean);
  if (suyos.length) return suyos.slice(-TOPE_PEDIDOS_DEL_COMPLETADO).map((texto) => ({ texto, de: null }));
  const uno = pedidoDelCompletado(lineas, ya);
  // Lo relevó otro chat (el Cerebro casi siempre): si trae el prompt de Martín textual, va ESE, con su foto.
  const citados = uno?.de ? promptsDeMartin(uno.texto) : [];
  if (citados.length) return citados.slice(-TOPE_PEDIDOS_DEL_COMPLETADO).map((texto) => ({ texto, de: null }));
  return uno ? [uno] : [];
}

/** «textual:», «textuales:» o «textualmente», que es como el Cerebro presenta lo que dijo Martín (memoria «Los prompts de
 *  Martín… textuales»). */
const TEXTUAL = /textual(?:es|mente)?\b[^«\n]{0,12}/gi;

/** El texto de la cita «…» que abre en `i`, con las de adentro balanceadas (Martín también escribe «»). null = no cierra. */
function citaBalanceada(texto: string, i: number): { texto: string; fin: number } | null {
  let nivel = 0;
  for (let j = i; j < texto.length; j++) {
    if (texto[j] === '«') nivel += 1;
    else if (texto[j] === '»' && --nivel === 0) return { texto: texto.slice(i + 1, j).trim(), fin: j + 1 };
  }
  return null;
}

/**
 * Los prompts de Martín que un relevo trae TEXTUALES (26/10/2026, Martín: «En "completado" de los chats, no pongas "El cerebro me
 * pasó el pedido de martin" pon mi prompt, con mi foto directamente»). El Cerebro los cita así: «…, textual: «el prompt»» o
 * «textuales: 1. «uno» 2. «otro»». Sólo lo que viene pegado a esa palabra (con su número de lista, si lo tiene): las demás
 * comillas del relevo («Completado», el nombre de un botón) no son de Martín. [] = el relevo no trae nada textual.
 */
export function promptsDeMartin(texto: string): string[] {
  const out: string[] = [];
  for (const m of texto.matchAll(TEXTUAL)) {
    let i = (m.index ?? 0) + m[0].length;
    for (;;) {
      const salto = /^(?:\s|\d{1,2}[.)]|[-•*]|y\b)*/.exec(texto.slice(i))?.[0].length ?? 0;
      if (texto[i + salto] !== '«') break;
      const c = citaBalanceada(texto, i + salto);
      if (!c) break;
      if (c.texto) out.push(c.texto);
      i = c.fin;
    }
  }
  return [...new Set(out)];
}

/** Los «Ya está» de la conversación de un chat, como hechos de Review (lo más nuevo arriba lo ordena `porRevisar`). */
export function yaEstaDelChat(lineas: readonly LineaChat[]): NodoAvance[] {
  return completadosDelChat(lineas).map((x) => nodoDeCompletado(x.turno, x.instante));
}

/** Un «Completado» como hecho de Review: su título, su texto y la página que dejó. Para el turno que YA se sabe que es uno
 *  (`completadosDelChat`): el de la tarjeta del hilo, el del bloque de arriba de la caja y el de la API. */
export function nodoDeCompletado(turno: TurnoChat, instante: number): NodoAvance {
  const t = turno.texto.trim();
  // El título es lo que sigue al «Ya está» (o «Ya está», si no dijo más). Un cierre que no empieza así, su primer renglón.
  const resto = conMayuscula(t.replace(PREFIJO_YA_ESTA, '').trim());
  const ruta = rutaDeYaEsta(t);
  return {
    id: `y:${turno.uuid}`, origen: 'ya_esta', titulo: resto ? tituloDeTexto(resto) : 'Ya está', prompt: t, instante,
    estado: 'hecho', cuentas: [], pasos: [], commits: [], trabajaron: [], cierre: t, motivo: null,
    revisar: ruta ? { pagina: ruta, sesion: DESTINO_RE.test(turno.local) ? turno.local : null } : null,
  };
}

/**
 * La ruta de la tab que se llama como el jefe de un chat («CRM» para «CRM › Lead Detail», ver `partesDelNombre`):
 * la del primer ítem de `items` con ese nombre, sin mayúsculas ni tildes (la misma comparación que `seccionesDeChats`).
 * null = el jefe no es una tab.
 * ⚠️ El ORDEN de `items` manda, porque un nombre se repite: «CRM» es `/crm` en la barra del cliente y `/admin/dev/crm`
 * en la del super admin. La tab del producto va primero (`[...TODOS_LOS_ITEMS, ...MAKO_NAV, ...ADMIN_NAV]`, como
 * `nombresDeTabs`); con el orden al revés, Review mandaría a la ficha de desarrollo en vez de a la pantalla.
 */
export function rutaDeLaTab(jefe: string, items: ReadonlyArray<{ label: string; href: string; jefe?: string }>): string | null {
  const k = normal(jefe);
  if (!k) return null;
  // El nombre de su JEFE si la fila se llama distinto (nav.ts → `jefe`: el Second Brain de cada negocio se llama «Ops
  // Center» desde el 18/10/2026; sin esto, «Ops Center» caía en /second-brain y «Second Brain» no era una tab).
  const it = items.find((i) => normal(i.jefe ?? i.label) === k);
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
  items: ReadonlyArray<{ label: string; href: string; jefe?: string }>,
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
  decisiones: readonly (Pick<Decision, 'chat' | 'destino' | 'respuesta' | 'ignoradaAt'> & Partial<Pick<Decision, 'pregunta' | 'contexto' | 'opciones'>>)[],
  carteros: readonly Pick<CarteroP, 'cuenta' | 'chats'>[],
): Record<string, number> {
  const chats = carteros.flatMap((k) => k.chats.map((c) => ({ ...c, cuenta: c.cuenta ?? k.cuenta })));
  const out: Record<string, number> = {};
  for (const d of decisiones) {
    // Una ignorada desde el Ops Center (5/11/2026) o una técnica (10/11/2026) no espera a Martín: no sube el globito.
    if (!esperaAMartin(d)) continue;
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
