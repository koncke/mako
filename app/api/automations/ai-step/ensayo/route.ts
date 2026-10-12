// =============================================================================
// POST /api/automations/ai-step/ensayo — el ENSAYO DE OBJECIONES de un AI Step (AI Step v2; uno por objetivo, undécima)
// =============================================================================
// El diseño, en docs/diseno-ai-step-v2.md §4, docs/diseno-undecima-tanda.md §6 y lib/ai-step-ensayo.ts. Tres acciones:
//
//   { action:'objeciones', ai:{objetivo, escenarios:[{titulo,cuando}]}, medio }
//        → { primer, objeciones }        UNA llamada barata: el primer mensaje y 4 objeciones del AI Step ENTERO
//   { action:'lead', ai, medio, ensayo:{primer,objeciones}, historial, audioBase64?, audioMime? }
//        → { mensaje|null, desenlace, transcripta, turno, maxTurnos }   MaKo hace de LEAD (el prompt de siempre)
//   { action:'mako', secuenciaId, pasos, medio, historial }
//        → { respuesta|null, escenario }  «Responde MaKo»: COMO EL MOTOR Y COMO «PROBAR»
//
// «Responde MaKo» clasifica el último mensaje del lead contra los escenarios del flujo EXPANDIDO (los pasos del lienzo,
// sin publicar: `casosDelClasificador` + `clasificarEscenario`, el MISMO clasificador del motor), y si no encaja va a
// «Lo demás» (`respuestaDelEnsayo`). Con lo elegido redacta `responderSimulador`, el redactor del motor. Un escenario
// que sólo avisa no contesta: `respuesta: null`. Es UNA llamada barata más por turno (el clasificador), sin Claude.
//
// No le manda NADA a ningún lead y no gasta Claude (`CASCADA_GRATIS`). No guarda nada: lo que la persona
// contestó lo guarda la pantalla como `ejemplos` del AI STEP (el nodo) por la edición del flujo (§10-F).
//
// ⚠️ EL TURNO SE CUENTA ACÁ (por mensajes del NEGOCIO), como en el ensayo del onboarding: un modelo chico no
// lleva la cuenta de qué objeción toca. Y el corte del último turno es del servidor.

import type { NextRequest } from 'next/server';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { chatCheapCascade, CASCADA_GRATIS, errorDeCascada } from '@/lib/ai-cheap';
import { renderPrompt } from '@/lib/prompt-render';
import { perfilNegocioTexto } from '@/lib/onboarding';
import { resumenFunnel } from '@/lib/mako-context';
import { getAvatares, avataresTexto } from '@/lib/avatares';
import { getVozGuia } from '@/lib/nutricion-generator';
import { parseJsonObject } from '@/lib/json-del-modelo';
import { bloqueEscenario, maxTurnosDe } from '@/lib/chat-agent-escenarios';
import { MEDIOS_AI_STEP, TOPE_NODOS, TOPE_ESCENARIOS_AI_STEP, normalizar, type MedioAIStep, type PasoGrafo } from '@/lib/flujo-grafo';
import {
  OBJECIONES_SYSTEM_TEMPLATE, escenarioDeAIStep, leerObjeciones, pedidoDeObjeciones, casosDelClasificador, respuestaDelEnsayo,
  type AIStepDelEnsayo,
} from '@/lib/ai-step-ensayo';
import { NOMBRE_MEDIO_PROMPT } from '@/lib/ai-step-armar';
import { SETTING_ENSAYO_SYSTEM_TEMPLATE } from '@/app/api/chat-agent/onboarding/ensayo/route';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const MARCA_FIN = /\[\s*FIN\s*:\s*(BIEN|MAL)\s*\]/i;
const SIN_RESPUESTA = /^[([]?\s*(sin (respuesta|contestar)|no (respuesta|contesta|responde|contesto)( nada)?|silencio)\s*[)\]]?\.?$/i;

type Turno = { de: 'lead' | 'negocio'; texto: string };

const str = (x: unknown, tope: number): string => (typeof x === 'string' ? x.trim().slice(0, tope) : '');

/** El AI Step del ensayo: su objetivo y sus escenarios (nombre y cuándo), saneados. */
function aiDe(x: unknown): AIStepDelEnsayo {
  const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  const escenarios = (Array.isArray(o.escenarios) ? o.escenarios : []).flatMap((e) => {
    const r = (e && typeof e === 'object' ? e : {}) as Record<string, unknown>;
    const titulo = str(r.titulo, 60);
    return titulo ? [{ titulo, cuando: str(r.cuando, 600) }] : [];
  }).slice(0, TOPE_ESCENARIOS_AI_STEP);
  return { objetivo: str(o.objetivo, 300), escenarios };
}

