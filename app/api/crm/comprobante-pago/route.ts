// =============================================================================
// /api/crm/comprobante-pago — adjuntar el comprobante de un pago YA registrado (5/11/2026)
// =============================================================================
// POST multipart: file + leadId + pagoId → { ok, nombre }
//
// Lo usa «Registrar un pago» de la tab Pagos de una suscripción (app/crm/lead-view/ficha/pagos/suscripcion/): el pago
// entra por su acción (`registrarPagoSuscripcionAction`) y el archivo se sube después, acá. Una server action topea el
// cuerpo en 1 MB y una foto de celular lo pasa (AGENTS.md, «Tres topes del entorno»): por eso es una ruta multipart.
//
// ⚠️ NO PISA UN COMPROBANTE QUE YA ESTÁ: escribe sólo si el pago no tiene (`comprobante_path` null), con la condición en el
//    UPDATE mismo. Es la regla de /api/extract-receipt (una cuota cobrada no cambia de comprobante) del otro lado: acá se
//    agrega uno donde no hay, nunca se reemplaza.
// ⚠️ SIN IA: no lee el comprobante (eso es /api/extract-receipt, que lo hace antes de cobrar una cuota). Acá ya se cargó a
//    mano lo que dice; sólo se guarda el archivo.
// ⚠️ LA SESIÓN Y EL NEGOCIO SE CHEQUEAN ACÁ (no sólo en proxy.ts): `getTenantDb` filtra el lead y el pago por workspace
//    ANTES de escribir en Storage.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { getTenantDb, getWorkspaceActual } from '@/lib/workspace';

export const runtime = 'nodejs';

const MAX_BYTES = 20 * 1024 * 1024;
/** Lo que se acepta: una foto o un PDF (lo mismo que se muestra en «Ver comprobante»). */
const TIPOS = /^(image\/(png|jpe?g|webp|heic|heif|gif)|application\/pdf)$/i;

export async function POST(req: NextRequest) {
  const sesion = await getUsuarioActual().catch(() => null);
  if (!sesion) return Response.json({ error: 'Tu sesión no está activa. Recarga la página.' }, { status: 401 });
  const ws = await getWorkspaceActual();
  if (ws == null) return Response.json({ error: 'No sé de qué negocio es este pago.' }, { status: 403 });

  const form = await req.formData().catch(() => null);
  if (!form) return Response.json({ error: 'Pedido inválido.' }, { status: 400 });
  const file = form.get('file');
  const leadId = Number(form.get('leadId'));
  const pagoId = Number(form.get('pagoId'));
  if (!(file instanceof File)) return Response.json({ error: 'Falta el archivo.' }, { status: 400 });
  if (!Number.isInteger(leadId) || leadId <= 0 || !Number.isInteger(pagoId) || pagoId <= 0) return Response.json({ error: 'Pedido inválido.' }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: `El archivo pesa ${(file.size / 1048576).toFixed(1)} MB: el tope es 20 MB.` }, { status: 400 });
  const mime = file.type || 'application/octet-stream';
  if (!TIPOS.test(mime)) return Response.json({ error: 'Va una foto o un PDF.' }, { status: 400 });

  const db = await getTenantDb();
  const { data: pago, error: ePago } = await db.from('pagos').select('id, comprobante_path').eq('id', pagoId).eq('lead_id', leadId).maybeSingle();
  if (ePago) return Response.json({ error: `No pude leer el pago: ${ePago.message}` }, { status: 500 });
  if (!pago) return Response.json({ error: 'No encontré ese pago en este negocio.' }, { status: 404 });
  if ((pago as { comprobante_path?: string | null }).comprobante_path) return Response.json({ error: 'Ese pago ya tiene su comprobante.', ya_tenia: true }, { status: 409 });

  const buf = Buffer.from(await file.arrayBuffer());
  const seguro = (file.name || 'comprobante').replace(/[^\w.\-]+/g, '_').slice(-80);
  const path = `${ws}/${leadId}/comprobantes/${Date.now()}_${seguro}`;
  const { error: eSubir } = await db.storage.from('contratos').upload(path, buf, { contentType: mime, upsert: false });
  if (eSubir) return Response.json({ error: `No pude subir el archivo: ${eSubir.message}` }, { status: 500 });
  const nombre = (file.name || seguro).slice(0, 200);
  const { data: tocadas, error: eGuardar } = await db.from('pagos')
    .update({ comprobante_path: path, comprobante_nombre: nombre })
    .eq('id', pagoId).eq('lead_id', leadId).is('comprobante_path', null)
    .select('id');
  if (eGuardar) return Response.json({ error: `No pude guardar el comprobante: ${eGuardar.message}` }, { status: 500 });
  if (!tocadas?.length) return Response.json({ error: 'Ese pago ya tiene su comprobante.', ya_tenia: true }, { status: 409 });
  return Response.json({ ok: true, nombre });
}
