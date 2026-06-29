// =============================================================================
// POST /api/ads-manager/rename-suggest — MaKo propone una nomenclatura ordenada
// =============================================================================
// Body: { level, instruccion?, entities: [{ id, name, campana?, adset? }] }.
// Devuelve { ok, propuestas: [{ id, nombre }] } — un nombre nuevo, consistente y
// corto por cada entidad. NO escribe nada en Meta (eso lo hace /api/meta-write
// con la confirmación del usuario). Solo sugiere.
// =============================================================================

import type { NextRequest } from 'next/server';
import { chatClaude } from '@/lib/anthropic';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type Ent = { id: string; name: string; campana?: string | null; adset?: string | null };
const NOUN: Record<string, string> = { campaign: 'campañas', adset: 'conjuntos de anuncios', ad: 'anuncios' };

function parseJsonObject(text: string): Record<string, unknown> {
  const c = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const a = c.indexOf('{'), b = c.lastIndexOf('}');
  if (a === -1 || b <= a) throw new Error('respuesta sin JSON');
  return JSON.parse(c.slice(a, b + 1));
}

export async function POST(req: NextRequest) {
  let body: { level?: string; instruccion?: string; entities?: Ent[] };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  const level = body.level === 'campaign' || body.level === 'adset' || body.level === 'ad' ? body.level : null;
  const entities = Array.isArray(body.entities) ? body.entities.filter((e) => e && typeof e.id === 'string' && typeof e.name === 'string') : [];
  if (!level) return Response.json({ ok: false, error: 'level inválido' }, { status: 400 });
  if (!entities.length) return Response.json({ ok: false, error: 'sin entidades' }, { status: 400 });

  const noun = NOUN[level];
  const system = `Sos MaKo, el copiloto de marketing de Mauricio Bustos. Tu tarea: ordenar la NOMENCLATURA de una cuenta de Meta Ads. Te paso los nombres ACTUALES de los ${noun} (a veces con su campaña/conjunto padre). Hoy no siguen una convención clara y se ven desordenados.

Proponé un nombre NUEVO para cada uno que sea:
- CONSISTENTE entre todos (inferí UNA convención del conjunto y aplicala parejo).
- CORTO y escaneable, con separadores claros (ej. " · " o " | ").
- Fiel: conservá la info real que ya está en el nombre actual o en el padre (objetivo, audiencia, ángulo, versión, fecha…). NO inventes datos que no estén.
- Coherente con la jerarquía (si te paso la campaña/conjunto padre, alineá el estilo).
Si el usuario te da una convención abajo, RESPETALA. Si un nombre ya está bien, devolvelo igual.

Devolvé EXCLUSIVAMENTE un objeto JSON válido (sin markdown, sin texto extra):
{"propuestas":[{"id":"<id exacto>","nombre":"<nombre nuevo>"}]}
con UNA entrada por CADA id que te paso, usando los id TAL CUAL. Español rioplatense.`;

  const lista = entities.map((e, i) => {
    const padre = level === 'adset' && e.campana ? ` · campaña: ${e.campana}` : level === 'ad' ? ` · campaña: ${e.campana ?? '—'} · conjunto: ${e.adset ?? '—'}` : '';
    return `${i + 1}. id=${e.id} · nombre actual: "${e.name}"${padre}`;
  }).join('\n');
  const user = `Convención/pistas del usuario: ${body.instruccion?.trim() ? body.instruccion.trim() : '(ninguna — inferí la mejor)'}\n\n${noun.toUpperCase()} (${entities.length}):\n${lista}\n\nDevolvé el JSON con un nombre nuevo por cada id.`;

  try {
    const text = await chatClaude(system, [{ role: 'user', content: user }], { model: 'claude-opus-4-8', thinking: true, effort: 'medium', maxTokens: 14000 });
    const raw = parseJsonObject(text);
    const arr = Array.isArray(raw.propuestas) ? raw.propuestas : [];
    const valid = new Set(entities.map((e) => e.id));
    const propuestas = (arr as Array<{ id?: unknown; nombre?: unknown }>)
      .map((p) => ({ id: String(p.id ?? ''), nombre: String(p.nombre ?? '').trim() }))
      .filter((p) => valid.has(p.id) && p.nombre);
    return Response.json({ ok: true, propuestas });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ads-manager:rename-suggest] ${message}`);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
