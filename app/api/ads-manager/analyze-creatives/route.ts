// =============================================================================
// POST /api/ads-manager/analyze-creatives — MaKo "mira" los creativos (con la IA del negocio)
// =============================================================================
// Recibe las miniaturas (dataURL) de los creativos y devuelve, por cada uno, una
// descripción corta + ángulo. Sirve para que el wizard pregunte mejor "¿qué querés
// hacer con estos creativos?" y para que MaKo escriba el copy alineado. Best-effort:
// si falla o el negocio no tiene una IA que mire, devuelve items vacíos sin romper el flujo.
//
// IA7 (22/10/2026): miraba con la OpenAI de MaKo (`envCred`), que se quedó sin crédito, y no registraba el uso. Ahora mira
// la IA del NEGOCIO por la capa de IA (`leerDocumentoIA`): su Claude o su OpenAI con D6b, sus keys de siempre si no.
// =============================================================================

import type { NextRequest } from 'next/server';
import { guardAdsWs } from '@/lib/ads-guard';
import { leerDocumentoIA } from '@/lib/ai-cheap';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // Las hermanas de esta ruta ya exigían esDuenoAdmin, y esta no exigía NADA: dispara
  // IA cara (contra la key de la PLATAFORMA) para cualquier usuario logueado, aunque no
  // pueda usar el resto del área. Mismo guard que sus 13 hermanas.
  const no = await guardAdsWs(); if (no) return no;
  let body: { creatives?: Array<{ thumbnail?: string; media_type?: string }> };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  const creatives = (Array.isArray(body.creatives) ? body.creatives : [])
    .filter((c) => typeof c?.thumbnail === 'string' && c.thumbnail.startsWith('data:'))
    .slice(0, 8);
  const vacios = creatives.map(() => ({ descripcion: '', angulo: '' }));
  if (!creatives.length) return Response.json({ ok: true, items: [] });

  // Las imágenes van en orden (dataUrls): el prompt dice cuáles son frame de un video.
  const cuales = creatives.map((c, i) => `${i + 1}${c.media_type === 'video' ? ' (frame de video)' : ''}`).join(', ');
  const prompt = [
    'Eres un analista de creativos publicitarios. Miras cada imagen (foto del anuncio o frame de un video) y describes, por cada una, QUÉ comunica y su ángulo/gancho. No inventes audio o texto que no ves. Sé breve y concreto.',
    `Te paso ${creatives.length} creativo(s), en orden: ${cuales}. Por cada uno devuelve {descripcion: 1 frase, angulo: 1-3 palabras}. Responde EXCLUSIVAMENTE JSON: {"items":[{"descripcion":"…","angulo":"…"}]} con un item por creativo, en el mismo orden.`,
  ].join('\n\n');

  try {
    const r = await leerDocumentoIA({
      dataUrl: creatives[0].thumbnail!, dataUrls: creatives.map((c) => c.thumbnail!), isPdf: false, nombreArchivo: 'creativos.jpg',
      prompt, json: true, feature: 'ads-mirar-creativos', motivo: `Mirar ${creatives.length} creativo(s)`,
    });
    const parsed = JSON.parse(r.text || '{}') as { items?: unknown };
    const arr = Array.isArray(parsed.items) ? parsed.items : [];
    const items = arr.map((x) => {
      const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
      return { descripcion: String(o.descripcion ?? '').slice(0, 220), angulo: String(o.angulo ?? '').slice(0, 40) };
    });
    return Response.json({ ok: true, items: items.length ? items : vacios });
  } catch (err) {
    console.error(`[ads-manager:analyze-creatives] ${err instanceof Error ? err.message : String(err)}`);
    return Response.json({ ok: true, items: vacios }); // no romper el wizard
  }
}
