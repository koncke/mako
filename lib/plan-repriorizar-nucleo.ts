// =============================================================================
// plan-repriorizar-nucleo — «Re-priorizar todo», la parte que se decide SIN base y sin red
// =============================================================================
// 16/10/2026, decisión 9 de «hacer el kanban un kanban». El pedido, textual (Martín): «Quiero
// hacerlo "libre", que se creen sin prioridad, y luego de última un botón en los 3 puntos de
// arriba del plan para "re-priorizar" todo, y eso puede correr en segundo plano y no impedir que
// el usuario siga utilizando todo».
//
// Las tareas nacen libres (score 0, «Sin priorizar») y lo que nada reclamó cae en la bandeja «Sin
// proyecto» (lib/plan-bandeja.ts). «Re-priorizar todo» es lo que les pone número y proyecto: un
// TRABAJO con fila de estado (`plan_repriorizaciones`, mig 0301) que recorre las tareas abiertas
// del Plan en tandas chicas, en segundo plano, con el Perro de siempre (la red gratis).
//
// Acá vive lo PURO —qué entra al trabajo, qué se hace con cada tarea de una tanda, qué pasa cuando
// una tanda falla, qué se dibuja— para que se pueda probar rompiéndolo sin base ni IA. La base, la
// red y el `after()` están en lib/plan-repriorizar.ts (server-only). Sin `server-only` a propósito:
// lo importan el server, el navegador (la línea de progreso y el toast) y los tests.
// =============================================================================

import type { GuardPatch, GuardProjPatch, Hist } from '@/app/plan/board/types';

/** Los dos tableros (lib/tablero-de-capa.ts): el del super-admin y el de cada cliente. */
export type TableroRP = 'dueno' | 'cliente';
export type EstadoRP = 'corriendo' | 'hecho' | 'error';
/** `tareas`: recorre las tandas. `cierre`: lo que va una vez al final (en el dueño, el reparto y
 *  los proyectos). */
export type FaseRP = 'tareas' | 'cierre';

/**
 * EL TAMAÑO DE LA TANDA. «Tandas chicas»: 20 tareas por llamada al Perro.
 *
 * ⚠️ No es por el prompt sino por la CUOTA. La red gratis rota por error: un 429 de Gemini (la
 * cuota es por minuto) cae a la próxima cuenta o al próximo proveedor, que puede ser un modelo más
 * chico, y eso no da error: da un juicio peor (docs/hallazgos-ia.md, «La rotación tenía UN eje»).
 * Con 185 tareas de una vez, el lote entero se lo llevaría el modelo de rebote. Con 20, una tanda
 * mala es una tanda, y la siguiente vuelve a empezar por la primera cuenta.
 */
export const TANDA = 20;
/** Cuántas veces se prueba la MISMA tanda antes de dar el trabajo por cortado. */
export const MAX_INTENTOS = 3;
/** Cuánto se espera antes de reintentar una tanda que falló (la cuota de Gemini es por minuto). */
export const ESPERA_REINTENTO_MS: readonly number[] = [20_000, 60_000];
/**
 * EL CANDADO de una tanda: quien la toma la tiene hasta acá. Más que lo que tarda una tanda de
 * verdad (una llamada al Perro, hasta ~90 s con el reintento de la cascada) y menos que el
 * `maxDuration` del cron (300 s): si el que la tomó se murió a mitad, a los 4 minutos la toma otro.
 */
