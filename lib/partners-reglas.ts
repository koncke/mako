// =============================================================================
// partners-reglas — el programa de referidos de MaKo Partners (lo puro, con test)
// =============================================================================
// Pedido de Martín (22/10/2026): «el sistema de referidos con la página de MaKo Partners... que se gestione de manera
// automática... las bienvenidas de las personas que vos referiste con el dashboard de cuánto dinero tenés acumulado».
//
// SÓLO PLATA (25/10/2026, Martín: «Elimina lo de "gana meses de tu plan", que solo ganen direro y listo... literalmente se
// llevan el 100% de lo que venden... No pongas al programa de 1500 en el programa de referidos»). Reemplaza lo decidido el
// 10/10 en docs/referidos.md (meses de crédito para el plan, plata sólo para los revendedores, el 20% del grupal):
//   · (REGLA VIEJA, hasta el 18/11/2026: el 100% de SU PRIMER MES, una sola vez por negocio, al 2º pago. Lo ya ganado así queda
//     en el libro como está; desde el 18/11 la regla es la de `COMISION_PARTNER_DIRECTO`, más abajo: una parte de CADA pago.)
//   · Lo ganado pasa a «a cobrar» y MaKo se lo transfiere a la cuenta que el partner dejó en su alta. El pago lo anota el
//     super admin (un renglón del libro).
//   · El Accelerator de US$ 1.500 no entra en Partners. Las agencias tampoco: su panel es otro (Agency Dashboard).
//   · El origen que vale es el PRIMERO; sólo clientes nuevos; nadie se refiere a sí mismo.
// =============================================================================

import { esBajaPedida } from './cobros-reglas';
import { esPruebaDePlan } from './prueba-plan-reglas';

/** La cookie que deja /r/<código>: quién mandó el link. El PRIMERO vale (no se pisa), 60 días. */
export const COOKIE_REF = 'mako_ref';
export const DIAS_COOKIE_REF = 60;

/**
 * QUÉ CÓDIGO VALE EN /r/<código> (6/11/2026). El primero vale (docs/referidos.md): si el navegador ya traía la cookie de
 * otro partner, no se pisa. PERO SÓLO SI ESE PRIMERO SIGUE SIENDO DE UN PARTNER: una cookie de un código muerto (un
 * partner que ya no está, o el de la plataforma) tapaba el link vigente, y como /r pone el mismo código en `?ref=`, al
 * comprar no quedaba ninguno (`codigoQueCuenta` descarta los dos) y la venta salía sin el partner que la trajo.
 * «No se pudo leer» (`previoEsDePartner` null) vale como el primero, igual que al comprar: no se le quita a nadie por una
 * base caída.
 */
export function refQueVale(p: { previo: string | null; previoEsDePartner: boolean | null; codigo: string }): { ref: string; ponerCookie: boolean } {
  if (p.previo && p.previoEsDePartner !== false) return { ref: p.previo, ponerCookie: false };
  return { ref: p.codigo, ponerCookie: true };
}

/**
 * Cuántos pagos del referido ya cubría el crédito de la REGLA VIEJA (el 100% del primer mes, que se ganaba al 2º pago): quien lo
 * tiene en el libro (un renglón `referido` sin `pago_id`) no vuelve a ganar por sus 2 primeros pagos. Del 3º en adelante, sí.
 */
export const PAGOS_QUE_CUBRE_EL_CREDITO_VIEJO = 2;

/**
 * @deprecated REGLA VIEJA (el 100% del primer mes, al 2º pago). Ya NO acredita nada. Sigue exportada sólo porque la landing vieja
 * (app/mako-partners/*: Calculadora, LandingPartners) todavía la importa: el chat del Sitio la rehace con `COMISION_PARTNER_*` y
 * `comisionDelPago`; cuando eso esté en main, se borran las dos.
 */
export const PAGOS_PARA_ACREDITAR = 2;
/** @deprecated REGLA VIEJA: el 100% del primer mes a precio de lista. Ver `PAGOS_PARA_ACREDITAR`. */
export const gananciaDelReferido = (precioListaUsd: number): number => Math.round(Math.max(0, precioListaUsd) * 100) / 100;

