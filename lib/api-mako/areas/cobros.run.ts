// =============================================================================
// api-mako/areas/cobros.run — los cuerpos del área `cobros` (la pasarela de pagos)
// =============================================================================
// Un runner por id de cobros.def.ts. Lecturas: { leer }. Acciones: { preparar, ejecutar }.
// Todo corre adentro de runWithWorkspace(ctx.ws) (lo pone ejecutarOperacion), y las
// funciones de lib/cobros.ts reciben el ws EXPLÍCITO: ninguna cae al ws1.
//
// ⚠️ NADA DE PROVEEDORES ACÁ. Stripe y Mercado Pago viven en lib/cobros.ts (el ÚNICO escritor
// de `cobros`) y en sus clientes (lib/stripe-api.ts, lib/mercadopago-api.ts); las claves se leen
// con `credDelCliente` adentro de esa lib. Este archivo valida, arma el resumen y llama.
//
// ⚠️ EL LINK NO PASA POR EL MODELO. Ni las lecturas ni el `resumen` lo traen: va por
// `paraLaPersona` (el doer de WhatsApp lo agrega a su respuesta) y en `datos` (HTTP y un flujo).
// Confirmada desde la bandeja no hay canal para la persona: por eso el resumen dice dónde quedó
// (la ficha del lead, tab Pagos), que es verdad en los tres caminos.
//
// ⚠️ preparar() de una acción `pantalla` genérica NO puede lanzar (acciones.ts lo llama fuera de
// su try al confirmar en /mako/revisar): los «no existe» vuelven como { error }. Y ejecutar() no
// lanza nunca: `seguro()`. Lo que se puede saber sin escribir (el estado del cobro, la pasarela
// conectada) falla en preparar(), que corre otra vez al confirmar: confirmar RECLAMA antes de
// ejecutar, y un error en ejecutar() consume la pendiente.
// =============================================================================

import 'server-only';
import type { Ctx, Ejecutado, Runners, SalidaLectura } from '../tipos';
import { getLead } from '@/lib/leads';
import { listProductos } from '@/lib/productos';
import {
  anularCobro, cancelarSuscripcionCobro, crearCobro, getCobro, linkDelCobro, listarCobros, pasarelasConectadas, reembolsarCobro,
} from '@/lib/cobros';
import { ESTADOS_COBRO, NOMBRE_PASARELA, esPasarela, rotuloEstado, type Cobro, type EstadoCobro, type Pasarela } from '@/lib/cobros-tipos';
import { decidirCobro } from '@/lib/cobros-reglas';
import { formatoMonto } from '@/lib/pasarela-moneda';

// ── helpers del archivo ───────────────────────────────────────────────────────

const json = (o: unknown): string => JSON.stringify(o);
const fallo = (msg: string) => ({ content: msg, isError: true });
const autorDe = (ctx: Ctx): string => ctx.actor?.trim() || 'MaKo';
const n = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const s = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const noExisteCobro = (id: unknown) => `No existe el cobro #${String(id)} en este negocio. Pide listar_cobros para ver los del lead.`;
const quien = (c: Cobro): string => c.nombre?.trim() || (c.lead_id ? `el lead #${c.lead_id}` : 'quien paga');
const plata = (c: Cobro): string => `${formatoMonto(c.monto, c.moneda)}${c.tipo === 'suscripcion' ? ' por mes' : ''}`;

/** ejecutar() NUNCA lanza: si algo falla, ok:false con el motivo (la pendiente se
 *  resuelve y un «sí» repetido no la vuelve a correr). */
