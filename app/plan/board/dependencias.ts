// =============================================================================
// dependencias — «esto no puede empezar hasta que aquello termine»
// =============================================================================
// El pedido, textual: «Hay proyectos y tareas que DEPENDEN de otros. Puede que haya
// algunos que estén correlacionados, pero iniciar no depende del anterior. Pero otros sí,
// dependen absolutamente de que el anterior se termine. Como por ejemplo el de Cobros y
// Planes depende totalmente de que se termine la oferta y precios.»
//
// SIN `server-only` A PROPÓSITO, como `preguntas-contrato.ts` y `types.ts`: lo importan el
// resolvedor del servidor, la pantalla que dibuja el candado y el test. Si cada lado
// tuviera su copia, el chip diría una cosa y el ranking otra — que es exactamente el bug
// que este tablero acaba de terminar de pagar («dos números que se comparan no pueden
// salir de dos corridas distintas», AGENTS.md).
//
// ── LAS DOS COSAS QUE UNA DEPENDENCIA CAMBIA, Y SON DISTINTAS ────────────────────────
//
// 1. LA IMPORTANCIA SUBE POR LA CADENA, del bloqueado al bloqueante:
//        u(A) = max( score(A), max{ u(B) : B espera a A, B abierta } )
//    «Lo que destraba algo importante es al menos tan importante como lo que destraba.»
//    Es la MISMA forma que `scoreProyectoDerivado` (un contenedor vale su mejor
//    contenido), y por eso encaja con el resto del tablero en vez de pelearse.
//    Con esto, el ejemplo del dueño se resuelve solo: hoy «Cobros y planes» y «Oferta y
//    precios» empataban en 98 y el desempate lo decidía cuál se había creado antes.
//
// 2. LA EJECUTABILIDAD BAJA, pero NO el score. Un trabajo bloqueado no deja de ser
//    importante — hundirlo sería mentir sobre cuánto vale. Lo que no puede es aparecer en
//    la lista de «qué hago AHORA»: para eso está `bloqueada`, que Prioridades usa para
//    excluir y el Kanban para pintar el candado.
//
// ⚠️ NINGUNA DE LAS DOS SUMA NI RESTA PUNTOS, y no es una preferencia de estilo: es la
// única forma que sobrevive. `curveTaskScores` reasigna TODOS los scores por RANKING a
// bandas fijas (93→76 / 72→51 / 48→26 / 23→2) en cada corrida, así que un «+15» escrito en
// disco se pierde en el redondeo de la banda y el valor viejo ya no existe para
// restaurarlo. Lo único que sobrevive es la POSICIÓN. Por eso `recurvarPlanOwner` —que
// preserva el orden a propósito— no podía cerrar el reclamo del ranking, y por eso esto es
// lo primero que tiene derecho a cambiarlo.
//
// ⚠️ Y `clase: 'ordena'` NO TOCA NINGÚN NÚMERO. Cero. Es la traducción literal de «puede
// que haya algunos que estén correlacionados, pero iniciar NO depende del anterior»: si
// iniciar no depende, no hay nada que reordenar. Si moviera el ranking, las dos clases
// serían la misma con distinto nombre y la distinción que hizo el dueño se perdería.
// =============================================================================

import type { Actor } from './types';

export type ClaseDep = 'bloquea' | 'ordena';
export type EntidadDep = 'tarea' | 'proyecto';

/** Una arista CONFIRMADA: `deId` no puede empezar hasta que `aId` termine. */
export type Dep = {
  entidad: EntidadDep;
  /** el que ESPERA (B, en «B depende de A») */
  deId: string;
  /** el que va PRIMERO (A) */
  aId: string;
  clase: ClaseDep;
  /** una frase: QUÉ produce A que B necesita. Sin esto la arista no se puede auditar. */
  razon: string;
  origen: Actor;
  /** solo cuando la propuso la IA; una arista puesta a mano no tiene «confianza». */
  confianza?: 'alta' | 'media';
};

const str = (v: unknown, max: number, d = ''): string => (typeof v === 'string' ? v.trim().slice(0, max) : d);

