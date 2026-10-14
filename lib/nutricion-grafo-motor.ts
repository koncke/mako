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
  CAMPOS_CONDICION, TOPE_CASOS, TOPE_NODOS, TOPE_RESPONDER, TOPE_INSTRUCCIONES, TOPE_OTRA_AVISO,
  TOPE_OBJETIVO, TOPE_EJEMPLOS, TOPE_EJEMPLO, TOPE_ESCENARIOS_AI_STEP, MEDIOS_AI_STEP,
  claseDe, idDe, indicePorId, siguienteDe, puertosDe, raizSalida, raizRespuesta, elegirSalida, esPasoIA,
  normalizar, nuevoId, paralelosDeResultado, aristasDeVuelta, padresSinVuelta, sigueSiContesta, HILO_PRINCIPAL,
  type PasoGrafo, type HechosLead, type FilaCondicion, type RamaCondicion, type CasoRespuesta, type Espera, type DestinoIrA,
  type EjemploCaso, type MedioAIStep,
} from './flujo-grafo';
// La libertad de un escenario del AI Step (undécima tanda): la única que escribe `sola` / `no_contesta`.
import { conLibertad, libertadesPermitidas } from './ai-step-libertad';
import { TRIGGER_ETIQUETA } from './nutricion-etapa';
import { condicionPorId, reunionesDeFila, TOPE_REUNIONES, type HechosCatalogo } from './condiciones-catalogo';
import { parseFechaJunta, reunionFuturaMs, proximaReunion, soloQuedaElCarril, finDeLaReunionMs, type FilaReunion } from './nutricion-reinscripcion';
// El CARRIL DEL RECORDATORIO (undécima tanda, M3 y M4): la marca y la tolerancia del emisor de hoy, los hilos
// de una inscripción y la operación de la tarjeta «MaKo en WhatsApp». Los cuatro son puros.
import { claveDelCarril, TOLERANCIA_MIN, type CualReunion } from './recordatorio-lead';
import { sanearHilos, hilosIniciales, esFilaNueva, type Hilo } from './nutricion-hilos';
import { OP_AVISAR } from './flujo-legado';
import { claseCompleta } from './curso-bloqueo';
import type { Clase, Progreso } from './curso';
import { minutosDeSegundos, segundosDeMinutos } from './espera-duracion';
// LA zona del negocio (undécima tanda, decisión 4 de la décima): un solo default y una sola regla de lectura, la de las
// pantallas. ⚠️ Sólo se usa adentro de funciones: zona-negocio-reglas → disparadores → flujo-conversacion →
// mako-tarjeta → ESTE archivo es un ciclo, y un valor leído al cargar el módulo podría llegar sin inicializar.
import { zonaDeLoGuardado } from './zona-negocio-reglas';

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
  /**
   * La próxima reunión CON HORA (undécima tanda, M3 a: `proximaReunion(…, { estricta: true })`, la regla del
   * emisor del recordatorio). Con el campo, una espera «antes de la reunión» se ancla en ÉSTA y no en la laxa
   * (que le inventa las 12:00 de México a una fecha sin hora); si no hay pero la laxa sí —la reunión sólo tiene
   * fecha—, esa espera cierra SU hilo (`sin_hora`), no la inscripción (M3 g). Ausente = `reunionMs`, lo de antes.
   */
  reunionConHoraMs?: number | null;
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
  /**
   * Una espera «antes de la reunión» con una reunión por delante que NO TIENE HORA (sólo fecha), con
   * `reunionConHoraMs` en el contexto: se cierra ESE hilo, no la inscripción (undécima tanda, M3 g).
   */
  | { tipo: 'sin_hora'; via: string[] }
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
        // El ancla: la reunión CON HORA si quien llama la pasó (el carril, M3), si no la de siempre.
        const ancla = ctx.reunionConHoraMs !== undefined ? ctx.reunionConHoraMs : ctx.reunionMs;
        if (ancla == null) {
          return ctx.reunionConHoraMs !== undefined && ctx.reunionMs != null
            ? { tipo: 'sin_hora', via, repartos }
            : { tipo: 'sin_reunion', via, repartos };
        }
        objetivo = ancla - minutos * 60_000;
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
  const desde = pasos[idx] ? idDe(pasos[idx], idx) : null;
  if (!desde) return true;
  // ⚠️ SEXTA TANDA: POR TODOS LOS PADRES, MENOS LAS FLECHAS QUE VUELVEN. Una tarjeta puede tener
  // varios: es la primera sólo si por NINGÚN camino desde la raíz hay un mensaje o una acción antes.
  // Y la flecha de un «volver al principio» (lo que antes era un «Ir a», que no era un padre) no es lo
  // de antes: sin sacarla, la bienvenida de un bucle dejaba de ser la primera.
  const vuelta = aristasDeVuelta(pasos);
  const vistos = new Set<string>([desde]);
  const pila = [desde];
  while (pila.length) {
    const cur = pila.pop()!;
    for (const pa of padresSinVuelta(pasos, cur, vuelta)) {
      const p = pasos[indicePorId(pasos, pa.id)];
      if (p && !esControl(p)) return false;
      if (!vistos.has(pa.id)) { vistos.add(pa.id); pila.push(pa.id); }
    }
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
  // ⚠️ SEXTA TANDA: POR TODOS LOS PADRES (sin las flechas que vuelven). Si por ALGÚN camino cuelga de
  // una espera «antes de la reunión», es un recordatorio: se vuelve a mirar la agenda al mandarlo (sin
  // reunión por delante se cierra), que es la guarda que protege de «Mañana es tu reunión» sin reunión.
  // Con varias, la de más minutos: re-ancla lo menos posible.
  const vuelta = aristasDeVuelta(pasos);
  const vistos = new Set<string>([idDe(p, idx)]);
  const pila = [idDe(p, idx)];
  let max: number | null = null;
  while (pila.length) {
    const cur = pila.pop()!;
    for (const pa of padresSinVuelta(pasos, cur, vuelta)) {
      const padre = pasos[indicePorId(pasos, pa.id)];
      if (!padre) continue;
      const c = claseDe(padre);
      if (c === 'esperar') {
        if (padre.espera?.modo === 'antes_reunion') max = Math.max(max ?? 0, Math.max(0, Number(padre.espera.minutos) || 0));
        continue;
      }
      if (!sube || c !== 'condicion' || vistos.has(pa.id)) continue;
      vistos.add(pa.id);
      pila.push(pa.id);
    }
  }
  return max;
}

