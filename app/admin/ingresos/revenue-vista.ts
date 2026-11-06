// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN.
// =============================================================================
// Admin › Revenue — lo que la pantalla de Studio Admin (dashboard/default) dice con los números de MaKo (5/11/2026)
// =============================================================================
// Sin `'use client'` ni `server-only`: lo ejecutan los tests. Las cuentas son las de siempre (lib/admin-ingresos-reglas.ts,
// `calcularIngresos`); acá sólo se decide qué va en cada pieza de Studio:
//   · las cuatro tarjetas (Total Revenue, New Customers, Active Accounts, Growth Rate de Studio) → lo cobrado en total, los
//     clientes nuevos del mes, los que pagan hoy y el MRR con su crecimiento;
//   · «Customer Activity» → por mes: lo cobrado (el área), el MRR y el MRR nuevo (las dos líneas);
//   · la tabla de clientes → cada cliente con Estado (su suscripción), Cobro (si está al día), Plan (lo que paga por mes) y
//     Alta (su primer pago).

import { ROTULO_ESTADO_CLIENTE, type ClienteResumen, type Ingresos, type MesIngresos } from '@/lib/admin-ingresos-reglas';
import { cambioPct } from './ingresos-vista';

/** A dónde lleva un cliente: su ficha de negocio si tiene cuenta, si no su ficha del CRM de la plataforma. */
export const rutaCliente = (c: { ws: number | null; leadId: number | null }): string | null =>
  c.ws != null ? `/admin?tab=customers&cliente=${c.ws}` : c.leadId != null ? `/crm/${c.leadId}` : null;

/** Una tarjeta de arriba. `cambio` es la insignia de Studio (con su flecha); sin contra qué comparar, no se dibuja. */
export type Tarjeta = { id: 'cobrado' | 'nuevos' | 'pagando' | 'mrr'; titulo: string; valor: string; cambio: { texto: string; sube: boolean } | null; nota: string };

const usdCorto = (n: number): string => `US$ ${n.toLocaleString('es-AR', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;
const conSigno = (n: number, txt: string): string => `${n > 0 ? '+' : n < 0 ? '−' : ''}${txt}`;

/** Los clientes nuevos (o que volvieron) de un mes: los movimientos «nuevo» y «vuelve». */
export function nuevosDelMes(r: Pick<Ingresos, 'movimientos'>, mes: string): number {
  return new Set(r.movimientos.filter((m) => m.fecha.startsWith(mes) && (m.tipo === 'nuevo' || m.tipo === 'vuelve')).map((m) => m.cliente)).size;
}

export function tarjetasDe(r: Ingresos): Tarjeta[] {
  const mes = r.hoy.slice(0, 7);
  const anterior = r.meses.length >= 2 ? r.meses[r.meses.length - 2].mes : null;
  const nuevos = nuevosDelMes(r, mes);
  const nuevosAntes = anterior ? nuevosDelMes(r, anterior) : 0;
  const pct = cambioPct(r.mrr, r.mrrMesPasado);
  return [
    {
      id: 'cobrado', titulo: 'Cobrado en total', valor: usdCorto(r.cobradoTotal),
      cambio: r.cobradoEsteMes > 0 ? { texto: `+${usdCorto(r.cobradoEsteMes)}`, sube: true } : null,
      // La insignia es lo que entró este mes (el mes en curso está a medias: un % contra el pasado mentiría).
      nota: 'Desde el primer pago',
    },
    {
      id: 'nuevos', titulo: 'Clientes nuevos', valor: String(nuevos),
      cambio: nuevos !== nuevosAntes ? { texto: conSigno(nuevos - nuevosAntes, String(Math.abs(nuevos - nuevosAntes))), sube: nuevos >= nuevosAntes } : null,
      nota: 'Este mes, contra el pasado',
    },
    {
      id: 'pagando', titulo: 'Clientes pagando', valor: String(r.pagando), cambio: null,
      nota: r.arpu != null ? `${usdCorto(r.arpu)} por mes cada uno` : 'Ninguno con una suscripción viva',
    },
    {
      id: 'mrr', titulo: 'MRR', valor: usdCorto(r.mrr),
      cambio: pct != null && pct !== 0 ? { texto: `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`, sube: pct > 0 } : null,
      nota: r.mrrMesPasado > 0 ? `Al cerrar el mes pasado: ${usdCorto(r.mrrMesPasado)}` : 'Lo que pagan por mes hoy',
    },
  ];
}

/** Un punto del gráfico «Customer Activity»: un mes. */
export type PuntoActividad = { mes: string; cobrado: number; mrr: number; nuevoMrr: number };

export const puntosDe = (meses: readonly MesIngresos[]): PuntoActividad[] =>
  meses.map((m) => ({ mes: m.mes, cobrado: m.cobrado, mrr: m.mrr, nuevoMrr: Math.round((m.nuevo + m.vuelve + m.sube) * 100) / 100 }));

// ── La tabla de clientes (recent-customers-table de Studio) ──────────────────────────────────────────────────────────

export const ESTADOS_SUSCRIPCION = ['Suscrito', 'Se cortó', 'Pago único'] as const;
export const ESTADOS_COBRO = ['Al día', 'Por vencer', 'Atrasado', 'Pagado', 'Sin cobro'] as const;
export type EstadoCobro = (typeof ESTADOS_COBRO)[number];

export type FilaCliente = {
  id: string;
  /** Lo que va debajo del nombre (el «#18425» de Studio): de qué negocio es, o que no tiene cuenta. */
  ref: string;
  name: string;
  ruta: string | null;
  status: (typeof ESTADOS_SUSCRIPCION)[number];
  billing: EstadoCobro;
  /** «US$ 144 / mes», o «—» sin suscripción. */
  plan: string;
  /** Lo que pagó desde siempre. */
  total: string;
  mrr: number;
  totalUsd: number;
  /** El primer pago (YYYY-MM-DD) y el último. */
  joined: string;
  ultimo: string | null;
  diasAtraso: number | null;
};

export function filaDeCliente(c: ClienteResumen): FilaCliente | null {
  if (!c.primerPago) return null;
  const status = c.estado === 'cortado' ? 'Se cortó' : c.estado === 'pago-unico' ? 'Pago único' : 'Suscrito';
  const billing: EstadoCobro = c.estado === 'cortado' ? 'Sin cobro' : c.estado === 'pago-unico' ? 'Pagado' : (ROTULO_ESTADO_CLIENTE[c.estado].rotulo as EstadoCobro);
  return {
    id: c.clave,
    ref: c.ws != null ? `ws ${c.ws}` : 'sin cuenta en MaKo',
    name: c.nombre,
    ruta: rutaCliente(c),
    status, billing,
    plan: c.mrr > 0 ? `${usdCorto(c.mrr)} / mes` : '—',
    total: usdCorto(c.total),
    mrr: c.mrr, totalUsd: c.total,
    joined: c.primerPago, ultimo: c.ultimoPago,
    diasAtraso: c.estado === 'atrasado' ? c.diasAtraso : null,
  };
}

export const filasDeClientes = (clientes: readonly ClienteResumen[]): FilaCliente[] =>
  clientes.map(filaDeCliente).filter((f): f is FilaCliente => f != null);
