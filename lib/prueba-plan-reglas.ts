// =============================================================================
// prueba-plan-reglas — la prueba gratis de 7 días de un plan de MaKo (lo puro, con test)
// =============================================================================
// Martín (25/10/2026, ~10:20): «quiero implementar la prueba gratuita de 7 días... para darte de alta en la prueba gratuita
// debes poner la tarjeta, tal cual como una suscripción, y se te cobra automático luego de esos 7 días». El servidor vive en
// lib/prueba-plan.ts; acá, qué cobro es una prueba, la huella de la tarjeta, cuándo se avisa y los textos.
//
// CÓMO ES UNA PRUEBA: un cobro de suscripción de la plataforma con alta (`alta_capa`), creado por /planes con
// `creado_por = planes:<plan>:prueba`, y con su primer cobro diferido 7 días (`inicio_at` → el `start_date` de Mercado Pago,
// el mismo de los clientes de agencia desde el 17/10). La persona carga la tarjeta al autorizarla, el alta se hace en ese
// momento (no al pagar) y Mercado Pago cobra solo el día 8. Una prueba que nadie autorizó no da de alta a nadie.
// =============================================================================

import { PRUEBA_DIAS } from './planes-mako';
import type { Pasarela } from './cobros-tipos';

/**
 * Las pasarelas que arman la prueba con tarjeta: Mercado Pago (la de MaKo para Argentina, con `start_date`), Stripe
 * (con `trial_period_days`, desde el 27/10/2026) y Creem (con `trial_period_days` en el PRODUCTO, desde el 31/10/2026).
 *
 * ⚠️ ESTA LISTA NO SE ENSANCHA SOLA, y es la que decide si una pasarela se OFRECE en /planes
 * (`monedasDeLaPlataforma` saltea la que no esté acá). Una pasarela nueva que sepa hacer la prueba y que nadie agregue
 * acá queda conectada, cobrando y invisible en la vitrina, sin ningún error. Lo que dice si sabe hacerla es
 * `CAPACIDADES_PASARELA[p].pruebaConTarjeta` (lib/cobros-tipos.ts): si las dos no coinciden, manda la capacidad y esta
 * lista está vieja. Antes era sólo Mercado Pago, y por eso /planes nunca ofrecía Stripe aunque
 * estuviera conectada: una clienta de México recibió el link de la Mercado Pago argentina y MP la rechazó («La cuenta del
 * vendedor es de otro país»; docs/hallazgos-planes-y-cobro.md, «Fuera de Argentina se cobra con Stripe»).
 */
export const PASARELAS_CON_PRUEBA: readonly Pasarela[] = ['mercadopago', 'stripe', 'creem'];

const DIA_MS = 86_400_000;
/** Cuántos días antes del primer cobro se le avisa por email (el Cerebro, 25/10). */
export const DIAS_AVISO_FIN_DE_PRUEBA = 2;

export const creadoPorPrueba = (planId: string): string => `planes:${planId}:prueba`;
const PRUEBA_RE = /^planes:[a-z0-9-]{1,32}:prueba$/;

/** ¿Este cobro es la prueba gratis de un plan de MaKo? */
export function esPruebaDePlan(c: { tipo: string; alta_capa?: string | null; creado_por?: string | null }): boolean {
  return c.tipo === 'suscripcion' && !!c.alta_capa && PRUEBA_RE.test(c.creado_por ?? '');
}

/**
 * La SUSCRIPCIÓN DE MaKo de un negocio (el filtro de PostgREST, sobre los cobros de suscripción de la plataforma con su
 * `alta_ws`): la pagada, o la prueba que la persona autorizó (`suscripcion_estado` ya no es null). La usan
 * `suscripcionDeMakoDe` (lib/cobros.ts) y `esEsencialDe` (lib/plan-esencial.ts), que no puede importar lib/cobros.
 */
export const FILTRO_SUSCRIPCION_DE_MAKO = 'estado.eq.pagado,and(estado.eq.pendiente,suscripcion_estado.not.is.null,creado_por.like.planes:*:prueba)';

/**
 * «Empezar mi plan ya» (lib/empezar-plan.ts): el cobro nuevo, sin prueba, lleva en `creado_por` la prueba que reemplaza. Al
 * cobrarse, esa prueba se cancela (`cerrarPruebaAlEmpezarYa`, lib/cobros.ts).
 */
