// =============================================================================
// clientes-plataforma-reglas — los clientes de MaKo vistos por el super admin: segmentos, MRR y riesgo (25/10/2026)
// =============================================================================
// Martín (docs/feedback-25-10-tarde.md punto 10): «Para SuperAdmin, creame una vista especial para ver a mis clientes...
// Donde pueda ver a los partners, a agency y al resto de clientes... Siempre revisa como lo hacen otras apps, que se vea
// epico». Copiado de Stripe › Customers (los segmentos en pills) y de Baremetrics (el MRR arriba, de los cobros reales).
//
// LO QUE SE DECIDIÓ (el porqué, en docs/hallazgos-agencias.md):
//   · LOS SEGMENTOS NO SON EXCLUYENTES, salvo el último: un negocio puede ser Agency y Partner a la vez. «Clientes» es el
//     resto (ni Partner, ni Agency, ni cliente de una agencia). Un cliente de agencia NO es cliente de MaKo: lo factura su
//     agencia (AdminView, 28/09/2026), y por eso tiene su propio segmento.
//   · EL MRR SALE DE LOS COBROS, nunca del precio del plan: un plan dado a mano (Mauricio, Leila) no factura nada, y
//     sumarlo inflaría el número que Martín mira para decidir. Una suscripción ACTIVA de la plataforma, en dólares
//     (`monto_usd`), sin las pruebas gratis (Stripe no cuenta un trial como MRR) ni lo anulado o devuelto. Un cobro sin
//     su valor en dólares no se inventa: suma «sin dólares» y la pantalla lo dice.
//   · EN RIESGO: pausado, o con la renovación activa y el último cobro fallido (la pasarela reintenta: la mora).
//
// Sin `server-only`: lo ejecutan los tests.
// =============================================================================

import { esPruebaDePlan } from './prueba-plan-reglas';
import { PLANES_MAKO_DEFAULT } from './planes-mako';
import { capaDef } from './capas';

/**
 * El plan como lo vende MaKo («MaKo Esencial», «MaKo Pro») y no el nombre interno de su capa («Completo», «Agencia»): la
 * capa `agencia` ES el plan Pro (lib/planes-mako.ts). Una capa sin plan a la venta («Project Manager») dice el suyo.
 */
export const nombreDePlan = (capa: string): string => PLANES_MAKO_DEFAULT.find((p) => p.capa === capa)?.nombre ?? capaDef(capa).nombre;

export const SEGMENTOS = ['partner', 'agency', 'cliente', 'de-agencia'] as const;
export type Segmento = (typeof SEGMENTOS)[number];

export const ROTULO_SEGMENTO: Record<Segmento, string> = {
  partner: 'Partner',
  agency: 'Agency',
  cliente: 'Cliente',
  'de-agencia': 'Cliente de agencia',
};

/** Los segmentos de un negocio. Siempre al menos uno. */
export function segmentosDe(ws: number, s: { partners: ReadonlySet<number>; agencias: ReadonlySet<number>; deAgencia: ReadonlyMap<number, unknown> }): Segmento[] {
  if (s.deAgencia.has(ws)) return ['de-agencia'];
  const out: Segmento[] = [];
  if (s.agencias.has(ws)) out.push('agency');
  if (s.partners.has(ws)) out.push('partner');
  return out.length ? out : ['cliente'];
}

/** Lo que hace falta de un cobro de la plataforma para el MRR. */
export type CobroMrr = {
  tipo: string;
  estado: string;
  suscripcion_estado: string | null;
  monto_usd?: number | null;
  alta_capa?: string | null;
  creado_por?: string | null;
};

/** ¿Este cobro factura cada mes hoy? Una suscripción activa, que no es una prueba gratis ni está anulada o devuelta. */
export const factura = (c: CobroMrr): boolean =>
  c.tipo === 'suscripcion' && c.suscripcion_estado === 'activa' && c.estado !== 'anulado' && c.estado !== 'reembolsado' && !esPruebaDePlan(c);

/** El MRR de un negocio, en dólares, y cuántas suscripciones que facturan no traen su valor en dólares. */
export function mrrDe(cobros: readonly CobroMrr[]): { usd: number; sinDolares: number } {
  let usd = 0;
  let sinDolares = 0;
  for (const c of cobros) {
    if (!factura(c)) continue;
    const v = typeof c.monto_usd === 'number' && Number.isFinite(c.monto_usd) ? c.monto_usd : null;
    if (v == null) sinDolares += 1; else usd += v;
  }
  return { usd: Math.round(usd * 100) / 100, sinDolares };
}

