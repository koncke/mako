// =============================================================================
// API: ensayo del onboarding de Setting — MaKo hace de CLIENTE
// =============================================================================
// Es la etapa ③ de la metodología: el usuario no escribe su secuencia, la
// DESCUBRE respondiendo. MaKo se pone en el papel de un lead real del negocio
// (derivado de su funnel, su avatar y su criterio) y plantea los escenarios que
// más duelen; el dueño contesta como contestaría de verdad.
//
// OJO: es el INVERSO de lib/setting-simulador.ts (allá MaKo es el setter y el
// usuario el lead). Acá el mapeo es al revés: negocio=user, lead=assistant.
//
// POST { historial: [{de:'lead'|'negocio', texto}] } → { mensaje }
// Sandbox: no envía ni persiste nada.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { chatClaude } from '@/lib/anthropic';
import { getPromptText, renderPrompt } from '@/lib/prompt-render';
import { perfilNegocioTexto } from '@/lib/onboarding';
import { resumenFunnel } from '@/lib/mako-context';
import { MAKO_NUCLEO } from '@/lib/mako-prompts';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const SETTING_ENSAYO_SYSTEM_TEMPLATE = `Sos un LEAD REAL de este negocio escribiéndole por WhatsApp. NO sos un asistente: sos la persona que dejó sus datos y ahora está del otro lado del chat.

EL NEGOCIO AL QUE LE ESCRIBÍS:
{{perfil}}

SU PROCESO COMERCIAL:
{{funnel}}

CÓMO ACTUÁS:
- Escribís como escribe la gente por WhatsApp: corto, informal, a veces sin tildes, a veces con una sola línea.
- Arrancás con UNA situación concreta y realista (elegí una distinta cada vez): vi el video y no agendé · pregunto el precio de una · digo que ahora no tengo tiempo · no termino de entender qué vende · pido el material gratis · soy alguien que claramente NO es su cliente ideal.
- Reaccionás con naturalidad a lo que te contesta el dueño: si te convence, aflojás; si te responde algo genérico o te presiona, te enfriás o dudás; si te pide algo razonable, lo hacés.
- Ponés objeciones REALES, no de manual. Nunca decís "como IA" ni rompés el personaje.
- Un mensaje por turno, 1 a 3 líneas. Nada de párrafos largos.
- Si el dueño ya resolvió tu situación, cerrás esa línea y en el mensaje siguiente arrancás OTRO escenario distinto, como si fueras otro lead ("Hola, otra consulta…" no: simplemente escribís como un lead nuevo con otro problema).

Devolvé SOLO el texto del mensaje del lead, sin comillas ni aclaraciones.`;

export async function POST(req: NextRequest) {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || rol !== 'admin') {
    return Response.json({ ok: false, error: 'Solo el admin del workspace puede hacer el ensayo.' }, { status: 403 });
  }
  let body: { historial?: unknown };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  const historial = Array.isArray(body.historial)
    ? (body.historial as Array<Record<string, unknown>>)
        .filter((t) => (t?.de === 'lead' || t?.de === 'negocio') && typeof t?.texto === 'string' && (t.texto as string).trim())
        .map((t) => ({ de: t.de as 'lead' | 'negocio', texto: String(t.texto).slice(0, 1200) }))
    : [];

  try {
    const [perfil, funnel, nucleo] = await Promise.all([
      perfilNegocioTexto().catch(() => ''),
      resumenFunnel().catch(() => ''),
      getPromptText('mako.nucleo', MAKO_NUCLEO),
    ]);
    const system = `${nucleo}\n\n${await renderPrompt('setting.ensayo', SETTING_ENSAYO_SYSTEM_TEMPLATE, {
      perfil: perfil || '(sin perfil cargado — inventá un lead genérico pero plausible)',
      funnel: funnel || '(sin funnel configurado)',
    })}`;

    // MAPEO INVERTIDO respecto del simulador: acá el que "habla" es el LEAD, así
    // que sus turnos son del assistant y los del negocio, del user.
    const turnos = historial.slice(-24).map((t) => ({
      role: t.de === 'negocio' ? ('user' as const) : ('assistant' as const),
      content: t.texto,
    }));
    if (!turnos.length) turnos.push({ role: 'user', content: '(el dueño abre el ensayo: escribile vos primero, como el lead que sos)' });

    const mensaje = await chatClaude(system, turnos, { effort: 'medium', maxTokens: 400, feature: 'setting-ensayo' });
    if (!mensaje?.trim()) return Response.json({ ok: false, error: 'No salió el mensaje del lead. Probá de nuevo.' }, { status: 400 });
    return Response.json({ ok: true, mensaje: mensaje.trim() });
  } catch (e) {
    console.error(`[api:setting/onboarding/ensayo] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
