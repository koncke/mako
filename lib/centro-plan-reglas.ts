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
export function dondeQuedo(tareas: readonly TareaPlanP[], titulo: string, chat: string): { aca: boolean; proyecto: string | null } | null {
  const t = yaAbierta(tareas, titulo);
  if (!t) return null;
  return { aca: mismoProyecto(t.proyecto, proyectoDelChat(chat)), proyecto: t.proyecto };
}

/** Lo que vuelve de sumar o marcar, en pocas palabras (la línea de estado de la sección). */
export type EscritoPlan =
  | { ok: true; aviso: string; plan: LecturaPlan }
  | { ok: false; error: string; plan?: LecturaPlan };

const sinPrefijo = (p: string) => p.replace(/^(feature|agente)\s*:\s*/i, '');

/** Ya había una abierta con ese título: no se sumó nada, y se dice cuál y dónde (puede ser otra con el mismo renglón). */
export const avisoDeYaEstaba = (t: Pick<TareaPlanP, 'titulo' | 'proyecto'>) =>
  `Ya hay «${tituloDeTexto(t.titulo, 60)}»${t.proyecto ? ` en «${sinPrefijo(t.proyecto)}»` : ''}: no sumé nada`;

/** El aviso de un alta: dónde quedó, o que ya estaba (0 creadas = el Perro la fusionó con una que había). */
export function avisoDeAlta(creadas: number, donde: { aca: boolean; proyecto: string | null } | null): string {
  if (creadas === 0) return 'Ya estaba: le sumé esto';
  if (donde && !donde.aca && donde.proyecto) return `Quedó en «${sinPrefijo(donde.proyecto)}»`;
  return 'Sumada al Plan';
}