/** ¿Está en prueba gratis? (una suscripción de prueba viva y ninguna que facture) */
export const enPrueba = (cobros: readonly CobroMrr[]): boolean =>
  !cobros.some(factura) && cobros.some((c) => esPruebaDePlan(c) && c.suscripcion_estado !== 'cancelada' && c.estado !== 'anulado');

/** ¿En riesgo? Pausado, o con la renovación activa y el último cobro fallido (la mora: la pasarela reintenta). */
export const enRiesgo = (estado: string, cobros: readonly CobroMrr[]): boolean =>
  estado === 'pausado' || cobros.some((c) => c.tipo === 'suscripcion' && c.suscripcion_estado === 'activa' && c.estado === 'fallido');

/**
 * ¿Tiene un pago de su lugar esperando? Un link sin pagar que nadie autorizó (el primer mes, una renovación de agencia por
 * autorizar) o un cobro que falló. NO cuenta una prueba gratis ni una suscripción ya autorizada que espera su primer
 * cobro: ésas no esperan nada de nadie.
 */
export const pagoPendiente = (cobros: readonly CobroMrr[]): boolean =>
  cobros.some((c) => !esPruebaDePlan(c) && (c.estado === 'fallido' || (c.estado === 'pendiente' && c.suscripcion_estado !== 'activa')));

// ── La actividad (26/10/2026) ──────────────────────────────────────────────────────────────────────────────────────
// Martín: «quiero que mejores muchísimo el diseño de ese dashboard de super admin». Medido ese día en producción: la
// plataforma no tiene ni un cobro ni una cuota registrada, así que todo lo de plata da cero. Lo que SÍ hay y dice quién se
// está yendo es la actividad (el «Last seen» de Intercom, el «Health» de AgencyAnalytics): cuándo entró alguien de su
// equipo por última vez (`usuarios.ultimo_login`) y cuándo le llegó su último lead.

/** Días sin entrar a partir de los cuales un cliente que ya hizo su onboarding está en riesgo. */
export const DIAS_SIN_ENTRAR_RIESGO = 14;
const DIA_MS = 86_400_000;

/** Días desde una fecha (redondeado hacia abajo). `null` si no hay fecha. */
export const diasDesde = (iso: string | null | undefined, ahoraMs: number): number | null => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? Math.max(0, Math.floor((ahoraMs - t) / DIA_MS)) : null;
};

export type Actividad = {
  /** Días desde el último ingreso de alguien de su equipo. `null` = nunca entró nadie. */
  sinEntrar: number | null;
  /** Días desde su último lead. `null` = no tiene leads. */
  sinLeads: number | null;
  /** `null` = no se pudo leer (revisión del tren, hallazgo 4): no es «no lo terminó». */
  onboardingHecho: boolean | null;
};

/**
 * ¿Se está yendo? No entra hace DIAS_SIN_ENTRAR_RIESGO días (o nunca entró nadie) y ya pasó su onboarding. Uno que todavía
 * no lo terminó no está «yéndose»: está empezando, y eso lo dice el onboarding pendiente.
 */
export const sinUso = (a: Actividad): boolean =>
  a.onboardingHecho === true && (a.sinEntrar == null || a.sinEntrar >= DIAS_SIN_ENTRAR_RIESGO);

/** Una línea corta: «Hoy», «Hace 3 días», «Hace 2 meses», «Nunca». */
export function haceTxt(dias: number | null): string {
  if (dias == null) return 'Nunca';
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  if (dias < 30) return `Hace ${dias} días`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? 'Hace 1 mes' : `Hace ${meses} meses`;
}

// ── «Para mirar»: lo que pide atención, el más grave primero (26/10/2026) ───────────────────────────────────────────
// Copiado del feed «Customer Activity» de ProfitWell y de las señales de Baremetrics (docs/customers/referencias): un
// renglón por cliente con una etiqueta de color y una frase corta. Un cliente sale UNA vez, con su motivo más grave.

