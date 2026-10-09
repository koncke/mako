// =============================================================================
// nutricion-grafo-motor — lo que el MOTOR decide sobre un flujo con ramas (puro)
// =============================================================================
// El modelo del flujo vive en lib/flujo-grafo.ts (sólo lectura: lo comparten el lienzo, el
// simulador y el script de migración). Acá están las decisiones que son SÓLO del motor
// (lib/nutricion.ts), sin base y sin `server-only`, para que tengan test:
//
//   · en qué nodo está una inscripción (`nodo_actual`, y si no, `pasos[paso_actual]`);
//   · cómo se resuelven los nodos de CONTROL (condición, espera, «ir a») antes de las guardas;
//   · qué queda alcanzable después de un nodo (el canal apagado lo pregunta);
//   · si un mensaje sale solo o queda como borrador (`revisar`, por nodo);
//   · los hechos del lead con los que se evalúa una condición, con la MISMA regla de
//     «agendó» y «pagó» que el desenlace de antes (`seLogro`, lib/nutricion-desenlace.ts);
//   · el saneo de los campos del flujo que hace `setSecuenciaPasos`, que reconstruye cada
//     paso campo por campo y BORRA lo que no conoce (AGENTS.md: la quinta puerta);
//   · cuándo una operación «por orden» de la API de MaKo puede tocar los pasos sin romper
//     el grafo, y cómo entra un caso enseñado a «Si responde».
//
// El motor es el que ESCRIBE; acá no se lee ni se escribe nada.
// =============================================================================

import {
  CAMPOS_CONDICION, TOPE_CASOS, TOPE_NODOS,
  claseDe, idDe, indicePorId, siguienteDe, puertosDe, raizSalida, raizRespuesta, padreDe, elegirSalida,
  normalizar, nuevoId, paralelosDeResultado,
  type PasoGrafo, type HechosLead, type FilaCondicion, type RamaCondicion, type CasoRespuesta, type Espera, type DestinoIrA,
} from './flujo-grafo';
import { TRIGGER_ETIQUETA } from './nutricion-etapa';
import { condicionPorId, reunionesDeFila, TOPE_REUNIONES, type HechosCatalogo } from './condiciones-catalogo';
import { parseFechaJunta, reunionFuturaMs } from './nutricion-reinscripcion';
import { claseCompleta } from './curso-bloqueo';
import type { Clase, Progreso } from './curso';

/** Cuántos «Ir a» se siguen en una sola resolución. `validarGrafo` ya prohíbe el bucle sin espera: esto es la red. */
export const TOPE_SALTOS = 20;

// ── Dónde está una inscripción ──────────────────────────────────────────────────

/** Lo que el motor lee de una inscripción para saber en qué nodo está. */
export type PosicionInsc = { nodo_actual?: string | null; paso_actual: number };

/** El índice del nodo por el que ENTRA la salida (la raíz). -1 = no hay salida (sólo «Si responde»). */
export function indiceEntrada(pasos: readonly PasoGrafo[]): number {
  return indicePorId(pasos, raizSalida(pasos));
}

/** El nodo por el que entra la salida. Es el que programa el primer envío al inscribir. */
export function pasoDeEntrada<P extends PasoGrafo>(pasos: readonly P[]): P | undefined {
  const i = indiceEntrada(pasos);
  return i >= 0 ? pasos[i] : undefined;
}

/**
 * El índice del nodo en el que está una inscripción, o -1 si no está en ninguno.
 *
 * Por `nodo_actual` (mig 0223). ⚠️ UNA FILA QUE NUNCA AVANZÓ (`nodo_actual` NULL y
 * `paso_actual` 0) ESTÁ EN LA ENTRADA, que no tiene por qué ser el índice 0: el lienzo puede
 * dejar «Si responde» primero en el array. Todo lo que inscribe escribe `paso_actual: 0`, así
 * que esta es la única puerta que lo traduce.
 *
 * ⚠️ UN `nodo_actual` QUE YA NO EXISTE ES -1, NO `pasos[paso_actual]` (revisión del 08/10/2026).
 * Borrar una tarjeta corre el array un lugar, y en ese índice puede quedar la tarjeta de OTRA
 * rama: el lead cualificado recibía el mensaje de los no cualificados, que es justo lo que
 * `nodo_actual` vino a cerrar. El motor cierra la inscripción y lo dice.
 *
 * ⚠️ Y UNA FILA DE ANTES (`nodo_actual` NULL, `paso_actual` k > 0) SE BUSCA PRIMERO POR `o<k>`,
 * el id que `legadoAGrafo` les CONSERVA a los pasos de antes. Publicar desde el lienzo convierte
 * la secuencia sin reubicar las inscripciones vivas (eso sólo lo hace el script): con el índice
 * pelado, la de #212 parada en el paso 1 leía `pasos[1]`, que en el array nuevo es el audio que ya
 * le había llegado. Si `o<k>` no existe, el índice de siempre.
 */
export function indiceActual(pasos: readonly PasoGrafo[], insc: PosicionInsc): number {
  if (insc.nodo_actual != null && insc.nodo_actual !== '') return indicePorId(pasos, insc.nodo_actual);
  const k = Number(insc.paso_actual);
  if (!Number.isInteger(k) || k < 0) return -1;
  if (k === 0) return indiceEntrada(pasos);
  const deAntes = indicePorId(pasos, `o${k}`);
  if (deAntes >= 0) return deAntes;
  return k < pasos.length ? k : -1;
}

/** El índice del nodo al que sigue uno de una salida (mensaje, acción, espera). -1 = termina. */
export function siguienteIndice(pasos: readonly PasoGrafo[], idx: number): number {
  return indicePorId(pasos, siguienteDe(pasos, idx));
}

// ⚠️ EL INICIO TAMBIÉN (segunda tanda, 08/10/2026): no manda nada. Sin él acá, `setSecuenciaPasos`
// no le ponía el relleno de control y lo reconstruía como un mensaje, `esPrimerPaso` creía que la
// primera tarjeta de un hilo tenía un mensaje adelante, y la prueba, el generador y la API lo
// recorrían como un mensaje vacío.
const esControl = (p: PasoGrafo | undefined): boolean => {
  if (!p) return false;
  const c = claseDe(p);
  return c === 'condicion' || c === 'esperar' || c === 'ir_a' || c === 'respuesta' || c === 'inicio';
};

export const esNodoDeControl = esControl;

// ── Resolver los nodos de control ───────────────────────────────────────────────

export type ContextoControl = {
  /** Los hechos del lead. `null` = todavía no se leyeron: una condición contesta `faltan_hechos`. */
  hechos: HechosLead | null;
  ahoraMs: number;
  /** La próxima reunión del lead (ms). La necesita una espera «antes de la reunión». */
  reunionMs: number | null;
};

/**
 * Una flecha en paralelo que arranca un hilo NUEVO (segunda tanda, 08/10/2026): `destino` es su
 * primera tarjeta y `desdeMs`, desde cuándo puede correr (cuando venció la espera que la tiene, o
 * ahora si es el inicio o la espera ya había vencido).
 */
export type Reparto = { destino: string; desdeMs: number };

