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
import { getLead, logLeadEvent } from '@/lib/leads';
import { listProductos } from '@/lib/productos';
import {
  anularCobro, cancelarSuscripcionCobro, crearCobro, getCobro, linkDelCobro, listarCobros, pasarelasConectadas, reembolsarCobro,
} from '@/lib/cobros';
import { ESTADOS_COBRO, NOMBRE_PASARELA, esPasarela, rotuloEstado, type Cobro, type EstadoCobro, type Pasarela } from '@/lib/cobros-tipos';
import { decidirCobro, laCobraLaPasarela, mesesTranscurridos } from '@/lib/cobros-reglas';
import { formatoMonto, normalizarMoneda } from '@/lib/pasarela-moneda';
import { revalidateTag } from 'next/cache';
import { TAG } from '@/lib/cache';
import { getTenantDb } from '@/lib/workspace';
import { hoyEnWorkspace } from '@/lib/timezone';
import { ventaTipoDe, type VentaTipo } from '@/lib/venta-tipo';
import { esCuotaDeBaja, noEsDeuda } from '@/lib/cobrado-lead';
import { cuotasParaBaja, darDeBajaCliente, deshacerBajaCliente } from '@/lib/pagos-baja';
import {
  anotarEnHistorial, cambiarEstadoSuscripcionManual, cortarRecordatoriosDeCuota, editarCuota, escribirCampoDeal, escribirObligacion,
  escribirVenta, getPagosByLead, guardarMonedaDelNegocio, monedaDelNegocio, proteccionesDeCuotas, type CambioCampoDeal,
} from '@/lib/pagos';
import {
  aplicarObligacion, esCampoLeadDeal, esParteObligacion, esSeccionDeal, lineasDeCuotas, nombreCuota, obligacionesDe, patchDeVenta,
  rotuloCampoDeal, valorDeCampoDeal, CAMPOS_LEAD_DEAL, COLUMNA_SECCION, type CambioObligacion, type CambioVenta, type FilaVenta,
} from '@/lib/pagos-campo';

// ── helpers del archivo ───────────────────────────────────────────────────────

const json = (o: unknown): string => JSON.stringify(o);
const fallo = (msg: string) => ({ content: msg, isError: true });
const autorDe = (ctx: Ctx): string => ctx.actor?.trim() || 'MaKo';
const n = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const s = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const noExisteCobro = (id: unknown) => `No existe el cobro #${String(id)} en este negocio. Pide listar_cobros para ver los del lead.`;
const quien = (c: Cobro): string => c.nombre?.trim() || (c.lead_id ? `el lead #${c.lead_id}` : 'quien paga');
const plata = (c: Cobro): string => `${formatoMonto(c.monto, c.moneda)}${c.tipo === 'suscripcion' ? ' por mes' : ''}`;
const noExisteLead = (id: unknown) => `No existe el lead #${String(id)} en este negocio. Búscalo con buscar_leads.`;
const ROTULO_TIPO: Readonly<Record<VentaTipo, string>> = { unico: 'pago único', suscripcion: 'suscripción', sin_cobro: 'sin cobro (becado)' };
/** La caché de lecturas vence sola; esto la adelanta. NO `updateTag`: ejecutar() corre desde el webhook de WhatsApp o
 *  desde HTTP, fuera de una server action (el mismo arreglo que crm.helpers.ts, `invalidar`). */