export const CANDADO_MS = 240_000;
/** No se arranca una tanda con menos reloj que esto: cortada a mitad, se repite entera. */
export const RELOJ_MIN_TANDA_MS = 75_000;
/** El cierre del dueño juzga los ~70 proyectos en UNA llamada: necesita más reloj. */
export const RELOJ_MIN_CIERRE_MS = 100_000;
/** Respiro entre dos tandas del mismo drenaje: dos llamadas pegadas son las que comen el 429. */
export const PAUSA_ENTRE_TANDAS_MS = 1_500;
/** Cada cuánto mira el tablero el progreso mientras corre. */
export const SONDEO_MS = 4_000;
/**
 * Cada cuánto mira el tablero si hay un trabajo NUEVO cuando no está mirando uno (y además al volver
 * a la pestaña). ⚠️ Hasta el 16/10/2026 sólo miraba al abrir y mientras corría uno que había visto:
 * un «Re-priorizar todo» arrancado por WhatsApp, desde el teléfono o desde otra pestaña no le llegaba
 * nunca, y el próximo guardado de una tarjeta (la fila ENTERA, con el número viejo) deshacía lo que
 * el trabajo había escrito.
 */
export const VIGILANCIA_MS = 45_000;
/**
 * Al ABRIR el tablero con un trabajo corriendo, se pintan sólo los cambios de los últimos segundos
 * antes de montar: lo anterior ya vino en lo que se cargó. ⚠️ Repintarlos todos (lo que se hacía
 * hasta el 16/10) pisaba en la pantalla lo que una persona cambió DESPUÉS de que el trabajo
 * escribiera esa tarea —y el próximo guardado lo devolvía a la base—. El margen cubre el hueco
 * entre que el server leyó el tablero y que la pantalla montó.
 */
export const MARGEN_APERTURA_MS = 15_000;
/** Las entradas de historial que se conservan por tarjeta (el mismo tope que el Perro). */
export const TOPE_HIST = 40;

/**
 * Lo que el trabajo le deja a la PANTALLA, tarea por tarea, para que el tablero abierto lo pinte
 * sin recargar. ⚠️ No es cosmético: los dos tableros GUARDAN la fila entera desde el navegador
 * (el upsert del dueño, el `editPatch` del cliente, con `score` y `historial` adentro), así que una
 * pestaña que no se entera le devolvería el score viejo a la tarea en el próximo guardado.
 * `k: 't'` es una tarea (un `GuardPatch`, lo que ya aplica `aplicarPerroServer`), `k: 'p'` un
 * proyecto (el dueño los re-juzga en el cierre).
 */
export type CambioRP =
  | ({ k: 't'; ts?: number } & GuardPatch)
  | { k: 'p'; id: string; score: number; scoreRazon?: string; ts?: number };

/** Le pone la HORA en que se publicó a cada cambio que no la tiene (ms). Es lo que deja que un
 *  tablero que abre a mitad del trabajo pinte sólo lo que no vino en lo que cargó (`cambiosDesde`). */
export const conHora = (cs: readonly CambioRP[], ahora = Date.now()): CambioRP[] =>
  cs.map((c) => (typeof c.ts === 'number' ? c : { ...c, ts: ahora }));

/** Los cambios publicados desde `desdeMs`. Uno sin hora (de antes del 16/10) cuenta como viejo. */
export const cambiosDesde = (cs: readonly CambioRP[], desdeMs: number): CambioRP[] =>
  cs.filter((c) => typeof c.ts === 'number' && c.ts >= desdeMs);

/** El trabajo como lo leen la pantalla y la API de MaKo. */
export type Repriorizacion = {
  id: number;
  tablero: TableroRP;
  estado: EstadoRP;
  fase: FaseRP;
  /** Cuántas tareas entraron a la foto, y cuántas ya pasaron. */
  total: number;
  hechas: number;
  /** Las que el Perro puntuó, las que salieron de la bandeja, las fijadas a mano que se respetaron
   *  y las que el modelo no alcanzó a puntuar (quedan con el número que tenían). */
  puntuadas: number;
  ruteadas: number;
  fijadas: number;
  sinPuntuar: number;
  /** El ÚLTIMO error, aunque después la tanda haya salido en el reintento: «falló y se recuperó»
   *  y «nunca falló» no son lo mismo, y un registro que borra el primero los confunde. */
  error: string | null;
  /** El último modelo que contestó: si bajó de modelo, se ve acá. */
  modelo: string | null;
  actor: string;
  creada: string;
  terminada: string | null;
  /** ¿Nadie la está procesando AHORA (ni esperando para reintentar)? Lo mira el sondeo del
   *  tablero para empujar la tanda siguiente. */
  libre: boolean;
  /** Los cambios desde `desde` (el sondeo pide sólo lo que no tiene). */
  cambios: CambioRP[];
  /** Cuántos cambios hay en total: el `desde` del próximo sondeo. */
  nCambios: number;
};

