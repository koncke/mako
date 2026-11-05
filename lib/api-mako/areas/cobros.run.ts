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

import { pedidosPendientes } from '@/lib/pedidos-ingreso';
import 'server-only';
import type { Ctx, Ejecutado, Runners, SalidaLectura } from '../tipos';
import { getLead, logLeadEvent } from '@/lib/leads';
import { listProductos } from '@/lib/productos';
import { cobroDelProducto } from '@/lib/cobro-etapa-server';
import {
  anularCobro, cancelarSuscripcionCobro, crearCobro, getCobro, linkDelCobro, listarCobros, pasarelasConectadas, reembolsarCobro,
} from '@/lib/cobros';
import { ESTADOS_COBRO, NOMBRE_PASARELA, esPasarela, rotuloEstado, type Cobro, type EstadoCobro, type Pasarela } from '@/lib/cobros-tipos';
import { decidirCobro, laCobraLaPasarela, mesesTranscurridos } from '@/lib/cobros-reglas';
import { formatoMonto, normalizarMoneda } from '@/lib/pasarela-moneda';
import { revalidateTag } from 'next/cache';
import { TAG } from '@/lib/cache';
import { getTenantDb, runWithWorkspace, wsSuperAdmin } from '@/lib/workspace';
import { venderPlan, ventaValida, previaDeLaVenta, compradorEnLaPlataforma, cobroAbiertoDelPlan, cuentaDelComprador } from '@/lib/vender-plan';
import { getSesionAdmin } from '@/lib/auth';
import { vistaDeClientes } from '@/lib/clientes-plataforma';
import { vistaDeIngresos } from '@/lib/admin-ingresos';
import { nombreDePlan } from '@/lib/clientes-plataforma-reglas';
import { leerSesionesAgente } from '@/lib/agente-sesiones';
import { PREFIJO_FLUJO } from '../canal';

const NO_SUPER_ADMIN = 'Sólo el super admin vende planes de MaKo.';
/** ¿Quien confirma es el super admin GLOBAL? Fuera de un request (un flujo, un cron) no hay cookies: eso es un «no». */
async function esSuperAdmin(): Promise<boolean> {
  try { return (await getSesionAdmin()) != null; } catch { return false; }
}
import { capaDef } from '@/lib/capas';
import { hoyEnWorkspace } from '@/lib/timezone';
import { ventaTipoDe, type VentaTipo } from '@/lib/venta-tipo';
import { esCuotaDeBaja, noEsDeuda } from '@/lib/cobrado-lead';
import { cuotasParaBaja, darDeBajaCliente, deshacerBajaCliente } from '@/lib/pagos-baja';
import {
  anotarEnHistorial, cambiarEstadoSuscripcionManual, cortarRecordatoriosDeCuota, editarCuota, escribirCampoDeal, escribirObligacion,
  escribirVenta, getPagosByLead, guardarMonedaDelNegocio, guardarPlanPorTramos, monedaDelNegocio, proteccionesDeCuotas, type CambioCampoDeal,
} from '@/lib/pagos';
import {
  aplicarObligacion, armadaDe, avisoDeConservadas, cuotaExistenteDe, cuotasQueQuedan, cuotasVistas, cuotasVistasDe, esCampoLeadDeal, esParteObligacion, esSeccionDeal,
  lineasDeCuotas, nombreCuota, obligacionesDe, patchDeVenta, planCambioDesde, planPorTramosDelServer, plataDeCuota, reconciliarCuotas,
  rotuloCampoDeal, valorDeCampoDeal, CAMPOS_LEAD_DEAL, COLUMNA_SECCION, type AnticipoPlan, type CambioObligacion, type CambioVenta,
  type CuotaQueQueda, type FilaVenta, type PlanDeCuotas, type TramoPlan,
} from '@/lib/pagos-campo';
import { bajarAdjunto } from '@/lib/chat-mako-adjuntos';
import { guardarDocumentoFiscal } from '@/lib/deal-fiscal-doc';
import { aCompletarAhora, propuestaDocumentoFiscal } from '@/lib/deal-fiscal-doc-reglas';

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

/**
 * El cobro por id, en ESTE workspace: null si no existe, y su `error` con `falla` si la base no contestó. No lanza (lo llama un
 * preparar de pantalla). Con el `.catch(() => null)` de antes, la base caída salía «No existe el cobro»: MaKo le decía al dueño
 * que el cobro no estaba, y era una regla sin ticket (la verificación de 692368a60, R7).
 */