/**
 * LA REGLA DEL PROGRAMA (18/11/2026, Martín: «Olvidémonos por ahora de pagar el 100% del primer mes»): el partner se lleva una parte
 * de CADA PAGO de cada negocio que trae, todos los meses, mientras ese negocio pague. Mensual o anual: la parte de lo que paga.
 * Cuánto, según por dónde entra la plata:
 *  - `directo`: Binance (USDT/USDC) o transferencia bancaria / CBU → 30 % redondo. También cuando el partner le cobra al negocio él
 *    mismo y le manda a MaKo el 70 % por Binance o transferencia: se queda con el 30 %.
 *  - `pasarela`: link de pago o pasarela (Mercado Pago, Whop, tarjeta) → 25 %. ES UNA DECISIÓN DE MARTÍN (18/11/2026), no la cuenta del
 *    costo: el mismo día empezó en 27 % y bajó a 25 %. Referencia (la del Cerebro, 18/11; NO se pudo medir con cobros reales: todavía no
 *    hay ningún cobro de un plan por Mercado Pago): Mercado Pago cobra 6,29 % + IVA al instante (7,61 %) y 0,6 % más de débitos y
 *    créditos, ~8,2 %; Whop, ~10,5 % (2,7 % + US$ 0,30, 1,5 % tarjeta internacional, 1 % de conversión y un retiro a cripto de 5 %).
 * La landing pública de Partners importa estos nombres: no los renombres sin avisar.
 */
export const COMISION_PARTNER_DIRECTO = 0.3;
export const COMISION_PARTNER_PASARELA = 0.25;

export type CanalDelPago = 'directo' | 'pasarela';

/** Lo que le toca al partner de UN pago de `montoUsd`, en dólares con centavos (Pro 97 → 29,10 directo, 24,25 por pasarela). */
export function comisionDelPago(montoUsd: number, canal: CanalDelPago): number {
  const centavos = Math.round(Math.max(0, Number(montoUsd) || 0) * 100);
  const parte = canal === 'directo' ? COMISION_PARTNER_DIRECTO : COMISION_PARTNER_PASARELA;
  return Math.round(centavos * parte) / 100;
}

/** El código público de un negocio, a partir de su nombre: minúsculas, sin acentos, con guiones. 3 a 24 letras. */
export function codigoDesdeNombre(nombre: string, sufijo = ''): string {
  const base = nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24).replace(/-+$/g, '');
  const limpio = base.length >= 3 ? base : `mako-${base || 'partner'}`.slice(0, 24);
  return sufijo ? `${limpio.slice(0, 31 - sufijo.length)}-${sufijo}` : limpio;
}

/** El link que comparte un partner. */
export const linkDePartner = (base: string, codigo: string): string => `${base.replace(/\/+$/, '')}/r/${codigo}`;

// ── CAMBIAR EL CÓDIGO (27/10/2026, Leila en la llamada con Martín, Fathom 876470842-06) ─────────────────────────────────
// Nace del nombre del negocio (`codigoDesdeNombre`) y desde ahora el partner lo puede cambiar (lib/partners-programa.ts,
// `cambiarCodigoPartner`). Lo que escribe se limpia como el nombre (minúsculas, sin acentos, espacios a guiones) y tiene que
// cumplir lo mismo que la base (mig 0330: `^[a-z0-9-]{3,32}$`), sin guiones en los bordes ni dobles.

export const TEXTO_CODIGO_INVALIDO = 'Tu código va de 3 a 32 letras o números, con guiones si quieres, sin espacios.';
/** Los que se confunden con MaKo o con una página suya: nadie los usa como código. */
const CODIGOS_RESERVADOS: ReadonlySet<string> = new Set(['mako', 'hola-mako', 'admin', 'soporte', 'partners', 'planes', 'equipo']);

