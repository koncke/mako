// =============================================================================
// plan-acceso-reglas — ¿este negocio sigue pagando su lugar en MaKo? (lo puro)
// =============================================================================
// «Quien deja de pagar sigue entrando» (docs/hallazgos-planes-y-cobro.md): darse de baja cortaba el COBRO pero no
// el ACCESO, y una renovación de agencia sin autorizar tampoco cortaba nada. No existía el estado de suscripción por
// negocio. Estas reglas lo DERIVAN de los cobros de la plataforma, sin una tabla nueva: lo que MaKo cobra por el lugar
// de un negocio vive en `cobros` del ws de la plataforma, atado al negocio por `alta_ws` (un plan vendido con el
// alta automática) o por `cliente_ws` (el lugar de un cliente de agencia, mig 0308).
//
// LO QUE SE DECIDIÓ (17/10/2026, sin Martín, con la vara de AGENTS.md: se copia lo que hacen Stripe y Paddle):
//   · Sólo se corta a quien MaKo le vendió el acceso POR LA PASARELA. Un negocio sin un cobro de la plataforma (el ws1,
//     los clientes con un acuerdo a mano) no tiene nada que vencer: nunca se corta.
//   · Quien pagó el mes lo usa hasta el final (Stripe y Paddle programan la baja al fin del período pagado). El corte
//     llega a los GRACIA_DIAS de que se terminó lo pagado: Mercado Pago avisa tarde y una tarjeta rechazada se reintenta.
//   · Un pago devuelto (reembolsado) no cubre nada: se corta desde la devolución, también con la gracia.
//   · Una renovación de agencia que la agencia no autorizó: lo pagado termina el día que la renovación tenía que
//     empezar a cobrar (`inicio_at`, que es «un mes después del fin del onboarding»).
//   · Con UNA suscripción activa y pagada, el negocio está al día aunque haya cobros viejos cancelados.
//   · Los planes son MENSUALES (todos los que vende /admin/cobros). Un plan anual pediría el período en el cobro.
// =============================================================================

/** Días entre que se termina lo pagado y que se corta el acceso. */
export const GRACIA_DIAS = 5;
const DIA_MS = 86_400_000;

/** Lo que estas reglas necesitan de un cobro de la plataforma (un subconjunto de `Cobro` + las columnas de la 0308). */
export type CobroDelLugar = {
  id: number;
  tipo: 'unico' | 'suscripcion';
  estado: 'pendiente' | 'pagado' | 'fallido' | 'anulado' | 'reembolsado';
  suscripcion_estado: 'activa' | 'cancelada' | null;
  pagado_at: string | null;
  reembolsado_at: string | null;
  inicio_at?: string | null;
  created_at: string;
};

/** Una cuota cobrada de ese cobro (las renovaciones son una cuota por mes, con `cobro_id`). */
export type PagoDelLugar = { cobro_id: number; pagado: boolean; fecha_pago: string | null };

export type Vigencia =
  | { estado: 'sin-pasarela' }
  | { estado: 'al-dia'; cobroId: number }
  | { estado: 'cubierto'; cobroId: number; hasta: string; motivo: MotivoCorte }
  | { estado: 'vencido'; cobroId: number; hasta: string; motivo: MotivoCorte };

export type MotivoCorte = 'baja' | 'devuelto' | 'renovacion-sin-autorizar';

/** Un mes después de la fecha (YYYY-MM-DD o ISO), con el día capado al último del mes. Devuelve YYYY-MM-DD. */
export function unMesDespuesDe(fecha: string): string {
  const [a, m, d] = fecha.slice(0, 10).split('-').map(Number);
  const mes = m === 12 ? 1 : m + 1;
  const anio = m === 12 ? a + 1 : a;
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return `${anio}-${String(mes).padStart(2, '0')}-${String(Math.min(d, ultimo)).padStart(2, '0')}`;
}

const dia = (iso: string | null | undefined): string | null => (iso ? iso.slice(0, 10) : null);

