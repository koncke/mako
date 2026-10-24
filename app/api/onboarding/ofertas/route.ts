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
import { conSuIADelNegocio } from '@/lib/ia-del-negocio';
import { resolverWsAdmin, getPanorama } from '@/lib/archivero';
import { getAnswers, perfilNegocioTexto } from '@/lib/onboarding';
import { listProductos } from '@/lib/productos';
import { listarFunnels, crearFunnel, FUNNEL_DEFAULT_NOMBRE } from '@/lib/funnels';
import { templateDeCanal } from '@/lib/pipeline';
import {
  listarOfertas, filaOfertaPrincipal, upsertOferta, borrarOferta, marcarPrincipal, guardarOferta,
  ligarProducto, desligarProducto, productosDeOfertas,
  ligarOfertaAFunnel, desligarOfertaDeFunnel, ofertasDeFunnels,
  seedOfertaDesdeBrief,
} from '@/lib/ofertas';
import { sugerirOferta } from '@/lib/ofertas-ia';
import { ofertaDeLaPantalla, resolverOfertaPrincipal, sanearOfertaInput, type Oferta, type OfertaInput } from '@/lib/oferta-modelo';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const id = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};
// El saneo de 'guardar' (el número, la fecha AAAA-MM-DD, los bonos, la urgencia) vive en lib/oferta-modelo.ts
// (`sanearOfertaInput`): lo comparte con la API de MaKo.

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

  // ⛔ D6b: con su propio Claude o su GPT, lo que pide la IA acá no va a la Gemini gratis (tests/d6b-rutas.test.ts).
  return runWithWorkspace(ws, () => conSuIADelNegocio(ws, async () => {
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
        // El saneo y «la primera oferta es la principal» viven en lib/ (`sanearOfertaInput`, `guardarOferta`): los
        // comparte la API de MaKo (`guardar_oferta`). Lo que el saneo descarta, la pantalla lo ignora, como antes. Y sin
        // `modelo`: la pantalla manda la oferta entera, y su modelo es el de cuando cargó (`ofertaDeLaPantalla`).
        const o = (body.oferta ?? {}) as Record<string, unknown>;
        const r = sanearOfertaInput(ofertaDeLaPantalla(o));
        if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 400 });
        const g = await guardarOferta(r.input, id(o.id) ?? undefined);
        return Response.json({ ok: true, ofertaId: g.id, ...(await estado()) });
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
  }));
}
