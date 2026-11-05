// =============================================================================
// recibos-negocio — un negocio le emite y le manda el recibo de pago a su cliente (5/11/2026)
// =============================================================================
// La tarjeta «Emitir recibo» de Automations (lib/api-mako: `emitir_recibo`). Las reglas puras (la foto, el texto):
// lib/recibo-negocio-reglas.ts. El PDF: lib/recibo-pdf.ts, con la plantilla que eligió el negocio. La numeración, POR
// NEGOCIO y en la base (mig 0399, `emitir_recibo_negocio`): el único que da números es este archivo.
//
// ⚠️ SALE COMO EL NEGOCIO, NUNCA COMO MaKo. El correo va con `sendEmail` SIN `from`: lo firma el remitente del negocio
// (`remitenteDelNegocioActual`), y sin dominio propio no sale y se dice por qué. El WhatsApp sale por SU línea (la de por
// defecto, `enviarMediaYEspejar`). Al grupo de MaKo del negocio, por `copiarAlGrupo` y después WhatsApp.
// ⚠️ UN RECIBO POR PAGO: la clave es `pago:<id>`. Emitirlo otra vez (un reintento del motor, otra automatización) devuelve el
// mismo número y no manda otro si ya salió.
// =============================================================================

import 'server-only';
import crypto from 'node:crypto';
import { getSupabaseServer } from './supabase';
import { getTenantDb } from './workspace';
import { zonaDelNegocio } from './timezone';
import { sendEmail } from './resend';
import { enviarMediaYEspejar } from './evolution-envio';
import { enviarPartesAlGrupoMaKo } from './mako-grupo';
import { copiarAlGrupo } from './grupo-app';
import { nombreDelNegocio } from './carruseles/marca';
import { pdfDelRecibo, type FotoRecibo } from './recibo-pdf';
import type { PartePreparada } from './mako-tarjeta';
import {
  emisorDelNegocio, fotoDelPago, nombreDelPdfNegocio, textoDelRecibo, ROTULO_CANAL_RECIBO,
  type CanalRecibo, type CuotaCobrada, type DelComprobante, type IdentidadFiscal, type PlantillaRecibo,
} from './recibo-negocio-reglas';

export type ResultadoEmitir =
  | { ok: true; numero: number; yaEstaba: boolean; envio: 'enviado' | 'ya_enviado'; resumen: string }
  | { ok: false; error: string; numero?: number; falla?: true };

const faltaLaTabla = (e: { code?: string; message?: string } | null | undefined): boolean =>
  !!e && (['42P01', 'PGRST205', '42883', 'PGRST202'].includes(e.code ?? '') || /recibos_negocio|emitir_recibo_negocio/.test(e.message ?? '') && /does not exist|schema cache|Could not find/.test(e.message ?? ''));
const FALTA_MIGRACION = 'No pude emitir el recibo: falta la migración 0399.';

/** El texto de un error de envío, corto: lo lee la persona en el resumen y queda en la fila. */
const corto = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, 300);

/**
 * Emite el recibo de la cuota cobrada `pagoId` del lead (sin `pagoId`, la última que se cobró) con la plantilla elegida, y lo
 * manda por `canal`. Nunca tira: devuelve el motivo.
 */