export type Resolucion = (
  /** Un mensaje o una acción: sigue a las guardas y al envío. */
  | { tipo: 'nodo'; idx: number; via: string[] }
  /** Una espera: se programa `proximoMs` y la inscripción pasa a `idx` (lo que sigue a la espera). */
  | { tipo: 'esperar'; idx: number; proximoMs: number; via: string[] }
  /** El flujo termina acá, sin mandar nada más. */
  | { tipo: 'fin'; motivo: string; via: string[] }
  /** «Ir a» otra automatización: se inscribe en ésa y ésta termina. */
  | { tipo: 'ir_a_secuencia'; secuenciaId: number; via: string[] }
  /** Una espera «antes de la reunión» sin reunión por delante: se cierra sin mandar, como el ancla de siempre. */
  | { tipo: 'sin_reunion'; via: string[] }
  /** Más de `TOPE_SALTOS` «Ir a» seguidos: un bucle que `validarGrafo` no dejó guardar, hecho a mano. */
  | { tipo: 'tope_saltos'; via: string[] }
) & {
  /**
   * Las flechas en paralelo que la resolución ENCONTRÓ en el camino (de una espera o del inicio).
   * ⚠️ SE DEVUELVEN AUNQUE LA RESOLUCIÓN SIGA DE LARGO: una espera ya vencida se pasa sin frenar,
   * y sin esto sus flechas en paralelo se perdían en silencio. Vacío en un flujo sin paralelos.
   */
  repartos: Reparto[];
}
  /** Hay que evaluar una condición y no hay hechos: leerlos y volver a llamar. */
  | { tipo: 'faltan_hechos' };

/** Las flechas en paralelo de una tarjeta (sin repetidos ni vacías), tal como las recorre el motor. */
function paralelosDelNodo(pasos: readonly PasoGrafo[], idx: number): string[] {
  return puertosDe(pasos, idx).flatMap((pt) => (pt.puerto.startsWith('par:') && pt.destino ? [pt.destino] : []));
}

/**
 * Resuelve los nodos de CONTROL desde `desde` hasta el primer mensaje o acción.
 *
 * ⚠️ VA ANTES DE LAS GUARDAS Y EL RESULTADO SE ESCRIBE (diseño §2). Una condición se decide
 * con lo que el lead ES ahora; una espera programa el próximo envío y pasa la inscripción a
 * lo que sigue (no se queda parada en la espera: la vuelta siguiente ya es el mensaje); un
 * «Ir a» a un nodo salta, y a otra automatización termina ésta.
 *
 * Una espera cuyo momento YA pasó (una «1 h antes de la reunión» con la reunión en 30 min)
 * no frena: se sigue de largo, igual que `proximoEnvioDePaso` hacía con el ancla.
 */
export function resolverControl(pasos: readonly PasoGrafo[], desde: number, ctx: ContextoControl): Resolucion {
  const via: string[] = [];
  const repartos: Reparto[] = [];
  const repartir = (i: number, desdeMs: number) => {
    for (const d of paralelosDelNodo(pasos, i)) if (!repartos.some((r) => r.destino === d)) repartos.push({ destino: d, desdeMs });
  };
  let idx = desde;
  let saltos = 0;
  for (let vuelta = 0; vuelta <= TOPE_NODOS * 2 + TOPE_SALTOS; vuelta++) {
    const p = pasos[idx];
    if (!p) return { tipo: 'fin', motivo: 'no hay más tarjetas', via, repartos };
    const c = claseDe(p);
    if (c === 'mensaje' || c === 'accion') return { tipo: 'nodo', idx, via, repartos };
    via.push(idDe(p, idx));
    if (c === 'respuesta') return { tipo: 'fin', motivo: '«Si responde» no corre en la salida', via, repartos };
    if (c === 'inicio') {
      // El CRON con flechas en paralelo. El motor arranca un hilo por raíz al inscribir
      // (`raicesSalida`) y nunca debería pararse acá; si una fila llega a esta tarjeta igual, se
      // sigue por su salida principal y sus flechas arrancan ahora.
      repartir(idx, ctx.ahoraMs);
      const j = siguienteIndice(pasos, idx);
      if (j < 0) return { tipo: 'fin', motivo: 'el CRON no tiene una salida principal', via, repartos };
      idx = j;
      continue;
    }
    if (c === 'condicion') {
      if (!ctx.hechos) return { tipo: 'faltan_hechos' };
      const s = elegirSalida(p, ctx.hechos);
      // CUARTA TANDA, PUNTO 8 («varias si se cumple y varias si no se cumple»): las flechas en
      // paralelo del RESULTADO ELEGIDO arrancan ahora, sea cual sea el desenlace de su principal. Las
      // del otro resultado no corren para este lead. Es el mismo `repartos` que una espera o el
      // inicio: el motor (`nuevosDe` → `escribir`) no distingue de dónde salió la flecha.
      for (const d of paralelosDeResultado(p, s.puerto)) if (!repartos.some((r) => r.destino === d)) repartos.push({ destino: d, desdeMs: ctx.ahoraMs });
      const j = indicePorId(pasos, s.destino);
      if (j < 0) return { tipo: 'fin', motivo: 'la condición termina aquí', via, repartos };
      idx = j;
      continue;
    }
    if (c === 'esperar') {
      const j = siguienteIndice(pasos, idx);
      const tieneParalelos = paralelosDelNodo(pasos, idx).length > 0;
      // Esperar para no hacer nada después es lo mismo que terminar ahora (salvo que la espera
      // tenga flechas en paralelo: esas arrancan cuando vence, aunque este camino termine).
      if (j < 0 && !tieneParalelos) return { tipo: 'fin', motivo: 'no hay nada después de la espera', via, repartos };
      const minutos = Math.max(0, Number(p.espera?.minutos) || 0);
      let objetivo: number;
      if (p.espera?.modo === 'antes_reunion') {
        if (ctx.reunionMs == null) return { tipo: 'sin_reunion', via, repartos };
        objetivo = ctx.reunionMs - minutos * 60_000;
      } else {
        objetivo = ctx.ahoraMs + minutos * 60_000;
      }
      repartir(idx, Math.max(objetivo, ctx.ahoraMs));
      if (j < 0) return { tipo: 'fin', motivo: 'no hay nada después de la espera', via, repartos };
      if (objetivo <= ctx.ahoraMs) { idx = j; continue; }
      return { tipo: 'esperar', idx: j, proximoMs: objetivo, via, repartos };
    }
    // ir_a
    const d = p.destino;
    if (!d) return { tipo: 'fin', motivo: '«Ir a» sin destino', via, repartos };
    if ('secuencia_id' in d) {
      const sid = Number(d.secuencia_id);
      if (!Number.isInteger(sid) || sid <= 0) return { tipo: 'fin', motivo: '«Ir a» sin destino', via, repartos };
      return { tipo: 'ir_a_secuencia', secuenciaId: sid, via, repartos };
    }
    saltos += 1;
    if (saltos > TOPE_SALTOS) return { tipo: 'tope_saltos', via, repartos };
    const j = indicePorId(pasos, d.nodo);
    if (j < 0) return { tipo: 'fin', motivo: 'el «Ir a» apunta a una tarjeta que ya no existe', via, repartos };
    idx = j;
  }
  return { tipo: 'tope_saltos', via, repartos };
}

