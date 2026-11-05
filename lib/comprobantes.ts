// =============================================================================
// comprobantes — leer la foto o el PDF de un pago que mandó un lead (5/11/2026)
// =============================================================================
// La tarjeta «Pagos › Leer comprobante» de Automations (lib/api-mako: `leer_comprobante`) y la condición «Su comprobante».
// Las reglas puras (qué se leyó, si cubre, si es dudoso): lib/comprobante-reglas.ts. El diseño: docs/relevo/pagos-automations-encargo.md.
//
// ⚠️ NUNCA MARCA NADA PAGADO. Lee, guarda la lectura y contesta qué es. Lo que sigue lo decide el flujo con una CONDITION
// («Su comprobante: Cubre lo que debía»), a la vista en el lienzo: nada por detrás.
// ⚠️ LA IA LA PAGA EL NEGOCIO: `leerDocumentoIA` con SUS claves (sin la red de la plataforma) y adentro de `conSuIADelNegocio`
// (D6b: un negocio con su Claude o su GPT no manda nada a Gemini). Nunca la computadora del cliente: esto corre solo.
// ⚠️ UNA LECTURA POR MENSAJE: el motor reintenta, y la fila ya leída se devuelve sin volver a llamar a la IA.
// =============================================================================

import 'server-only';
import { getTenantDb } from './workspace';
import { MEDIA_BUCKET } from './evolution-media';
import { leerDocumentoIA } from './ai-cheap';
import { conSuIADelNegocio } from './ia-del-negocio';
import { parseJsonObject } from './json-del-modelo';
import { noEsDeuda } from './cobrado-lead';
import { sniffComprobante } from './recibos-reglas';
import {
  PROMPT_COMPROBANTE, coberturaDe, estadoDeLectura, lecturaDe, operacionNormal, resultadoDe, resumenDeLectura,
  type Esperado, type LecturaComprobante, type ResultadoComprobante,
} from './comprobante-reglas';

/** Cuánto hacia atrás se busca la foto o el PDF: la automatización corre al llegar, y un reintento no pasa de un día. */
const HORAS_HACIA_ATRAS = 48;
/** El tope del archivo que se lee (una foto de celular pesa 2-4 MB; un PDF de banco, menos). */
const TOPE_BYTES = 12 * 1024 * 1024;

export type LecturaGuardada = {
  id: number;
  resultado: ResultadoComprobante;
  resumen: string;
  lectura: LecturaComprobante;
  esperado: Esperado;
  repetido: boolean;
};

export type ResultadoLeer =
  | { ok: true; ya: boolean; comprobante: LecturaGuardada }
  | { ok: false; error: string; falla?: true };

const faltaLaTabla = (e: { code?: string; message?: string } | null | undefined): boolean =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || /comprobantes_leidos/.test(e.message ?? '') && /does not exist|schema cache/.test(e.message ?? ''));

/** PDF por sus primeros bytes (los documentos de WhatsApp se guardan como octet-stream: lib/evolution-mensajes.ts). */
const esPdf = (b: Uint8Array): boolean => b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;

/** Lo que tocaba pagar: la primera cuota sin cobrar que es deuda (sin las devueltas ni las de baja), la más vieja primero. */
export async function cuotaQueToca(leadId: number): Promise<Esperado> {
  const db = await getTenantDb();
  const { data, error } = await db.from('pagos')
    .select('id, monto_usd, moneda, monto_original, pagado, fecha_esperada, proveedor, cobro_id, baja_at')
    .eq('lead_id', leadId).eq('pagado', false)
    .order('fecha_esperada', { ascending: true, nullsFirst: false }).order('id', { ascending: true }).limit(30);
  if (error) throw new Error(`no pude leer las cuotas del lead: ${error.message}`);
  for (const q of (data ?? []) as Array<{ id: number; monto_usd: number | string; moneda: string | null; monto_original: number | string | null; pagado: boolean; fecha_esperada: string | null; proveedor: string | null; cobro_id: number | null; baja_at: string | null }>) {
    if (noEsDeuda(q)) continue;
    const enSuMoneda = q.moneda && q.moneda.toUpperCase() !== 'USD' && Number(q.monto_original) > 0;
    return enSuMoneda
      ? { monto: Number(q.monto_original), moneda: String(q.moneda).toUpperCase(), pagoId: q.id }
      : { monto: Number(q.monto_usd), moneda: 'USD', pagoId: q.id };
  }
  return null;
}

