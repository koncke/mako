// =============================================================================
// ai-step-migrar — el PLAN de migrar una automatización guardada al AI Step v2 (puro, con test)
// =============================================================================
// docs/diseno-ai-step-v2.md §8.3. Lo corre scripts/ai-step-v2.mts sobre cada fila (SIMULACRO por default); acá
// vive la decisión, sin base, para que el test la pruebe con filas armadas a mano.
//
// Por fila con un AI Step en `pasos` O en el borrador vigente (mig 0240):
//   · `separarPasosIA` con ids nuevos de un sorteo de SEMILLA FIJA (el simulacro y --aplicar sacan los mismos)
//     que no chocan con la historia (`evitar`: `nodo_actual`, `hilos`, `nodo_id`); la primera tarjeta conserva
//     el id del nodo y su primer caso; las nuevas van AL FINAL (no corren el `paso_actual` de nadie); el tono se
//     pliega adentro de cada respuesta y si no entra la fila se FRENA (no se corta).
//   · ⛔ EL OBJETIVO NO SE ESCRIBE (revisión de la décima tanda, 11/10/2026). La primera versión le ponía a cada
//     caso el de la tabla de §8.4 por su nombre, y el objetivo VIAJA al redactor («LO QUE ESTA RESPUESTA TIENE QUE
//     LOGRAR…», `bloqueEscenario` de lib/setter-conversacion.ts): con --aplicar, la #213 del ws1 —activa, con dos
//     casos que salen solos— pasaba a contestarles otra cosa a los leads de un cliente, y el freno no lo veía
//     porque `loQueContesta` no comparaba el objetivo. Gana §10-A («lo migrado no tiene uno, y sin él el redactor
//     usa el de la automatización como hoy»): la tabla queda como SUGERENCIA (`sugeridos`, se imprime y no se
//     escribe) y sigue poniéndole objetivo a lo que nace de la galería. Si Martín quiere los objetivos en lo
//     migrado, se escriben a mano en el panel, caso por caso, sabiendo que cambia lo que se contesta.
//   · LA COMPROBACIÓN: los casos que ven el clasificador y el redactor ANTES y DESPUÉS (`escenariosDeRespuesta`:
//     nombre, cuándo, guía, «sale sola», objetivo, ejemplos, audio y «hasta», en el mismo orden) y el mismo «Otra
//     cosa» (`si_no`). Cualquier diferencia frena.
//   · Que nada se pierda en el saneo de `setSecuenciaPasos` (`camposDelFlujo`), que no aparezca un error de
//     Publicar que antes no estaba, y que cada inscripción siga en la MISMA tarjeta y en el mismo índice.
//   · El borrador VIGENTE se convierte igual y se re-firma sobre lo publicado nuevo (§11: un script que cambia
//     `pasos` sin el borrador deja la pestaña abierta en «desactualizado»). Uno que ya no es vigente no se toca.
//   · Las posiciones de las tarjetas nuevas, DEBAJO de la original, si ésa tenía una guardada.
// =============================================================================

import {
  type PasoGrafo, type CasoRespuesta,
  esPasoIA, idDe, normalizar, separarPasosIA, escenariosDeRespuesta, expandirPasoIA, nodoPorId, raizRespuesta,
  validarGrafo, claseDe, medioDe, MEDIOS_AI_STEP,
} from './flujo-grafo';
import { camposDelFlujo, indiceActual } from './nutricion-grafo-motor';
import { objetivoDeCaso } from './ai-step-objetivos';
import { borradorVigente, firmaPublicado } from './secuencia-borrador';
import { sanearPosiciones, type Posiciones } from './lienzo-posiciones';
import { preparaUnaReunion } from './nutricion-familias';
import { altoPasoIA } from './flujo-conversacion';

/** Lo que el plan necesita de una fila de `nutricion_secuencias`. */
export type FilaAIStep = { pasos: unknown; pasos_borrador?: unknown; posiciones?: unknown; trigger_tipo: string };
/** Una inscripción viva: dónde está. */
export type InscAIStep = { id: number; paso_actual: number; nodo_actual: string | null };

export type PlanAIStep = {
  /** Hay algo que escribir (pasos o borrador). */
  cambia: boolean;
  pasos: PasoGrafo[];
  /** El borrador re-firmado, o `undefined` si no se toca. */
  borrador?: { pasos: PasoGrafo[]; base: string; guardado_at: string };
  /** Las posiciones con las tarjetas nuevas, o `undefined` si no se tocan. */
  posiciones?: Posiciones;
  /** Lo que impide escribir la fila. */
  frenos: string[];
  /** Lo que se dice y no frena. */
  avisos: string[];
  /** Las tarjetas nuevas (ids), en orden. */
  nuevas: string[];
  /** Los casos sin objetivo cuyo nombre no está en la tabla de §8.4 (ni sugerencia hay). */
  sinObjetivo: string[];
  /** Los casos sin objetivo que la tabla de §8.4 sabría llenar: se IMPRIMEN y no se escriben (§10-A). */
  sugeridos: Array<{ titulo: string; objetivo: string }>;
};