/**
 * ¿Resolver desde `desde` puede pasar por una condición? Es lo que decide si hay que LEER los
 * hechos del lead (en batch, por lote): sin ninguna condición en el camino, no se lee nada.
 * Sigue esperas y saltos de largo, sin mirar el reloj: leer de más es barato, de menos no.
 */
export function necesitaHechos(pasos: readonly PasoGrafo[], desde: number): boolean {
  const vistos = new Set<number>();
  let idx = desde;
  while (idx >= 0 && !vistos.has(idx) && vistos.size <= TOPE_NODOS + TOPE_SALTOS) {
    vistos.add(idx);
    const p = pasos[idx];
    if (!p) return false;
    const c = claseDe(p);
    if (c === 'condicion') return true;
    if (c === 'esperar' || c === 'inicio') { idx = siguienteIndice(pasos, idx); continue; }
    if (c === 'ir_a' && p.destino && 'nodo' in p.destino) { idx = indicePorId(pasos, p.destino.nodo); continue; }
    return false;
  }
  return false;
}

/**
 * Los índices que quedan ALCANZABLES después de un nodo: por sus salidas y por los «Ir a»
 * a otra tarjeta. Lo pregunta la regla del canal apagado («¿queda algo enviable después?»),
 * que antes miraba el resto del ARRAY: con ramas, lo que está más abajo en el array puede ser
 * otra rama que este lead no va a recorrer nunca.
 */
export function alcanzablesDesde(pasos: readonly PasoGrafo[], idx: number): number[] {
  const out = new Set<number>();
  const pila: number[] = [];
  const empujar = (destino: string | null | undefined) => {
    const j = indicePorId(pasos, destino ?? null);
    if (j >= 0 && !out.has(j)) { out.add(j); pila.push(j); }
  };
  for (const pt of puertosDe(pasos, idx)) empujar(pt.destino);
  const p0 = pasos[idx];
  if (p0 && claseDe(p0) === 'ir_a' && p0.destino && 'nodo' in p0.destino) empujar(p0.destino.nodo);
  while (pila.length) {
    const j = pila.pop()!;
    const p = pasos[j];
    if (!p) continue;
    if (claseDe(p) === 'ir_a') {
      if (p.destino && 'nodo' in p.destino) empujar(p.destino.nodo);
      continue;
    }
    for (const pt of puertosDe(pasos, j)) empujar(pt.destino);
  }
  out.delete(idx);
  return [...out].sort((a, b) => a - b);
}

/**
 * ¿Es el PRIMER mensaje o acción de la salida? (Nada que mande o haga algo cuelga antes que él.)
 *
 * Era `paso_actual === 0`, y con ramas el primer mensaje puede estar en cualquier índice: detrás
 * de la condición «Llegó hace menos de N h» que el conversor pone primero. El tope de antigüedad
 * se vuelve a mirar al mandar el PRIMERO —una bienvenida tardía es peor que ninguna—, no los
 * seguimientos de quien ya la recibió.
 */
export function esPrimerPaso(pasos: readonly PasoGrafo[], idx: number): boolean {
  const vistos = new Set<string>();
  let cur = pasos[idx] ? idDe(pasos[idx], idx) : null;
  while (cur && !vistos.has(cur)) {
    vistos.add(cur);
    const pa = padreDe(pasos, cur);
    if (!pa) return true;
    const p = pasos[indicePorId(pasos, pa.id)];
    if (p && !esControl(p)) return false;
    cur = pa.id;
  }
  return true;
}

/**
 * Si el nodo cuelga de una espera «N antes de la reunión», sus minutos. Un mensaje así es un
 * recordatorio: igual que el paso con `ancla: 'reunion'` de siempre, al mandarlo se vuelve a
 * mirar la agenda (sin reunión por delante se cierra; si el lead reprogramó para más tarde, se
 * re-ancla y espera).
 *
 * ⚠️ UN MENSAJE SUBE POR LAS CONDICIONES hasta la primera espera (revisión del 08/10/2026). El
 * conversor arma espera(antes de la reunión) → condición («Termina si paga») → mensaje, y la
 * espera deja la inscripción parada en la CONDICIÓN: mirando sólo el padre directo, el mensaje
 * no era un recordatorio y salía «Mañana es tu reunión» cuatro días antes, o para una reunión
 * cancelada. Una condición no espera: lo que el mensaje recuerda lo decide la espera de arriba.
 *
 * Una ACCIÓN mira sólo su padre directo, como siempre: la que cuelga de la condición es la del
 * logro («ya pagó → movelo»), y re-anclarla la postergaba hasta la reunión nueva.
 */
export function minutosAntesDeReunion(pasos: readonly PasoGrafo[], idx: number): number | null {
  const p = pasos[idx];
  if (!p) return null;
  const sube = claseDe(p) === 'mensaje';
  const vistos = new Set<string>();
  let cur = idDe(p, idx);
  while (!vistos.has(cur)) {
    vistos.add(cur);
    const pa = padreDe(pasos, cur);
    if (!pa) return null;
    const padre = pasos[indicePorId(pasos, pa.id)];
    if (!padre) return null;
    const c = claseDe(padre);
    if (c === 'esperar') return padre.espera?.modo === 'antes_reunion' ? Math.max(0, Number(padre.espera.minutos) || 0) : null;
    if (!sube || c !== 'condicion') return null;
    cur = pa.id;
  }
  return null;
}

/**
 * «Sale sola» POR NODO (punto 6 del pedido: el checkbox de la tarjeta del CRON no se entendía).
 * `revisar: true` = queda como BORRADOR; `false` = sale; ausente = lo que diga la secuencia
 * (`estrategia.envio_automatico`), que es como se comporta todo lo escrito antes del 08/10/2026.
 * La regla dura de siempre sigue arriba de esto: a quien ya pagó le sale igual.
 */
export function saleSolo(p: { revisar?: boolean | null }, envioAutomatico: boolean): boolean {
  if (p.revisar === true) return false;
  if (p.revisar === false) return true;
  return envioAutomatico === true;
}

/**
 * El primer nodo, siguiendo la cadena desde `idx` (incluido), que NO tiene `requiere` igual a
 * `req`. Es el «saltear el paso que espera respuesta» de siempre, por el `siguiente` de cada
 * nodo y no por el índice. -1 = no queda ninguno.
 */
export function siguienteSin(pasos: readonly PasoGrafo[], idx: number, req: string): number {
  const vistos = new Set<number>();
  let j = idx;
  while (j >= 0 && !vistos.has(j)) {
    vistos.add(j);
    const p = pasos[j];
    if (!p) return -1;
    if (p.requiere !== req) return j;
    j = siguienteIndice(pasos, j);
  }
  return -1;
}

/** El primer nodo, siguiendo la cadena desde `idx` (incluido), que SÍ tiene `requiere === req`. -1 = ninguno. */
export function siguienteCon(pasos: readonly PasoGrafo[], idx: number, req: string): number {
  const vistos = new Set<number>();
  let j = idx;
  while (j >= 0 && !vistos.has(j)) {
    vistos.add(j);
    const p = pasos[j];
    if (!p) return -1;
    if (p.requiere === req) return j;
    j = siguienteIndice(pasos, j);
  }
  return -1;
}

