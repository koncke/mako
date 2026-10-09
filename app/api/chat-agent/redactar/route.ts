// =============================================================================
// API: el ✦ de MaKo que ayuda a escribir un WhatsApp del lienzo (sexta tanda del Chatbot, WhatsApp 3)
// =============================================================================
// POST { pedido, actual, disparador, objetivo, gancho, permiteAudio }
//   → { ok: true, mensajes: string[], audio: string | null, nota: string | null, leido: string[], sinVoz: boolean, descartes: string[] }
//   → { ok: false, error, link? }
//
// El pedido, el prompt y el filtro viven en lib/mako-redacta.ts (con test); la pantalla, en
// app/chatbot/MakoRedacta.tsx. NO GUARDA NADA: lo que MaKo escribe vuelve al editor como una
// propuesta, y la persona la usa o no (sólo «Publicar» publica).
//
// ⚠️ EL CONTEXTO SE LEE POR EL REGISTRO DE LA API DE MaKo (`ejecutarOperacion`, AGENTS.md «Una capacidad
//    nueva de MaKo se DECLARA en el registro»): el negocio, los productos, el embudo, el curso y la voz
//    son las MISMAS lecturas que usa MaKo por WhatsApp y por /api/v1, con su gating. Una que esta vista no
//    puede pedir contesta 404 y se saltea (hoy `listar_cursos`, que sólo sale por HTTP): no se escribe
//    una segunda lectura a mano.
// ⚠️ NUNCA POR CLAUDE NI POR NADA QUE COBRE (AGENTS.md, «Claude está VETADO»): la cascada gratis con las
//    keys del cliente (`CASCADA_DOCS`, que tiene Gemini: hay clientes que sólo cargaron esa) y, si
//    ninguna contestó, la RED DE PLATAFORMA (gemini y groq de la agencia, `provsGratisDePlataforma`), con
//    el motivo «⚠ red de plataforma» para que se vea en el Saldo de IA. Los errores de la red no eligen
//    el texto que lee el cliente.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getRolWsEfectivo, getWorkspaceActual, wsSuperAdmin } from '@/lib/workspace';
import { chatCheapCascade, chatCheapTools, provsGratisDePlataforma, CASCADA_DOCS, MODELO_DOCS, errorDeCascada, type ProvName } from '@/lib/ai-cheap';
import { overrideDeFeature } from '@/lib/model-registry';
import { parseJsonObject } from '@/lib/json-del-modelo';
import { getVozGuia } from '@/lib/nutricion-generator';
import { ejecutarOperacion } from '@/lib/api-mako/ejecutar';
import { canalKeyDe } from '@/lib/api-mako/canal';
import type { Ctx } from '@/lib/api-mako/tipos';
import { FEATURE_GUION_AUDIO } from '@/lib/guion-audio';
import { LECTURAS_REDACTA, pedidoDeRedacta, redactaSystem, userDeRedacta, revisarRedacta, type PropuestaRedacta } from '@/lib/mako-redacta';

export const dynamic = 'force-dynamic';
/** La cascada gratis tarda de 3 a 30 s; con la red de plataforma, un poco más. El cliente corta a 95 s. */
export const maxDuration = 90;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
/** Lo que se le dice al cliente por cada intento fallido: no viaja el texto crudo de un proveedor. */
const MOTIVO = 'Escribir un WhatsApp del lienzo con el ✦ de MaKo';

/** Lo que el registro devolvió, en texto, recortado a su tope. */
async function leer(ctx: Ctx): Promise<{ leido: Array<{ rotulo: string; texto: string }> }> {
  const leido: Array<{ rotulo: string; texto: string }> = [];
  const rs = await Promise.all(LECTURAS_REDACTA.map(async (l) => {
    try {
      const r = await ejecutarOperacion(l.id, l.input ?? {}, ctx, 'json');
      return r.ok && r.tipo === 'lectura' && r.resultado.trim() ? { rotulo: l.rotulo, texto: r.resultado.trim().slice(0, l.tope) } : null;
    } catch (e) {
      console.warn(`[redactar] no pude leer ${l.id}: ${msg(e)}`);
      return null;
    }
  }));
  for (const r of rs) if (r) leido.push(r);
  return { leido };
}