/** El código que escribió el partner, limpio, o por qué no sirve. */
export function codigoNuevoValido(v: unknown): { ok: true; codigo: string } | { ok: false; error: string } {
  const s = (typeof v === 'string' ? v : '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, '-');
  if (!/^[a-z0-9-]{3,32}$/.test(s) || /^-|-$|--/.test(s)) return { ok: false, error: TEXTO_CODIGO_INVALIDO };
  if (CODIGOS_RESERVADOS.has(s)) return { ok: false, error: 'Ese código no se puede usar. Prueba con otro.' };
  return { ok: true, codigo: s };
}

export type EstadoReferido = 'registrado' | 'pagando' | 'se-fue';

/**
 * En qué va un referido, con sus meses PAGADOS (cuotas cobradas de su plan) y si su lugar sigue vigente (18/11/2026, la regla
 * por pago): 'pagando' = ya pagó y sigue (te deja su parte CADA mes); 'registrado' = todavía no pagó; 'se-fue' = su lugar ya no
 * está vigente (lo ganado hasta ahí queda en el libro; no deja más).
 * ⚠️ Sin lugar vigente es 'se-fue' AUNQUE no haya pagado nada (25/10/2026, revisión del tren): el que canceló la prueba antes del
 * día 8 (0 meses) daba 'registrado', y se sumaba como «en camino» en el panel del partner para siempre, por un negocio que no
 * va a pagar nunca.
 */
export function estadoDelReferido(p: { mesesPagados: number; vigente: boolean }): EstadoReferido {
  if (!p.vigente) return 'se-fue';
  return p.mesesPagados >= 1 ? 'pagando' : 'registrado';
}

/** Lo que `seFueSegunSusCobros` mira de cada cobro del lugar (los de la plataforma con su `alta_ws`). */
export type CobroDelReferido = {
  tipo: string; estado: string; suscripcion_estado: string | null;
  motivo?: string | null; creado_por?: string | null; alta_capa?: string | null;
};

/**
 * ¿El referido se fue, según SUS COBROS? (25/10/2026, revisión del tren, ronda 2). El `vigente` de `estadoDelReferido` salía
 * sólo de `workspaces.estado`, pero con el corte de acceso APAGADO (`CORTE_DE_ACCESO_PRENDIDO`, lib/plan-acceso-reglas.ts)
 * nadie pausa a nadie: el que canceló la prueba y nunca pagó queda 'activo' para siempre, y su primer mes seguía «en camino».
 * Se fue = su prueba se cayó (dada de baja o anulada) y no le queda NINGÚN otro cobro vivo: una suscripción que la pasarela
 * sigue cobrando (autorizada, sin anular, sin baja pedida) o un pago único cobrado. «Empezar mi plan ya» anula la prueba pero
 * deja vivo el cobro nuevo: ése sigue. Sin una prueba caída no decide nada (queda `workspaces.estado`).
 */
export function seFueSegunSusCobros(cobros: ReadonlyArray<CobroDelReferido>): boolean {
  const pruebaCaida = (c: CobroDelReferido) => esPruebaDePlan(c) && (c.suscripcion_estado === 'cancelada' || c.estado === 'anulado');
  const vivo = (c: CobroDelReferido) => (c.tipo === 'suscripcion'
    ? c.suscripcion_estado === 'activa' && c.estado !== 'anulado' && !esBajaPedida(c.motivo)
    : c.estado === 'pagado');
  return cobros.some(pruebaCaida) && !cobros.some((c) => !pruebaCaida(c) && vivo(c));
}

/** La píldora de cada negocio en el panel (y en el teléfono). */
export const TEXTO_ESTADO_REFERIDO: Readonly<Record<EstadoReferido, string>> = {
  registrado: 'Todavía no pagó',
  pagando: 'Paga cada mes',
  'se-fue': 'Dejó de pagar',
};

/**
 * Por dónde entró un pago (18/11/2026): una pasarela (el `proveedor` del pago: Stripe, Mercado Pago, Creem; o un método `tarjeta`)
 * es 'pasarela' (25 %); una transferencia, Binance/cripto o efectivo, 'directo' (30 %). Lo que no se sabe (sin proveedor y con un
 * método `otro` o vacío) va por la tasa MENOR: nunca se acredita de más; si era directo, el super admin lo corrige con un `ajuste`.
 */
export function canalDelPago(p: { proveedor?: string | null; metodo?: string | null }): CanalDelPago {
  if (p.proveedor) return 'pasarela';
  const m = String(p.metodo ?? '').toLowerCase();
  return m === 'transferencia' || m === 'cripto' || m === 'efectivo' ? 'directo' : 'pasarela';
}

/** Un pago cobrado de un referido, como lo lee el cron (`pagos`: `monto_usd` es lo que entró, en dólares). */
export type PagoDeReferido = {
  id: number; montoUsd: number | null; fecha: string; proveedor?: string | null; metodo?: string | null;
  /** Los meses que paga su cobro (un anual, 12; null = 1). Con el precio de lista por mes da el TOPE de lo que cuenta de ese pago. */
  meses?: number | null;
  /** Lo más que cuenta de este pago: el precio de lista × sus meses (revisión de plata del 29/10, hallazgo 6: un partner nunca gana más que la lista). */
  topeUsd?: number | null;
};

export type CreditoPorPago = { pagoId: number; pagoUsd: number; canal: CanalDelPago; comisionUsd: number; topado: boolean };

/**
 * Lo que hay que acreditar HOY de un referido: UN crédito por cada pago cobrado que todavía no tiene el suyo. Los pagos van en orden
 * (fecha, id). Un pago sin monto en dólares no se acredita (no se inventa la plata: se deja dicho en el log del cron). Quien ya
 * ganó con la regla vieja (`teniaCreditoViejo`) no gana por sus primeros `PAGOS_QUE_CUBRE_EL_CREDITO_VIEJO` pagos: ya se los pagó
 * ese crédito (el 100% de su primer mes vale más que el 30 % de dos).
 */
export function creditosDeUnReferido(p: { pagos: ReadonlyArray<PagoDeReferido>; yaAcreditados: ReadonlySet<number>; teniaCreditoViejo: boolean }): { acreditar: CreditoPorPago[]; sinMonto: number[] } {
  const orden = [...p.pagos].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id);
  const cubiertos = p.teniaCreditoViejo ? PAGOS_QUE_CUBRE_EL_CREDITO_VIEJO : 0;
  const acreditar: CreditoPorPago[] = [];
  const sinMonto: number[] = [];
  orden.forEach((pago, i) => {
    if (i < cubiertos || p.yaAcreditados.has(pago.id)) return;
    const usd = Number(pago.montoUsd);
    if (pago.montoUsd == null || !Number.isFinite(usd) || usd <= 0) { sinMonto.push(pago.id); return; }
    const canal = canalDelPago(pago);
    // TOPE: un pago de US$ 1.500 (una venta a mano, un precio especial) no deja el 30 % de 1.500: cuenta hasta el precio de lista.
    const topado = pago.topeUsd != null && pago.topeUsd > 0 && usd > pago.topeUsd;
    const base = topado ? pago.topeUsd! : usd;
    acreditar.push({ pagoId: pago.id, pagoUsd: Math.round(base * 100) / 100, canal, comisionUsd: comisionDelPago(base, canal), topado });
  });
  return { acreditar, sinMonto };
}