function invalidarPagos(): void {
  for (const t of [TAG.pagos, TAG.leads]) { try { revalidateTag(t, { expire: 0 }); } catch { /* vence por TTL */ } }
}

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

  // ── Pagos CAMPO POR CAMPO (14/10/2026): la misma escritura que los bloques de la tab Pagos (lib/pagos.ts) ────
  // preparar() valida contra la base lo que se puede saber sin escribir (el lead de ESTE negocio, la cuota, el
  // renglón, el tipo de venta) y deja en el payload lo que la pantalla vio, para el compare-and-set al confirmar.

  ver_moneda_negocio: {
    leer: async (): Promise<SalidaLectura> => {
      const moneda = await monedaDelNegocio();
      return json({ moneda, nota: 'Es la moneda inicial de un pago cargado a mano. Los totales del CRM (cobrado, por cobrar, cash) siguen en USD; Stripe y Mercado Pago cobran en la moneda de su cuenta.' });
    },
  },

  cambiar_moneda_negocio: {
    preparar: async (input) => {
      const m = normalizarMoneda(s(input.moneda));
      if (!m) return { error: 'Esa moneda no existe: va el código de 3 letras (USD, MXN, ARS…).', faltan: ['moneda'] };
      const actual = await monedaDelNegocio();
      if (actual === m) return { error: `La moneda del negocio ya es ${m}.`, yaEstaba: true };
      return { payload: { moneda: m }, resumen: `Cambiar la moneda del negocio de ${actual} a ${m} (el valor inicial al cargar un pago a mano; lo cobrado no cambia).` };
    },
    ejecutar: (payload) => seguro('cambiar la moneda del negocio', async () => {
      const m = await guardarMonedaDelNegocio(String(payload.moneda));
      return { ok: true, resumen: `Listo: la moneda del negocio es ${m}.`, datos: { moneda: m } };
    }),
  },

  editar_dato_deal: {
    preparar: async (input) => {
      const lead = await getLead(Number(input.leadId)).catch(() => null);
      if (!lead) return { error: noExisteLead(input.leadId) };
      const seccion = s(input.seccion);
      const campo = s(input.campo) ?? '';
      const valor = s(input.valor);
      let rotulo: string;
      let antes: unknown;
      if (seccion === 'lead') {
        if (!esCampoLeadDeal(campo)) return { error: `«${campo}» no es un dato suelto del deal: va fecha_inicio_servicio o facturado_por_id.` };
        if (campo === 'fecha_inicio_servicio' && valor && !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return { error: 'La fecha tiene que ser AAAA-MM-DD.' };
        if (campo === 'facturado_por_id' && valor) {
          const { data } = await (await getTenantDb()).from('identidades_fiscales').select('id').eq('id', Number(valor)).maybeSingle();
          if (!data) return { error: `No existe la identidad fiscal #${valor} en este negocio.` };
        }
        rotulo = CAMPOS_LEAD_DEAL[campo];
        antes = (lead as unknown as Record<string, unknown>)[campo];
      } else if (esSeccionDeal(seccion)) {
        const v = valorDeCampoDeal(seccion, campo, valor);
        if (!v.ok) return { error: v.error };
        rotulo = rotuloCampoDeal(seccion, campo);
        antes = ((lead as unknown as Record<string, Record<string, unknown> | null>)[COLUMNA_SECCION[seccion]] ?? {})[campo];
      } else {
        return { error: 'La sección va: fiscal, servicio, promesa o lead.', faltan: ['seccion'] };
      }
      const de = antes == null || antes === '' ? '—' : `«${String(antes)}»`;
      return {
        payload: { leadId: lead.id, seccion, campo, valor: valor ?? null },
        resumen: `Cambiar ${rotulo} de ${lead.nombre}: ${de} → ${valor ? `«${valor}»` : '— (vacío)'}.`,
      };
    },
    ejecutar: (payload, ctx) => seguro('editar el dato del deal', async () => {
      const r = await escribirCampoDeal(Number(payload.leadId), { seccion: payload.seccion, campo: payload.campo, valor: payload.valor ?? null } as unknown as CambioCampoDeal, autorDe(ctx));
      if (!r.ok) return { ok: false, resumen: `No se pudo: ${r.error}` };
      invalidarPagos();
      return { ok: true, resumen: r.cambio ? 'Listo: dato del deal guardado.' : 'Ya estaba así: no cambió nada.', datos: { antes: r.antes, despues: r.despues } };
    }),
  },

  editar_obligacion_deal: {
    preparar: async (input) => {
      const lead = await getLead(Number(input.leadId)).catch(() => null);
      if (!lead) return { error: noExisteLead(input.leadId) };
      const parte = esParteObligacion(input.parte) ? input.parte : null;
      if (!parte) return { error: 'Falta de quién es: cliente o prestador.', faltan: ['parte'] };
      const lista = obligacionesDe(lead.deal_obligaciones)[parte];
      const texto = s(input.texto);
      const renglon = n(input.renglon);
      let cambio: CambioObligacion;
      if (input.accion === 'agregar') {
        if (!texto) return { error: 'Falta el texto del renglón.', faltan: ['texto'] };
        cambio = { accion: 'agregar', parte, texto };
      } else if (input.accion === 'editar' || input.accion === 'quitar') {
        if (!renglon || renglon > lista.length) return { error: `Esa lista tiene ${lista.length} renglón(es): pide uno del 1 al ${lista.length}.`, disponibles: lista.map((t, i) => ({ renglon: i + 1, texto: t })) };
        const esperado = lista[renglon - 1];
        if (input.accion === 'editar') {
          if (!texto) return { error: 'Falta el texto nuevo del renglón.', faltan: ['texto'] };
          cambio = { accion: 'editar', parte, indice: renglon - 1, texto, esperado };
        } else {
          cambio = { accion: 'quitar', parte, indice: renglon - 1, esperado };
        }
      } else {
        return { error: 'La acción va: agregar, editar o quitar.', faltan: ['accion'] };
      }
      const prueba = aplicarObligacion(lead.deal_obligaciones, cambio);
      if (!prueba.ok) return { error: prueba.error };
      const quien = parte === 'cliente' ? 'del cliente' : 'del prestador';
      const que = cambio.accion === 'agregar' ? `agregar «${texto}»`
        : cambio.accion === 'editar' ? `cambiar el renglón ${renglon} («${prueba.antes}») por «${texto}»`
        : `quitar el renglón ${renglon} («${prueba.antes}»)`;
      return { payload: { leadId: lead.id, cambio }, resumen: `Obligaciones ${quien} de ${lead.nombre}: ${que}.` };
    },
    ejecutar: (payload, ctx) => seguro('editar la obligación', async () => {
      const r = await escribirObligacion(Number(payload.leadId), payload.cambio as CambioObligacion, autorDe(ctx));
      if (!r.ok) return { ok: false, resumen: `No se pudo: ${r.error}` };
      invalidarPagos();
      return { ok: true, resumen: 'Listo: obligación guardada.', datos: { obligaciones: r.obligaciones } };
    }),
  },

  editar_venta_lead: {
    preparar: async (input) => {
      const lead = await getLead(Number(input.leadId)).catch(() => null);
      if (!lead) return { error: noExisteLead(input.leadId) };
      const cambios: CambioVenta[] = [];
      if (input.tipo !== undefined) {
        const tipo = (['unico', 'suscripcion', 'sin_cobro'] as const).find((t) => t === input.tipo);
        if (!tipo) return { error: 'El tipo va: unico, suscripcion o sin_cobro.' };
        cambios.push({ campo: 'tipo', valor: tipo });
      }
      if (input.montoUsd !== undefined) cambios.push({ campo: 'monto', valor: n(input.montoUsd) });
      if (input.plazoMeses !== undefined) cambios.push({ campo: 'plazo', valor: n(input.plazoMeses) });
      if (input.fechaCierre !== undefined) {
        const f = s(input.fechaCierre);
        if (f && !/^\d{4}-\d{2}-\d{2}$/.test(f)) return { error: 'La fecha de cierre tiene que ser AAAA-MM-DD.' };
        cambios.push({ campo: 'fecha', valor: f });
      }
      if (!cambios.length) return { error: 'Pasa al menos uno: tipo, montoUsd, plazoMeses o fechaCierre.', faltan: ['tipo', 'montoUsd', 'plazoMeses', 'fechaCierre'] };
      // Se prueban EN ORDEN sobre una copia de la fila: el monto después de pasar a suscripción es la mensualidad.
      const cuotasLead = await getPagosByLead(lead.id).catch(() => []);
      const cobradas = cuotasLead.filter((q) => q.pagado).length;
      const impagas = cuotasLead.filter((q) => !q.pagado && !noEsDeuda(q)).length;
      const fila: FilaVenta = { venta_tipo: lead.venta_tipo ?? 'unico', monto_cierre_usd: lead.monto_cierre_usd, suscripcion_monto_usd: lead.suscripcion_monto_usd ?? null, suscripcion_meses: lead.suscripcion_meses ?? null, fecha_cierre: lead.fecha_cierre };
      const lineas: string[] = [];
      for (const c of cambios) {
        const p = patchDeVenta(fila, c, { hayCobradas: cobradas > 0, impagas });
        if (!p.ok) {
          if ('usarQuitarSinCobro' in p && p.usarQuitarSinCobro) { fila.venta_tipo = 'unico'; lineas.push('sacarlo de «Sin cobro» (pago único)'); continue; }
          return { error: p.error };
        }
        Object.assign(fila, p.patch);
        lineas.push(c.campo === 'tipo' ? `tipo: ${ROTULO_TIPO[c.valor]}` : c.campo === 'monto' ? `${fila.venta_tipo === 'suscripcion' ? 'mensualidad' : 'monto'}: ${c.valor == null ? '— (vacío)' : `USD ${c.valor}`}` : c.campo === 'plazo' ? `plazo: ${c.valor == null ? 'mes a mes' : `${c.valor} meses`}` : `fecha de cierre: ${c.valor ?? '— (vacía)'}`);
      }
      return {
        payload: { leadId: lead.id, tipoVisto: ventaTipoDe(lead.venta_tipo), cambios },
        resumen: `Venta de ${lead.nombre}: ${lineas.join('; ')}. No lo mueve de etapa.`,
      };
    },
    ejecutar: (payload, ctx) => seguro('editar la venta', async () => {
      const leadId = Number(payload.leadId);
      let tipoVisto = ventaTipoDe(payload.tipoVisto as string | null);
      const hechos: string[] = [];
      for (const c of (payload.cambios as CambioVenta[]) ?? []) {
        const r = await escribirVenta(leadId, c, { autor: autorDe(ctx), tipoVisto });
        if (!r.ok) return { ok: false, resumen: `${hechos.length ? `Guardé ${hechos.join(', ')}, pero no ` : 'No se pudo '}${c.campo}: ${r.error}` };
        tipoVisto = r.ventaTipo;
        hechos.push(c.campo);
      }
      invalidarPagos();
      return { ok: true, resumen: 'Listo: venta guardada.', datos: { ventaTipo: tipoVisto } };
    }),
  },

  editar_cuota: {
    preparar: async (input) => {
      const lead = await getLead(Number(input.leadId)).catch(() => null);
      if (!lead) return { error: noExisteLead(input.leadId) };
      const pagos = await getPagosByLead(lead.id).catch(() => null);
      if (!pagos) return { error: 'No pude leer las cuotas. Prueba de nuevo en un rato.' };
      const q = pagos.find((p) => p.id === Number(input.cuotaId));
      if (!q) return { error: `La cuota #${String(input.cuotaId)} no es de ${lead.nombre}. Pide cobranza_lead para ver sus cuotas.`, disponibles: pagos.map((p) => ({ cuotaId: p.id, numero: p.numero, monto_usd: p.monto_usd, pagada: p.pagado })) };
      if (q.pagado) return { error: `${nombreCuota(q.numero)} ya está cobrada: para corregirla, desmárcala con marcar_pago_cobrado.` };
      const monto = n(input.montoUsd);
      const vence = s(input.vence);
      if (monto == null && vence == null) return { error: 'Pasa el monto nuevo (montoUsd) o el vencimiento nuevo (vence).', faltan: ['montoUsd', 'vence'] };
      if (vence && !/^\d{4}-\d{2}-\d{2}$/.test(vence)) return { error: 'El vencimiento tiene que ser AAAA-MM-DD.' };
      // Fail-closed: «no pude ver si tiene un link» no es «no tiene».
      const protMapa = await proteccionesDeCuotas(lead.id, [q.id]).catch(() => null);
      if (!protMapa) return { error: 'No pude revisar si la cuota tiene un link o un recordatorio. Prueba de nuevo en un rato.' };
      const prot = protMapa.get(q.id) ?? [];
      if (prot.includes('recordatorio')) return { error: `${nombreCuota(q.numero)} tiene un recordatorio de cobro en curso: córtalo con cortar_recordatorio_cuota para editarla.` };
      if (prot.includes('link') && monto != null && monto !== Number(q.monto_usd)) return { error: `${nombreCuota(q.numero)} tiene un link de pago sin pagar: anúlalo con anular_link_pago para cambiar el monto.` };
      const partes = [monto != null ? `USD ${q.monto_usd} → USD ${monto}` : null, vence ? `vence ${q.fecha_esperada ?? '—'} → ${vence}` : null].filter(Boolean).join(' y ');
      return {
        payload: { leadId: lead.id, cuotaId: q.id, ...(monto != null ? { monto } : {}), ...(vence ? { fecha: vence } : {}) },
        resumen: `${nombreCuota(q.numero)} de ${lead.nombre}: ${partes}.`,
      };
    },
    ejecutar: (payload, ctx) => seguro('editar la cuota', async () => {
      const leadId = Number(payload.leadId);
      const cambio: { monto?: number; fecha?: string } = {};
      if (typeof payload.monto === 'number') cambio.monto = payload.monto;
      if (typeof payload.fecha === 'string') cambio.fecha = payload.fecha;
      const r = await editarCuota(leadId, Number(payload.cuotaId), cambio);
      await anotarEnHistorial(leadId, lineasDeCuotas({
        actualizar: [{ id: Number(payload.cuotaId), numero: r.numero, monto_usd: r.despues.monto_usd, fecha_esperada: r.despues.fecha_esperada, antes: r.antes }],
        insertar: [], borrar: [], conservar: [],
      }), autorDe(ctx));
      invalidarPagos();
      return { ok: true, resumen: `Listo: ${nombreCuota(r.numero)} queda en USD ${r.despues.monto_usd}${r.despues.fecha_esperada ? `, vence ${r.despues.fecha_esperada}` : ''}.`, datos: { cuotaId: Number(payload.cuotaId), antes: r.antes, despues: r.despues } };
    }),
  },

  crear_link_cuota: {
    preparar: async (input, ctx) => {
      const lead = await getLead(Number(input.leadId)).catch(() => null);
      if (!lead) return { error: noExisteLead(input.leadId) };
      const pagos = await getPagosByLead(lead.id).catch(() => null);
      if (!pagos) return { error: 'No pude leer las cuotas. Prueba de nuevo en un rato.' };
      const q = pagos.find((p) => p.id === Number(input.cuotaId));
      if (!q) return { error: `La cuota #${String(input.cuotaId)} no es de ${lead.nombre}. Pide cobranza_lead para ver sus cuotas.` };
      if (q.pagado) return { error: `${nombreCuota(q.numero)} ya está cobrada.`, yaEstaba: true };
      const pasarela: Pasarela = esPasarela(input.pasarela) ? input.pasarela : 'stripe';
      if (pasarela === 'mercadopago') return { error: 'Mercado Pago cobra en la moneda de tu cuenta y la cuota está en dólares: ese link se crea desde la ficha del lead, con el monto en tu moneda.', faltan: ['monto'] };
      const conectadas = await pasarelasConectadas(ctx.ws).catch(() => null);
      if (!conectadas) return { error: 'No pude leer las pasarelas conectadas. Prueba de nuevo en un rato.' };
      if (!conectadas.includes(pasarela)) return { error: `${NOMBRE_PASARELA[pasarela]} no está conectado en Integraciones.`, faltan: ['pasarela'] };
      const vivos = await listarCobros(ctx.ws, { leadId: lead.id, limite: 50 }).catch(() => []);
      const ya = vivos.find((c) => c.pago_id === q.id && (c.estado === 'pendiente' || c.estado === 'fallido'));
      if (ya) {
        return { error: `${nombreCuota(q.numero)} de ${lead.nombre} ya tiene un link de pago sin pagar (cobro #${ya.id}): no creé otro.`, yaEstaba: true, paraLaPersona: `Link de pago: ${linkDelCobro(ya.token)}` };
      }
      return {
        payload: { leadId: lead.id, cuotaId: q.id, pasarela },
        resumen: `Crear un link de pago de ${NOMBRE_PASARELA[pasarela]} para ${lead.nombre} que cobra ${nombreCuota(q.numero).toLowerCase()} (USD ${q.monto_usd}).`,
      };
    },
    ejecutar: (payload, ctx) => seguro('crear el link de la cuota', async () => {
      const r = await crearCobro(ctx.ws, {
        leadId: Number(payload.leadId),
        pagoId: Number(payload.cuotaId),
        pasarela: esPasarela(payload.pasarela) ? payload.pasarela : null,
        creadoPor: autorDe(ctx),
      });
      if (!r.ok) return { ok: false, resumen: `No se pudo crear el link: ${r.error}` };
      const c = r.cobro;
      return {
        ok: true,
        resumen: `Listo: link de pago de ${NOMBRE_PASARELA[c.proveedor]} por ${plata(c)} (cobro #${c.id}${c.modo === 'prueba' ? ', de prueba' : ''}). El link queda en su ficha, en Pagos.`,
        datos: { cobroId: c.id, cuotaId: Number(payload.cuotaId), url: r.link, pasarela: c.proveedor, monto: c.monto, moneda: c.moneda, estado: c.estado },
        paraLaPersona: `Link de pago: ${r.link}`,
      };
    }),
  },

  cortar_recordatorio_cuota: {
    preparar: async (input) => {
      const lead = await getLead(Number(input.leadId)).catch(() => null);
      if (!lead) return { error: noExisteLead(input.leadId) };
      const q = (await getPagosByLead(lead.id).catch(() => [])).find((p) => p.id === Number(input.cuotaId));
      if (!q) return { error: `La cuota #${String(input.cuotaId)} no es de ${lead.nombre}. Pide cobranza_lead para ver sus cuotas.` };
      const prot = await proteccionesDeCuotas(lead.id, [q.id]).catch(() => null);
      if (!prot) return { error: 'No pude revisar los recordatorios de la cuota. Prueba de nuevo en un rato.' };
      if (!prot.get(q.id)?.includes('recordatorio')) return { error: `${nombreCuota(q.numero)} de ${lead.nombre} no tiene un recordatorio de cobro en curso.`, yaEstaba: true };
      return { payload: { leadId: lead.id, cuotaId: q.id }, resumen: `Cortar el recordatorio de cobro de ${nombreCuota(q.numero).toLowerCase()} de ${lead.nombre}: MaKo deja de recordársela. No se deshace.` };
    },
    ejecutar: (payload, ctx) => seguro('cortar el recordatorio', async () => {
      const leadId = Number(payload.leadId);
      const n2 = await cortarRecordatoriosDeCuota(leadId, Number(payload.cuotaId));
      if (n2 > 0) invalidarPagos();
      if (n2 > 0) await logLeadEvent(leadId, 'Recordatorio de cobro', `Cortado desde ${ctx.canal}: cuota #${String(payload.cuotaId)}`, autorDe(ctx));
      return { ok: true, resumen: n2 > 0 ? 'Listo: el recordatorio quedó cortado.' : 'No había un recordatorio corriendo: nada que cortar.', datos: { cortados: n2 } };
    }),
  },

  baja_del_cliente: {
    preparar: async (input) => {
      const lead = await getLead(Number(input.leadId)).catch(() => null);
      if (!lead) return { error: noExisteLead(input.leadId) };
      const pagos = await getPagosByLead(lead.id).catch(() => null);
      if (!pagos) return { error: 'No pude leer las cuotas. Prueba de nuevo en un rato.' };
      const usdDe = (qs: ReadonlyArray<{ monto_usd: number }>) => Math.round(qs.reduce((t, q) => t + Number(q.monto_usd), 0) * 100) / 100;
      if (input.deshacer === true) {
        const deBaja = pagos.filter(esCuotaDeBaja);
        if (!deBaja.length) return { error: `${lead.nombre} no está dado de baja.`, yaEstaba: true };
        return { payload: { leadId: lead.id, deshacer: true }, resumen: `Deshacer la baja de ${lead.nombre}: USD ${usdDe(deBaja)} vuelven a ser deuda, con su vencimiento.` };
      }
      if (lead.venta_tipo === 'suscripcion') return { error: `${lead.nombre} es una suscripción: no se da de baja, se cancela con estado_suscripcion_manual o cancelar_suscripcion.` };
      const objetivo = cuotasParaBaja(pagos);
      if (!objetivo.length) return { error: `A ${lead.nombre} no le queda nada por cobrar: no hay cuotas para dar de baja.`, yaEstaba: true };
      return { payload: { leadId: lead.id, deshacer: false }, resumen: `${lead.nombre} se dio de baja: USD ${usdDe(objetivo)} sin cobrar (${objetivo.length} cuota(s)) dejan de ser deuda y no se le recuerdan. Lo cobrado queda.` };
    },
    ejecutar: (payload, ctx) => seguro('dar de baja al cliente', async () => {
      const leadId = Number(payload.leadId);
      const r = payload.deshacer === true ? await deshacerBajaCliente(leadId, autorDe(ctx)) : await darDeBajaCliente(leadId, autorDe(ctx));
      if (!r.ok) return { ok: false, resumen: r.error };
      invalidarPagos();
      return { ok: true, resumen: `Listo: ${r.resumen}`, datos: { cuotas: r.cuotas, usd: r.usd } };
    }),
  },

  estado_suscripcion_manual: {
    preparar: async (input, ctx) => {
      const lead = await getLead(Number(input.leadId)).catch(() => null);
      if (!lead) return { error: noExisteLead(input.leadId) };
      if (lead.venta_tipo !== 'suscripcion') return { error: `${lead.nombre} no es una suscripción.` };
      const estado = (['cancelada', 'activa'] as const).find((e) => e === input.estado);
      if (!estado) return { error: 'El estado va: cancelada o activa.', faltan: ['estado'] };
      const cobros = await listarCobros(ctx.ws, { leadId: lead.id, limite: 50 }).catch(() => null);
      if (!cobros) return { error: 'No pude leer los cobros del lead. Prueba de nuevo en un rato.' };
      if (laCobraLaPasarela(cobros)) {
        return { error: `La suscripción de ${lead.nombre} la cobra la pasarela: se cancela con cancelar_suscripcion (pide el cobroId con listar_cobros).` };
      }
      const cancelada = !!(lead as unknown as { suscripcion_cancelada_at?: string | null }).suscripcion_cancelada_at;
      if ((estado === 'cancelada') === cancelada) return { error: `La suscripción de ${lead.nombre} ya está ${estado}.`, yaEstaba: true };
      return {
        payload: { leadId: lead.id, estado },
        resumen: estado === 'cancelada'
          ? `Cancelar la suscripción manual de ${lead.nombre}: se cuenta hasta hoy y deja de sumar al MRR.`
          : `Reactivar la suscripción manual de ${lead.nombre}: vuelve a contar, mes a mes.`,
      };
    },
    ejecutar: (payload, ctx) => seguro('cambiar el estado de la suscripción', async () => {
      const leadId = Number(payload.leadId);
      const lead = await getLead(leadId);
      if (!lead) return { ok: false, resumen: noExisteLead(leadId) };
      const hoy = await hoyEnWorkspace();
      const estado = payload.estado === 'activa' ? 'activa' : 'cancelada';
      const r = await cambiarEstadoSuscripcionManual(leadId, estado, { hoy, mesesAlCancelar: mesesTranscurridos(lead.fecha_cierre ?? null, hoy), mesesAlReactivar: null, autor: autorDe(ctx) });
      invalidarPagos();
      return { ok: true, resumen: r.cambio ? `Listo: la suscripción quedó ${estado}.` : `Ya estaba ${estado}.`, datos: { estado, mesesAntes: r.mesesAntes } };
    }),
  },
};
