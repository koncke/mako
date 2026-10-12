// =============================================================================
// voz-mako — generar (y guardar) un audio con la VOZ DE MAKO para una tarjeta «MaKo en WhatsApp»
// =============================================================================
// Las reglas (qué voz, qué texto, cuánto por mes) viven en lib/voz-mako-reglas.ts, puras y con test. Acá está
// lo que toca ElevenLabs y la base. El diseño, en docs/diseno-undecima-tanda.md §2 (decisión 2) y §9.20.
//
// EL ORDEN, Y POR QUÉ:
//   1. el texto se normaliza (`textoParaVozMaKo`): sin datos, sin links, sin emojis, con tope;
//   2. CACHÉ: si este negocio ya tiene ese mismo texto dicho, se devuelve ése (0 caracteres);
//   3. la key de la PLATAFORMA (`keyDeMaKo`); sin ella, el motivo y nada más;
//   4. el TOPE del mes por negocio (`TOPE_VOZ_MAKO_MES`), contando lo que ya se generó;
//   5. el RECLAMO contra el doble clic (`reclamarEspaciado`, 2 min, por texto): dos clics no pagan dos veces;
//   6. el text-to-speech UNA vez (`ttsConKey`), y el audio se GUARDA antes de contestar (`crearAudio`), así un
//      reintento de la persona encuentra la caché.
//
// ⚠️ NUNCA REINTENTA SOLO: lo que gasta plata se reintenta cuando la persona vuelve a apretar.
// ⚠️ EL MOTOR NUNCA LLAMA A ELEVENLABS AL ENVIAR: manda el mp3 guardado (es un audio más de `setting_audios`).
// ⚠️ SIN LA MIG 0257 el insert falla con 23514 DESPUÉS del text-to-speech: se paga ese audio una vez (≤700
//    caracteres) y el binario subido se borra (`crearAudio`). Por eso la migración va ANTES o JUNTO con el deploy.
// =============================================================================

import 'server-only';
import { runWithWorkspace } from './workspace';
import { reclamarEspaciado } from './espaciado';
import { ttsConKey } from './elevenlabs';
import { crearAudio, buscarAudioPorTranscript, transcriptsDesde, type AudioSetting } from './setting-audios';
import {
  VOZ_MAKO, ORIGEN_VOZ_MAKO, TOPE_VOZ_MAKO_MES, textoParaVozMaKo, caracteresVoz, cabeEnElMes, inicioDelMes,
  tituloVozMaKo, textoFalloVozMaKo,
} from './voz-mako-reglas';

/**
 * LA KEY DE ELEVENLABS DE LA PLATAFORMA para la Voz de MaKo, del entorno y de NINGÚN otro lado.
 *
 * ⚠️ NO ES `elevenKey()` (lib/elevenlabs.ts): ésa es la del CLIENTE (BYOK). Y no es la env de siempre:
 * `hidratarCredenciales` (lib/credenciales.ts) copia a process.env las credenciales del ws1 —Mauricio, un
 * cliente—, así que una voz que leyera esa env se le cobraría a él el día que conecte su ElevenLabs. Esta
 * env no está en ningún catálogo: nadie la hidrata ni la copia a la fila de un negocio.
 */
export function keyDeMaKo(): string | null {
  const v = process.env.MAKO_ELEVENLABS_API_KEY;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

export type ResultadoVozMaKo =
  | { ok: true; audio: AudioSetting; cache: boolean }
  | { ok: false; error: string; motivo: 'texto' | 'tope' | 'ocupado' | 'guardar' | 'eleven' };

/**
 * Genera la Voz de MaKo para `texto` en el negocio `ws` (o devuelve la que ya estaba). Nunca tira: un fallo
 * vuelve con su motivo, que nombra a ElevenLabs y no a MaKo.
 */
export async function generarVozMaKo(ws: number, texto: string): Promise<ResultadoVozMaKo> {
  const t = textoParaVozMaKo(texto);
  if (!t.ok) return { ok: false, error: t.error, motivo: 'texto' };
  const hablado = t.hablado;
  return runWithWorkspace(ws, async () => {
    try {
      const yaEsta = await buscarAudioPorTranscript(ORIGEN_VOZ_MAKO, hablado);
      if (yaEsta) return { ok: true as const, audio: yaEsta, cache: true };

      const key = keyDeMaKo();
      if (!key) return { ok: false as const, error: textoFalloVozMaKo('sin_key'), motivo: 'eleven' as const };

      const usado = (await transcriptsDesde(ORIGEN_VOZ_MAKO, inicioDelMes(new Date()))).reduce((s, x) => s + caracteresVoz(x), 0);
      if (!cabeEnElMes(usado, caracteresVoz(hablado))) {
        return { ok: false as const, error: `Llegaste al tope de la Voz de MaKo de este mes (${TOPE_VOZ_MAKO_MES.toLocaleString('es-MX')} caracteres).`, motivo: 'tope' as const };
      }

      if (!(await reclamarEspaciado(ws, 'voz-mako', 2, hablado))) {
        return { ok: false as const, error: 'Ese audio ya se está generando.', motivo: 'ocupado' as const };
      }

      const r = await ttsConKey(key, VOZ_MAKO.voiceId, hablado, VOZ_MAKO.ajustes, VOZ_MAKO.modelo, VOZ_MAKO.formato);
      if (!r.ok) {
        console.error(`[voz-mako] ws ${ws}: ElevenLabs ${r.motivo} — ${r.error}`);
        return { ok: false as const, error: textoFalloVozMaKo(r.motivo), motivo: 'eleven' as const };
      }

      try {
        const audio = await crearAudio({
          titulo: tituloVozMaKo(hablado), base64: r.valor.mp3.toString('base64'), mime: 'audio/mpeg',
          transcript: hablado, origen: ORIGEN_VOZ_MAKO,
        });
        return { ok: true as const, audio, cache: false };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[voz-mako] ws ${ws}: no se guardó el audio — ${msg}`);
        return { ok: false as const, error: 'No pude guardar el audio.', motivo: 'guardar' as const };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[voz-mako] ws ${ws}: ${msg}`);
      return { ok: false as const, error: 'No pude leer los audios de este negocio.', motivo: 'guardar' as const };
    }
  });
}