/** El último archivo (foto o documento) que mandó el lead por WhatsApp en las últimas 48 h. */
async function ultimoArchivoDelLead(leadId: number): Promise<{ id: string; path: string } | null> {
  const db = await getTenantDb();
  const desde = new Date(Date.now() - HORAS_HACIA_ATRAS * 3600_000).toISOString();
  const { data, error } = await db.from('wa_mensajes').select('wa_message_id, media_path, tipo')
    .eq('lead_id', leadId).eq('from_me', false).in('tipo', ['image', 'document']).not('media_path', 'is', null)
    .gte('wa_timestamp', desde).order('wa_timestamp', { ascending: false }).limit(1);
  if (error) throw new Error(`no pude leer los mensajes del lead: ${error.message}`);
  const f = (data ?? [])[0] as { wa_message_id?: string; media_path?: string } | undefined;
  return f?.wa_message_id && f.media_path ? { id: f.wa_message_id, path: f.media_path } : null;
}

const COLS = 'id, resultado, lectura, esperado, repetido';
const deFila = (f: { id: number; resultado: string; lectura: unknown; esperado: unknown; repetido: boolean }): LecturaGuardada => {
  const lectura = lecturaDe((f.lectura ?? null) as Record<string, unknown> | null);
  const esperado = (f.esperado ?? null) as Esperado;
  const resultado = f.resultado as ResultadoComprobante;
  return { id: f.id, resultado, lectura, esperado, repetido: f.repetido, resumen: resumenDeLectura(lectura, resultado, esperado) };
};

/** Lo que el modelo devolvió, de vuelta en la forma pedida (la fila guarda la lectura con las claves del prompt). */
const comoJson = (l: LecturaComprobante): Record<string, unknown> => ({
  es_comprobante: l.esComprobante, monto: l.monto, moneda: l.moneda, fecha: l.fecha, hora: l.hora, medio: l.medio,
  destinatario: l.destinatario, operacion: l.operacion, dudas: l.dudas,
});

/**
 * Lee el último comprobante que mandó el lead y lo guarda. `ya: true` = ese mensaje ya estaba leído (no se gastó otra lectura).
 * Un error de una regla (no mandó nada, el archivo no es una foto ni un PDF) vuelve sin `falla`; uno nuestro, con `falla`.
 */