// ── EL CARRIL DEL RECORDATORIO (undécima tanda, M3 y M4) ────────────────────────────
// Pedido de Martín (11/10/2026, punto 8): «"Recordatorio de reunión" NO debería ser un flujo aparte, para eso ya
// tenemos el flujo de "Agendó reunión", los recordatorios se pueden configurar allí mismo con DELAY». El
// recordatorio era un EMISOR aparte (lib/reunion-recordatorio.ts) con reglas que el motor no tenía: tolerancia
// de 12 min (pasada, el toque se pierde, no sale tarde), una marca por reunión y minuto, la reunión con HORA y
// sin cancelar, fuera del anti-ban, del horario y de los topes, y sin cortarse si el lead contesta. Una tarjeta
// que cuelga de un DELAY «N antes de la reunión» es del CARRIL y tiene esas reglas; el resto del flujo, las de
// siempre. Esto decide; lib/nutricion.ts (`procesarEnvios`, `pausarPorRespuesta`) lee y escribe.

/** ¿Una espera «N antes de la reunión»? */
const esEsperaAntes = (p: PasoGrafo | null | undefined): boolean => !!p && claseDe(p) === 'esperar' && p.espera?.modo === 'antes_reunion';

/** ¿La automatización tiene un carril (algún DELAY «antes de la reunión»)? */
export function tieneCarril(pasos: readonly PasoGrafo[]): boolean {
  return pasos.some((p) => esEsperaAntes(p));
}

/** ¿Es la tarjeta «MaKo en WhatsApp» (la acción `avisar_al_equipo`: el aviso al grupo del negocio)? */
export function esTarjetaMako(p: PasoGrafo | null | undefined): boolean {
  if (!p || claseDe(p) !== 'accion') return false;
  const a = p.accion as { operacion?: unknown } | null | undefined;
  return String(a?.operacion ?? '') === OP_AVISAR;
}

/**
 * ¿La tarjeta `idx` es del CARRIL? Una espera «antes de la reunión», lo que cuelga de ella (un mensaje sube por
 * las condiciones, una acción mira su padre: `minutosAntesDeReunion`) y una CONDICIÓN que cuelga de ella (la
 * espera deja el hilo parado en lo que sigue, y lo que sigue puede ser la condición que decide el mensaje).
 * Es lo que se queda vivo cuando el lead contesta (M4) y lo que corre fuera del horario (M3 f).
 */
export function esHiloDelCarril(pasos: readonly PasoGrafo[], idx: number): boolean {
  const p = pasos[idx];
  if (!p) return false;
  const c = claseDe(p);
  if (c === 'esperar') return esEsperaAntes(p);
  if (c === 'mensaje' || c === 'accion') return minutosAntesDeReunion(pasos, idx) != null;
  if (c !== 'condicion') return false;
  const vuelta = aristasDeVuelta(pasos);
  const vistos = new Set<string>([idDe(p, idx)]);
  const pila = [idDe(p, idx)];
  while (pila.length) {
    const cur = pila.pop()!;
    for (const pa of padresSinVuelta(pasos, cur, vuelta)) {
      const padre = pasos[indicePorId(pasos, pa.id)];
      if (!padre) continue;
      if (esEsperaAntes(padre)) return true;
      if (claseDe(padre) !== 'condicion' || vistos.has(pa.id)) continue;
      vistos.add(pa.id);
      pila.push(pa.id);
    }
  }
  return false;
}

