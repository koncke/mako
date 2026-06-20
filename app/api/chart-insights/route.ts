// =============================================================================
// /api/chart-insights — chat de conclusiones con Claude por gráfico
// =============================================================================
// GET  ?chartKey=...            → historial del hilo.
// POST { chartKey, titulo, contexto, mensaje? }
//   - sin mensaje: si no hay historial, Claude genera el PRIMER análisis (queda
//     como primer mensaje del assistant). Si ya hay historial, lo devuelve.
//   - con mensaje: lo agrega como user, Claude responde, persiste y devuelve todo.
// El primer mensaje del hilo SIEMPRE es del assistant (análisis automático).

import type { NextRequest } from 'next/server';
import { chatClaude, type ClaudeMsg } from '@/lib/anthropic';
import { getChartHistory, appendChartMsg, type ChartMsg } from '@/lib/chart-chats';
import { MAKO_PERSONA } from '@/lib/mako-persona';

export const dynamic = 'force-dynamic';

// Primer mensaje: breve e impactante, NO un resumen completo.
const ANALISIS_PROMPT = 'Mirá el gráfico y tirame SOLO lo más importante: el insight que más impacta, en 2-4 líneas, con tu voz. Nada de resumen completo ni listar todo — si quiero más, te pregunto.';

function systemPrompt(titulo: string, contexto: string): string {
  return `${MAKO_PERSONA}

CONTEXTO: estás mirando el gráfico "${titulo}" del dashboard del PROPIO negocio de Martín (no es un cliente). Ya tenés los datos abajo, así que NO pidas información que está en el gráfico — analizá directo.

DATOS DEL GRÁFICO:
${contexto}

FORMATO Y TONO:
- Respondé en Markdown: usá **negritas** para lo clave, viñetas y títulos cortos (##) SOLO cuando de verdad ayuden a leer. Nada de muros de texto.
- El PRIMER mensaje tiene que ser breve e impactante (2-4 líneas): lo más importante, no un resumen de todo. Si querés, cerrás con UNA pregunta o invitación a profundizar.
- Después, respondé lo que te pregunten con tu personalidad: directo, concreto, con números del gráfico, accionable.
- No inventes datos que no estén en el contexto; si algo no se puede concluir, decilo claro.`;
}

export async function GET(req: NextRequest) {
  const chartKey = req.nextUrl.searchParams.get('chartKey');
  if (!chartKey) return Response.json({ error: 'chartKey requerido' }, { status: 400 });
  try {
    const messages = await getChartHistory(chartKey);
    return Response.json({ messages });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { chartKey?: string; titulo?: string; contexto?: string; mensaje?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const { chartKey, titulo = 'gráfico', contexto = '', mensaje } = body;
  if (!chartKey) return Response.json({ error: 'chartKey requerido' }, { status: 400 });

  try {
    const history = await getChartHistory(chartKey);

    // Sin mensaje y ya hay hilo → devolver el historial tal cual (no re-analizar).
    if (!mensaje && history.length > 0) {
      return Response.json({ messages: history });
    }

    // Mensajes para Claude: prompt inicial (oculto) + historial + el nuevo mensaje.
    // El historial guardado arranca con el assistant (análisis); el prompt inicial
    // de user adelante mantiene la alternancia user/assistant que pide la API.
    const claudeMsgs: ClaudeMsg[] = [
      { role: 'user', content: ANALISIS_PROMPT },
      ...history.map((m) => ({ role: m.role, content: m.content })),
    ];
    if (mensaje) {
      claudeMsgs.push({ role: 'user', content: mensaje });
      await appendChartMsg(chartKey, 'user', mensaje);
    }

    const respuesta = await chatClaude(systemPrompt(titulo, contexto), claudeMsgs, { maxTokens: 1024 });
    await appendChartMsg(chartKey, 'assistant', respuesta);

    const messages: ChartMsg[] = await getChartHistory(chartKey);
    return Response.json({ messages });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