// ── Los hechos del lead ─────────────────────────────────────────────────────────

/** Lo que hace falta de la fila del lead. Los nombres son los de `leads`. */
export type FilaHechos = {
  id: number;
  created_at?: string | null;
  telefono?: string | null;
  email?: string | null;
  fecha_junta_1?: string | null;
  junta_1_at?: string | null;
  fecha_junta_2?: string | null;
  junta_2_at?: string | null;
  fecha_primer_pago?: string | null;
  cerro?: boolean | null;
};

/**
 * ¿Agendó? CUALQUIER reunión cargada, la primera o la segunda. Es la regla de `seLogro`
 * (lib/nutricion-desenlace.ts) y vive acá para que la condición «Agendó» y el desenlace de
 * antes contesten lo mismo: el conversor pasa «Termina si agenda» a esta condición, y si las
 * dos reglas difirieran, una secuencia convertida terminaría en otro momento que antes.
 */
export function agendoLead(l: Pick<FilaHechos, 'fecha_junta_1' | 'junta_1_at' | 'fecha_junta_2' | 'junta_2_at'> | Record<string, unknown>): boolean {
  const r = l as Record<string, unknown>;
  return [r.fecha_junta_1, r.junta_1_at, r.fecha_junta_2, r.junta_2_at].some((x) => typeof x === 'string' && x !== '');
}

/** ¿Pagó? `fecha_primer_pago` o `cerro`. La misma regla de `seLogro`. */
export function pagoLead(l: Pick<FilaHechos, 'fecha_primer_pago' | 'cerro'> | Record<string, unknown>): boolean {
  const r = l as Record<string, unknown>;
  return Boolean(r.fecha_primer_pago) || r.cerro === true;
}

/** Lo que el motor lee aparte de la fila, en batch. */
export type ExtrasHechos = {
  etiquetas?: ReadonlySet<number>;
  /** La etapa de la CASA (`pipelineStageOf`: el override manual o la derivada). */
  etapaCasa: string | null;
  /** funnel_id → etapa, con la casa incluida (la casa no tiene fila en `lead_funnel`). */
  etapasPorProducto?: ReadonlyMap<number, string>;
  yaContactado: boolean;
  respondio: boolean;
  /** Lo que leyeron las fuentes del catálogo (lib/condiciones-catalogo.ts). Ausente = ninguna. */
  catalogo?: HechosCatalogo;
};

/** Los hechos con los que se evalúa una condición (`HechosLead`, lib/flujo-grafo.ts). */
export function hechosDeLead(fila: FilaHechos, x: ExtrasHechos, ahoraMs: number): HechosLead {
  const creado = fila.created_at ? Date.parse(fila.created_at) : NaN;
  return {
    ...(x.catalogo ? { catalogo: x.catalogo } : {}),
    etiquetas: x.etiquetas ?? new Set<number>(),
    etapa: x.etapaCasa,
    etapasPorProducto: x.etapasPorProducto ?? new Map<number, string>(),
    agendo: agendoLead(fila),
    pago: pagoLead(fila),
    yaContactado: x.yaContactado,
    respondio: x.respondio,
    creadoMs: Number.isFinite(creado) ? creado : null,
    tieneTelefono: !!String(fila.telefono ?? '').replace(/\D/g, ''),
    tieneEmail: /\S+@\S+/.test(String(fila.email ?? '')),
    ahoraMs,
  };
}

// ── Los hechos del CATÁLOGO, desde lo leído (puro: lo ejecuta tests/condiciones-motor.test.ts) ──

/** Lo que el motor lee de la fila de `leads` para el bloque `lead` del catálogo. */
export type FilaLeadCatalogo = {
  origen_lead?: string | null; estado_lead?: string | null; calificado?: boolean | null;
  meta_lead_id?: string | null; visitor_id?: string | null; meta_campaign_name?: string | null;
  email_opt_out?: boolean | null; venta_tipo?: string | null; fecha_agenda?: string | null;
  fecha_junta_1?: string | null; junta_1_at?: string | null; asistio_j1?: boolean | null;
  fecha_junta_2?: string | null; junta_2_at?: string | null; asistio_j2?: boolean | null;
  cerro?: boolean | null; fecha_cierre?: string | null; fecha_confirmacion?: string | null;
};

const msJunta = (x: string | null | undefined): number | null => {
  if (!x) return null;
  const ms = parseFechaJunta(x);
  return Number.isFinite(ms) ? ms : null;
};

/**
 * El bloque `lead` del catálogo. Las reuniones se leen con la MISMA regla que el motor
 * (`parseFechaJunta`: una fecha sin hora es el mediodía de México) y la próxima con
 * `reunionFuturaMs`, la que usa el ancla «antes de la reunión».
 */
export function catalogoDeLead(f: FilaLeadCatalogo, ahoraMs: number): NonNullable<HechosCatalogo['lead']> {
  return {
    origen: f.origen_lead ?? null,
    estado: f.estado_lead ?? null,
    calificado: f.calificado ?? null,
    deFormularioMeta: !!f.meta_lead_id,
    conVisitante: !!f.visitor_id,
    campana: f.meta_campaign_name?.trim() || null,
    emailBaja: f.email_opt_out === true,
    ventaTipo: f.venta_tipo ?? null,
    tieneFechaAgenda: !!f.fecha_agenda,
    r1: { fechaMs: msJunta(f.junta_1_at ?? f.fecha_junta_1), asistio: f.asistio_j1 ?? null },
    r2: { fechaMs: msJunta(f.junta_2_at ?? f.fecha_junta_2), asistio: f.asistio_j2 ?? null },
    cerro: f.cerro ?? null,
    tieneFechaCierre: !!f.fecha_cierre,
    confirmoCompra: !!f.fecha_confirmacion,
    proximaReunionMs: reunionFuturaMs(f, ahoraMs),
  };
}

/** Las clases tal como las necesita el resumen: su curso, su módulo y lo que la completa. */
export type ClaseParaResumen = Pick<Clase, 'id' | 'productoId' | 'etapa' | 'tarea' | 'campos' | 'videoTipo' | 'videoUrl' | 'videoPath'> & { tareaHtml?: string | null };

/**
 * El bloque `curso` del catálogo para UN alumno. «Completó» es la regla del portal
 * (`claseCompleta`, lib/curso-bloqueo.ts: tarea enviada, el tilde de hecha, o el video visto hasta
 * `PCT_VISTO`); un módulo está completo con TODAS sus clases completas; el avance es el % de
 * clases completas de cada curso. Se inicializa con el UNIVERSO: todo curso con clases entra al
 * mapa (0 % si no hizo nada), así «no lo empezó» no se confunde con «no sé».
 *
 * `progreso` es el EFECTIVO (`progresoDeClientes`): una clase por área cuenta enviada cuando la
 * enviaron todas sus áreas, como en el portal y en la ficha.
 */
