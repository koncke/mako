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
  normalizar, nuevoId,
  type PasoGrafo, type HechosLead, type FilaCondicion, type RamaCondicion, type CasoRespuesta, type Espera, type DestinoIrA,
} from './flujo-grafo';
import { TRIGGER_ETIQUETA } from './nutricion-etapa';

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

const esControl = (p: PasoGrafo | undefined): boolean => {
  if (!p) return false;
  const c = claseDe(p);
  return c === 'condicion' || c === 'esperar' || c === 'ir_a' || c === 'respuesta';
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

export type Resolucion =
  /** Un mensaje o una acción: sigue a las guardas y al envío. */
  | { tipo: 'nodo'; idx: number; via: string[] }
  /** Una espera: se programa `proximoMs` y la inscripción pasa a `idx` (lo que sigue a la espera). */
  | { tipo: 'esperar'; idx: number; proximoMs: number; via: string[] }
  /** El flujo termina acá, sin mandar nada más. */
  | { tipo: 'fin'; motivo: string; via: string[] }
  /** «Ir a» otra automatización: se inscribe en ésa y ésta termina. */
  | { tipo: 'ir_a_secuencia'; secuenciaId: number; via: string[] }
  /** Hay que evaluar una condición y no hay hechos: leerlos y volver a llamar. */
  | { tipo: 'faltan_hechos' }
  /** Una espera «antes de la reunión» sin reunión por delante: se cierra sin mandar, como el ancla de siempre. */
  | { tipo: 'sin_reunion'; via: string[] }
  /** Más de `TOPE_SALTOS` «Ir a» seguidos: un bucle que `validarGrafo` no dejó guardar, hecho a mano. */
  | { tipo: 'tope_saltos'; via: string[] };

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
  let idx = desde;
  let saltos = 0;
  for (let vuelta = 0; vuelta <= TOPE_NODOS * 2 + TOPE_SALTOS; vuelta++) {
    const p = pasos[idx];
    if (!p) return { tipo: 'fin', motivo: 'no hay más tarjetas', via };
    const c = claseDe(p);
    if (c === 'mensaje' || c === 'accion') return { tipo: 'nodo', idx, via };
    via.push(idDe(p, idx));
    if (c === 'respuesta') return { tipo: 'fin', motivo: '«Si responde» no corre en la salida', via };
    if (c === 'condicion') {
      if (!ctx.hechos) return { tipo: 'faltan_hechos' };
      const s = elegirSalida(p, ctx.hechos);
      const j = indicePorId(pasos, s.destino);
      if (j < 0) return { tipo: 'fin', motivo: 'la condición termina aquí', via };
      idx = j;
      continue;
    }
    if (c === 'esperar') {
      const j = siguienteIndice(pasos, idx);
      // Esperar para no hacer nada después es lo mismo que terminar ahora.
      if (j < 0) return { tipo: 'fin', motivo: 'no hay nada después de la espera', via };
      const minutos = Math.max(0, Number(p.espera?.minutos) || 0);
      let objetivo: number;
      if (p.espera?.modo === 'antes_reunion') {
        if (ctx.reunionMs == null) return { tipo: 'sin_reunion', via };
        objetivo = ctx.reunionMs - minutos * 60_000;
      } else {
        objetivo = ctx.ahoraMs + minutos * 60_000;
      }
      if (objetivo <= ctx.ahoraMs) { idx = j; continue; }
      return { tipo: 'esperar', idx: j, proximoMs: objetivo, via };
    }
    // ir_a
    const d = p.destino;
    if (!d) return { tipo: 'fin', motivo: '«Ir a» sin destino', via };
    if ('secuencia_id' in d) {
      const sid = Number(d.secuencia_id);
      if (!Number.isInteger(sid) || sid <= 0) return { tipo: 'fin', motivo: '«Ir a» sin destino', via };
      return { tipo: 'ir_a_secuencia', secuenciaId: sid, via };
    }
    saltos += 1;
    if (saltos > TOPE_SALTOS) return { tipo: 'tope_saltos', via };
    const j = indicePorId(pasos, d.nodo);
    if (j < 0) return { tipo: 'fin', motivo: 'el «Ir a» apunta a una tarjeta que ya no existe', via };
    idx = j;
  }
  return { tipo: 'tope_saltos', via };
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
    if (c === 'esperar') { idx = siguienteIndice(pasos, idx); continue; }
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
};

/** Los hechos con los que se evalúa una condición (`HechosLead`, lib/flujo-grafo.ts). */
export function hechosDeLead(fila: FilaHechos, x: ExtrasHechos, ahoraMs: number): HechosLead {
  const creado = fila.created_at ? Date.parse(fila.created_at) : NaN;
  return {
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
const NODOS = new Set(['esperar', 'condicion', 'respuesta', 'ir_a']);
/** Un año de espera, en minutos. Una espera más larga es un dato roto, no una decisión. */
const TOPE_ESPERA_MIN = 366 * 24 * 60;

function sanearFila(x: unknown): FilaCondicion | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  const campo = o.campo as FilaCondicion['campo'];
  if (!CAMPOS_CONDICION.includes(campo)) return null;
  const f: FilaCondicion = { campo };
  if (o.no === true) f.no = true;
  if (typeof o.valor === 'number' && Number.isFinite(o.valor)) f.valor = o.valor;
  else if (typeof o.valor === 'string' && o.valor.trim()) f.valor = o.valor.trim().slice(0, 120);
  if (campo === 'etapa' && o.funnel_id != null && Number.isFinite(Number(o.funnel_id)) && Number(o.funnel_id) > 0) f.funnel_id = Number(o.funnel_id);
  return f;
}

function sanearRama(x: unknown): RamaCondicion | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  const filas = Array.isArray(o.filas) ? o.filas.map(sanearFila).filter((f): f is FilaCondicion => !!f) : [];
  return {
    id: idValido(o.id) ? o.id : '',
    modo: o.modo === 'cualquiera' ? 'cualquiera' : 'todas',
    filas,
    siguiente: destinoId(o.siguiente) ?? null,
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
export type CamposFlujo = Pick<PasoGrafo, 'id' | 'siguiente' | 'nodo' | 'espera' | 'ramas' | 'casos' | 'si_no' | 'destino' | 'revisar'>;

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
  }
  if (nodo === 'respuesta') {
    out.casos = Array.isArray(o.casos) ? o.casos.map(sanearCaso).filter((c): c is CasoRespuesta => !!c) : [];
    out.si_no = destinoId(o.si_no) ?? null;
  }
  if (nodo === 'ir_a') out.destino = sanearDestino(o.destino);
  if (!nodo && typeof o.revisar === 'boolean') out.revisar = o.revisar;
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
