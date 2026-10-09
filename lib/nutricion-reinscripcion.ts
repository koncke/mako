// =============================================================================
// nutricion-reinscripcion — cuándo una inscripción que ya terminó se vuelve a usar (#789)
// =============================================================================
// `nutricion_inscripciones` tiene `unique (lead_id, secuencia_id)` (mig 0034): un lead entra
// UNA vez en la vida a cada secuencia. Para casi todas está bien —volver a mandarle la
// bienvenida a quien ya la recibió es ruido—, y para ésas sigue igual. Para la familia que
// PREPARA UNA REUNIÓN (`preparaUnaReunion`, lib/nutricion-familias.ts) no: la secuencia habla
// de una reunión concreta, y medido el 06/10/2026 en el ws1 había seis leads quemados
// (inscripciones 181-187): entraron, no les llegó nada —la línea caída, la reunión que pasó
// mientras se reintentaba— y quedaron afuera para siempre. Si vuelven a agendar, no les sale
// nada, porque la fila vieja ya existe.
//
// DECISIÓN DE MARTÍN (06/10/2026), textual: «b: también con reunión nueva». Cuando un lead
// vuelve a agendar, la post-agenda le vuelve a salir si la vez anterior no le llegó nada, Y
// TAMBIÉN si ya le llegó pero es una reunión NUEVA. Repite el audio, a sabiendas.
//
// La fila NO se inserta de nuevo —el unique no deja, y en `enrolarPorEvento` un insert por lote
// que choca hacía `return 0` para TODAS las secuencias del evento—: se REUSA con
// compare-and-set (`reactivarInscripcion`).
//
// Sin `server-only`, a propósito: decide cuántas veces le escribimos a una persona real, así
// que no puede quedarse sin test. Las lecturas reciben el cliente YA scopeado por
// getTenantDb(), igual que lib/nutricion-envios-resumen.ts.

import type { SupabaseClient } from '@supabase/supabase-js';
import { leerPorPaginas } from './supabase-paginado';
import { enTandas } from './ids-con-filas';

// ── La reunión del lead ──────────────────────────────────────────────────────
// Vivía adentro de lib/nutricion.ts, que arrastra todo el runtime de Next: ni un test ni el
// evaluador de desenlaces la podían usar sin copiarla. Se mudó entera, sin cambiarle una línea.

/** Hora de México: la ventana de envío del motor y la hora por defecto de una reunión sin hora. */
export const TZ_OFFSET_MX = -6;

// Offset horario de México en formato ISO (derivado de TZ_OFFSET_MX).
const OFFSET_MX = `${TZ_OFFSET_MX < 0 ? '-' : '+'}${String(Math.abs(TZ_OFFSET_MX)).padStart(2, '0')}:00`;

export type JuntasLead = { fecha_junta_1?: string | null; junta_1_at?: string | null; fecha_junta_2?: string | null; junta_2_at?: string | null };

// fecha_junta_* es DATE ('YYYY-MM-DD'): parsearla directo daría medianoche UTC
// (= la TARDE del día anterior en MX) y una reunión de hoy contaría como pasada.
// Sin hora exacta (junta_*_at, Calendly) asumimos mediodía MX como hora default.
export function parseFechaJunta(x: string): number {
  return Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(x) ? `${x}T12:00:00${OFFSET_MX}` : x);
}

/** Timestamp (ms) de la próxima reunión FUTURA del lead, o null si no tiene. */
export function reunionFuturaMs(juntas: JuntasLead | null | undefined, ahoraMs: number = Date.now()): number | null {
  const candidatos = [juntas?.junta_1_at ?? juntas?.fecha_junta_1, juntas?.junta_2_at ?? juntas?.fecha_junta_2]
    .filter((x): x is string => Boolean(x))
    .map(parseFechaJunta)
    .filter((ms) => Number.isFinite(ms) && ms > ahoraMs);
  return candidatos.length ? Math.min(...candidatos) : null;
}

