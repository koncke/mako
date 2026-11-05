// =============================================================================
// POST /api/admin/recibos/comprobante — subir el comprobante de un pago cargado a mano (5/11/2026)
// =============================================================================
// multipart con `archivo`. SÓLO JPEG o PNG por sus bytes (lib/recibos-reglas.ts, `sniffComprobante`), hasta 4 MB: Vercel corta
// el cuerpo de una función en 4,5 MB con un 413 en texto (app/api/graficos/imagen/route.ts), así que un tope de 10 MB prometería
// algo que no llega. Va a `contratos`, en `plataforma/recibos/comprobantes/<uuid>.<ext>`: sin un ws numérico al frente, para que
// ningún borrado por prefijo de un negocio lo alcance. ⚠️ `getSesionAdmin()` primero.

import { getSesionAdmin } from '@/lib/auth';
import { guardarComprobante } from '@/lib/recibos';

export const dynamic = 'force-dynamic';

const TOPE = 4 * 1024 * 1024;

export async function POST(req: Request) {
  if (!(await getSesionAdmin())) return Response.json({ ok: false, error: 'solo admin' }, { status: 403 });
  let form: FormData;
  try { form = await req.formData(); } catch { return Response.json({ ok: false, error: 'Manda el comprobante como archivo.' }, { status: 400 }); }
  const archivo = form.get('archivo');
  if (!(archivo instanceof File)) return Response.json({ ok: false, error: 'Falta el comprobante.' }, { status: 400 });
  if (archivo.size > TOPE) return Response.json({ ok: false, error: 'El comprobante pesa más de 4 MB: manda una captura más liviana.' }, { status: 413 });
  const r = await guardarComprobante(new Uint8Array(await archivo.arrayBuffer()), archivo.name);
  if (!r.ok) return Response.json(r, { status: 400 });
  return Response.json(r);
}
