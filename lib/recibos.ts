// =============================================================================
// recibos — el libro de RECIBOS de MaKo: emitir, mandar por correo y WhatsApp, devolver, anular (5/11/2026)
// =============================================================================
// Martín: «es súper importante que hagas un template que eso se envíe siempre por email de los recibos de compra. En este caso
// también por WhatsApp [...] me gustaría que todo esto lo vayamos evidentemente guardando dentro de la aplicación, dentro de
// SuperAdmin». El diseño y sus agujeros: docs/relevo/recibos-encargo.md. Lo que decide sin base: lib/recibos-reglas.ts. El PDF:
// lib/recibo-pdf.ts. El número: la función SQL `emitir_recibo` (mig 0397), que SÓLO se llama desde acá (tests/recibos.test.ts).
//
// QUIÉN LLAMA:
//   · lib/cobros.ts, `aplicarPagoAprobado` (el único punto por el que pasan el aviso, el cron y los repetidos): `reciboDelPago`
//     antes del CRM, y `despacharRecibo` justo antes del `return`. Sólo pagos `real` de la PLATAFORMA (`wsSuperAdmin()`): un
//     cliente que vende con su pasarela no genera recibos de MaKo.
//   · lib/cobros.ts, `aplicarReembolso`, `aplicarReembolsoFallido` y `aplicarContracargo`: `marcarDevolucionDeRecibo`,
//     `marcarDisputaDeRecibo`. Nunca tiran: una devolución de un cliente no se rompe por un recibo.
//   · el cron de cobros (app/api/cron/cobros-reconciliar): `recibosQueFaltan` (la red) y `despacharPendientes`.
//   · SuperAdmin (app/admin/cobros/recibos-actions.ts) y la API de MaKo (lib/api-mako/areas/cobros.run.ts).
//
// ⚠️ UN RECIBO NUNCA FRENA UN PAGO: todo lo que llama lib/cobros.ts va con `.catch`, y sin la mig 0397 (42P01, PGRST205, 42883,
// PGRST202) lo dice en el log y sigue.
// ⚠️ TODO lo que lee un setting corre adentro de `runWithWorkspace(plataforma)`: el cron no tiene contexto, y sin él `getSetting`
// cae al ws1 (Mauricio, un cliente) y el recibo saldría con SU emisor, para siempre (agujero 12).
// ⚠️ NADA LE ESCRIBE A UNA PERSONA POR WHATSAPP: sólo al grupo de MaKo del negocio (lib/mako-grupo.ts), que ya existe.

import 'server-only';
import crypto from 'node:crypto';
import { after } from 'next/server';
import { getSupabaseServer } from './supabase';
import { runWithWorkspace, wsSuperAdmin } from './workspace';
import { getSettingEstricto, setSetting } from './settings';
import { zonaDelNegocioEstricta } from './timezone';
import { EMAIL_MAKO } from './app-url';
import { avisarDePlataforma, mandarReciboPorEmail } from './invitaciones';
import { anotarLoDelEquipo, enviarPartesAlGrupoMaKo, grupoJidEstricto } from './mako-grupo';
import { atarIdDeWhatsApp, copiarAlGrupo } from './grupo-app';
import { KEY_QUIEN_PAGA, quienPagaDe } from './agency-reglas';
import type { Cobro } from './cobros-tipos';
import type { PartePreparada } from './mako-tarjeta';
import { pdfDelRecibo, type Comprobante, type FotoRecibo, type LineaRecibo, type PagoRecibo } from './recibo-pdf';
import {
  AVISO_TIPO_RECIBO, INTENTOS_CORREO, KEY_EMISOR, KEY_WA_SOLO, MEDIOS, ROTULO_MEDIO, claveDeEnvio, claveDeRecibo, correosDelRecibo, decidirCorreo, decidirWa,
  destinoDelRecibo, devolucionPorAvisar, instanteDeLaFecha, diaYMes, emisorDe, esConcurrenteDeResend, esMedio, leyendaDelMedio, mesDeFecha, mesEnTexto, nombreDelPdf, pieWhatsApp,
  referenciaNormal, rotulosDelDocumento, sniffComprobante, textoCorreo, textoCorreoDevolucion, textoDeInvalido, textoDeOcupado, totalesEnTexto, transicionRecibo,
  validarDestinoManual, type Destino, type EstadoRecibo, type EventoRecibo, type MedioRecibo, type PagaRecibo,
} from './recibos-reglas';

const db = () => getSupabaseServer();
const BUCKET = 'contratos';
/** Los recibos viven fuera de cualquier carpeta de un negocio: ningún borrado por prefijo de un workspace los alcanza. */
export const CARPETA_COMPROBANTES = 'plataforma/recibos/comprobantes/';
const CARPETA_PDF = 'plataforma/recibos/pdf/';
/**
 * La red no hace backfill: emite lo pagado desde el día en que existieron los recibos (5/11/2026, MEDIDO ese día: 0 cobros pagados
 * en la plataforma, así que no queda nada sin recibo antes de esta fecha).
 */
export const RECIBOS_DESDE = '2026-11-05T00:00:00Z';
const TOPE_RED = 50;
const TOPE_DESPACHO = 20;

/** La mig 0397 sin aplicar: la tabla o la función no están. */
export const faltaElLibro = (e: { code?: string | null } | null | undefined): boolean =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || e.code === '42883' || e.code === 'PGRST202');

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

// ─────────────────────────────────────────────────────────────────────────────
// Las filas
// ─────────────────────────────────────────────────────────────────────────────

export const COLS_RECIBO =
  'id, numero, clave, origen, estado, paga, solo_correo, cobro_id, destino_ws, agencia_ws, cliente_ws, a_nombre, email_cobro, mes, lineas, total_detalle, moneda_detalle, totales_recibido, total_recibido, moneda_recibido, impuesto, emisor, zona, nota_pdf, nota_interna, pdf_path, pdf_sha256, fecha_pago, emitido_por, emitido_at, correo_estado, correo_intentos, correo_lote, correo_tomado_at, correo_a, correo_ids, correo_at, correo_error, wa_estado, wa_tomado_at, wa_ws, wa_id, wa_at, wa_error, devuelto_at, devuelto_monto, devolucion_avisada, devolucion_correo_at, disputa_texto, anulado_at, anulado_por, historial, updated_at';

export type ReciboFila = {
  id: number; numero: number; clave: string; origen: 'pasarela' | 'manual'; estado: EstadoRecibo; paga: PagaRecibo; solo_correo: boolean;
  cobro_id: number | null; destino_ws: number | null; agencia_ws: number | null; cliente_ws: number | null; a_nombre: string; email_cobro: string | null;
  mes: string | null; lineas: LineaRecibo[]; total_detalle: number; moneda_detalle: string; totales_recibido: Array<{ moneda: string; monto: number }>;
  total_recibido: number | null; moneda_recibido: string | null; impuesto: number | null; emisor: unknown; zona: string; nota_pdf: string | null;
  nota_interna: string | null; pdf_path: string | null; pdf_sha256: string | null; fecha_pago: string; emitido_por: string; emitido_at: string;
  correo_estado: string; correo_intentos: number; correo_lote: number; correo_tomado_at: string | null; correo_a: string[] | null; correo_ids: string[] | null;
  correo_at: string | null; correo_error: string | null; wa_estado: string; wa_tomado_at: string | null; wa_ws: number | null; wa_id: string | null;
  wa_at: string | null; wa_error: string | null; devuelto_at: string | null; devuelto_monto: number | null; devolucion_avisada: string | null;
  devolucion_correo_at: string | null; disputa_texto: string | null; anulado_at: string | null; anulado_por: string | null;
  historial: Array<{ at: string; que: string; quien?: string }>; updated_at: string;
};

export type ReciboPagoFila = {
  id: number; recibo_id: number; medio: string; referencia: string; fecha: string; monto: number; moneda: string; monto_usd: number | null;
  impuesto: number | null; de: string | null; comprobante_path: string | null; comprobante_nombre: string | null; anulado: boolean;
};

const n = (v: unknown): number | null => (v == null || v === '' ? null : Number(v));
function reciboDeFila(f: Record<string, unknown>): ReciboFila {
  return {
    ...(f as unknown as ReciboFila),
    id: Number(f.id), numero: Number(f.numero), cobro_id: n(f.cobro_id), destino_ws: n(f.destino_ws), agencia_ws: n(f.agencia_ws), cliente_ws: n(f.cliente_ws),
    total_detalle: Number(f.total_detalle), total_recibido: n(f.total_recibido), impuesto: n(f.impuesto), correo_intentos: Number(f.correo_intentos ?? 0),
    correo_lote: Number(f.correo_lote ?? 1), wa_ws: n(f.wa_ws), devuelto_monto: n(f.devuelto_monto),
    lineas: Array.isArray(f.lineas) ? (f.lineas as LineaRecibo[]).map((l) => ({ ...l, monto: Number(l.monto) })) : [],
    totales_recibido: Array.isArray(f.totales_recibido) ? (f.totales_recibido as Array<{ moneda: string; monto: unknown }>).map((t) => ({ moneda: t.moneda, monto: Number(t.monto) })) : [],
    historial: Array.isArray(f.historial) ? (f.historial as ReciboFila['historial']) : [],
  };
}
const pagoDeFila = (f: Record<string, unknown>): ReciboPagoFila => ({
  ...(f as unknown as ReciboPagoFila), id: Number(f.id), recibo_id: Number(f.recibo_id), monto: Number(f.monto), monto_usd: n(f.monto_usd), impuesto: n(f.impuesto),
});