/**
 * Una tarea como la ve el trabajo. Las dos mitades (plan_tareas / experimento_tareas) se
 * traducen a esto en lib/plan-repriorizar.ts, y todo lo de abajo decide sobre esto.
 */
export type TareaRP = {
  id: string;
  titulo: string;
  /** ids de sus proyectos (texto en el dueño, el número como texto en el cliente). */
  proyectos: string[];
  score: number;
  /** `score_manual` (mig 0143, en las dos tablas): la prioridad la fijó una persona. */
  fijada: boolean;
  recurrente: boolean;
  /** Abierta: `estaPendiente` del estado y avance < 100. «No cumplen tu criterio» NO lo está. */
  pendiente: boolean;
  /** Es del PLAN y no de la Retro ni de un experimento (en el dueño, siempre). */
  delPlan: boolean;
};

/**
 * ¿ES UNA TAREA DEL PLAN? `experimento_tareas` mezcla tres cosas: el plan del negocio, lo que
 * propuso una Retro y los pasos de un experimento. Las otras dos tienen su propia pantalla y su
 * propia rendición de cuentas (la Retro mide qué pasó con LO QUE ELLA propuso): re-priorizarlas
 * desde el Plan les cambiaría el número a cosas que el Plan no gobierna. Una sola de las cuatro
 * marcas alcanza para dejarla afuera.
 */
export const esDelPlanCliente = (t: { origen?: string | null; retro_id?: number | null; experimento_id?: number | null }): boolean =>
  t.origen !== 'retro' && t.origen !== 'experimento' && t.retro_id == null && t.experimento_id == null;

/** ¿Está en la bandeja? Sin proyecto, o sólo en «Sin proyecto». */
export const enBandeja = (t: Pick<TareaRP, 'proyectos'>, esBandeja: (proyectoId: string) => boolean): boolean =>
  t.proyectos.length === 0 || t.proyectos.every(esBandeja);

/** ¿El trabajo tiene algo que hacerle? Puntuarla (abierta, ni fijada ni recurrente) o sacarla de la
 *  bandeja (aunque esté fijada o se repita: rutear no es puntuar). */
export const tieneTrabajo = (t: TareaRP, esBandeja: (proyectoId: string) => boolean): boolean =>
  t.pendiente && t.delPlan && ((!t.fijada && !t.recurrente) || enBandeja(t, esBandeja));

/**
 * LA FOTO: qué tareas entran al trabajo, y en qué orden. Se saca UNA vez, al arrancar: lo que se
 * cree después no entra (nació libre y lo agarra el próximo «Re-priorizar todo»), y lo que se cierre
 * o se borre en el medio se saltea cuando le toca.
 *
 * Primero las «Sin priorizar» (score 0): son las que no tienen NINGÚN número, y si el trabajo se
 * corta a mitad, que se corte con ésas ya puntuadas. Después el resto, por el orden del tablero.
 */
export function idsDelTrabajo(tareas: readonly TareaRP[], esBandeja: (proyectoId: string) => boolean): string[] {
  const entran = tareas.filter((t) => tieneTrabajo(t, esBandeja));
  return [...entran.filter((t) => t.score <= 0), ...entran.filter((t) => t.score > 0)].map((t) => t.id);
}

/** Las abiertas del Plan que el trabajo NO va a puntuar porque una persona fijó su número. Se cuentan
 *  desde el arranque: un candado que funciona y uno que nadie disparó se ven iguales si no hay un
 *  número al lado (AGENTS.md → «score_manual no lo pone una corrida»). */