/**
 * La reunión que PREPARA la familia de la post-agenda: la R1 futura del lead, o null. Es la
 * que se anota en `reunion_at` y la que decide si una agenda posterior es «otra reunión».
 *
 * ⚠️ NO ES `reunionFuturaMs`, que se queda con la más próxima entre la R1 y la R2. Las tres
 * secuencias de `preparaUnaReunion` cuelgan de la R1 —su cohorte es `fecha_junta_1 >= hoy` y
 * `asistio_j1` vacío (lib/nutricion.ts)— y la R2 no es «volver a agendar». Con la otra
 * función, el caso típico se leía como una reunión nueva: la R1 fue hoy a las 10, en la misma
 * llamada se agendó la R2 para el jueves (lib/leads.ts → `setFechaJunta2` no toca
 * `asistio_j1`), y mientras nadie marque la asistencia el lead sigue en el cohorte hasta la
 * medianoche. La R1 ya pasó, la más próxima es la R2, otro día → el cron de la hora siguiente
 * reusaba la inscripción y le volvía a mandar el audio de la post-agenda («te dejo el video
 * para que llegues con contexto») a quien acababa de salir de la reunión. Medido el
 * 06/10/2026: de los 39 leads con R1 y R2 cargadas, 5 tienen la asistencia a la R1 vacía.
 *
 * Sin R1 futura devuelve null aunque haya R2: para el reuso es «sin reunión que preparar».
 */
export function reunionQuePreparaMs(juntas: JuntasLead | null | undefined, ahoraMs: number = Date.now()): number | null {
  const r1 = juntas?.junta_1_at ?? juntas?.fecha_junta_1;
  if (!r1) return null;
  const ms = parseFechaJunta(r1);
  return Number.isFinite(ms) && ms > ahoraMs ? ms : null;
}

/**
 * El día de una reunión (YYYY-MM-DD) en hora de México. Es la identidad de «una reunión».
 *
 * ⚠️ POR DÍA Y NO POR INSTANTE, y no es redondeo: la HORA de una reunión se refina sola. La
 * fecha llega primero (`fecha_junta_1`, DATE → mediodía MX) y la hora exacta puede llegar
 * después: `lib/leads.ts` la completa con `setIfEmpty('junta_1_at', …)`. Comparando instantes,
 * ese refinamiento —la MISMA reunión— se leía como una reunión nueva y le volvía a mandar el
 * audio de preparación a alguien que lo acababa de recibir. El costo de este criterio es el
 * opuesto y es el chico: quien reprograma para más tarde EL MISMO DÍA no recibe la preparación
 * otra vez, y para ese día ya la tuvo.
 *
 * En hora de MÉXICO y no UTC: una reunión a las 19:00 de Tijuana cae al día siguiente en UTC.
 */
export function diaDeReunion(ms: number): string {
  return new Date(ms + TZ_OFFSET_MX * 3_600_000).toISOString().slice(0, 10);
}

// ── La decisión ──────────────────────────────────────────────────────────────

/**
 * Los estados de una corrida que TERMINÓ: los únicos que se pueden reusar.
 *
 * · 'activa' / 'pausada' siguen en curso: reusarlas sería reiniciarle a alguien la secuencia
 *   por la mitad.
 * · 'handoff': la charla la sigue una persona.
 * · 'respondio': el lead está hablando, y la charla del setter puede estar abierta (#788). No
 *   es una espera larga: el desenlace la cierra como lograda en la corrida siguiente
 *   (212 y 213 tienen `logrado: 'respondio'`), y ahí ya cuenta.
 * · 'cancelada' NUNCA: ahí caen también la baja del email y «el lead no tiene email»
 *   (lib/nutricion.ts, el fallo `terminal`), además del archivado. Reusarla es escribirle a
 *   quien pidió que no.
 */
export const ESTADOS_TERMINADOS: readonly string[] = ['completada', 'no_responde'];

/** Lo que la decisión necesita de la fila vieja. */
export type FilaPrevia = {
  estado: string;
  desenlace: string | null;
  /**
   * La reunión que preparaba (mig 0205): se anota al inscribir y se re-anota en cada paso que
   * el motor procesa, así que es la del ÚLTIMO paso que salió — si el lead reprogramó a mitad
   * de la corrida, la que siguió. `null` = NO SE SABE: una fila de antes de la 0205, o una que
   * se inscribió cuando la reunión ya había pasado y no llegó a mandar nada. No es «otra».
   */
  reunion_at: string | null;
};

/**
 * ¿Le LLEGÓ algo de esta inscripción? Contadores de «¿hay alguno?», no de cuántos: un mismo
 * borrador puede contar dos veces (su fila en wa_borradores y su envío en estado 'borrador').
 */
export type MarcasInscripcion = { enviados: number; borradores: number };
export const SIN_MARCAS: MarcasInscripcion = { enviados: 0, borradores: 0 };