/**
 * ¿Esta corrida puede MOVER la tarjeta `idx` de una inscripción?
 *  · `enRespuesta` (la inscripción está en 'respondio': el lead contestó): SÓLO lo de un camino que SIGUE cuando el
 *    lead contesta (`sigueSiContesta`, la opción de la flecha del CRON, 14/10/2026). Hasta el 14/10 era «sólo el
 *    carril» y no se veía en ningún lado: así no salió la bienvenida del bug 5.
 *  · `fueraDeHorario` (el horario de envío del negocio está cerrado, o no se pudo leer): el carril y las
 *    tarjetas «MaKo en WhatsApp» (M3 f; decisiones §9.6 y §9.7: el aviso al equipo sale a cualquier hora,
 *    como el del webhook). Lo demás espera a que abra, como siempre.
 *  · Si no, todo.
 */
export function seMueveEnLaCorrida(pasos: readonly PasoGrafo[], idx: number, o: { enRespuesta: boolean; fueraDeHorario: boolean }): boolean {
  if (o.enRespuesta && !sigueSiContesta(pasos, idx)) return false;
  if (esHiloDelCarril(pasos, idx)) return true;
  if (o.fueraDeHorario) return esTarjetaMako(pasos[idx]);
  return true;
}

/**
 * ¿Un mensaje pasa por el freno anti-ban de 20 h (`frenadoPorAntiBan`)? No si es del carril (M3 d: el «1 h antes»
 * y el «15 min antes» van a 45 minutos, y con la reunión encima el freno deja 3 h), ni si es de Instagram o
 * Messenger (la ventana de Meta es de 24 h), ni si su canal está apagado (no sale).
 */
export function pasaPorAntiBan(o: { carril: boolean; social: boolean; canalApagado: boolean }): boolean {
  return !o.carril && !o.social && !o.canalApagado;
}

/** ¿Lo que salió cuenta para el cupo de la corrida (el tope por hora de la línea)? El carril no (M3 e). */
export function cuentaParaElCupo(o: { carril: boolean }): boolean {
  return !o.carril;
}

/** Cada cuánto vuelve a mirarse un hilo frenado de una fila que tiene el carril pendiente (`aplazaParaNoTapar`). */
export const APLAZO_SIN_TAPAR_MS = 15 * 60_000;

/**
 * ¿El hilo `h`, que esta corrida deja SIN MOVER (fuera del horario, frenado por el anti-ban, sin cupo), se tiene
 * que APLAZAR para no TAPAR al carril del recordatorio? (Undécima tanda, M3.)
 *
 * ⚠️ EL TICK DE CADA MINUTO SÓLO MIRA LO QUE ACABA DE VENCER (app/api/cron/nutricion-tick: `proximo_envio_at` de
 * los últimos 10 minutos), y con hilos esa columna RESUME el que vence primero (lib/nutricion-hilos.ts). Un hilo
 * vencido que no se mueve (la preparación de las 21:30, fuera del horario hasta las 9) deja la columna clavada en
 * las 21:30: el «1 h antes» de las 8:30 nunca es «lo que acaba de vencer», y la corrida de cada hora lo ve a las
 * 9:00, pasada la tolerancia — perdido. Aplazado de a `APLAZO_SIN_TAPAR_MS`, la columna sigue al carril.
 *
 * Sólo un hilo que NO es del carril y sólo si la fila tiene otro que SÍ: sin carril, lo de siempre (la corrida de
 * cada hora lo vuelve a mirar). Pura.
 */
export function aplazaParaNoTapar(pasos: readonly PasoGrafo[], hilos: readonly Hilo[] | null, h: string | null | undefined): boolean {
  if (!hilos || !h) return false;
  const este = hilos.find((x) => x.h === h);
  if (!este || esHiloDelCarril(pasos, indicePorId(pasos, este.nodo))) return false;
  return hilos.some((x) => x.h !== h && esHiloDelCarril(pasos, indicePorId(pasos, x.nodo)));
}

/** Qué hacer con una tarjeta del carril en esta corrida. */
export type DecisionCarril =
  /** Sale ahora. `clave`: la marca a reclamar ANTES de mandar (null = una acción, que se reclama a sí misma). */
  | { tipo: 'enviar'; clave: string | null; cual: CualReunion; inicio: string; min: number }
  /** No sale y el hilo SIGUE a la tarjeta siguiente: se pasó la tolerancia, o el toque ya salió. */
  | { tipo: 'omitido'; motivo: string; clave: string | null }
  /** Todavía no es su momento (el lead reagendó para más tarde): se re-ancla en `proximoMs`. */
  | { tipo: 'esperar'; proximoMs: number }
  /** Sin reunión con hora por delante (sólo fecha, cancelada, ya pasó): se cierra ESE hilo, no la inscripción. */
  | { tipo: 'cerrar-hilo'; motivo: string };

