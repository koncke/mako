// =============================================================================
// /api/onboarding/ofertas — la OFERTA del negocio y a qué funnels se vende
// =============================================================================
// GET  → { ofertas, campos, productos, funnels, ligasProducto, ligasFunnel, tieneContexto }
// POST → 'sugerir' (MaKo la arma leyendo el brief + El Archivero) | 'guardar'
//        | 'borrar' | 'principal' | 'ligar-producto' | 'desligar-producto'
//        | 'ligar-funnel' | 'desligar-funnel' | 'crear-funnel'
// Piso: admin del workspace; el dueño (sin impersonar) opera sobre OWNER_WS —
// mismo guard que el resto de los pasos del onboarding.

import type { NextRequest } from 'next/server';
import { runWithWorkspace } from '@/lib/workspace';
import { resolverWsAdmin, getPanorama } from '@/lib/archivero';
import { getAnswers, perfilNegocioTexto } from '@/lib/onboarding';
import { listProductos } from '@/lib/productos';
import { listarFunnels, crearFunnel, FUNNEL_DEFAULT_NOMBRE } from '@/lib/funnels';
import { templateDeCanal } from '@/lib/pipeline';
import {
  listarOfertas, filaOfertaPrincipal, upsertOferta, borrarOferta, marcarPrincipal,
  ligarProducto, desligarProducto, productosDeOfertas,
  ligarOfertaAFunnel, desligarOfertaDeFunnel, ofertasDeFunnels,
  seedOfertaDesdeBrief,
} from '@/lib/ofertas';
import { sugerirOferta } from '@/lib/ofertas-ia';
import { resolverOfertaPrincipal, esUrgenciaTipo, parseBonos, type Oferta, type OfertaInput } from '@/lib/oferta-modelo';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const num = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) { const n = Number(v.replace(/[^\d.]/g, '')); return Number.isFinite(n) ? n : null; }
  return null;
};
const id = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};
/** `YYYY-MM-DD` o nada. Una fecha mal formada es un dato que después nadie puede comparar. */
const fecha = (v: unknown): string | null => {
  const t = s(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
};

/**
 * La IA COMPLETA, nunca pisa. Es la MISMA capa determinista que ya tiene el paso
 * de productos, y por el mismo motivo: la regla «la IA completa con lo ya
 * cargado» vivía sólo en la prosa del prompt, y una regla que sólo vive en un
 * prompt no es una regla.
 *
 * `nombre` no se toca: es la llave del índice único del workspace.
 */
function completar(actual: Oferta, sug: OfertaInput): OfertaInput {
  const texto = (a: string | null, b: string | null | undefined) => (a?.trim() ? a : (b?.trim() || null));
  return {
    nombre: actual.nombre,
    precio_usd: actual.precio_usd ?? sug.precio_usd ?? null,
    precio_nota: texto(actual.precio_nota, sug.precio_nota),
    promesa: texto(actual.promesa, sug.promesa),
    incluye: texto(actual.incluye, sug.incluye),
    garantia: texto(actual.garantia, sug.garantia),
    para_quien: texto(actual.para_quien, sug.para_quien),
    objeciones: texto(actual.objeciones, sug.objeciones),
    prueba: texto(actual.prueba, sug.prueba),
    bonos: actual.bonos.length ? actual.bonos : (sug.bonos ?? []),
    // La urgencia declarada por una persona NO la pisa un modelo: es el campo del
    // que cuelga si un ángulo se puede usar o no.
    urgencia_tipo: actual.urgencia_tipo ?? sug.urgencia_tipo ?? null,
    urgencia_dato: texto(actual.urgencia_dato, sug.urgencia_dato),
    urgencia_razon: texto(actual.urgencia_razon, sug.urgencia_razon),
    urgencia_hasta: actual.urgencia_hasta,
    activa: actual.activa,
    orden: actual.orden,
  };
}

async function estado() {
  const [ofertas, productos, funnels, ligasProducto, ligasFunnel, answers, brief, panorama] = await Promise.all([
    listarOfertas(),
    listProductos().catch(() => []),
    listarFunnels().catch(() => []),
    productosDeOfertas().catch(() => []),
    ofertasDeFunnels().catch(() => []),
    getAnswers().catch(() => ({} as Record<string, string>)),
    perfilNegocioTexto().catch(() => ''),
    getPanorama().catch(() => ''),
  ]);
  // Lo que los prompts ven HOY de la oferta principal, con su `origen`. Es lo
  // único que hace visible el mecanismo `desde_brief`: sin esto, una oferta con
  // los 5 campos en NULL se ve vacía en pantalla mientras la IA sí los recibe.
  const principal = ofertas.find((o) => o.es_principal) ?? null;
  const resuelta = resolverOfertaPrincipal(principal, answers);
  return {
    ofertas, productos, funnels, ligasProducto, ligasFunnel,
    campos: resuelta.campos, origen: resuelta.origen,
    tieneContexto: !!(brief.trim() || panorama.trim()),
  };
}

export async function GET() {
  const ws = await resolverWsAdmin();
  if (ws == null) return Response.json({ ok: false, error: 'Solo el admin del workspace.' }, { status: 403 });
  return runWithWorkspace(ws, async () => {
    try {
      // La oferta principal sale del brief que el cliente YA declaró: no se le
      // vuelve a preguntar lo que ya contestó. Idempotente y con guard propio
      // (setting mako.ofertas.seeded), así que se puede llamar en cada carga.
      const funnels = await listarFunnels().catch(() => []);
      const def = funnels.find((f) => f.esDefault) ?? funnels[0] ?? null;
      const answers = await getAnswers().catch(() => ({} as Record<string, string>));
      await seedOfertaDesdeBrief(answers, def?.id ?? null).catch(() => {});
      return Response.json({ ok: true, ...(await estado()) });
    } catch (e) { return Response.json({ ok: false, error: msg(e) }, { status: 500 }); }
  });
}

export async function POST(req: NextRequest) {
  const ws = await resolverWsAdmin();
  if (ws == null) return Response.json({ ok: false, error: 'Solo el admin del workspace.' }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  const action = s(body.action);

  return runWithWorkspace(ws, async () => {
    try {
      if (action === 'sugerir') {
        const actual = await filaOfertaPrincipal();
        const r = await sugerirOferta(actual);
        if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 422 });
        if (actual) await upsertOferta(completar(actual, r.oferta), actual.id);
        else {
          const nuevo = await upsertOferta(r.oferta);
          await marcarPrincipal(nuevo);
        }
        return Response.json({ ok: true, ...(await estado()) });
      }

      if (action === 'guardar') {
        const o = (body.oferta ?? {}) as Record<string, unknown>;
        const nombre = s(o.nombre);
        if (!nombre) return Response.json({ ok: false, error: 'La oferta necesita un nombre.' }, { status: 400 });
        const ut = esUrgenciaTipo(o.urgencia_tipo) ? o.urgencia_tipo : null;
        const udato = ut ? s(o.urgencia_dato) : '';
        const input: OfertaInput = {
          nombre,
          precio_usd: num(o.precio_usd),
          precio_nota: s(o.precio_nota) || null,
          promesa: s(o.promesa) || null,
          incluye: s(o.incluye) || null,
          garantia: s(o.garantia) || null,
          para_quien: s(o.para_quien) || null,
          objeciones: s(o.objeciones) || null,
          prueba: s(o.prueba) || null,
          bonos: parseBonos(o.bonos),
          // Sin dato concreto no hay urgencia: un tipo suelto pinta una restricción
          // que no dice nada y que nadie puede verificar.
          urgencia_tipo: udato ? ut : null,
          urgencia_dato: udato || null,
          urgencia_razon: udato ? (s(o.urgencia_razon) || null) : null,
          urgencia_hasta: udato ? fecha(o.urgencia_hasta) : null,
          activa: o.activa === false ? false : true,
        };
        const existente = id(o.id);
        const nuevo = await upsertOferta(input, existente ?? undefined);
        // La primera oferta de un workspace es la principal: sin esto,
        // `ofertaPrincipal()` devolvería 'sin-fila' con una oferta cargada.
        if (!existente && (await listarOfertas()).filter((x) => x.es_principal).length === 0) {
          await marcarPrincipal(nuevo);
        }
        return Response.json({ ok: true, ofertaId: nuevo, ...(await estado()) });
      }

      if (action === 'borrar') {
        const oid = id(body.id);
        if (oid == null) return Response.json({ ok: false, error: 'id inválido' }, { status: 400 });
        await borrarOferta(oid);
        return Response.json({ ok: true, ...(await estado()) });
      }

      if (action === 'principal') {
        const oid = id(body.id);
        if (oid == null) return Response.json({ ok: false, error: 'id inválido' }, { status: 400 });
        await marcarPrincipal(oid);
        return Response.json({ ok: true, ...(await estado()) });
      }

      if (action === 'ligar-producto' || action === 'desligar-producto') {
        const oid = id(body.ofertaId), pid = id(body.productoId);
        if (oid == null || pid == null) return Response.json({ ok: false, error: 'ids inválidos' }, { status: 400 });
        if (action === 'ligar-producto') await ligarProducto(oid, pid, s(body.rol) || 'incluido');
        else await desligarProducto(oid, pid);
        return Response.json({ ok: true, ...(await estado()) });
      }

      if (action === 'ligar-funnel' || action === 'desligar-funnel') {
        const oid = id(body.ofertaId), fid = id(body.funnelId);
        if (oid == null || fid == null) return Response.json({ ok: false, error: 'ids inválidos' }, { status: 400 });
        if (action === 'ligar-funnel') await ligarOfertaAFunnel(fid, oid, body.esPrincipal === true);
        else await desligarOfertaDeFunnel(fid, oid);
        return Response.json({ ok: true, ...(await estado()) });
      }

      if (action === 'crear-funnel') {
        const nombre = s(body.nombre);
        if (!nombre) return Response.json({ ok: false, error: 'El funnel necesita un nombre.' }, { status: 400 });
        if (nombre.toLowerCase() === FUNNEL_DEFAULT_NOMBRE.toLowerCase()) {
          return Response.json({ ok: false, error: `Ya existe «${FUNNEL_DEFAULT_NOMBRE}». Ponle otro nombre.` }, { status: 400 });
        }
        // `templateDeCanal` falla CERRADO: un canal desconocido no siembra nada en
        // vez de caer a una plantilla genérica, que es como nació ese problema.
        // Un funnel sin plantilla nace vacío y se edita en /funnel.
        const canal = s(body.canal) || null;
        const tpl = templateDeCanal(canal);
        const fid = await crearFunnel({
          nombre, canal,
          plantilla: tpl?.id ?? null,
          pipeline: tpl?.pipeline, suppressed: tpl?.suppressed ?? [],
          esDefault: false,
        });
        const oid = id(body.ofertaId);
        if (oid != null) await ligarOfertaAFunnel(fid, oid, true);
        return Response.json({ ok: true, funnelId: fid, ...(await estado()) });
      }

      return Response.json({ ok: false, error: 'acción desconocida' }, { status: 400 });
    } catch (e) {
      return Response.json({ ok: false, error: msg(e) }, { status: 500 });
    }
  });
}
