// =============================================================================
// Media Buyer — el arranque como una charla con MaKo, igual que Offer (PURO: lo prueban los tests)
// =============================================================================
// Martín, 25/10/2026 ~18:50: «en el onboarding, me imagino a la calculadora que hicimos para saber cuanto invertir, todo con
// el chat de MaKo, como Offer». Una cuenta nueva no ve números en cero: ve esta charla. MaKo pregunta UNA cosa por vez, con
// respuestas rápidas (las pastillas de Offer), y sólo lo que falta: conectar la cuenta, qué vende (los productos del CRM),
// qué cuenta como resultado, cuánto vale una venta, cuánto cuesta hoy un resultado, cuánto invertir (con la tarjeta de la
// calculadora, lib/calculadora-presupuesto-ads.ts) y cómo quiere que trabaje. Al terminar guarda la config y mira la cuenta.
//
// ⚠️ NINGÚN NÚMERO INVENTADO COMO SI FUERA DEL CLIENTE (la regla de la calculadora, 24/10/2026): el costo por resultado sale
//    de sus anuncios si hay con qué medirlo (`deTusAnuncios`); si no, la persona lo escribe o elige el SUPUESTO, que se dice
//    como supuesto («uso US$ 5 para empezar»), nunca como su dato.
// Los mensajes tienen la forma de los de Offer (`OfferMensaje`) para que el hilo sea el mismo (`itemsDeOffer` → HiloMako).
// =============================================================================

import type { OfferMensaje } from '@/lib/offer-marco';
import type { EntradaCalculadora, PlanCalculadora } from '@/lib/calculadora-presupuesto-ads';
import { montoDelTexto } from './monto';
import type { ConfigMediaBuyer, KpiMediaBuyer } from './tipos';
import { fmtDinero } from '@/lib/format';

export type ProductoArranque = { id: string | null; nombre: string; precio: number | null };

export type RespuestasArranque = {
  /** El producto que vende con los anuncios (un funnel del CRM), o «varios»: se reparten en el lienzo. */
  producto?: ProductoArranque | 'varios';
  kpi?: KpiMediaBuyer;
  /** Lo que deja una venta, en US$. */
  ticket?: number;
  /** Lo que cuesta hoy un resultado, en US$; `supuesto` si lo eligió sin saberlo. */
  costo?: { valor: number; supuesto: boolean };
  /** Lo que quiere invertir por mes, en US$. */
  inversionMes?: number;
  /** Aceptó el plan de la calculadora. */
  plan?: true;
  modo?: 'propone' | 'piloto';
};

export type PasoArranque = 'cuenta' | 'producto' | 'resultado' | 'ticket' | 'costo' | 'inversion' | 'plan' | 'modo' | 'listo';

/** El costo por resultado que se usa si la persona no lo sabe: se dice como supuesto. */
export const COSTO_SUPUESTO: Record<KpiMediaBuyer, number> = { lead: 5, agenda: 25, venta: 60 };
export const INVERSIONES = [300, 600, 1000, 2000] as const;

const us = (n: number) => fmtDinero(n);
const RESULTADO: Record<KpiMediaBuyer, { uno: string; varios: string }> = {
  lead: { uno: 'lead', varios: 'leads' }, agenda: { uno: 'agenda', varios: 'agendas' }, venta: { uno: 'venta', varios: 'ventas' },
};

/** El paso que toca: el primero que falta. Con UN producto en el CRM, no se pregunta cuál. */
export function pasoDeArranque(x: { conectada: boolean; r: RespuestasArranque; productos: readonly ProductoArranque[]; costoMedido: number | null; pilotoPermitido?: boolean }): PasoArranque {
  const { r } = x;
  if (!x.conectada) return 'cuenta';
  if (!r.producto && x.productos.length > 1) return 'producto';
  if (!r.kpi) return 'resultado';
  if (r.ticket == null) return 'ticket';
  if (!r.costo && x.costoMedido == null) return 'costo';
  if (r.inversionMes == null) return 'inversion';
  if (!r.plan) return 'plan';
  // Un «piloto» guardado en un plan sin piloto vuelve a preguntar el modo (la charla quedaba trabada en «listo» con el Media
  // Buyer apagado; revisión de tren-l, falla 6).
  if (!r.modo || (r.modo === 'piloto' && x.pilotoPermitido === false)) return 'modo';
  return 'listo';
}

/** Las respuestas rápidas de cada paso (lo que se toca). El número también se puede escribir en la caja. */
export function opcionesDe(paso: PasoArranque, x: { productos: readonly ProductoArranque[]; r: RespuestasArranque; costoMedido: number | null; pilotoPermitido?: boolean }): string[] {
  switch (paso) {
    case 'producto': return [...x.productos.slice(0, 5).map((p) => p.nombre), 'Varios a la vez'];
    case 'resultado': return ['Leads', 'Agendas', 'Ventas'];
    case 'ticket': {
      const p = productoDe(x);
      return p?.precio ? [us(p.precio)] : [];
    }
    case 'costo': return [`No sé, usa ${us(COSTO_SUPUESTO[x.r.kpi ?? 'lead'])} para empezar`];
    case 'inversion': return INVERSIONES.map((n) => `${us(n)} al mes`);
    case 'plan': return ['Así está bien', 'Probar con otro monto'];
    case 'modo': return x.pilotoPermitido === false ? ['Te propongo y tú apruebas'] : ['Te propongo y tú apruebas', 'Piloto automático, dentro de tus topes'];
    default: return [];
  }
}