/**
 * LA DECISIÓN DEL CARRIL para la tarjeta `idx` (M3), o null si no es del carril (no cuelga de un DELAY «antes
 * de la reunión»). Las reglas son las del emisor de hoy (`toquesVencidos`, lib/recordatorio-lead.ts):
 *
 *  a. el ancla es `proximaReunion(…, { estricta: true })`: la HORA puesta, la fecha en pie que coincide, sin
 *     asistencia. (h) Una reunión CANCELADA (fecha en null) no cuenta. (g) Sin una así —sólo fecha, o nada—
 *     se cierra ESE hilo: inventarle una hora a una fecha es el «1 h antes» a las 11:00 de una hora que nadie
 *     cargó (74 leads así en el ws1, 11/10/2026).
 *  b. el toque VENCE en `momento = inicio − N`: antes, espera; si se pasó `TOLERANCIA_MIN` (12) NO SALE —
 *     «te recuerdo tu reunión de mañana» una hora antes miente— y el hilo sigue a la tarjeta de después.
 *  c. la marca es `claveDelCarril` = `claveToque` para un WhatsApp (la MISMA del emisor: no sale dos veces
 *     mientras convivan), con `estadoMarca` ya leído: 'tomada' = ya salió. Una acción no lleva marca.
 *
 * El anti-ban (d), los topes (e) y el horario (f) no se miran acá: los saltea el motor para el carril.
 */
export function decidirToqueDelCarril(p: {
  leadId: number;
  pasos: readonly PasoGrafo[];
  idx: number;
  juntas: FilaReunion | null | undefined;
  ahoraMs: number;
  /** La zona del negocio: una fecha escrita en ella también coincide con la hora (`fechaCoincide`). */
  tz?: string | null;
  /** Lo que dice la marca (`estadoDeLaMarca`). Ausente = todavía no se leyó. */
  estadoMarca?: 'libre' | 'reintento' | 'tomada' | null;
  /** `estado_lead` del lead: un cerrado o perdido sigue con la fecha cargada y no se le recuerda nada (`leadAbierto`). */
  estadoLead?: string | null;
  toleranciaMin?: number;
}): DecisionCarril | null {
  const paso = p.pasos[p.idx];
  const min = minutosAntesDeReunion(p.pasos, p.idx);
  if (!paso || min == null) return null;
  if (p.estadoLead != null && p.estadoLead !== 'abierto') return { tipo: 'cerrar-hilo', motivo: 'el lead ya no está abierto' };
  const r = proximaReunion(p.juntas, p.ahoraMs, { estricta: true, tz: p.tz ?? null });
  if (!r) {
    const laxa = proximaReunion(p.juntas, p.ahoraMs, { estricta: false });
    return { tipo: 'cerrar-hilo', motivo: laxa && !laxa.conHora ? 'la reunión no tiene hora' : 'sin reunión con hora por delante' };
  }
  const momento = r.inicioMs - min * 60_000;
  if (momento > p.ahoraMs) return { tipo: 'esperar', proximoMs: momento };
  const inicio = new Date(r.inicioMs).toISOString();
  const clave = claseDe(paso) === 'mensaje' ? claveDelCarril(p.leadId, r.cual, inicio, min, paso.canal) : null;
  if (p.ahoraMs - momento >= (p.toleranciaMin ?? TOLERANCIA_MIN) * 60_000) {
    return { tipo: 'omitido', motivo: `se pasó la hora del recordatorio (${min} min antes)`, clave };
  }
  if (clave && p.estadoMarca === 'tomada') return { tipo: 'omitido', motivo: 'el recordatorio ya salió', clave };
  return { tipo: 'enviar', clave, cual: r.cual, inicio, min };
}

/**
 * LO QUE QUEDA VIVO cuando el lead CONTESTA. `pausarPorRespuesta` pasa la inscripción a 'respondio' y le saca el
 * próximo envío a lo que se CORTA. Qué se corta lo dice cada camino del CRON (`sigueSiContesta`, 14/10/2026: «Opción
 * en cada camino, sigue de fábrica»); hasta el 14/10 quedaba sólo el carril del recordatorio (M4), una regla que no
 * se veía en el lienzo. Devuelve las columnas a escribir (con `estado: 'respondio'`) y si quedó algo vivo (`carril`,
 * el nombre de siempre).
 *
 *  · con hilos: sólo los del carril, y las columnas de siempre resumen el que vence primero;
 *  · una fila NUEVA de varias raíces (todavía no repartida): sus raíces del carril, como las repartiría el motor;
 *  · un solo cursor: si está en el carril, sigue tal cual; si no, sin próximo envío.
 */
