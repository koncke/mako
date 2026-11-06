// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN.
// =============================================================================
// Admin › Billing — lo que la pantalla de finanzas de Studio Admin (dashboard/finance) dice con los cobros de MaKo (6/11/2026)
// =============================================================================
// Sin `'use client'` ni `server-only`: lo ejecutan los tests. Las cuentas son las de siempre (lib/admin-ingresos-reglas.ts,
// `calcularIngresos`, y los cobros de app/admin/cobros/actions.ts); acá sólo se decide qué va en cada pieza de Studio:
//   · las cuatro cifras de arriba (Net worth, Available cash, Monthly spend, Savings rate) → lo cobrado este mes, el MRR, lo
//     que vence en 31 días y lo atrasado;
//   · «Income sources» → cómo entra la plata (todos los meses o una vez);
//   · el aviso (la tarjeta del puntaje de crédito) → lo que más espera a Martín, o nada;
//   · «Spending Overview» → lo cobrado (la línea llena) y lo que vence (la punteada: todavía no se midió);
//   · «Account Allocation» → por dónde entró (Stripe, Mercado Pago, Binance…);
//   · «Wallet» → las pasarelas conectadas y los otros medios por los que entró plata;
//   · «Upcoming Bills & Payments» → lo que vence en 31 días.

import type { Entrada, Ingresos, PorCobrar } from '@/lib/admin-ingresos-reglas';
import { NOMBRE_PASARELA, esPasarela, type Pasarela } from '@/lib/cobros-tipos';
import { ROTULO_MEDIO, esMedio } from '@/lib/recibos-reglas';
import { cambioPct } from '../ingresos/ingresos-vista';
import { rutaCliente } from '../ingresos/revenue-vista';

const DIA_MS = 86_400_000;
const r2 = (n: number): number => Math.round(n * 100) / 100;