export type VeredictoReuso =
  | { reusable: true; porque: 'nada_le_llego' | 'reunion_nueva' }
  | { reusable: false; porque: 'sin_reunion_futura' | 'cancelada' | 'no_termino' | 'misma_reunion' | 'no_se_que_reunion_preparaba' };

/**
 * ¿Esta inscripción vieja se puede volver a usar para la reunión que el lead tiene AHORA?
 *
 * Las reglas, en el orden en que cortan:
 *
 *  1. SIN REUNIÓN FUTURA, NUNCA. `fecha_junta_1` es DATE y el cohorte mira `gte hoy`
 *     (lib/nutricion.ts), así que el día de una reunión ya pasada el lead sigue en el cohorte:
 *     reusarlo lo haría entrar y salir —«la reunión ya pasó»— en cada corrida del cron.
 *  2. Una corrida que no terminó, o cancelada, no (ver `ESTADOS_TERMINADOS`).
 *  3. LA MISMA REUNIÓN, NUNCA — tampoco para «rescatarla». Lo que quemó una corrida para esta
 *     reunión (un contacto bloqueado, el tope de antigüedad) la vuelve a quemar, y reusarla
 *     sería un bucle. Leído en el motor, no medido en la base: un contacto bloqueado termina
 *     su corrida con pasos 'omitido' y nada enviado, así que en la post-agenda (pasos a 1 h y
 *     24 h) volvía a arrancar cada ~25 horas hasta la reunión, dejando dos filas por vuelta.
 *     Una inscripción prepara UNA reunión, una vez.
 *  4. OTRA REUNIÓN, SÍ — haya recibido lo que haya recibido. Es la mitad (b) de la decisión.
 *  5. SI NO SE SABE QUÉ REUNIÓN PREPARABA (`reunion_at` null: las de antes de la 0205), sólo
 *     si no le llegó nada: ni un envío 'enviado' ni un borrador (de ningún estado) — ésa es la
 *     mitad (a), el rescate de los quemados. Y sólo si la corrida no se logró: un 'logrado' no
 *     se quemó, el lead contestó. «No sé qué reunión era» no autoriza a afirmar que era otra:
 *     es un tercer estado, y la dirección segura es no repetirle nada a quien ya recibió algo.
 *
 * ⚠️ UN BORRADOR DESCARTADO TAMBIÉN CUENTA COMO «LE LLEGÓ» en la regla 5: no salió, pero una
 * persona lo vio y decidió no mandarlo. Reusar la fila se lo volvería a proponer como si nadie
 * hubiera decidido nada.
 */
export function inscripcionReusable(p: {
  fila: FilaPrevia;
  marcas: MarcasInscripcion;
  /** La R1 FUTURA del lead hoy (ms), o null si no tiene (`reunionQuePreparaMs`, nunca la R2). */
  reunionNuevaMs: number | null;
}): VeredictoReuso {
  if (p.reunionNuevaMs == null || !Number.isFinite(p.reunionNuevaMs)) return { reusable: false, porque: 'sin_reunion_futura' };
  if (p.fila.estado === 'cancelada' || p.fila.desenlace === 'cancelado') return { reusable: false, porque: 'cancelada' };
  if (!ESTADOS_TERMINADOS.includes(p.fila.estado)) return { reusable: false, porque: 'no_termino' };

  const antes = p.fila.reunion_at ? Date.parse(p.fila.reunion_at) : NaN;
  if (Number.isFinite(antes)) {
    return diaDeReunion(antes) === diaDeReunion(p.reunionNuevaMs)
      ? { reusable: false, porque: 'misma_reunion' }
      : { reusable: true, porque: 'reunion_nueva' };
  }
  const nadaLeLlego = p.marcas.enviados === 0 && p.marcas.borradores === 0;
  const seQuemo = p.fila.desenlace == null || p.fila.desenlace === 'fallo';
  return nadaLeLlego && seQuemo
    ? { reusable: true, porque: 'nada_le_llego' }
    : { reusable: false, porque: 'no_se_que_reunion_preparaba' };
}

// ── Las lecturas ─────────────────────────────────────────────────────────────

const TANDA_IDS = 200;

/**
 * Qué le LLEGÓ por cada inscripción: envíos 'enviado' y borradores (los de wa_borradores en
 * cualquier estado, y los envíos que quedaron como 'borrador'). Paginado por `id` y en tandas,
 * como `enviosPorInscripcion`: un `.in()` suelto cortado en 1000 filas dejaría a una
 * inscripción sin su envío, y sin su envío pasaría por «no le llegó nada».
 *
 * Una inscripción sin nada no viene en el mapa: el que llama usa `SIN_MARCAS`. Si una lectura
 * falla, LANZA — decidir «no le llegó nada» sin haber podido mirar es la dirección que le
 * repite un mensaje a alguien.
 */
