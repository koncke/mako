// =============================================================================
// agencia-cobro-reglas — lo que MaKo le cobra a una AGENCIA por cada cliente, en reglas puras (#866 y #867, 17/10/2026)
// =============================================================================
// La llamada «Revisión de MaKo» con Código Inmobiliario (16/10/2026):
//   · #866 (1:51:21, Martín): «en la vista de clientes, de cargar nuevo cliente, te va a aparecer ahí directamente el
//     link de mercado pago para pagar la suscripción de ese cliente... ya se habilita automáticamente y ahí se renueva
//     mensualmente la misma fecha... yo ya ni siquiera lo voy a tener que aceptar». 47 dólares por cliente.
//   · #867 (1:59:00, Martín, y Joan aceptó): «se paga la suscripción de ese cliente, pero se pausa el tiempo, y empieza a
//     contabilizar una vez que terminó el onboarding».
//
// Cómo quedó (el porqué, en docs/hallazgos-pagos.md, «El mes de un cliente de agencia»):
//   1. Al abrirle la cuenta, la agencia paga el PRIMER MES con un link de pago único de la Mercado Pago de MaKo. El pago
//      habilita al cliente sin que nadie lo apruebe (lib/agencia-habilitar.ts).
//   2. Ese mes corre desde que el cliente TERMINA EL ONBOARDING (`desdeDelMes`). Mientras no lo termina, ni la agencia
//      puede usar su cuenta (el onboarding es obligatorio para entrar, también para la agencia), así que la pausa no se
//      puede usar de regalo.
//   3. Al terminarlo, MaKo crea la SUSCRIPCIÓN mensual con su primer cobro un mes después (`inicioDeRenovacion`), y la
//      agencia la autoriza una vez. Desde ahí renueva sola, cada mes, en esa fecha.
//
// Sin `server-only`: lo ejecutan los tests.
// =============================================================================

import { sumarMeses } from './cobrado-lead';
import { CAPACIDADES_PASARELA, type EstadoCobro, type Pasarela } from './cobros-tipos';

/** El precio de un cliente de agencia, en `app_settings` de la plataforma. */
export const KEY_PRECIO_CLIENTE_AGENCIA = 'agencia.precio_cliente';

/**
 * `usd`: lo que vale el mes, en dólares (47, lo que dijo Martín en la llamada). `mp`: lo que cobra la Mercado Pago de
 * MaKo, en la moneda de SU cuenta (MP Argentina cobra en pesos): lo carga el super admin en /admin/cobros. Sin él no hay
 * link, porque MaKo no inventa una tasa de cambio (docs/hallazgos-planes-y-cobro.md, «La moneda depende de la PASARELA»).
 */
export type PrecioClienteAgencia = { usd: number; mp: { moneda: string; monto: number } | null };

export const PRECIO_CLIENTE_AGENCIA_DEFAULT: PrecioClienteAgencia = { usd: 47, mp: null };

const positivo = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v.replace(',', '.')) : NaN;
  return Number.isFinite(n) && n > 0 && n < 100_000_000 ? Math.round(n * 100) / 100 : null;
};

/** Lo guardado (o lo que manda la pantalla), saneado. Lo que no se entiende cae al default, nunca a otro precio. */
export function sanearPrecioClienteAgencia(raw: unknown): PrecioClienteAgencia {
  let o: unknown = raw;
  if (typeof raw === 'string') { try { o = JSON.parse(raw); } catch { o = null; } }
  if (!o || typeof o !== 'object') return { ...PRECIO_CLIENTE_AGENCIA_DEFAULT };
  const r = o as { usd?: unknown; mp?: { moneda?: unknown; monto?: unknown } | null };
  const usd = positivo(r.usd) ?? PRECIO_CLIENTE_AGENCIA_DEFAULT.usd;
  const moneda = typeof r.mp?.moneda === 'string' && /^[A-Za-z]{3}$/.test(r.mp.moneda) ? r.mp.moneda.toUpperCase() : null;
  const monto = positivo(r.mp?.monto);
  return { usd, mp: moneda && monto ? { moneda, monto } : null };
}

/**
 * Desde cuándo corre el mes pagado (#867): desde que el cliente terminó el onboarding, y nunca antes del pago (un
 * onboarding que la agencia completó antes de pagar no le come días al mes que todavía no había pagado). Sin onboarding
 * terminado, null: el mes todavía no arrancó.
 */