export async function leerRecibo(id: number): Promise<{ recibo: ReciboFila; pagos: ReciboPagoFila[] } | null> {
  const { data, error } = await db().from('recibos').select(COLS_RECIBO).eq('id', id).maybeSingle();
  if (error) throw new Error(`No pude leer el recibo ${id}: ${error.message}`);
  if (!data) return null;
  const { data: ps, error: e2 } = await db().from('recibo_pagos').select('*').eq('recibo_id', id).order('fecha', { ascending: true });
  if (e2) throw new Error(`No pude leer los pagos del recibo ${id}: ${e2.message}`);
  return { recibo: reciboDeFila(data as Record<string, unknown>), pagos: (ps ?? []).map((x) => pagoDeFila(x as Record<string, unknown>)) };
}

/** ¿Este pago ya está en un recibo? Lo usa la rama de agencias para saber si un comprobante del grupo ya se usó. */
export async function reciboDePago(medio: string, referencia: string): Promise<{ id: number; numero: number } | null> {
  if (!esMedio(medio)) return null;
  const ref = referenciaNormal(medio, referencia);
  if (!ref) return null;
  const { data, error } = await db().from('recibo_pagos').select('recibo_id, recibos!inner(numero)').eq('medio', medio).eq('referencia', ref).eq('anulado', false).maybeSingle();
  if (error) { if (faltaElLibro(error)) return null; throw new Error(error.message); }
  if (!data) return null;
  const r = data as unknown as { recibo_id: number; recibos: { numero: number } | Array<{ numero: number }> };
  const numero = Array.isArray(r.recibos) ? r.recibos[0]?.numero : r.recibos?.numero;
  return { id: Number(r.recibo_id), numero: Number(numero) };
}

const historial = (r: ReciboFila, que: string, quien?: string): ReciboFila['historial'] =>
  [...r.historial, { at: new Date().toISOString(), que: que.slice(0, 300), ...(quien ? { quien: quien.slice(0, 120) } : {}) }].slice(-50);

// ─────────────────────────────────────────────────────────────────────────────
// Lecturas estrictas (un «no pude leer» TIRA: nunca se vuelve «no tiene»)
// ─────────────────────────────────────────────────────────────────────────────

/** Los correos de los admins activos de una cuenta. A diferencia de `adminsDeCuenta`, no se traga el error. */
export async function adminsEstricto(ws: number): Promise<string[]> {
  const { data, error } = await db().from('usuarios').select('email, rol_ws, estado').eq('workspace_id', ws).limit(20);
  if (error) throw new Error(`No pude leer los admins de la cuenta ${ws}: ${error.message}`);
  return [...new Set(((data ?? []) as Array<{ email: string | null; rol_ws: string | null; estado?: string | null }>)
    .filter((u) => u.email && (u.rol_ws === 'admin' || u.rol_ws == null) && u.estado !== 'suspendido')
    .map((u) => u.email!.trim().toLowerCase()))];
}

/** `agency.quien_paga` del cliente, leído estricto (el molde de lib/plan-deuda.ts): null = sin elegir (paga la agencia). */
async function quienPagaEstricto(clienteWs: number): Promise<'agencia' | 'cliente' | null> {
  const { data, error } = await db().from('app_settings').select('value').eq('workspace_id', clienteWs).eq('key', KEY_QUIEN_PAGA).maybeSingle();
  if (error) throw new Error(`No pude leer quién paga la cuenta ${clienteWs}: ${error.message}`);
  const v = (data as { value?: unknown } | null)?.value;
  return v == null ? null : quienPagaDe(v);
}

/** Las agencias que tienen a esta cuenta APROBADA en su cartera, con su nombre. Estricto. */
async function agenciasAprobadasDe(ws: number): Promise<Array<{ agenciaWs: number; nombre: string }>> {
  const { data, error } = await db().from('agencia_clientes').select('agencia_ws').eq('cliente_ws', ws).eq('estado', 'aprobado');
  if (error) throw new Error(`No pude leer la cartera de la cuenta ${ws}: ${error.message}`);
  const ids = [...new Set(((data ?? []) as Array<{ agencia_ws: number }>).map((x) => Number(x.agencia_ws)))];
  const nombres = await nombresDe(ids);
  return ids.map((id) => ({ agenciaWs: id, nombre: nombres.get(id) ?? '' }));
}

async function nombresDe(ids: readonly number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  const lista = ids.filter((x) => Number.isSafeInteger(x) && x > 0);
  if (!lista.length) return out;
  const { data, error } = await db().from('workspaces').select('id, nombre').in('id', lista);
  if (error) throw new Error(`No pude leer los nombres de las cuentas: ${error.message}`);
  for (const w of (data ?? []) as Array<{ id: number; nombre: string | null }>) out.set(Number(w.id), String(w.nombre ?? '').trim());
  return out;
}

