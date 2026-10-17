// =============================================================================
// El Plan adentro de cada chat jefe — las reglas, sin base y sin React (16/10/2026)
// =============================================================================
// Martín: «Los chats y el Centro deberían poder conectarse con el PLAN... Crear tareas nuevas, marcar como
// completadas, etc». La convención que lo hace posible ya existía: los proyectos del tablero del super admin se llaman
// como una tab (lib/plan-proyectos-catalogo.ts) y los chats jefe también. O sea, cada jefe ES un proyecto del Plan.
//
// ⚠️ EL PROYECTO SE LLAMA «Feature: CRM», NO «CRM» (lo encontró la revisión del 16/10, con el test en verde porque el
// fixture decía «CRM»): el tablero guarda el nombre canónico con su prefijo (`canonNombre`). Se compara con `nucleo()`,
// la misma función que usa el tablero para no duplicar proyectos. Un jefe que no es un proyecto del catálogo
// («Automations», «Video Editor») no tiene lista: la pantalla lo dice.
// ⚠️ NO HAY UNA PUERTA NUEVA. Se lee con `listar_tareas_plan` + `ver_proyecto_plan` y se escribe con
// `proponer_tareas_plan` y `proponer_cierre_tareas`, las operaciones de la API de MaKo, aplicadas EN EL ACTO
// (lib/api-mako/flujo.ts → `aplicarEnElActo`, el camino de las automatizaciones y de los tokens de escritura): el que
// confirma es Martín con su clic. El alta no pregunta nada (fecha, prioridad y proyecto final los pone el Perro) y
// cerrar no es borrar (la tarjeta queda con su historial y la evidencia).
// ⚠️ UN PEDIDO NO SE VUELVE TAREA SOLO. Un mensaje del Centro puede ser una pregunta o un «dale»; el Plan se limpió
// de 64 proyectos inventados (memoria plan-proyectos-catalogo) y no se vuelve a llenar de ruido. «Sumar al Plan» es un
// clic, sin preguntas, en cada pedido sin terminar.
// SIN `server-only`: lo leen la pantalla y los tests (lib/centro-plan.ts es el lado del servidor).

import { esCerebro, partesDelNombre, tituloDeTexto } from './centro-chats';
import { nucleo } from './plan-proyectos-catalogo';
import { recortarPrueba } from './cierre-tarjeta';

/** Una tarea abierta del Plan, lo mínimo que dibuja el chat (de `tareaCompacta`, lib/api-mako/areas/plan.helpers.ts). */
export type TareaPlanP = {
  id: string;
  num: number | null;
  titulo: string;
  /** Su proyecto, por NOMBRE tal cual lo guarda el tablero («Feature: CRM»; null = quedó sin proyecto). */
  proyecto: string | null;
  prioridad: string | null;
  deadline: string | null;
  avance: number;
};

/** El Plan de UN jefe: su proyecto (null = no hay un proyecto con su nombre) y sus tareas abiertas. */
export type LecturaPlan = { ok: true; proyecto: string | null; tareas: TareaPlanP[] } | { ok: false; motivo: string };

const normal = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
const str = (v: unknown, tope: number) => (typeof v === 'string' ? v.trim().slice(0, tope) : '');
const leer = (json: string): Record<string, unknown> | null => {
  try { const j = JSON.parse(json); return j && typeof j === 'object' ? j as Record<string, unknown> : null; } catch { return null; }
};

/**
 * Las tareas de una lectura del Plan (un JSON), saneadas: sólo lo que se dibuja y con topes. `campo`: `tareas` en
 * `listar_tareas_plan`, `abiertas` en `ver_proyecto_plan`. Las recurrentes no entran (no se terminan). Lo que no tiene
 * forma de tarea se descarta, nunca se inventa.
 */
export function tareasDelListado(json: string, campo: 'tareas' | 'abiertas' = 'tareas'): TareaPlanP[] {
  const lista = leer(json)?.[campo];
  if (!Array.isArray(lista)) return [];
  const out: TareaPlanP[] = [];
  for (const t of lista.slice(0, 400)) {
    if (!t || typeof t !== 'object') continue;
    const x = t as Record<string, unknown>;
    const id = str(x.id, 80);
    const titulo = str(x.titulo, 300);
    if (!id || !titulo || x.se_repite === true) continue;
    const avance = typeof x.avance_pct === 'number' && Number.isFinite(x.avance_pct) ? Math.max(0, Math.min(100, Math.round(x.avance_pct))) : 0;
    out.push({
      id, titulo, num: typeof x.num === 'number' && Number.isInteger(x.num) ? x.num : null,
      proyecto: str(x.proyecto, 120) || null, prioridad: str(x.prioridad, 20) || null,
      deadline: /^\d{4}-\d{2}-\d{2}/.test(str(x.deadline, 30)) ? str(x.deadline, 10) : null, avance,
    });
  }
  return out;
}