/**
 * Sanea una arista que viene de la base o de un modelo. Devuelve `null` si no es usable.
 *
 * Las dos puntas son OBLIGATORIAS y distintas: una arista sin destino no bloquea nada pero
 * sí ocupa lugar en el grafo, y una arista a sí misma es un ciclo de largo 1 — el más
 * barato de crear y el que más rápido cuelga un recorrido.
 */
export function sanearDep(v: unknown): Dep | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  const deId = str(r.deId ?? r.de_id, 80);
  const aId = str(r.aId ?? r.a_id, 80);
  if (!deId || !aId || deId === aId) return null;
  const entidad: EntidadDep = r.entidad === 'proyecto' ? 'proyecto' : 'tarea';
  const clase: ClaseDep = r.clase === 'ordena' ? 'ordena' : 'bloquea';
  const o = str(r.origen, 8, 'ia');
  const origen: Actor = o === 'user' || o === 'code' ? o : 'ia';
  const conf = str(r.confianza, 8);
  return {
    entidad, deId, aId, clase, razon: str(r.razon, 300), origen,
    ...(origen !== 'user' && (conf === 'alta' || conf === 'media') ? { confianza: conf } : {}),
  };
}

// ── Ciclos ───────────────────────────────────────────────────────────────────────────

/**
 * ¿Se puede agregar «`de` depende de `a`»? El guard va en POSITIVO —solo se puede depender
 * de algo que NO depende de vos, ni directa ni indirectamente— porque la versión negativa
 * («cualquiera menos el padre directo») deja pasar toda cadena de largo 3 y se queda vieja
 * sola (AGENTS.md → «Un guard sobre algo destructivo se escribe en POSITIVO»).
 *
 * Devuelve el CAMINO y no un booleano: con el camino la pantalla puede decir la frase
 * entera —«"Cobros" ya espera a "Oferta", así que esto sería un círculo»— en vez de un «no
 * se puede» que no explica nada y obliga a adivinar.
 *
 * Recorre las DOS clases, no solo 'bloquea': un círculo mixto sigue siendo un círculo para
 * el orden topológico, y un `console.warn` no lo frena (cinco proyectos rechazados nacieron
 * igual con el warn puesto).
 */
export function puedeDepender(deps: Dep[], entidad: EntidadDep, de: string, a: string): { ok: true } | { ok: false; camino: string[] } {
  if (de === a) return { ok: false, camino: [de, de] };
  const salidas = new Map<string, string[]>();
  for (const d of deps) {
    if (d.entidad !== entidad) continue;
    const arr = salidas.get(d.deId); if (arr) arr.push(d.aId); else salidas.set(d.deId, [d.aId]);
  }
  // DFS desde `a` siguiendo «espera a»: si se llega a `de`, la arista nueva cerraría el
  // círculo. `visto` es total, así que no se cuelga ni con datos que YA vinieron sucios.
  const visto = new Set<string>([a]);
  const pila: Array<{ id: string; camino: string[] }> = [{ id: a, camino: [a] }];
  while (pila.length) {
    const { id, camino } = pila.pop()!;
    for (const sig of salidas.get(id) ?? []) {
      if (sig === de) return { ok: false, camino: [de, ...camino, de] };
      if (visto.has(sig)) continue;
      visto.add(sig);
      pila.push({ id: sig, camino: [...camino, sig] });
    }
  }
  return { ok: true };
}

// ── El resolvedor ────────────────────────────────────────────────────────────────────

export type TareaDep = { id: string; num: number; score: number; progress: number; labels: string[] };

export type EstadoDeps = {
  /** por tarea: ids de lo que la frena y TODAVÍA está abierto. Vacío = se puede empezar. */
  bloqueantes: Record<string, string[]>;
  /** por tarea: ids de PROYECTOS que la frenan (la dependencia se declaró a nivel proyecto) */
  bloqueantesProy: Record<string, string[]>;
  /** por tarea: el score que HEREDA de lo que destraba. Siempre >= su propio score. */
  urgencia: Record<string, number>;
  /** cuántos escalones de espera tiene encima. 0 = se puede empezar ya. */
  profundidad: Record<string, number>;
  /** las tareas abiertas, ORDENADAS. Es lo que se le pasa a `curveTaskScores`. */
  orden: TareaDep[];
};