export function resumenCursoDeAlumno(
  clases: readonly ClaseParaResumen[],
  progreso: ReadonlyMap<number, Pick<Progreso, 'estado' | 'pct' | 'hechaAt'>> | undefined,
): NonNullable<HechosCatalogo['curso']> {
  const completas = new Set<number>();
  const enviadas = new Set<number>();
  const aprobadas = new Set<number>();
  const porModulo = new Map<string, { total: number; hechas: number }>();
  const porCurso = new Map<number, { total: number; hechas: number }>();
  for (const c of clases) {
    const p = progreso?.get(c.id);
    const completa = claseCompleta(c, p);
    if (completa) completas.add(c.id);
    if (p?.estado === 'enviada' || p?.estado === 'aprobada') enviadas.add(c.id);
    if (p?.estado === 'aprobada') aprobadas.add(c.id);
    const km = `${c.productoId}:${c.etapa}`;
    const m = porModulo.get(km) ?? { total: 0, hechas: 0 };
    m.total += 1; if (completa) m.hechas += 1;
    porModulo.set(km, m);
    const k = porCurso.get(c.productoId) ?? { total: 0, hechas: 0 };
    k.total += 1; if (completa) k.hechas += 1;
    porCurso.set(c.productoId, k);
  }
  const modulosCompletos = new Set([...porModulo].filter(([, m]) => m.total > 0 && m.hechas === m.total).map(([k]) => k));
  const avance = new Map([...porCurso].map(([id, k]) => [id, Math.round((100 * k.hechas) / k.total)] as [number, number]));
  return { completas, enviadas, aprobadas, modulosCompletos, avance };
}

/** Cuotas pagadas y vencidas (impagas con fecha esperada ANTES de hoy, en el día del negocio). */
export function resumenPagos(cuotas: ReadonlyArray<{ pagado: boolean | null; fecha_esperada: string | null }>, hoy: string): { pagadas: number; vencidas: number } {
  let pagadas = 0;
  let vencidas = 0;
  for (const c of cuotas) {
    if (c.pagado === true) pagadas++;
    // Sin fecha esperada nunca se puede declarar vencida (la regla de lib/cs-senal.ts).
    else if (c.fecha_esperada && c.fecha_esperada.slice(0, 10) < hoy) vencidas++;
  }
  return { pagadas, vencidas };
}

/**
 * ¿El error de una lectura dice que la TABLA no existe? `crm_lead_etiquetas` la crea la 0224
 * (otra parte del rediseño): hasta que esté aplicada, una condición «Tiene la etiqueta X» se
 * evalúa con el conjunto vacío y la corrida sigue. Cualquier OTRO error no es esto.
 */
export function esTablaInexistente(e: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!e) return false;
  if (e.code === 'PGRST205' || e.code === '42P01') return true;
  return /could not find the table|does not exist/i.test(String(e.message ?? '')) && /relation|table/i.test(String(e.message ?? ''));
}

/**
 * ¿El error dice que falta una COLUMNA? Es la forma en que falla todo `select` de las secuencias
 * con el deploy adelantado a la 0223 (`etiqueta_id`): PostgREST rechaza la consulta ENTERA.
 * La pregunta `pausarPorRespuesta` antes de marcar 'respondio' (ver ahí).
 */
export function esColumnaInexistente(e: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!e) return false;
  if (e.code === '42703' || e.code === 'PGRST204') return true;
  const m = String(e.message ?? '');
  return /column\s+\S+\s+does not exist|could not find the '?[\w.]+'? column/i.test(m);
}

// ── Lo que fijó la revisión adversarial del 08/10/2026 ──────────────────────────

/**
 * Las etiquetas que CUENTAN para una condición: las puestas, menos las ARCHIVADAS.
 *
 * Decisión del 08/10/2026: archivar una etiqueta la APAGA. Los leads conservan la fila (es su
 * historia), pero «Tiene X» deja de cumplirse y su disparador deja de inscribir. Es lo que la
 * propuesta de archivar le promete al dueño («las condiciones dejan de cumplirse»), y hasta acá
 * el motor la seguía cumpliendo para todos los que ya la tenían.
 */
export function etiquetasQueCuentan(puestas: Iterable<number>, archivadas: ReadonlySet<number>): Set<number> {
  const out = new Set<number>();
  for (const id of puestas) if (!archivadas.has(Number(id))) out.add(Number(id));
  return out;
}

/**
 * ¿El BARRIDO horario inscribe a la cohorte de esta secuencia?
 *
 * Decisión del 08/10/2026: «Se le puso una etiqueta» SIN horario (el CRON «por una acción») es
 * SÓLO el evento: el barrido no inscribe por etiqueta. Si barriera, poner la etiqueta en LOTE o
 * por el espejo de una etapa —que a propósito no disparan— terminaba disparando igual en la
 * corrida siguiente, a 200 leads y por la línea no oficial. CON horario (el CRON «por tiempo») sí
 * barre a los que la tienen: es lo que el dueño eligió al poner el horario.
 *
 * El resto de los disparadores, como siempre: su cohorte es la red del evento.
 */
export function barridoInscribe(s: { trigger_tipo: string; cron: unknown }): boolean {
  if (s.trigger_tipo === TRIGGER_ETIQUETA) return s.cron != null;
  return true;
}

/**
 * ¿El logro de la estrategia CIERRA la inscripción (`evaluarDesenlaces`)?
 *
 * Decisión del 08/10/2026: la limpieza de una secuencia convertida CONSERVA `desenlace.logrado`
 * (lib/flujo-legado.ts, `limpiezaPara`). En un flujo de TARJETAS un «agendó» o un «pagó» no
 * interrumpe la secuencia: lo hacen sus condiciones, que el conversor puso delante de cada
 * mensaje. Cerrarla también acá serían dos reglas para lo mismo. «Respondió» sí se sigue
 * cerrando como lograda: ninguna tarjeta lo hace, y sin eso la inscripción queda en 'respondio'
 * para siempre (no se reusa cuando el lead reagenda).
 */
export function logroCierraLaInscripcion(logrado: string, flujoDeTarjetas: boolean): boolean {
  if (logrado === 'ninguno' || !logrado) return false;
  if (flujoDeTarjetas && (logrado === 'agendo' || logrado === 'pago')) return false;
  return true;
}

/**
 * Los índices de los «Ir a» que apuntan a la MISMA automatización. Un «Sigue con» a sí misma
 * (una clave mal puesta) era un bucle que reenviaba la secuencia entera en cada vuelta; lo
 * rechaza `setSecuenciaPasos` y, si llega igual, el motor lo cierra sin seguirlo.
 */
export function irAEstaMisma(pasos: readonly PasoGrafo[], secuenciaId: number): number[] {
  const out: number[] = [];
  pasos.forEach((p, i) => {
    if (claseDe(p) !== 'ir_a' || !p.destino || !('secuencia_id' in p.destino)) return;
    if (Number(p.destino.secuencia_id) === Number(secuenciaId)) out.push(i);
  });
  return out;
}

/**
 * El comienzo del resumen con que `avisar_al_equipo` contesta que el aviso NO salió porque ya
 * había salido (la deduplicación de `emitirAviso`). Lo lee el motor (`avisoSalio`): un aviso
 * deduplicado no es un aviso, y sin el de respaldo nadie se entera de esa respuesta.
 */