export function alResponder(
  pasos: readonly PasoGrafo[],
  fila: { paso_actual: number; nodo_actual?: string | null; proximo_envio_at?: string | null; hilos?: unknown },
  ahoraIso: string,
): { carril: boolean; update: Record<string, unknown> } {
  const enCarril = (x: Hilo): boolean => sigueSiContesta(pasos, indicePorId(pasos, x.nodo));
  const conHilos = (hs: Hilo[]): { carril: boolean; update: Record<string, unknown> } => {
    const vivos = hs.filter(enCarril);
    if (!vivos.length) return { carril: false, update: { proximo_envio_at: null, hilos: null } };
    const ms = (iso: string): number => (Number.isFinite(Date.parse(iso)) ? Date.parse(iso) : 0);
    const primero = [...vivos].sort((a, b) => ms(a.proximo) - ms(b.proximo) || (a.h < b.h ? -1 : a.h > b.h ? 1 : 0))[0];
    const i = indicePorId(pasos, primero.nodo);
    return { carril: true, update: { hilos: vivos, ...(i >= 0 ? { paso_actual: i } : {}), nodo_actual: primero.nodo, proximo_envio_at: primero.proximo } };
  };
  const hs = sanearHilos(fila.hilos);
  if (hs) return conHilos(hs);
  if (esFilaNueva(fila)) {
    const ini = hilosIniciales(pasos, () => fila.proximo_envio_at ?? ahoraIso);
    if (ini) return conHilos(ini);
  }
  const idx = indiceActual(pasos, fila);
  if (idx >= 0 && sigueSiContesta(pasos, idx) && fila.proximo_envio_at) return { carril: true, update: { proximo_envio_at: fila.proximo_envio_at } };
  return { carril: false, update: { proximo_envio_at: null } };
}

/**
 * El ESTADO que se escribe en una inscripción que ya está en 'respondio' (M4): sigue en 'respondio'. El motor
 * escribe 'activa' al mover un hilo y 'completada' cuando no queda ninguno; en una fila del lead que contestó,
 * cualquiera de los dos le borraba la respuesta — 'activa' la volvía a poner en cola entera, y 'completada'
 * hacía que el desenlace («Respondió» = logrado) no la viera nunca. 'cancelada' pasa igual.
 *
 * Salvo que el desenlace YA esté escrito (`desenlace`, una fila re-armada sólo con el carril): ésa termina
 * 'completada', porque el evaluador ya no la va a mirar y en 'respondio' no se podría reusar nunca más.
 */
export function estadoAlEscribir(leido: string | null | undefined, nuevo: unknown, desenlace?: string | null): unknown {
  if (leido !== 'respondio') return nuevo;
  if (nuevo === 'activa') return 'respondio';
  if (nuevo === 'completada') return desenlace != null ? 'completada' : 'respondio';
  return nuevo;
}

/**
 * ¿El desenlace ESPERA a esta inscripción? (M4.) Una en 'respondio' con el carril vivo (próximo envío puesto):
 * cerrarla como lograda ahora le apagaba los recordatorios que quedan. Cuando el carril termina, el motor la deja
 * en 'respondio' sin próximo envío, y ahí el desenlace la cierra como siempre.
 */
