// =============================================================================
// API: generar copy de email con MaKo (Claude)
// =============================================================================
// POST { instruccion, etapa?, modo? ('paso'|'broadcast'), asuntoActual?, cuerpoActual? }
//   → { ok, asunto, preheader, cuerpo, uso }
// MaKo escribe el asunto + preheader + cuerpo para EL NEGOCIO DEL WORKSPACE.
//
// ⚠️ Esto escribía literalmente "para Mauricio Bustos (Negocio que Escala™)" y
// mandaba a usar SU link de Calendly — hardcodeado, para todos los workspaces.
// Cualquier cliente que tocara "generar email" recibía copy del negocio de otro,
// en voseo aunque su audiencia fuera mexicana. El molde correcto vivía al lado
// (lib/nutricion-generator.ts): perfil + voz destilada + funnel REAL del cliente.
// Ver docs/hallazgos-comunicacion.md → "El generador de emails escribe para el
// negocio de Mauricio".
// =============================================================================

import type { NextRequest } from 'next/server';
import { chatClaude } from '@/lib/anthropic';
import { brandSystem, parseJsonObject } from '@/lib/campaign-structurer';
import { renderPrompt } from '@/lib/prompt-render';
import { perfilNegocioTexto } from '@/lib/onboarding';
import { getVozGuia } from '@/lib/nutricion-generator';
import { resumenFunnel } from '@/lib/mako-context';

export const dynamic = 'force-dynamic';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export const EMAIL_GEN_SYSTEM_TEMPLATE = `Eres MaKo escribiendo EMAIL MARKETING para el negocio que se describe abajo. No eres el negocio: escribes POR él, en su voz.

PERFIL DEL NEGOCIO:
{{perfil}}

VOZ DE LA MARCA:
{{voz}}
{{funnel}}
Reglas del email:
- Asunto corto (máx ~6 palabras), concreto, que dé ganas de abrir. Sin clickbait barato, sin MAYÚSCULAS gritonas, sin emojis salvo que aporten.
- Preheader (texto de vista previa): 1 línea que complementa el asunto, no lo repite.
- Cuerpo en texto plano, 2 a 5 párrafos cortos, con saltos de línea. Un solo CTA claro.
- Variables disponibles: {nombre} (primer nombre del lead), {empresa}, {nombre_completo}, {apellido}. Úsalas con naturalidad, sin abusar.
- Nada de promesas falsas ni lenguaje spam ("gratis!!!", "urgente", "gana dinero").

PROHIBIDO INVENTAR:
- El idioma y el trato (vos / tú / usted) salen de la VOZ DE LA MARCA y del perfil, NUNCA por default.
- No inventes links. Si el email necesita un link de agenda o de pago y no aparece en el contexto, escribe el marcador [LINK DE AGENDA] y sigue: que lo ponga una persona.
- No inventes cifras, testimonios, nombres de clientes, plazos ni garantías que no estén en el perfil.

Devuelve SOLO un JSON: {"asunto": "...", "preheader": "...", "cuerpo": "..."} — sin texto fuera del JSON.`;

export async function POST(req: NextRequest) {
  let body: { instruccion?: string; etapa?: string; modo?: string; asuntoActual?: string; cuerpoActual?: string };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  const instruccion = str(body.instruccion);
  if (!instruccion) return Response.json({ ok: false, error: 'Dime qué quieres que escriba' }, { status: 400 });

  const ctx = [
    body.etapa ? `Etapa del funnel: ${body.etapa}.` : '',
    body.modo === 'broadcast' ? 'Es un BROADCAST (envío puntual a un segmento).' : 'Es un PASO de una secuencia automática.',
    str(body.asuntoActual) ? `Asunto actual (a mejorar): ${str(body.asuntoActual)}` : '',
    str(body.cuerpoActual) ? `Cuerpo actual (a mejorar):\n${str(body.cuerpoActual)}` : '',
  ].filter(Boolean).join('\n');

  const user = `${instruccion}${ctx ? `\n\n---\nContexto:\n${ctx}` : ''}`;

  try {
    let uso: { tokens: number; costUsd: number } | null = null;
    const [perfil, voz, funnel] = await Promise.all([
      perfilNegocioTexto().catch(() => ''),
      getVozGuia().catch(() => null),
      resumenFunnel().catch(() => ''),
    ]);
    // Sin perfil no se escribe: un email sin negocio atrás sale genérico o, peor,
    // el modelo lo rellena solo. Se avisa en vez de mandar cualquier cosa.
    if (!perfil.trim()) {
      return Response.json({
        ok: false,
        error: 'Todavía no hay perfil del negocio cargado: completa el brief (o sube tus documentos a El Archivero) y MaKo va a poder escribir con tu oferta y tu voz.',
      }, { status: 422 });
    }
    const base = await renderPrompt('email.generar.system', EMAIL_GEN_SYSTEM_TEMPLATE, {
      perfil,
      voz: voz?.trim() || '(todavía no hay guía de voz destilada: escribe con el perfil del negocio y buen criterio, sin sonar genérico. No asumas un dialecto: sigue el que use el perfil.)',
      funnel: funnel.trim() ? `\nFUNNEL REAL DEL NEGOCIO (así se mueve un lead aquí — escribe coherente con estas etapas):\n${funnel}\n` : '',
    });
    const system = await brandSystem(base);
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