export async function marcasPorInscripcion(db: SupabaseClient, inscIds: readonly number[]): Promise<Map<number, MarcasInscripcion>> {
  const out = new Map<number, MarcasInscripcion>();
  const sumar = (id: number | null, campo: keyof MarcasInscripcion) => {
    if (id == null) return;
    const m = out.get(id) ?? { enviados: 0, borradores: 0 };
    m[campo] += 1;
    out.set(id, m);
  };
  for (const tanda of enTandas([...new Set(inscIds)], TANDA_IDS)) {
    await leerPorPaginas<{ inscripcion_id: number | null; estado: string }>(
      db, 'nutricion_envios', 'id, inscripcion_id, estado',
      (filas) => { for (const f of filas) sumar(f.inscripcion_id, f.estado === 'enviado' ? 'enviados' : 'borradores'); },
      { orden: 'id', filtros: (q) => q.in('inscripcion_id', tanda).in('estado', ['enviado', 'borrador']) },
    );
    await leerPorPaginas<{ inscripcion_id: number | null }>(
      db, 'wa_borradores', 'id, inscripcion_id',
      (filas) => { for (const f of filas) sumar(f.inscripcion_id, 'borradores'); },
      { orden: 'id', filtros: (q) => q.in('inscripcion_id', tanda) },
    );
  }
  return out;
}

// ── El reuso ─────────────────────────────────────────────────────────────────

export type Reactivacion = {
  id: number;
  /** Lo que se LEYÓ de la fila. Es el compare-and-set: si otro la movió entre medio, no se toca. */
  leido: Pick<FilaPrevia, 'estado' | 'desenlace'>;
  proximoEnvioAt: string;
  /** La reunión que va a preparar ahora. */
  reunionAt: string | null;
  /**
   * El instante de la decisión, en ISO: tomado ANTES de leer la fila que `leido` describe.
   *
   * ⚠️ NO el de la llamada. Es el corte de lo que se desliga (`created_at <= ahora`), y entre
   * la lectura y esta llamada otra corrida pudo ganar el reclamo y ya haber mandado su primer
   * paso. Con el instante de la llamada, el corte caía DESPUÉS de lo de la ganadora: el que
   * perdía le descartaba el borrador pendiente recién creado —el motor ya había anotado
   * 'borrador' y avanzado, o sea la corrida nueva quemada en silencio— y le desligaba su envío,
   * y recién ahí perdía el compare-and-set. Con el instante de antes de leer no puede: si la
   * otra reclamó antes de la lectura, ésta leyó 'activa' y ni lo intenta; si reclamó después,
   * todo lo suyo es posterior al corte.
   */
  ahora: string;
};

/**
 * Lo que la fila reusada escribe. Es una inscripción NUEVA con el id viejo: todo lo que es de
 * una corrida vuelve a como lo deja un insert — el paso, el desenlace, el reloj del silencio
 * (`ultimo_paso_at`) y la charla del setter (#788), que era de la reunión anterior.
 * `inscripto_at` es ahora: esta corrida empezó hoy.
 */
export function camposDeReactivacion(r: Pick<Reactivacion, 'proximoEnvioAt' | 'reunionAt' | 'ahora'>) {
  return {
    estado: 'activa',
    paso_actual: 0,
    // ⚠️ Y EL NODO TAMBIÉN (mig 0223). El motor busca primero por `nodo_actual`: con el de la
    // corrida vieja puesto, la reusada arrancaría en el último nodo de antes y no en la entrada.
    nodo_actual: null,
    // ⚠️ Y LOS HILOS (mig 0228, segunda tanda). Con los de la corrida vieja puestos, la reusada
    // seguiría desde donde quedaron sus caminos en paralelo; en NULL vuelve a ser una fila nueva y
    // el motor la reparte en las raíces la primera vez que la procesa.
    hilos: null,
    proximo_envio_at: r.proximoEnvioAt,
    reunion_at: r.reunionAt,
    desenlace: null,
    desenlace_at: null,
    ultimo_paso_at: null,
    conversacion_ultima_at: null,
    conversacion_cierre: null,
    conversacion_cerrada_at: null,
    inscripto_at: r.ahora,
    updated_at: r.ahora,
  };
}

