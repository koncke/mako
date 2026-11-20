// =============================================================================
// cubos-voz — la voz del video del personaje en cubos, CON sus tiempos (servidor)
// =============================================================================
// Las plantillas necesitan el segundo de cada palabra (lib/ai-avatar/cubos-tiempos.ts). Hay tres voces:
//   · una voz de MaKo: ElevenLabs `/with-timestamps` con la key de la PLATAFORMA (`keyDeMaKo`), en un solo pedido el audio
//     y cada letra con su segundo. Se cobra en MaKo Tokens ANTES de pedirla (`mtDeVoz`) y se devuelve si ElevenLabs no
//     genera nada: el molde de lib/voz-coach.ts, con el mismo modelo (Flash v2.5, el del precio publicado de `mtDeVoz`);
//   · su voz clonada (la del onboarding, `video.voz`): lo mismo con SU cuenta de ElevenLabs (`elevenKey`, BYOK), que la paga
//     ella; por eso no se cobra en MaKo Tokens, como el resto de su voz (lib/elevenlabs.ts → `decirConVoz`);
//   · un audio que sube la persona (su voz grabada, o la voz de un video de la galería para replicarlo): el forced alignment
//     de ElevenLabs con la key de la plataforma, cobrado por segundo de audio.
// El audio se guarda en el bucket de medios (`wa-media`, `<ws>/avatar-cubos/<id>.mp3`) y la pantalla lo baja con una URL
// firmada. ⚠️ NUNCA REINTENTA SOLO: lo que gasta plata se reintenta cuando la persona vuelve a apretar.
// =============================================================================

import 'server-only';
import { randomUUID } from 'node:crypto';
import { keyDeMaKo } from '@/lib/voz-mako';
import { VOZ_MAKO } from '@/lib/voz-mako-reglas';
import { VOZ_COACH } from '@/lib/voz-coach-reglas';
import { elevenKey } from '@/lib/elevenlabs';
import { getVozCliente } from '@/app/video-generator/voz-cliente';
import { getSupabaseServer } from '@/lib/supabase';
import { MEDIA_BUCKET } from '@/lib/evolution-media';
import { exigirPermisoIa } from '@/lib/ia-permiso';
import { recordUsage } from '@/lib/anthropic-usage';
import { cobrarMediosMt, devolverMediosMt } from '@/lib/mako-tokens-medidor';
import { mtDeVoz, mtDeUsd, USD_POR_MIL_CARACTERES_DE_VOZ } from '@/lib/mako-tokens-reglas';
import { palabrasDeLetras, tiemposDeEscenas, textoParaVoz, type Escena, type PalabraAlineada, type Tiempos } from './cubos-tiempos';

export const FEATURE_VOZ_CUBOS = 'avatar-cubos-voz';
export const FEATURE_ALINEAR_CUBOS = 'avatar-cubos-alinear';

/**
 * El forced alignment cobra por tiempo de audio. ElevenLabs no lo publica aparte: se toma el precio de lista de su
 * speech-to-text (Scribe, US$0,22 por hora, elevenlabs.io/pricing/api, leído el 19/11/2026). 15 s de voz = 1 MT.
 */
export const USD_POR_HORA_DE_ALINEACION = 0.22;
export const mtDeAlineacion = (segundos: number): number => Math.max(1, mtDeUsd((Math.max(0, segundos) * USD_POR_HORA_DE_ALINEACION) / 3600));

/** Las voces de MaKo (las dos que ya tiene la cuenta de la plataforma: la de MaKo y la de los coaches). */
export const VOCES_MAKO_CUBOS = [
  { id: 'mako-david', voiceId: VOZ_MAKO.voiceId, nombre: 'David' },
  { id: 'mako-fernando', voiceId: VOZ_COACH.voiceId, nombre: 'Fernando' },
] as const;
const MODELO_MAKO = VOZ_COACH.modelo;            // eleven_flash_v2_5: el precio de `mtDeVoz`
const MODELO_CLON = 'eleven_multilingual_v2';    // el clon suena mejor en multilingual (lo paga su cuenta)
const FORMATO = 'mp3_44100_128';