/** Hasta qué día cubre lo pagado de UN cobro, y por qué termina; null si ese cobro no dice nada (o no termina). */
function finDeLoPagado(c: CobroDelLugar, pagos: readonly PagoDelLugar[]): { hasta: string; motivo: MotivoCorte } | null {
  if (c.estado === 'reembolsado') {
    const d = dia(c.reembolsado_at) ?? dia(c.pagado_at);
    return d ? { hasta: d, motivo: 'devuelto' } : null;
  }
  if (c.tipo !== 'suscripcion') return null;
  // La renovación de un cliente de agencia que nadie autorizó ni cobró: lo pagado (el primer mes) termina el día que
  // ella tenía que empezar a cobrar. Autorizada (`activa`), Mercado Pago la cobra ese día: no se corta antes.
  if ((c.estado === 'pendiente' || c.estado === 'fallido') && c.suscripcion_estado !== 'activa' && c.inicio_at) {
    return { hasta: dia(c.inicio_at)!, motivo: 'renovacion-sin-autorizar' };
  }
  if (c.estado === 'pagado' && c.suscripcion_estado === 'cancelada') {
    const ultimas = pagos.filter((p) => p.cobro_id === c.id && p.pagado && p.fecha_pago).map((p) => p.fecha_pago!.slice(0, 10));
    const ultimo = [...ultimas, dia(c.pagado_at)].filter((x): x is string => !!x).sort().at(-1);
    return ultimo ? { hasta: unMesDespuesDe(ultimo), motivo: 'baja' } : null;
  }
  return null;
}

/**
 * La vigencia del lugar de UN negocio, con todos los cobros de la plataforma que lo pagan y sus cuotas.
 * `ahoraMs` es el reloj (se pasa, no se lee: las reglas son puras).
 */
export function vigenciaDelLugar(cobros: readonly CobroDelLugar[], pagos: readonly PagoDelLugar[], ahoraMs: number): Vigencia {
  if (!cobros.length) return { estado: 'sin-pasarela' };
  // Una suscripción pagada y activa manda: el negocio está al día (la pasarela le sigue cobrando).
  const activa = cobros.find((c) => c.tipo === 'suscripcion' && c.estado === 'pagado' && c.suscripcion_estado !== 'cancelada');
  if (activa) return { estado: 'al-dia', cobroId: activa.id };
  // Una renovación AUTORIZADA que todavía no cobró (la de agencia, antes de su `inicio_at`) también.
  const autorizada = cobros.find((c) => c.tipo === 'suscripcion' && (c.estado === 'pendiente' || c.estado === 'fallido') && c.suscripcion_estado === 'activa');
  if (autorizada) return { estado: 'al-dia', cobroId: autorizada.id };

  // Si no, lo pagado llega hasta el fin MÁS LEJANO que diga algún cobro (una compra nueva extiende, no acorta).
  let mejor: { cobroId: number; hasta: string; motivo: MotivoCorte } | null = null;
  for (const c of cobros) {
    const f = finDeLoPagado(c, pagos);
    if (f && (!mejor || f.hasta > mejor.hasta)) mejor = { cobroId: c.id, ...f };
  }
  if (!mejor) return { estado: 'sin-pasarela' };
  const corteMs = Date.parse(`${mejor.hasta}T00:00:00Z`) + GRACIA_DIAS * DIA_MS;
  return ahoraMs >= corteMs ? { estado: 'vencido', ...mejor } : { estado: 'cubierto', ...mejor };
}

/**
 * Lo que se guarda al cortar (app_settings `plan.corte_por_pago` del negocio): por qué, por cuál cobro, y si el corte
 * sigue en pie (`vigente`). Queda guardado aunque se reabra: es lo que impide volver a cortar por el MISMO vencimiento
 * a un negocio que alguien reactivó a mano.
 */
export type CorteGuardado = { cobroId: number; hasta: string; motivo: MotivoCorte; desde: string; vigente: boolean };

export const CLAVE_CORTE = 'plan.corte_por_pago';