export async function leerComprobanteDelLead(ws: number, leadId: number, o: { secuenciaId?: number | null; origen?: 'flujo' | 'chat' | 'api' } = {}): Promise<ResultadoLeer> {
  const db = await getTenantDb();
  let archivo: { id: string; path: string } | null;
  try { archivo = await ultimoArchivoDelLead(leadId); } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e), falla: true }; }
  if (!archivo) return { ok: false, error: 'No mandó una foto ni un PDF por WhatsApp en las últimas 48 horas.' };

  const { data: previa, error: errPrevia } = await db.from('comprobantes_leidos').select(COLS).eq('wa_mensaje_id', archivo.id).maybeSingle();
  if (errPrevia) return { ok: false, error: faltaLaTabla(errPrevia) ? 'No pude guardar la lectura: falta la migración 0398.' : `No pude leer los comprobantes: ${errPrevia.message}`, falla: true };
  if (previa) return { ok: true, ya: true, comprobante: deFila(previa as never) };

  const { data: blob, error: errBaja } = await db.storage.from(MEDIA_BUCKET).download(archivo.path);
  if (errBaja || !blob) return { ok: false, error: `No pude bajar el archivo: ${errBaja?.message ?? 'vacío'}`, falla: true };
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.length > TOPE_BYTES) return { ok: false, error: 'El archivo pesa más de 12 MB: hay que revisarlo a mano.' };
  const mime = esPdf(bytes) ? 'application/pdf' : sniffComprobante(bytes);
  if (!mime) return { ok: false, error: 'El archivo no es una foto JPG o PNG ni un PDF.' };

  let esperado: Esperado;
  try { esperado = await cuotaQueToca(leadId); } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e), falla: true }; }

  let texto: string;
  let proveedor: string;
  try {
    const r = await conSuIADelNegocio(ws, () => leerDocumentoIA({
      dataUrl: `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`, isPdf: mime === 'application/pdf',
      nombreArchivo: mime === 'application/pdf' ? 'comprobante.pdf' : 'comprobante', prompt: PROMPT_COMPROBANTE, json: true, feature: 'leer_comprobante',
    }));
    texto = r.text;
    proveedor = String(r.provider);
  } catch (e) {
    return { ok: false, error: `No pude leer el comprobante con tu IA: ${e instanceof Error ? e.message : String(e)}`, falla: true };
  }
  let crudo: Record<string, unknown> | null = null;
  try { crudo = parseJsonObject(texto); } catch { crudo = null; }
  const lectura = lecturaDe(crudo);
  const estado = estadoDeLectura(lectura);
  const cobertura = coberturaDe(lectura, esperado);
  const operacion = operacionNormal(lectura.operacion);

  const base = {
    lead_id: leadId, wa_mensaje_id: archivo.id, media_path: archivo.path, media_mime: mime, secuencia_id: o.secuenciaId ?? null,
    origen: o.origen ?? 'flujo', estado, cobertura, lectura: comoJson(lectura), esperado, monto: lectura.monto, moneda: lectura.moneda,
    operacion, pago_id: esperado?.pagoId ?? null, proveedor,
  };
  // El N.º cuenta una vez: la primera fila lo lleva en `operacion_unica` y el índice único frena a la segunda, que entra repetida.
  const intentar = async (repetido: boolean) => db.from('comprobantes_leidos').insert({
    ...base, repetido, operacion_unica: repetido ? null : operacion,
    resultado: resultadoDe({ estado, cobertura, repetido, esComprobante: lectura.esComprobante }),
  }).select(COLS).single();
  let ins = await intentar(false);
  if (ins.error?.code === '23505' && /operacion/.test(ins.error.message ?? '') && operacion) ins = await intentar(true);
  if (ins.error?.code === '23505') {
    // Otro intento leyó el MISMO mensaje a la vez: gana su fila.
    const { data: otra } = await db.from('comprobantes_leidos').select(COLS).eq('wa_mensaje_id', archivo.id).maybeSingle();
    if (otra) return { ok: true, ya: true, comprobante: deFila(otra as never) };
  }
  if (ins.error || !ins.data) return { ok: false, error: faltaLaTabla(ins.error) ? 'No pude guardar la lectura: falta la migración 0398.' : `No pude guardar la lectura: ${ins.error?.message ?? 'sin fila'}`, falla: true };
  return { ok: true, ya: false, comprobante: deFila(ins.data as never) };
}

/**
 * Lo que contesta la condición «Su comprobante» de cada lead: el resultado de su ÚLTIMA lectura de las últimas 48 h. Sin
 * lectura, `no_llego`. Si la base no contesta, TIRA: el motor no decide una rama sobre un dato que no leyó.
 */
export async function resultadosDeComprobante(leadIds: readonly number[]): Promise<Map<number, ResultadoComprobante>> {
  const out = new Map<number, ResultadoComprobante>();
  if (!leadIds.length) return out;
  const db = await getTenantDb();
  const desde = new Date(Date.now() - HORAS_HACIA_ATRAS * 3600_000).toISOString();
  const { data, error } = await db.from('comprobantes_leidos').select('lead_id, resultado, created_at')
    .in('lead_id', [...new Set(leadIds)]).gte('created_at', desde).order('created_at', { ascending: false }).limit(1000);
  if (error && !faltaLaTabla(error)) throw new Error(`no pude leer los comprobantes: ${error.message}`);
  for (const f of (data ?? []) as Array<{ lead_id: number; resultado: ResultadoComprobante }>) if (!out.has(f.lead_id)) out.set(f.lead_id, f.resultado);
  return out;
}