export function desdeDelMes(p: { onboardingCompletoAt: string | null | undefined; pagadoAt: string | null | undefined }): string | null {
  const fin = p.onboardingCompletoAt ? Date.parse(p.onboardingCompletoAt) : NaN;
  if (!Number.isFinite(fin)) return null;
  const pago = p.pagadoAt ? Date.parse(p.pagadoAt) : NaN;
  return new Date(Number.isFinite(pago) ? Math.max(fin, pago) : fin).toISOString();
}

/** Un mes después del instante (el día capado al último del mes, como `sumarMeses`), a la misma hora. */
export function unMesDespues(iso: string): string {
  const d = new Date(iso);
  const dia = sumarMeses(d.toISOString().slice(0, 10), 1);
  return `${dia}${d.toISOString().slice(10)}`;
}

/** Margen para que Mercado Pago acepte el inicio: una suscripción no empieza en el pasado. */
export const MARGEN_INICIO_MS = 60 * 60 * 1000;

/**
 * El primer cobro de la renovación: un mes después de `desde`. Si el cron llegó tarde y esa fecha ya pasó (o está a
 * menos de una hora), dentro de una hora: se cobra lo que corresponde y no un mes de regalo, ni uno en el pasado.
 */
export function inicioDeRenovacion(desde: string, ahoraMs: number): string {
  const fecha = Date.parse(unMesDespues(desde));
  return new Date(Math.max(fecha, ahoraMs + MARGEN_INICIO_MS)).toISOString();
}

/** Lo que la pantalla de la agencia necesita de un cobro de un cliente suyo. */
export type CobroDeCliente = {
  cliente_ws: number;
  tipo: 'unico' | 'suscripcion';
  estado: EstadoCobro;
  suscripcion_estado: 'activa' | 'cancelada' | null;
  link: string;
  inicio_at: string | null;
  created_at: string;
};

/**
 * Por cliente, lo que la agencia tiene que hacer: pagar el primer mes (`pagar`, el link) o activar la renovación
 * (`renovacion`: el link, desde cuándo cobra y si ya la autorizó). Lo que no pide nada no aparece.
 * ⚠️ Un link sólo se ofrece mientras se puede pagar (pendiente o rechazado): uno anulado o devuelto no.
 */
export function cobrosParaLaAgencia(cobros: readonly CobroDeCliente[]): Record<number, { pagar: string | null; renovacion: { link: string; desde: string | null; activada: boolean } | null }> {
  const out: Record<number, { pagar: string | null; renovacion: { link: string; desde: string | null; activada: boolean } | null }> = {};
  const nuevos = [...cobros].sort((a, b) => b.created_at.localeCompare(a.created_at));
  for (const c of nuevos) {
    const fila = (out[c.cliente_ws] ??= { pagar: null, renovacion: null });
    const vivo = c.estado === 'pendiente' || c.estado === 'fallido';
    if (c.tipo === 'unico') {
      // El primer mes ya pagado no pide nada; si hay uno pagado, un link viejo pendiente tampoco.
      if (c.estado === 'pagado') fila.pagar = null;
      else if (vivo && fila.pagar === null && !nuevos.some((x) => x.cliente_ws === c.cliente_ws && x.tipo === 'unico' && x.estado === 'pagado')) fila.pagar = c.link;
    } else if (vivo && c.suscripcion_estado !== 'cancelada' && !fila.renovacion) {
      fila.renovacion = { link: c.link, desde: c.inicio_at, activada: c.suscripcion_estado === 'activa' };
    }
  }
  for (const k of Object.keys(out)) {
    const f = out[Number(k)];
    if (!f.pagar && !f.renovacion) delete out[Number(k)];
  }
  return out;
}

/**
 * ¿A esta agencia se le cobra por la PASARELA (el link del primer mes, #866, y la renovación, #867)? No, si paga por su
 * MENSUALIDAD por fuera de MaKo (lib/agencia-mes.ts, prendida por agencia): son dos cobros del mismo cliente y no se mezclan.
 *
 * ⚠️ Ticket #85 (11/11/2026). Con la mensualidad prendida desde el 6/11, el alta de Sellers (negocio 24) creó igual el
 * link de Mercado Pago de su primer mes (ARS 73.555). La agencia pagó la entrada por Binance, Martín la habilitó, y el
 * link quedó PENDIENTE: como `accionDeCuenta` pone «Pagar su mes» antes que «Inspeccionar», Joan no tenía cómo entrar a
 * su cuenta (ni hacerle el onboarding), con el aviso «Falta pagar su mes» sobre un mes que ya había pagado. Y el link
 * seguía cobrable: pagarlo era pagar dos veces.
 *
 * `null` es «no pude leer la mensualidad» y cuenta como pasarela: es lo que pasaba antes, y para una agencia que paga con
 * tarjeta esconderle su link sería dejar la cuenta sin forma de pagarse.
 */
