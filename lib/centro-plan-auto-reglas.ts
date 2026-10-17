// =============================================================================
// El Plan de cada chat se arma solo: «Voy a trabajar en…» crea su tarea y «Ya está» la marca hecha (17/10/2026; puro)
// =============================================================================
// Martín (feedback del 17/10, la C y la D): «Marcar resuelta una tarea o un proyecto cuando algo ya está es AUTOMÁTICO,
// siempre», y «con "Voy a trabajar en…" y "Ya está", el Plan de cada chat se arma solo: no puede haber chats con el Plan
// vacío». Los dos mensajes ya son ley para todo chat (AGENTS.md → «todo trabajo arranca con "Voy a trabajar en…"» y «el
// "Ya está" lo dice cada chat»): acá se leen de lo que dijo (los turnos que sube la PC) y se vuelven una lista por chat,
// con lo que hay que hacer en el Plan. Lo hace el servidor (lib/centro-plan-auto.ts), con las operaciones del Plan de la
// API de MaKo y el actor «MaKo · Ops Center».
//
// LA MÁQUINA, por sesión:
//   · «Voy a trabajar en X» sin una tarea abierta → una tarea nueva, «X» (`pendiente` → `creada` cuando el Plan la crea);
//     con una abierta, nada: es el mismo trabajo que sigue;
//   · «Ya está» → la abierta queda para marcarse hecha (`ya`); sin abierta (el chat no dijo «Voy a…»), se crea y se marca
//     hecha igual: no hay chat con el Plan vacío.
// ⚠️ SE LEE CADA TURNO UNA VEZ: el uuid del turno queda en la tarea (`voy`, `ya`). Una PC que vuelve a subir lo mismo no
//    crea otra.
// ⚠️ SIN `server-only`: lo usan el servidor y la pantalla (la tarjeta del Plan adentro del «Ya está»).

import { esYaEsta, tituloDeTexto } from './centro-chats';
import { DESTINO_RE, type TurnoChat } from './operaciones-reglas';

export type EstadoTareaDelChat = 'pendiente' | 'creada' | 'hecha' | 'no_se_pudo';
export type TareaDelChat = {
  /** La sesión del chat. */
  local: string;
  /** El nombre del chat cuando se anotó: su jefe es el proyecto del Plan (lib/centro-plan-reglas.ts → proyectoDelChat). */
  chat: string;
  titulo: string;
  /** La tarea del Plan, cuando se creó. */
  tarea: string | null;
  /** El turno «Voy a trabajar en…» que la abrió (null: no lo dijo) y el «Ya está» que la cerró. */
  voy: string | null;
  ya: string | null;
  at: string;
  estado: EstadoTareaDelChat;
  /** Cuántas veces el Plan no la pudo crear o cerrar: a la tercera queda `no_se_pudo` y no se reintenta. */
  intentos: number;
  /** El texto del «Ya está» que la anotó SIN un «Voy a trabajar en…» (17/10/2026): con él se buscan primero las tarjetas que
   *  nombra (#870) o cuyo título dice, para cerrar ésas en vez de crear una nueva (lib/centro-plan.ts → cerrarPorYaEsta). */
  yaTexto?: string | null;
  /** Ya se buscaron sus tarjetas y no había: ahora se crea y se marca hecha, como antes. */
  buscada?: boolean;
};
/** Lo que se guarda de un «Ya está» para buscar sus tarjetas (los números y los títulos van arriba). */
export const TOPE_YA_TEXTO = 600;

/** Las que se guardan por chat (las más nuevas). */
export const TAREAS_POR_CHAT = 40;
export const MAX_INTENTOS = 3;

