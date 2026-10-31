// =============================================================================
// Media Buyer — los TOPES del negocio (PURO)
// =============================================================================
// Martín, 25/10/2026: «topes por negocio: cuánto puede subir el presupuesto por día, el gasto máximo, y un
// interruptor que lo apaga todo». Se miran en el MOMENTO de escribir, con el estado leído en vivo, y no al
// proponer: entre que MaKo propone y alguien lanza pueden pasar horas, y otra decisión pudo subir lo mismo.
//
// ⚠️ Lo que sube el gasto (subir presupuesto, prender) pasa por acá SIEMPRE: lo lance el piloto, una persona,
// MaKo desde el chat, o un «Deshacer» que devuelve un presupuesto más alto. Lo que lo baja (bajar, pausar)
// sólo necesita el interruptor prendido.
// =============================================================================

import type { ConfigMediaBuyer, Decision, EstadoEntidad, TipoDecision } from './tipos';

/**
 * ¿Otra decisión ya cambió el presupuesto de la MISMA entidad después de que se propuso ésta? Entonces lanzarla compondría:
 * el motor y los agentes propios pueden dejar dos bajas abiertas sobre lo mismo, y la segunda aplicaba su porcentaje sobre lo
 * que ya había bajado la primera (−20% dos veces = −36%). Revisión de tren-l, falla 1.
 */
/** Cuánto puede tardar en guardar sus `creados` un lanzamiento de anuncios (2N llamadas a Zernio; la ruta corta a los 300 s). */
export const CREANDO_MAX_MS = 10 * 60_000;

/**
 * ¿Una decisión de anuncios «aplicada» está todavía creándolos? Sus `creados` se guardan juntos al final, así que vacía y
 * RECIENTE es una a mitad de camino; vacía y vieja es una que se cortó (o una subida reintentada que no creó nada) y se puede
 * deshacer. Sin el tiempo, quedaba trabada para siempre (verificación de tren-m, falla 8).
 */
export function seEstaCreando(d: Pick<Decision, 'creados' | 'aplicadaAt'>, ahora = Date.now()): boolean {
  return !d.creados.length && !!d.aplicadaAt && ahora - Date.parse(d.aplicadaAt) < CREANDO_MAX_MS;
}

/**
 * ¿El presupuesto de hoy ya no es el de cuando MaKo propuso? Entonces la decisión está vieja: se cierra y la próxima corrida
 * la vuelve a mirar con el número de hoy. Antes se aplicaba «el mismo porcentaje sobre el de hoy», y un cambio que no es una
 * decisión del Media Buyer (por el chat, la tabla o a mano en Meta) componía con ese porcentaje sin que nadie lo viera, el piloto
 * incluido (verificación de tren-m, falla 1; el Cerebro decidió comparar contra el de la propuesta). Un 1% de tolerancia: el
 * redondeo de Meta y de la conversión no es un cambio.
 */
export function presupuestoCambioDesdeLaPropuesta(propuesto: number | null | undefined, actual: number): boolean {
  if (!(typeof propuesto === 'number' && propuesto > 0)) return false;
  return Math.abs(actual - propuesto) / propuesto > 0.01;
}

export function presupuestoYaCambiado(
  d: Pick<Decision, 'id' | 'entidadId' | 'creada'>,
  otras: readonly Pick<Decision, 'id' | 'entidadId' | 'estado' | 'despues' | 'aplicadaAt'>[],
): boolean {
  return otras.some((o) => o.id !== d.id && o.entidadId === d.entidadId && o.estado === 'aplicada'
    && o.despues.presupuesto != null && !!o.aplicadaAt && o.aplicadaAt > d.creada);
}