export function leerCorte(crudo: string | null | undefined): CorteGuardado | null {
  if (!crudo) return null;
  try {
    const v = JSON.parse(crudo) as Partial<CorteGuardado>;
    return typeof v.cobroId === 'number' && typeof v.hasta === 'string' && typeof v.motivo === 'string'
      ? { cobroId: v.cobroId, hasta: v.hasta, motivo: v.motivo as MotivoCorte, desde: String(v.desde ?? ''), vigente: v.vigente !== false }
      : null;
  } catch { return null; }
}

/**
 * Qué hacer con el acceso de un negocio, con lo que dice la pasarela, cómo está el negocio y el último corte guardado.
 *   · `cortar`: pausarlo y guardar el corte (vigente).
 *   · `reabrir`: activarlo y dejar el corte como no vigente (pagó de nuevo).
 *   · `soltar`: el corte guardado dice vigente pero el negocio ya está activo: alguien lo reactivó a mano. Se anota, para
 *     que una pausa A MANO posterior no la «reabra» el cobro.
 */
export type Paso =
  | { tipo: 'nada' }
  | { tipo: 'cortar'; corte: Omit<CorteGuardado, 'desde' | 'vigente'> }
  | { tipo: 'reabrir' }
  | { tipo: 'soltar' };

export function pasoDeAcceso(v: Vigencia, estadoWs: 'activo' | 'pausado', corte: CorteGuardado | null): Paso {
  const vigente = !!corte?.vigente;
  if (v.estado === 'vencido') {
    if (estadoWs === 'pausado') return { tipo: 'nada' };
    // ⚠️ YA SE CORTÓ POR ESTE MISMO VENCIMIENTO y alguien lo volvió a activar a mano (/admin): se respeta. Un corte
    // nuevo pide un vencimiento NUEVO (otro cobro, u otro fin de lo pagado).
    if (corte && corte.cobroId === v.cobroId && corte.hasta === v.hasta) return vigente ? { tipo: 'soltar' } : { tipo: 'nada' };
    return { tipo: 'cortar', corte: { cobroId: v.cobroId, hasta: v.hasta, motivo: v.motivo } };
  }
  // Pagó de nuevo (o ya no hay nada que vencer): se reabre SÓLO lo que cortó el cobro. Una pausa a mano no la toca.
  if (vigente && estadoWs === 'pausado') return { tipo: 'reabrir' };
  if (vigente && estadoWs === 'activo') return { tipo: 'soltar' };
  return { tipo: 'nada' };
}

/** El texto de la pantalla del negocio cortado. Corto, y dice qué hacer. */
export function textoDelCorte(c: CorteGuardado | null, opts: { paraAgencia?: boolean } = {}): { titulo: string; detalle: string } {
  if (!c) return { titulo: opts.paraAgencia ? 'Este cliente está pausado' : 'Tu cuenta está pausada', detalle: 'Si crees que es un error, escríbenos y lo vemos.' };
  const fecha = `${c.hasta.slice(8, 10)}/${c.hasta.slice(5, 7)}/${c.hasta.slice(0, 4)}`;
  if (c.motivo === 'renovacion-sin-autorizar') {
    // La agencia que mira a su cliente es la que tiene que activarla (desde MaKo Partners, «Activar renovación»).
    return opts.paraAgencia
      ? { titulo: 'Falta activar su renovación', detalle: `El mes pagado de este cliente terminó el ${fecha}. Actívala desde MaKo Partners para que vuelva a entrar.` }
      : { titulo: 'Falta activar la renovación', detalle: `El mes pagado terminó el ${fecha}. Tu agencia tiene que activar la renovación para volver a entrar.` };
  }
  if (c.motivo === 'devuelto') return { titulo: 'Tu plan se devolvió', detalle: 'El pago de tu plan se devolvió. Para volver a entrar, escríbenos.' };
  return { titulo: 'Tu plan terminó', detalle: `Lo pagado cubría hasta el ${fecha}. Para volver a entrar, renueva tu plan escribiéndonos.` };
}