export const AVISO_REPETIDO = 'Ya le había avisado al equipo';

/** ¿El aviso al equipo salió de verdad? Ni falló ni quedó deduplicado. */
export function avisoSalio(r: { ok: boolean; resumen: string }): boolean {
  return r.ok && !r.resumen.startsWith(AVISO_REPETIDO);
}

// ── El freno anti-ban, POR CANAL (decisión 5 de la segunda tanda, 08/10/2026) ───

/** Los dos canales que el freno distingue. Todo lo que no es email frena como WhatsApp. */
export type CanalFreno = 'whatsapp' | 'email';
export const canalDelFreno = (canal: string | null | undefined): CanalFreno => (canal === 'email' ? 'email' : 'whatsapp');

/** Los leads que recibieron algo en la ventana del freno, leídos de la base, uno por canal. */
export type RecientesPorCanal = { whatsapp: ReadonlySet<number>; email: ReadonlySet<number> };

/** Lo que salió EN ESTA corrida, por lead y por canal (`enviadoEnCorrida`). */
export type EnviadoEnCorrida = Map<number, Set<CanalFreno>>;

/**
 * ¿El freno de 20 h para a este mensaje? Mira LAS DOS cosas: lo que dice la base (leído UNA vez
 * por lote) y lo que salió en esta misma corrida.
 *
 * ⚠️ SIN LA SEGUNDA, DOS HILOS DE WHATSAPP DEL MISMO LEAD SALÍAN EN LA MISMA VUELTA: la lectura
 * de la base es por lote y no se entera de lo que el lote acaba de mandar. Y SIN EL CANAL, un
 * email frenaba al WhatsApp 20 h (y al revés): el ejemplo de Martín —WhatsApp y email desde el
 * mismo CRON— salía con un día de diferencia.
 */
export function frenadoPorAntiBan(leadId: number, canal: string | null | undefined, deLaBase: RecientesPorCanal, enCorrida: ReadonlyMap<number, ReadonlySet<CanalFreno>>): boolean {
  const c = canalDelFreno(canal);
  return deLaBase[c].has(leadId) || enCorrida.get(leadId)?.has(c) === true;
}

/** Anota que a este lead le salió algo (un envío o un borrador) por este canal en esta corrida. */
export function anotarEnCorrida(m: EnviadoEnCorrida, leadId: number, canal: string | null | undefined): void {
  const s = m.get(leadId) ?? new Set<CanalFreno>();
  s.add(canalDelFreno(canal));
  m.set(leadId, s);
}

// ── La ventana horaria, en la zona del NEGOCIO (decisión 6) ─────────────────────

/**
 * La zona de un negocio que no tiene `mako.timezone`: Ciudad de México, que es lo que el motor
 * hacía siempre (`TZ_OFFSET_MX = -6`). No es `TZ_DEFAULT` (Tijuana) a propósito: cambiar la
 * ventana de los que no tienen zona sería mover cuándo les sale todo, sin que nadie lo pidiera.
 */
export const ZONA_SIN_CONFIGURAR = 'America/Mexico_City';

/** ¿Es una zona IANA que el runtime conoce? */
export function zonaValida(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

/** La zona con la que corre el motor: la guardada si es válida, si no Ciudad de México. */
export function zonaDelMotor(guardada: unknown): string {
  return zonaValida(guardada) ? guardada : ZONA_SIN_CONFIGURAR;
}

/** La hora de pared (0-23) de un instante en una zona. */
export function horaEnZona(ahoraMs: number, tz: string): number {
  const h = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(new Date(ahoraMs));
  return Number(h) % 24;
}

/** ¿Este instante cae entre `inicio` (incluida) y `fin` (excluida) en la zona del negocio? */
export function dentroDeVentanaEn(ahoraMs: number, tz: string, inicio: number, fin: number): boolean {
  const h = horaEnZona(ahoraMs, tz);
  return h >= inicio && h < fin;
}

// ── La fecha de una reunión, en palabras y en la zona del negocio ───────────────

/**
 * «viernes 9 de octubre, 18:00» para el aviso «no confirmó» (lib/nutricion-desenlace.ts).
 *
 * ⚠️ SE ESCRIBÍA EN LA ZONA DEL SERVIDOR, que en Vercel es UTC: medido el 08/10/2026 en el grupo de
 * Mauricio, el aviso dijo «sábado 10, 01:00 a.m.» para una reunión del viernes 9 a las 18 de
 * Tijuana. La hora va en la zona del NEGOCIO (`tz`). Una fecha sin hora (sólo el día) se dice sin
 * hora: inventarle una sería afirmar algo que nadie cargó.
 */
export function textoFechaReunion(lead: Record<string, unknown>, tz: string): string {
  const raw = [lead.junta_1_at, lead.fecha_junta_1, lead.fecha_agenda].find((x) => typeof x === 'string' && x);
  if (typeof raw !== 'string') return '';
  const soloDia = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  // Un día suelto se lee a mediodía UTC: cae en ese mismo día en cualquier zona de América.
  const d = new Date(soloDia ? `${raw}T12:00:00Z` : raw);
  if (Number.isNaN(d.getTime())) return '';
  const zona = zonaValida(tz) ? tz : ZONA_SIN_CONFIGURAR;
  try {
    return soloDia
      ? d.toLocaleDateString('es-MX', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })
      : d.toLocaleString('es-MX', { timeZone: zona, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  } catch { return ''; }
}

// ── Archivos ────────────────────────────────────────────────────────────────────

/** Cómo sale un archivo de la biblioteca por Evolution: imagen, video o documento según el mime. */
export function mediaDeAdjunto(a: { media_mime: string; nombre_archivo?: string | null; titulo?: string | null }): {
  tipo: 'image' | 'video' | 'document'; mimetype: string; fileName?: string;
} {
  const mime = String(a.media_mime || 'application/octet-stream').toLowerCase();
  const tipo = mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : 'document';
  if (tipo !== 'document') return { tipo, mimetype: mime };
  // ⚠️ UN DOCUMENTO SIN NOMBRE LLEGA COMO «Untitled»: el nombre es obligatorio. El de la
  // biblioteca primero; si no hay, el título con la extensión del mime.
  const nombre = (a.nombre_archivo ?? '').trim();
  if (nombre) return { tipo, mimetype: mime, fileName: nombre };
  const ext = mime.split('/')[1]?.split(/[+;]/)[0] ?? '';
  const base = (a.titulo ?? '').trim().replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 80) || 'archivo';
  return { tipo, mimetype: mime, fileName: ext && !base.toLowerCase().endsWith(`.${ext}`) ? `${base}.${ext}` : base };
}

// ── El saneo de los campos del flujo (lo que guarda `setSecuenciaPasos`) ─────────

const RX_ID = /^[A-Za-z0-9_-]{1,60}$/;
const idValido = (x: unknown): x is string => typeof x === 'string' && RX_ID.test(x);
const destinoId = (x: unknown): string | null | undefined => (x === null ? null : idValido(x) ? x : undefined);
// 'inicio' (segunda tanda, 08/10/2026): el CRON con flechas en paralelo. Sin él acá, el primer
// guardado lo volvía un mensaje vacío y las flechas del CRON se perdían en silencio.
const NODOS = new Set(['esperar', 'condicion', 'respuesta', 'ir_a', 'inicio']);
/** Un año de espera, en minutos. Una espera más larga es un dato roto, no una decisión. */
const TOPE_ESPERA_MIN = 366 * 24 * 60;

/**
 * Una fila de una condición, saneada. Acepta las nueve de antes y todo id del CATÁLOGO
 * (lib/condiciones-catalogo.ts), y CONSERVA lo que el catálogo suma —el operador (`op`) y la
 * referencia (`ref`)—: si no, `setSecuenciaPasos` los borraba en el primer guardado y «Avance del
 * curso ≥ 50 %» volvía como «≥ 50 %» de ningún curso (la quinta puerta, AGENTS.md). Un id que el
 * catálogo no conoce se descarta: nunca se cumpliría.
 */
function sanearFila(x: unknown): FilaCondicion | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  const def = condicionPorId(o.campo);
  if (!def && !CAMPOS_CONDICION.some((c) => c === o.campo)) return null;
  const campo = o.campo as FilaCondicion['campo'];
  const f: FilaCondicion = { campo };
  // La negación sólo donde el catálogo la ofrece (un número ya dice ≥ o ≤).
  if (o.no === true && (def?.negable ?? true)) f.no = true;
  if (typeof o.valor === 'number' && Number.isFinite(o.valor)) f.valor = o.valor;
  else if (typeof o.valor === 'string' && o.valor.trim()) f.valor = o.valor.trim().slice(0, 120);
  if (campo === 'etapa' && o.funnel_id != null && Number.isFinite(Number(o.funnel_id)) && Number(o.funnel_id) > 0) f.funnel_id = Number(o.funnel_id);
  if (def?.valor.t === 'numero' && (o.op === 'mayor_igual' || o.op === 'menor_igual')) f.op = o.op;
  if (def?.valor.t === 'numero' && def.valor.ref) {
    const r = Number(o.ref);
    if (Number.isInteger(r) && r > 0) f.ref = r;
  }
  // CUARTA TANDA (la quinta puerta otra vez): la unión con la fila de arriba (punto 7) y las etapas de
  // reunión elegidas (punto 5). Sin estas dos líneas, el primer guardado volvía «A o B» a «A y B» (el
  // `modo` de la rama) y «No asistió a la reunión «Discovery»» a «cualquier reunión».
  if (o.union === 'y' || o.union === 'o') f.union = o.union;
  if (def?.reuniones && Array.isArray(o.reuniones)) {
    const r = reunionesDeFila({ reuniones: o.reuniones.filter((x): x is string => typeof x === 'string' && x.length <= 120) })
      .slice(0, TOPE_REUNIONES).map((x) => `${x.funnelId}:${x.key}`);
    if (r.length) f.reuniones = r;
  }
  return f;
}

