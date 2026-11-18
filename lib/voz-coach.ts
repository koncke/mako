// =============================================================================
// voz-coach — el audio de un mensaje de un coach (Offer Coach, Funnel Coach), con la voz de la plataforma
// =============================================================================
// Las reglas (qué voz, qué texto, cuánto por mes) viven en lib/voz-coach-reglas.ts, puras y con test.
//
// EL ORDEN, Y POR QUÉ:
//   1. el texto se normaliza (`textoParaVozCoach`): sin markdown, links ni emojis, con tope; si no queda nada, no hay audio;
//   2. la key de la PLATAFORMA (`keyDeMaKo`, la de la Voz de MaKo): sin ella, nada (el botón ni se muestra);
//   3. una pregunta FIJA del coach se busca guardada (`rutaDeLaFija`): el mismo texto ya dicho se devuelve sin pagarlo otra vez;
//   4. el TOPE del mes por negocio (`TOPE_VOZ_COACH_MES`): se RESERVA antes de pedir el audio, así dos pedidos a la vez no lo pasan;
//   5. el text-to-speech UNA vez, con streaming (el primer audio, ~0,35 s medido); una fija se GUARDA para la próxima.
// ⚠️ NUNCA REINTENTA SOLO: lo que gasta plata se reintenta cuando la persona vuelve a apretar.
// =============================================================================

import 'server-only';
import { createHash } from 'node:crypto';
import { keyDeMaKo } from './voz-mako';
import { getSetting, setSetting } from './settings';
import { getSupabaseServer } from './supabase';
import { MEDIA_BUCKET } from './evolution-media';
import { exigirPermisoIa } from './ia-permiso';
import { recordUsage } from './anthropic-usage';
import { cobrarMediosMt, devolverMediosMt } from './mako-tokens-medidor';
import { mtDeVoz, USD_POR_MIL_CARACTERES_DE_VOZ } from './mako-tokens-reglas';

/** El nombre del gasto en el libro de MaKo Tokens y en anthropic_usage. */
export const FEATURE_VOZ_COACH = 'voz-coach';
import {
  VOZ_COACH, textoParaVozCoach, claveDelMesVozCoach, usadoDelMes, cabeEnElMesVozCoach, rutaDeLaFija, firmaDeLaFija,
} from './voz-coach-reglas';

/** ¿Hay con qué decirlo? Sin la key de la plataforma, el botón no se muestra. */
export const vozCoachDisponible = (): boolean => keyDeMaKo() != null;

export type AudioCoach =
  | { ok: true; cuerpo: ReadableStream<Uint8Array> | Uint8Array; guardado: boolean }
  | { ok: false; status: number; error: string };

const leerGuardado = async (ruta: string): Promise<Uint8Array | null> => {
  try {
    const { data, error } = await getSupabaseServer().storage.from(MEDIA_BUCKET).download(ruta);
    if (error || !data) return null;
    return new Uint8Array(await data.arrayBuffer());
  } catch {
    return null;
  }
};

/** El audio de UN mensaje del coach, del negocio en curso (`getSetting` lee el suyo). Nunca tira. */
export async function audioDelCoach(texto0: string, op: { fija: boolean; ws: number }): Promise<AudioCoach> {
  const texto = textoParaVozCoach(texto0);
  if (!texto) return { ok: false, status: 400, error: 'Este mensaje no se lee en voz.' };
  const key = keyDeMaKo();
  if (!key) return { ok: false, status: 503, error: 'La voz de los coaches todavía no está conectada.' };
  // Sin el permiso de la persona, la app de iPhone no le manda nada a una IA (Apple 5.1.2(i), lib/ia-permiso.ts).
  try { await exigirPermisoIa(); } catch (e) { return { ok: false, status: 403, error: e instanceof Error ? e.message : 'Sin permiso para usar la IA.' }; }

  const ruta = op.fija ? rutaDeLaFija(createHash('sha256').update(firmaDeLaFija(texto)).digest('hex')) : null;
  if (ruta) {
    const ya = await leerGuardado(ruta);
    if (ya) return { ok: true, cuerpo: ya, guardado: true };
  }

  // El tope se RESERVA antes de pedir: lo que falle después ya está contado (un reintento lo paga la persona apretando de nuevo).
  const clave = claveDelMesVozCoach();
  const usado = usadoDelMes(await getSetting(clave).catch(() => null));
  if (!cabeEnElMesVozCoach(usado, texto.length)) return { ok: false, status: 429, error: 'Este mes ya se usó toda la voz de los coaches de tu negocio.' };
  // TODO GASTA MAKO TOKENS (Martín, 15/11/2026; lib/mako-tokens-medidor.ts): la voz es un MEDIO, se cobra exacto ANTES de pedirla
  // (`cobrarMediosMt`), por lo que cuesta (`mtDeVoz`). Lo fijo ya guardado salió arriba y no paga nada.
  const mt = mtDeVoz(texto.length);
  const sinSaldo = await cobrarMediosMt(mt, { feature: FEATURE_VOZ_COACH, referencia: op.fija ? 'pregunta fija' : 'respuesta del coach', costoUsd: (texto.length * USD_POR_MIL_CARACTERES_DE_VOZ) / 1000 });
  if (sinSaldo) return { ok: false, status: 402, error: sinSaldo };
  await setSetting(clave, String(usado + texto.length)).catch(() => {});
  // Si ElevenLabs no llega a generar nada (no contesta, o rechaza el pedido), se devuelve: es lo único que no cobra el proveedor.
  const devolver = (por: string) => devolverMediosMt(mt, { feature: FEATURE_VOZ_COACH, referencia: por }).catch(() => {});

  let r: Response;
  try {
    r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOZ_COACH.voiceId}/stream?output_format=${VOZ_COACH.formato}&optimize_streaming_latency=3`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text: texto, model_id: VOZ_COACH.modelo, language_code: 'es', voice_settings: VOZ_COACH.ajustes }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    await devolver('ElevenLabs no contestó');
    return { ok: false, status: 502, error: `ElevenLabs no contestó (${e instanceof Error ? e.message : 'error'}).`.slice(0, 200) };
  }
  if (!r.ok || !r.body) {
    const detalle = (await r.text().catch(() => '')).slice(0, 160);
    console.error(`[voz-coach] ElevenLabs ${r.status}: ${detalle}`);
    await devolver(`ElevenLabs ${r.status}`);
    return { ok: false, status: 502, error: 'ElevenLabs no pudo leer este mensaje ahora.' };
  }
  void recordUsage(FEATURE_VOZ_COACH, VOZ_COACH.modelo, {}, `${texto.length} caracteres${op.fija ? ' · fija' : ''}`, 'elevenlabs', 1, op.ws).catch(() => {});

  if (!ruta) return { ok: true, cuerpo: r.body, guardado: false };
  // Una fija se guarda ENTERA antes de contestar: la próxima vez sale de acá, sin pagarla.
  const audio = new Uint8Array(await r.arrayBuffer());
  try {
    await getSupabaseServer().storage.from(MEDIA_BUCKET).upload(ruta, audio, { contentType: 'audio/mpeg', upsert: true });
  } catch (e) {
    console.error(`[voz-coach] no pude guardar la fija: ${e instanceof Error ? e.message : String(e)}`);
  }
  return { ok: true, cuerpo: audio, guardado: false };
}