/** Los pasos del lienzo que manda el modal (como los de «Probar»). Un tope por las dudas: lo valida el flujo, no esto. */
function pasosDe(raw: unknown): PasoGrafo[] | null {
  if (!Array.isArray(raw) || raw.length > TOPE_NODOS * 2) return null;
  if (!raw.every((p) => p && typeof p === 'object' && !Array.isArray(p))) return null;
  return normalizar(raw as PasoGrafo[]);
}

function historialDe(x: unknown): Turno[] {
  if (!Array.isArray(x)) return [];
  return (x as Array<Record<string, unknown>>)
    .filter((t) => (t?.de === 'lead' || t?.de === 'negocio') && typeof t?.texto === 'string' && (t.texto as string).trim())
    .map((t) => ({ de: t.de as Turno['de'], texto: String(t.texto).slice(0, 1200) }))
    .slice(-30);
}

/** El bloque «TUS OBJECIONES» de la guía de voz (lib/chat-agent-voz.ts), si está. */
function objecionesDeGuia(guia: string | null): string {
  if (!guia) return '';
  const m = guia.match(/TUS OBJECIONES[:\s]*([\s\S]*?)(?=\n\s*(?:TU|TUS)\s+[A-ZÁÉÍÓÚÑ]{3,}|$)/);
  return m ? m[1].trim().slice(0, 1500) : '';
}