export function desenlaceEsperaAlCarril(f: { estado: string; proximo_envio_at?: string | null }): boolean {
  return soloQuedaElCarril(f);
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
 * Una reunión de la ficha. CANCELADA (la hora quedó, la fecha no: `junta_X_at` puesta y `fecha_junta_X` LEÍDA en null)
 * cuenta como que no hay reunión — Martín, 14/10/2026: «Cancelada = no agendó». Hasta el 14/10 se leía la hora de una
 * cancelada y la condición «Tiene reunión agendada» (y «Agendó») seguía diciendo que sí. `=== null`, no «falsy»: un
 * objeto sin la fecha (`undefined`) no afirma que se canceló.
 */
function lugarDeFicha(at: string | null | undefined, fecha: string | null | undefined, asistio: boolean | null | undefined): { fechaMs: number | null; asistio: boolean | null; finMs: number | null } {
  const cancelada = !!at && fecha === null;
  const x = cancelada ? null : (at ?? fecha);
  const fin = x ? finDeLaReunionMs(x) : NaN;
  return { fechaMs: msJunta(x), asistio: asistio ?? null, finMs: Number.isFinite(fin) ? fin : null };
}

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
    r1: lugarDeFicha(f.junta_1_at, f.fecha_junta_1, f.asistio_j1),
    r2: lugarDeFicha(f.junta_2_at, f.fecha_junta_2, f.asistio_j2),
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

/** ¿Es una zona IANA que el runtime conoce? */
export function zonaValida(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

// La zona con la que corre el motor ES `zonaDeLoGuardado` (lib/zona-negocio-reglas.ts), la MISMA regla de las
// pantallas, la API y el tick: la guardada en su forma canónica y, sin zona o rota, `ZONA_POR_DEFECTO` (Tijuana).
//
// ⚠️ HASTA LA UNDÉCIMA TANDA EL MOTOR TENÍA SU PROPIO DEFAULT: `ZONA_SIN_CONFIGURAR` = Ciudad de México («lo que el
// motor hacía siempre», `TZ_OFFSET_MX = -6`), mientras las pantallas caían a Tijuana. Parecía prudente —no mover
// cuándo les sale todo a los que no tienen zona— y era el bug: el ws1 (Baja California, sin zona guardada, horario de
// 9 a 21) recibió el envío #22 a las 08:00 de su hora, y Configuraciones › Horario le mostraba otra zona que la que
// frenaba. Decisión 4 de la décima, literal de Martín: «Si, siempre por ubicación que se maneje por defecto». El alias
// `zonaDelMotor` se borró en el cierre de la ola 3 (nadie lo importaba): se usa `zonaDeLoGuardado` por su nombre.

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
  // Sin zona (o rota), la de por defecto de la casa (`zonaDeLoGuardado` → `ZONA_POR_DEFECTO`): la misma que ve la pantalla.
  const zona = zonaDeLoGuardado(tz);
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

/**
 * Un caso de «Si responde», saneado. `deIA`: el nodo es un AI STEP (novena tanda), y el caso trae ADENTRO
 * lo que en la forma de siempre eran sus tarjetas hijas —cómo responder, si sale sola, si te avisa—.
 *
 * ⚠️ LA QUINTA PUERTA OTRA VEZ (AGENTS.md): sin las tres líneas del AI Step, el primer guardado devolvía
 * cada caso sin su respuesta y Publicar lo frenaba con «no contesta ni avisa» sobre lo que la persona
 * acababa de escribir. En un «Si responde» de los de siempre no se guardan: no significan nada ahí, y un
 * flujo de antes queda byte a byte igual.
 */
function sanearCaso(x: unknown, deIA = false): CasoRespuesta | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  const caso: CasoRespuesta = {
    id: idValido(o.id) ? o.id : '',
    titulo: typeof o.titulo === 'string' ? o.titulo.trim().slice(0, 120) : '',
    cuando: typeof o.cuando === 'string' ? o.cuando.trim().slice(0, 600) : '',
    siguiente: destinoId(o.siguiente) ?? null,
  };
  if (deIA) {
    const r = typeof o.responder === 'string' ? o.responder.trim().slice(0, TOPE_RESPONDER) : '';
    if (r) caso.responder = r;
    if (o.sola === true) caso.sola = true;
    // ── AI STEP v2 (décima tanda): la QUINTA PUERTA para los campos del caso (AGENTS.md: un campo nuevo de un
    //    paso pasa por `camposDelFlujo`/`sanearCaso`). Ausente = lo de antes, y sólo un valor literal prende. ──
    if (o.cualquiera === true) caso.cualquiera = true;
    if (o.no_contesta === true) caso.no_contesta = true;
    // ⚠️ UNDÉCIMA TANDA: el caso ya no guarda `objetivo`, `audio`, `ejemplos` (son del AI STEP: los sube
    //    `camposDelFlujo` al nodo si el nodo no los trae), ni `hasta` (siempre el objetivo) ni `avisar` (el aviso
    //    se deriva de la libertad, lib/ai-step-libertad.ts). Lo de antes que llega con ellos lo junta
    //    `juntarPasosIA` DESPUÉS de este saneo (`grafoAGuardar`, lib/nutricion.ts).
  }
  return caso;
}

/** Los campos de un caso de AI Step que la undécima subió al NODO: los lee `camposDelFlujo` como respaldo. */
function delObjetivoEnCasos(casos: unknown): { objetivo?: string; audio?: { voz: string }; ejemplos?: EjemploCaso[] } {
  const out: { objetivo?: string; audio?: { voz: string }; ejemplos?: EjemploCaso[] } = {};
  if (!Array.isArray(casos)) return out;
  for (const x of casos) {
    if (!x || typeof x !== 'object' || Array.isArray(x)) continue;
    const o = x as Record<string, unknown>;
    if (out.objetivo === undefined) { const t = typeof o.objetivo === 'string' ? o.objetivo.trim().slice(0, TOPE_OBJETIVO) : ''; if (t) out.objetivo = t; }
    if (out.audio === undefined) { const a = sanearAudioCaso(o.audio); if (a) out.audio = a; }
    if (out.ejemplos === undefined) { const e = sanearEjemplos(o.ejemplos); if (e.length) out.ejemplos = e; }
  }
  return out;
}

/** La voz de un AI Step que contesta en audio: 'propia' o un voiceId de ElevenLabs (alfanumérico). */
function sanearAudioCaso(x: unknown): { voz: string } | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const voz = (x as Record<string, unknown>).voz;
  if (voz === 'propia') return { voz: 'propia' };
  return typeof voz === 'string' && /^[A-Za-z0-9]{8,64}$/.test(voz) ? { voz } : null;
}