async function cobroDe(ws: number, id: unknown): Promise<Cobro | null | { error: string; falla: true }> {
  const x = n(id);
  if (!x) return null;
  try { return await getCobro(ws, x); } catch { return { error: 'No pude leer el cobro. Prueba de nuevo en un rato.', falla: true }; }
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

/** null si la pasarela del cobro sigue conectada; si no, el error que lo dice (con `falla` si no se pudieron leer: no es una regla). */
async function conPasarelaConectada(ws: number, c: Cobro): Promise<{ error: string; falla?: true } | null> {
  const conectadas = await pasarelasConectadas(ws).catch(() => null);
  if (!conectadas) return { error: 'No pude leer las pasarelas conectadas. Prueba de nuevo en un rato.', falla: true };
  return conectadas.includes(c.proveedor) ? null : { error: `${NOMBRE_PASARELA[c.proveedor]} ya no está conectado en Integraciones: reconéctalo para seguir.` };
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
      if (c && 'falla' in c) return fallo(c.error);
      return c ? json(vistaDe(c)) : fallo(noExisteCobro(input.cobroId));
    },
  },

  crear_link_pago: {
    preparar: async (input, ctx) => {
      const lead = await getLead(Number(input.leadId)).catch(() => null);
      if (!lead) return { error: `No existe el lead #${String(input.leadId)} en este negocio. Búscalo con buscar_leads.` };
      const activos = await listProductos(true).catch(() => null);
      if (!activos) return { error: 'No pude leer el catálogo de ofertas. Prueba de nuevo en un rato.', falla: true };
      const disponibles = activos.filter((p) => n(p.monto_usd)).map((p) => ({ productoId: p.id, nombre: p.nombre, tipo: p.tipo, monto_usd: p.monto_usd }));
      const prod = activos.find((p) => p.id === Number(input.productoId));
      if (!prod) return { error: `El producto #${String(input.productoId)} no está activo en el catálogo de ofertas. Pide listar_productos.`, disponibles };
      if (!n(prod.monto_usd)) return { error: `«${prod.nombre}» no tiene precio en el catálogo: cárgalo en el catálogo de ofertas, o crea el link desde la ficha del lead con el monto.`, faltan: ['monto'] };

      const conectadas = await pasarelasConectadas(ctx.ws).catch(() => null);
      if (!conectadas) return { error: 'No pude leer las pasarelas conectadas. Prueba de nuevo en un rato.', falla: true };
      if (!conectadas.length) return { error: 'Conecta una pasarela de pagos en Integraciones para cobrar.', faltan: ['pasarela'] };
      const pedida = esPasarela(input.pasarela) ? input.pasarela : null;
      // Con las dos conectadas y sin elegir, Stripe: el precio del catálogo está en dólares y es la
      // única de las dos que lo cobra tal cual (ver abajo).
      const pasarela: Pasarela = pedida ?? (conectadas.length === 1 ? conectadas[0] : 'stripe');
      // `falta`: el link al modal de ESA pasarela lo pone el código (25/10/2026).
      if (!conectadas.includes(pasarela)) return { error: `${NOMBRE_PASARELA[pasarela]} no está conectado en este negocio.`, disponibles: conectadas.map((p) => NOMBRE_PASARELA[p]), falta: { servicio: pasarela } };
      // ⚠️ MERCADO PAGO COBRA EN LA MONEDA DE SU CUENTA (ARS, MXN, BRL…) y el catálogo guarda el
      // precio en USD: `decidirCobro` le exige el monto explícito en esa moneda, y un dólar no se
      // convierte solo (nunca una tasa inventada). Con el precio sólo del catálogo, por acá no se
      // puede: lo decimos ANTES de proponer, en vez de dejar una pendiente que falla al confirmar.
      if (pasarela === 'mercadopago') {
        return { error: 'Mercado Pago cobra en la moneda de tu cuenta y el precio del catálogo está en dólares: ese link se crea desde la ficha del lead, con el monto en tu moneda.', faltan: ['monto'] };
      }
      const tipo = prod.tipo === 'suscripcion' ? 'suscripcion' : 'unico';
      // Un producto en cuotas (mig 0326) cobra su PRIMER pago, como `crearCobro`: lo que se aprueba es lo que se cobra.
      const enCuotas = tipo === 'unico' ? await cobroDelProducto(prod.id).catch(() => null) : null;
      const d = decidirCobro({ pasarela, conectadas, productoMontoUsd: enCuotas?.primerPagoUsd ?? prod.monto_usd, tipo, email: lead.email ?? null });
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
        // `montoUsd`: lo que se aprobó. Si el producto cambia mientras la pendiente espera, `ejecutar` no cobra otro monto.
        payload: { leadId: lead.id, productoId: prod.id, pasarela, montoUsd: enCuotas?.primerPagoUsd ?? prod.monto_usd },
        resumen: `Crear un link de pago de ${NOMBRE_PASARELA[pasarela]} para ${lead.nombre}: ${prod.nombre}, ${formatoMonto(d.monto, d.moneda)}${tipo === 'suscripcion' ? ' por mes' : enCuotas?.cuotas ? ` (el primero de ${enCuotas.cuotas} pagos)` : ''}.`,
      };
    },
    ejecutar: (payload, ctx) => seguro('crear el link de pago', async () => {
      // Lo aprobado es lo que se cobra (revisión de plata, baja 3): si el precio o las cuotas del producto cambiaron
      // mientras esto esperaba la aprobación, no se crea el link por otro monto.
      if (payload.montoUsd != null) {
        const ahora = await cobroDelProducto(Number(payload.productoId)).catch(() => null);
        const cobraria = ahora?.primerPagoUsd ?? null;
        if (cobraria == null || Math.round(cobraria * 100) !== Math.round(Number(payload.montoUsd) * 100)) {
          return { ok: false, resumen: 'El producto cambió de precio o de cuotas desde que lo aprobaste: pídelo de nuevo para ver el monto actual.' };
        }
      }
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
      if ('falla' in c) return c;
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
      if ('falla' in c) return c;
      if (c.estado === 'reembolsado') return { error: `El cobro #${c.id} ya estaba reembolsado.`, yaEstaba: true };
      if (c.estado !== 'pagado' || !c.proveedor_pago_id) {
        return { error: `Sólo se reembolsa un cobro pagado: el cobro #${c.id} está ${rotuloEstado(c.estado).toLowerCase()}.${c.estado === 'pendiente' || c.estado === 'fallido' ? ' Para que no se pague, anular_link_pago.' : ''}` };
      }
      const sinPasarela = await conPasarelaConectada(ctx.ws, c);
      if (sinPasarela) return sinPasarela;
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
      if ('falla' in c) return c;
      if (c.tipo !== 'suscripcion') return { error: `El cobro #${c.id} es un pago único, no una suscripción.` };
      if (c.suscripcion_estado === 'cancelada') return { error: `La suscripción del cobro #${c.id} ya estaba cancelada.`, yaEstaba: true };
      if (!c.proveedor_suscripcion_id) return { error: `La suscripción del cobro #${c.id} todavía no arrancó (nadie pagó el link). Para que no se pague, anular_link_pago.` };
      const sinPasarela = await conPasarelaConectada(ctx.ws, c);
      if (sinPasarela) return sinPasarela;
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

  guardar_documento_fiscal: {
    // El archivo sale de `ctx.adjuntos` (los de ESTE mensaje, ya guardados) y viaja en la pendiente como `ref`: al confirmar
    // ya no hay turno. Los datos los pasa el modelo, que leyó el documento; sólo se completa lo VACÍO (lib/deal-fiscal-doc-reglas.ts).
    preparar: async (input, ctx) => {
      const lead = await getLead(Number(input.leadId)).catch(() => null);
      if (!lead) return { error: noExisteLead(input.leadId) };
      return propuestaDocumentoFiscal(lead, ctx.adjuntos, input);
    },
    ejecutar: (payload, ctx) => seguro('guardar el documento fiscal', async () => {
      const leadId = Number(payload.leadId);
      const archivo = await bajarAdjunto(ctx.ws, payload.ref);
      if (!archivo) return { ok: false, resumen: 'No se pudo: el archivo ya no está en el chat. Que lo vuelva a adjuntar.' };
      const g = await guardarDocumentoFiscal({ ws: ctx.ws, leadId, bytes: archivo.bytes, mime: archivo.mime, nombre: s(payload.nombre) ?? archivo.nombre });
      if (!g.ok) return { ok: false, resumen: `No se pudo: ${g.error}` };
      const lead = await getLead(leadId).catch(() => null);
      const completados: string[] = [];
      for (const [campo, valor] of aCompletarAhora(lead?.deal_fiscal, payload.completar)) {
        const r = await escribirCampoDeal(leadId, { seccion: 'fiscal', campo, valor } as unknown as CambioCampoDeal, autorDe(ctx));
        if (r.ok && r.cambio) completados.push(rotuloCampoDeal('fiscal', campo));
      }
      invalidarPagos();
      return {
        ok: true,
        resumen: `Listo: «${g.docNombre}» quedó como documento fiscal${completados.length ? ` y completé ${completados.join(', ')}` : ''}.`,
        datos: { documento: g.docNombre, completados },
      };
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
      // De CUALQUIER CRM (mig 0324): una cuota de una renovación también se cobra por su id.
      const pagos = await getPagosByLead(lead.id, 'todos').catch(() => null);
      if (!pagos) return { error: 'No pude leer las cuotas. Prueba de nuevo en un rato.', falla: true };
      const q = pagos.find((p) => p.id === Number(input.cuotaId));
      if (!q) return { error: `La cuota #${String(input.cuotaId)} no es de ${lead.nombre}. Pide cobranza_lead para ver sus cuotas.`, disponibles: pagos.map((p) => ({ cuotaId: p.id, numero: p.numero, monto_usd: p.monto_usd, pagada: p.pagado })) };
      if (q.pagado) return { error: `${nombreCuota(q.numero)} ya está cobrada: para corregirla, desmárcala con marcar_pago_cobrado.` };
      const monto = n(input.montoUsd);
      const vence = s(input.vence);
      if (monto == null && vence == null) return { error: 'Pasa el monto nuevo (montoUsd) o el vencimiento nuevo (vence).', faltan: ['montoUsd', 'vence'] };
      if (vence && !/^\d{4}-\d{2}-\d{2}$/.test(vence)) return { error: 'El vencimiento tiene que ser AAAA-MM-DD.' };
      // Fail-closed: «no pude ver si tiene un link» no es «no tiene».
      const protMapa = await proteccionesDeCuotas(lead.id, [q.id]).catch(() => null);
      if (!protMapa) return { error: 'No pude revisar si la cuota tiene un link o un recordatorio. Prueba de nuevo en un rato.', falla: true };
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
      // De CUALQUIER CRM (mig 0324): una cuota de una renovación también se cobra por su id.
      const pagos = await getPagosByLead(lead.id, 'todos').catch(() => null);
      if (!pagos) return { error: 'No pude leer las cuotas. Prueba de nuevo en un rato.', falla: true };
      const q = pagos.find((p) => p.id === Number(input.cuotaId));
      if (!q) return { error: `La cuota #${String(input.cuotaId)} no es de ${lead.nombre}. Pide cobranza_lead para ver sus cuotas.` };
      if (q.pagado) return { error: `${nombreCuota(q.numero)} ya está cobrada.`, yaEstaba: true };
      const pasarela: Pasarela = esPasarela(input.pasarela) ? input.pasarela : 'stripe';
      if (pasarela === 'mercadopago') return { error: 'Mercado Pago cobra en la moneda de tu cuenta y la cuota está en dólares: ese link se crea desde la ficha del lead, con el monto en tu moneda.', faltan: ['monto'] };
      const conectadas = await pasarelasConectadas(ctx.ws).catch(() => null);
      if (!conectadas) return { error: 'No pude leer las pasarelas conectadas. Prueba de nuevo en un rato.', falla: true };
      if (!conectadas.includes(pasarela)) return { error: `${NOMBRE_PASARELA[pasarela]} no está conectado en este negocio.`, faltan: ['pasarela'], falta: { servicio: pasarela } };
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
      const q = (await getPagosByLead(lead.id, 'todos').catch(() => [])).find((p) => p.id === Number(input.cuotaId));
      if (!q) return { error: `La cuota #${String(input.cuotaId)} no es de ${lead.nombre}. Pide cobranza_lead para ver sus cuotas.` };
      const prot = await proteccionesDeCuotas(lead.id, [q.id]).catch(() => null);
      if (!prot) return { error: 'No pude revisar los recordatorios de la cuota. Prueba de nuevo en un rato.', falla: true };
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
      if (!pagos) return { error: 'No pude leer las cuotas. Prueba de nuevo en un rato.', falla: true };
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
      if (!cobros) return { error: 'No pude leer los cobros del lead. Prueba de nuevo en un rato.', falla: true };
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
  // ── Customers del super admin (25/10/2026): lib/clientes-plataforma.ts y lib/agente-sesiones.ts ─────────────────
  // El gating `soloPlataforma` ya lo dice; el runner lo vuelve a preguntar (AGENTS.md).
  // Va ANTES de vender_plan_mako: tests/api-mako-vender-plan.test.ts recorta ese runner hasta el cierre del objeto, y con
  // estos dos detrás el recorte pasaba su techo de 7000 caracteres (el test fallaba al cargar).
  // ⚠️ Y EN LA APP, EL SUPER ADMIN GLOBAL (revisión del tren, hallazgo 8): `rolMinimo: 'admin'` + `soloPlataforma` es el admin
  // DEL WORKSPACE de la plataforma (lo mismo que dice vender_plan_mako), y /customers exige `getSesionAdmin`. Sin esto, alguien
  // sumado al equipo de MaKo con rol admin veía por el chat lo que la pantalla le niega. Sólo en la app, que es donde hay
  // sesión: por WhatsApp habla el grupo de la plataforma, sin cookies. Un flujo corre con canal 'app' y sin sesión: no pasa.
  ver_clientes_de_mako: {
    leer: async (input, ctx) => {
      if (ctx.ws !== (await wsSuperAdmin())) return fallo('Los clientes de MaKo son sólo de la plataforma.');
      if (ctx.canal === 'app' && !(await esSuperAdmin())) return fallo('Los clientes de MaKo son sólo del super admin.');
      const v = await vistaDeClientes();
      const seg = typeof input.segmento === 'string' ? input.segmento : null;
      const filas = seg ? v.filas.filter((f) => (f.segmentos as string[]).includes(seg)) : v.filas;
      return json({
        numeros: {
          mrr_usd: v.kpis.mrrUsd, suscripciones_sin_dolares: v.kpis.sinDolares, pagan: v.kpis.pagan, activos: v.kpis.activos,
          nuevos_30_dias: v.kpis.nuevos30, en_riesgo: v.kpis.enRiesgo, por_segmento: v.kpis.porSegmento,
          cobrado_por_mes: v.cobrado, cuotas_vencidas: v.vencido,
        },
        clientes: filas.map((f) => ({
          ws: f.ws, nombre: f.nombre, segmentos: f.segmentos, agencia: f.agencia, plan: nombreDePlan(f.capa), estado: f.estado,
          mrr_usd: f.mrrUsd, en_prueba: f.prueba, en_riesgo: f.riesgo, por_que_en_riesgo: f.motivoRiesgo,
          dias_sin_entrar: f.sinEntrar, leads: f.leads, dias_sin_leads: f.sinLeads, onboarding_hecho: f.onboardingHecho,
          sesiones_agente_30_dias: f.sesionesAgente, pago_pendiente: f.pagoPendiente, plan_a_mano: f.planAManoTxt, desde: f.creado.slice(0, 10),
        })),
        // Lo que pide atención, el más grave primero (lo mismo que «Para mirar» en la pantalla).
        para_mirar: v.paraMirar.map((a) => ({ ws: a.ws, nombre: a.nombre, motivo: a.motivo, que_pasa: a.texto })),
        avisos: v.avisos,
        nota: 'mrr_usd sale de lo que cada negocio PAGÓ como su mensualidad (lo mismo que ver_ingresos_de_mako), no del precio del plan: un plan dado a mano da 0. cobrado_por_mes null = no entró nada por la plataforma en 6 meses. por_que_en_riesgo: pausado, cobro (un cobro falló) o sin-uso (nadie de su equipo entra hace 14 días o más). dias_sin_entrar null = nunca entró nadie de su equipo (o no se pudo leer: ver avisos); a un cliente de-agencia lo opera su agencia con su propia sesión, que no cuenta, y por eso nunca está en riesgo por sin-uso. onboarding_hecho null = no se pudo leer (ver avisos), no es «no lo terminó».',
      });
    },
  },

  ver_quieren_entrar: {
    leer: async (_input, ctx) => {
      if (ctx.ws !== (await wsSuperAdmin())) return fallo('Quién quiere entrar a MaKo es sólo de la plataforma.');
      if (ctx.canal === 'app' && !(await esSuperAdmin())) return fallo('Quién quiere entrar a MaKo es sólo del super admin.');
      const { pedidos, hayMas } = await pedidosPendientes();
      return json({
        pedidos: pedidos.map((p) => ({
          email: p.email, nombre: p.nombre, correo_verificado: p.correo_verificado, detalle: p.detalle, whatsapp: p.whatsapp,
          lead_id: p.lead_id, intentos: p.intentos, primer_intento: p.primer_at, ultimo_intento: p.ultimo_at,
        })),
        hay_mas: hayMas,
        nota: 'Para darle de alta: Admin › Accounts › Quieren entrar › Dar de alta. Un correo sin verificar lo escribió la persona: nadie confirmó que sea suyo.',
      });
    },
  },

  ver_agentes_de_clientes: {
    leer: async (input, ctx) => {
      if (ctx.ws !== (await wsSuperAdmin())) return fallo('Lo que hacen los clientes en su Claude Code es sólo de la plataforma.');
      if (ctx.canal === 'app' && !(await esSuperAdmin())) return fallo('Lo que hacen los clientes en su Claude Code es sólo del super admin.');
      const limite = typeof input.limite === 'number' && input.limite >= 1 ? Math.min(50, Math.floor(input.limite)) : 20;
      const { sesiones, nombreWs } = await leerSesionesAgente();
      return json({
        sesiones: sesiones.slice(0, limite).map((s) => ({
          negocio: nombreWs.get(s.workspace_id) ?? `Workspace ${s.workspace_id}`, cuando: s.empezo_en ?? s.created_at,
          titulo: s.acta?.titulo ?? null, resumen: s.acta?.resumen ?? null, mensajes: s.turnos?.length ?? 0,
        })),
        total: sesiones.length,
        nota: 'Los mensajes textuales están en Admin › Agents.',
      });
    },
  },

  armar_plan_por_tramos: {
    preparar: async (input) => {
      const lead = await getLead(Number(input.leadId)).catch(() => null);
      if (!lead) return { error: noExisteLead(input.leadId) };
      const tipo = ventaTipoDe(lead.venta_tipo);
      if (tipo === 'suscripcion') return { error: `${lead.nombre} es una suscripción: pásala a pago único con editar_venta_lead (tipo unico) y después arma el plan.` };
      if (tipo === 'sin_cobro') return { error: `${lead.nombre} está como becado (sin cobro): si ahora paga, sácalo con editar_venta_lead (tipo unico) y después arma el plan.` };
      const desde = s(input.primeraCuota);
      if (!desde || !esDia(desde)) return { error: 'La primera cuota va como AAAA-MM-DD.', faltan: ['primeraCuota'] };
      const crudos = (Array.isArray(input.tramos) ? input.tramos : []) as Array<Record<string, unknown>>;
      if (crudos.some((t) => t.hasta !== undefined && !esDia(s(t.hasta)))) return { error: '«hasta» va como AAAA-MM-DD.' };
      const tramos = crudos.map(tramoDeInput);
      if (input.anticipo !== undefined && input.sinAnticipo === true) return { error: 'Pasa el anticipo o sinAnticipo, no los dos.' };
      const pagos = await getPagosByLead(lead.id).catch(() => null);
      if (!pagos) return { error: 'No pude leer las cuotas. Prueba de nuevo en un rato.', falla: true };
      // Fail-closed: «no pude ver si tiene un link» no es «no tiene».
      const protMapa = await proteccionesDeCuotas(lead.id, pagos.filter((q) => !q.pagado && !noEsDeuda(q)).map((q) => q.id)).catch(() => null);
      if (!protMapa) return { error: 'No pude revisar si las cuotas tienen un link o un recordatorio. Prueba de nuevo en un rato.', falla: true };
      const hoy = await hoyEnWorkspace();
      const planConInicial = (Number(lead.cobro_inicial_usd) || 0) > 0;
      // El anticipo: el que se pide, ninguno, o el que ya tiene sin cobrar (como la ficha al abrir: sale de una fila #0 VIVA,
      // nunca de la columna, revisión de 9fc4030dd).
      let anticipo: AnticipoPlan | null = null;
      if (input.anticipo !== undefined) {
        const p = plataDeCuota({ monto: input.anticipo, moneda: input.anticipoMoneda, montoUsd: input.anticipoUsd });
        if (!p.ok) return { error: `Anticipo: ${p.error}` };
        const fecha = s(input.anticipoFecha) ?? hoy;
        if (!esDia(fecha)) return { error: 'La fecha del anticipo va como AAAA-MM-DD.' };
        anticipo = { monto_usd: p.monto_usd, moneda: p.moneda, monto_original: p.monto_original, fecha };
      } else if (input.sinAnticipo !== true && planConInicial) {
        const cero = pagos.find((q) => q.numero === 0 && !q.pagado && !noEsDeuda(q));
        if (cero) { const a = armadaDe(cero); anticipo = { monto_usd: a.monto_usd, moneda: a.moneda, monto_original: a.monto_original, fecha: cero.fecha_esperada ?? hoy }; }
      }
      const plan = planPorTramosDelServer({
        pagos, protegidas: new Set([...protMapa].filter(([, x]) => x.length > 0).map(([id]) => id)),
        planConInicial, cobroInicialUsd: lead.cobro_inicial_usd ?? null, desde, tramos, anticipo,
      });
      if (!plan.ok) return { error: plan.error };
      // Un anticipo nuevo sobre uno cobrado no se crea (`cuotasDelPlanPorTramos`): prometerlo era confirmar plata que no queda
      // como deuda (revisión de 805afb460, N4). La ficha ni lo deja escribir.
      // Y un #0 cobrado con la columna vacía (revisión de 7f79a4e6c, B10): el anticipo pedido quedaba como una cuota de hoy.
      const ceroCobrado = pagos.some((q) => q.numero === 0 && q.pagado && !noEsDeuda(q));
      if (input.anticipo !== undefined && (plan.inicialCobrado || ceroCobrado)) return { error: `El anticipo de ${lead.nombre} ya está cobrado: no se pide otro. Para cobrar algo más, agrégalo como un tramo.` };
      // Lo que se confirma es lo que QUEDA: la reconciliación del server sobre lo leído, sin escribir (N2).
      const existentes = pagos.map((q) => cuotaExistenteDe(q, protMapa.get(q.id) ?? []));
      const reconciliado = reconciliarCuotas(existentes, plan.deseadas, 'porId', { vistos: new Set(plan.vistos), protegidasPrimero: true });
      return {
        // `vistas`: las impagas leídas acá, con su firma. El «sí» puede llegar 2 h después, y vale sólo sobre esto (N1 y B8,
        // `faltaParaConfirmar`).
        payload: { leadId: lead.id, primeraCuota: desde, tramos, anticipo, vistas: cuotasVistas(pagos, plan.vistos) },
        resumen: resumenDelPlan(lead, cuotasQueQuedan(existentes, reconciliado), reconciliado, anticipo != null || planConInicial),
      };
    },
    // Antes de reclamar la pendiente (lib/api-mako/acciones.ts): si el plan cambió desde la propuesta, el «sí» no la quema.
    // Una que cambió, o una de antes de la firma (B9), no se cumple nunca: se cierra (`yaNoVale`, B12).
    faltaParaConfirmar: async (payload, ctx) => {
      const vistas = cuotasVistasDe(payload.vistas);
      if (!vistas) return { yaNoVale: PROPUESTA_DE_ANTES };
      const pagos = await runWithWorkspace(ctx.ws, () => getPagosByLead(Number(payload.leadId))).catch(() => null);
      if (!pagos) return 'No pude revisar si el plan de cuotas cambió. Prueba de nuevo en un rato.';
      const cambio = planCambioDesde(pagos, vistas);
      return cambio ? { yaNoVale: cambio } : null;
    },
    ejecutar: (payload, ctx) => seguro('armar el plan', async () => {
      const vistas = cuotasVistasDe(payload.vistas);
      if (!vistas) return { ok: false, resumen: PROPUESTA_DE_ANTES };
      const r = await guardarPlanPorTramos(Number(payload.leadId), {
        desde: String(payload.primeraCuota), tramos: (payload.tramos as TramoPlan[]) ?? [], anticipo: (payload.anticipo as AnticipoPlan | null) ?? null, vistas,
      }, autorDe(ctx));
      invalidarPagos();
      return {
        ok: true,
        resumen: r.sinTocar ? `Guardé el plan de ${r.cuotas} cuota(s) menos lo que no se puede cambiar (${r.sinTocar}).` : `Listo: plan de ${r.cuotas} cuota(s) guardado.`,
        datos: { cuotas: r.cuotas, actualizadas: r.cambios.actualizar.length, nuevas: r.cambios.insertar.length, quitadas: r.cambios.borrar.length, sinTocar: r.sinTocar },
      };
    }),
  },

  // ── La tarjeta «Pagos › Leer comprobante» (5/11/2026, lib/comprobantes.ts). Lee y guarda; nunca marca nada cobrado.
  leer_comprobante: {
    preparar: async (input) => {
      const lead = await getLead(Number(input.leadId)).catch(() => null);
      if (!lead) return { error: noExisteLead(input.leadId) };
      return { payload: { leadId: lead.id }, resumen: `Leer con tu IA el último comprobante que mandó ${lead.nombre} por WhatsApp y compararlo con la cuota que le toca. No marca nada cobrado.` };
    },
    ejecutar: (payload, ctx) => seguro('leer el comprobante', async () => {
      const { leerComprobanteDelLead } = await import('@/lib/comprobantes');
      const leadId = Number(payload.leadId);
      const flujo = ctx.canalKey.startsWith(PREFIJO_FLUJO);
      const r = await leerComprobanteDelLead(ctx.ws, leadId, { origen: flujo ? 'flujo' : ctx.canal === 'http' ? 'api' : 'chat' });
      if (!r.ok) return { ok: false, resumen: r.error };
      if (!r.ya) await logLeadEvent(leadId, 'Comprobante leído', r.comprobante.resumen, autorDe(ctx));
      return {
        ok: true, resumen: r.ya ? `Ese comprobante ya estaba leído. ${r.comprobante.resumen}` : r.comprobante.resumen,
        datos: { comprobanteId: r.comprobante.id, resultado: r.comprobante.resultado, monto: r.comprobante.lectura.monto, moneda: r.comprobante.lectura.moneda, operacion: r.comprobante.lectura.operacion },
      };
    }),
  },

  // ── La tarjeta «Pagos › Emitir recibo» (5/11/2026, lib/recibos-negocio.ts). Un recibo por pago; sale como el negocio.
  emitir_recibo: {
    preparar: async (input) => {
      const lead = await getLead(Number(input.leadId)).catch(() => null);
      if (!lead) return { error: noExisteLead(input.leadId) };
      const { esPlantillaRecibo, esCanalRecibo, PLANTILLAS_RECIBO, ROTULO_CANAL_RECIBO } = await import('@/lib/recibo-negocio-reglas');
      const plantilla = input.plantilla == null || input.plantilla === '' ? 'clasico' : input.plantilla;
      const canal = input.canal == null || input.canal === '' ? 'whatsapp' : input.canal;
      if (!esPlantillaRecibo(plantilla)) return { error: 'Esa plantilla no existe: clasico, compacto o marca.' };
      if (!esCanalRecibo(canal)) return { error: 'El recibo sale por whatsapp, email o grupo.' };
      const pagoId = input.pagoId == null ? null : Number(input.pagoId);
      const nombre = PLANTILLAS_RECIBO.find((x) => x.id === plantilla)?.nombre ?? plantilla;
      return {
        payload: { leadId: lead.id, plantilla, canal, pagoId },
        resumen: `Emitir el recibo de ${pagoId ? `la cuota #${pagoId}` : 'la última cuota cobrada'} de ${lead.nombre} con la plantilla «${nombre}» y mandarlo ${ROTULO_CANAL_RECIBO[canal].toLowerCase()}. No se deshace.`,
      };
    },
    ejecutar: (payload, ctx) => seguro('emitir el recibo', async () => {
      const { emitirReciboDelLead } = await import('@/lib/recibos-negocio');
      const leadId = Number(payload.leadId);
      const r = await emitirReciboDelLead(ctx.ws, leadId, {
        pagoId: payload.pagoId == null ? null : Number(payload.pagoId), plantilla: payload.plantilla as never, canal: payload.canal as never, autor: autorDe(ctx),
      });
      if (!r.ok) return { ok: false, resumen: r.error };
      if (!r.yaEstaba) await logLeadEvent(leadId, 'Recibo de pago', r.resumen, autorDe(ctx));
      return { ok: true, resumen: r.resumen, datos: { numero: r.numero, yaEstaba: r.yaEstaba } };
    }),
  },

  // ── Los recibos de MaKo (5/11/2026, lib/recibos.ts) ─────────────────────────────────────────────────────────────
  // Sólo la plataforma, y en la app el super admin GLOBAL (como ver_clientes_de_mako): son los pagos de todos los negocios.
  ver_recibos: {
    leer: async (input, ctx) => {
      if (ctx.ws !== (await wsSuperAdmin())) return fallo('Los recibos de MaKo son sólo de la plataforma.');
      if (ctx.canal === 'app' && !(await esSuperAdmin())) return fallo('Los recibos de MaKo son sólo del super admin.');
      const { listarRecibos } = await import('@/lib/recibos');
      const est = s(input.estado);
      const r = await listarRecibos({
        mes: s(input.mes), destinoWs: n(input.cuenta), medio: s(input.medio), soloFallas: input.soloFallas === true, limite: 100,
        estado: est && ['emitido', 'devuelto', 'devuelto_parcial', 'contracargo', 'anulado'].includes(est) ? est as 'emitido' : null,
      });
      if (r.faltaLaMigracion) return fallo('Los recibos todavía no están listos en la base (falta la migración 0397).');
      return json({
        recibos: r.recibos.map((x) => ({
          numero: x.numero, a_nombre: x.a_nombre, cuenta: x.destino_ws, origen: x.origen, estado: x.estado, recibido: x.totales_recibido,
          detalle: x.lineas, pagos: x.pagos.filter((p) => !p.anulado).map((p) => ({ medio: p.medio, referencia: p.referencia, fecha: p.fecha, monto: p.monto, moneda: p.moneda })),
          fecha_pago: x.fecha_pago, correo: x.correo_estado, whatsapp: x.wa_estado, error: x.correo_error ?? x.wa_error, nota_interna: x.nota_interna,
        })),
        al_tope: r.alTope,
        nota: 'Es un recibo de pago, no una factura fiscal. Lo recibido va por moneda: nunca se suma entre monedas. Un recibo anulado deja su número gastado.',
      });
    },
  },

  cargar_pago_a_mano: {
    preparar: async (input, ctx) => {
      if (ctx.canalKey?.startsWith(PREFIJO_FLUJO)) return { error: 'Una automatización no carga pagos de MaKo: se hace en Billing o por el chat.' };
      if (ctx.ws !== (await wsSuperAdmin())) return { error: 'Los recibos de MaKo son sólo de la plataforma.' };
      const cuenta = n(input.cuenta);
      const lineas = Array.isArray(input.lineas) ? input.lineas as Array<Record<string, unknown>> : [];
      const pagos = Array.isArray(input.pagos) ? input.pagos as Array<Record<string, unknown>> : [];
      if (!cuenta || !lineas.length || !pagos.length) return { error: 'Faltan la cuenta, qué se pagó o cómo se pagó.' };
      const { referenciaNormal, esMedio, totalesEnTexto } = await import('@/lib/recibos-reglas');
      for (const p of pagos) {
        const medio = s(p.medio);
        if (!medio || !esMedio(medio) || !referenciaNormal(medio, p.referencia)) return { error: medio === 'binance' ? 'La orden de Binance son los 18 dígitos del «Order ID».' : 'Cada pago necesita su medio y su referencia.' };
      }
      const { reciboDePago } = await import('@/lib/recibos');
      for (const p of pagos) {
        const ya = await reciboDePago(String(p.medio), String(p.referencia)).catch(() => null);
        if (ya) return { error: `Esa orden (${String(p.referencia).trim()}) ya está en el recibo N.º ${String(ya.numero).padStart(4, '0')}.`, yaEstaba: true };
      }
      const suma = (xs: Array<Record<string, unknown>>) => {
        const t: Record<string, number> = {};
        for (const x of xs) { const m = String(s(x.moneda) ?? '').toUpperCase(); t[m] = (t[m] ?? 0) + (n(x.monto) ?? 0); }
        return Object.entries(t).map(([moneda, monto]) => ({ moneda, monto }));
      };
      const formId = crypto.randomUUID();
      return {
        payload: { formId, cuenta, aNombre: s(input.aNombre) ?? '', lineas, pagos, notaPdf: s(input.notaPdf), notaInterna: s(input.notaInterna), enviar: input.enviar !== false },
        resumen: `Emitir el recibo de ${s(input.aNombre) ?? `la cuenta ${cuenta}`} (cuenta ${cuenta}): ${lineas.map((l) => s(l.concepto)).filter(Boolean).join(', ')}, por ${totalesEnTexto(suma(lineas))}; recibido ${totalesEnTexto(suma(pagos))} (${pagos.map((p) => `${s(p.medio)} ${s(p.referencia)}`).join(', ')}).${input.enviar === false ? ' Sin enviarlo.' : ' Sale por correo a los admins de la cuenta, y a su grupo de MaKo si va.'} Es un recibo de pago, no una factura fiscal.`,
      };
    },
    faltaParaConfirmar: async () => ((await esSuperAdmin()) ? null : 'Sólo el super admin carga pagos de MaKo.'),
    ejecutar: (payload, ctx) => seguro('emitir el recibo', async () => {
      if (!(await esSuperAdmin())) return { ok: false, resumen: 'Sólo el super admin carga pagos de MaKo.' };
      if (ctx.ws !== (await wsSuperAdmin())) return { ok: false, resumen: 'Los recibos de MaKo son sólo de la plataforma.' };
      const { emitirReciboManual } = await import('@/lib/recibos');
      const p = payload as { formId: string; cuenta: number; aNombre: string; lineas: Array<Record<string, unknown>>; pagos: Array<Record<string, unknown>>; notaPdf: string | null; notaInterna: string | null; enviar: boolean };
      const r = await emitirReciboManual({
        formId: p.formId, destinoWs: Number(p.cuenta), aNombre: p.aNombre, notaPdf: p.notaPdf, notaInterna: p.notaInterna, enviar: p.enviar, autor: autorDe(ctx),
        lineas: p.lineas.map((l) => ({ concepto: String(l.concepto ?? ''), mes: s(l.mes), monto: Number(l.monto), moneda: String(l.moneda ?? '') })),
        pagos: p.pagos.map((x) => ({ medio: String(x.medio ?? ''), referencia: String(x.referencia ?? ''), fecha: String(x.fecha ?? ''), monto: Number(x.monto), moneda: String(x.moneda ?? ''), de: s(x.de) })),
      });
      if (!r.ok) return { ok: false, resumen: `No se emitió: ${r.error}` };
      const nro = String(r.numero).padStart(4, '0');
      return {
        ok: true, ...(r.yaEstaba ? { yaEstaba: true } : {}),
        resumen: r.yaEstaba ? `Ya estaba: recibo N.º ${nro}.` : `Listo: recibo N.º ${nro}${p.enviar ? ', enviado' : ', sin enviar'}. Está en Admin › Billing › Recibos.${r.aviso ? ` ${r.aviso}` : ''}`,
        datos: { reciboId: r.id, numero: r.numero },
      };
    }),
  },

  reenviar_recibo: {
    preparar: async (input, ctx) => {
      if (ctx.canalKey?.startsWith(PREFIJO_FLUJO)) return { error: 'Una automatización no reenvía recibos de MaKo.' };
      if (ctx.ws !== (await wsSuperAdmin())) return { error: 'Los recibos de MaKo son sólo de la plataforma.' };
      const numero = n(input.numero);
      if (!numero) return { error: 'Falta el número del recibo.' };
      const { getSupabaseServer } = await import('@/lib/supabase');
      const { data, error } = await getSupabaseServer().from('recibos').select('id, numero, a_nombre, estado, correo_a').eq('numero', numero).maybeSingle();
      if (error) return { error: 'No pude leer el recibo. Intenta de nuevo.', falla: true };
      const f = data as { id: number; numero: number; a_nombre: string; estado: string; correo_a: string[] | null } | null;
      if (!f) return { error: `No hay un recibo N.º ${String(numero).padStart(4, '0')}.` };
      if (f.estado !== 'emitido') return { error: f.estado === 'anulado' ? 'Un recibo anulado no se reenvía.' : 'Ese recibo ya no está vigente: no se reenvía.' };
      const correo = s(input.correo)?.toLowerCase() ?? null;
      if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return { error: 'Ese correo no es válido.' };
      return {
        payload: { id: Number(f.id), correo },
        resumen: `Reenviar el recibo N.º ${String(f.numero).padStart(4, '0')} de ${f.a_nombre} ${correo ? `a ${correo}` : `a ${f.correo_a?.length ? f.correo_a.join(', ') : 'los admins de su cuenta'}`}, y a su grupo de MaKo si va.`,
      };
    },
    faltaParaConfirmar: async () => ((await esSuperAdmin()) ? null : 'Sólo el super admin reenvía recibos de MaKo.'),
    ejecutar: (payload, ctx) => seguro('reenviar el recibo', async () => {
      if (!(await esSuperAdmin())) return { ok: false, resumen: 'Sólo el super admin reenvía recibos de MaKo.' };
      const { reenviarRecibo } = await import('@/lib/recibos');
      const r = await reenviarRecibo(Number(payload.id), { autor: autorDe(ctx), correo: (payload.correo as string | null) ?? null });
      if (!r.ok) return { ok: false, resumen: r.error };
      return { ok: true, resumen: `Listo: el correo quedó ${r.resultado?.correo ?? 'pendiente'} y WhatsApp ${r.resultado?.whatsapp ?? 'pendiente'}.` };
    }),
  },
  // «Vender un plan» (23/10/2026, P0-8): ver cobros.def.ts. El MISMO camino que /admin/cobros (`venderPlan`, lib/vender-plan.ts).
  // La revisión adversarial del mismo día (wf_fbeb8485-d3c) le sumó:
  //   · el super admin GLOBAL al confirmar y al ejecutar (`esSuperAdmin`). `rolMinimo: 'admin'` + `soloPlataforma` es el admin
  //     DEL WORKSPACE de la plataforma, no el super admin, y la pantalla de Cobros exige el super admin (`getSesionAdmin`). Al
  //     proponer no se exige: por WhatsApp no hay sesión, y proponer no es vender;
  //   · nunca desde un flujo: un paso «⚡ Acción» se confirma solo (`aplicarEnElActo`). Va en preparar porque al confirmar se
  //     vuelve a llamar con el mismo ctx, y además está en NO_EN_FLUJOS (lib/api-mako/flujo.ts);
  //   · lo que va a cobrar (la pasarela, la moneda y el valor en dólares) se decide ANTES del «sí» (`previaDeLaVenta`), y el
  //     resumen lo dice: antes una venta en otra moneda sin dólares se caía después del «sí», con el lead ya creado;
  //   · el comprador sin mayúsculas, un link pendiente del mismo plan que no se duplica, y la cuenta que ya existe;
  //   · el resumen de lo hecho dice dónde quedó el link (Cobros, con su número): en /mako/revisar `paraLaPersona` no se muestra.
  vender_plan_mako: {
    preparar: async (input, ctx) => {
      if (ctx.canalKey?.startsWith(PREFIJO_FLUJO)) return { error: 'Una automatización no vende planes de MaKo: se pide en Cobros o por el chat.' };
      // El gating `soloPlataforma` ya lo dice; el runner lo vuelve a preguntar (AGENTS.md: «el runner lo vuelve a
      // preguntar»). Y el workspace del cobro es SIEMPRE el de la plataforma, nunca el que traiga el pedido.
      const plataforma = await wsSuperAdmin();
      if (ctx.ws !== plataforma) return { error: 'Vender un plan de MaKo es sólo de la plataforma.' };
      const val = ventaValida({ capa: s(input.capa) ?? '', email: s(input.email) ?? '', nombre: s(input.nombre) ?? '', monto: n(input.monto) ?? NaN, moneda: s(input.moneda), montoUsd: n(input.montoUsd), tipo: input.tipo === 'suscripcion' ? 'suscripcion' : 'unico', pasarela: esPasarela(input.pasarela) ? input.pasarela : null, refCodigo: s(input.codigoPartner) });
      if (!val.ok) return { error: val.error };
      const v = val.venta;
      let comprador: Awaited<ReturnType<typeof compradorEnLaPlataforma>>;
      try { comprador = await compradorEnLaPlataforma(v.email); } catch { return { error: 'No pude buscar a la persona en el CRM de la plataforma. Intenta de nuevo.', falla: true }; }
      if (comprador && 'ambiguo' in comprador) return { error: 'Hay más de un lead con ese email en el CRM de la plataforma: no elijo uno a ciegas. Unifícalos en el CRM y vuelve a pedirlo.' };
      // Lo que va a cobrar el link, con las reglas de crearCobro: la pasarela, la moneda (la de su cuenta, con Mercado Pago)
      // y el valor en dólares.
      const p = await previaDeLaVenta(v, plataforma);
      if (!p.ok) return { error: p.error, faltan: p.faltan };
      if (comprador) {
        let abierto: Awaited<ReturnType<typeof cobroAbiertoDelPlan>>;
        try { abierto = await cobroAbiertoDelPlan(plataforma, comprador.id, v.capa); } catch { return { error: 'No pude revisar los cobros de esa persona. Intenta de nuevo.', falla: true }; }
        if (abierto && 'pendiente' in abierto) {
          const c = abierto.pendiente;
          return {
            error: `Ya tiene un link pendiente de ese plan (cobro #${c.id}, ${formatoMonto(c.monto, c.moneda)}): no creé otro. Para otro precio, anula ése con anular_link_pago.`,
            yaEstaba: true,
            paraLaPersona: `Link de pago: ${linkDelCobro(c.token)}`,
          };
        }
        if (abierto) return { error: `Ya pagó ese plan (cobro #${abierto.pagado.id}) y su cuenta todavía no quedó dada de alta: se revisa en Cobros.` };
      }
      let cuenta: Awaited<ReturnType<typeof cuentaDelComprador>>;
      try { cuenta = await cuentaDelComprador(v.email); } catch { return { error: 'No pude revisar si ese email ya tiene cuenta de MaKo. Intenta de nuevo.', falla: true }; }
      if (cuenta === 'plataforma') return { error: 'Ese email es del equipo de MaKo: no se le vende un plan.' };
      if (cuenta === 'equipo') return { error: 'Ese email es del equipo de otro negocio, no su dueño: a esa cuenta no se le vende un plan.' };
      const plan = capaDef(v.capa).nombre;
      const alPagar = cuenta === 'duena'
        ? ' Ese email ya tiene cuenta de MaKo: al pagarlo el plan NO cambia solo, se le da desde Cobros con «Darle el plan a su cuenta».'
        : ' Al pagarlo se le crea la cuenta y le llega el acceso.';
      return {
        payload: { ...v },
        resumen: `Crear el link de pago de ${NOMBRE_PASARELA[p.previa.pasarela]} del plan «${plan}» para ${v.nombre} (${v.email}): ${formatoMonto(p.previa.monto, p.previa.moneda)}${v.tipo === 'suscripcion' ? ' por mes' : ', pago único'}.${alPagar}${v.refCodigo ? ` Lo trajo el partner «${v.refCodigo}».` : ''} El link queda en Cobros.`,
      };
    },
    // Corre antes de marcar la propuesta aplicada (lib/api-mako/acciones.ts): un «no» acá no la quema.
    faltaParaConfirmar: async () => ((await esSuperAdmin()) ? null : NO_SUPER_ADMIN),
    ejecutar: (payload, ctx) => seguro('crear el link del plan', async () => {
      if (!(await esSuperAdmin())) return { ok: false, resumen: NO_SUPER_ADMIN };
      if (ctx.ws !== (await wsSuperAdmin())) return { ok: false, resumen: 'Vender un plan de MaKo es sólo de la plataforma.' };
      // `venderPlan` vuelve a validar todo (la capa, el email, lo que cobra, el lead del comprador) y resuelve el workspace él mismo.
      const r = await venderPlan(payload as Parameters<typeof venderPlan>[0], autorDe(ctx));
      if (!r.ok) return { ok: false, resumen: `No se pudo crear el link: ${r.error}` };
      // El link lo escribe el código y va a la persona (`paraLaPersona`) y en `datos`, nunca al resumen que lee el modelo:
      // un dato exacto que pasa por un modelo deja de ser exacto (AGENTS.md). El resumen dice dónde quedó.
      return {
        ok: true,
        resumen: r.yaEstaba
          ? `Ya tenía un link pendiente de ese plan (cobro #${r.cobroId}, ${formatoMonto(r.monto, r.moneda)}): no creé otro. Queda en Cobros, con «Copiar link».`
          : `Listo: link de pago del plan por ${formatoMonto(r.monto, r.moneda)} (cobro #${r.cobroId}). Queda en Cobros, con «Copiar link», para pasárselo a la persona.`,
        paraLaPersona: `Link de pago: ${r.link}`,
        datos: { cobroId: r.cobroId, url: r.link, monto: r.monto, moneda: r.moneda },
      };
    }),
  },

  ver_ingresos_de_mako: {
    leer: async (_input, ctx) => {
      if (ctx.ws !== (await wsSuperAdmin())) return fallo('Los ingresos de MaKo son sólo de la plataforma.');
      if (ctx.canal === 'app' && !(await esSuperAdmin())) return fallo('Los ingresos de MaKo son sólo del super admin.');
      const v = await vistaDeIngresos();
      return json({
        hoy: v.hoy,
        mrr_usd: v.mrr, mrr_cierre_mes_pasado_usd: v.mrrMesPasado, clientes_que_pagan: v.pagando, promedio_por_cliente_usd: v.arpu,
        cobrado_este_mes_usd: v.cobradoEsteMes, cobrado_mes_pasado_usd: v.cobradoMesPasado, cobrado_desde_siempre_usd: v.cobradoTotal,
        pagos_sin_dolares: v.sinDolares,
        meses: v.meses.map((m) => ({ mes: m.mes, en_curso: m.enCurso, mrr_al_cerrar_usd: m.mrr, cobrado_usd: m.cobrado, nuevos_usd: m.nuevo, volvieron_usd: m.vuelve, subieron_usd: m.sube, bajaron_usd: m.baja, se_cortaron_usd: m.corte })),
        clientes: v.clientes.map((c) => ({ nombre: c.nombre, ws: c.ws, lead_id: c.leadId, paga_por_mes_usd: c.mrr, pago_en_total_usd: c.total, pagos: c.pagos, estado: c.estado, primer_pago: c.primerPago, ultimo_pago: c.ultimoPago, proximo_vencimiento: c.proximo, dias_de_atraso: c.diasAtraso })),
        vence_en_31_dias: v.porCobrar.map((p) => ({ cliente: v.clientes.find((c) => c.clave === p.cliente)?.nombre ?? p.cliente, fecha: p.fecha, usd: p.usd, atrasado: p.atrasado })),
        movimientos: v.movimientos.slice(0, 30).map((m) => ({ fecha: m.fecha, cliente: v.clientes.find((c) => c.clave === m.cliente)?.nombre ?? m.cliente, tipo: m.tipo, cambio_usd: m.delta, paga_ahora_usd: m.despues })),
        avisos: v.avisos,
        nota: 'Todo en dólares. mrr_usd sale de lo que cada cliente PAGÓ como su mensualidad (un pago registrado como la mensualidad, una cuota de una venta de suscripción o la suscripción de la pasarela), no del precio del plan. Dos pagos a menos de 7 días son una sola mensualidad; cada una cubre un mes y la nueva reemplaza a la anterior (así sube o baja). Un atrasado sigue contando 15 días; pasado eso, se cortó el día que venció. cobrado_* es toda la plata que entró, también los pagos sueltos y las ventas de pago único. estado: atrasado, por-vencer (vence en 5 días o menos), al-dia, cortado o pago-unico.',
      });
    },
  },
};

// ── el plan por tramos ────────────────────────────────────────────────────────

/** Una propuesta sin `vistas` con su firma es de antes (revisión de 7f79a4e6c, B9): con la regla vieja, su «sí» pisaba lo de después. */
const PROPUESTA_DE_ANTES = 'Esta propuesta es de una versión anterior de MaKo: no guardé nada. Pídeme el plan de nuevo y lo armo sobre lo que hay ahora.';
const esDia = (f: string | null): f is string => !!f && /^\d{4}-\d{2}-\d{2}$/.test(f);
const dmy = (f: string): string => `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}`;
const plataDe = (c: { monto_usd: number; moneda: string | null; monto_original: number | null }): string =>
  (c.moneda && c.monto_original != null ? `${formatoMonto(c.monto_original, c.moneda)} (${formatoMonto(c.monto_usd, 'USD')})` : formatoMonto(c.monto_usd, 'USD'));

/** Un tramo como lo pide la API, en la forma de la ficha (`tramoDeForm`): sin días, el mes vence el día de su primera cuota y la
 *  quincena, el 1 y el 15. */
function tramoDeInput(t: Record<string, unknown>): TramoPlan {
  const cada: TramoPlan['cada'] = t.cada === 'quincena' ? 'quincena' : t.cada === 'semana' ? 'semana' : 'mes';
  const d1 = n(t.dia);
  return {
    monto: n(t.monto) ?? 0, moneda: s(t.moneda) ?? 'USD', montoUsd: n(t.montoUsd), cada,
    ...(cada === 'quincena' ? { dias: [d1 ?? 1, n(t.dia2) ?? 15] } : cada === 'mes' && d1 != null ? { dias: [d1] } : {}),
    cantidad: n(t.cuotas), hasta: s(t.hasta),
  };
}

/**
 * Lo que la persona confirma: el plan como QUEDA (`cuotasQueQuedan`, revisión de 805afb460, N2), no lo pedido. Cada cuota del plan
 * con su fecha y su monto, la cobrada y la que no se puede cambiar dichas; el total, lo ya cobrado, lo que queda sin cobrar APARTE
 * del plan (la diferencia de un cobro a medias: no se nombraba, y la venta parecía no cerrar, revisión de 7f79a4e6c, B11), lo que no
 * se toca y por qué, y la venta si no dice lo mismo. `conAnticipo`: el #0 es el anticipo. Con más de 24 cuotas, las 12 primeras y las 2 últimas.
 */
type LeadDelResumen = { nombre: string; monto_cierre_usd?: number | null };
function resumenDelPlan(lead: LeadDelResumen, quedan: readonly CuotaQueQueda[], plan: PlanDeCuotas, conAnticipo: boolean): string {
  const delPlan = quedan.filter((q) => q.delPlan).sort((a, b) => String(a.fecha_esperada ?? '9').localeCompare(String(b.fecha_esperada ?? '9')) || a.numero - b.numero);
  const anticipo = conAnticipo ? delPlan.find((q) => q.numero === 0) ?? null : null;
  const cuotas = delPlan.filter((q) => q !== anticipo);
  const como = (q: CuotaQueQueda) => (q.pagado ? ' (cobrada)' : q.motivo ? ' (queda como está)' : '');
  const filas = cuotas.map((q) => `${q.fecha_esperada ? dmy(q.fecha_esperada) : 'sin fecha'} ${plataDe(q)}${como(q)}`);
  const vistas = filas.length > 24 ? [...filas.slice(0, 12), `… ${filas.length - 14} más …`, ...filas.slice(-2)] : filas;
  const suma = (xs: readonly CuotaQueQueda[]) => Math.round(xs.reduce((t, q) => t + Number(q.monto_usd), 0) * 100) / 100;
  const total = suma(delPlan);
  const cobrado = suma(delPlan.filter((q) => q.pagado));
  const aparte = quedan.filter((q) => !q.delPlan && !q.pagado);
  const noSeToca = avisoDeConservadas(plan);
  const venta = Number(lead.monto_cierre_usd) || 0;
  return [
    `Plan de ${lead.nombre}: ${cuotas.length} cuota(s)${anticipo ? ` y un anticipo de ${plataDe(anticipo)}${anticipo.fecha_esperada ? ` el ${dmy(anticipo.fecha_esperada)}` : ''}${como(anticipo)}` : ''}.`,
    `Cuotas: ${vistas.join(' · ')}.`,
    `Total: ${formatoMonto(total, 'USD')}.${cobrado ? ` Ya cobrado: ${formatoMonto(cobrado, 'USD')}.` : ''}`,
    aparte.length ? `Aparte del plan queda sin cobrar: ${aparte.map((q) => `${nombreCuota(q.numero)} ${plataDe(q)}${q.fecha_esperada ? ` (${dmy(q.fecha_esperada)})` : ''}`).join(' · ')}.` : '',
    noSeToca ? `No se puede cambiar: ${noSeToca}.` : '',
    'Reemplaza las cuotas sin cobrar del plan.',
    Math.abs(venta - total - suma(aparte)) >= 0.01 ? `La venta dice ${venta ? formatoMonto(venta, 'USD') : 'que no tiene monto'}: el plan no la cambia (eso es editar_venta_lead).` : '',
  ].filter(Boolean).join(' ');
}
