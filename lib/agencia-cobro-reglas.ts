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
import type { EstadoCobro } from './cobros-tipos';

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