export const fijadasFuera = (tareas: readonly TareaRP[], esBandeja: (proyectoId: string) => boolean): number =>
  tareas.filter((t) => t.pendiente && t.delPlan && t.fijada && !enBandeja(t, esBandeja)).length;

/** Lo que le toca a cada tarea de UNA tanda. Se decide contra la fila RELEÍDA al procesar la tanda,
 *  no contra la foto: entre el arranque y su turno pudo cerrarse, borrarse o fijarse a mano. */
export type PlanDeTanda = {
  /** Se le pide el número al Perro. */
  puntuar: TareaRP[];
  /** Se le busca proyecto (está en la bandeja). */
  rutear: TareaRP[];
  /** Fijadas a mano: el número no se toca (pueden igual salir de la bandeja). */
  fijadas: TareaRP[];
  /** Ya no tienen nada que hacer (se cerraron, se borraron, pasaron a «No cumplen tu criterio»). */
  saltadas: string[];
};

export function planDeTanda(ids: readonly string[], tareas: readonly TareaRP[], esBandeja: (proyectoId: string) => boolean): PlanDeTanda {
  const porId = new Map(tareas.map((t) => [t.id, t]));
  const out: PlanDeTanda = { puntuar: [], rutear: [], fijadas: [], saltadas: [] };
  for (const id of ids) {
    const t = porId.get(id);
    if (!t || !t.pendiente || !t.delPlan) { out.saltadas.push(id); continue; }
    if (enBandeja(t, esBandeja)) out.rutear.push(t);
    if (t.fijada) out.fijadas.push(t);
    else if (!t.recurrente) out.puntuar.push(t);
  }
  return out;
}

/**
 * LA VARA contra la que el Perro ubica la tanda: las abiertas del Plan que no están en ella.
 *
 * ⚠️ SIN LAS «SIN PRIORIZAR» (score 0): no tienen un juicio, tienen la ausencia de uno. Con 60
 * libres en la vara, el modelo vería un tablero con la mitad abajo de todo y anclaría la tanda
 * contra ese fondo falso. Y sin las recurrentes, por lo mismo que en `priorizarNuevasOwner`: su
 * número no es un puesto.
 */
export function vara(tareas: readonly TareaRP[], idsTanda: ReadonlySet<string>): Array<{ titulo: string; score: number }> {
  return tareas
    .filter((t) => t.pendiente && t.delPlan && !t.recurrente && t.score > 0 && !idsTanda.has(t.id))
    .map((t) => ({ titulo: t.titulo, score: t.score }));
}

/** El id de la entrada de historial que deja ESTE trabajo en ESTA tarea. Determinista a propósito:
 *  una tanda que se corta a mitad se repite entera, y la segunda pasada REEMPLAZA la entrada de la
 *  primera en vez de apilar dos «MaKo la re-priorizó» iguales. */
export const idEntradaRP = (trabajoId: number, tareaId: string): string => `rp${trabajoId}-${tareaId}`;

/**
 * El renglón del historial: lo que PASÓ, no lo que contestó el modelo. Con el número de ANTES
 * («62 → 48»), igual que el Perro cuando re-juzga un proyecto: «Re-priorizar todo» no tiene
 * deshacer, y el historial es lo único que deja volver a mano a lo que había. Una «Sin priorizar»
 * no tenía número: ésa se PRIORIZA, no se re-prioriza.
 */
export function textoEntradaRP(p: { antes?: number; score?: number; razon?: string; proyecto?: string }): string {
  const partes: string[] = [];
  if (p.proyecto) partes.push(`la pasó a «${p.proyecto}»`);
  if (p.score != null) {
    const que = p.antes != null && p.antes > 0 ? `la re-priorizó — ${p.antes} → ${p.score}` : `la priorizó — score ${p.score}`;
    partes.push(`${que}${p.razon ? ` (${p.razon})` : ''}`);
  }
  return `MaKo ${partes.join(' y ')}`.slice(0, 220);
}