/** Los ejemplos del ensayo: pares con los dos lados escritos, recortados y sin pasar el tope. */
function sanearEjemplos(x: unknown): EjemploCaso[] {
  if (!Array.isArray(x)) return [];
  const out: EjemploCaso[] = [];
  for (const e of x) {
    if (!e || typeof e !== 'object' || Array.isArray(e)) continue;
    const o = e as Record<string, unknown>;
    const lead = typeof o.lead === 'string' ? o.lead.trim().slice(0, TOPE_EJEMPLO) : '';
    const tu = typeof o.tu === 'string' ? o.tu.trim().slice(0, TOPE_EJEMPLO) : '';
    if (lead && tu) out.push({ lead, tu });
    if (out.length >= TOPE_EJEMPLOS) break;
  }
  return out;
}

/**
 * La espera, saneada. Desde la quinta tanda (punto 3: «En Delay, falta la opción de minutos y
 * segundos») los minutos llevan DECIMALES para los segundos (10 s = 1/6 min, lib/espera-duracion.ts),
 * redondeados al SEGUNDO y no al minuto.
 *
 * ⚠️ ERA `Math.round(minutos)`: una espera de 10 s se guardaba como 0, caía en «sin espera» y
 * desaparecía en el primer guardado (la quinta puerta de AGENTS.md, del lado del redondeo). Un número
 * entero de minutos vuelve exacto (86 400 s / 60 = 1440), así que lo ya guardado no cambia.
 */
