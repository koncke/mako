// =============================================================================
// /api/onboarding/productos — el catálogo de productos del negocio
// =============================================================================
// GET  → { productos, tieneContexto }
// POST → action 'sugerir' (MaKo los arma leyendo el brief + El Archivero)
//        | 'guardar' (alta/edición manual) | 'borrar'
// Piso: admin del workspace; el dueño (sin impersonar) opera sobre OWNER_WS —
// mismo guard que el resto de los pasos del onboarding.

import type { NextRequest } from 'next/server';
import { runWithWorkspace } from '@/lib/workspace';
import { resolverWsAdmin } from '@/lib/archivero';
import { perfilNegocioTexto } from '@/lib/onboarding';
import { getPanorama } from '@/lib/archivero';
import { listProductos, upsertProducto, deleteProducto, type ProductoInput } from '@/lib/productos';
import { sugerirProductos } from '@/lib/productos-ia';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const num = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) { const n = parseFloat(v.replace(/[^\d.]/g, '')); return Number.isFinite(n) ? n : null; }
  return null;
};

async function estado() {
  const [productos, brief, panorama] = await Promise.all([
    listProductos(),
    perfilNegocioTexto().catch(() => ''),
    getPanorama().catch(() => ''),
  ]);
  return { productos, tieneContexto: !!(brief.trim() || panorama.trim()) };
}

export async function GET() {
  const ws = await resolverWsAdmin();
  if (ws == null) return Response.json({ ok: false, error: 'Solo el admin del workspace.' }, { status: 403 });
  return runWithWorkspace(ws, async () => {
    try { return Response.json({ ok: true, ...(await estado()) }); }
    catch (e) { return Response.json({ ok: false, error: msg(e) }, { status: 500 }); }
  });
}

export async function POST(req: NextRequest) {
  const ws = await resolverWsAdmin();
  if (ws == null) return Response.json({ ok: false, error: 'Solo el admin del workspace.' }, { status: 403 });
  let body: { action?: string; producto?: unknown; id?: unknown };
  try { body = (await req.json()) as typeof body; } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  return runWithWorkspace(ws, async () => {
    try {
      if (body.action === 'sugerir') {
        const r = await sugerirProductos();
        if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 422 });
        // Se guardan de una: el usuario los ve como tarjetas y corrige lo que quiera.
        // Los que ya existían con el mismo nombre se ACTUALIZAN (no se duplican).
        const previos = await listProductos();
        for (const p of r.productos) {
          const igual = previos.find((x) => x.nombre.trim().toLowerCase() === p.nombre.trim().toLowerCase());
          await upsertProducto(p, igual?.id);
        }
        return Response.json({ ok: true, ...(await estado()) });
      }

      if (body.action === 'guardar') {
        const o = (body.producto ?? {}) as Record<string, unknown>;
        const nombre = s(o.nombre);
        if (!nombre) return Response.json({ ok: false, error: 'El producto necesita un nombre.' }, { status: 400 });
        const tipo = s(o.tipo) === 'suscripcion' ? 'suscripcion' : 'unico';
        const input: ProductoInput = {
          nombre,
          tipo,
          monto_usd: num(o.monto_usd),
          suscripcion_meses: tipo === 'suscripcion' ? num(o.suscripcion_meses) : null,
          promesa: s(o.promesa) || null,
          incluye: s(o.incluye) || null,
          garantia: s(o.garantia) || null,
          descripcion: s(o.descripcion) || null,
          activo: o.activo === false ? false : true,
        };
        const id = typeof o.id === 'number' && o.id > 0 ? o.id : undefined;
        await upsertProducto(input, id);
        return Response.json({ ok: true, ...(await estado()) });
      }

      if (body.action === 'borrar') {
        const id = typeof body.id === 'number' ? body.id : Number(body.id);
        if (!Number.isFinite(id) || id <= 0) return Response.json({ ok: false, error: 'id inválido' }, { status: 400 });
        await deleteProducto(id);
        return Response.json({ ok: true, ...(await estado()) });
      }

      return Response.json({ ok: false, error: 'acción desconocida' }, { status: 400 });
    } catch (e) {
      return Response.json({ ok: false, error: msg(e) }, { status: 500 });
    }
  });
}