/** Pone la entrada arriba, reemplazando la de una pasada anterior del mismo trabajo. */
export function conEntrada(historial: readonly Hist[], entrada: Hist, tope = TOPE_HIST): Hist[] {
  return [entrada, ...historial.filter((h) => h.id !== entrada.id)].slice(0, tope);
}

/**
 * QUÉ PASA CUANDO UNA TANDA FALLA. Se reintenta ESA tanda —no se saltea: saltearla dejaría veinte
 * tareas sin número y un trabajo «hecho»—, esperando un poco más cada vez (la cuota de Gemini es por
 * minuto). Al tercer fallo el trabajo se CORTA: si la red gratis no contesta, la tanda siguiente
 * tampoco, y seguir sería quemar cuota en intentos. El error queda escrito en la fila siempre.
 */
export function trasFalla(intentos: number, mensaje: string, ahora = Date.now()): {
  intentos: number; error: string; estado: EstadoRP; tomadaHasta: string | null; terminado: string | null;
} {
  const n = intentos + 1;
  const error = mensaje.trim().slice(0, 480) || 'falló sin decir por qué';
  if (n >= MAX_INTENTOS) return { intentos: n, error, estado: 'error', tomadaHasta: null, terminado: new Date(ahora).toISOString() };
  const espera = ESPERA_REINTENTO_MS[Math.min(n - 1, ESPERA_REINTENTO_MS.length - 1)];
  return { intentos: n, error, estado: 'corriendo', tomadaHasta: new Date(ahora + espera).toISOString(), terminado: null };
}

/** ¿Se puede arrancar otra tanda (o el cierre) con el reloj que queda? */
export const alcanzaElReloj = (fase: FaseRP, hasta: number, ahora = Date.now()): boolean =>
  hasta - ahora >= (fase === 'cierre' ? RELOJ_MIN_CIERRE_MS : RELOJ_MIN_TANDA_MS);

/** ¿Está libre para que alguien la tome? (`tomada_hasta` vencido o vacío). */
export const estaLibre = (tomadaHasta: string | null | undefined, ahora = Date.now()): boolean => {
  const t = tomadaHasta ? Date.parse(tomadaHasta) : NaN;
  return !Number.isFinite(t) || t <= ahora;
};

// ── Lo que se dibuja ─────────────────────────────────────────────────────────

/** La línea chica del tablero mientras corre. `null` = no se dibuja nada. */
export function lineaDeProgreso(e: Pick<Repriorizacion, 'estado' | 'hechas' | 'total'> | null): string | null {
  if (!e || e.estado !== 'corriendo') return null;
  return `Re-priorizando ${Math.min(e.hechas, e.total)}/${e.total}`;
}

/** El toast al terminar (corto: se dibuja). */
export function avisoAlTerminar(e: Pick<Repriorizacion, 'estado' | 'total'>): { texto: string; error: boolean } | null {
  if (e.estado === 'hecho') return { texto: e.total ? 'Prioridades al día' : 'Nada que re-priorizar', error: false };
  if (e.estado === 'error') return { texto: 'Re-priorizar se cortó', error: true };
  return null;
}

/**
 * Los cambios del trabajo, partidos como los aplica el tablero (`aplicarPerroServer`): las tareas
 * como `GuardPatch` y los proyectos como `GuardProjPatch` (sin emoji ni detalle: el trabajo no los
 * toca, y vacíos el tablero conserva los que tiene).
 */
export function cambiosParaPantalla(cs: readonly CambioRP[]): { tareas: GuardPatch[]; proyectos: GuardProjPatch[] } {
  const tareas: GuardPatch[] = [];
  const proyectos: GuardProjPatch[] = [];
  for (const c of cs) {
    if (c.k === 'p') proyectos.push({ id: c.id, score: c.score, scoreRazon: c.scoreRazon ?? '', emoji: '', detalle: '' });
    else { const { k: _k, ts: _ts, ...p } = c; tareas.push(p); }
  }
  return { tareas, proyectos };
}
