// =============================================================================
// planes-mako — los planes que MaKo vende por su cuenta (lo puro: sin base ni red)
// =============================================================================
// Pedido de Martín (22/10/2026): «si alguien paga se ingresa automáticamente a la app con el email de bienvenida».
// Hasta hoy un plan se vendía SÓLO armando el link a mano en /admin/cobros (el super admin tipeaba el precio). El
// checkout público de /planes necesita saber qué se vende, a cuánto y qué capa abre: eso vive acá.
//
// PARAMETRIZABLE (las ofertas finales las define el Cerebro): los planes de abajo son los de HOY (Pro US$47, Growth
// US$97, docs/costos-ia-y-planes.md). El super admin los cambia sin deploy con el setting `planes.mako` del workspace de
// la plataforma (lib/planes-mako-server.ts): el setting manda, y un plan mal escrito se descarta (nunca se vende un
// precio que no pasó `planesDeSetting`).
//
// ⚠️ LA CAPA SALE DEL PLAN, NUNCA DEL PEDIDO: el comprador elige un `id`; la capa, el precio y la moneda los pone esto.
// =============================================================================

import type { CapaId } from './capas';

export type PlanMako = {
  /** El id público (va en la URL: /planes/<id>). */
  id: string;
  nombre: string;
  /** La capa que abre el alta automática (tiene que ser vendible: lib/alta-cliente.ts lo vuelve a validar). */
  capa: CapaId;
  /** El precio mensual en dólares (Stripe cobra en USD). */
  precioUsd: number;
  /**
   * El precio mensual en la moneda de una cuenta de Mercado Pago (MP cobra en la moneda de SU sitio: ARS, MXN…). Sin
   * el precio en esa moneda, el plan no se ofrece por Mercado Pago (nunca se inventa una tasa).
   */
  preciosLocales: Record<string, number>;
  /** Una línea: para quién es. */
  resumen: string;
  /** Lo que incluye, en renglones cortos. */
  incluye: string[];
  destacado?: boolean;
  /** Un plan apagado no se ofrece en /planes, pero quien ya lo paga lo sigue pagando. */
  activo: boolean;
};

export const CLAVE_PLANES = 'planes.mako';

/** Los planes de hoy (23/10/2026). Cambiar acá es un deploy; cambiar el setting `planes.mako`, no. */
export const PLANES_MAKO_DEFAULT: readonly PlanMako[] = [
  {
    id: 'pro',
    nombre: 'MaKo Pro',
    capa: 'completo',
    precioUsd: 47,
    preciosLocales: {},
    resumen: 'Para tu negocio: anuncios, CRM, WhatsApp y tu plan, con MaKo.',
    incluye: ['Anuncios de Meta con sus analistas', 'CRM y seguimiento de cada lead', 'WhatsApp y chats con MaKo', 'Tu plan y el Perro Guardián'],
    activo: true,
  },
  {
    id: 'growth',
    nombre: 'MaKo Growth',
    capa: 'agencia',
    precioUsd: 97,
    preciosLocales: {},
    resumen: 'Todo Pro y, además, tus clientes adentro de MaKo.',
    incluye: ['Todo lo de MaKo Pro', 'Tus clientes en MaKo Partners', 'Cada cliente con su cuenta y su plan'],
    destacado: true,
    activo: true,
  },
];

const CAPAS_DE_PLAN: ReadonlySet<string> = new Set(['pm', 'completo', 'agencia']);
const ID_RE = /^[a-z0-9-]{1,32}$/;
const MONEDA_RE = /^[A-Z]{3}$/;

const texto = (v: unknown, max: number): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s.slice(0, max) : null;
};
const precio = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n < 1_000_000_000 ? Math.round(n * 100) / 100 : null;
};

/** Un plan escrito a mano (el setting): o pasa entero, o no existe. */
export function planValido(v: unknown): PlanMako | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id.trim() : '';
  const nombre = texto(o.nombre, 60);
  const capa = typeof o.capa === 'string' ? o.capa : '';
  const usd = precio(o.precioUsd);
  if (!ID_RE.test(id) || !nombre || !CAPAS_DE_PLAN.has(capa) || usd == null) return null;
  const preciosLocales: Record<string, number> = {};
  if (o.preciosLocales && typeof o.preciosLocales === 'object' && !Array.isArray(o.preciosLocales)) {
    for (const [m, x] of Object.entries(o.preciosLocales as Record<string, unknown>)) {
      const p = precio(x);
      if (MONEDA_RE.test(m) && m !== 'USD' && p != null) preciosLocales[m] = p;
    }
  }
  const incluye = Array.isArray(o.incluye) ? o.incluye.map((x) => texto(x, 80)).filter((x): x is string => !!x).slice(0, 8) : [];
  return {
    id, nombre, capa: capa as CapaId, precioUsd: usd, preciosLocales,
    resumen: texto(o.resumen, 140) ?? '', incluye, destacado: o.destacado === true, activo: o.activo !== false,
  };
}

/**
 * Los planes que valen: los del setting si trae al menos uno bueno (sin ids repetidos), y si no, los de hoy. Un
 * setting roto NO deja la página sin planes ni vende uno a medio escribir.
 */
export function planesDeSetting(crudo: string | null | undefined): PlanMako[] {
  if (crudo) {
    try {
      const v = JSON.parse(crudo) as unknown;
      const lista = Array.isArray(v) ? v : [];
      const vistos = new Set<string>();
      const buenos: PlanMako[] = [];
      for (const x of lista) {
        const p = planValido(x);
        if (p && !vistos.has(p.id)) { vistos.add(p.id); buenos.push(p); }
      }
      if (buenos.length) return buenos;
    } catch { /* setting roto: los de hoy */ }
  }
  return PLANES_MAKO_DEFAULT.map((p) => ({ ...p, preciosLocales: { ...p.preciosLocales }, incluye: [...p.incluye] }));
}

/** El precio del plan en la moneda que cobra la pasarela: USD en Stripe, la del sitio en Mercado Pago. null = no se ofrece. */
export function precioEn(plan: PlanMako, moneda: string): number | null {
  const m = moneda.toUpperCase();
  if (m === 'USD') return plan.precioUsd;
  return plan.preciosLocales[m] ?? null;
}

/** El concepto del cobro (lo ve el comprador en el checkout y en su resumen de tarjeta). */
export const conceptoDelPlan = (plan: PlanMako): string => `${plan.nombre} · mensual`;