export const creadoPorEmpezarYa = (pruebaId: number): string => `empezar-ya:${pruebaId}`;
export function pruebaDeEmpezarYa(creadoPor: string | null | undefined): number | null {
  const m = /^empezar-ya:(\d{1,12})$/.exec(creadoPor ?? '');
  return m ? Number(m[1]) : null;
}

/** El día del primer cobro: `PRUEBA_DIAS` después de empezar. */
export const finDeLaPrueba = (desdeMs: number): string => new Date(desdeMs + PRUEBA_DIAS * DIA_MS).toISOString();

/**
 * La HUELLA de quien autorizó la prueba en Mercado Pago. MP no publica una huella de la tarjeta como el `card.fingerprint` de
 * Stripe: lo que devuelve la suscripción es la CUENTA que paga (`payer_id`, una por persona en MP) y la tarjeta guardada de esa
 * cuenta (`card_id`). Las dos van en la huella, y una coincidencia en cualquiera de las dos es la misma persona.
 */
export function huellaMp(p: { pagadorId: string | null; tarjetaId: string | null }): string | null {
  const limpio = (v: string | null) => (v && /^[A-Za-z0-9_-]{1,64}$/.test(v) ? v : null);
  const cuenta = limpio(p.pagadorId);
  const tarjeta = limpio(p.tarjetaId);
  if (!cuenta && !tarjeta) return null;
  return `mp:${cuenta ?? '-'}|card:${tarjeta ?? '-'}`;
}

/**
 * La HUELLA en Stripe (27/10/2026): el `card.fingerprint` de la tarjeta (el mismo número de tarjeta da la misma huella en la
 * cuenta). No hay «cuenta que paga» como en Mercado Pago. Va con el mismo formato, así la compara el mismo filtro.
 */
export function huellaStripe(huella: string | null | undefined): string | null {
  return huella && /^[A-Za-z0-9]{1,64}$/.test(huella) ? `st:-|card:${huella}` : null;
}

/**
 * La HUELLA en Creem (31/10/2026): su `customer.id`, porque es lo único que hay. ⚠️ NO reconoce la TARJETA: ningún objeto de
 * Creem la trae, y el cliente va por email. Corta a quien repite con el mismo email en Creem, aunque en MaKo haya escrito otro;
 * con otro email también en Creem, la misma tarjeta pasa.
 */
export function huellaCreem(clienteId: string | null | undefined): string | null {
  return clienteId && /^[A-Za-z0-9_-]{1,64}$/.test(clienteId) ? `cr:${clienteId}|card:-` : null;
}

/**
 * ¿Esta transacción de Creem es un cobro de ESTE cobro? En una prueba, una en cero no lo es: su doc no dice si el arranque
 * deja una, y Stripe sí deja la factura en cero (`primerCobroDeLaPrueba`). Asentarla pasaría la prueba a «pagado» sin plata.
 */
export const transaccionQueCobra = (c: { tipo: string; alta_capa?: string | null; creado_por?: string | null }, x: { estado: string | null; monto: number | null }): boolean =>
  x.estado === 'paid' && (!esPruebaDePlan(c) || (x.monto ?? 0) > 0);

/** Las partes de una huella (lo que se compara). */
export function partesDeHuella(h: string | null | undefined): { cuenta: string | null; tarjeta: string | null } {
  const m = /^(?:mp|st|cr):([^|]+)\|card:(.+)$/.exec(h ?? '');
  if (!m) return { cuenta: null, tarjeta: null };
  return { cuenta: m[1] === '-' ? null : m[1], tarjeta: m[2] === '-' ? null : m[2] };
}

/** ¿Dos huellas son la misma persona? (la misma cuenta de MP o la misma tarjeta guardada). */
export function compartenHuella(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = partesDeHuella(a), y = partesDeHuella(b);
  return (!!x.cuenta && x.cuenta === y.cuenta) || (!!x.tarjeta && x.tarjeta === y.tarjeta);
}