export async function emitirReciboDelLead(ws: number, leadId: number, o: { pagoId?: number | null; plantilla: PlantillaRecibo; canal: CanalRecibo; autor: string }): Promise<ResultadoEmitir> {
  const db = await getTenantDb();
  const { data: lead, error: errLead } = await db.from('leads').select('id, nombre, telefono, email, facturado_por_id').eq('id', leadId).maybeSingle();
  if (errLead) return { ok: false, error: `No pude leer el lead: ${errLead.message}`, falla: true };
  if (!lead) return { ok: false, error: `No existe el lead #${leadId} en este negocio.` };
  const L = lead as { id: number; nombre: string | null; telefono: string | null; email: string | null; facturado_por_id: number | null };

  // La cuota: la pedida, o la última cobrada.
  let q = db.from('pagos').select('id, numero, pagado, monto_usd, moneda, monto_original, fecha_pago, pago_hora, proveedor, es_mensualidad, nacio_cobrada').eq('lead_id', leadId).eq('pagado', true);
  q = o.pagoId ? q.eq('id', o.pagoId) : q.order('fecha_pago', { ascending: false, nullsFirst: false }).order('id', { ascending: false });
  const { data: cuotas, error: errCuota } = await q.limit(1);
  if (errCuota) return { ok: false, error: `No pude leer las cuotas: ${errCuota.message}`, falla: true };
  const cuota = (cuotas ?? [])[0] as CuotaCobrada | undefined;
  if (!cuota) return { ok: false, error: o.pagoId ? 'Esa cuota no es de este lead o todavía no está cobrada.' : `${L.nombre ?? 'El lead'} no tiene un pago cobrado.` };

  // El destino, ANTES de emitir: sin destino no se gasta un número.
  if (o.canal === 'whatsapp' && !(L.telefono ?? '').replace(/\D/g, '')) return { ok: false, error: `${L.nombre ?? 'El lead'} no tiene teléfono: el recibo no puede salir por WhatsApp.` };
  if (o.canal === 'email' && !/@/.test(L.email ?? '')) return { ok: false, error: `${L.nombre ?? 'El lead'} no tiene correo: el recibo no puede salir por correo.` };

  const [ident, negocio, zona, comprobante] = await Promise.all([identidadDelLead(L.facturado_por_id), nombreDelNegocio(ws), zonaDelNegocio(ws), comprobanteDeLaCuota(cuota.id)]);
  const nombreNegocio = negocio ?? 'Tu negocio';
  let foto: FotoRecibo;
  try {
    foto = fotoDelPago({ cuota, aNombre: L.nombre ?? '', emisor: emisorDelNegocio(ident, nombreNegocio), zona, producto: null, comprobante, plantilla: o.plantilla, emitidoAt: new Date().toISOString() });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const sb = getSupabaseServer();
  const { data: em, error: errEm } = await sb.rpc('emitir_recibo_negocio', { p: {
    workspace_id: ws, clave: `pago:${cuota.id}`, lead_id: leadId, pago_id: cuota.id, plantilla: o.plantilla, a_nombre: foto.aNombre,
    foto, canal: o.canal, emitido_por: o.autor,
  } });
  if (errEm) return { ok: false, error: faltaLaTabla(errEm) ? FALTA_MIGRACION : `No pude emitir el recibo: ${errEm.message}`, falla: true };
  const fila = (Array.isArray(em) ? em[0] : em) as { recibo_id: number; numero: number; ya_estaba: boolean } | undefined;
  if (!fila) return { ok: false, error: 'No pude emitir el recibo: la base no devolvió el número.', falla: true };

  const { data: rec, error: errRec } = await db.from('recibos_negocio').select('id, numero, foto, pdf_path, pdf_sha256, canal, envio_estado').eq('id', fila.recibo_id).maybeSingle();
  if (errRec || !rec) return { ok: false, error: `No pude leer el recibo N.º ${fila.numero}: ${errRec?.message ?? 'sin fila'}`, numero: fila.numero, falla: true };
  const R = rec as { id: number; numero: number; foto: FotoRecibo; pdf_path: string | null; pdf_sha256: string | null; canal: CanalRecibo; envio_estado: string };
  if (fila.ya_estaba && R.envio_estado === 'enviado') {
    return { ok: true, numero: R.numero, yaEstaba: true, envio: 'ya_enviado', resumen: `Ese pago ya tenía el recibo N.º ${String(R.numero).padStart(4, '0')} y ya había salido.` };
  }

  // El PDF: el guardado (mismo documento siempre), o se arma con la FOTO guardada y se guarda.
  let pdf: Uint8Array;
  try {
    pdf = await pdfGuardado(ws, leadId, R);
  } catch (e) {
    return { ok: false, error: `No pude armar el PDF del recibo: ${e instanceof Error ? e.message : String(e)}`, numero: R.numero, falla: true };
  }
  const t = textoDelRecibo(R.numero, o.canal, nombreNegocio);
  const nombre = nombreDelPdfNegocio(R.numero, R.foto.aNombre);
  const base64 = Buffer.from(pdf).toString('base64');

  let error: string | null = null;
  if (o.canal === 'whatsapp') {
    const r = await enviarMediaYEspejar({ telefono: L.telefono ?? '', media: { base64, mimetype: 'application/pdf', fileName: nombre, tipo: 'document' }, caption: t.pie, leadId });
    if (!r.ok) error = r.error ?? 'WhatsApp no lo aceptó';
  } else if (o.canal === 'email') {
    // SIN `from`: lo firma el remitente del negocio (lib/resend.ts), y sin dominio propio `sendEmail` se niega con el motivo.
    const r = await sendEmail({
      to: L.email ?? '', subject: t.asunto, text: t.cuerpo, html: `<p>${t.cuerpo.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>`,
      attachments: [{ filename: nombre, content: base64 }], idempotencyKey: `recibo-negocio:${ws}:${R.id}`,
    });
    if (!r.ok) error = r.error;
  } else {
    const partes: PartePreparada[] = [{ tipo: 'media', base64, media: { tipo: 'document', mimetype: 'application/pdf', fileName: nombre }, caption: t.pie }];
    await copiarAlGrupo(ws, { texto: t.pie, de: 'mako', avisoTipo: 'recibo', partes });
    const s = await enviarPartesAlGrupoMaKo(ws, partes);
    if (!s.ok) error = s.error ?? 'no salió al grupo';
  }
  await db.from('recibos_negocio').update(error
    ? { envio_estado: 'fallo', envio_error: corto(error) }
    : { envio_estado: 'enviado', envio_error: null, enviado_at: new Date().toISOString() }).eq('id', R.id);
  const n = String(R.numero).padStart(4, '0');
  if (error) return { ok: false, error: `El recibo N.º ${n} quedó emitido pero no salió (${ROTULO_CANAL_RECIBO[o.canal].toLowerCase()}): ${corto(error)}`, numero: R.numero };
  return { ok: true, numero: R.numero, yaEstaba: fila.ya_estaba, envio: 'enviado', resumen: `Listo: recibo N.º ${n} emitido y enviado (${ROTULO_CANAL_RECIBO[o.canal].toLowerCase()}).` };
}

/** «Facturado por» del lead, o la identidad por defecto del negocio. Una lectura que falla no inventa: queda sin identidad. */
async function identidadDelLead(id: number | null): Promise<IdentidadFiscal | null> {
  const db = await getTenantDb();
  const q = id ? db.from('identidades_fiscales').select('nombre, id_fiscal, domicilio, correo').eq('id', id)
    : db.from('identidades_fiscales').select('nombre, id_fiscal, domicilio, correo').eq('es_default', true);
  const { data } = await q.limit(1);
  return ((data ?? [])[0] as IdentidadFiscal | undefined) ?? null;
}

/** El medio y el N.º del comprobante que la tarjeta «Leer comprobante» leyó para ESA cuota y que la cubría. */
async function comprobanteDeLaCuota(pagoId: number): Promise<DelComprobante> {
  const db = await getTenantDb();
  const { data } = await db.from('comprobantes_leidos').select('lectura, operacion').eq('pago_id', pagoId).eq('resultado', 'cubre')
    .order('created_at', { ascending: false }).limit(1);
  const f = (data ?? [])[0] as { lectura?: { medio?: unknown }; operacion?: string | null } | undefined;
  if (!f) return null;
  return { medio: typeof f.lectura?.medio === 'string' ? f.lectura.medio : null, operacion: f.operacion ?? null };
}

/** El PDF del recibo: el guardado si su huella coincide; si no, se arma con la foto guardada y se guarda en `contratos`. */
async function pdfGuardado(ws: number, leadId: number, R: { id: number; numero: number; foto: FotoRecibo; pdf_path: string | null; pdf_sha256: string | null }): Promise<Uint8Array> {
  const sb = getSupabaseServer();
  if (R.pdf_path && R.pdf_sha256) {
    const { data } = await sb.storage.from('contratos').download(R.pdf_path);
    if (data) {
      const b = new Uint8Array(await data.arrayBuffer());
      if (crypto.createHash('sha256').update(b).digest('hex') === R.pdf_sha256) return b;
    }
  }
  const pdf = await pdfDelRecibo({ ...R.foto, numero: R.numero });
  const path = `${ws}/${leadId}/recibos/${R.id}.pdf`;
  const { error } = await sb.storage.from('contratos').upload(path, pdf, { contentType: 'application/pdf', upsert: true });
  if (error) throw new Error(`storage: ${error.message}`);
  const sha = crypto.createHash('sha256').update(pdf).digest('hex');
  await (await getTenantDb()).from('recibos_negocio').update({ pdf_path: path, pdf_sha256: sha }).eq('id', R.id);
  return pdf;
}

/** «Ver ejemplo» de una plantilla: el PDF con los datos de este negocio y un pago de muestra, sin número. */
export async function ejemploDeRecibo(ws: number, plantilla: PlantillaRecibo): Promise<Uint8Array> {
  const [negocio, zona, ident] = await Promise.all([nombreDelNegocio(ws), zonaDelNegocio(ws), identidadDelLead(null)]);
  const foto = fotoDelPago({
    cuota: { id: 1, numero: 2, pagado: true, monto_usd: 97, moneda: 'USD', monto_original: null, fecha_pago: new Date().toISOString().slice(0, 10), pago_hora: '10:30', proveedor: null },
    aNombre: 'Ana Pérez (ejemplo)', emisor: emisorDelNegocio(ident, negocio ?? 'Tu negocio'), zona, producto: null,
    comprobante: { medio: 'Transferencia', operacion: '000123456789' }, plantilla, emitidoAt: new Date().toISOString(),
  });
  return pdfDelRecibo({ ...foto, ejemplo: true });
}
