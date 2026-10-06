// =============================================================================
// El RESIDUO: los leads a los que ningún disparador de la nutrición alcanza ya
// =============================================================================
// Todos los disparadores con reunión miran una ventana de 45 días sobre el hito
// (`fechaDesde45` en `cohorteDeTrigger`): pasado ese plazo, quien asistió a la R1
// sin comprar o faltó a ella queda afuera de todos, para siempre y sin un log.
// Medido en ws1 el 06/10/2026: 1.157 leads; 63 abiertos en esa situación (25
// asistieron sin comprar, 38 faltaron a la R1) y 884 formularios que nunca
// agendaron, de más de 45 días.
//
// La decisión de Martín (06/10/2026): «email a los 884 y WhatsApp a los ~80 con
// reunión». Por eso hay DOS preguntas y no una:
//
//   · `esResiduo`             → el WhatsApp (trigger `residuo_sin_cierre`): los
//                               que TUVIERON reunión. Son pocos, ya nos vieron la
//                               cara, y un WhatsApp no es un mensaje en frío.
//   · `esResiduoFormulario`   → el email (segmento del broadcast): los que nunca
//                               agendaron. De los 884, sólo 2 escribieron alguna vez
//                               por WhatsApp: escribirles primero por la línea no
//                               oficial es lo que AGENTS.md prohíbe para cuidarla.
//
// ⚠️ SÓLO LOS ABIERTOS. Los 9 perdidos, los 6 descalificados y los 2 «no responde»
// que tuvieron reunión NO están decididos: quedan afuera hasta que alguien decida,
// y se agregan acá (no en el motor) el día que se decida.
//
// ⚠️ Y LOS 12 CON LA R1 SIN ASISTENCIA MARCADA TAMPOCO ENTRAN (9 abiertos). No se
// sabe si fueron: decirles «qué bueno que hablamos» o «te extrañamos en la
// llamada» es afirmar algo que nadie midió.
//
// ⚠️ SIN `server-only` Y SIN IMPORTS, A PROPÓSITO: decide a quién le llega un
// mensaje real, así que es justo lo que no puede quedarse sin test (el mismo
// criterio que `lib/nutricion-familias.ts`). Lo que lee la base vive en
// `lib/nutricion-residuo-cohorte.ts` y llama a esto.

/** El disparador del WhatsApp al residuo. */
export const TRIGGER_RESIDUO = 'residuo_sin_cierre';

/** El segmento de broadcast del email al residuo (`SEGMENTOS` de lib/email-marketing.ts). */
export const SEGMENTO_RESIDUO = 'residuo-formularios';

/**
 * Cuántos días sin novedad hacen falta para ser residuo. Es el MISMO 45 que la
 * ventana de los disparadores con reunión: más corto, el residuo le pisaría el
 * turno a `no_show_j1` / `post_j1_sin_avanzar`; más largo, quedaría un hueco donde
 * no alcanza nadie, que es justo lo que esto vino a cerrar.
 */
export const RESIDUO_DIAS = 45;

/**
 * Cuántos mensajes del residuo salen por día, SUMANDO todos los pasos de su
 * secuencia (ver `turnosResiduo`).
 *
 * ⚠️ NO ES UN TOPE DEL MOTOR: el tope sigue siendo `MAX_POR_DIA` (40 por día,
 * compartido con TODAS las secuencias). Esto es el ritmo al que se AGENDAN los
 * turnos: la cola ordena por `proximo_envio_at`, así que 63 filas insertadas
 * juntas se ponían delante de la post-agenda durante días. Con 10 por día el
 * residuo usa, como mucho, la cuarta parte del cupo.
 */
export const RESIDUO_POR_DIA = 10;

/**
 * Los estados de una inscripción que dicen «a este lead ya le está hablando otra
 * secuencia, o una persona». Quien tenga una así en OTRA secuencia no es residuo:
 * la reactivación se le encimaría a una charla viva.
 */
export const ESTADOS_OCUPADO: readonly string[] = ['activa', 'respondio', 'handoff'];