/** ¿Toca mandar el aviso de que la prueba termina? Una vez, en los `DIAS_AVISO_FIN_DE_PRUEBA` días antes del cobro. */
export function tocaAvisarFinDePrueba(p: { inicioAt: string | null; ahoraMs: number; avisadoAt: string | null }): boolean {
  if (p.avisadoAt || !p.inicioAt) return false;
  const cobro = Date.parse(p.inicioAt);
  return Number.isFinite(cobro) && p.ahoraMs < cobro && cobro - p.ahoraMs <= DIAS_AVISO_FIN_DE_PRUEBA * DIA_MS;
}

/** Cuántos días le quedan a la prueba (0 = termina hoy). Redondea para arriba: «quedan 7» el día que empieza. */
export function diasQueQuedan(hastaIso: string | null | undefined, ahoraMs: number): number | null {
  const fin = hastaIso ? Date.parse(hastaIso) : NaN;
  if (!Number.isFinite(fin)) return null;
  return Math.max(0, Math.ceil((fin - ahoraMs) / DIA_MS));
}

/**
 * EL CARTEL DE LA VERSIÓN DE PRUEBA (25/10/2026, Martín: «Me gusta el cartel de "limited version" de 7 días de madgicx»;
 * docs/media-buyer/referencias/madgicx/prueba-limitada/LEEME.md). Madgicx dice «Limited version | 7 days left», una línea con
 * lo que se cobra después y «Upgrade Now». Acá, corto y en tú: el título con los días, el precio de después y el botón.
 */
export function textoCartelPrueba(p: { dias: number | null; plan: string; despues: string | null }): { titulo: string; linea: string; boton: string } {
  const quedan = p.dias == null ? '' : p.dias <= 0 ? ' · termina hoy' : p.dias === 1 ? ' · queda 1 día' : ` · quedan ${p.dias} días`;
  return {
    titulo: `Versión de prueba${quedan}`,
    linea: p.despues ? `Al terminar, sigues con ${p.plan} por ${p.despues}.` : `Al terminar, sigues con ${p.plan}.`,
    boton: 'Pasar al plan ya',
  };
}

/** «el lunes 3 de noviembre»: el día del cobro, como lo lee una persona (en la hora de Argentina, la de MaKo). */
export function diaDelCobro(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Argentina/Buenos_Aires' });
}

// ── Los textos (una segunda prueba se rechaza con un texto claro, el Cerebro, 25/10) ─────────────────────────────────

export const TEXTO_PRUEBA_USADA_EMAIL = 'Ese email ya usó su prueba gratis de MaKo. Si quieres empezar igual, el plan se cobra desde hoy.';
export const TEXTO_PRUEBA_USADA_CUENTA = 'Ese email ya tiene una cuenta de MaKo, y la prueba gratis es para negocios nuevos. Para tu plan, entra a «Tu plan» en tu cuenta.';
export const TEXTO_PRUEBA_USADA_TARJETA = 'Esa tarjeta ya usó su prueba gratis de MaKo, así que no empezamos otra ni te cobramos nada. Si quieres empezar igual, el plan se cobra desde hoy.';

/** El motivo que queda en el cobro anulado por una prueba repetida (lo lee la página de vuelta del pago). */
export const PREFIJO_PRUEBA_RECHAZADA = 'Prueba rechazada:';
export const esPruebaRechazada = (motivo: string | null | undefined): boolean => typeof motivo === 'string' && motivo.startsWith(PREFIJO_PRUEBA_RECHAZADA);

/** El aviso de 2 días antes, por email (asunto y cuerpo). */
export function avisoFinDePrueba(p: { nombrePlan: string; monto: string; inicioAt: string; linkPlan: string }): { asunto: string; cuerpo: string } {
  const dia = diaDelCobro(p.inicioAt);
  return {
    asunto: `Tu prueba gratis de ${p.nombrePlan} termina en ${DIAS_AVISO_FIN_DE_PRUEBA} días`,
    cuerpo: [
      `Tu prueba gratis de ${p.nombrePlan} termina pronto: el ${dia} se cobra ${p.monto} con tu tarjeta, y sigues usando MaKo sin cortes.`,
      '',
      `Si no quieres seguir, date de baja antes desde «Tu plan» y no se te cobra nada:`,
      p.linkPlan,
    ].join('\n'),
  };
}