/**
 * El precio de lista POR MES con el que se compró el plan del referido. Lo que se cobró (`monto_usd`) no sirve solo: el anual
 * cobra el año entero (`meses` 12), y el primer mes de un anual no vale el año. Primero el precio de lista del plan
 * (`plan_mako`, el catálogo); si no se conoce, lo cobrado dividido por sus meses. null = no se sabe.
 */
export function precioDeListaPorMes(c: { plan_mako?: string | null; monto_usd?: number | null; meses?: number | null }, listaUsd: (plan: string) => number | null): number | null {
  const deLista = c.plan_mako ? listaUsd(c.plan_mako) : null;
  if (deLista != null && deLista > 0) return deLista;
  if (c.monto_usd == null) return null;
  const meses = c.meses && c.meses > 0 ? c.meses : 1;
  return Math.round((Number(c.monto_usd) / meses) * 100) / 100;
}

/**
 * Lo que pasa HOY con lo que se gana, dicho igual en la landing, el panel y el teléfono (24/10/2026, el Cerebro: «la página
 * de Partners no promete nada que no vayamos a cumplir»). Ganarlo lo anota el cron solo (`acreditarReferidos`); pagarlo es
 * una transferencia que hace MaKo y anota el super admin en su panel («Marcar pagado»).
 */
export const PAGO_HOY = 'Te lo transferimos a la cuenta que nos dejaste.';

/**
 * El libro de un partner (partner_creditos): `referido` (+, lo que ganó), `uso` (−, lo que MaKo le TRANSFIRIÓ: desde el
 * 25/10/2026 ya no es crédito usado en su plan, porque Partners paga en plata) y `ajuste` (±, a mano).
 */
export type Renglon = { tipo: 'referido' | 'uso' | 'ajuste'; monto_usd: number };