export async function POST(req: NextRequest) {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || rol !== 'admin') return Response.json({ ok: false, error: 'Solo el admin del workspace.' }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  const medio: MedioAIStep = (MEDIOS_AI_STEP as readonly unknown[]).includes(body.medio) ? (body.medio as MedioAIStep) : 'whatsapp';
  const ai = aiDe(body.ai);

  try {
    // ── Las objeciones y el primer mensaje del lead ──
    if (body.action === 'objeciones') {
      const [system, perfil, avatares, guia] = await Promise.all([
        renderPrompt('automations.ai_step.objeciones', OBJECIONES_SYSTEM_TEMPLATE, { medio: NOMBRE_MEDIO_PROMPT[medio] }),
        perfilNegocioTexto().catch(() => ''),
        getAvatares().catch(() => []),
        getVozGuia().catch(() => null),
      ]);
      const errores: string[] = [];
      const crudo = await chatCheapCascade({
        system,
        user: pedidoDeObjeciones({ ...ai, perfil, avatar: avataresTexto(avatares.slice(0, 2)), objecionesGuia: objecionesDeGuia(guia) }),
        json: true, maxTokens: 900, temperature: 0.6, feature: 'automations-ai-step-objeciones', motivo: 'AI Step: las objeciones del ensayo',
        provs: CASCADA_GRATIS, erroresOut: errores,
        validar: (t) => { try { return leerObjeciones(parseJsonObject(t)) != null; } catch { return false; } },
      });
      if (!crudo?.trim()) return Response.json({ ok: false, error: await errorDeCascada(errores, 'preparar el ensayo') }, { status: 502 });
      const ob = leerObjeciones(parseJsonObject(crudo));
      if (!ob) return Response.json({ ok: false, error: 'No salieron las objeciones. Vuelve a intentarlo.' }, { status: 502 });
      return Response.json({ ok: true, ...ob });
    }

    // ── «Responde MaKo»: como el motor y como «Probar» (clasificar → el escenario o «Lo demás» → redactar) ──
    if (body.action === 'mako') {
      const secuenciaId = Number(body.secuenciaId);
      if (!Number.isFinite(secuenciaId)) return Response.json({ ok: false, error: 'secuenciaId inválido' }, { status: 400 });
      const pasos = pasosDe(body.pasos);
      if (!pasos) return Response.json({ ok: false, error: 'flujo inválido' }, { status: 400 });
      const historial = historialDe(body.historial);
      if (!historial.length || historial[historial.length - 1].de !== 'lead') {
        return Response.json({ ok: false, error: 'El último mensaje tiene que ser del lead.' }, { status: 400 });
      }
      // El MISMO clasificador del motor, sobre los escenarios del lienzo (sin publicar).
      const { clasificarEscenario } = await import('@/lib/chat-agent-handoff');
      const { casos, escenarios } = casosDelClasificador(pasos, medio);
      const clas = await clasificarEscenario(historial[historial.length - 1].texto, escenarios);
      const i = clas.encaja ? escenarios.indexOf(clas.escenario) : -1;
      const elegido = respuestaDelEnsayo(pasos, medio, i >= 0 ? casos[i].casoId : null);
      // Sólo te avisa: MaKo no contesta (le avisaría al equipo).
      if (!elegido.escenario) return Response.json({ ok: true, respuesta: null, escenario: elegido.titulo });
      const { responderSimulador } = await import('@/lib/setting-simulador');
      const r = await responderSimulador(secuenciaId, historial, { tema: 'contestar en el ensayo', escenario: elegido.escenario });
      if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 502 });
      return Response.json({ ok: true, respuesta: r.respuesta, escenario: elegido.titulo });
    }

    if (body.action !== 'lead') return Response.json({ ok: false, error: 'Acción desconocida.' }, { status: 400 });

    // ── MaKo hace de LEAD ──
    const e = (body.ensayo && typeof body.ensayo === 'object' ? body.ensayo : {}) as Record<string, unknown>;
    const ob = leerObjeciones({ primer: e.primer, objeciones: e.objeciones });
    if (!ob) return Response.json({ ok: false, error: 'Falta preparar el ensayo.' }, { status: 400 });
    const esc = escenarioDeAIStep(ai, ob, medio);

    // Una NOTA DE VOZ del negocio (en WhatsApp se contesta con audio): se transcribe y es su último turno.
    let transcripta: string | null = null;
    if (typeof body.audioBase64 === 'string' && body.audioBase64) {
      try {
        const { transcribirAudio } = await import('@/lib/ai-cheap');
        transcripta = (await transcribirAudio(body.audioBase64, typeof body.audioMime === 'string' ? body.audioMime : 'audio/webm')).trim() || null;
      } catch { transcripta = null; }
      if (!transcripta) return Response.json({ ok: false, error: 'No se entendió el audio. Vuelve a grabarlo o escríbelo.' }, { status: 400 });
    }
    const turnos = historialDe(body.historial);
    if (transcripta) turnos.push({ de: 'negocio', texto: transcripta });

    // El turno del lead = cuántas veces le contestó el negocio (el primero, sin respuesta todavía, es el 0).
    const turno = turnos.filter((t) => t.de === 'negocio').length;
    const maxTurnos = maxTurnosDe(esc);
    const esUltimoTurno = turno >= maxTurnos - 1;
    if (turno > maxTurnos - 1) return Response.json({ ok: true, mensaje: null, sinRespuesta: true, transcripta, desenlace: 'abierto', turno, maxTurnos });

    const [perfil, funnel, avatares] = await Promise.all([
      perfilNegocioTexto().catch(() => ''),
      resumenFunnel().catch(() => ''),
      getAvatares().catch(() => []),
    ]);
    const system = await renderPrompt('setting.ensayo', SETTING_ENSAYO_SYSTEM_TEMPLATE, {
      perfil: perfil || '(sin perfil cargado — improvisa un negocio plausible, pero no lo menciones)',
      funnel: funnel || '(sin funnel configurado)',
      escenario: bloqueEscenario(esc, turno, avataresTexto(avatares.slice(0, 3))),
    });
    const lineas = turnos.map((t) => `${t.de === 'negocio' ? 'NEGOCIO' : 'TÚ (el lead)'}: ${t.texto}`);
    if (!turnos.length) lineas.push('(Todavía no hay ningún mensaje: escribes tú primero.)');
    const pedido = esUltimoTurno
      ? [
        'Escribe tu ÚLTIMO mensaje. Eres el LEAD, nunca el negocio. Cierra la conversación.',
        'OBLIGATORIO: la última línea de tu respuesta es exactamente [FIN:BIEN] o exactamente [FIN:MAL].',
        `[FIN:BIEN] = ${esc.desenlace.positivo}.`,
        `[FIN:MAL] = ${esc.desenlace.negativo}.`,
      ].join('\n')
      : 'Escribe tu próximo mensaje. Eres el LEAD, nunca el negocio: no ofrezcas nada ni intentes vender. Solo el texto, nada más.';
    const errores: string[] = [];
    const bruto = await chatCheapCascade({
      system, user: `${lineas.join('\n')}\n\n${pedido}`,
      maxTokens: 700, temperature: 0.85, feature: 'automations-ai-step-ensayo', motivo: 'AI Step: MaKo hace de lead en el ensayo',
      provs: CASCADA_GRATIS, erroresOut: errores,
    });
    if (!bruto?.trim()) return Response.json({ ok: false, error: await errorDeCascada(errores, 'seguir el ensayo') }, { status: 502 });
    const marca = bruto.match(MARCA_FIN);
    let desenlace: 'positivo' | 'negativo' | 'abierto' | null = marca && esUltimoTurno ? (marca[1].toUpperCase() === 'BIEN' ? 'positivo' : 'negativo') : null;
    const mensaje = bruto.replace(MARCA_FIN, '').trim();
    const calla = !mensaje || SIN_RESPUESTA.test(mensaje);
    if (!desenlace && esUltimoTurno) desenlace = calla ? 'negativo' : 'abierto';
    return Response.json({ ok: true, mensaje: calla ? null : mensaje, sinRespuesta: calla, transcripta, desenlace, turno, maxTurnos });
  } catch (err) {
    console.error(`[api:automations/ai-step/ensayo] ${msg(err)}`);
    return Response.json({ ok: false, error: msg(err) }, { status: 500 });
  }
}