export const cobraPorPasarela = (mensualidadPrendida: boolean | null): boolean => mensualidadPrendida !== true;

// =============================================================================
// EL PLAN Y LA PASARELA DE CADA CUENTA (29/10/2026, llamada con Thiago, agencia de España con 27 clientes)
// =============================================================================
// «Son los mismos planes, de 47 y 97» [10:24]: la cuenta de un cliente se abre con Esencial o Pro (los de /planes,
// lib/planes-mako.ts), a su precio. Y se cobra como /planes: Mercado Pago sólo en el país de SU cuenta (la de MaKo es
// argentina: cobra en pesos); en el resto del mundo, Stripe, en EUR en la zona euro si el plan tiene ese precio, y si no en
// USD. Hasta este día sólo cobraba Mercado Pago en pesos: para España no salía ningún link y cada cuenta esperaba la firma.

export type PlanCuenta = 'esencial' | 'pro';
export const planCuentaDe = (v: unknown): PlanCuenta => (v === 'pro' ? 'pro' : 'esencial');
/** La capa que abre cada plan (como /planes: Esencial = completo, Pro = agencia). */
export const CAPA_DE_PLAN: Readonly<Record<PlanCuenta, 'completo' | 'agencia'>> = { esencial: 'completo', pro: 'agencia' };
export const planDeCapa = (capa: string | null | undefined): PlanCuenta => (capa === 'agencia' ? 'pro' : 'esencial');

const EUROZONA: ReadonlySet<string> = new Set(['ES', 'FR', 'DE', 'IT', 'PT', 'NL', 'BE', 'AT', 'IE', 'FI', 'GR', 'LU', 'SK', 'SI', 'EE', 'LV', 'LT', 'CY', 'MT', 'HR']);

// La pasarela DERIVADA, no copiada (31/10/2026): con la unión a mano, una opción de la tercera pasarela no se podía
// asignar acá y, peor, `cobroDeLaCuenta` sólo buscaba las dos viejas y devolvía null («MaKo todavía no tiene una
// pasarela que cobre en ese país») con la nueva conectada y cobrando.
export type OpcionDeCobro = { pasarela: Pasarela; moneda: string; monto: number };

/**
 * Con qué se cobra una cuenta: de las opciones que YA filtró el país (`pasarelasDelPais`), Mercado Pago si quedó y se sabe
 * el país (es el de su país); si no, Stripe, en EUR en la zona euro cuando el plan tiene precio en EUR (`eur`). ⚠️ SIN PAÍS,
 * Stripe primero: Mercado Pago rechaza a quien no es de su país («la cuenta del vendedor es de otro país»), Stripe cobra en
 * todo el mundo. null = hoy no se puede cobrar.
 */
export function cobroDeLaCuenta(p: { pais: string | null; opciones: readonly OpcionDeCobro[]; eur: number | null }): OpcionDeCobro | null {
  // ⚠️ ESTO BUSCABA LOS DOS NOMBRES VIEJOS Y DEVOLVÍA null CON CREEM CONECTADO (31/10/2026): `p.opciones` ya viene
  // filtrado por país y en LatAm deja Creem, así que `mp` y `stripe` eran los dos `undefined` y la agencia recibía
  // «MaKo todavía no tiene una pasarela que cobre en ese país» en nueve países. Ninguna cuenta se podía abrir.
  // El comentario de arriba decía que este bug ya estaba arreglado: se derivó el TIPO y no se tocó el cuerpo.
  // Ahora la pregunta no es por NOMBRE sino por capacidad, y vive en la tabla (`CAPACIDADES_PASARELA`): la pasarela #4
  // no compila hasta que alguien decida si cobra afuera de su país.
  const local = p.opciones.find((o) => CAPACIDADES_PASARELA[o.pasarela].soloEnSuPais);
  // Las que cobran afuera, en el orden en que las dejó el país: `pasarelasDelPais` ya eligió (Creem en LatAm, Stripe en
  // el resto del mundo), así que acá NO se vuelve a decidir — se respeta lo que quedó.
  const afuera = p.opciones.filter((o) => !CAPACIDADES_PASARELA[o.pasarela].soloEnSuPais);
  if (local && (p.pais || !afuera.length)) return local;
  const elegida = afuera[0];
  if (!elegida) return null;
  // El precio en euros es de Stripe: Creem tiene el enum de monedas cerrado y MaKo le cobra en USD (la misma tabla).
  if (elegida.pasarela === 'stripe' && p.pais && EUROZONA.has(p.pais) && p.eur != null && p.eur > 0) {
    return { pasarela: 'stripe', moneda: 'EUR', monto: p.eur };
  }
  return elegida;
}