function sanearEspera(x: unknown): Espera | undefined {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return undefined;
  const o = x as Record<string, unknown>;
  const minutos = minutosDeSegundos(segundosDeMinutos(o.minutos));
  // Al menos un segundo o nada: sin espera, `validarGrafo` contesta «la espera no dice cuánto».
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
export type CamposFlujo = Pick<PasoGrafo, 'id' | 'siguiente' | 'paralelos' | 'nodo' | 'espera' | 'ramas' | 'casos' | 'suelta' | 'si_no' | 'paralelos_si_no' | 'destino' | 'revisar' | 'paso_ia' | 'instrucciones' | 'otra_aviso' | 'medio' | 'si_contesta'
  // Undécima tanda: lo del OBJETIVO del AI Step (la quinta puerta: sin esto el primer guardado lo borraba).
  | 'objetivo' | 'audio' | 'ejemplos'>;

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
    // EL AI STEP (novena tanda): la marca, el tono y el aviso de «Otra cosa», y lo de adentro de cada caso
    // (`sanearCaso`). Sin la marca, el primer guardado lo volvía un «Si responde» de los de siempre con
    // casos sin tarjetas: casos que no contestan nada.
    const deIA = o.paso_ia === true;
    out.casos = Array.isArray(o.casos) ? o.casos.map((c) => sanearCaso(c, deIA)).filter((c): c is CasoRespuesta => !!c) : [];
    out.si_no = destinoId(o.si_no) ?? null;
    // La sexta puerta (10/10/2026): sin esta línea, guardar le devolvía la flecha a una «Si responde»
    // que la persona había soltado.
    if (o.suelta === true) out.suelta = true;
    if (deIA) {
      out.paso_ia = true;
      // El tono y el aviso de «Otra cosa» de antes se CONSERVAN acá (@deprecated): los pliega o los saca
      // `juntarPasosIA`, que corre DESPUÉS de este saneo. Borrados acá, el tono se perdía sin plegarse.
      const tono = typeof o.instrucciones === 'string' ? o.instrucciones.trim().slice(0, TOPE_INSTRUCCIONES) : '';
      if (tono) out.instrucciones = tono;
      const aviso = typeof o.otra_aviso === 'string' ? o.otra_aviso.trim().slice(0, TOPE_OTRA_AVISO) : '';
      if (aviso) out.otra_aviso = aviso;
      // El MEDIO (AI Step v2): sólo uno de los conocidos, y WhatsApp no se escribe (ausente = WhatsApp).
      if (typeof o.medio === 'string' && (MEDIOS_AI_STEP as readonly string[]).includes(o.medio) && o.medio !== 'whatsapp') out.medio = o.medio as MedioAIStep;
      // ── UNDÉCIMA TANDA: lo del OBJETIVO es del AI Step (la QUINTA PUERTA: `setSecuenciaPasos` arma cada paso con
      //    esta función, así que sin estas líneas el primer guardado los borraba). Si el nodo no los trae y un caso
      //    sí (lo de antes, que el saneo del caso ya no guarda), suben de ahí: no se pierden antes de juntar. ──
      const deCasos = delObjetivoEnCasos(o.casos);
      const obj = typeof o.objetivo === 'string' ? o.objetivo.trim().slice(0, TOPE_OBJETIVO) : '';
      if (obj || deCasos.objetivo) out.objetivo = obj || deCasos.objetivo;
      const audio = sanearAudioCaso(o.audio) ?? deCasos.audio;
      if (audio) out.audio = audio;
      const ej = sanearEjemplos(o.ejemplos);
      const ejemplos = ej.length ? ej : deCasos.ejemplos;
      if (ejemplos?.length) out.ejemplos = ejemplos;
    }
  }
  if (nodo === 'ir_a') out.destino = sanearDestino(o.destino);
  if (!nodo && typeof o.revisar === 'boolean') out.revisar = o.revisar;
  // ⚠️ LA QUINTA PUERTA (AGENTS.md): `setSecuenciaPasos` reconstruye cada paso campo por campo, y
  // sin esta línea BORRABA las flechas en paralelo en el primer guardado, sin error.
  if (!nodo || nodo === 'esperar' || nodo === 'inicio') { const par = sanearParalelos(o.paralelos); if (par) out.paralelos = par; }
  // SI CONTESTA (14/10/2026), la quinta puerta otra vez: sin esto el primer guardado borraba la opción de cada camino
  // y todo volvía a la de fábrica. Las claves que no son caminos las limpia `normalizar`.
  if (nodo === 'inicio' && o.si_contesta && typeof o.si_contesta === 'object' && !Array.isArray(o.si_contesta)) {
    const sc: Record<string, 'corta' | 'sigue'> = {};
    for (const [k, v] of Object.entries(o.si_contesta as Record<string, unknown>)) if ((k === HILO_PRINCIPAL || idValido(k)) && (v === 'corta' || v === 'sigue')) sc[k] = v;
    if (Object.keys(sc).length) out.si_contesta = sc;
  }
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
 *
 * Con un AI STEP (undécima tanda), el escenario entra ADENTRO del AI Step (≤ `TOPE_ESCENARIOS_AI_STEP`), con
 * la libertad de `camposDeLibertad`. Sin «Si responde» ni AI Step, `{ error }` como siempre.
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
  // ⚠️ UN AI STEP (novena tanda) LLEVA LA GUÍA ADENTRO DEL CASO: colgarle un «MaKo contesta» como en la
  // forma de siempre es justo lo que `validarGrafo` no deja guardar ahí («debajo no van tarjetas»), y la
  // API («enseñar este caso») y el hand-off resuelto entran por acá. Mismo título = el mismo caso.
  if (esPasoIA(r)) {
    // ⚠️ UNDÉCIMA TANDA: UN AI STEP POR OBJETIVO, con los escenarios ADENTRO (docs/diseno-undecima-tanda.md §6). El
    // escenario enseñado (la API `agregar_escenario_secuencia`, el hand-off resuelto) entra a ESTE AI Step: mismo
    // nombre = el mismo escenario (se le reescribe el «cuándo», la respuesta si viene y la libertad); uno nuevo va
    // al final de los escenarios, antes de «Lo demás», hasta `TOPE_ESCENARIOS_AI_STEP`.
    //   · La LIBERTAD la escribe `camposDeLibertad` (lib/ai-step-libertad.ts): «Sola» si el caso lo pide y puede
    //     (nunca con plata: `libertadesPermitidas`), si no «Para aprobar». Sin respuesta es «Sólo te avisa» (un
    //     escenario válido: ya no hay «no contesta ni avisa» que frenar).
    const libre = (c: CasoRespuesta): CasoRespuesta => {
      const quiere = caso.contestaSolo === true ? 'sola' : 'aprueba';
      return conLibertad(c, libertadesPermitidas(c).includes(quiere) ? quiere : 'aprueba');
    };
    const cs = r.casos ?? [];
    const j = cs.findIndex((c) => c.cualquiera !== true && c.titulo.trim().toLowerCase() === titulo.toLowerCase());
    const out = [...pasos];
    if (j >= 0) {
      // Sin respuesta nueva, sólo el «cuándo»: su libertad y lo que contestaba quedan como estaban.
      const nuevo = guia ? libre({ ...cs[j], cuando, responder: guia.slice(0, TOPE_RESPONDER) }) : { ...cs[j], cuando };
      out[ri] = { ...r, casos: cs.map((c, m) => (m === j ? nuevo : c)) };
      return { pasos: normalizar(out) };
    }
    void k;
    if (cs.filter((c) => c.cualquiera !== true).length >= TOPE_ESCENARIOS_AI_STEP) {
      return { error: `el AI Step ya tiene ${TOPE_ESCENARIOS_AI_STEP} escenarios, el máximo` };
    }
    const nuevo = libre({ id: nuevoId(pasos, rnd), titulo, cuando, siguiente: null, ...(guia ? { responder: guia.slice(0, TOPE_RESPONDER) } : {}) });
    const k0 = cs.findIndex((c) => c.cualquiera === true);
    out[ri] = { ...r, casos: k0 < 0 ? [...cs, nuevo] : [...cs.slice(0, k0), nuevo, ...cs.slice(k0)] };
    return { pasos: normalizar(out) };
  }
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