const PRIMERA = (t: string) => t.trim().split('\n')[0] ?? '';
const LIMPIA = /^[\s*_#>✅✔·\-–—]*/;

/** ¿El chat dijo «Voy a trabajar en…»? (el primer renglón, sin el Markdown de adelante). */
export const esVoyATrabajar = (texto: string): boolean => /^voy a trabajar en(?![a-zñáéíóú])/i.test(PRIMERA(texto).replace(LIMPIA, ''));

/** El título de la tarea: lo que sigue a «Voy a trabajar en», corto y sin el punto final. null = no dijo en qué. */
export function tituloDeVoy(texto: string): string | null {
  const resto = PRIMERA(texto).replace(LIMPIA, '').replace(/^voy a trabajar en\s*/i, '').replace(/[*_`]+/g, '').replace(/[.:;,\s]+$/, '').trim();
  return resto ? tituloDeTexto(resto.charAt(0).toUpperCase() + resto.slice(1), 120) : null;
}

/** El título de lo que quedó hecho: lo que sigue al «Ya está» (o «Ya está», si no dijo más). */
export function tituloDeYa(texto: string): string {
  const resto = PRIMERA(texto).replace(LIMPIA, '').replace(/^ya est[áa][\s*_.:!,;\-–—]*/i, '').replace(/[*_`]+/g, '').replace(/[.\s]+$/, '').trim();
  return resto ? tituloDeTexto(resto.charAt(0).toUpperCase() + resto.slice(1), 120) : 'Ya está';
}

/**
 * La lista de un chat después de leer sus turnos nuevos (los de esa sesión, en orden). Pura: no toca el Plan; deja
 * anotado qué falta (`pendiente`: crearla; `creada` con `ya`: marcarla hecha).
 */
export function anotarTurnos(antes: readonly TareaDelChat[], turnos: readonly TurnoChat[], chat: string): TareaDelChat[] {
  const lista = antes.map((t) => ({ ...t }));
  const vistos = new Set(lista.flatMap((t) => [t.voy, t.ya]).filter((x): x is string => !!x));
  const orden = [...turnos].filter((t) => t.rol === 'el' && DESTINO_RE.test(t.local)).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  for (const t of orden) {
    if (vistos.has(t.uuid)) continue;
    const abierta = [...lista].reverse().find((x) => x.local === t.local && !x.ya && x.estado !== 'no_se_pudo');
    if (esVoyATrabajar(t.texto)) {
      const titulo = tituloDeVoy(t.texto);
      if (abierta || !titulo) continue;
      lista.push({ local: t.local, chat, titulo, tarea: null, voy: t.uuid, ya: null, at: t.at, estado: 'pendiente', intentos: 0 });
      vistos.add(t.uuid);
    } else if (esYaEsta(t.texto)) {
      if (abierta) abierta.ya = t.uuid;
      else lista.push({ local: t.local, chat, titulo: tituloDeYa(t.texto), tarea: null, voy: null, ya: t.uuid, at: t.at, estado: 'pendiente', intentos: 0, yaTexto: t.texto.slice(0, TOPE_YA_TEXTO) });
      vistos.add(t.uuid);
    }
  }
  return lista.slice(-TAREAS_POR_CHAT);
}

/**
 * Lo próximo que hay que hacer en el Plan con la lista de un chat: crear una, marcar hecha una creada, o —con un «Ya está»
 * que llegó sin su «Voy a trabajar en…»— BUSCAR primero las tarjetas que nombra y cerrar ésas (17/10/2026: juntar el cierre
 * por «Ya está» del chat Plan con el Plan que se arma solo; sin esto, un «Ya está #870» creaba una tarea nueva y la cerraba,
 * y la #870 quedaba abierta). null = nada.
 */
export function proximoPaso(lista: readonly TareaDelChat[]): { accion: 'crear' | 'cerrar' | 'buscar'; t: TareaDelChat } | null {
  for (const t of lista) {
    if (t.estado === 'pendiente' && !t.voy && t.ya && t.yaTexto && !t.buscada) return { accion: 'buscar', t };
    if (t.estado === 'pendiente') return { accion: 'crear', t };
    if (t.estado === 'creada' && t.ya && t.tarea) return { accion: 'cerrar', t };
  }
  return null;
}

/** La lista con lo que pasó en el Plan con una tarea (por su turno, que es único). */
export function conResultado(lista: readonly TareaDelChat[], t: TareaDelChat, r: { ok: true; tarea?: string | null } | { ok: false } | { buscada: true; cerradas: number }): TareaDelChat[] {
  const misma = (x: TareaDelChat) => x.local === t.local && x.voy === t.voy && x.ya === t.ya && x.at === t.at;
  return lista.map((x) => {
    if (!misma(x)) return x;
    // La búsqueda de sus tarjetas: si cerró alguna, ésa era su tarea (hecha, sin crear otra); si no, se crea como antes.
    if ('buscada' in r) return r.cerradas > 0 ? { ...x, estado: 'hecha', buscada: true, intentos: 0 } : { ...x, buscada: true };
    if (!r.ok) return { ...x, intentos: x.intentos + 1, estado: x.intentos + 1 >= MAX_INTENTOS ? 'no_se_pudo' : x.estado };
    if (x.estado === 'pendiente') return { ...x, tarea: r.tarea ?? null, estado: r.tarea ? 'creada' : 'no_se_pudo', intentos: 0 };
    return { ...x, estado: 'hecha', intentos: 0 };
  });
}

/** Una lista guardada, validada (lo que no tiene forma se descarta). */
export function sanearTareasDelChat(x: unknown): TareaDelChat[] {
  if (!Array.isArray(x)) return [];
  const ESTADOS: readonly EstadoTareaDelChat[] = ['pendiente', 'creada', 'hecha', 'no_se_pudo'];
  return x.flatMap((v): TareaDelChat[] => {
    if (!v || typeof v !== 'object') return [];
    const o = v as Record<string, unknown>;
    const s = (k: string, max: number) => (typeof o[k] === 'string' ? (o[k] as string).slice(0, max) : null);
    const local = s('local', 80); const titulo = s('titulo', 200); const at = s('at', 40); const chat = s('chat', 120);
    if (!local || !DESTINO_RE.test(local) || !titulo || !at || !Number.isFinite(Date.parse(at)) || chat == null) return [];
    const estado = ESTADOS.includes(o.estado as EstadoTareaDelChat) ? o.estado as EstadoTareaDelChat : 'pendiente';
    const yaTexto = s('yaTexto', TOPE_YA_TEXTO);
    return [{
      local, chat, titulo, tarea: s('tarea', 80), voy: s('voy', 80), ya: s('ya', 80), at, estado, intentos: Number.isInteger(o.intentos) ? o.intentos as number : 0,
      ...(yaTexto ? { yaTexto } : {}), ...(o.buscada === true ? { buscada: true } : {}),
    }];
  }).slice(-TAREAS_POR_CHAT);
}

/** Cómo se dice en pantalla en qué está una tarea del chat. */
export const ROTULO_TAREA: Record<EstadoTareaDelChat, string> = {
  pendiente: 'Sumándola al Plan', creada: 'En curso', hecha: 'Hecha', no_se_pudo: 'No entró al Plan',
};