/**
 * El plan que la agencia ve de una cuenta de su cartera (30/10/2026). `cuentasDePartner` cruza de inquilino, y la regla de esa
 * lectura es que la capa, como el equipo, se lee SÓLO de las APROBADAS:
 *   · DADA DE BAJA: nada. Ya no es su cuenta: el cliente puede haber elegido su plan, y a su ex agencia no le incumbe.
 *   · PENDIENTE: lo que ELIGIÓ la propia agencia al abrirla (`agency.plan_cambiado`), que es un dato suyo y hace falta para
 *     pagar el primer mes y corregirlo antes de pagar. Nunca la capa. Sin esa marca, nada.
 *   · APROBADA: su capa. Sin el plan elegido (`sinElegir`, las de antes del 29/10), lo dice.
 */
export function planQueVeLaAgencia(p: { estado: string; capa: string | null | undefined; hayCuenta: boolean; elegido: PlanCuenta | null; sinElegir: boolean }): { plan: string | null; planId: PlanCuenta; planElegido: boolean } {
  const nombre = (x: PlanCuenta) => (x === 'pro' ? 'MaKo Pro' : 'MaKo Esencial');
  if (p.estado === 'aprobado' && p.hayCuenta) {
    const planId = planDeCapa(p.capa);
    return { plan: p.sinElegir ? 'Sin elegir (tiene todo lo de Pro)' : nombre(planId), planId, planElegido: !p.sinElegir };
  }
  if (p.estado === 'pendiente' && p.elegido) return { plan: nombre(p.elegido), planId: p.elegido, planElegido: true };
  return { plan: null, planId: 'esencial', planElegido: true };
}

/** El país de una zona horaria (el respaldo cuando no hay encabezado, como en la API): sólo las que se saben sin dudar. */
export function paisDeZona(tz: string | null | undefined): string | null {
  const z = String(tz ?? '');
  if (z.startsWith('America/Argentina/') || z === 'America/Buenos_Aires') return 'AR';
  const EU: Record<string, string> = { Madrid: 'ES', Paris: 'FR', Berlin: 'DE', Rome: 'IT', Lisbon: 'PT', Amsterdam: 'NL', Brussels: 'BE', Vienna: 'AT', Dublin: 'IE', Athens: 'GR', Helsinki: 'FI' };
  if (z.startsWith('Europe/')) return EU[z.slice(7)] ?? null;
  if (['America/Mexico_City', 'America/Tijuana', 'America/Monterrey', 'America/Cancun', 'America/Merida', 'America/Chihuahua', 'America/Hermosillo', 'America/Mazatlan'].includes(z)) return 'MX';
  return null;
}

/** Cuántos días antes de que empiece a cobrar se abre la renovación de Stripe (Stripe no difiere el primer cobro: cobra al pagarla). */
export const DIAS_ANTES_RENOVACION_STRIPE = 5;

/** ¿Ya se abre la renovación por Stripe? (MP la crea al terminar el onboarding con su `start_date`.) */
export const abreRenovacionStripe = (inicioIso: string, ahoraMs: number): boolean => ahoraMs >= Date.parse(inicioIso) - DIAS_ANTES_RENOVACION_STRIPE * 86_400_000;

// =============================================================================
// DAR DE BAJA (29/10/2026, lib/agencia-baja.ts): qué se hace con cada cobro, y hasta cuándo pagó el cliente
// =============================================================================

export type CobroEnLaBaja = {
  tipo: 'unico' | 'suscripcion'; estado: string; suscripcion_estado: string | null; pagado_at: string | null;
  /** La fecha del ÚLTIMO pago de esa suscripción (de `pagos`): las renovaciones no mueven `pagado_at`. */
  ultimo_pago?: string | null;
};