/** Las columnas de `leads` que las dos preguntas necesitan. */
export const COLS_RESIDUO = 'id, estado_lead, telefono, email, email_opt_out, created_at, fecha_agenda, fecha_junta_1, junta_1_at, fecha_junta_2, junta_2_at, asistio_j1, asistio_j2, fecha_primer_pago, cerro';

export type LeadResiduo = {
  id: number;
  estado_lead: string | null;
  telefono?: string | null;
  email?: string | null;
  email_opt_out?: boolean | null;
  created_at: string | null;
  fecha_agenda: string | null;
  fecha_junta_1: string | null;
  junta_1_at?: string | null;
  fecha_junta_2: string | null;
  junta_2_at?: string | null;
  asistio_j1: boolean | null;
  asistio_j2: boolean | null;
  fecha_primer_pago: string | null;
  cerro: boolean | null;
};

export type MotivoResiduo = 'asistio_sin_comprar' | 'falto_r1' | 'formulario_sin_agenda';

const DIA_MS = 86_400_000;

/**
 * Una fecha de reunión en milisegundos. `fecha_junta_*` es DATE: sin hora, cuenta
 * como mediodía de México — la misma convención que `parseFechaJunta` en
 * lib/nutricion.ts. Contra 45 días, las seis horas de diferencia entre las dos
 * zonas no mueven a nadie de lado.
 */
function msDe(x: string | null | undefined): number {
  if (!x) return Number.NaN;
  return Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(x) ? `${x}T12:00:00-06:00` : x);
}

/** El teléfono como lo guarda `wa_bloqueados`: sólo dígitos. */
export function soloDigitos(t: string | null | undefined): string {
  return (t ?? '').replace(/\D/g, '');
}

/**
 * ¿Ya pagó o cerró? Las tres señales que hay, y cualquiera alcanza: un lead que
 * pagó no recibe una reactivación, y si además el motor lo ve como cliente le
 * manda AUTOMÁTICO (`esLeadCliente`), así que equivocarse acá es un mensaje
 * directo al teléfono de alguien que acaba de comprar.
 */
export function estaPagado(l: Pick<LeadResiduo, 'id' | 'fecha_primer_pago' | 'cerro'>, pagados: ReadonlySet<number>): boolean {
  return !!l.fecha_primer_pago || l.cerro === true || pagados.has(l.id);
}

/**
 * POR QUÉ un lead es residuo, o `null` si no lo es. No mira el estado del lead
 * ni si pagó: eso lo ponen las dos preguntas de abajo, que son las que se usan.
 *
 * · Con una reunión por delante, no: lo cubre la post-agenda.
 * · Con una reunión en los últimos 45 días, no: lo cubren los disparadores de 45.
 * · Asistió (a la R1 o a la R2) hace más de 45 días → `asistio_sin_comprar`.
 * · Faltó a la R1 hace más de 45 días → `falto_r1`.
 * · R1 sin asistencia marcada → no (ver la cabecera).
 * · Sin reunión ni agenda, creado hace más de 45 días → `formulario_sin_agenda`.
 * · Agendó y no hay fecha de reunión → no: no se sabe qué pasó.
 */
export function motivoResiduo(l: LeadResiduo, ahoraMs: number): MotivoResiduo | null {
  const corte = ahoraMs - RESIDUO_DIAS * DIA_MS;
  // La hora exacta (Calendly) le gana a la fecha, como en `reunionFuturaMs`.
  const reuniones = [l.junta_1_at ?? l.fecha_junta_1, l.junta_2_at ?? l.fecha_junta_2]
    .map(msDe)
    .filter((ms) => Number.isFinite(ms));
  if (reuniones.length === 0) {
    if (l.fecha_agenda) return null;
    const creado = msDe(l.created_at);
    return Number.isFinite(creado) && creado < corte ? 'formulario_sin_agenda' : null;
  }
  // Manda la ÚLTIMA reunión. Una por delante también cae acá (es posterior al corte),
  // así que no lleva guarda propia: sería una línea que ningún test puede romper.
  if (Math.max(...reuniones) >= corte) return null;
  if (l.asistio_j1 === true || l.asistio_j2 === true) return 'asistio_sin_comprar';
  if (l.asistio_j1 === false) return 'falto_r1';
  return null;
}