/**
 * Reusa la inscripción `r.id` para una corrida nueva. Devuelve si la reclamó.
 *
 * Dos pasos, en este orden:
 *
 * 1. LO DE LA CORRIDA VIEJA DEJA DE COLGAR DE ESTA INSCRIPCIÓN, conservando cada fila.
 *    ⚠️ Es lo que hace que el reuso no se queme solo (refutador del relevo, (4)):
 *    `uq_wa_borradores_toque` es `(workspace_id, inscripcion_id, paso)` y NO es parcial
 *    (mig 0074), y `crearBorrador` hace upsert con `ignoreDuplicates`. Un borrador viejo de
 *    esa inscripción para ese paso —aunque esté descartado— hacía que el nuevo se descartara
 *    sin aviso, mientras el motor anotaba 'borrador' y avanzaba: la corrida nueva salía
 *    quemada igual que la vieja, y nadie veía nada.
 *    · Los borradores PENDIENTES se descartan: preparaban otra reunión, y mientras haya uno el
 *      motor no deja otro (`tieneBorradorNutriPendiente`) — la corrida nueva esperaría de a 6 h
 *      a que alguien mande el viejo, y después saldrían los dos.
 *    · Todos los borradores y todos los envíos se DESLIGAN (`inscripcion_id = null`). Los
 *      envíos también, porque cuatro lectores preguntan por inscripción y con los viejos
 *      colgados mienten sobre la corrida nueva: el desenlace (contaría el silencio desde el
 *      último envío VIEJO y avisaría «le escribí N veces» sumando los dos), la charla del setter
 *      (`tieneEnviado` antes de mandar nada), la respuesta tardía de `pausarPorRespuesta` (la
 *      daría por lograda sin haber hecho nada) y `anotarPasoEnviado` (al mandar el borrador
 *      nuevo marcaría 'enviado' también el viejo de ese paso, que nunca salió). La historia no
 *      se pierde: cada fila conserva su `lead_id` y su `secuencia_id`.
 *    · Sólo lo creado HASTA la decisión (`created_at <= ahora`, con `ahora` tomado antes de
 *      LEER la fila: ver `Reactivacion.ahora`): si otra corrida ganó el reclamo y ya mandó
 *      algo, eso es suyo y no se toca.
 *    Va ANTES del reclamo a propósito: si falla, tira y no se reactiva nada. Al revés, una
 *    falla dejaba la fila activa con lo viejo colgado, que es justo el bug de arriba.
 * 2. EL RECLAMO, con compare-and-set sobre lo leído (`estado` y `desenlace`): si dos corridas
 *    del cron deciden lo mismo a la vez, una toca la fila y la otra toca 0 y se abstiene.
 *    El costo de ese orden: si pierde, ya desligó lo viejo de una fila que alguien estaba
 *    moviendo en el mismo instante. Es una ventana de milisegundos sobre una fila terminada.
 */
export async function reactivarInscripcion(db: SupabaseClient, r: Reactivacion): Promise<boolean> {
  const descartados = await db.from('wa_borradores')
    .update({ estado: 'descartado' })
    .eq('inscripcion_id', r.id).eq('estado', 'pendiente').lte('created_at', r.ahora);
  if (descartados.error) throw new Error(`reactivarInscripcion(${r.id}) borradores pendientes: ${descartados.error.message}`);
  const borradores = await db.from('wa_borradores')
    .update({ inscripcion_id: null })
    .eq('inscripcion_id', r.id).lte('created_at', r.ahora);
  if (borradores.error) throw new Error(`reactivarInscripcion(${r.id}) borradores: ${borradores.error.message}`);
  const envios = await db.from('nutricion_envios')
    .update({ inscripcion_id: null })
    .eq('inscripcion_id', r.id).lte('created_at', r.ahora);
  if (envios.error) throw new Error(`reactivarInscripcion(${r.id}) envíos: ${envios.error.message}`);

  const q = db.from('nutricion_inscripciones')
    .update(camposDeReactivacion(r))
    .eq('id', r.id).eq('estado', r.leido.estado);
  const { data, error } = await (r.leido.desenlace == null ? q.is('desenlace', null) : q.eq('desenlace', r.leido.desenlace)).select('id');
  if (error) throw new Error(`reactivarInscripcion(${r.id}): ${error.message}`);
  return (data ?? []).length > 0;
}