/**
 * Qué se hace con un cobro de la cuenta al darla de baja:
 *   · `cancelar`: una suscripción VIVA en la pasarela (`suscripcion_estado: 'activa'`), pagada, autorizada sin cobrar, fallida o
 *     con el primer pago devuelto. Todas siguen cobrando (revisión de plata, hallazgo 3: el filtro viejo salteaba la devuelta, y
 *     la autorizada iba por `anularCobro`, que se traga el error de la pasarela).
 *   · `pasar`: la misma, si la paga el CLIENTE: es su tarjeta y su plan; pasa a ser suyo (`alta_ws`) en vez de cortarse
 *     (hallazgo 5: se le cancelaba lo que ya había pagado).
 *   · `anular`: un link que todavía no se pagó ni se autorizó.
 *   · null: lo cobrado y lo cerrado, que no se toca.
 */
/**
 * ¿La pasarela la sigue cobrando? La marcada `activa` (pagada, autorizada sin cobrar, fallida o con el primer pago devuelto) y
 * TAMBIÉN la pagada o devuelta sin `suscripcion_estado`: ese estado lo marca sólo un aviso que trae el id de la suscripción, y
 * uno de Mercado Pago sin él la dejaba sin marcar, cobrando (segunda pasada de la revisión de plata, hallazgo E).
 */
export function esSuscripcionViva(c: Pick<CobroEnLaBaja, 'tipo' | 'estado' | 'suscripcion_estado'>): boolean {
  if (c.tipo !== 'suscripcion' || c.suscripcion_estado === 'cancelada') return false;
  return c.suscripcion_estado === 'activa' || c.estado === 'pagado' || c.estado === 'reembolsado';
}

export function queHacerEnLaBaja(c: CobroEnLaBaja, pagaCliente: boolean): 'cancelar' | 'pasar' | 'anular' | null {
  if (esSuscripcionViva(c)) return pagaCliente ? 'pasar' : 'cancelar';
  if ((c.estado === 'pendiente' || c.estado === 'fallido') && c.suscripcion_estado !== 'cancelada') return 'anular';
  return null;
}

/**
 * Hasta cuándo usa la cuenta quien la pagaba él mismo y se queda sin la agencia (hallazgo 5): el fin del último mes que pagó.
 * El primer mes corre desde que terminó el onboarding (`desdeDelMes`), como la renovación; lo demás, desde el pago. null =
 * no pagó nada.
 */
export function finDeLoQuePago(cobros: readonly CobroEnLaBaja[], onboardingCompletoAt: string | null): string | null {
  let fin: string | null = null;
  for (const c of cobros) {
    if (c.estado !== 'pagado' || !c.pagado_at) continue;
    // Una suscripción, desde su último pago (verificación independiente, H8: desde el primero cortaba hasta un mes antes).
    const ultimo = c.ultimo_pago && c.ultimo_pago > c.pagado_at ? c.ultimo_pago : c.pagado_at;
    const desde = c.tipo === 'unico' ? desdeDelMes({ onboardingCompletoAt, pagadoAt: c.pagado_at }) ?? c.pagado_at : ultimo;
    const hasta = unMesDespues(desde);
    if (!fin || hasta > fin) fin = hasta;
  }
  return fin;
}

// =============================================================================
// CAMBIAR EL PLAN (29/10/2026, lib/agencia-plan.ts): Pro se tiene cuando se PAGA a precio de Pro
// =============================================================================
// La revisión de plata (hallazgos 2a y C): con la capa en el acto y el precio desde el próximo cobro, ir a Pro después de un
// cobro y volver a Esencial antes del siguiente usaba Pro pagando 47. Un «un cambio cada 30 días» no lo cerraba (con Mercado
// Pago alcanzaba para Pro la mitad de los meses, y en el primer mes regalaba uno). La regla que quedó:
//   · SUBIR en el acto SÓLO si se cobró la diferencia ahora (Stripe prorratea, `subirPlanStripe`) o si todavía no se pagó
//     nada (el link del primer mes se rehace a precio de Pro, y la cuenta no se usa antes de pagarlo).
//   · Si no (Mercado Pago, que no prorratea; o un primer mes ya pagado sin una renovación cobrada), la subida queda PENDIENTE:
//     lo que se cobra pasa a Pro desde el próximo cobro, y la capa sube recién con ese pago (el cron, `subidaCobrada`).
//   · BAJAR, en el acto: la capa baja ya y el precio menor corre desde el próximo cobro (nadie gana con eso). Cancela una
//     subida pendiente.
// Se guarda en la cuenta del CLIENTE, como quién paga.

// La clave vive en lib/plan-esencial-reglas.ts (la leen los candados de cada página, que no pueden cargar este módulo).
export { KEY_PLAN_CAMBIADO } from './plan-esencial-reglas';

