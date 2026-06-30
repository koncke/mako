// =============================================================================
// POST /api/ads-manager/analyze-creatives — MaKo "mira" los creativos (OpenAI visión)
// =============================================================================
// Recibe las miniaturas (dataURL) de los creativos y devuelve, por cada uno, una
// descripción corta + ángulo. Sirve para que el wizard pregunte mejor "¿qué querés
// hacer con estos creativos?" y para que MaKo escriba el copy alineado. Best-effort:
// si falla / no hay OPENAI_API_KEY, devuelve items vacíos sin romper el flujo.
// =============================================================================

import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const OAI = 'https://api.openai.com/v1';

export async function POST(req: NextRequest) {
  let body: { creatives?: Array<{ thumbnail?: string; media_type?: string }> };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  const creatives = (Array.isArray(body.creatives) ? body.creatives : [])
    .filter((c) => typeof c?.thumbnail === 'string' && c.thumbnail.startsWith('data:'))
    .slice(0, 8);
  const vacios = creatives.map(() => ({ descripcion: '', angulo: '' }));
  if (!creatives.length) return Response.json({ ok: true, items: [] });

  const key = process.env.OPENAI_API_KEY;
  if (!key) return Response.json({ ok: true, items: vacios });

  const sys = 'Sos un analista de creativos publicitarios. Mirás cada imagen (foto del anuncio o frame de un video) y describís, por cada una, QUÉ comunica y su ángulo/gancho. No inventes audio o texto que no ves. Sé breve y concreto.';
  const content: Array<Record<string, unknown>> = [{
    type: 'text',
    text: `Te paso ${creatives.length} creativo(s), en orden. Por cada uno devolvé {descripcion: 1 frase, angulo: 1-3 palabras}. Respondé EXCLUSIVAMENTE JSON: {"items":[{"descripcion":"…","angulo":"…"}]} con un item por creativo, en el mismo orden.`,
  }];
  creatives.forEach((c, i) => {
    content.push({ type: 'text', text: `Creativo ${i + 1}${c.media_type === 'video' ? ' (frame de video)' : ''}:` });
    content.push({ type: 'image_url', image_url: { url: c.thumbnail, detail: 'low' } });
  });

  try {
    const r = await fetch(`${OAI}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o', temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: sys }, { role: 'user', content }] }),
      cache: 'no-store',
    });
    const j = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const txt = j?.choices?.[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(txt) as { items?: unknown };
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
