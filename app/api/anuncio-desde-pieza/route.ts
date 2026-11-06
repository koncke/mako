// =============================================================================
// POST /api/anuncio-desde-pieza — «Usar en un anuncio» desde los editores de Create y el AI Avatar
// =============================================================================
// Lo prometido a la agencia de Thiago (docs/promesas/2910-llamada-thiago.md, [30:17] y [31:25]). Tres pedidos:
//   · `firmar`: una URL firmada del staging de anuncios para la pieza que exportó el editor (la MISMA firma que «Subir
//     creativos», lib/ads-staging-firma.ts). El archivo se borra a las 6 horas si no se publica.
//   · `preparar`: lo que la página /anuncio/nuevo necesita para armarse — la cuenta (lib/media-buyer/campana.ts →
//     datosParaNuevaCampana, la MISMA lectura de «Nueva campaña»), los videos que MaKo ya generó y la pieza resuelta EN ESTE
//     NEGOCIO (su vista previa), y si publicar por Zernio ya está probado (`ZERNIO_ANUNCIOS_PROBADO`).
//   · `proponer`: corre `proponer_crear_campana` por el choke point de la API (`ejecutarOperacion`, canal `app`, la sesión):
//     el mismo gating, la misma validación y la misma propuesta que pide MaKo por chat. Devuelve el link de /mako/revisar,
//     donde una persona la confirma. Acá no se crea nada en Meta.
//
// ⚠️ Fuera de TAB_DE_API a propósito (lib/api-tab.ts): la llaman cuatro tabs (Copywriter, Image, Video y AI Avatar) y la
//    página de /anuncio. La puerta es la del Ads Manager (`wsDeAdsManager`), y la operación vuelve a mirar el plan y el rol.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { wsDeAdsManager } from '@/lib/ads-guard';
import { getUsuarioActual } from '@/lib/auth';
import { getRolWsEfectivo, runWithWorkspace } from '@/lib/workspace';
import { firmarSubidaDeStaging, barrerStagingViejo } from '@/lib/ads-staging-firma';
import { getSupabaseServer } from '@/lib/supabase';
import { ADS_CREATIVES_BUCKET } from '@/lib/meta-ads-create';
import { datosParaNuevaCampana } from '@/lib/media-buyer/campana';
import { generadosDelNegocio } from '@/lib/media-buyer/subir';
import { CAMPANA_PRENDIDA_MEDIDA } from '@/lib/media-buyer/campana-reglas';
import { ZERNIO_ANUNCIOS_PROBADO } from '@/lib/zernio-ads-cuerpo';
import { leerRefCreativo, type CreativoMako } from '@/lib/creativo-mako';
import { resolverCreativoMako, tomasDelWorkspace } from '@/lib/creativo-mako-fuentes';
import { ejecutarOperacion } from '@/lib/api-mako/ejecutar';
import { leerPieza, type CreativoDePieza } from '@/lib/anuncio-desde-pieza';
import { after } from 'next/server';
import type { Ctx } from '@/lib/api-mako/tipos';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const J = (b: unknown, status = 200) => NextResponse.json(b, { status });

/** Lo que la página muestra de la pieza: su vista previa y el creativo ya resuelto (una toma, a la ref de su clip de HOY). */
type PiezaResuelta = { creativo: Exclude<CreativoDePieza, { tipo: 'toma' }> | null; vista: { url: string; media: 'imagen' | 'video' } | null; error: string | null };