export type Resumen = {
  /** Lo que ganó: su parte de cada pago de sus referidos, más lo de la regla vieja (y los ajustes a favor). */
  ganadoUsd: number;
  /** Lo que MaKo ya le transfirió (y los ajustes en contra). */
  pagadoUsd: number;
  /** Lo ganado que todavía no se le transfirió. Nunca negativo. */
  aCobrarUsd: number;
};

export function resumenDelLibro(renglones: ReadonlyArray<Renglon>): Resumen {
  let ganado = 0;
  let pagado = 0;
  for (const r of renglones) {
    const m = Number(r.monto_usd) || 0;
    if (r.tipo === 'uso') pagado += Math.abs(m);
    else if (m > 0) ganado += m;
    else pagado += -m;
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return { ganadoUsd: r2(ganado), pagadoUsd: r2(pagado), aCobrarUsd: r2(Math.max(0, ganado - pagado)) };
}

/**
 * «Lo que te deja cada mes»: la suma de lo que dejan los negocios que SIGUEN pagando (los 'pagando'; el que todavía no pagó o se
 * fue no suma: no hay un pago confirmado detrás). Es un cálculo con el precio de lista y el canal de su último pago, no una promesa.
 */
export function cadaMes(referidos: ReadonlyArray<{ estado: EstadoReferido; mensualUsd: number | null }>): number {
  const s = referidos.filter((r) => r.estado === 'pagando').reduce((a, r) => a + (r.mensualUsd ?? 0), 0);
  return Math.round(s * 100) / 100;
}

/** Los `n` meses que terminan en `hoy` («YYYY-MM»), del más viejo al de hoy. */
export function ultimosMeses(hoy: string, n = 6): string[] {
  const [a, m] = hoy.split('-').map(Number);
  const meses: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(a, m - 1 - i, 1));
    meses.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return meses;
}

/**
 * Lo ganado por mes, los últimos `n` (el gráfico de barras del panel, como el «Earnings» de Tolt). Sólo los renglones
 * `referido` (lo ganado, no lo pagado), en el mes en que se ganaron.
 */
export function ganadoPorMes(renglones: ReadonlyArray<{ tipo: string; monto_usd: number; created_at: string }>, hoy: string, n = 6): Array<{ mes: string; usd: number }> {
  const meses = ultimosMeses(hoy, n);
  const suma = new Map(meses.map((x) => [x, 0]));
  for (const r of renglones) {
    if (r.tipo !== 'referido') continue;
    const k = String(r.created_at).slice(0, 7);
    if (suma.has(k)) suma.set(k, suma.get(k)! + (Number(r.monto_usd) || 0));
  }
  return meses.map((mes) => ({ mes, usd: Math.round(suma.get(mes)! * 100) / 100 }));
}

// =============================================================================
// EL ALTA COMO PARTNER (25/10/2026, Martín: «si alguien no se hizo "Partner", no le debe saltar abajo nada de "Todavía no
// tienes referidos" o del dashboard... Solo los CTA para que se haga Partner, posterior a apretar eso, un pequeño
// onboarding, que le pregunte algunas cosas como, cuantos quisiera referir, etc... Y que ahí le de su link de referido»).
// =============================================================================
// Hacerse partner ES terminar el alta: queda en el setting `partners.alta` del negocio. Tener código NO alcanza: hasta el
// 24/10 el código nacía con sólo abrir el tablero, así que hay negocios con código que nunca se hicieron partner (y por eso
// veían el tablero vacío). El código se crea (o se reusa) al terminar el alta.

/**
 * Las rutas (25/10/2026, Martín: «Revisa que la url es "https://hola-mako.com/partners/referidos" cuando solo basta
 * "partners"»): todo vive en /partners. `?alta=1` abre el onboarding corto; `?landing=1`, la landing de nuevo para quien ya
 * es partner («un botón arriba para ver la landing nuevamente»). /partners/referidos lleva acá.
 */
export const RUTA_PARTNERS = '/partners';
export const RUTA_ALTA_PARTNERS = '/partners?alta=1';
export const RUTA_LANDING_PARTNERS = '/partners?landing=1';

export const CLAVE_ALTA_PARTNERS = 'partners.alta';
/** Las visitas al link de un partner (un setting de SU negocio; las suma /r/<código>). */
export const CLAVE_VISITAS_PARTNERS = 'partners.visitas';