/**
 * TODAS las filas de las condiciones de un flujo. Es lo que decide qué FUENTES lee el motor
 * (`fuentesDeFilas`, lib/condiciones-catalogo.ts) en `hechosDeLeads`: se mira el flujo entero y
 * no sólo el camino de hoy, porque leer de más es una consulta y leer de menos es decidir sin el
 * dato.
 */
export function filasDelFlujo(pasos: readonly PasoGrafo[]): FilaCondicion[] {
  const out: FilaCondicion[] = [];
  for (const p of pasos) {
    if (!p || claseDe(p) !== 'condicion') continue;
    for (const r of p.ramas ?? []) out.push(...(r.filas ?? []));
  }
  return out;
}

function sanearRama(x: unknown): RamaCondicion | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  const filas = Array.isArray(o.filas) ? o.filas.map(sanearFila).filter((f): f is FilaCondicion => !!f) : [];
  // ⚠️ LA QUINTA PUERTA (AGENTS.md), cuarta tanda, punto 8: las flechas en paralelo de cada rama.
  // Sin esta línea `setSecuenciaPasos` las borraba en el primer guardado, sin error.
  const paralelos = sanearParalelos(o.paralelos);
  return {
    id: idValido(o.id) ? o.id : '',
    modo: o.modo === 'cualquiera' ? 'cualquiera' : 'todas',
    filas,
    siguiente: destinoId(o.siguiente) ?? null,
    ...(paralelos ? { paralelos } : {}),
  };
}

function sanearCaso(x: unknown): CasoRespuesta | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  return {
    id: idValido(o.id) ? o.id : '',
    titulo: typeof o.titulo === 'string' ? o.titulo.trim().slice(0, 120) : '',
    cuando: typeof o.cuando === 'string' ? o.cuando.trim().slice(0, 600) : '',
    siguiente: destinoId(o.siguiente) ?? null,
  };
}

function sanearEspera(x: unknown): Espera | undefined {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return undefined;
  const o = x as Record<string, unknown>;
  const minutos = Math.round(Number(o.minutos));
  // Minutos > 0 o nada: sin espera, `validarGrafo` contesta «la espera no dice cuánto».
  if (!(minutos > 0)) return undefined;
  return { modo: o.modo === 'antes_reunion' ? 'antes_reunion' : 'tiempo', minutos: Math.min(minutos, TOPE_ESPERA_MIN) };
}

function sanearDestino(x: unknown): DestinoIrA | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  if (o.secuencia_id != null) {
    const n = Number(o.secuencia_id);
    return Number.isInteger(n) && n > 0 ? { secuencia_id: n } : null;
  }
  return idValido(o.nodo) ? { nodo: o.nodo } : null;
}

/** Los campos que son SÓLO del flujo (los demás —canal, cuerpo, tipo…— los sanea el motor). */
export type CamposFlujo = Pick<PasoGrafo, 'id' | 'siguiente' | 'paralelos' | 'nodo' | 'espera' | 'ramas' | 'casos' | 'si_no' | 'paralelos_si_no' | 'destino' | 'revisar'>;

/**
 * Las flechas en paralelo, saneadas: ids válidos, sin repetidos. Sólo en las clases que las
 * admiten (mensaje, acción, espera, inicio): en una condición no significan nada y `normalizar`
 * las tiraría igual. Vacío = sin el campo.
 */
function sanearParalelos(x: unknown): string[] | undefined {
  if (!Array.isArray(x)) return undefined;
  const out: string[] = [];
  for (const d of x) if (idValido(d) && !out.includes(d)) out.push(d);
  return out.length ? out : undefined;
}

/**
 * Los campos del FLUJO de un paso, saneados uno por uno. Lo que no se reconoce no viaja: un
 * `siguiente` que no es un id, una fila de condición de un campo que no existe, una espera
 * sin minutos. Lo que queda inconsistente lo dice `validarGrafo` al guardar.
 */