/** Los proyectos de `listar_tareas_plan` ({id, nombre}). */
export function proyectosDelListado(json: string): Array<{ id: string; nombre: string }> {
  const lista = leer(json)?.proyectos;
  if (!Array.isArray(lista)) return [];
  return lista.flatMap((p) => {
    const x = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
    const id = str(x.id, 80); const nombre = str(x.nombre, 120);
    return id && nombre ? [{ id, nombre }] : [];
  });
}

/** El proyecto del Plan de un chat: el nombre de su JEFE («CRM › Funnels» → «CRM»). El Cerebro no tiene: reparte. */
export function proyectoDelChat(titulo: string): string | null {
  if (esCerebro(titulo)) return null;
  const jefe = partesDelNombre(titulo).jefe.trim();
  return jefe || null;
}

/** ¿Es el mismo proyecto? Sin mayúsculas, tildes ni el prefijo del tablero («Feature: CRM» = «CRM»). */
export const mismoProyecto = (a: string | null | undefined, b: string | null | undefined) => !!a && !!b && nucleo(a) === nucleo(b);

/** El proyecto del tablero que corresponde al jefe de ese chat, o null si no hay ninguno con su nombre. */
export function proyectoDelJefe<P extends { nombre: string }>(proyectos: readonly P[], chat: string): P | null {
  const p = proyectoDelChat(chat);
  return p ? proyectos.find((x) => mismoProyecto(x.nombre, p)) ?? null : null;
}

/** La que vence antes primero; las sin fecha, al final. */
export const ordenarTareas = (ts: readonly TareaPlanP[]) =>
  [...ts].sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999') || a.titulo.localeCompare(b.titulo));

// ── Lo que se manda ──────────────────────────────────────────────────────────────────────────────

export const TOPE_TITULO_TAREA = 200;
/** Una tarea nueva escrita a mano: un renglón con texto (se rechaza, no se recorta: AGENTS.md). */
export function tituloValido(v: string): { ok: true; titulo: string } | { ok: false; error: string } {
  const titulo = v.replace(/\s+/g, ' ').trim();
  if (titulo.length < 3) return { ok: false, error: 'Escribe la tarea para sumarla al Plan.' };
  if (titulo.length > TOPE_TITULO_TAREA) return { ok: false, error: `Acórtala a ${TOPE_TITULO_TAREA} caracteres para sumarla.` };
  return { ok: true, titulo };
}

/**
 * Un pedido como tarea: el título es su primer renglón (cortado en una palabra) y el detalle, el pedido TEXTUAL más de
 * dónde salió. El detalle es «el campo más importante» del alta (plan.def.ts): lo que no quede ahí se pierde.
 */
export function tareaDePedido(texto: string, chat: string): { titulo: string; detalle: string } {
  const limpio = texto.trim();
  return {
    titulo: tituloDeTexto(limpio, 120),
    detalle: `${limpio.slice(0, 3500)}\n\nLo pidió Martín en el Centro de Operaciones, en el chat «${chat}».`,
  };
}

/** La evidencia de un cierre que hace Martín a mano (proponer_cierre_tareas pide 10 caracteres o más). */
export const evidenciaDeCierre = (chat: string) => `Martín la marcó hecha desde el Centro de Operaciones, en el chat «${chat}».`;

/** Una tarea abierta con el mismo título: sumarla otra vez la fusionaría con ésa (o dejaría un borrador colgado). */
export const yaAbierta = (tareas: readonly TareaPlanP[], titulo: string) => tareas.find((t) => normal(t.titulo) === normal(titulo)) ?? null;