export const CUANTOS_PARTNERS = [
  { id: '1-2', texto: '1 o 2' },
  { id: '3-5', texto: '3 a 5' },
  { id: '6-10', texto: '6 a 10' },
  { id: 'mas-10', texto: 'Más de 10' },
] as const;
export const COMO_PARTNERS = [
  { id: 'clientes', texto: 'Mis clientes' },
  { id: 'comunidad', texto: 'Mi comunidad o mis redes' },
  { id: 'anuncios', texto: 'Anuncios' },
  { id: 'boca', texto: 'Boca en boca' },
] as const;
export type CuantosPartners = (typeof CUANTOS_PARTNERS)[number]['id'];
export type ComoPartners = (typeof COMO_PARTNERS)[number]['id'];

export type AltaPartner = {
  /** Cuándo se hizo partner (ISO). */
  at: string;
  cuantos: CuantosPartners | null;
  como: ComoPartners[];
  /** Dónde le transfiere MaKo: alias, CBU o el email de PayPal. null = lo carga después. */
  cobro: string | null;
};

export const TOPE_COBRO = 120;

/** Lo que dejó escrito en «¿Dónde te transferimos?»: sin espacios de más, con tope. Vacío = null. */
export function cobroLimpio(v: unknown): string | null {
  const s = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, TOPE_COBRO) : '';
  return s || null;
}

/** Las respuestas del alta, validadas (lo que llega del navegador, de la API o del setting guardado). */
export function altaLimpia(v: unknown, ahora = new Date().toISOString()): AltaPartner {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const cuantos = CUANTOS_PARTNERS.some((c) => c.id === o.cuantos) ? (o.cuantos as CuantosPartners) : null;
  const como = Array.isArray(o.como) ? [...new Set(o.como.filter((x): x is ComoPartners => COMO_PARTNERS.some((c) => c.id === x)))] : [];
  const at = typeof o.at === 'string' && !Number.isNaN(Date.parse(o.at)) ? o.at : ahora;
  return { at, cuantos, como, cobro: cobroLimpio(o.cobro) };
}

/** El setting guardado → el alta, o null si no se hizo partner (o el valor no es un alta). */
export function leerAlta(raw: string | null): AltaPartner | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as unknown;
    return o && typeof o === 'object' && typeof (o as { at?: unknown }).at === 'string' ? altaLimpia(o) : null;
  } catch {
    return null;
  }
}

/** Las visitas guardadas: el total y por mes («YYYY-MM»). Tolerante: un valor roto es cero. */
export type Visitas = { total: number; meses: Record<string, number> };
export function leerVisitas(raw: string | null): Visitas {
  try {
    const o = raw ? (JSON.parse(raw) as Partial<Visitas>) : {};
    const meses: Record<string, number> = {};
    for (const [k, n] of Object.entries(o.meses ?? {})) if (/^\d{4}-\d{2}$/.test(k) && Number.isFinite(Number(n))) meses[k] = Math.max(0, Math.floor(Number(n)));
    return { total: Math.max(0, Math.floor(Number(o.total) || 0)), meses };
  } catch {
    return { total: 0, meses: {} };
  }
}
/** Una visita más, en el mes de `hoy` («YYYY-MM»). Guarda sólo los últimos 12 meses. */
export function sumarVisita(v: Visitas, hoy: string): Visitas {
  const meses = { ...v.meses, [hoy]: (v.meses[hoy] ?? 0) + 1 };
  const ult = Object.keys(meses).sort().slice(-12);
  return { total: v.total + 1, meses: Object.fromEntries(ult.map((k) => [k, meses[k]])) };
}

/**
 * ¿Es un robot el que abre el link? Los que arman la vista previa de un link en WhatsApp, Facebook, X, Telegram, Slack o
 * LinkedIn lo abren cada vez que alguien lo pega: contarlos como visitas inflaría el número del panel.
 */
export const esRobot = (ua: string | null | undefined): boolean =>
  !ua || /bot|crawl|spider|preview|facebookexternalhit|whatsapp|telegram|slack|discord|linkedin|embedly|vkshare|headless/i.test(ua);