/** «US$ 1.250» (con centavos sólo si los hay). */
export const usd = (n: number): string => `US$ ${n.toLocaleString('es-AR', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;

/** El nombre de un medio de pago como lo lee una persona: la pasarela, el medio del recibo, o el texto tal cual. */
export function nombreMedio(m: string | null): string {
  if (!m) return 'Sin medio';
  if (esPasarela(m)) return NOMBRE_PASARELA[m];
  if (esMedio(m)) return ROTULO_MEDIO[m];
  return m.charAt(0).toUpperCase() + m.slice(1);
}

// ── Las cuatro cifras ─────────────────────────────────────────────────────────────────────────────────────────────

export type Cifra = { id: 'mes' | 'mrr' | 'vence' | 'atrasado'; titulo: string; valor: string; detalle: string; insignia: { texto: string; mala: boolean } | null };

export function cifrasDe(r: Pick<Ingresos, 'cobradoEsteMes' | 'cobradoMesPasado' | 'mrr' | 'mrrMesPasado' | 'porCobrar'>): Cifra[] {
  const vence = r.porCobrar.filter((p) => !p.atrasado);
  const atrasado = r.porCobrar.filter((p) => p.atrasado);
  const venceUsd = r2(vence.reduce((a, p) => a + p.usd, 0));
  const atrasadoUsd = r2(atrasado.reduce((a, p) => a + p.usd, 0));
  const pct = cambioPct(r.mrr, r.mrrMesPasado);
  const clientes = (n: number) => (n === 1 ? '1 cliente' : `${n} clientes`);
  return [
    // Sin insignia: el mes en curso está a medias, y un % contra el pasado mentiría.
    { id: 'mes', titulo: 'Cobrado este mes', valor: usd(r.cobradoEsteMes), detalle: `El mes pasado: ${usd(r.cobradoMesPasado)}`, insignia: null },
    {
      id: 'mrr', titulo: 'MRR', valor: usd(r.mrr),
      detalle: r.mrrMesPasado > 0 ? `Hace un mes: ${usd(r.mrrMesPasado)}` : 'Lo que pagan por mes hoy',
      insignia: pct != null && pct !== 0 ? { texto: `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`, mala: pct < 0 } : null,
    },
    { id: 'vence', titulo: 'Vence en 31 días', valor: usd(venceUsd), detalle: vence.length ? `${clientes(vence.length)} por cobrar` : 'Nada por vencer', insignia: null },
    {
      id: 'atrasado', titulo: 'Atrasado', valor: usd(atrasadoUsd), detalle: atrasado.length ? `${clientes(atrasado.length)} pasados de su fecha` : 'Nadie atrasado',
      insignia: atrasado.length ? { texto: String(atrasado.length), mala: true } : null,
    },
  ];
}

// ── Los períodos y los repartos ──────────────────────────────────────────────────────────────────────────────────

export const PERIODOS = [
  { id: 'mes', rotulo: 'Este mes' },
  { id: '3m', rotulo: '3 meses' },
  { id: '12m', rotulo: '12 meses' },
  { id: 'todo', rotulo: 'Desde siempre' },
] as const;
export type PeriodoId = (typeof PERIODOS)[number]['id'];

/** El primer día que entra en el período (inclusive), o null para «desde siempre». */
export function desdeDe(periodo: PeriodoId, hoy: string): string | null {
  const [y, m] = hoy.split('-').map(Number);
  const primero = (yy: number, mm: number) => new Date(Date.UTC(yy, mm - 1, 1)).toISOString().slice(0, 10);
  if (periodo === 'mes') return primero(y, m);
  if (periodo === '3m') return primero(y, m - 2);
  if (periodo === '12m') return primero(y, m - 11);
  return null;
}

const enPeriodo = (e: Entrada, desde: string | null, hoy: string) => e.usd != null && e.fecha <= hoy && (desde == null || e.fecha >= desde);

export type Porcion = { id: string; rotulo: string; usd: number; pct: number };

function porciones(grupos: Map<string, { rotulo: string; usd: number }>, max: number): Porcion[] {
  const total = [...grupos.values()].reduce((a, g) => a + g.usd, 0);
  const lista = [...grupos.entries()].map(([id, g]) => ({ id, rotulo: g.rotulo, usd: r2(g.usd) })).filter((g) => g.usd > 0).sort((a, b) => b.usd - a.usd);
  const visibles = lista.length > max ? lista.slice(0, max - 1) : lista;
  if (lista.length > max) visibles.push({ id: 'otros', rotulo: 'Otros', usd: r2(lista.slice(max - 1).reduce((a, g) => a + g.usd, 0)) });
  return visibles.map((g) => ({ ...g, pct: total > 0 ? Math.round((g.usd / total) * 1000) / 10 : 0 }));
}

/** «Income sources» de Studio: lo que entró todos los meses (una suscripción) y lo que entró una vez. */
export function comoEntra(entradas: readonly Entrada[], desde: string | null, hoy: string): Porcion[] {
  const g = new Map<string, { rotulo: string; usd: number }>();
  for (const e of entradas) {
    if (!enPeriodo(e, desde, hoy)) continue;
    const id = e.recurrente ? 'recurrente' : 'unico';
    const x = g.get(id) ?? { rotulo: e.recurrente ? 'Todos los meses' : 'Una vez', usd: 0 };
    x.usd += e.usd ?? 0;
    g.set(id, x);
  }
  return porciones(g, 3);
}

/** «Account Allocation» de Studio: por dónde entró (cuatro porciones; el resto, «Otros»). */
export function porMedio(entradas: readonly Entrada[], desde: string | null, hoy: string): Porcion[] {
  const g = new Map<string, { rotulo: string; usd: number }>();
  for (const e of entradas) {
    if (!enPeriodo(e, desde, hoy)) continue;
    const id = e.medio ?? 'sin-medio';
    const x = g.get(id) ?? { rotulo: nombreMedio(e.medio), usd: 0 };
    x.usd += e.usd ?? 0;
    g.set(id, x);
  }
  return porciones(g, 4);
}

// ── La línea de lo cobrado y lo que vence ───────────────────────────────────────────────────────────────────────────

export const RANGOS = [
  { id: 'semana', rotulo: 'Semana' },
  { id: 'mes', rotulo: 'Mes' },
  { id: 'anio', rotulo: 'Año' },
] as const;
export type RangoId = (typeof RANGOS)[number]['id'];

/** Un punto por día (o por mes, en «Año»). `cobrado` hasta hoy; `vence` de hoy en adelante (la línea punteada). */
export type Punto = { t: number; rotulo: string; cobrado?: number; vence?: number };

const msDe = (dia: string) => Date.parse(`${dia}T00:00:00Z`);
const diaDe = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

export function serieDe(entradas: readonly Entrada[], porCobrar: readonly PorCobrar[], rango: RangoId, hoy: string): Punto[] {
  const hoyMs = msDe(hoy);
  if (rango === 'anio') {
    // Doce meses hacia atrás y el que viene (lo que vence en 31 días cae ahí o en éste).
    const [y, m] = hoy.split('-').map(Number);
    const meses = Array.from({ length: 13 }, (_, i) => new Date(Date.UTC(y, m - 12 + i, 1)).toISOString().slice(0, 7));
    const actual = hoy.slice(0, 7);
    return meses.map((mes) => {
      const cobrado = r2(entradas.filter((e) => e.usd != null && e.fecha <= hoy && e.fecha.startsWith(mes)).reduce((a, e) => a + (e.usd ?? 0), 0));
      const vence = r2(porCobrar.filter((p) => !p.atrasado && p.fecha.startsWith(mes)).reduce((a, p) => a + p.usd, 0));
      const [yy, mm] = mes.split('-').map(Number);
      return {
        t: Date.UTC(yy, mm - 1, 1), rotulo: `${MES_CORTO[mm - 1]}${yy !== y ? ` ${yy}` : ''}`,
        ...(mes <= actual ? { cobrado } : {}),
        ...(mes >= actual ? { vence } : {}),
      };
    });
  }
  const atras = rango === 'semana' ? 6 : 29;
  const adelante = rango === 'semana' ? 7 : 30;
  const puntos: Punto[] = [];
  for (let d = -atras; d <= adelante; d++) {
    const ms = hoyMs + d * DIA_MS;
    const dia = diaDe(ms);
    const cobrado = r2(entradas.filter((e) => e.usd != null && e.fecha === dia).reduce((a, e) => a + (e.usd ?? 0), 0));
    const vence = r2(porCobrar.filter((p) => !p.atrasado && p.fecha === dia).reduce((a, p) => a + p.usd, 0));
    const [, mm, dd] = dia.split('-').map(Number);
    puntos.push({
      t: ms, rotulo: `${dd} ${MES_CORTO[mm - 1]}`,
      ...(d <= 0 ? { cobrado } : {}),
      // La punteada arranca en hoy, para que siga a la llena sin un hueco.
      ...(d === 0 ? { vence: cobrado } : d > 0 ? { vence } : {}),
    });
  }
  return puntos;
}

// ── Lo que vence ────────────────────────────────────────────────────────────────────────────────────────────────────

export type Proximo = { clave: string; nombre: string; fecha: string; usd: number; atrasado: boolean; ruta: string | null };

/** Lo que vence en 31 días y lo atrasado, lo atrasado primero, con el nombre y la ficha de cada cliente. */
export function proximosDe(r: Pick<Ingresos, 'porCobrar' | 'clientes'>): Proximo[] {
  const quien = new Map(r.clientes.map((c) => [c.clave, c]));
  return [...r.porCobrar]
    .sort((a, b) => (a.atrasado !== b.atrasado ? (a.atrasado ? -1 : 1) : a.fecha.localeCompare(b.fecha)))
    .map((p) => {
      const c = quien.get(p.cliente);
      return { clave: p.cliente, nombre: c?.nombre ?? p.cliente, fecha: p.fecha, usd: p.usd, atrasado: p.atrasado, ruta: c ? rutaCliente(c) : null };
    });
}

// ── El aviso ────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Aviso = { id: 'sin-pasarela' | 'alta' | 'atrasado'; titulo: string; detalle: string; accion: string; href: string };

/**
 * Lo que más espera a Martín, de a uno: sin pasarela no se vende nada; una cuenta que no se creó deja a alguien que pagó sin
 * entrar; lo atrasado es plata que falta. Si no hay nada, no hay aviso (Studio siempre muestra uno; acá no se inventa).
 */
export function avisoDe(o: {
  pasarelas: readonly Pasarela[];
  cobros: ReadonlyArray<{ estado: string; alta_estado: string | null }>;
  porCobrar: readonly PorCobrar[];
  wsPlataforma: number;
}): Aviso | null {
  if (o.pasarelas.length === 0) {
    return { id: 'sin-pasarela', titulo: 'Conecta Stripe o Mercado Pago', detalle: 'Es la cuenta de MaKo: con ella se cobran los planes.', accion: 'Ir a Integraciones', href: `/integraciones?ws=${o.wsPlataforma}` };
  }
  const sinCuenta = o.cobros.filter((c) => c.estado === 'pagado' && (c.alta_estado === 'error' || c.alta_estado === 'ya_tenia_cuenta')).length;
  if (sinCuenta > 0) {
    return {
      id: 'alta', titulo: sinCuenta === 1 ? 'Una cuenta no se creó' : `${sinCuenta} cuentas no se crearon`,
      detalle: 'Pagaron y no tienen su cuenta de MaKo. Se resuelve en Cobros.', accion: 'Ver cobros', href: '/admin?tab=billing&vista=cobros',
    };
  }
  const atrasados = o.porCobrar.filter((p) => p.atrasado);
  if (atrasados.length > 0) {
    const total = r2(atrasados.reduce((a, p) => a + p.usd, 0));
    return {
      id: 'atrasado', titulo: atrasados.length === 1 ? 'Un cliente está atrasado' : `${atrasados.length} clientes están atrasados`,
      detalle: `Suman ${usd(total)}.`, accion: 'Ver clientes', href: '/admin?tab=revenue',
    };
  }
  return null;
}

/** «jueves, 6 de noviembre de 2026», en la zona de la plataforma (la cabecera de Studio lleva la fecha de hoy). */
export function fechaLarga(ahora: Date, tz: string): string {
  return new Intl.DateTimeFormat('es-AR', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(ahora);
}

/** «5 nov 2026» de una fecha AAAA-MM-DD. */
export function fechaCorta(dia: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dia ?? '');
  return m ? `${Number(m[3])} ${MES_CORTO[Number(m[2]) - 1] ?? ''} ${m[1]}` : '—';
}