export async function POST(req: NextRequest) {
  if ((await getRolWsEfectivo()) !== 'admin') {
    return Response.json({ ok: false, error: 'Sólo el admin del negocio puede usar a MaKo para escribir.' }, { status: 403 });
  }
  const ws = await getWorkspaceActual();
  if (ws == null) return Response.json({ ok: false, error: 'Entra al negocio para usar a MaKo.' }, { status: 400 });
  let body: unknown;
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'Pedido inválido.' }, { status: 400 }); }
  const p = pedidoDeRedacta(body);
  if (!p) return Response.json({ ok: false, error: 'Cuéntale a MaKo qué quieres lograr.' }, { status: 400 });

  const ctx: Ctx = { ws, canal: 'app', canalKey: canalKeyDe('app', `ws${ws}`), alcance: 'lectura', rol: 'admin' };
  const [{ leido }, voz] = await Promise.all([leer(ctx), getVozGuia().catch(() => null)]);
  const system = redactaSystem();
  const user = userDeRedacta(p, leido);
  // Lo que se le dio a leer: de acá pueden salir los links que un mensaje nombra.
  const permitido = [user].join('\n');

  let propuesta: PropuestaRedacta | null = null;
  const valida = (t: string): boolean => {
    try {
      const r = revisarRedacta(parseJsonObject(t), permitido, p.permiteAudio);
      if (!r.mensajes.length && !r.audio) return false;
      propuesta = r;
      return true;
    } catch { return false; }
  };

  // 1) Las keys del CLIENTE (con el pin de /modelos-ia si es gratis).
  const pin = await overrideDeFeature(FEATURE_GUION_AUDIO).catch(() => null);
  const usaPin = pin != null && pin.provider !== 'anthropic' && pin.provider !== 'openai';
  const errores: string[] = [];
  try {
    await chatCheapCascade({
      system, user, json: true, maxTokens: 1_200, temperature: 0.7,
      feature: FEATURE_GUION_AUDIO, motivo: MOTIVO,
      provs: usaPin ? [pin!.provider as ProvName, ...CASCADA_DOCS.filter((x) => x !== pin!.provider)] : CASCADA_DOCS,
      modelos: usaPin ? ({ ...MODELO_DOCS, [pin!.provider]: pin!.model } as Partial<Record<ProvName, string>>) : MODELO_DOCS,
      validar: valida, erroresOut: errores, timeoutMs: 40_000,
    });
  } catch (e) { errores.push(msg(e)); }

  // 2) La RED DE PLATAFORMA: sólo si ninguna key del cliente contestó algo que sirva.
  if (!propuesta) {
    const superWs = await wsSuperAdmin().catch(() => null);
    const red = superWs != null ? await provsGratisDePlataforma().catch(() => []) : [];
    for (const r of red) {
      if (propuesta) break;
      try {
        const out = await chatCheapTools(system, [{ role: 'user', content: user }], [], async () => '', {
          provider: r.provider, clave: r.clave, wsKey: superWs!, maxTokens: 1_200, timeoutMs: 40_000,
          feature: FEATURE_GUION_AUDIO, motivo: `⚠ red de plataforma (${r.provider}) — las keys del negocio no contestaron · ${MOTIVO}`,
        });
        valida(out.text);
      } catch (e) { console.warn(`[redactar] red de plataforma ${r.provider}: ${msg(e)}`); }
    }
  }

  if (!propuesta) {
    return Response.json({ ok: false, error: await errorDeCascada(errores, 'escribir el mensaje') }, { status: 502 });
  }
  const listo = propuesta as PropuestaRedacta;
  return Response.json({
    ok: true, mensajes: listo.mensajes, audio: listo.audio, nota: listo.nota, descartes: listo.descartes,
    leido: leido.map((l) => l.rotulo), sinVoz: !(voz ?? '').trim(),
  });
}