const productoDe = (x: { productos: readonly ProductoArranque[]; r: RespuestasArranque }): ProductoArranque | null =>
  x.r.producto && x.r.producto !== 'varios' ? x.r.producto : x.productos.length === 1 ? x.productos[0] : null;

/** Lo que pregunta MaKo en cada paso. */
export function preguntaDe(paso: PasoArranque, x: { nombre: string; productos: readonly ProductoArranque[]; r: RespuestasArranque }): string {
  const res = RESULTADO[x.r.kpi ?? 'lead'];
  const p = productoDe(x);
  switch (paso) {
    case 'cuenta': return `Hola, ${x.nombre}. Empecemos por tu cuenta de Meta: conéctala y la miro.`;
    case 'producto': return '¿Qué vendes con tus anuncios?';
    case 'resultado': return `¿Qué cuenta como resultado para ${p ? `«${p.nombre}»` : 'ti'}?`;
    case 'ticket': return x.r.kpi === 'venta' || !p?.precio ? '¿Cuánto te deja una venta, en dólares?' : `¿Cuánto te deja una venta de «${p.nombre}»?`;
    case 'costo': return `¿Cuánto te cuesta hoy un ${res.uno}? Si no lo sabes, empiezo con un supuesto y lo ajusto con tus datos.`;
    case 'inversion': return '¿Cuánto quieres invertir en anuncios por mes?';
    case 'plan': return 'Con esos números, así lo invertiría:';
    case 'modo': return '¿Cómo quieres que trabaje?';
    case 'listo': return 'Listo. Ya estoy mirando tu cuenta: en un momento te muestro lo primero que haría.';
  }
}

/** Lo que dijo la persona en cada paso, como su mensaje en el hilo. */
function respuestaDe(paso: PasoArranque, r: RespuestasArranque): string | null {
  switch (paso) {
    case 'producto': return r.producto ? (r.producto === 'varios' ? 'Varios a la vez' : r.producto.nombre) : null;
    case 'resultado': return r.kpi ? { lead: 'Leads', agenda: 'Agendas', venta: 'Ventas' }[r.kpi] : null;
    case 'ticket': return r.ticket != null ? us(r.ticket) : null;
    case 'costo': return r.costo ? (r.costo.supuesto ? `No sé, usa ${us(r.costo.valor)} para empezar` : us(r.costo.valor)) : null;
    case 'inversion': return r.inversionMes != null ? `${us(r.inversionMes)} al mes` : null;
    case 'plan': return r.plan ? 'Así está bien' : null;
    case 'modo': return r.modo ? (r.modo === 'piloto' ? 'Piloto automático, dentro de tus topes' : 'Te propongo y tú apruebas') : null;
    default: return null;
  }
}

const ORDEN: PasoArranque[] = ['cuenta', 'producto', 'resultado', 'ticket', 'costo', 'inversion', 'plan', 'modo', 'listo'];

/** Los cuatro tramos que se ven arriba de la charla (Adzooma: «tres pasos» en una cuenta nueva). */
export const TRAMOS = ['Cuenta', 'Producto', 'Presupuesto', 'Listo'] as const;
export function tramoDe(paso: PasoArranque): number {
  if (paso === 'cuenta') return 0;
  if (paso === 'producto' || paso === 'resultado' || paso === 'ticket' || paso === 'costo') return 1;
  if (paso === 'inversion' || paso === 'plan') return 2;
  return 3;
}

/**
 * La charla hasta el paso de hoy: cada pregunta de MaKo con la respuesta que ya dio la persona, y la pregunta que toca con
 * sus opciones. Los pasos que se saltean (un solo producto, el costo medido) no aparecen. Sin hora: el hilo no la necesita.
 */
export function mensajesDeArranque(x: { nombre: string; conectada: boolean; r: RespuestasArranque; productos: readonly ProductoArranque[]; costoMedido: number | null; pilotoPermitido?: boolean }): OfferMensaje[] {
  const actual = pasoDeArranque(x);
  const out: OfferMensaje[] = [];
  for (const paso of ORDEN) {
    const saltea = (paso === 'producto' && x.productos.length <= 1) || (paso === 'costo' && x.costoMedido != null && !x.r.costo);
    if (saltea) continue;
    const esActual = paso === actual;
    out.push({ id: `mb-${paso}`, de: 'mako', texto: preguntaDe(paso, x), at: '', ...(esActual ? { opciones: opcionesDe(paso, x) } : {}) });
    if (esActual) break;
    const dijo = paso === 'cuenta' ? null : respuestaDe(paso, x.r);
    if (dijo) out.push({ id: `mb-${paso}-r`, de: 'yo', texto: dijo, at: '' });
  }
  return out;
}