/**
 * El programa entero contado (el panel del super admin en /partners). Puro: lo arma `resumenDelPrograma`
 * (lib/partners-programa.ts) con las filas de la base. Cuenta como `acreditarReferidos`: un negocio nuevo, UNA vez, para el
 * PRIMER código que lo trajo (`compras` en orden de creación), nunca para sí mismo ni para la plataforma; un código que no es
 * de nadie no cuenta. Partners = los que terminaron el alta (`altas`), no los que tienen código.
 */
export function contarPrograma(p: {
  /** El negocio de la plataforma: nunca es partner (`acreditarReferidos` lo saltea). */
  plataforma: number | null;
  altas: ReadonlyArray<number>;
  codigos: ReadonlyArray<{ workspace_id: number; codigo: string }>;
  compras: ReadonlyArray<{ ref_codigo: string; alta_ws: number }>;
  libro: ReadonlyArray<Renglon & { referidor_ws: number }>;
}): {
  partners: number; referidos: number; ganadoUsd: number; pagadoUsd: number; aPagarUsd: number;
  porPartner: Map<number, { referidos: number } & Resumen>;
} {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const dueno = new Map(p.codigos.map((c) => [c.codigo, Number(c.workspace_id)]));
  const traidoPor = new Map<number, number>();
  for (const c of p.compras) {
    const partner = dueno.get(c.ref_codigo);
    const rws = Number(c.alta_ws);
    // El PRIMERO vale aunque no cuente (un código sin dueño, el propio, el de la plataforma): como `acreditarReferidos`,
    // que decide con la compra más vieja de cada negocio y recién después mira de quién es el código. -1 = no es de nadie.
    if (traidoPor.has(rws)) continue;
    traidoPor.set(rws, partner == null || partner === rws || partner === p.plataforma ? -1 : partner);
  }
  const referidosDe = new Map<number, number>();
  const contados = [...traidoPor.values()].filter((x) => x !== -1);
  for (const partner of contados) referidosDe.set(partner, (referidosDe.get(partner) ?? 0) + 1);
  const libroDe = new Map<number, Renglon[]>();
  for (const r of p.libro) {
    const ws = Number(r.referidor_ws);
    if (ws === p.plataforma) continue;
    libroDe.set(ws, [...(libroDe.get(ws) ?? []), r]);
  }
  const altas = new Set(p.altas.map(Number).filter((ws) => ws !== p.plataforma));
  const todos = new Set([...altas, ...referidosDe.keys(), ...libroDe.keys()]);
  const porPartner = new Map<number, { referidos: number } & Resumen>();
  for (const ws of todos) porPartner.set(ws, { referidos: referidosDe.get(ws) ?? 0, ...resumenDelLibro(libroDe.get(ws) ?? []) });
  let g = 0;
  let pg = 0;
  let ap = 0;
  for (const x of porPartner.values()) { g += x.ganadoUsd; pg += x.pagadoUsd; ap += x.aCobrarUsd; }
  return { partners: altas.size, referidos: contados.length, ganadoUsd: r2(g), pagadoUsd: r2(pg), aPagarUsd: r2(ap), porPartner };
}

/**
 * Lo que dice el panel (o el teléfono) de un partner SIN negocios todavía. Un referido se registra con la COMPRA EN LÍNEA (el
 * cobro con su código, lo único que lee `acreditarReferidos`): sin pasarela no nace ninguno, y un panel en cero que no dice
 * por qué hace creer que nadie usó el link. Si no se pudo saber si MaKo cobra en línea, el texto de siempre.
 */
export function textoSinReferidos(p: { cobraEnLinea: boolean; emailMako: string }): string {
  return p.cobraEnLinea
    ? 'Comparte tu link: cada negocio que entra con él aparece aquí, y te llevas una parte de cada pago que haga, todos los meses.'
    : `Comparte tu link. Si alguien entró con él y no aparece aquí, escríbenos a ${p.emailMako} y lo sumamos.`;
}

/** Lo mismo, para el panel del super admin: por qué el programa está en cero. */
export function textoProgramaSinReferidos(cobraEnLinea: boolean): string {
  return cobraEnLinea
    ? 'El primer negocio que llegue con el link de un partner aparece aquí.'
    : 'Un referido se registra con la compra en línea, y MaKo todavía no cobra en línea: hasta conectar la pasarela no entra ninguno solo. Un pedido de la página de planes trae su código de partner y se suma a mano.';
}