export const MOTIVOS_PARA_MIRAR = ['pausado', 'cobro', 'pago', 'sin-uso', 'sin-empezar', 'prueba', 'nuevo'] as const;
export type MotivoParaMirar = (typeof MOTIVOS_PARA_MIRAR)[number];

/** El rótulo de la etiqueta y su tono. */
export const ETIQUETA_PARA_MIRAR: Record<MotivoParaMirar, { rotulo: string; tono: 'bad' | 'warn' | 'info' | 'good' }> = {
  pausado: { rotulo: 'Pausado', tono: 'bad' },
  cobro: { rotulo: 'Cobro fallido', tono: 'bad' },
  pago: { rotulo: 'Pago pendiente', tono: 'warn' },
  'sin-uso': { rotulo: 'Sin uso', tono: 'warn' },
  'sin-empezar': { rotulo: 'Sin empezar', tono: 'warn' },
  prueba: { rotulo: 'En prueba', tono: 'info' },
  nuevo: { rotulo: 'Nuevo', tono: 'good' },
};

/** Días desde el alta a partir de los cuales un onboarding sin terminar pide atención. */
export const DIAS_SIN_EMPEZAR = 3;
/** Días en que un cliente sigue siendo «nuevo». */
export const DIAS_NUEVO = 30;

export type FilaParaMirar = {
  ws: number; nombre: string; estado: string; creado: string; prueba: boolean; pagoPendiente: boolean;
  motivoRiesgo: 'pausado' | 'cobro' | 'sin-uso' | null; sinEntrar: number | null;
  /** `null` = no se pudo leer: ni «Sin empezar» ni «Activo» por eso. */
  onboardingHecho: boolean | null;
};
export type ItemParaMirar = { ws: number; nombre: string; motivo: MotivoParaMirar; texto: string };

export function paraMirar(filas: readonly FilaParaMirar[], ahoraMs: number): ItemParaMirar[] {
  const out: ItemParaMirar[] = [];
  for (const f of filas) {
    const alta = diasDesde(f.creado, ahoraMs);
    let motivo: MotivoParaMirar | null = null;
    let texto = '';
    if (f.estado === 'pausado') { motivo = 'pausado'; texto = 'Su cuenta está pausada'; }
    else if (f.motivoRiesgo === 'cobro') { motivo = 'cobro'; texto = 'Un cobro de su plan falló'; }
    else if (f.pagoPendiente) { motivo = 'pago'; texto = 'Tiene un pago esperando'; }
    else if (f.motivoRiesgo === 'sin-uso') {
      motivo = 'sin-uso';
      texto = f.sinEntrar == null ? 'Nadie de su equipo entró nunca' : `Nadie de su equipo entra hace ${f.sinEntrar} días`;
    } else if (f.onboardingHecho === false && alta != null && alta >= DIAS_SIN_EMPEZAR) { motivo = 'sin-empezar'; texto = 'No terminó su configuración'; }
    else if (f.prueba) { motivo = 'prueba'; texto = 'Está probando MaKo'; }
    else if (alta != null && alta < DIAS_NUEVO) { motivo = 'nuevo'; texto = alta === 0 ? 'Se sumó hoy' : alta === 1 ? 'Se sumó ayer' : `Se sumó hace ${alta} días`; }
    if (motivo) out.push({ ws: f.ws, nombre: f.nombre, motivo, texto });
  }
  const peso = (m: MotivoParaMirar) => MOTIVOS_PARA_MIRAR.indexOf(m);
  return out.sort((a, b) => peso(a.motivo) - peso(b.motivo) || a.nombre.localeCompare(b.nombre, 'es'));
}

/** El estado de un cliente en UNA palabra de color (la fila de la tabla, como Stripe y ChartMogul). */
export function estadoEnUnaPalabra(f: Pick<FilaParaMirar, 'estado' | 'prueba' | 'motivoRiesgo' | 'onboardingHecho'>): { rotulo: string; tono: 'bad' | 'warn' | 'info' | 'good' | 'neutral' } {
  if (f.estado === 'pausado') return { rotulo: 'Pausado', tono: 'neutral' };
  if (f.motivoRiesgo) return { rotulo: 'En riesgo', tono: f.motivoRiesgo === 'cobro' ? 'bad' : 'warn' };
  if (f.onboardingHecho === false) return { rotulo: 'Sin empezar', tono: 'warn' };
  if (f.prueba) return { rotulo: 'En prueba', tono: 'info' };
  return { rotulo: 'Activo', tono: 'good' };
}