export type ContextoTopes = {
  config: ConfigMediaBuyer;
  /** El estado de la entidad leído EN VIVO antes de escribir. */
  actual: EstadoEntidad;
  /** El presupuesto con que la entidad EMPEZÓ el día (antes de la primera subida de hoy); null = el actual. */
  inicioDelDia: number | null;
  /** La suma de los presupuestos diarios de lo que está prendido en la cuenta, en la unidad del gasto. */
  totalActivo: number;
  /** El presupuesto diario que suma prender esta entidad (moneda de la cuenta); null si no tiene propio. */
  presupuestoQueSuma: number | null;
  aUnidad: (montoCuenta: number) => number;
  deUnidad: (unidad: number) => number;
  fmt: (unidad: number) => string;
};

export type ResultadoTopes =
  | { ok: true; despues: EstadoEntidad; ajuste: string | null }
  | { ok: false; motivo: string };

const piso2 = (x: number): number => Math.floor(x * 100) / 100;

/**
 * ¿Se puede escribir esto? Devuelve lo que se escribe (a veces recortado, con el porqué) o el tope que lo frenó.
 * `deshacer` = lo pide un «Deshacer»: pasa aunque el interruptor esté apagado (volver atrás nunca es lo peligroso),
 * pero si sube el gasto mira el tope de la cuenta igual.
 */
export function aplicarTopes(tipo: TipoDecision, despues: EstadoEntidad, ctx: ContextoTopes, opts: { deshacer?: boolean } = {}): ResultadoTopes {
  const { config } = ctx;
  if (!config.encendido && !opts.deshacer) return { ok: false, motivo: 'El Media Buyer está apagado: préndelo en Ajustes para lanzar decisiones.' };

  if (tipo === 'activar' || despues.estado === 'ACTIVE') {
    if (config.presupuestoMaxDia != null && ctx.presupuestoQueSuma != null && ctx.actual.estado !== 'ACTIVE') {
      const total = ctx.totalActivo + ctx.aUnidad(ctx.presupuestoQueSuma);
      if (total > config.presupuestoMaxDia + 1e-6) {
        return { ok: false, motivo: `Prenderlo dejaría la cuenta en ${ctx.fmt(total)} por día, y tu tope es ${ctx.fmt(config.presupuestoMaxDia)}.` };
      }
    }
    return { ok: true, despues, ajuste: null };
  }

  if (despues.presupuesto == null || ctx.actual.presupuesto == null) return { ok: true, despues, ajuste: null };
  const actual = ctx.actual.presupuesto;
  let nuevo = despues.presupuesto;
  if (nuevo <= actual) return { ok: true, despues, ajuste: null }; // bajar nunca pasa un tope de subida

  let ajuste: string | null = null;
  // Tope 1: cuánto puede subir en el día (no aplica a un Deshacer: devuelve lo que ya había).
  if (!opts.deshacer) {
    const base = ctx.inicioDelDia ?? actual;
    const techo = piso2(base * (1 + config.subidaMaxPctDia / 100));
    if (nuevo > techo) {
      if (techo <= actual) return { ok: false, motivo: `Hoy ya subió todo lo que permite tu tope (${config.subidaMaxPctDia}% por día).` };
      nuevo = techo;
      ajuste = `Recortado a ${config.subidaMaxPctDia}% por día, tu tope.`;
    }
  }
  // Tope 2: el presupuesto diario de toda la cuenta.
  if (config.presupuestoMaxDia != null) {
    const resto = ctx.totalActivo - (ctx.actual.estado === 'PAUSED' ? 0 : ctx.aUnidad(actual));
    const total = resto + ctx.aUnidad(nuevo);
    if (total > config.presupuestoMaxDia + 1e-6) {
      const permitido = piso2(ctx.deUnidad(config.presupuestoMaxDia - resto));
      if (permitido <= actual) return { ok: false, motivo: `La cuenta ya está en su tope de ${ctx.fmt(config.presupuestoMaxDia)} por día.` };
      nuevo = permitido;
      ajuste = `Recortado para no pasar tu tope de ${ctx.fmt(config.presupuestoMaxDia)} por día en la cuenta.`;
    }
  }
  return { ok: true, despues: { ...despues, presupuesto: nuevo }, ajuste };
}