async function resolverPieza(ws: number, c: CreativoDePieza | null): Promise<PiezaResuelta> {
  if (!c) return { creativo: null, vista: null, error: null };
  if (c.tipo === 'archivo') {
    const { data, error } = await getSupabaseServer().storage.from(ADS_CREATIVES_BUCKET).createSignedUrl(c.path, 3600);
    if (error || !data?.signedUrl) return { creativo: null, vista: null, error: 'No encuentro el archivo que exportaste: vuelve a tocar «Usar en un anuncio» en el editor.' };
    return { creativo: c, vista: { url: data.signedUrl, media: c.media }, error: null };
  }
  const deMako = (x: CreativoMako) => ({ creativo: { tipo: 'generado' as const, ref: x.ref }, vista: { url: x.url, media: x.media_type === 'image' ? 'imagen' as const : 'video' as const }, error: null });
  if (c.tipo === 'toma') {
    const t = (await runWithWorkspace(ws, () => tomasDelWorkspace())).find((x) => x.plan_id === c.plan && x.toma === c.toma);
    return t ? deMako(t) : { creativo: null, vista: null, error: 'Esa toma todavía no tiene su video listo.' };
  }
  const ref = leerRefCreativo(c.ref);
  const x = ref ? await runWithWorkspace(ws, () => resolverCreativoMako(ref)) : null;
  if (x === 'cambio') return { creativo: null, vista: null, error: 'Ese video se volvió a filmar: vuelve a elegirlo para ver el de ahora.' };
  return x ? deMako(x) : { creativo: null, vista: null, error: 'Ese video ya no está entre tus videos de MaKo.' };
}

export async function POST(req: NextRequest) {
  const ws = await wsDeAdsManager();
  if (ws instanceof Response) return ws;
  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return J({ ok: false, error: 'Pedido inválido.' }, 400); }

  try {
    if (body.op === 'firmar') {
      const nombre = typeof body.nombre === 'string' && body.nombre.trim() ? body.nombre.trim().slice(0, 120) : 'pieza';
      const f = await firmarSubidaDeStaging(nombre);
      if (!f.ok) return J({ ok: false, error: `No pude preparar la subida: ${f.error}` }, 500);
      after(() => barrerStagingViejo());
      return J({ ok: true, path: f.path, signedUrl: f.signedUrl, apikey: f.apikey });
    }

    if (body.op === 'preparar') {
      const pieza = leerPieza((body.pieza ?? {}) as Record<string, string>);
      const [cuenta, resuelta, generados] = await Promise.all([
        datosParaNuevaCampana(ws),
        resolverPieza(ws, pieza.creativo),
        // Para la pieza sin video (un guion del Copywriter): elegir uno que MaKo ya hizo. Sin leerlos, la lista va vacía.
        generadosDelNegocio(ws).then((g) => g.map((c) => ({ ref: c.ref, titulo: c.titulo, toma: c.toma, url: c.url, fecha: c.fecha }))).catch(() => []),
      ]);
      return J({
        ok: true, ...cuenta, pieza: { ...pieza, ...resuelta }, generados,
        zernioProbado: ZERNIO_ANUNCIOS_PROBADO, prendidaMedida: CAMPANA_PRENDIDA_MEDIDA,
      });
    }

    if (body.op === 'proponer') {
      const sesion = await getUsuarioActual();
      const rol = await getRolWsEfectivo();
      if (!sesion || !rol) return J({ ok: false, error: 'no autenticado' }, 401);
      const sub = String(sesion.sub);
      const ctx: Ctx = {
        ws, canal: 'app', canalKey: `app:anuncio-desde-pieza:${sub}`, alcance: 'proponer', rol: rol === 'admin' ? 'admin' : 'miembro',
        actor: sesion.email || sesion.nombre || sub,
        ...(/^\d+$/.test(sub) ? { quien: { sub, email: (sesion.email ?? '').toLowerCase(), nombre: sesion.nombre ?? '' } } : {}),
      };
      const entrada = (body.entrada && typeof body.entrada === 'object' ? body.entrada : {}) as Record<string, unknown>;
      const r = await ejecutarOperacion('proponer_crear_campana', entrada, ctx, 'json');
      if (!r.ok) return J({ ok: false, error: r.error, ...(r.faltan ? { faltan: r.faltan } : {}) }, r.status >= 500 ? 500 : 409);
      if (r.tipo !== 'propuesta') return J({ ok: false, error: 'No quedó la propuesta para revisar.' }, 500);
      return J({ ok: true, url: r.propuesta.url });
    }

    return J({ ok: false, error: 'Pedido desconocido.' }, 400);
  } catch (e) {
    console.error('[anuncio-desde-pieza]', e instanceof Error ? e.message : e);
    return J({ ok: false, error: 'No pude hablar con tu cuenta. Vuelve a intentarlo.' }, 500);
  }
}