/** Lo que la persona eligió, leído del texto de la pastilla o de lo que escribió en la caja. null = no se entendió. */
export function leerRespuesta(paso: PasoArranque, texto: string, x: { productos: readonly ProductoArranque[]; r: RespuestasArranque; costoMedido: number | null; pilotoPermitido?: boolean }): Partial<RespuestasArranque> | null {
  const t = texto.trim();
  // «$1,000 al mes» es mil (las pastillas salen de fmtDinero): antes se leía 1 y quedaba un tope de 1 por día.
  const num = montoDelTexto(t);
  switch (paso) {
    case 'producto': {
      if (/varios/i.test(t)) return { producto: 'varios' };
      const p = x.productos.find((y) => y.nombre.toLowerCase() === t.toLowerCase());
      return p ? { producto: p } : null;
    }
    case 'resultado': {
      if (/^lead/i.test(t)) return { kpi: 'lead' };
      if (/^agenda/i.test(t)) return { kpi: 'agenda' };
      if (/^venta/i.test(t)) return { kpi: 'venta' };
      return null;
    }
    case 'ticket': return num && num > 0 ? { ticket: num } : null;
    case 'costo':
      if (/no s[eé]/i.test(t)) return { costo: { valor: COSTO_SUPUESTO[x.r.kpi ?? 'lead'], supuesto: true } };
      return num && num > 0 ? { costo: { valor: num, supuesto: false } } : null;
    case 'inversion': return num && num > 0 ? { inversionMes: num } : null;
    case 'plan':
      if (/así está bien|asi esta bien/i.test(t)) return { plan: true };
      if (/otro monto/i.test(t)) return { inversionMes: undefined, plan: undefined };
      return null;
    case 'modo':
      if (/piloto/i.test(t)) return x.pilotoPermitido === false ? null : { modo: 'piloto' };
      if (/propon/i.test(t)) return { modo: 'propone' };
      return null;
    default: return null;
  }
}

/** La entrada de la calculadora con lo que respondió (30 días). null mientras falte algo. */
export function entradaDelArranque(r: RespuestasArranque, costoMedido: number | null, cierreMedido: number | null, avatares: number, funcionalidades: number): EntradaCalculadora | null {
  const costo = r.costo?.valor ?? costoMedido;
  if (!r.kpi || r.ticket == null || costo == null || r.inversionMes == null) return null;
  return {
    presupuesto: r.inversionMes, dias: 30, costoPorResultado: costo, evento: r.kpi === 'venta' ? 'venta' : 'lead', ticket: r.ticket,
    ...(r.kpi === 'venta' ? {} : { cierre: cierreMedido ?? 10 }),
    avatares: Math.max(1, avatares), funcionalidades: Math.max(1, funcionalidades),
  };
}

/** Lo que se guarda al terminar: el resultado, el modo, el tope diario de la cuenta y las metas del mes del plan. */
export function configDelArranque(r: RespuestasArranque, plan: PlanCalculadora | null): Partial<ConfigMediaBuyer> {
  const diario = r.inversionMes != null ? Math.ceil(r.inversionMes / 30) : null;
  return {
    encendido: true,
    modo: r.modo ?? 'propone',
    ...(r.kpi ? { kpi: r.kpi } : {}),
    ...(diario ? { presupuestoMaxDia: diario } : {}),
    ...(r.inversionMes != null ? { metaGastoMes: r.inversionMes } : {}),
    ...(plan && plan.facturacion > 0 ? { metaVentasMes: Math.round(plan.facturacion) } : {}),
  };
}

/** Lo que llega del navegador, sólo con lo que se conoce y con su forma: lo demás se descarta. */
export function sanearRespuestas(x: unknown): RespuestasArranque {
  const o = (x && typeof x === 'object' && !Array.isArray(x) ? x : {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 1e9 ? Math.round(v * 100) / 100 : undefined);
  const out: RespuestasArranque = {};
  const p = o.producto;
  if (p === 'varios') out.producto = 'varios';
  else if (p && typeof p === 'object') {
    const q = p as Record<string, unknown>;
    if (typeof q.nombre === 'string' && q.nombre.trim()) out.producto = { id: typeof q.id === 'string' ? q.id.slice(0, 40) : null, nombre: q.nombre.trim().slice(0, 120), precio: num(q.precio) ?? null };
  }
  if (o.kpi === 'lead' || o.kpi === 'agenda' || o.kpi === 'venta') out.kpi = o.kpi;
  if (num(o.ticket)) out.ticket = num(o.ticket);
  const c = o.costo as Record<string, unknown> | undefined;
  if (c && typeof c === 'object' && num(c.valor)) out.costo = { valor: num(c.valor)!, supuesto: c.supuesto === true };
  if (num(o.inversionMes)) out.inversionMes = num(o.inversionMes);
  if (o.plan === true) out.plan = true;
  if (o.modo === 'propone' || o.modo === 'piloto') out.modo = o.modo;
  return out;
}