export type CtxResiduo = {
  ahoraMs: number;
  /** Los `lead_id` con al menos una fila de `pagos` con `pagado = true`. */
  pagados: ReadonlySet<number>;
  /** Los teléfonos de `wa_bloqueados`, en dígitos. */
  bloqueados: ReadonlySet<string>;
  /** Los `lead_id` con una inscripción en `ESTADOS_OCUPADO` en una secuencia que NO es del residuo. */
  ocupados: ReadonlySet<number>;
};

/**
 * ¿Le toca el WhatsApp del residuo? Los que tuvieron reunión, abiertos, sin pago,
 * con teléfono, sin bloqueo y sin otra secuencia hablándoles.
 *
 * ⚠️ SE PREGUNTA DOS VECES: al inscribir Y AL MANDAR (`residuoVigente`). El
 * escalonado reparte los turnos en días, y en esos días el lead puede pagar o
 * agendar. Si paga, `esLeadCliente` hace que el motor le mande AUTOMÁTICO — una
 * reactivación a un cliente recién pagado. Es la regla de la casa: un mensaje que
 * habla de un momento se re-pregunta al salir.
 */
export function esResiduo(l: LeadResiduo, ctx: CtxResiduo): boolean {
  if (l.estado_lead !== 'abierto') return false;
  if (estaPagado(l, ctx.pagados)) return false;
  const tel = soloDigitos(l.telefono);
  if (!tel || ctx.bloqueados.has(tel)) return false;
  if (ctx.ocupados.has(l.id)) return false;
  const m = motivoResiduo(l, ctx.ahoraMs);
  return m === 'asistio_sin_comprar' || m === 'falto_r1';
}

/**
 * ¿Le toca el EMAIL del residuo? Los formularios que nunca agendaron, abiertos,
 * sin pago, con email y sin baja. No mira el bloqueo de WhatsApp: bloquear un
 * teléfono no dice nada de su correo.
 */
export function esResiduoFormulario(l: LeadResiduo, ctx: Pick<CtxResiduo, 'ahoraMs' | 'pagados'>): boolean {
  if (l.estado_lead !== 'abierto') return false;
  if (estaPagado(l, ctx.pagados)) return false;
  if (!(l.email ?? '').trim() || l.email_opt_out === true) return false;
  return motivoResiduo(l, ctx.ahoraMs) === 'formulario_sin_agenda';
}

/**
 * Los turnos del primer paso para `n` leads nuevos del residuo, en milisegundos.
 *
 * El espaciado es `día × pasos / porDia`: con una secuencia de N pasos, cada lead
 * manda N mensajes, así que espaciar los PRIMEROS así deja el total del residuo en
 * `porDia` por día cuando la secuencia está entera en marcha. Contar sólo el primer
 * paso dejaba salir N veces más.
 *
 * ⚠️ Y SE CUENTA DESDE EL ÚLTIMO TURNO YA AGENDADO, NO DESDE AHORA. Si no, los leads
 * que cumplen los 45 días después se apilan sobre los mismos días que ya estaban
 * repartidos y el día se pasa de `porDia`. Si el último turno ya pasó (o no hay
 * ninguno pendiente), arranca en `desdeMs`.
 */
export function turnosResiduo(o: {
  desdeMs: number;
  ultimoMs: number | null;
  n: number;
  pasos?: number;
  porDia?: number;
}): number[] {
  const porDia = Math.max(1, o.porDia ?? RESIDUO_POR_DIA);
  const pasos = Math.max(1, o.pasos ?? 1);
  const espacio = (DIA_MS * pasos) / porDia;
  const inicio = o.ultimoMs != null && Number.isFinite(o.ultimoMs)
    ? Math.max(o.desdeMs, o.ultimoMs + espacio)
    : o.desdeMs;
  return Array.from({ length: Math.max(0, o.n) }, (_, k) => Math.round(inicio + k * espacio));
}