/** El emisor («Datos del recibo») y la zona de la plataforma, leídos EN la plataforma. */
async function emisorYZona(plataforma: number): Promise<{ emisor: ReturnType<typeof emisorDe>; zona: string }> {
  return runWithWorkspace(plataforma, async () => ({ emisor: emisorDe(await getSettingEstricto(KEY_EMISOR)), zona: await zonaDelNegocioEstricta(plataforma) }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Emitir
// ─────────────────────────────────────────────────────────────────────────────

type PedidoRecibo = {
  clave: string; origen: 'pasarela' | 'manual'; paga: PagaRecibo; solo_correo: boolean; cobro_id: number | null; destino_ws: number | null;
  agencia_ws: number | null; cliente_ws: number | null; a_nombre: string; email_cobro: string | null; mes: string | null; lineas: LineaRecibo[];
  pagos: Array<PagoRecibo & { monto_usd?: number | null; comprobante_path?: string | null; comprobante_nombre?: string | null }>;
  impuesto: number | null; nota_pdf: string | null; nota_interna: string | null; fecha_pago: string; emitido_por: string;
  estado?: 'emitido' | 'devuelto'; correo_estado?: string; wa_estado?: string; numero?: number; emitido_at?: string; pdf_path?: string | null;
  correo_a?: string[]; correo_ids?: string[]; correo_at?: string | null; wa_ws?: number | null; wa_id?: string | null; wa_at?: string | null;
  historial?: ReciboFila['historial'];
};

export type Emitido = { ok: true; id: number; numero: number; yaEstaba: boolean } | { ok: false; error: string; faltaLaMigracion?: boolean };

/** La ÚNICA llamada a `emitir_recibo` de la app. El emisor y la zona se copian como foto a cada recibo. */
async function emitir(p: PedidoRecibo, plataforma: number): Promise<Emitido> {
  const { emisor, zona } = await emisorYZona(plataforma);
  const { data, error } = await db().rpc('emitir_recibo', { p: { ...p, emisor, zona } });
  if (error) {
    if (faltaElLibro(error)) {
      console.error(`[recibos] ⚠️ FALTA LA MIG 0397 (el libro de recibos): ${error.message}`);
      return { ok: false, error: 'Los recibos todavía no están listos en la base (falta la migración 0397).', faltaLaMigracion: true };
    }
    return { ok: false, error: textoDeOcupado(error.message) ?? textoDeInvalido(error.message) ?? `No pude emitir el recibo: ${error.message}` };
  }
  const fila = (Array.isArray(data) ? data[0] : data) as { recibo_id: number; numero: number; ya_estaba: boolean } | undefined;
  if (!fila) return { ok: false, error: 'La base no devolvió el recibo.' };
  return { ok: true, id: Number(fila.recibo_id), numero: Number(fila.numero), yaEstaba: !!fila.ya_estaba };
}

export type CobradoEnLaPasarela = { monto: number; moneda: string; impuesto: number | null; fecha: string | null; montoUsd?: number | null };

/**
 * EL RECIBO DE UN PAGO DE LA PASARELA. Lo llama `aplicarPagoAprobado` (lib/cobros.ts) ANTES del CRM, y la red. Devuelve null si
 * no corresponde (no es la plataforma, es de prueba, cobró cero) o si no se pudo armar todavía (no se pudo releer lo cobrado,
 * no se pudo leer quién paga): la red lo vuelve a intentar.
 *
 * El monto es LO QUE COBRÓ la pasarela (con impuesto en Creem), nunca el precio de lista del cobro: un cupón del 100% no
 * tiene recibo y un 50% del primer mes dice el 50% (agujero 6). Si quien llama no lo trae, lo relee `releer` (con la clave de
 * la cuenta del cobro).
 */
export async function reciboDelPago(c: Cobro, p: {
  proveedorPagoId: string; cobrado: CobradoEnLaPasarela | null; releer?: () => Promise<CobradoEnLaPasarela | null>; renovacion: boolean; devuelto?: boolean;
}): Promise<{ id: number; numero: number; yaEstaba: boolean } | null> {
  if (c.modo !== 'real') return null;
  const plataforma = await wsSuperAdmin();
  if (c.workspace_id !== plataforma) return null;
  // Ya tiene recibo (un aviso repetido, la red, la reparación del cron): no se relee nada a la pasarela.
  const ya = await reciboDePago(c.proveedor, p.proveedorPagoId);
  if (ya) return { ...ya, yaEstaba: true };
  const cobrado = p.cobrado ?? (p.releer ? await p.releer() : null);
  if (!cobrado) { console.warn(`[recibos] cobro ${c.id}: no pude releer lo cobrado (${p.proveedorPagoId}); lo emite la red`); return null; }
  if (!(cobrado.monto > 0)) { console.log(`[recibos] cobro ${c.id}: cobró ${cobrado.monto} (${p.proveedorPagoId}): un pago en cero no lleva recibo`); return null; }

  // Quién paga, congelado al emitir (agujero 9). agencia_ws y cliente_ws no están en COLS_COBRO: se leen aparte.
  const { data: ag, error: eAg } = await db().from('cobros').select('agencia_ws, cliente_ws').eq('id', c.id).maybeSingle();
  if (eAg) throw new Error(`No pude leer de quién es el cobro ${c.id}: ${eAg.message}`);
  const agenciaWs = n((ag as { agencia_ws?: unknown } | null)?.agencia_ws);
  const clienteWs = n((ag as { cliente_ws?: unknown } | null)?.cliente_ws);
  const quienPaga = agenciaWs != null && clienteWs != null ? await quienPagaEstricto(clienteWs) : null;
  const nombres = await nombresDe([agenciaWs ?? 0, clienteWs ?? 0, c.alta_ws ?? 0]);
  const d = destinoDelRecibo({
    agenciaWs, clienteWs, quienPaga, altaWs: c.alta_ws, email: c.email, nombreCobro: agenciaWs != null ? null : c.nombre,
    nombreAgencia: agenciaWs != null ? nombres.get(agenciaWs) : null, nombreCliente: clienteWs != null ? nombres.get(clienteWs) : null,
    nombreAlta: c.alta_ws != null ? nombres.get(c.alta_ws) : null,
  });

  const { zona } = await emisorYZona(plataforma);
  const fecha = cobrado.fecha && Number.isFinite(Date.parse(cobrado.fecha)) ? cobrado.fecha : (c.pagado_at ?? new Date().toISOString());
  const concepto = `${c.concepto}${p.renovacion ? ' (renovación)' : ''}${'clienteEnElRenglon' in d && d.clienteEnElRenglon ? ` — ${d.clienteEnElRenglon}` : ''}`.slice(0, 200);
  const sinDestino = d.paga === 'sin_destino';
  const r = await emitir({
    clave: claveDeRecibo({ tipo: 'pago', medio: c.proveedor, id: p.proveedorPagoId }),
    origen: 'pasarela', paga: sinDestino ? 'solo' : d.paga, solo_correo: sinDestino ? true : d.soloCorreo,
    cobro_id: c.id, destino_ws: sinDestino ? null : d.destinoWs, agencia_ws: agenciaWs, cliente_ws: clienteWs,
    a_nombre: d.aNombre, email_cobro: sinDestino ? null : d.emailSuelto, mes: null,
    lineas: [{ concepto, mes: mesDeFecha(fecha, zona) || null, monto: cobrado.monto, moneda: cobrado.moneda }],
    pagos: [{ medio: c.proveedor, referencia: p.proveedorPagoId, fecha, monto: cobrado.monto, moneda: cobrado.moneda, monto_usd: cobrado.montoUsd ?? null, impuesto: cobrado.impuesto }],
    impuesto: cobrado.impuesto, nota_pdf: null, nota_interna: sinDestino ? `Sin destino: ${d.motivo}.` : null, fecha_pago: fecha, emitido_por: 'pasarela',
    ...(p.devuelto ? { estado: 'devuelto' as const } : {}),
    ...(sinDestino && !p.devuelto ? { correo_estado: 'sin_destino', wa_estado: 'no_va' } : {}),
    historial: [{ at: new Date().toISOString(), que: `Emitido por el pago ${p.proveedorPagoId}${p.devuelto ? ', ya devuelto: no se manda' : ''}` }],
  }, plataforma);
  if (!r.ok) { if (!r.faltaLaMigracion) console.error(`[recibos] cobro ${c.id}: ${r.error}`); return null; }
  if (sinDestino && !r.yaEstaba && !p.devuelto) await avisarAlEquipo(`El recibo N.º ${String(r.numero).padStart(4, '0')} no tiene a quién llegar`, `Cobro ${c.id}: ${d.motivo}. Está en Customers › Billing › Recibos.`);
  return { id: r.id, numero: r.numero, yaEstaba: r.yaEstaba };
}

/** Un correo de MaKo al equipo (EMAIL_MAKO). Nunca tira. */
async function avisarAlEquipo(asunto: string, cuerpo: string): Promise<void> {
  await avisarDePlataforma({ to: EMAIL_MAKO, asunto, preheader: asunto, cuerpo, tag: 'recibo-aviso' })
    .catch((e) => console.error(`[recibos] no pude avisarle al equipo (${asunto}): ${msg(e)}`));
}

// ─────────────────────────────────────────────────────────────────────────────
// El PDF: el guardado, o el que se arma de la foto
// ─────────────────────────────────────────────────────────────────────────────

async function bajar(path: string): Promise<Uint8Array | null> {
  const { data, error } = await db().storage.from(BUCKET).download(path);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

export function fotoDeRecibo(r: ReciboFila, pagos: readonly ReciboPagoFila[], sello?: { texto: string } | null): FotoRecibo {
  return {
    numero: r.numero, aNombre: r.a_nombre, emitidoAt: r.emitido_at, zona: r.zona || 'UTC', emisor: emisorDe(r.emisor),
    lineas: r.lineas, totalDetalle: r.total_detalle, monedaDetalle: r.moneda_detalle, totales: r.totales_recibido, impuesto: r.impuesto,
    pagos: pagos.filter((p) => !p.anulado).map((p) => ({ medio: p.medio, referencia: p.referencia, fecha: p.fecha, monto: p.monto, moneda: p.moneda, impuesto: p.impuesto, de: p.de })),
    notaPdf: r.nota_pdf, sello: sello ?? null,
  };
}

async function comprobantesDe(pagos: readonly ReciboPagoFila[]): Promise<Comprobante[]> {
  const out: Comprobante[] = [];
  for (const p of pagos) {
    if (p.anulado || !p.comprobante_path || !p.comprobante_path.startsWith(CARPETA_COMPROBANTES)) continue;
    const bytes = await bajar(p.comprobante_path);
    const mime = bytes ? sniffComprobante(bytes) : null;
    if (bytes && mime) out.push({ bytes, mime, fecha: p.fecha, medio: p.medio });
  }
  return out;
}

/**
 * Los bytes del PDF del recibo. El que se mandó (guardado en el primer despacho, con su sha256) manda: «Bajar» da lo que recibió el
 * cliente aunque un deploy cambie la plantilla (agujero 13). Si todavía no hay, se arma de la foto y, con `guardar`, se guarda.
 */
export async function pdfDelReciboGuardado(r: ReciboFila, pagos: readonly ReciboPagoFila[], o: { guardar?: boolean } = {}): Promise<Uint8Array> {
  if (r.pdf_path) {
    const bytes = await bajar(r.pdf_path);
    if (bytes && (!r.pdf_sha256 || crypto.createHash('sha256').update(bytes).digest('hex') === r.pdf_sha256)) return bytes;
    console.error(`[recibos] recibo ${r.id}: el PDF guardado no está o no coincide con su huella; lo vuelvo a armar`);
  }
  const pdf = await pdfDelRecibo(fotoDeRecibo(r, pagos), await comprobantesDe(pagos));
  if (o.guardar && !r.pdf_path) {
    const path = `${CARPETA_PDF}${r.id}.pdf`;
    const sha = crypto.createHash('sha256').update(pdf).digest('hex');
    const { error } = await db().storage.from(BUCKET).upload(path, Buffer.from(pdf), { contentType: 'application/pdf', upsert: false });
    // Ya existía (otro despacho a la vez): manda el que está guardado, que es el que salió.
    if (error && !/exists|duplicate/i.test(error.message)) console.error(`[recibos] recibo ${r.id}: no pude guardar el PDF: ${error.message}`);
    if (!error) await db().from('recibos').update({ pdf_path: path, pdf_sha256: sha }).eq('id', r.id).is('pdf_path', null);
    else if (/exists|duplicate/i.test(error.message)) { const ya = await bajar(path); if (ya) return ya; }
  }
  return pdf;
}

// ─────────────────────────────────────────────────────────────────────────────
// Despachar: correo y WhatsApp, cada uno por su lado
// ─────────────────────────────────────────────────────────────────────────────

/** Compare-and-set sobre la fila tal como se leyó: si otro la tocó en el medio, no se hace nada. */
async function casRecibo(r: ReciboFila, patch: Record<string, unknown>): Promise<boolean> {
  const { data, error } = await db().from('recibos').update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', r.id).eq('updated_at', r.updated_at).select('id');
  if (error) throw new Error(`No pude actualizar el recibo ${r.id}: ${error.message}`);
  return (data ?? []).length > 0;
}

/** El destino de un recibo de quien pagó solo puede llegar DESPUÉS de emitir (el alta corre después): se completa al despachar. */
async function completarDestino(r: ReciboFila): Promise<ReciboFila> {
  if (r.paga !== 'solo' || r.destino_ws != null || r.cobro_id == null) return r;
  const { data, error } = await db().from('cobros').select('alta_ws').eq('id', r.cobro_id).maybeSingle();
  if (error) throw new Error(`No pude leer la cuenta del cobro ${r.cobro_id}: ${error.message}`);
  const alta = n((data as { alta_ws?: unknown } | null)?.alta_ws);
  if (alta == null) return r;
  const { data: f, error: e2 } = await db().from('recibos').update({ destino_ws: alta, solo_correo: false, email_cobro: null, updated_at: new Date().toISOString() })
    .eq('id', r.id).is('destino_ws', null).select(COLS_RECIBO).maybeSingle();
  if (e2) throw new Error(`No pude completar el destino del recibo ${r.id}: ${e2.message}`);
  return f ? reciboDeFila(f as Record<string, unknown>) : r;
}

export type ResultadoDespacho = { correo: string; whatsapp: string };

/**
 * MANDA UN RECIBO: el correo y el WhatsApp, cada uno en su try (un 500 de Evolution no toca el estado del correo). Nunca tira.
 * Sólo un recibo `emitido` sale (agujero 7). `reenvio`: lo pidió una persona («Reenviar»), y WhatsApp vuelve a salir aunque ya
 * haya salido.
 */
export async function despacharRecibo(id: number | null | undefined): Promise<ResultadoDespacho | null> {
  if (!id) return null;
  try {
    const leido = await leerRecibo(id);
    if (!leido) return null;
    const out: ResultadoDespacho = { correo: leido.recibo.correo_estado, whatsapp: leido.recibo.wa_estado };
    let r = leido.recibo;
    if (r.estado !== 'emitido') return out;
    try { r = await completarDestino(r); } catch (e) { console.error(`[recibos] recibo ${id}: ${msg(e)}`); return out; }
    let pdf: Uint8Array | null = null;
    const elPdf = async () => (pdf ??= await pdfDelReciboGuardado(r, leido.pagos, { guardar: true }));
    try { out.correo = await despacharCorreo(r, leido.pagos, elPdf); } catch (e) { console.error(`[recibos] recibo ${id}, correo: ${msg(e)}`); }
    // Relectura: el correo pudo haber cambiado `updated_at` (y el compare-and-set de WhatsApp mira esa fila).
    try {
      const fresco = (await leerRecibo(id))?.recibo ?? r;
      out.whatsapp = await despacharWhatsApp(fresco, leido.pagos, elPdf);
    } catch (e) { console.error(`[recibos] recibo ${id}, WhatsApp: ${msg(e)}`); }
    return out;
  } catch (e) {
    console.error(`[recibos] no pude despachar el recibo ${id}: ${msg(e)}`);
    return null;
  }
}

/** Lo que dice el correo y el WhatsApp de este recibo. */
function textosDe(r: ReciboFila, pagos: readonly ReciboPagoFila[]) {
  const medios = pagos.filter((p) => !p.anulado).map((p) => p.medio);
  const rot = rotulosDelDocumento(medios);
  const emisor = emisorDe(r.emisor);
  const medio = [...new Set(medios.map((m) => (esMedio(m) ? ROTULO_MEDIO[m] : m)))].join(' y ');
  const concepto = r.lineas.map((l) => l.concepto).join(', ').slice(0, 160);
  const t = textoCorreo({
    numero: r.numero, monto: totalesEnTexto(r.totales_recibido), concepto, fecha: diaYMes(r.fecha_pago, r.zona), medio, aNombre: r.a_nombre,
    leyenda: leyendaDelMedio(medios), contacto: emisor.correo ?? EMAIL_MAKO, asunto: emisor.asunto, intro: emisor.intro, titulo: rot.titulo,
  });
  const mes = r.mes ? mesEnTexto(r.mes) : (r.lineas.find((l) => l.mes)?.mes ?? mesDeFecha(r.fecha_pago, r.zona));
  return { ...t, pie: pieWhatsApp(r.numero, rot.titulo), nombrePdf: nombreDelPdf({ numero: r.numero, mes: mes || null, aNombre: r.a_nombre }), contacto: emisor.correo ?? EMAIL_MAKO };
}

async function despacharCorreo(r: ReciboFila, pagos: readonly ReciboPagoFila[], elPdf: () => Promise<Uint8Array>): Promise<string> {
  const decision = decidirCorreo(r, Date.now());
  if (decision === 'rendirse') {
    await casRecibo(r, { correo_estado: 'fallo', correo_error: 'No sé si salió: pasaron 23 horas desde que se tomó. Reenvíalo a mano si hace falta.', historial: historial(r, 'Correo: no sé si salió') });
    return 'fallo';
  }
  if (decision !== 'tomar') return r.correo_estado;

  // Los destinatarios, CONGELADOS en el primer compare-and-set del lote (agujero 8): la clave de Resend no admite otro cuerpo.
  let destinatarios = r.correo_a ?? null;
  if (!destinatarios?.length) {
    const admins = r.destino_ws != null ? await adminsEstricto(r.destino_ws) : [];
    // El correo del cobro sólo si no hay cuenta, o si la cuenta del CLIENTE no tiene admins. La agencia nunca lo recibe.
    const suelto = r.paga === 'agencia' ? null : r.email_cobro;
    destinatarios = correosDelRecibo(admins, r.destino_ws == null || r.paga === 'cliente' ? suelto : null);
  }
  if (!destinatarios.length) {
    if (await casRecibo(r, { correo_estado: 'sin_destino', historial: historial(r, 'Correo: no hay a quién mandarlo') })) {
      await avisarAlEquipo(`El recibo N.º ${String(r.numero).padStart(4, '0')} no tiene a quién llegar`, `Lo que pagó ${r.a_nombre} no tiene un correo de destino. Está en Customers › Billing › Recibos: usa «Reenviar» con otro correo.`);
    }
    return 'sin_destino';
  }
  const tomado = r.correo_estado === 'pendiente' || !r.correo_tomado_at ? new Date().toISOString() : r.correo_tomado_at;
  const tomada = await casRecibo(r, { correo_estado: 'enviando', correo_intentos: r.correo_intentos + 1, correo_tomado_at: tomado, correo_a: destinatarios });
  if (!tomada) return r.correo_estado;

  const pdf = await elPdf();
  const t = textosDe(r, pagos);
  const base64 = Buffer.from(pdf).toString('base64');
  const ids: string[] = [];
  const errores: string[] = [];
  let concurrente = false;
  for (const to of destinatarios) {
    const s = await mandarReciboPorEmail({ to, asunto: t.asunto, preheader: t.preheader, cuerpo: t.cuerpo, pdfBase64: base64, nombrePdf: t.nombrePdf, idempotencyKey: claveDeEnvio(r.id, r.correo_lote, to) });
    if (s.enviado) { if (s.id) ids.push(s.id); continue; }
    if (esConcurrenteDeResend(s.status, s.nombre)) { concurrente = true; continue; }
    errores.push(`${to}: ${s.error}`);
  }
  const ahora = (await leerRecibo(r.id))?.recibo;
  if (!ahora) return 'enviando';
  // Otro pedido igual está en curso en Resend: no gasta el intento, lo retoma la red.
  if (concurrente && !errores.length) {
    await casRecibo(ahora, { correo_intentos: Math.max(0, ahora.correo_intentos - 1) });
    return 'enviando';
  }
  if (!errores.length) {
    await casRecibo(ahora, { correo_estado: 'enviado', correo_ids: ids, correo_at: new Date().toISOString(), correo_error: null, historial: historial(ahora, `Correo enviado a ${destinatarios.length} ${destinatarios.length === 1 ? 'persona' : 'personas'}`) });
    return 'enviado';
  }
  const error = errores.join(' · ').slice(0, 300);
  await casRecibo(ahora, { correo_estado: 'fallo', correo_ids: ids, correo_error: error, historial: historial(ahora, `Correo falló (intento ${ahora.correo_intentos})`) });
  if (ahora.correo_intentos >= INTENTOS_CORREO) {
    await avisarAlEquipo(`El recibo N.º ${String(r.numero).padStart(4, '0')} no salió por correo`, `Falló ${INTENTOS_CORREO} veces. Último error: ${error}. Está en Customers › Billing › Recibos.`);
  }
  return 'fallo';
}

async function despacharWhatsApp(r: ReciboFila, pagos: readonly ReciboPagoFila[], elPdf: () => Promise<Uint8Array>): Promise<string> {
  const decision = decidirWa(r, Date.now());
  if (decision === 'rendirse') {
    await casRecibo(r, { wa_estado: 'fallo', wa_error: 'No sé si salió: quedó a mitad hace más de 10 minutos. Usa «Reenviar» si hace falta.', historial: historial(r, 'WhatsApp: no sé si salió') });
    return 'fallo';
  }
  if (decision !== 'tomar') return r.wa_estado;
  const ws = r.destino_ws;
  // Sin cuenta no hay grupo ni hilo; con «sólo correo», tampoco (el grupo de un cliente lo ven los admins de su agencia).
  if (ws == null || r.solo_correo) {
    await casRecibo(r, { wa_estado: 'no_va', historial: historial(r, r.solo_correo ? 'WhatsApp: no va (sólo correo)' : 'WhatsApp: no va (sin cuenta)') });
    return 'no_va';
  }
  // El interruptor «WhatsApp a quien paga solo» (prendido por defecto), y la cuenta que está en la cartera de una agencia.
  const plataforma = await wsSuperAdmin();
  const apagado = r.paga === 'solo' && (await runWithWorkspace(plataforma, () => getSettingEstricto(KEY_WA_SOLO))) === 'no';
  const enCartera = r.paga !== 'agencia' && (await agenciasAprobadasDe(ws)).length > 0;
  if (apagado || enCartera) {
    await casRecibo(r, { wa_estado: 'no_va', historial: historial(r, apagado ? 'WhatsApp: apagado para quien paga solo' : 'WhatsApp: no va (su grupo lo ven los admins de su agencia)') });
    return 'no_va';
  }
  if (!(await casRecibo(r, { wa_estado: 'enviando', wa_tomado_at: new Date().toISOString(), wa_ws: ws }))) return r.wa_estado;
  const fila = (await leerRecibo(r.id))?.recibo ?? r;

  let jid: string | null;
  try { jid = await grupoJidEstricto(ws); } catch (e) {
    // No pude leer el grupo: vuelve a pendiente y lo toma la próxima vuelta (no se inventa «sin grupo»).
    await casRecibo(fila, { wa_estado: 'pendiente', wa_error: `No pude leer el grupo: ${msg(e)}`.slice(0, 300) });
    return 'pendiente';
  }
  const t = textosDe(r, pagos);
  const pdf = await elPdf();
  const partes: PartePreparada[] = [{ tipo: 'media', base64: Buffer.from(pdf).toString('base64'), media: { tipo: 'document', mimetype: 'application/pdf', fileName: t.nombrePdf }, caption: t.pie }];
  // Al hilo de la app SIEMPRE (existe aunque no haya grupo de WhatsApp: lib/grupo-app.ts), y escondido a los invitados.
  const copia = await copiarAlGrupo(ws, { texto: t.pie, de: 'equipo', avisoTipo: AVISO_TIPO_RECIBO, partes });
  if (!jid) {
    const estado = copia ? 'en_app' : 'fallo';
    await casRecibo(fila, { wa_estado: estado, wa_at: new Date().toISOString(), wa_error: copia ? null : 'Sin grupo de WhatsApp, y no pude dejarlo en la app.', historial: historial(fila, copia ? 'Quedó en el grupo de la app (no tiene grupo de WhatsApp)' : 'WhatsApp: falló') });
    return estado;
  }
  const s = await enviarPartesAlGrupoMaKo(ws, partes);
  if (copia) await Promise.all(copia.ids.map((f, i) => (s.ids[i] ? atarIdDeWhatsApp(ws, f, s.ids[i]) : Promise.resolve()))).catch(() => {});
  if (s.ok && s.ids[0]) await anotarLoDelEquipo(ws, t.pie, s.ids[0]).catch((e) => console.warn(`[recibos] recibo ${r.id}: no lo pude anotar en el grupo: ${msg(e)}`));
  const estado = s.ok ? 'enviado' : copia ? 'en_app' : 'fallo';
  await casRecibo(fila, {
    wa_estado: estado, wa_id: s.ids[0] ?? null, wa_at: new Date().toISOString(), wa_error: s.ok ? null : (s.error ?? 'no salió').slice(0, 300),
    historial: historial(fila, s.ok ? 'WhatsApp enviado al grupo' : copia ? `WhatsApp no salió (${s.error ?? 'sin detalle'}); quedó en la app` : 'WhatsApp falló'),
  });
  return estado;
}

// ─────────────────────────────────────────────────────────────────────────────
// Devolución, disputa, anulación
// ─────────────────────────────────────────────────────────────────────────────

async function reciboDelPagoPorRef(medio: string, referencia: string | null | undefined): Promise<ReciboFila | null> {
  if (!referencia) return null;
  const { data, error } = await db().from('recibo_pagos').select('recibo_id').eq('medio', medio).eq('referencia', referencia).eq('anulado', false).maybeSingle();
  if (error) { if (faltaElLibro(error)) return null; throw new Error(error.message); }
  if (!data) return null;
  return (await leerRecibo(Number((data as { recibo_id: number }).recibo_id)))?.recibo ?? null;
}

/** Corre después de responder si hay un pedido (que la pantalla de «Devolver» no espere un correo); si no, en línea. */
function porDetras(trabajo: () => Promise<unknown>): void {
  const seguro = () => trabajo().catch((e) => console.error(`[recibos] por detrás: ${msg(e)}`));
  try { after(seguro); } catch { void seguro(); }
}

/** Aplica un evento a un recibo con compare-and-set. Un devuelto o una disputa APAGAN lo que todavía no salió (agujero 7). */
async function aplicarEvento(r: ReciboFila, ev: EventoRecibo, extra: Record<string, unknown> = {}, texto: string): Promise<ReciboFila | null> {
  const t = transicionRecibo(r, ev);
  if (t.estado === r.estado && !Object.keys(extra).length) return null;
  const apaga = t.estado !== 'emitido' ? {
    ...(['pendiente', 'enviando', 'fallo'].includes(r.correo_estado) ? { correo_estado: 'no_va' } : {}),
    ...(['pendiente', 'enviando'].includes(r.wa_estado) ? { wa_estado: 'no_va' } : {}),
  } : {};
  const ok = await casRecibo(r, {
    estado: t.estado, ...apaga, ...extra,
    ...(t.estado === 'devuelto' || t.estado === 'devuelto_parcial' ? { devuelto_at: r.devuelto_at ?? new Date().toISOString() } : {}),
    historial: historial(r, texto),
  });
  return ok ? ((await leerRecibo(r.id))?.recibo ?? null) : null;
}

/**
 * Una devolución de la pasarela sobre un pago con recibo. El recibo NO se borra ni se renumera: queda `devuelto` (o
 * `devuelto_parcial`) y se le avisa una vez por estado a los mismos destinatarios, por correo y sin WhatsApp, con el mismo
 * PDF sellado. Nunca tira: lo llama `aplicarReembolso`, que corre en TODOS los negocios.
 */
export async function marcarDevolucionDeRecibo(medio: string, referencia: string | null | undefined, p: { total: boolean; monto?: number | null }): Promise<void> {
  try {
    const r = await reciboDelPagoPorRef(medio, referencia);
    if (!r) return;
    const nuevo = await aplicarEvento(r, { tipo: 'devolucion', total: p.total }, p.monto != null ? { devuelto_monto: p.monto } : {}, p.total ? 'Devuelto por la pasarela' : 'Devolución parcial de la pasarela');
    if (nuevo) porDetras(() => avisarDevolucion(nuevo.id));
  } catch (e) {
    console.error(`[recibos] no pude marcar la devolución de ${medio}:${referencia}: ${msg(e)}`);
  }
}

/** Una devolución que FALLÓ: el recibo vuelve a `emitido` si la plata volvió (sin correo). Nunca tira. */
export async function marcarDevolucionFallidaDeRecibo(medio: string, referencia: string | null | undefined, p: { sigueDevuelto: boolean }): Promise<void> {
  try {
    const r = await reciboDelPagoPorRef(medio, referencia);
    if (r) await aplicarEvento(r, { tipo: 'devolucion_fallida', sigueDevuelto: p.sigueDevuelto }, {}, 'La devolución falló: la plata volvió');
  } catch (e) {
    console.error(`[recibos] no pude marcar la devolución fallida de ${medio}:${referencia}: ${msg(e)}`);
  }
}

/** Un contracargo: nunca sale un correo ni un WhatsApp; queda escrito y lo ve sólo SuperAdmin. Nunca tira. */
export async function marcarDisputaDeRecibo(medio: string, referencia: string | null | undefined, p: { texto: string; plataAfuera: boolean | null }): Promise<void> {
  try {
    const r = await reciboDelPagoPorRef(medio, referencia);
    if (r) await aplicarEvento(r, { tipo: 'contracargo', plataAfuera: p.plataAfuera }, { disputa_texto: p.texto.slice(0, 300) }, `Contracargo: ${p.texto}`.slice(0, 300));
  } catch (e) {
    console.error(`[recibos] no pude marcar la disputa de ${medio}:${referencia}: ${msg(e)}`);
  }
}

/** El correo de la devolución: UNA vez por estado (compare-and-set sobre `devolucion_avisada` ANTES de mandar). */
async function avisarDevolucion(id: number): Promise<void> {
  const leido = await leerRecibo(id);
  if (!leido) return;
  const r = leido.recibo;
  const toca = devolucionPorAvisar(r);
  if (!toca || !r.correo_a?.length) return;
  const q = db().from('recibos').update({ devolucion_avisada: toca, devolucion_correo_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id).eq('estado', toca);
  const { data, error } = await (r.devolucion_avisada == null ? q.is('devolucion_avisada', null) : q.eq('devolucion_avisada', r.devolucion_avisada)).select('id');
  if (error || !(data ?? []).length) return;
  const total = toca === 'devuelto';
  const sello = { texto: total ? `DEVUELTO el ${diaYMes(r.devuelto_at ?? new Date().toISOString(), r.zona)}` : 'DEVOLUCIÓN PARCIAL' };
  const pdf = await pdfDelRecibo(fotoDeRecibo(r, leido.pagos, sello), await comprobantesDe(leido.pagos));
  const emisor = emisorDe(r.emisor);
  const t = textoCorreoDevolucion({ numero: r.numero, total, contacto: emisor.correo ?? EMAIL_MAKO });
  const nombrePdf = textosDe(r, leido.pagos).nombrePdf;
  for (const to of r.correo_a) {
    const s = await mandarReciboPorEmail({ to, asunto: t.asunto, preheader: t.preheader, cuerpo: t.cuerpo, pdfBase64: Buffer.from(pdf).toString('base64'), nombrePdf, idempotencyKey: claveDeEnvio(r.id, total ? 2 : 1, to, 'devolucion'), tag: 'recibo-devolucion' });
    if (!s.enviado) console.error(`[recibos] recibo ${id}: no salió el aviso de la devolución a ${to}: ${s.error}`);
  }
}

/**
 * ANULAR (sólo los cargados a mano, y la rama de agencias con `quitarMesPagado`). El número queda gastado y las llaves se liberan:
 * se corrige emitiendo otro. Lo que todavía no salió se apaga en el mismo update. `avisar`: un correo a quien ya lo recibió.
 */
export async function anularRecibo(p: { id?: number; clave?: string; autor: string; avisar?: boolean }): Promise<{ ok: true; numero: number } | { ok: false; error: string }> {
  let r: ReciboFila | null = null;
  if (p.id) r = (await leerRecibo(p.id))?.recibo ?? null;
  else if (p.clave) {
    const { data, error } = await db().from('recibos').select('id').eq('clave', p.clave).neq('estado', 'anulado').maybeSingle();
    if (error) return { ok: false, error: faltaElLibro(error) ? 'Los recibos todavía no están listos en la base.' : error.message };
    if (data) r = (await leerRecibo(Number((data as { id: number }).id)))?.recibo ?? null;
  }
  if (!r) return { ok: false, error: 'Ese recibo no existe.' };
  if (r.origen !== 'manual') return { ok: false, error: 'Un recibo de la pasarela no se anula: se devuelve el pago.' };
  if (r.estado === 'anulado') return { ok: true, numero: r.numero };
  const ok = await casRecibo(r, {
    estado: 'anulado', anulado_at: new Date().toISOString(), anulado_por: p.autor.slice(0, 120),
    ...(['pendiente', 'enviando', 'fallo'].includes(r.correo_estado) ? { correo_estado: 'no_va' } : {}),
    ...(['pendiente', 'enviando'].includes(r.wa_estado) ? { wa_estado: 'no_va' } : {}),
    historial: historial(r, 'Anulado', p.autor),
  });
  if (!ok) return { ok: false, error: 'Alguien lo cambió recién: vuelve a intentarlo.' };
  const { error: e2 } = await db().from('recibo_pagos').update({ anulado: true }).eq('recibo_id', r.id);
  if (e2) return { ok: false, error: `Quedó anulado, pero no pude liberar sus órdenes: ${e2.message}` };
  if (p.avisar && r.correo_a?.length && r.correo_estado === 'enviado') {
    for (const to of r.correo_a) {
      await avisarDePlataforma({ to, asunto: `El recibo N.º ${String(r.numero).padStart(4, '0')} quedó anulado`, preheader: 'Te mandamos uno corregido.', cuerpo: ['Hola,', '', `El recibo N.º ${String(r.numero).padStart(4, '0')} que te mandamos quedó anulado. Si corresponde, te llega uno corregido con otro número.`, '', `Si algo no coincide, escríbenos a ${EMAIL_MAKO}.`].join('\n'), tag: 'recibo-anulado' })
        .catch((e) => console.error(`[recibos] recibo ${r!.id}: no salió el aviso de anulación: ${msg(e)}`));
    }
  }
  return { ok: true, numero: r.numero };
}

/** «Marcar devuelto» de un recibo cargado A MANO (la plata se devolvió por fuera de la pasarela). Avisa una vez, por correo. */
export async function marcarReciboDevueltoAMano(id: number, autor: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = (await leerRecibo(id))?.recibo;
  if (!r) return { ok: false, error: 'Ese recibo no existe.' };
  if (r.origen !== 'manual') return { ok: false, error: 'Un recibo de la pasarela se devuelve desde el cobro: el recibo lo sigue solo.' };
  if (r.estado === 'anulado') return { ok: false, error: 'Un recibo anulado no se devuelve.' };
  if (r.estado === 'devuelto') return { ok: true };
  const nuevo = await aplicarEvento(r, { tipo: 'devolucion', total: true }, {}, `Marcado devuelto por ${autor}`.slice(0, 300));
  if (!nuevo) return { ok: false, error: 'Alguien lo cambió recién: vuelve a intentarlo.' };
  porDetras(() => avisarDevolucion(nuevo.id));
  return { ok: true };
}

/** «Reenviar»: un lote nuevo (otra clave de Resend), a los mismos o a otro correo. WhatsApp también, si va. */
export async function reenviarRecibo(id: number, p: { autor: string; correo?: string | null; whatsapp?: boolean }): Promise<{ ok: true; resultado: ResultadoDespacho | null } | { ok: false; error: string }> {
  const leido = await leerRecibo(id);
  if (!leido) return { ok: false, error: 'Ese recibo no existe.' };
  const r = leido.recibo;
  if (r.estado !== 'emitido') return { ok: false, error: r.estado === 'anulado' ? 'Un recibo anulado no se reenvía.' : 'Este recibo ya no está vigente: no se reenvía.' };
  const otro = p.correo?.trim().toLowerCase() || null;
  if (otro && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(otro)) return { ok: false, error: 'Ese correo no es válido.' };
  const ok = await casRecibo(r, {
    correo_estado: 'pendiente', correo_intentos: 0, correo_tomado_at: null, correo_lote: Math.min(30000, r.correo_lote + 1), correo_a: otro ? [otro] : null, correo_error: null,
    ...(p.whatsapp !== false && !r.solo_correo ? { wa_estado: 'pendiente', wa_error: null } : {}),
    historial: historial(r, otro ? `Reenviar a ${otro}` : 'Reenviar', p.autor),
  });
  if (!ok) return { ok: false, error: 'Alguien lo cambió recién: vuelve a intentarlo.' };
  return { ok: true, resultado: await despacharRecibo(id) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cargar un pago a mano (Binance, transferencia…): «Cargar pago» de SuperAdmin y la API de MaKo
// ─────────────────────────────────────────────────────────────────────────────

export type PagoManual = { medio: string; referencia: string; fecha: string; monto: number; moneda: string; monto_usd?: number | null; de?: string | null; comprobante_path?: string | null; comprobante_nombre?: string | null };
export type ReciboManual = {
  destinoWs: number; aNombre: string; lineas: LineaRecibo[]; pagos: PagoManual[]; notaPdf?: string | null; notaInterna?: string | null;
  /** El uuid del formulario (se genera al abrir): un doble clic no da dos recibos. */
  formId?: string | null;
  /** Sólo la rama de agencias y el script de carga: `mensualidad:` / `diferencial:`. */
  clave?: string | null;
  mes?: string | null; enviar: boolean; autor: string; numero?: number;
};

const MONEDA_RE = /^[A-Z0-9]{3,5}$/;

/**
 * EL RECIBO DE PLATA QUE ENTRÓ POR FUERA DE LA PASARELA. Valida todo lo que importa ANTES de pedir un número (agujero 15): el medio
 * de la lista, la referencia normalizada, los montos, el comprobante en su carpeta, y la cuenta: si la paga su agencia, se rechaza
 * (agujero 4). No marca meses pagados ni escribe cuotas: eso es de la rama de agencias, que llama acá DESPUÉS de marcar el mes.
 */
export async function emitirReciboManual(m: ReciboManual): Promise<Emitido & { aviso?: string }> {
  if (!Number.isSafeInteger(m.destinoWs) || m.destinoWs <= 0) return { ok: false, error: 'Elige la cuenta.' };
  const aNombre = String(m.aNombre ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (!aNombre) return { ok: false, error: 'Falta a nombre de quién va el recibo.' };
  if (!m.lineas.length || m.lineas.length > 30) return { ok: false, error: 'Falta qué se pagó.' };
  const lineas: LineaRecibo[] = [];
  for (const l of m.lineas) {
    const concepto = String(l.concepto ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
    const moneda = String(l.moneda ?? '').trim().toUpperCase();
    if (!concepto || !(Number(l.monto) > 0) || !MONEDA_RE.test(moneda)) return { ok: false, error: 'Cada renglón necesita concepto, importe y moneda.' };
    lineas.push({ concepto, mes: l.mes ? String(l.mes).trim().slice(0, 40) : null, monto: Math.round(Number(l.monto) * 100) / 100, moneda });
  }
  if (new Set(lineas.map((l) => l.moneda)).size > 1) return { ok: false, error: 'Los renglones tienen que ir en una sola moneda.' };
  if (!m.pagos.length || m.pagos.length > 10) return { ok: false, error: 'Falta cómo se pagó.' };
  const plataforma = await wsSuperAdmin();
  // Una fecha SIN zona («2026-11-05T12:20», lo que da el formulario) es la hora de la plataforma, no la del servidor.
  const zona = await runWithWorkspace(plataforma, () => zonaDelNegocioEstricta(plataforma)).catch(() => 'UTC');
  const pagos: PedidoRecibo['pagos'] = [];
  for (const p of m.pagos) {
    if (!esMedio(p.medio)) return { ok: false, error: `Ese medio no está en la lista (${MEDIOS.join(', ')}).` };
    const referencia = referenciaNormal(p.medio, p.referencia);
    if (!referencia) return { ok: false, error: p.medio === 'binance' ? 'La orden de Binance son los 18 dígitos del «Order ID».' : 'Falta la referencia del pago.' };
    const moneda = String(p.moneda ?? '').trim().toUpperCase();
    const fecha = instanteDeLaFecha(String(p.fecha ?? ''), zona);
    if (!(Number(p.monto) > 0) || !MONEDA_RE.test(moneda) || !fecha) return { ok: false, error: 'Cada pago necesita fecha, monto y moneda.' };
    const path = p.comprobante_path ?? null;
    if (path && (!path.startsWith(CARPETA_COMPROBANTES) || path.includes('..'))) return { ok: false, error: 'Ese comprobante no es de los recibos.' };
    const usd = p.monto_usd != null && Number(p.monto_usd) > 0 ? Number(p.monto_usd) : (moneda === 'USD' || moneda === 'USDT' || moneda === 'USDC') ? Number(p.monto) : null;
    pagos.push({ medio: p.medio as MedioRecibo, referencia, fecha, monto: Math.round(Number(p.monto) * 100) / 100, moneda, monto_usd: usd, de: p.de ? String(p.de).trim().slice(0, 120) : null, comprobante_path: path, comprobante_nombre: p.comprobante_nombre ? String(p.comprobante_nombre).slice(0, 200) : null });
  }
  // La cuenta: si la paga su agencia, el recibo no es de ella (agujero 4). Estricto: si no se pudo leer, no se emite.
  let soloCorreo: boolean;
  try {
    const agencias = await agenciasAprobadasDe(m.destinoWs);
    const v = validarDestinoManual({ agencias, quienPaga: agencias.length ? await quienPagaEstricto(m.destinoWs) : null });
    if (!v.ok) return { ok: false, error: v.error };
    soloCorreo = v.soloCorreo;
  } catch (e) { return { ok: false, error: msg(e) }; }

  let clave: string;
  try {
    clave = m.clave ? String(m.clave) : claveDeRecibo({ tipo: 'form', uuid: String(m.formId ?? '') });
  } catch { return { ok: false, error: 'El formulario no tiene su identificador: ciérralo y vuelve a abrirlo.' }; }
  const mes = m.mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(m.mes) ? m.mes : null;
  // El aviso blando del mes (agujero 2): no frena, avisa.
  let aviso: string | undefined;
  if (mes) {
    const { data } = await db().from('recibos').select('numero').eq('destino_ws', m.destinoWs).eq('mes', mes).neq('estado', 'anulado').limit(1);
    const ya = (data ?? [])[0] as { numero?: number } | undefined;
    if (ya?.numero) aviso = `Ya hay un recibo de ${mesEnTexto(mes)} para esta cuenta: N.º ${String(ya.numero).padStart(4, '0')}.`;
  }
  const r = await emitir({
    clave, origen: 'manual', paga: 'manual', solo_correo: soloCorreo, cobro_id: null, destino_ws: m.destinoWs, agencia_ws: null, cliente_ws: null,
    a_nombre: aNombre, email_cobro: null, mes, lineas, pagos, impuesto: null,
    nota_pdf: m.notaPdf ? String(m.notaPdf).trim().slice(0, 500) || null : null, nota_interna: m.notaInterna ? String(m.notaInterna).trim().slice(0, 500) || null : null,
    fecha_pago: pagos.map((p) => p.fecha).sort().at(-1)!, emitido_por: m.autor.slice(0, 120),
    ...(m.enviar ? {} : { correo_estado: 'no_va', wa_estado: 'no_va' }),
    ...(m.numero ? { numero: m.numero } : {}),
    historial: [{ at: new Date().toISOString(), que: m.enviar ? 'Cargado a mano' : 'Cargado a mano, sin enviar', quien: m.autor.slice(0, 120) }],
  }, plataforma);
  if (r.ok && m.enviar && !r.yaEstaba) await despacharRecibo(r.id);
  return r.ok ? { ...r, ...(aviso ? { aviso } : {}) } : r;
}

/** El comprobante de un pago cargado a mano: sólo JPEG o PNG por sus bytes, en `plataforma/recibos/comprobantes/`. */
export async function guardarComprobante(bytes: Uint8Array, nombre: string): Promise<{ ok: true; path: string; nombre: string } | { ok: false; error: string }> {
  const mime = sniffComprobante(bytes);
  if (!mime) return { ok: false, error: 'El comprobante tiene que ser una imagen JPEG o PNG.' };
  const path = `${CARPETA_COMPROBANTES}${crypto.randomUUID()}.${mime === 'image/png' ? 'png' : 'jpg'}`;
  const { error } = await db().storage.from(BUCKET).upload(path, Buffer.from(bytes), { contentType: mime, upsert: false });
  if (error) return { ok: false, error: `No pude guardar el comprobante: ${error.message}` };
  return { ok: true, path, nombre: String(nombre || 'comprobante').replace(/[^\w.\- ]+/g, '_').slice(-100) };
}

/** Una URL firmada de 5 minutos para ver un comprobante. Sólo de la carpeta de los recibos. */
export async function firmarComprobante(path: string): Promise<string | null> {
  if (!path.startsWith(CARPETA_COMPROBANTES) || path.includes('..')) return null;
  const { data } = await db().storage.from(BUCKET).createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// El registro (SuperAdmin y la API de MaKo)
// ─────────────────────────────────────────────────────────────────────────────

export type FiltroRecibos = { mes?: string | null; destinoWs?: number | null; medio?: string | null; estado?: EstadoRecibo | null; soloFallas?: boolean; limite?: number };
export type ReciboListado = ReciboFila & { pagos: ReciboPagoFila[] };

/** La lista, con tope (200, y se dice si se llegó). Sin la mig 0397, `faltaLaMigracion`. */
export async function listarRecibos(f: FiltroRecibos = {}): Promise<{ recibos: ReciboListado[]; alTope: boolean; faltaLaMigracion?: boolean }> {
  const tope = Math.min(200, Math.max(1, f.limite ?? 200));
  let q = db().from('recibos').select(COLS_RECIBO).order('emitido_at', { ascending: false }).limit(tope + 1);
  if (f.mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(f.mes)) {
    const [a, mm] = f.mes.split('-').map(Number);
    q = q.gte('fecha_pago', new Date(Date.UTC(a, mm - 1, 1)).toISOString()).lt('fecha_pago', new Date(Date.UTC(a, mm, 1)).toISOString());
  }
  if (f.destinoWs) q = q.eq('destino_ws', f.destinoWs);
  if (f.estado) q = q.eq('estado', f.estado);
  if (f.soloFallas) q = q.or('correo_estado.in.(fallo,reboto,sin_destino),wa_estado.eq.fallo');
  const { data, error } = await q;
  if (error) {
    if (faltaElLibro(error)) return { recibos: [], alTope: false, faltaLaMigracion: true };
    throw new Error(`No pude leer los recibos: ${error.message}`);
  }
  const filas = (data ?? []).map((x) => reciboDeFila(x as Record<string, unknown>));
  const alTope = filas.length > tope;
  const lista = filas.slice(0, tope);
  const pagos = new Map<number, ReciboPagoFila[]>();
  if (lista.length) {
    const { data: ps, error: e2 } = await db().from('recibo_pagos').select('*').in('recibo_id', lista.map((r) => r.id));
    if (e2) throw new Error(`No pude leer los pagos de los recibos: ${e2.message}`);
    for (const p of (ps ?? []).map((x) => pagoDeFila(x as Record<string, unknown>))) pagos.set(p.recibo_id, [...(pagos.get(p.recibo_id) ?? []), p]);
  }
  const conPagos = lista.map((r) => ({ ...r, pagos: pagos.get(r.id) ?? [] }));
  return { recibos: f.medio ? conPagos.filter((r) => r.pagos.some((p) => p.medio === f.medio)) : conPagos, alTope };
}

/** Los «Datos del recibo» (el emisor), para la tarjeta de SuperAdmin. */
export async function leerEmisor(): Promise<ReturnType<typeof emisorDe>> {
  const plataforma = await wsSuperAdmin();
  return runWithWorkspace(plataforma, async () => emisorDe(await getSettingEstricto(KEY_EMISOR)));
}
export async function guardarEmisor(e: Partial<ReturnType<typeof emisorDe>>): Promise<ReturnType<typeof emisorDe>> {
  const limpio = emisorDe(e);
  const plataforma = await wsSuperAdmin();
  await runWithWorkspace(plataforma, () => setSetting(KEY_EMISOR, JSON.stringify(limpio)));
  return limpio;
}
export async function leerWaSolo(): Promise<boolean> {
  const plataforma = await wsSuperAdmin();
  return runWithWorkspace(plataforma, async () => (await getSettingEstricto(KEY_WA_SOLO)) !== 'no');
}
export async function guardarWaSolo(prendido: boolean): Promise<void> {
  const plataforma = await wsSuperAdmin();
  await runWithWorkspace(plataforma, () => setSetting(KEY_WA_SOLO, prendido ? 'si' : 'no'));
}

// ─────────────────────────────────────────────────────────────────────────────
// La red (el cron de cobros)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Los pagos de la plataforma sin recibo: los emite (tope 50 por vuelta, y se dice si se llegó). El monto se RELEE a la pasarela
 * (`releer`, de lib/cobros.ts): si no contesta, queda para la próxima vuelta; si cobró cero, no hay recibo. Una cuota devuelta
 * o un cobro reembolsado nacen `devuelto`, sin mandar nada (agujero 5).
 */
export async function recibosQueFaltan(o: {
  hasta?: number; leerCobro: (ws: number, id: number) => Promise<Cobro | null>; releer: (c: Cobro, pagoId: string) => Promise<CobradoEnLaPasarela | null>;
}): Promise<{ emitidos: number; errores: number; faltaLaMigracion?: boolean }> {
  const plataforma = await wsSuperAdmin();
  const { data, error } = await db().rpc('recibos_que_faltan', { p_ws: plataforma, p_desde: RECIBOS_DESDE, p_tope: TOPE_RED });
  if (error) {
    if (faltaElLibro(error)) return { emitidos: 0, errores: 0, faltaLaMigracion: true };
    throw new Error(`No pude leer los pagos sin recibo: ${error.message}`);
  }
  const filas = (data ?? []) as Array<{ cobro_id: number; cuota_id: number | null; proveedor: string; proveedor_pago_id: string; devuelto: boolean }>;
  if (filas.length >= TOPE_RED) console.warn(`[recibos] la red llegó a su tope (${TOPE_RED}): lo que falta sigue en la próxima vuelta`);
  let emitidos = 0;
  let errores = 0;
  for (const f of filas) {
    if (o.hasta != null && Date.now() > o.hasta) break;
    try {
      const c = await o.leerCobro(plataforma, Number(f.cobro_id));
      if (!c) continue;
      const r = await reciboDelPago(c, {
        proveedorPagoId: f.proveedor_pago_id, cobrado: null, releer: () => o.releer(c, f.proveedor_pago_id),
        renovacion: f.cuota_id != null, devuelto: f.devuelto,
      });
      if (r && !r.yaEstaba) emitidos++;
    } catch (e) {
      errores++;
      console.error(`[recibos] la red, cobro ${f.cobro_id}: ${msg(e)}`);
    }
  }
  return { emitidos, errores };
}

/** Despacha lo pendiente de más de 5 minutos, los `fallo` reintentables y los avisos de devolución que faltan. Tope 20. */
export async function despacharPendientes(o: { hasta?: number } = {}): Promise<{ despachados: number; devoluciones: number }> {
  const corte = new Date(Date.now() - 5 * 60_000).toISOString();
  const { data, error } = await db().from('recibos').select('id').eq('estado', 'emitido')
    .or('correo_estado.in.(pendiente,enviando,fallo),wa_estado.in.(pendiente,enviando)').lt('updated_at', corte)
    .order('updated_at', { ascending: true }).limit(TOPE_DESPACHO);
  if (error) {
    if (faltaElLibro(error)) return { despachados: 0, devoluciones: 0 };
    throw new Error(`No pude leer los recibos por despachar: ${error.message}`);
  }
  let despachados = 0;
  for (const f of (data ?? []) as Array<{ id: number }>) {
    if (o.hasta != null && Date.now() > o.hasta) break;
    if (await despacharRecibo(Number(f.id))) despachados++;
  }
  // Las devoluciones cuyo aviso no salió (el proceso se cortó entre el estado y el correo).
  const { data: dev } = await db().from('recibos').select('id, estado, devolucion_avisada, correo_estado')
    .in('estado', ['devuelto', 'devuelto_parcial']).in('correo_estado', ['enviado', 'reboto']).lt('updated_at', corte).limit(TOPE_DESPACHO);
  let devoluciones = 0;
  for (const f of (dev ?? []) as Array<{ id: number; estado: EstadoRecibo; devolucion_avisada: string | null; correo_estado: string }>) {
    if (!devolucionPorAvisar(f)) continue;
    await avisarDevolucion(Number(f.id)).catch((e) => console.error(`[recibos] aviso de devolución ${f.id}: ${msg(e)}`));
    devoluciones++;
  }
  return { despachados, devoluciones };
}

/**
 * Un correo de un recibo REBOTÓ o se suprimió (el webhook de Resend de la cuenta de MaKo). Marca `reboto` y le avisa al equipo.
 * Nunca tira. Sólo para eventos de la cuenta de MaKo (los recibos salen por ella).
 */
export async function marcarReboteDeRecibo(emailId: string, que: string): Promise<boolean> {
  try {
    const { data, error } = await db().from('recibos').select('id, numero, a_nombre, correo_estado, historial, updated_at').contains('correo_ids', [emailId]).limit(1);
    if (error) { if (!faltaElLibro(error)) console.error(`[recibos] rebote ${emailId}: ${error.message}`); return false; }
    const f = (data ?? [])[0] as { id: number; numero: number; a_nombre: string; correo_estado: string; historial: ReciboFila['historial']; updated_at: string } | undefined;
    if (!f) return false;
    if (f.correo_estado !== 'reboto') {
      await db().from('recibos').update({ correo_estado: 'reboto', correo_error: `Resend: ${que}`.slice(0, 300), historial: [...(f.historial ?? []), { at: new Date().toISOString(), que: `Correo: ${que}` }].slice(-50), updated_at: new Date().toISOString() }).eq('id', f.id);
      await avisarAlEquipo(`El recibo N.º ${String(f.numero).padStart(4, '0')} rebotó`, `El correo del recibo de ${f.a_nombre} rebotó (${que}). Está en Customers › Billing › Recibos: usa «Reenviar» con otro correo.`);
    }
    return true;
  } catch (e) {
    console.error(`[recibos] rebote ${emailId}: ${msg(e)}`);
    return false;
  }
}

export type { Destino };