/**
 * Resuelve el grafo entero. Cero tokens y O(V+E): sobre 550 tareas es aritmética de un
 * milisegundo, así que puede correr en cada corrida sin pensarlo dos veces.
 *
 * ⚠️ IGNORA EN SILENCIO las aristas colgadas —un id que ya no existe— y es a propósito: no
 * hay foreign key posible (la PK de plan_tareas es compuesta y la tabla mezcla dos niveles),
 * así que una tarea borrada deja punteros muertos y el tablero tiene que seguir andando.
 * Lo que NO hace en silencio es tragarse un ciclo: ver `cortarCiclo` abajo.
 */
export function resolverDeps(e: { tareas: TareaDep[]; deps: Dep[] }): EstadoDeps {
  const abierta = (t: TareaDep) => t.progress < 100;
  const porId = new Map(e.tareas.map((t) => [t.id, t]));
  const abiertas = e.tareas.filter(abierta);

  // Un proyecto está TERMINADO cuando no le queda ninguna tarea abierta. Un proyecto SIN
  // tareas NO cuenta como terminado: no hay evidencia de que se haya hecho nada, y tratar
  // «vacío» como «listo» destrabaría media cadena sin que nadie hiciera el trabajo.
  const abiertasPorProy = new Map<string, number>();
  const conTareas = new Set<string>();
  for (const t of e.tareas) for (const p of t.labels) {
    conTareas.add(p);
    if (abierta(t)) abiertasPorProy.set(p, (abiertasPorProy.get(p) ?? 0) + 1);
  }
  const proyPendiente = (p: string) => !conTareas.has(p) || (abiertasPorProy.get(p) ?? 0) > 0;

  const duras = e.deps.filter((d) => d.clase === 'bloquea');

  // ── Quién frena a quién ──
  const bloqueantes: Record<string, string[]> = {};
  const bloqueantesProy: Record<string, string[]> = {};
  for (const d of duras) {
    if (d.entidad === 'tarea') {
      const b = porId.get(d.aId);
      if (!b || !abierta(b)) continue;                       // no existe o ya está hecha
      const t = porId.get(d.deId);
      if (!t || !abierta(t)) continue;
      (bloqueantes[d.deId] ??= []).push(d.aId);
    } else {
      if (!proyPendiente(d.aId)) continue;
      for (const t of abiertas) {
        if (!t.labels.includes(d.deId)) continue;
        // Una tarea que vive en los DOS proyectos no se puede bloquear a sí misma.
        if (t.labels.includes(d.aId)) continue;
        (bloqueantesProy[t.id] ??= []).push(d.aId);
      }
    }
  }

  // ── La urgencia sube por la cadena ──
  // DFS memoizado sobre el grafo INVERTIDO (de lo que espera hacia lo que va primero).
  // `enCurso` corta un ciclo que igual haya entrado: sin eso, dos tareas que se esperan
  // mutuamente cuelgan el render entero, y el guard de escritura no cubre los datos viejos
  // ni las escrituras concurrentes.
  const esperanA = new Map<string, string[]>();               // A → los B que lo esperan
  for (const [de, aa] of Object.entries(bloqueantes)) for (const a of aa) {
    const arr = esperanA.get(a); if (arr) arr.push(de); else esperanA.set(a, [de]);
  }
  const urgencia: Record<string, number> = {};
  const enCurso = new Set<string>();
  const calcU = (id: string): number => {
    const t = porId.get(id); if (!t) return 0;
    const ya = urgencia[id]; if (ya != null) return ya;
    if (enCurso.has(id)) return t.score;                      // ciclo: se corta con su propio score
    enCurso.add(id);
    let u = t.score;
    for (const b of esperanA.get(id) ?? []) {
      const tb = porId.get(b);
      if (tb && abierta(tb)) u = Math.max(u, calcU(b));
    }
    enCurso.delete(id);
    urgencia[id] = u;
    return u;
  };
  for (const t of abiertas) calcU(t.id);

  // ── Y LA HERENCIA CRUZA DE PROYECTO A TAREA ──
  // Es el caso que trajo la feature: «Cobros y planes depende de que se termine Oferta y
  // precios». Sin esto la arista solo FRENA a Cobros y no SUBE a Oferta, o sea hace la
  // mitad visible del trabajo y deja intacto el empate que había que romper.
  //
  // ⚠️ PERO SUBE POR DELTA, NO POR MÁXIMO, y la diferencia es todo. La primera versión le
  // daba a CADA tarea del proyecto la urgencia heredada entera: medido sobre el tablero
  // real, las 14 tareas abiertas de «Oferta y precios» saltaron todas a 93 y coparon el
  // top 12 —incluidas «Investigar competencia: Crush.ai» (score 15) y «Analizar embudo de
  // GoMarz» (7)—, empujando abajo trabajo genuinamente urgente de otros proyectos. Aplanar
  // el orden INTERNO de un proyecto es cambiar una mentira por otra.
  //
  // La regla correcta: el proyecto que va primero sube hasta el nivel del que lo espera, y
  // sus tareas suben TODAS LO MISMO. Su mejor tarea llega a donde tiene que llegar y el
  // orden de adentro queda intacto: lo secundario sigue siendo secundario.
  const tareasAbiertasDe = new Map<string, string[]>();
  for (const t of abiertas) for (const p of t.labels) {
    const arr = tareasAbiertasDe.get(p); if (arr) arr.push(t.id); else tareasAbiertasDe.set(p, [t.id]);
  }
  const topDe = (p: string) => Math.max(0, ...(tareasAbiertasDe.get(p) ?? []).map((id) => urgencia[id] ?? 0));
  const arisProy = duras.filter((d) => d.entidad === 'proyecto');
  // Punto fijo, con tope: una cadena de proyectos propaga escalón por escalón, y el tope
  // es lo que impide que un ciclo guardado deje el render girando para siempre.
  for (let vuelta = 0; vuelta < Math.min(20, arisProy.length + 1); vuelta++) {
    let movio = false;
    for (const d of arisProy) {
      const delta = topDe(d.deId) - topDe(d.aId);
      if (delta <= 0) continue;
      for (const id of tareasAbiertasDe.get(d.aId) ?? []) urgencia[id] = (urgencia[id] ?? 0) + delta;
      movio = true;
    }
    if (!movio) break;
  }

  // ── Cuántos escalones de espera tiene encima ──
  const profundidad: Record<string, number> = {};
  const enCurso2 = new Set<string>();
  const calcP = (id: string): number => {
    const ya = profundidad[id]; if (ya != null) return ya;
    if (enCurso2.has(id)) return 0;
    const porTarea = bloqueantes[id] ?? [];
    const porProy = bloqueantesProy[id] ?? [];
    if (!porTarea.length && !porProy.length) { profundidad[id] = 0; return 0; }
    enCurso2.add(id);
    // Un bloqueante que es TAREA aporta su propia profundidad + 1 (la cadena sigue). Uno
    // que es PROYECTO aporta un solo escalón: no es un nodo del grafo de tareas, así que
    // no hay nada que recorrer más arriba.
    const p = 1 + Math.max(0, ...porTarea.map(calcP));
    enCurso2.delete(id);
    profundidad[id] = p;
    return p;
  };
  for (const t of abiertas) calcP(t.id);

  // ── El orden ──
  // `urgencia` manda; a igual urgencia va primero el que tiene MENOS espera encima (así un
  // bloqueante nunca queda debajo de lo que bloquea, ni siquiera cuando empatan); después
  // el score propio, y al final el número de tarjeta, que es estable y no depende de en qué
  // orden las devolvió Postgres. Ese último desempate importa: `curveTaskScores` desempata
  // por índice del array, así que sin un criterio propio dos tareas empatadas se
  // intercambian solas entre corridas y el tablero «se mueve» sin que nadie lo toque.
  const orden = abiertas.slice().sort((a, b) =>
    (urgencia[b.id] ?? b.score) - (urgencia[a.id] ?? a.score)
    || (profundidad[a.id] ?? 0) - (profundidad[b.id] ?? 0)
    || b.score - a.score
    || a.num - b.num);

  return { bloqueantes, bloqueantesProy, urgencia, profundidad, orden };
}

/** ¿Esta tarea está frenada por algo que todavía no terminó? */
export const estaBloqueada = (id: string, est: EstadoDeps): boolean =>
  (est.bloqueantes[id]?.length ?? 0) > 0 || (est.bloqueantesProy[id]?.length ?? 0) > 0;