/** Dónde quedó una tarea: el Perro elige el proyecto final, y puede no ser el de este jefe. */
export function dondeQuedo(tareas: readonly TareaPlanP[], titulo: string, chat: string): { enEsteChat: boolean; proyecto: string | null } | null {
  const t = yaAbierta(tareas, titulo);
  if (!t) return null;
  return { enEsteChat: mismoProyecto(t.proyecto, proyectoDelChat(chat)), proyecto: t.proyecto };
}

/** Lo que vuelve de sumar o marcar, en pocas palabras (la línea de estado de la sección). */
export type EscritoPlan =
  /** `tareaId`: la tarea que quedó (la creada, o la abierta que ya estaba), si se encontró en el tablero (17/10/2026: el
   *  Plan que se arma solo la necesita para marcarla hecha con el «Ya está»). */
  | { ok: true; aviso: string; plan: LecturaPlan; tareaId?: string | null }
  | { ok: false; error: string; plan?: LecturaPlan };

const sinPrefijo = (p: string) => p.replace(/^(feature|agente)\s*:\s*/i, '');

/** Ya había una abierta con ese título: no se sumó nada, y se dice cuál y dónde (puede ser otra con el mismo renglón). */
export const avisoDeYaEstaba = (t: Pick<TareaPlanP, 'titulo' | 'proyecto'>) =>
  `Ya hay «${tituloDeTexto(t.titulo, 60)}»${t.proyecto ? ` en «${sinPrefijo(t.proyecto)}»` : ''}: no sumé nada`;

/** El aviso de un alta: dónde quedó, o que ya estaba (0 creadas = el Perro la fusionó con una que había). */
export function avisoDeAlta(creadas: number, donde: { enEsteChat: boolean; proyecto: string | null } | null): string {
  if (creadas === 0) return 'Ya estaba: le sumé esto';
  if (donde && !donde.enEsteChat && donde.proyecto) return `Quedó en «${sinPrefijo(donde.proyecto)}»`;
  return 'Sumada al Plan';
}

// ── El «Ya está» de un chat cierra su tarjeta (17/10/2026) ──────────────────────────────────────────────────────────
// Martín: que marcar resuelta una tarea, cuando algo ya está, sea AUTOMÁTICO siempre. El lado del chat (detectar el
// «Ya está» y llamar) es del Ops Center; acá, qué tarjetas cierra un texto. La regla es estricta a propósito: cerrar la
// tarjeta equivocada esconde trabajo pendiente, y no cerrar una se arregla con un clic.
//   1. Las que el texto NOMBRA por número («#870», «la 870» no): son las que el chat sabe que trabajó.
//   2. Si no nombra ninguna, la abierta del proyecto del jefe cuyo título entero aparece en el texto.
//   Nada más: ni parecidos ni la «más probable». Sin ninguna, no se cierra nada y se dice.