/**
 * «La última vez que entró» de un cliente, como la dicen la tabla, la ficha y el teléfono. A un cliente de agencia que
 * nadie de su equipo usa no se le dice «Nunca» (revisión del tren, hallazgo 7): lo opera su agencia con su propia sesión,
 * y la base no anota esa entrada.
 */
export const ultimaVezTxt = (f: { sinEntrar: number | null; segmentos: readonly Segmento[] }): string =>
  f.sinEntrar == null && f.segmentos.includes('de-agencia') ? 'Lo opera su agencia' : haceTxt(f.sinEntrar);

/**
 * La comparación de lo cobrado, SÓLO entre meses cerrados (revisión del tren, hallazgo 6): el mes en curso está a medias,
 * y compararlo con el anterior completo marca una caída todos los principios de mes. Devuelve el último mes cerrado, el
 * anterior a él y el % (null si el anterior es 0 o no hay dos meses cerrados).
 */
export function comparacionCerrada(cobrado: ReadonlyArray<{ mes: string; usd: number }> | null): { mes: string; contra: string; pct: number } | null {
  if (!cobrado || cobrado.length < 3) return null;
  const cerrados = cobrado.slice(0, -1);
  const ult = cerrados[cerrados.length - 1];
  const ant = cerrados[cerrados.length - 2];
  if (!ult || !ant || ant.usd <= 0) return null;
  return { mes: ult.mes, contra: ant.mes, pct: Math.round(((ult.usd - ant.usd) / ant.usd) * 100) };
}

// ── Lo cobrado por mes (la tendencia) ──────────────────────────────────────────────────────────────────────────────

/** Un pago que entró: cuándo y cuánto en dólares (`null` = sin su valor en dólares: no se suma). */
export type PagoEntrado = { fecha: string; usd: number | null };

/**
 * Lo que entró cada mes, los últimos `meses` (el más viejo primero), en dólares. Un mes sin pagos es 0 (es un dato: no
 * entró nada), pero si en TODA la ventana no entró nada, devuelve `null`: no hay tendencia que dibujar, y una línea plana en
 * cero se lee como «se cayó todo».
 */
export function cobradoPorMes(pagos: readonly PagoEntrado[], ahoraMs: number, meses = 6): Array<{ mes: string; usd: number }> | null {
  const hoy = new Date(ahoraMs);
  const claves: string[] = [];
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - i, 1));
    claves.push(d.toISOString().slice(0, 7));
  }
  const suma = new Map(claves.map((k) => [k, 0]));
  let alguno = false;
  for (const p of pagos) {
    const k = (p.fecha ?? '').slice(0, 7);
    if (!suma.has(k) || p.usd == null || !Number.isFinite(p.usd)) continue;
    suma.set(k, (suma.get(k) ?? 0) + p.usd);
    alguno = true;
  }
  return alguno ? claves.map((mes) => ({ mes, usd: Math.round((suma.get(mes) ?? 0) * 100) / 100 })) : null;
}

/** Los números de arriba de la vista. `ahoraMs` se pasa para que el test no dependa del reloj. */
export function kpisDeClientes(filas: ReadonlyArray<{ estado: string; creado: string; mrrUsd: number; sinDolares: number; riesgo: boolean; segmentos: readonly Segmento[] }>, ahoraMs: number) {
  const hace30 = ahoraMs - 30 * 86_400_000;
  const deMaKo = filas.filter((f) => !f.segmentos.includes('de-agencia'));
  return {
    mrrUsd: Math.round(filas.reduce((a, f) => a + f.mrrUsd, 0) * 100) / 100,
    sinDolares: filas.reduce((a, f) => a + f.sinDolares, 0),
    pagan: filas.filter((f) => f.mrrUsd > 0).length,
    activos: deMaKo.filter((f) => f.estado === 'activo').length,
    nuevos30: deMaKo.filter((f) => Date.parse(f.creado) >= hace30).length,
    enRiesgo: filas.filter((f) => f.riesgo).length,
    porSegmento: Object.fromEntries(SEGMENTOS.map((s) => [s, filas.filter((f) => f.segmentos.includes(s)).length])) as Record<Segmento, number>,
  };
}