export type PedidoVoz = { tipo: 'mako'; id: string } | { tipo: 'clon' };
export type VozLista = { ok: true; ruta: string; tiempos: Tiempos; mt: number } | { ok: false; error: string };

const rutaNueva = (ws: number) => `${ws}/avatar-cubos/${randomUUID()}.mp3`;

async function guardar(ruta: string, audio: Uint8Array, tipo = 'audio/mpeg'): Promise<boolean> {
  const { error } = await getSupabaseServer().storage.from(MEDIA_BUCKET).upload(ruta, audio, { contentType: tipo, upsert: false });
  if (error) console.error(`[avatar-cubos] no pude guardar la voz: ${error.message}`);
  return !error;
}

/** Las voces que la persona puede elegir: las de MaKo y, si la clonó y tiene su cuenta conectada, la suya. */
export async function vocesDisponibles(): Promise<{ mako: boolean; clon: { nombre: string } | null }> {
  const mako = keyDeMaKo() != null;
  const v = await getVozCliente().catch(() => null);
  const clon = v?.clon && (await elevenKey().catch(() => null)) ? { nombre: v.clon.nombre || 'Tu voz' } : null;
  return { mako, clon };
}

/** La voz del guion con sus tiempos (voz de MaKo o su clon). */
export async function vozConTiempos(ws: number, escenas: readonly Escena[], pedido: PedidoVoz): Promise<VozLista> {
  const texto = textoParaVoz(escenas);
  if (!texto) return { ok: false, error: 'Falta el guion.' };
  try { await exigirPermisoIa(); } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'Sin permiso para usar la IA.' }; }

  let key: string | null, voiceId: string, modelo: string, cobra: boolean;
  if (pedido.tipo === 'mako') {
    const v = VOCES_MAKO_CUBOS.find((x) => x.id === pedido.id);
    if (!v) return { ok: false, error: 'Elige una voz.' };
    key = keyDeMaKo(); voiceId = v.voiceId; modelo = MODELO_MAKO; cobra = true;
    if (!key) return { ok: false, error: 'Las voces de MaKo todavía no están conectadas.' };
  } else {
    const c = await getVozCliente().catch(() => null);
    key = await elevenKey().catch(() => null);
    if (!c?.clon || !key) return { ok: false, error: 'Tu voz clonada no está lista: clónala en el onboarding y conecta ElevenLabs.' };
    voiceId = c.clon.voiceId; modelo = MODELO_CLON; cobra = false;
  }

  // TODO GASTA MAKO TOKENS (lib/mako-tokens-medidor.ts): la voz de MaKo es un MEDIO y se cobra exacto ANTES de pedirla.
  const mt = cobra ? mtDeVoz(texto.length) : 0;
  if (cobra) {
    const sinSaldo = await cobrarMediosMt(mt, { feature: FEATURE_VOZ_CUBOS, referencia: `${texto.length} caracteres`, costoUsd: (texto.length * USD_POR_MIL_CARACTERES_DE_VOZ) / 1000 });
    if (sinSaldo) return { ok: false, error: sinSaldo };
  }
  const devolver = (por: string) => (cobra ? devolverMediosMt(mt, { feature: FEATURE_VOZ_CUBOS, referencia: por }).catch(() => {}) : Promise.resolve());

  let r: Response;
  try {
    r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=${FORMATO}`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({ text: texto, model_id: modelo, voice_settings: VOZ_COACH.ajustes, ...(modelo === MODELO_MAKO ? { language_code: 'es' } : {}) }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (e) {
    await devolver('ElevenLabs no contestó');
    return { ok: false, error: `ElevenLabs no contestó (${e instanceof Error ? e.message : 'error'}).`.slice(0, 200) };
  }
  if (!r.ok) {
    console.error(`[avatar-cubos] ElevenLabs ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`);
    await devolver(`ElevenLabs ${r.status}`);
    return { ok: false, error: 'ElevenLabs no pudo decir este guion ahora. Prueba de nuevo en un rato.' };
  }
  const j = (await r.json().catch(() => null)) as { audio_base64?: string; alignment?: Parameters<typeof palabrasDeLetras>[0] } | null;
  if (!j?.audio_base64 || !j.alignment) { await devolver('respuesta sin audio'); return { ok: false, error: 'ElevenLabs no devolvió la voz.' }; }
  void recordUsage(FEATURE_VOZ_CUBOS, modelo, {}, `${texto.length} caracteres${cobra ? '' : ' · su cuenta'}`, 'elevenlabs', 1, ws).catch(() => {});

  const tiempos = tiemposDeEscenas(escenas, palabrasDeLetras(j.alignment));
  if (!tiempos) return { ok: false, error: 'La voz salió, pero no pude alinear sus palabras. Prueba de nuevo.' };
  const ruta = rutaNueva(ws);
  if (!(await guardar(ruta, new Uint8Array(Buffer.from(j.audio_base64, 'base64'))))) return { ok: false, error: 'No pude guardar la voz.' };
  return { ok: true, ruta, tiempos, mt };
}

/** Un audio que subió la persona, alineado con su guion (la voz grabada, o la de un video que quiere replicar). */
export async function alinearAudio(ws: number, escenas: readonly Escena[], audio: Uint8Array, tipo: string, segundos: number): Promise<VozLista> {
  const texto = textoParaVoz(escenas);
  if (!texto) return { ok: false, error: 'Falta el guion.' };
  const key = keyDeMaKo();
  if (!key) return { ok: false, error: 'La alineación de MaKo todavía no está conectada.' };
  try { await exigirPermisoIa(); } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'Sin permiso para usar la IA.' }; }
  const mt = mtDeAlineacion(segundos);
  const sinSaldo = await cobrarMediosMt(mt, { feature: FEATURE_ALINEAR_CUBOS, referencia: `${Math.round(segundos)} s de audio`, costoUsd: (segundos * USD_POR_HORA_DE_ALINEACION) / 3600 });
  if (sinSaldo) return { ok: false, error: sinSaldo };
  const devolver = (por: string) => devolverMediosMt(mt, { feature: FEATURE_ALINEAR_CUBOS, referencia: por }).catch(() => {});

  const fd = new FormData();
  fd.append('file', new Blob([audio as BlobPart], { type: tipo || 'audio/mpeg' }), 'voz');
  fd.append('text', texto);
  let r: Response;
  try {
    r = await fetch('https://api.elevenlabs.io/v1/forced-alignment', { method: 'POST', headers: { 'xi-api-key': key }, body: fd, signal: AbortSignal.timeout(90_000) });
  } catch (e) {
    await devolver('ElevenLabs no contestó');
    return { ok: false, error: `ElevenLabs no contestó (${e instanceof Error ? e.message : 'error'}).`.slice(0, 200) };
  }
  if (!r.ok) {
    console.error(`[avatar-cubos] alineación ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`);
    await devolver(`ElevenLabs ${r.status}`);
    return { ok: false, error: 'No pude alinear tu audio con el guion. ¿Dice exactamente lo que está escrito?' };
  }
  const j = (await r.json().catch(() => null)) as { words?: PalabraAlineada[] } | null;
  void recordUsage(FEATURE_ALINEAR_CUBOS, 'forced-alignment', {}, `${Math.round(segundos)} s`, 'elevenlabs', 1, ws).catch(() => {});
  const tiempos = j?.words ? tiemposDeEscenas(escenas, j.words) : null;
  if (!tiempos) return { ok: false, error: 'Tu audio no dice exactamente el guion: revisa que cada palabra esté escrita igual.' };
  const ruta = rutaNueva(ws);
  if (!(await guardar(ruta, audio, tipo || 'audio/mpeg'))) return { ok: false, error: 'No pude guardar tu audio.' };
  return { ok: true, ruta, tiempos, mt };
}

/** URLs firmadas (2 h) para bajar las voces desde la pantalla. */
export async function urlsDeVoces(rutas: readonly string[]): Promise<Record<string, string>> {
  const unicas = [...new Set(rutas.filter(Boolean))];
  if (!unicas.length) return {};
  const { data } = await getSupabaseServer().storage.from(MEDIA_BUCKET).createSignedUrls(unicas, 7200);
  const out: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  return out;
}