export function camposDelFlujo(p: unknown): CamposFlujo {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return {};
  const o = p as Record<string, unknown>;
  const out: CamposFlujo = {};
  if (idValido(o.id)) out.id = o.id;
  if ('siguiente' in o) { const s = destinoId(o.siguiente); if (s !== undefined) out.siguiente = s; }
  const nodo = typeof o.nodo === 'string' && NODOS.has(o.nodo) ? (o.nodo as PasoGrafo['nodo']) : undefined;
  if (nodo) out.nodo = nodo;
  if (nodo === 'esperar') { const e = sanearEspera(o.espera); if (e) out.espera = e; }
  if (nodo === 'condicion') {
    out.ramas = Array.isArray(o.ramas) ? o.ramas.map(sanearRama).filter((r): r is RamaCondicion => !!r) : [];
    out.si_no = destinoId(o.si_no) ?? null;
    // Las flechas en paralelo del «Si no» (cuarta tanda, punto 8): la quinta puerta, como las de la rama.
    const parSiNo = sanearParalelos(o.paralelos_si_no);
    if (parSiNo) out.paralelos_si_no = parSiNo;
  }
  if (nodo === 'respuesta') {
    out.casos = Array.isArray(o.casos) ? o.casos.map(sanearCaso).filter((c): c is CasoRespuesta => !!c) : [];
    out.si_no = destinoId(o.si_no) ?? null;
  }
  if (nodo === 'ir_a') out.destino = sanearDestino(o.destino);
  if (!nodo && typeof o.revisar === 'boolean') out.revisar = o.revisar;
  // ⚠️ LA QUINTA PUERTA (AGENTS.md): `setSecuenciaPasos` reconstruye cada paso campo por campo, y
  // sin esta línea BORRABA las flechas en paralelo en el primer guardado, sin error.
  if (!nodo || nodo === 'esperar' || nodo === 'inicio') { const par = sanearParalelos(o.paralelos); if (par) out.paralelos = par; }
  return out;
}

/** Lo que un nodo de CONTROL lleva de relleno: los campos que todo paso tiene y que acá no dicen nada. */
export const RELLENO_CONTROL = { canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo: '', template_wa: null } as const;

// ── Las operaciones «por orden» de la API de MaKo ──────────────────────────────

/** ¿Tiene tarjetas que no son un mensaje ni una acción (condición, espera, «Si responde», «Ir a»)? */
export function tieneTarjetasDeControl(pasos: readonly PasoGrafo[]): boolean {
  return pasos.some((p) => esControl(p));
}

/**
 * ¿La secuencia es una CADENA en el orden del array? (Sin condiciones, sin «Si responde», sin
 * saltos, y cada nodo sigue en el de abajo.) Es lo único sobre lo que una edición «por orden»
 * —«el paso 3 dice esto»— tiene sentido: con ramas, «el paso 3» ya no es un lugar del flujo.
 */
export function esLineal(pasos: readonly PasoGrafo[]): boolean {
  for (let i = 0; i < pasos.length; i++) {
    const c = claseDe(pasos[i]);
    if (c === 'condicion' || c === 'respuesta' || c === 'ir_a') return false;
    // El inicio y las flechas en paralelo: «el paso 3» ya no es UN lugar (puede haber dos
    // caminos corriendo a la vez), así que una edición «por orden» no tiene a qué referirse.
    if (c === 'inicio' || (Array.isArray(pasos[i].paralelos) && pasos[i].paralelos!.length > 0)) return false;
    const esperado = pasos[i + 1] ? idDe(pasos[i + 1], i + 1) : null;
    if (siguienteDe(pasos, i) !== esperado) return false;
  }
  return true;
}

/**
 * Una cadena lineal vuelve a encadenarse por el orden del array: se saca el `siguiente`
 * explícito y `normalizar` lo vuelve a poner. Es lo que deja que una lista reescrita «por
 * orden» (agregar al final, borrar uno del medio) no quede con un `siguiente` apuntando a un
 * paso que se fue, que `validarGrafo` rechazaría.
 */
export function relinear<P extends PasoGrafo>(pasos: readonly P[]): P[] {
  return pasos.map((p) => {
    const q = { ...p };
    delete q.siguiente;
    return q;
  });
}

// ── Un caso enseñado entra a «Si responde» ──────────────────────────────────────

export type CasoEnsenado = { titulo: string; cuando: string; comoResponder: string; contestaSolo?: boolean };

/**
 * Suma un caso a «Si responde» como RAMA: el caso y, colgando de él, un mensaje «MaKo
 * contesta» (`tipo: 'ia'`) con la guía. Es lo que hacía el formulario «Enseñarle este caso»
 * sobre `estrategia.escenarios`; con el flujo, los casos son ramas de la tarjeta (diseño §1).
 *
 * Mismo título = el MISMO caso: se actualiza su «cuándo», y la guía del mensaje que cuelga si
 * es un «MaKo contesta»; si no lo es, el mensaje nuevo se pone delante de lo que ya colgaba.
 * Devuelve `null` si no hay tarjeta «Si responde» o si ya tiene el máximo de casos.
 */
export function agregarCasoAlGrafo<P extends PasoGrafo>(
  pasosIn: readonly P[], caso: CasoEnsenado, rnd: () => number = Math.random,
): { pasos: P[] } | { error: string } {
  const pasos = normalizar(pasosIn);
  const ri = indicePorId(pasos, raizRespuesta(pasos));
  if (ri < 0) return { error: 'la automatización no tiene «Si responde»' };
  const r = pasos[ri];
  const titulo = caso.titulo.trim().slice(0, 120);
  const cuando = caso.cuando.trim().slice(0, 600);
  const guia = (caso.comoResponder ?? '').trim();
  if (!titulo || !cuando) return { error: 'el caso no tiene nombre o descripción' };
  const casos = [...(r.casos ?? [])];
  const k = casos.findIndex((c) => c.titulo.trim().toLowerCase() === titulo.toLowerCase());
  const nuevoMensaje = (siguiente: string | null): P => ({
    ...RELLENO_CONTROL, proveedor: 'no_oficial', tipo: 'ia', cuerpo: guia, revisar: caso.contestaSolo !== true,
    id: nuevoId(pasos, rnd), siguiente,
  } as unknown as P);
  if (k >= 0) {
    const primero = pasos.findIndex((p, i) => idDe(p, i) === casos[k].siguiente);
    const actual = primero >= 0 ? pasos[primero] : null;
    if (actual && claseDe(actual) === 'mensaje' && actual.tipo === 'ia') {
      const out = pasos.map((p, i) => (i === primero ? { ...p, cuerpo: guia || p.cuerpo, revisar: caso.contestaSolo !== true } : p));
      out[ri] = { ...out[ri], casos: casos.map((c, j) => (j === k ? { ...c, cuando } : c)) };
      return { pasos: normalizar(out) };
    }
    const m = nuevoMensaje(casos[k].siguiente ?? null);
    const out = [...pasos, m];
    out[ri] = { ...out[ri], casos: casos.map((c, j) => (j === k ? { ...c, cuando, siguiente: m.id! } : c)) };
    return { pasos: normalizar(out) };
  }
  if (casos.length >= TOPE_CASOS) return { error: `«Si responde» ya tiene ${TOPE_CASOS} casos, el máximo` };
  const m = nuevoMensaje(null);
  const conMensaje = [...pasos, m];
  const idCaso = nuevoId(conMensaje, rnd);
  const out = [...conMensaje];
  out[ri] = { ...out[ri], casos: [...casos, { id: idCaso, titulo, cuando, siguiente: m.id! }] };
  return { pasos: normalizar(out) };
}