/** JSON con las claves ordenadas: dos nodos iguales dan el mismo texto aunque las claves vengan en otro orden. */
export function estable(v: unknown): string {
  return JSON.stringify(v, (_k, x: unknown) => (x && typeof x === 'object' && !Array.isArray(x)
    ? Object.fromEntries(Object.keys(x as object).sort().map((k) => [k, (x as Record<string, unknown>)[k]]))
    : x));
}

/**
 * Lo que el clasificador y el redactor ven de una automatización, por medio: lo que la migración NO puede cambiar.
 * ⚠️ TODO lo que `bloqueEscenario` le pasa al redactor (objetivo, ejemplos, audio, «hasta»), no sólo lo del
 * clasificador: sin el objetivo acá, un objetivo nuevo cambiaba la respuesta y el freno daba verde.
 */
export function loQueContesta(pasos: readonly PasoGrafo[]): string {
  return estable(MEDIOS_AI_STEP.map((medio) => {
    const exp = expandirPasoIA(pasos, { medio });
    const casos = escenariosDeRespuesta(exp).map((e) => ({
      titulo: e.titulo, cuando: e.cuando, guia: e.comoResponder, sola: e.contestaSolo === true,
      objetivo: e.objetivo ?? null, ejemplos: e.ejemplos ?? null, audio: e.audio ?? null, hasta: e.hasta ?? null,
    }));
    const r = nodoPorId(exp, raizRespuesta(exp));
    return { medio, casos, otra: queHace(exp, r?.si_no ?? null) };
  }));
}

/** Lo que hace «Otra cosa»: el aviso (su mensaje), la respuesta de MaKo (su guía y si sale sola) o nada. */
function queHace(pasos: readonly PasoGrafo[], id: string | null): unknown {
  const n = nodoPorId(pasos, id);
  if (!n) return null;
  if (claseDe(n) === 'accion') return { aviso: (n.accion as { params?: { mensaje?: unknown } } | undefined)?.params?.mensaje ?? null };
  if (n.tipo === 'ia') return { contesta: n.cuerpo ?? '', sola: n.revisar === false, luego: queHace(pasos, n.siguiente ?? null) };
  return { otro: idDe(n, 0) };
}

/** Los pasos de una fila como el motor los lee: el array tal cual (el índice es `paso_actual`), normalizado. */
const pasosDe = (x: unknown): PasoGrafo[] => (Array.isArray(x) ? normalizar(x.filter((p) => p && typeof p === 'object') as PasoGrafo[]) : []);

/** ¿Hay un AI Step que migrar? (de N casos o con tono). Un caso sin objetivo NO es motivo: el objetivo no se escribe. */
export function necesitaMigrar(pasos: readonly PasoGrafo[]): boolean {
  return pasos.some((p) => esPasoIA(p) && ((p.casos ?? []).length !== 1 || !!(p.instrucciones ?? '').trim()));
}

/** Lo que la tabla de §8.4 SUGIERE para los casos sin objetivo (no se escribe: §10-A), y los que ni sugerencia tienen. */
function sugerencias(pasos: readonly PasoGrafo[], postAgenda: boolean): { sugeridos: PlanAIStep['sugeridos']; sinObjetivo: string[] } {
  const sugeridos: PlanAIStep['sugeridos'] = [];
  const sinObjetivo: string[] = [];
  for (const p of pasos) {
    if (!esPasoIA(p)) continue;
    for (const c of (p.casos ?? []) as CasoRespuesta[]) {
      if ((c.objetivo ?? '').trim() || c.cualquiera) continue;
      const t = objetivoDeCaso(c.titulo, { postAgenda });
      if (!t) sinObjetivo.push(c.titulo || c.id);
      else if (t.objetivo) sugeridos.push({ titulo: c.titulo, objetivo: t.objetivo });
    }
  }
  return { sugeridos, sinObjetivo };
}

/** Separa (sin tocar los objetivos: ver la cabecera). */
function convertir(pasos: readonly PasoGrafo[], rnd: () => number, evitar: ReadonlySet<string>): {
  pasos: PasoGrafo[]; noEntra: string[]; nuevas: string[]; origen: Map<string, string>;
} {
  const antesIds = new Set(pasos.map((p, i) => idDe(p, i)));
  const sep = separarPasosIA(pasos, rnd, { evitar });
  const out = normalizar(sep.pasos.map((p, i) => ({ ...p, orden: i + 1 })));
  const nuevas = out.map((p, i) => idDe(p, i)).filter((id) => !antesIds.has(id));
  // De qué tarjeta salió cada nueva: la AI Step original más cercana arriba en el array de antes (la única de v1).
  const origen = new Map<string, string>();
  const primeraIA = pasos.findIndex((p) => esPasoIA(p));
  for (const id of nuevas) if (primeraIA >= 0) origen.set(id, idDe(pasos[primeraIA], primeraIA));
  return { pasos: out, noEntra: sep.noEntra, nuevas, origen };
}