async function seguro(que: string, fn: () => Promise<Ejecutado>): Promise<Ejecutado> {
  try {
    return await fn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[api-mako cobros] ${que}:`, msg);
    return { ok: false, resumen: `No se pudo ${que} (${msg}).` };
  }
}

/** El cobro por id, en ESTE workspace, o null. No lanza (lo llama un preparar de pantalla). */
async function cobroDe(ws: number, id: unknown): Promise<Cobro | null> {
  const x = n(id);
  return x ? getCobro(ws, x).catch(() => null) : null;
}

/**
 * Qué se puede hacer con un cobro, con las MISMAS condiciones que aplica lib/cobros.ts al
 * ejecutar (`anularCobro`, `reembolsarCobro`, `cancelarSuscripcionCobro`): así el modelo no
 * propone lo que la lib va a rechazar.
 */
function accionesDe(c: Cobro): string[] {
  const out: string[] = [];
  if (c.estado === 'pendiente' || c.estado === 'fallido') out.push('anular_link_pago');
  if (c.estado === 'pagado' && c.proveedor_pago_id) out.push('reembolsar_cobro');
  if (c.tipo === 'suscripcion' && c.proveedor_suscripcion_id && c.suscripcion_estado !== 'cancelada') out.push('cancelar_suscripcion');
  return out;
}

/**
 * Lo que una lectura muestra de un cobro. SIN el token, el link ni la URL del proveedor (un link
 * que lee un modelo lo escribe el código; el checkout abre datos del cliente), sin el email de
 * quien paga y sin los ids del proveedor.
 */
function vistaDe(c: Cobro) {
  return {
    cobroId: c.id,
    leadId: c.lead_id,
    nombre: c.nombre,
    concepto: c.concepto,
    productoId: c.producto_id,
    // La cuota del CRM que salda, si salió de una (es el pagoId de cobranza_lead).
    cuotaId: c.pago_id,
    pasarela: NOMBRE_PASARELA[c.proveedor] ?? c.proveedor,
    prueba: c.modo === 'prueba',
    tipo: c.tipo === 'suscripcion' ? 'suscripción' : 'pago único',
    monto: c.monto,
    moneda: c.moneda,
    monto_texto: plata(c),
    monto_usd: c.monto_usd,
    estado: c.estado,
    estado_texto: rotuloEstado(c.estado),
    ...(c.tipo === 'suscripcion' ? { suscripcion: c.suscripcion_estado ?? 'sin arrancar' } : {}),
    creado: c.created_at,
    creado_por: c.creado_por,
    pagado: c.pagado_at,
    reembolsado: c.reembolsado_at,
    motivo: c.motivo,
    // Sólo en la cuenta de MaKo: el plan que se da de alta al pagar.
    ...(c.alta_capa ? { alta: { plan: c.alta_capa, estado: c.alta_estado, motivo: c.alta_motivo } } : {}),
    se_puede: accionesDe(c),
  };
}

/** El cobro, si su pasarela sigue conectada; si no, el error que lo dice. */
async function conPasarelaConectada(ws: number, c: Cobro): Promise<string | null> {
  const conectadas = await pasarelasConectadas(ws).catch(() => null);
  if (!conectadas) return 'No pude leer las pasarelas conectadas. Prueba de nuevo en un rato.';
  return conectadas.includes(c.proveedor) ? null : `${NOMBRE_PASARELA[c.proveedor]} ya no está conectado en Integraciones: reconéctalo para seguir.`;
}

// ── los runners ───────────────────────────────────────────────────────────────

export const RUNNERS: Runners = {
  listar_cobros: {
    leer: async (input, ctx): Promise<SalidaLectura> => {
      const leadId = n(input.leadId);
      const estado = ESTADOS_COBRO.includes(input.estado as EstadoCobro) ? (input.estado as EstadoCobro) : null;
      const limite = n(input.limite) ?? 30;
      if (leadId && !(await getLead(leadId).catch(() => null))) return fallo(`No existe el lead #${leadId} en este negocio. Búscalo con buscar_leads.`);
      const cobros = await listarCobros(ctx.ws, { leadId, estado, limite });
      return json({
        cobros: cobros.map(vistaDe),
        nota: cobros.length
          ? 'cobroId es el id que piden ver_cobro, anular_link_pago, reembolsar_cobro y cancelar_suscripcion. Un cobro no es una cuota del CRM (cobranza_lead). El link de pago no sale aquí: lo tiene la ficha del lead.'
          : (leadId ? 'Ese lead no tiene cobros por Stripe ni Mercado Pago.' : 'Todavía no hay cobros por Stripe ni Mercado Pago.'),
      });
    },
  },
  ver_cobro: {
    leer: async (input, ctx): Promise<SalidaLectura> => {
      const c = await cobroDe(ctx.ws, input.cobroId);
      return c ? json(vistaDe(c)) : fallo(noExisteCobro(input.cobroId));
    },
  },

  crear_link_pago: {
    preparar: async (input, ctx) => {
      const lead = await getLead(Number(input.leadId)).catch(() => null);
      if (!lead) return { error: `No existe el lead #${String(input.leadId)} en este negocio. Búscalo con buscar_leads.` };
      const activos = await listProductos(true).catch(() => null);
      if (!activos) return { error: 'No pude leer el catálogo de ofertas. Prueba de nuevo en un rato.' };
      const disponibles = activos.filter((p) => n(p.monto_usd)).map((p) => ({ productoId: p.id, nombre: p.nombre, tipo: p.tipo, monto_usd: p.monto_usd }));
      const prod = activos.find((p) => p.id === Number(input.productoId));
      if (!prod) return { error: `El producto #${String(input.productoId)} no está activo en el catálogo de ofertas. Pide listar_productos.`, disponibles };
      if (!n(prod.monto_usd)) return { error: `«${prod.nombre}» no tiene precio en el catálogo: cárgalo en el catálogo de ofertas, o crea el link desde la ficha del lead con el monto.`, faltan: ['monto'] };

      const conectadas = await pasarelasConectadas(ctx.ws).catch(() => null);
      if (!conectadas) return { error: 'No pude leer las pasarelas conectadas. Prueba de nuevo en un rato.' };
      if (!conectadas.length) return { error: 'Conecta Stripe o Mercado Pago en Integraciones para cobrar.', faltan: ['pasarela'] };
      const pedida = esPasarela(input.pasarela) ? input.pasarela : null;
      // Con las dos conectadas y sin elegir, Stripe: el precio del catálogo está en dólares y es la
      // única de las dos que lo cobra tal cual (ver abajo).
      const pasarela: Pasarela = pedida ?? (conectadas.length === 1 ? conectadas[0] : 'stripe');
      if (!conectadas.includes(pasarela)) return { error: `${NOMBRE_PASARELA[pasarela]} no está conectado en Integraciones.`, disponibles: conectadas.map((p) => NOMBRE_PASARELA[p]) };
      // ⚠️ MERCADO PAGO COBRA EN LA MONEDA DE SU CUENTA (ARS, MXN, BRL…) y el catálogo guarda el
      // precio en USD: `decidirCobro` le exige el monto explícito en esa moneda, y un dólar no se
      // convierte solo (nunca una tasa inventada). Con el precio sólo del catálogo, por acá no se
      // puede: lo decimos ANTES de proponer, en vez de dejar una pendiente que falla al confirmar.
      if (pasarela === 'mercadopago') {
        return { error: 'Mercado Pago cobra en la moneda de tu cuenta y el precio del catálogo está en dólares: ese link se crea desde la ficha del lead, con el monto en tu moneda.', faltan: ['monto'] };
      }
      const tipo = prod.tipo === 'suscripcion' ? 'suscripcion' : 'unico';
      const d = decidirCobro({ pasarela, conectadas, productoMontoUsd: prod.monto_usd, tipo, email: lead.email ?? null });
      if (!d.ok) return { error: d.error, faltan: d.faltan };

      // Un link pendiente del MISMO producto por la MISMA pasarela ya es lo pedido: no se crea otro
      // checkout (un flujo que se dispara dos veces, o un «mandale el link» repetido). Se le vuelve a
      // pasar el que ya existe, por código.
      const pendientes = await listarCobros(ctx.ws, { leadId: lead.id, estado: 'pendiente', limite: 50 }).catch(() => []);
      const ya = pendientes.find((c) => c.producto_id === prod.id && c.proveedor === pasarela);
      if (ya) {
        return {
          error: `${lead.nombre} ya tiene un link de pago pendiente de «${prod.nombre}» (cobro #${ya.id}): no creé otro. Si quieres uno nuevo, anula ése con anular_link_pago.`,
          yaEstaba: true,
          paraLaPersona: `Link de pago: ${linkDelCobro(ya.token)}`,
        };
      }
      return {
        payload: { leadId: lead.id, productoId: prod.id, pasarela },
        resumen: `Crear un link de pago de ${NOMBRE_PASARELA[pasarela]} para ${lead.nombre}: ${prod.nombre}, ${formatoMonto(d.monto, d.moneda)}${tipo === 'suscripcion' ? ' por mes' : ''}.`,
      };
    },
    ejecutar: (payload, ctx) => seguro('crear el link de pago', async () => {
      const r = await crearCobro(ctx.ws, {
        leadId: Number(payload.leadId),
        productoId: Number(payload.productoId),
        pasarela: esPasarela(payload.pasarela) ? payload.pasarela : null,
        creadoPor: autorDe(ctx),
      });
      if (!r.ok) return { ok: false, resumen: `No se pudo crear el link de pago: ${r.error}` };
      const c = r.cobro;
      return {
        ok: true,
        resumen: `Listo: link de pago de ${NOMBRE_PASARELA[c.proveedor]} por ${plata(c)} para ${quien(c)} (cobro #${c.id}${c.modo === 'prueba' ? ', de prueba' : ''}). El link queda en su ficha, en Pagos.`,
        datos: { cobroId: c.id, url: r.link, pasarela: c.proveedor, monto: c.monto, moneda: c.moneda, estado: c.estado },
        paraLaPersona: `Link de pago: ${r.link}`,
      };
    }),
  },

  anular_link_pago: {
    preparar: async (input, ctx) => {
      const c = await cobroDe(ctx.ws, input.cobroId);
      if (!c) return { error: noExisteCobro(input.cobroId) };
      if (c.estado === 'anulado') return { error: `El link del cobro #${c.id} ya estaba anulado.`, yaEstaba: true };
      if (c.estado !== 'pendiente' && c.estado !== 'fallido') {
        return { error: `Sólo se anula un link que todavía no se pagó: el cobro #${c.id} está ${rotuloEstado(c.estado).toLowerCase()}.${c.estado === 'pagado' ? ' Para devolverlo, reembolsar_cobro.' : ''}` };
      }
      return { payload: { cobroId: c.id }, resumen: `Anular el link de pago de ${quien(c)}: ${c.concepto}, ${plata(c)} por ${NOMBRE_PASARELA[c.proveedor]}.` };
    },
    ejecutar: (payload, ctx) => seguro('anular el link de pago', async () => {
      const r = await anularCobro(ctx.ws, Number(payload.cobroId), autorDe(ctx));
      if (!r.ok) return { ok: false, resumen: `No se pudo anular el link: ${r.error ?? 'sin detalle'}` };
      return { ok: true, resumen: `Listo: el link del cobro #${String(payload.cobroId)} quedó anulado.`, datos: { cobroId: Number(payload.cobroId) } };
    }),
  },

  reembolsar_cobro: {
    preparar: async (input, ctx) => {
      const c = await cobroDe(ctx.ws, input.cobroId);
      if (!c) return { error: noExisteCobro(input.cobroId) };
      if (c.estado === 'reembolsado') return { error: `El cobro #${c.id} ya estaba reembolsado.`, yaEstaba: true };
      if (c.estado !== 'pagado' || !c.proveedor_pago_id) {
        return { error: `Sólo se reembolsa un cobro pagado: el cobro #${c.id} está ${rotuloEstado(c.estado).toLowerCase()}.${c.estado === 'pendiente' || c.estado === 'fallido' ? ' Para que no se pague, anular_link_pago.' : ''}` };
      }
      const sinPasarela = await conPasarelaConectada(ctx.ws, c);
      if (sinPasarela) return { error: sinPasarela };
      const motivo = s(input.motivo);
      return {
        payload: { cobroId: c.id, ...(motivo ? { motivo } : {}) },
        resumen: `Devolverle a ${quien(c)} ${formatoMonto(c.monto, c.moneda)} de ${c.concepto} por ${NOMBRE_PASARELA[c.proveedor]}${c.modo === 'prueba' ? ' (de prueba)' : ''}. Es el pago entero y no se puede deshacer${c.tipo === 'suscripcion' ? '; la suscripción sigue activa' : ''}.`,
      };
    },
    ejecutar: (payload, ctx) => seguro('reembolsar el cobro', async () => {
      const r = await reembolsarCobro(ctx.ws, Number(payload.cobroId), autorDe(ctx), s(payload.motivo));
      return { ok: r.ok, resumen: r.resumen, datos: { cobroId: Number(payload.cobroId) } };
    }),
  },

  cancelar_suscripcion: {
    preparar: async (input, ctx) => {
      const c = await cobroDe(ctx.ws, input.cobroId);
      if (!c) return { error: noExisteCobro(input.cobroId) };
      if (c.tipo !== 'suscripcion') return { error: `El cobro #${c.id} es un pago único, no una suscripción.` };
      if (c.suscripcion_estado === 'cancelada') return { error: `La suscripción del cobro #${c.id} ya estaba cancelada.`, yaEstaba: true };
      if (!c.proveedor_suscripcion_id) return { error: `La suscripción del cobro #${c.id} todavía no arrancó (nadie pagó el link). Para que no se pague, anular_link_pago.` };
      const sinPasarela = await conPasarelaConectada(ctx.ws, c);
      if (sinPasarela) return { error: sinPasarela };
      return {
        payload: { cobroId: c.id },
        resumen: `Cancelar la suscripción de ${quien(c)}: ${c.concepto}, ${plata(c)} por ${NOMBRE_PASARELA[c.proveedor]}. Deja de cobrarse en el acto y no se puede deshacer.`,
      };
    },
    ejecutar: (payload, ctx) => seguro('cancelar la suscripción', async () => {
      const r = await cancelarSuscripcionCobro(ctx.ws, Number(payload.cobroId), autorDe(ctx));
      return { ok: r.ok, resumen: r.resumen, datos: { cobroId: Number(payload.cobroId) } };
    }),
  },
};
