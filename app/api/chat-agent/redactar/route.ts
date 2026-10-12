// =============================================================================
// API: el ✦ de MaKo que ayuda a escribir un WhatsApp del lienzo (sexta tanda del Chatbot, WhatsApp 3)
// =============================================================================
// POST { pedido, actual, disparador, objetivo, gancho, permiteAudio, datos, canal?, secuenciaId?, tarjeta? }
//   `datos`: 'motor' (al lead), 'recordatorio', o el contexto de la tarjeta (`ContextoDatos`, lib/variables-aviso.ts);
//   con destino 'equipo' es el aviso de «MaKo en WhatsApp» (undécima tanda): otro prompt, sin la voz del negocio.
//   → { ok: true, mensajes: string[], asunto: string | null, audio: string | null, nota: string | null, leido: string[], sinVoz: boolean, descartes: string[], chat? }
//   → { ok: false, error, link?, chat? }
//
// DECIMOTERCERA TANDA (12/10/2026, puntos 7 y 8): `canal` (WhatsApp, email, Instagram, Messenger) cambia lo que se le
// pide al modelo (lib/mako-redacta.ts). Y con `secuenciaId` y `tarjeta`, lo que se pidió y lo que propuso MaKo (o por
// qué no pudo) ENTRAN AL CHAT DE MaKo de esa automatización (`agregarAlChat`, el de ChatMako), con la tarjeta: Martín,
// «todo eso se debe quedar guardado como parte del historial del chat... se tiene que ver que el usuario apretó el botón
// en X tarjeta». Vuelven en `chat` para que el chat abierto los sume sin releer. Un chat que no se guarda nunca tumba
// la propuesta (queda en el log).
//
// El pedido, el prompt y el filtro viven en lib/mako-redacta.ts (con test); la pantalla, en
// app/automations/MakoRedacta.tsx. NO GUARDA NADA EN EL FLUJO: lo que MaKo escribe vuelve al editor como una
// propuesta, y la persona la usa o no (sólo «Publicar» publica). Lo único que escribe es el HISTORIAL del chat de MaKo.
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
import { hayVozGuiaEstricto } from '@/lib/nutricion-generator';
import { ejecutarOperacion } from '@/lib/api-mako/ejecutar';
import { canalKeyDe } from '@/lib/api-mako/canal';
import type { Ctx } from '@/lib/api-mako/tipos';
import { FEATURE_GUION_AUDIO } from '@/lib/guion-audio';
import {
  lecturasDeRedacta, esParaElEquipo, pedidoDeRedacta, redactaSystem, userDeRedacta, revisarRedacta, pedidoParaChat, textoDePropuestaParaChat,
  type LECTURAS_REDACTA, type PropuestaRedacta, type PedidoRedacta,
} from '@/lib/mako-redacta';
import { mensajeChat } from '@/lib/flujo-ia-preguntas';
import { agregarAlChat, secuenciaDelWorkspace } from '@/lib/automatizacion-chat-db';
import type { MensajeChatMako } from '@/lib/automatizacion-chat';

export const dynamic = 'force-dynamic';
/** La cascada gratis tarda de 3 a 30 s; con la red de plataforma, un poco más. El cliente corta a 95 s. */
export const maxDuration = 90;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
/** Lo que se le dice al cliente por cada intento fallido: no viaja el texto crudo de un proveedor. */
const MOTIVO = 'Escribir un WhatsApp del lienzo con el ✦ de MaKo';

/**
 * EL HISTORIAL (decimotercera tanda, punto 7): el pedido y lo que contestó MaKo, al chat de la automatización, con la
 * tarjeta. Sólo si la automatización es de ESTE workspace (`secuenciaDelWorkspace`) y viene la tarjeta. Es lo ÚNICO
 * que esta ruta escribe (el flujo no lo toca). Nunca tira: devuelve lo que guardó (para que el chat abierto lo sume) o
 * nada.
 */
async function anotarEnChat(ws: number, p: PedidoRedacta, respuesta: string): Promise<MensajeChatMako[] | undefined> {
  if (p.secuenciaId == null || !p.tarjeta) return undefined;
  try {
    if (!(await secuenciaDelWorkspace(ws, p.secuenciaId))) return undefined;
    const mensajes = [
      mensajeChat('yo', pedidoParaChat(p), 'app', { tarjeta: p.tarjeta }),
      mensajeChat('mako', respuesta, 'app', { tarjeta: p.tarjeta }),
    ];
    await agregarAlChat(ws, p.secuenciaId, mensajes);
    return mensajes;
  } catch (e) {
    console.error(`[redactar] el chat de #${p.secuenciaId}: ${msg(e)}`);
    return undefined;
  }
}

/** Lo que el registro devolvió, en texto, recortado a su tope. */
async function leer(ctx: Ctx, lecturas: typeof LECTURAS_REDACTA): Promise<{ leido: Array<{ rotulo: string; texto: string }> }> {
  const leido: Array<{ rotulo: string; texto: string }> = [];
  const rs = await Promise.all(lecturas.map(async (l) => {
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
  // ⚠️ ¿HAY GUÍA DE VOZ? ESTRICTO (revisión de la sexta tanda, 10/10/2026). Con `sinVoz: true` el panel
  // ofrece «Que la aprenda MaKo» y «Escribirla yo», y los dos terminan en `setVozGuia`, sin comparar con
  // lo que había. `getVozGuia` pasa por `getSetting`, que convierte un error de Supabase en null: un
  // negocio con su guía escrita a mano, ante una lectura caída, veía que no tenía voz y un clic se la
  // pisaba. «No pude leer» no es un valor (AGENTS.md): `hayVozGuiaEstricto` tira, el `.catch` lo vuelve
  // `null` y sólo un `false` medido ofrece configurar. Esta lectura sólo decide eso: la voz que llega al
  // prompt sale del registro (`guia_voz_negocio`, en LECTURAS_REDACTA).
  // ⚠️ EL AVISO AL EQUIPO (undécima tanda, «MaKo en WhatsApp») lo escribe MaKo, no el dueño: no lee la voz del
  // negocio (`lecturasDeRedacta`) ni ofrece configurarla (no se pregunta: `true`).
  const equipo = esParaElEquipo(p.datos);
  const [{ leido }, hayVoz] = await Promise.all([
    leer(ctx, lecturasDeRedacta(p.datos)),
    equipo ? Promise.resolve(true) : hayVozGuiaEstricto().catch(() => null),
  ]);
  const system = redactaSystem(p.datos, p.canal);
  const user = userDeRedacta(p, leido);
  // Lo que se le dio a leer: de acá pueden salir los links que un mensaje nombra.
  const permitido = [user].join('\n');

  let propuesta: PropuestaRedacta | null = null;
  const valida = (t: string): boolean => {
    try {
      const r = revisarRedacta(parseJsonObject(t), permitido, p.permiteAudio, p.datos, p.canal);
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
    const error = await errorDeCascada(errores, 'escribir el mensaje');
    const chat = await anotarEnChat(ws, p, error);
    return Response.json({ ok: false, error, ...(chat ? { chat } : {}) }, { status: 502 });
  }
  const listo = propuesta as PropuestaRedacta;
  const chat = await anotarEnChat(ws, p, textoDePropuestaParaChat(listo));
  return Response.json({
    ok: true, mensajes: listo.mensajes, asunto: listo.asunto, audio: listo.audio, nota: listo.nota, descartes: listo.descartes,
    leido: leido.map((l) => l.rotulo), sinVoz: hayVoz === false, ...(chat ? { chat } : {}),
  });
}