/**
 * EL PLAN DE UNA FILA. `rnd`: el sorteo de semilla fija de esta fila. `evitar`: los ids que la historia de la
 * secuencia ya vio. `inscs`: las inscripciones vivas (tienen que quedar en la misma tarjeta y el mismo índice).
 */
export function planDeFila(f: FilaAIStep, o: { rnd: () => number; evitar: ReadonlySet<string>; inscs: readonly InscAIStep[] }): PlanAIStep {
  const frenos: string[] = [];
  const avisos: string[] = [];
  const postAgenda = preparaUnaReunion(f.trigger_tipo);
  const antes = pasosDe(f.pasos);
  const migra = necesitaMigrar(antes);
  const c = migra ? convertir(antes, o.rnd, o.evitar) : { pasos: antes, noEntra: [], nuevas: [], origen: new Map<string, string>() };
  const despues = c.pasos;
  const { sugeridos, sinObjetivo } = sugerencias(despues, postAgenda);

  if (migra) {
    for (const t of c.noEntra) frenos.push(`«${t}»: el tono más la respuesta pasan el tope; no se corta`);
    if (loQueContesta(antes) !== loQueContesta(despues)) frenos.push('lo que contesta cambiaría (casos, guía, «sale sola», objetivo u «Otra cosa»)');
    // Lo que el saneo de `setSecuenciaPasos` conserva: un campo que se perdería al primer guardado es un dato roto.
    const perdidos = despues.filter((p) => estable({ ...p, ...camposDelFlujo(p) }) !== estable(p) && esPasoIA(p));
    if (perdidos.length) frenos.push(`el saneo cambiaría ${perdidos.length} tarjeta(s) AI Step`);
    const errAntes = new Set(validarGrafo(antes));
    const nuevosErr = validarGrafo(despues).filter((e) => !errAntes.has(e));
    if (nuevosErr.length) frenos.push(`Publicar frenaría: ${nuevosErr[0]}`);
    // Las inscripciones: misma tarjeta (`indiceActual`) y, si su `paso_actual` era el índice de su nodo, lo sigue siendo.
    for (const i of o.inscs) {
      const ia = indiceActual(antes, i);
      const id = ia >= 0 ? idDe(antes[ia], ia) : null;
      const idDespues = (() => { const k = indiceActual(despues, i); return k >= 0 ? idDe(despues[k], k) : null; })();
      if (id !== idDespues) frenos.push(`la inscripción ${i.id} cambiaría de tarjeta (${id ?? '—'} → ${idDespues ?? '—'})`);
    }
    for (const m of MEDIOS_AI_STEP) {
      const n = despues.filter((p) => esPasoIA(p) && medioDe(p) === m).length;
      if (n > 10) frenos.push(`quedarían ${n} AI Step de ${m}: el tope es 10`);
    }
  }

  // El borrador VIGENTE: se convierte igual y se re-firma sobre lo publicado nuevo.
  let borrador: PlanAIStep['borrador'];
  const vig = f.pasos_borrador != null ? borradorVigente(f.pasos_borrador, f.pasos) : null;
  if (f.pasos_borrador != null && !vig) avisos.push('tiene un borrador que ya no es vigente: no se toca (no se abre)');
  if (vig) {
    const bAntes = normalizar(vig.pasos);
    if (necesitaMigrar(bAntes) || migra) {
      const b = necesitaMigrar(bAntes) ? convertir(bAntes, o.rnd, new Set([...o.evitar, ...despues.map((p, i) => idDe(p, i))])) : { pasos: bAntes, noEntra: [] as string[] };
      for (const t of b.noEntra) frenos.push(`en el borrador, «${t}»: el tono más la respuesta pasan el tope`);
      borrador = { pasos: b.pasos, base: firmaPublicado(despues), guardado_at: vig.guardado_at };
    }
  }

  // Las posiciones de las nuevas, debajo de su original (si la original tenía una guardada).
  let posiciones: Posiciones | undefined;
  if (c.nuevas.length && f.posiciones != null) {
    const pos = sanearPosiciones(f.posiciones);
    const salto = altoPasoIA() + 24;
    let cambio = false;
    const k = new Map<string, number>();
    for (const id of c.nuevas) {
      const de = c.origen.get(id);
      const p0 = de ? pos[de] : undefined;
      if (!p0) continue;
      const n = (k.get(de!) ?? 0) + 1;
      k.set(de!, n);
      pos[id] = { x: p0.x, y: p0.y + n * salto };
      cambio = true;
    }
    if (cambio) posiciones = pos;
  }

  const cambia = (migra && estable(despues) !== estable(antes)) || borrador !== undefined;
  return { cambia, pasos: despues, ...(borrador ? { borrador } : {}), ...(posiciones ? { posiciones } : {}), frenos, avisos, nuevas: c.nuevas, sinObjetivo, sugeridos };
}
