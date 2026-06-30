// =============================================================================
// API: generar copy de email con MaKo (Claude)
// =============================================================================
// POST { instruccion, etapa?, modo? ('paso'|'broadcast'), asuntoActual?, cuerpoActual? }
//   → { ok, asunto, preheader, cuerpo, uso }
// MaKo escribe el asunto + preheader + cuerpo en la voz de Mauricio Bustos.
// =============================================================================

import type { NextRequest } from 'next/server';
import { chatClaude } from '@/lib/anthropic';
import { brandSystem, parseJsonObject } from '@/lib/campaign-structurer';

export const dynamic = 'force-dynamic';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

const SYSTEM = `Sos MaKo escribiendo EMAIL MARKETING para Mauricio Bustos (consultor: "Negocio que Escala™", ayuda a dueños de empresa a crecer sin depender de sí mismos en todo). Escribís en español rioplatense, voseo, cálido y directo, de igual a igual.

Reglas del email:
- Asunto corto (máx ~6 palabras), concreto, que de ganas de abrir. Sin clickbait barato, sin MAYÚSCULAS gritonas, sin emojis salvo que aporten.
- Preheader (texto de vista previa): 1 línea que complementa el asunto, no lo repite.
- Cuerpo en texto plano, 2 a 5 párrafos cortos, con saltos de línea. Un solo CTA claro. Si corresponde un link de agenda, usá https://calendly.com/mauriciobustoseguia/60min.
- Variable disponible: {nombre} (primer nombre del lead). Usala con naturalidad, sin abusar. También existen {empresa}, {nombre_completo}, {apellido}.
- Nada de promesas falsas ni lenguaje spam ("gratis!!!", "urgente", "ganá dinero").

Devolvé SOLO un JSON: {"asunto": "...", "preheader": "...", "cuerpo": "..."} — sin texto fuera del JSON.`;

export async function POST(req: NextRequest) {
  let body: { instruccion?: string; etapa?: string; modo?: string; asuntoActual?: string; cuerpoActual?: string };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  const instruccion = str(body.instruccion);
  if (!instruccion) return Response.json({ ok: false, error: 'Decime qué querés que escriba' }, { status: 400 });

  const ctx = [
    body.etapa ? `Etapa del funnel: ${body.etapa}.` : '',
    body.modo === 'broadcast' ? 'Es un BROADCAST (envío puntual a un segmento).' : 'Es un PASO de una secuencia automática.',
    str(body.asuntoActual) ? `Asunto actual (a mejorar): ${str(body.asuntoActual)}` : '',
    str(body.cuerpoActual) ? `Cuerpo actual (a mejorar):\n${str(body.cuerpoActual)}` : '',
  ].filter(Boolean).join('\n');

  const user = `${instruccion}${ctx ? `\n\n---\nContexto:\n${ctx}` : ''}`;

  try {
    let uso: { tokens: number; costUsd: number } | null = null;
    const system = await brandSystem(SYSTEM);
    const text = await chatClaude(system, [{ role: 'user', content: user }], {
      thinking: true,
      effort: 'medium',
      maxTokens: 4000,
      feature: 'email-generar',
      onUsage: (u) => { uso = { tokens: u.inputTokens + u.outputTokens, costUsd: u.costUsd }; },
    });
    const json = parseJsonObject(text);
    return Response.json({
      ok: true,
      asunto: str(json.asunto),
      preheader: str(json.preheader),
      cuerpo: str(json.cuerpo),
      uso,
    });
  } catch (e) {
    console.error(`[api:email/generar] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