export type CambioDePlan = { at: string; plan: PlanCuenta; pendiente: boolean };

export function leerCambioDePlan(crudo: unknown): CambioDePlan | null {
  try {
    const v = (typeof crudo === 'string' ? JSON.parse(crudo) : crudo) as Partial<CambioDePlan> | null;
    if (!v || typeof v.at !== 'string' || (v.plan !== 'esencial' && v.plan !== 'pro')) return null;
    return { at: v.at, plan: v.plan, pendiente: v.pendiente === true };
  } catch { return null; }
}

/**
 * ¿La subida a Pro se aplica ya? Sólo si la pasarela cobró la diferencia ahora, o si la cuenta todavía no pagó nada Y tiene
 * qué cobrar (su link del primer mes, que se rehace a precio de Pro). Sin ningún cobro, no: era Pro gratis (la verificación
 * independiente, H2; quien llama además lo rechaza).
 */
export function subeEnElActo(p: { diferenciaCobrada: boolean; algoPagado: boolean; hayQueCobrar: boolean }): boolean {
  return p.diferenciaCobrada || (!p.algoPagado && p.hayQueCobrar);
}

/**
 * ¿SE PUEDE TOCAR ESTA CUENTA COMO «CLIENTE DE UNA AGENCIA»? (6/11/2026, #495)
 *
 * Lo que valida `darDeBajaClienteDeAgencia` y `cambiarPlanDeCliente` antes de cancelar una suscripción, anular un link o
 * cambiarle el plan a alguien. Hasta hoy lo único que había entre una agencia y la cuenta de la PLATAFORMA era que no
 * existiera una fila suya en `agencia_clientes`: con esa fila puesta (un script, una semilla, un camino nuevo que acepte un
 * ws que ya existe), `darDeBajaClienteDeAgencia` llegaba a `cancelarSuscripcionCobro` y `anularCobro` sobre los cobros de
 * la plataforma, y la dejaba pausada con el corte `sin-agencia`. El alta de hoy siempre crea un workspace NUEVO
 * (`abrirCuentaDePartner`), así que no es alcanzable desde la app — pero el daño es la plataforma entera, y lo que lo
 * evitaba era una ausencia, no una guarda.
 *
 * ⚠️ `plataformaWs` sale de `wsSuperAdmin()`, que CAE A 9 si no encuentra la fila `capa = 'superadmin'`. Por eso el que
 *    pregunta pasa el número ya resuelto: acá no se adivina, y un 9 de más es un falso positivo que no cobra de menos.
 * ⚠️ NO reemplaza la verificación de que la fila sea de ESA agencia: es la guarda de ADENTRO, la que vale aunque la fila
 *    exista. Las dos corren.
 */
export function clienteDeAgenciaTocable(p: { agenciaWs: number; clienteWs: number; plataformaWs: number }): { ok: true } | { ok: false; error: string } {
  const { agenciaWs, clienteWs, plataformaWs } = p;
  if (!Number.isInteger(agenciaWs) || !Number.isInteger(clienteWs) || agenciaWs <= 0 || clienteWs <= 0) return { ok: false, error: 'Cuenta inválida.' };
  // Una agencia no se da de baja a sí misma por este camino (su baja es otra cosa).
  if (agenciaWs === clienteWs) return { ok: false, error: 'Cuenta inválida.' };
  // La plataforma no es cliente de nadie, ni siquiera con la fila puesta.
  if (clienteWs === plataformaWs) return { ok: false, error: 'Esa cuenta no es de tu agencia.' };
  return { ok: true };
}

/**
 * ¿Ya entró el primer pago a precio de Pro después de pedir la subida? (los pagos de sus suscripciones anotadas en Pro; `alcanza`:
 * el pago es de al menos el precio de Pro en su moneda, porque una pasarela que no tomó el monto nuevo cobra el de Esencial).
 */
export function subidaCobrada(cambio: CambioDePlan | null, pagosEnPro: readonly { fecha_pago: string | null; alcanza: boolean }[]): boolean {
  if (!cambio || !cambio.pendiente || cambio.plan !== 'pro') return false;
  // Por DÍA y estrictamente después (`fecha_pago` puede venir sin hora): un pago del mismo día pudo ser el de antes, a precio de
  // Esencial. Si la renovación cae justo ese día, Pro llega con la siguiente.
  const dia = cambio.at.slice(0, 10);
  return pagosEnPro.some((x) => x.alcanza && !!x.fecha_pago && x.fecha_pago.slice(0, 10) > dia);
}
