// =============================================================================
// cuenta-sin-cobro-reglas — «Habilitado sin cobro»: el interruptor de super admin por negocio (19/11/2026)
// =============================================================================
// Martín: un negocio cargado a mano, sin prueba ni cobro (P2P Consulting en Essential), contra el circuito normal de cualquier negocio nuevo
// («si desactivo eso, simplemente entra en la configuración de siempre»). Decisión del Cerebro (19/11): UN ajuste por negocio, SIN migración:
// `cuenta.sin_cobro` en `app_settings` de ESE negocio, con `{ activo, por, at }`.
//   · PRENDIDO (`activo: true`): como hoy, habilitado sin prueba ni cobro; la lista de Customers lo marca con un chip.
//   · APAGADO (`activo: false`): el circuito normal de un negocio nuevo (7 días de prueba y después el cobro de su plan, con los avisos de la
//     prueba). No se pausa ni se borra nada en el acto.
//   · SIN REGISTRO: nunca se tocó el interruptor: como hoy (el negocio no se cobra por esta vía) y sin chip.
// ⚠️ LO ESCRIBE SÓLO MARTÍN AL TOCAR EL INTERRUPTOR (`ponerSinCobroAction`, la acción pide el super admin en su primera línea): ningún código
// cambia el interruptor solo.
// APAGADO = LA PRUEBA DE SIEMPRE, CONECTADA (19/11/2026, chat de Cobros): desde que Martín lo apaga corren 7 días de prueba (`finDeLaPruebaSinCobro`).
//   · En la app, el aviso de la esquina dice «Tu prueba termina el DD/MM · Elegir mi plan» (app/_components/AvisoMoraPlan.tsx): carga su tarjeta y,
//     donde la pasarela lo deja (Mercado Pago), el primer cobro es el día que termina la prueba (`reactivarPlan` con `inicioAt`, lib/compra-plan.ts).
//   · Terminada la prueba sin un plan suyo (pagado, o autorizado y esperando su primer cobro), la cuenta se PAUSA con el corte `prueba-terminada`
//     (lib/plan-acceso-reglas.ts): /cuenta-pausada le ofrece activar su plan, y con el plan vuelve a entrar. Vale aunque el corte general esté apagado.
//   · Si Martín lo vuelve a PRENDER, la pausa de este corte se levanta (`pasoSinCobro`). Lo corre el cron de cobros cada media hora y el interruptor.
// Puro: sin base ni red. Lo prueba tests/cuenta-sin-cobro.test.ts.
// =============================================================================

export const CLAVE_SIN_COBRO = 'cuenta.sin_cobro';

export type SinCobro = { activo: boolean; por: string | null; at: string | null };

/** Lo guardado en el ajuste (JSON); vacío o roto = nunca se tocó (`null`: ni prendido ni apagado). */
export function sinCobroDeSetting(crudo: string | null | undefined): SinCobro | null {
  if (!crudo) return null;
  try {
    const o = JSON.parse(crudo) as Record<string, unknown>;
    if (!o || typeof o !== 'object' || typeof o.activo !== 'boolean') return null;
    const t = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
    return { activo: o.activo, por: t(o.por, 120), at: t(o.at, 40) };
  } catch { return null; }
}

/** ¿Está marcado «Habilitado sin cobro»? Sólo con el interruptor prendido a propósito. */
export const habilitadoSinCobro = (s: SinCobro | null | undefined): boolean => s?.activo === true;

/** Lo que pide el cartel antes de APAGAR. */
export const TEXTO_CONFIRMAR_APAGAR = 'Este negocio pasa al circuito normal: 7 días de prueba y después el cobro de su plan. Si en esos 7 días no carga su tarjeta, su cuenta se pausa hasta que pague.';
export const TEXTO_SIN_COBRO = 'Habilitado sin cobro: cargado a mano, sin prueba ni cobro.';
/** Nunca se tocó y no paga por ninguna vía (su plan, su mensualidad, su agencia): entra sin cobro de hecho (19/11/2026). */
export const TEXTO_SIN_COBRO_DE_HECHO = 'Entra sin cobro (cargado a mano). Apágalo para que pase a la prueba de 7 días y después al cobro de su plan.';
export const CHIP_SIN_COBRO = 'Sin cobro';

// ── Apagado: la prueba y la pausa (19/11/2026) ─────────────────────────────────────────────────────────────────

/** Días de prueba desde que se apaga (los de cualquier alta: `PRUEBA_DIAS` de lib/planes-mako.ts; un test los ata). */
export const DIAS_DE_PRUEBA_SIN_COBRO = 7;

/** Cuándo termina la prueba de un negocio con el interruptor APAGADO (ISO); null si está prendido, nunca se tocó, o no se sabe desde cuándo. */
export function finDeLaPruebaSinCobro(s: SinCobro | null | undefined): string | null {
  if (!s || s.activo !== false || !s.at) return null;
  const t = Date.parse(s.at);
  return Number.isFinite(t) ? new Date(t + DIAS_DE_PRUEBA_SIN_COBRO * 86_400_000).toISOString() : null;
}

/** El motivo del corte de esta pausa (lib/plan-acceso-reglas.ts, `MotivoCorte`). */
export const MOTIVO_PRUEBA_TERMINADA = 'prueba-terminada' as const;

export type PasoSinCobro = { tipo: 'nada' } | { tipo: 'pausar'; hasta: string } | { tipo: 'reabrir' };

/**
 * Qué hacer con un negocio según su interruptor. `plan`: tiene un plan de MaKo suyo (pagado, o autorizado y esperando su primer cobro);
 * `undefined` = no se pudo leer (entonces NUNCA se pausa). `corteNuestro`: está pausado por ESTE corte (`prueba-terminada`, vigente).
 *   · prendido o nunca tocado → si lo pausó este corte, se reabre (Martín lo volvió a habilitar); si no, nada;
 *   · apagado con plan → si lo pausó este corte, se reabre; si no, nada;
 *   · apagado, sin plan, terminada la prueba y activo → se pausa. Pausado por otra cosa (a mano, la mensualidad) no se toca.
 */
export function pasoSinCobro(p: { sinCobro: SinCobro | null; plan: boolean | undefined; estado: string | null; corteNuestro: boolean; ahora: number }): PasoSinCobro {
  const fin = finDeLaPruebaSinCobro(p.sinCobro);
  if (!fin) return p.corteNuestro && p.estado === 'pausado' ? { tipo: 'reabrir' } : { tipo: 'nada' };
  if (p.plan === true) return p.corteNuestro && p.estado === 'pausado' ? { tipo: 'reabrir' } : { tipo: 'nada' };
  if (p.plan === undefined) return { tipo: 'nada' };
  if (p.estado === 'activo' && p.ahora >= Date.parse(fin)) return { tipo: 'pausar', hasta: fin };
  return { tipo: 'nada' };
}

/** Lo que dice la ficha con el interruptor apagado: hasta cuándo es la prueba. */
export function textoDelApagado(s: SinCobro | null, ahora: number = Date.now()): string {
  const fin = finDeLaPruebaSinCobro(s);
  if (!fin) return 'Apagado: sigue el circuito normal (prueba y después el cobro de su plan).';
  const dia = `${fin.slice(8, 10)}/${fin.slice(5, 7)}`;
  return Date.parse(fin) > ahora
    ? `Apagado: está en su prueba hasta el ${dia}. Si no carga su tarjeta, ese día se pausa.`
    : `Apagado: su prueba terminó el ${dia}. Sin su plan, la cuenta queda en pausa hasta que pague.`;
}
