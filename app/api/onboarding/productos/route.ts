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
import { listProductos, upsertProducto, deleteProducto, seedProductosDesdeOferta, type Producto, type ProductoInput } from '@/lib/productos';
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

/**
 * Nombre normalizado para el dedup. Sin tildes, sin dobles espacios, minúsculas.
 * El match exacto de antes creaba un duplicado con una tilde o un espacio de más.
 *
 * El rango de diacríticos se arma con `new RegExp` sobre una cadena ASCII, no con
 * un literal: escrito con los caracteres combinantes crudos, cualquier reescritura
 * del archivo que erre la codificación lo rompe en silencio.
 */
const DIACRITICOS = new RegExp('[\\u0300-\\u036f]', 'g');
const norm = (v: string) =>
  v.normalize('NFD').replace(DIACRITICOS, '').trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * La IA COMPLETA, nunca pisa.
 *
 * ⚠️ Antes la sugerencia hacía un UPDATE de TODAS las columnas con lo que devolvía
 * el modelo, así que una garantía escrita a mano desaparecía al volver a pedir
 * sugerencias. La regla —«la IA completa con lo ya cargado»— vivía solo en la prosa
 * del prompt, y una regla que solo vive en un prompt no es una regla. Esta es la
 * capa determinista: campo a campo, lo que ya tiene valor gana SIEMPRE.
 *
 * `tipo` no se toca nunca: es una decisión del dueño (único vs suscripción) que
 * arrastra el pricing entero del deal, y el modelo la adivina desde el texto.
 */
function completar(actual: Producto, sug: ProductoInput): ProductoInput {
  const texto = (a: string | null, b: string | null | undefined) => (a?.trim() ? a : (b?.trim() || null));
  return {
    nombre: actual.nombre,                    // el nombre es la llave del match: no se renombra
    tipo: actual.tipo,
    monto_usd: actual.monto_usd ?? sug.monto_usd ?? null,
    suscripcion_meses: actual.tipo === 'suscripcion'
      ? (actual.suscripcion_meses ?? sug.suscripcion_meses ?? null)
      : null,
    promesa: texto(actual.promesa, sug.promesa),
    incluye: texto(actual.incluye, sug.incluye),
    garantia: texto(actual.garantia, sug.garantia),
    descripcion: texto(actual.descripcion, sug.descripcion),
    activo: actual.activo,
    orden: actual.orden,
  };
}

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
    try {
      // El primer producto sale de la 'oferta' que el cliente YA declaró en el
      // brief: no se le vuelve a preguntar lo que ya contestó. Idempotente y con
      // guard propio (setting mako.productos.seeded), así que se puede llamar en
      // cada carga. Estaba escrita desde la 0117 y no la llamaba nadie.
      await seedProductosDesdeOferta().catch(() => {});
      return Response.json({ ok: true, ...(await estado()) });
    }
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
        // Los que ya existían con el mismo nombre se COMPLETAN campo a campo.
        const previos = await listProductos();
        for (const p of r.productos) {
          const igual = previos.find((x) => norm(x.nombre) === norm(p.nombre));
          await upsertProducto(igual ? completar(igual, p) : p, igual?.id);
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