/** Los números de tarjeta que nombra un texto («#870, #873 y #882»). */
export const numerosDeTarjeta = (texto: string): number[] =>
  [...new Set([...texto.matchAll(/(?:^|[^\w&/])#(\d{2,6})\b/g)].map((m) => Number(m[1])))];

/** Las tarjetas abiertas que cierra este «Ya está» (`abiertas`: las del proyecto del jefe, o todas para los números). */
export function tarjetasDelYaEsta(texto: string, abiertas: readonly TareaPlanP[], delJefe: readonly TareaPlanP[] = abiertas): TareaPlanP[] {
  const nums = numerosDeTarjeta(texto);
  if (nums.length) return abiertas.filter((t) => t.num != null && nums.includes(t.num));
  const t = ` ${normal(texto).replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ')} `;
  return delJefe.filter((x) => {
    const tit = normal(x.titulo).replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();
    return tit.split(' ').length >= 3 && t.includes(` ${tit} `);
  });
}

// ── El «Ya está» que llega SOLO (sin su «Voy a trabajar en…»): qué cierra el Plan automático (17/10/2026) ──────────────
// La revisión del Cerebro tiró la primera versión, que cerraba toda «#NN» del texto en cualquier proyecto: «Queda pendiente
// la #871», «el run #45 de Actions» o «Ya está identificado el problema de la #870» también cerraban. Lo que vale para
// cerrar SIN que Martín lo pida es más estrecho:
//   · el primer renglón es un «Ya está:» de trabajo terminado (con dos puntos o raya), no «Ya está claro / identificado»;
//   · el texto dice que está en producción (el «Ya está» se escribe cuando llegó: AGENTS.md);
//   · el número va pegado a un verbo de cierre («cerré la #870», «#870 lista»), en un renglón que no habla de lo pendiente;
//   · y la tarjeta es del proyecto del JEFE.

/** ¿Es el «Ya está» de un trabajo terminado? («Ya está: …» / «Ya está — …»; no «Ya está identificado el problema».) */
export const esYaEstaDeCierre = (texto: string): boolean =>
  /^[\s*_#>✅✔·\-–—]*ya est[áa]\s*[:—–-]/i.test((texto.trim().split('\n')[0] ?? ''));

const VERBO = '(?:cerr[éeó]|cerrad[ao]s?|termin[éeó]|terminad[ao]s?|hech[ao]s?|resuelt[ao]s?|resolv[ií]|list[ao]s?|complet[éeó]|completad[ao]s?|arregl[éeó]|arreglad[ao]s?)';
const PENDIENTE_RE = /pendiente|falta|queda|sigue|todav[ií]a|despu[ée]s|pr[óo]xim|no (?:toqu|cerr|termin|hice)/i;

/** Los números que el texto da por CERRADOS: un verbo de cierre pegado al número (antes o después), en un renglón que no
 *  habla de lo pendiente. «Cerré la #870, #871 y #872» da las tres; «queda pendiente la #873», ninguna. */
export function numerosCerradosEn(texto: string): number[] {
  const out = new Set<number>();
  for (const renglon of texto.split('\n')) {
    if (PENDIENTE_RE.test(renglon)) continue;
    for (const m of renglon.matchAll(new RegExp(`${VERBO}\\s+(?:(?:la|el|las|los|tareas?|tarjetas?)\\s+)*((?:#\\d{2,6}(?:\\s*(?:,|y|e)\\s*)?)+)`, 'gi'))) {
      for (const n of m[1].matchAll(/#(\d{2,6})/g)) out.add(Number(n[1]));
    }
    for (const m of renglon.matchAll(new RegExp(`#(\\d{2,6})\\s*(?:[:—–-]\\s*|\\(\\s*)?${VERBO}`, 'gi'))) out.add(Number(m[1]));
  }
  return [...out];
}

/** Las tarjetas que cierra un «Ya está» que llegó SOLO: las que da por cerradas, del proyecto del jefe, y sólo si dice que
 *  está en producción. Nada por título. */
export function tarjetasCerradasPorYaEsta(texto: string, delJefe: readonly TareaPlanP[]): TareaPlanP[] {
  if (!esYaEstaDeCierre(texto) || !/en producci[óo]n/i.test(texto)) return [];
  const nums = numerosCerradosEn(texto);
  return delJefe.filter((t) => t.num != null && nums.includes(t.num));
}
/** ¿Vale la pena buscar sus tarjetas? (sin esto, el Plan no se lee por cada «Ya está»). */
export const pideBuscarTarjetas = (texto: string): boolean =>
  esYaEstaDeCierre(texto) && /en producci[óo]n/i.test(texto) && numerosCerradosEn(texto).length > 0;

// ── Un cierre desde el Centro (17/10/2026, lo encontró Offer con la #888 del ws 9) ──────────────────────────────────

/**
 * Lo que el Centro le manda a `cerrar_tareas_plan` por UNA tarea, con la evidencia ya dentro del tope. La API valida el
 * largo ANTES de correr (`TOPE_PRUEBA_CIERRE`, 400) y rechaza todo el cierre: la #888 traía 440 caracteres y no se
 * cerró («supera el tope de 400»). Recortada acá, termina en «…» y se ve que se cortó.
 */
export const inputDeCierre = (t: { id: string; evidencia: string; revisar?: string | null }) =>
  ({ cerrar: [{ id: t.id, evidencia: recortarPrueba(t.evidencia), ...(t.revisar ? { revisar: t.revisar } : {}) }] });

/**
 * El error que se muestra cuando un cierre falla. Mientras la tarea siga abierta en el tablero (en CUALQUIER proyecto,
 * no sólo en el del jefe), el error real. «Ya no estaba abierta» sólo cuando no está en ninguna lista abierta y el Plan
 * dice que no existe: antes, una tarea de otro proyecto tapaba el error real con esa frase, que era falsa.
 */
export const errorDeCierre = (error: string, sigueAbierta: boolean): string =>
  (sigueAbierta || !/no existen?/i.test(error) ? error : 'Ya no estaba abierta.');
