// =============================================================================
// POST /api/ads-manager/rename-suggest — MaKo COMPLETA las variables de la plantilla
// =============================================================================
// El usuario define una plantilla (ej. "{nnn}. {objetivo} / {angulo} - {mes} / {anio}").
// El cliente manda las variables SEMÁNTICAS a llenar (sin el correlativo ni {nombre})
// y la lista de entidades. MaKo NO arma el nombre final: solo EXTRAE el valor de cada
// variable mirando el nombre actual + jerarquía + fecha. El cliente arma el nombre con
// la plantilla (formato exacto garantizado). Body: { level, notas?, vars: string[],
// entities: [{ id, name, campana?, adset?, anio?, mes? }] }. → { ok, valores: [{ id, vars }] }.
// =============================================================================

import type { NextRequest } from 'next/server';
import { chatClaude } from '@/lib/anthropic';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type Ent = { id: string; name: string; campana?: string | null; adset?: string | null; anio?: string | null; mes?: string | null };
const NOUN: Record<string, string> = { campaign: 'campañas', adset: 'conjuntos de anuncios', ad: 'anuncios' };
const VAR_DESC: Record<string, string> = {
  objetivo: 'objetivo del aviso en 1-2 palabras Title Case (ej. Leads, Ventas, Webinar, Registro, Retargeting, Tráfico). Inferilo del nombre/jerarquía.',
  angulo: 'ángulo o tema del mensaje, corto (ej. Dolor, Autoridad, Caso de éxito, Demo, Oferta). Inferilo del nombre.',
  audiencia: 'público objetivo, corto (ej. Dueños de clínica, Frío, Retargeting, Lookalike). Si no se deduce, dejá "".',
  mes: 'mes en español Title Case (Enero…Diciembre). Si el nombre menciona un mes/fecha, usá ESE; si no, usá el mes de creación que te paso.',
  anio: 'año con 4 dígitos. Si el nombre menciona un año, usá ESE; si no, usá el año de creación que te paso.',
};

function parseJsonObject(text: string): Record<string, unknown> {
  const c = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const a = c.indexOf('{'), b = c.lastIndexOf('}');
  if (a === -1 || b <= a) throw new Error('respuesta sin JSON');
  return JSON.parse(c.slice(a, b + 1));
}

export async function POST(req: NextRequest) {
  let body: { level?: string; notas?: string; vars?: string[]; entities?: Ent[] };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  const level = body.level === 'campaign' || body.level === 'adset' || body.level === 'ad' ? body.level : null;
  const vars = Array.isArray(body.vars) ? [...new Set(body.vars.map(String))].filter(Boolean).slice(0, 12) : [];
  const entities = Array.isArray(body.entities) ? body.entities.filter((e) => e && typeof e.id === 'string' && typeof e.name === 'string') : [];
  if (!level) return Response.json({ ok: false, error: 'level inválido' }, { status: 400 });
  if (!vars.length) return Response.json({ ok: false, error: 'sin variables a completar' }, { status: 400 });
  if (!entities.length) return Response.json({ ok: false, error: 'sin entidades' }, { status: 400 });

  const noun = NOUN[level];
  const varSpec = vars.map((v) => `  - "${v}": ${VAR_DESC[v] ?? `valor de "${v}", corto, inferido del nombre.`}`).join('\n');
  const system = `Sos MaKo, el copiloto de marketing de Mauricio Bustos. Te paso los ${noun} de una cuenta de Meta Ads con nombres DESORDENADOS. NO armes el nombre final: tu única tarea es EXTRAER/INFERIR, para cada uno, el valor de estas variables (cortas, fieles a lo que dice el nombre; no inventes datos que no estén):
${varSpec}

Reglas:
- Devolvé un valor por CADA variable pedida y por CADA id, usando los id TAL CUAL.
- Procesá TODAS las entidades que te paso. NO filtres, NO omitas, NO dejes valores en blanco "para descartar": qué renombrar ya lo decidió el usuario por fecha, no es tu tarea.
- "objetivo" y "angulo" SIEMPRE deben tener un valor inferido (todo aviso tiene un objetivo y un ángulo). Devolvé "" solo si de verdad es imposible deducirlo.
- Valores CORTOS y consistentes entre todos (mismo estilo).
${body.notas?.trim() ? `- Estilo/preferencias del usuario para CÓMO nombrar (no es un filtro): ${body.notas.trim()}` : ''}

Devolvé EXCLUSIVAMENTE un objeto JSON válido (sin markdown):
{"valores":[{"id":"<id>","vars":{${vars.map((v) => `"${v}":"…"`).join(',')}}}]}`;

  const lista = entities.map((e, i) => {
    const padre = level === 'adset' && e.campana ? ` · campaña: ${e.campana}` : level === 'ad' ? ` · campaña: ${e.campana ?? '—'} · conjunto: ${e.adset ?? '—'}` : '';
    const fecha = e.anio || e.mes ? ` · creado: ${e.mes ?? ''} ${e.anio ?? ''}`.trimEnd() : '';
    return `${i + 1}. id=${e.id} · "${e.name}"${padre}${fecha}`;
  }).join('\n');
  const user = `${noun.toUpperCase()} (${entities.length}):\n${lista}\n\nDevolvé el JSON con las variables completadas por cada id.`;

  try {
    let uso: { tokens: number; costUsd: number } | null = null;
    const text = await chatClaude(system, [{ role: 'user', content: user }], {
      model: 'claude-opus-4-8', thinking: true, effort: 'medium', maxTokens: 16000,
      feature: 'ads-rename',
      onUsage: (u) => { uso = { tokens: u.inputTokens + u.outputTokens, costUsd: u.costUsd }; },
    });
    const raw = parseJsonObject(text);
    const arr = Array.isArray(raw.valores) ? raw.valores : [];
    const valid = new Set(entities.map((e) => e.id));
    const valores = (arr as Array<{ id?: unknown; vars?: unknown }>)
      .map((p) => {
        const id = String(p.id ?? '');
        const v = (p.vars && typeof p.vars === 'object' ? p.vars : {}) as Record<string, unknown>;
        const out: Record<string, string> = {};
        for (const k of vars) out[k] = String(v[k] ?? '').trim();
        return { id, vars: out };
      })
      .filter((p) => valid.has(p.id));
    return Response.json({ ok: true, valores, uso });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ads-manager:rename-suggest] ${message}`);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
