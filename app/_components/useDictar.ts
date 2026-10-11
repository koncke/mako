'use client';

// =============================================================================
// useDictar — dictar al campo: en vivo si el navegador puede, si no grabar y transcribir
// =============================================================================
// La lógica que era de `BotonDictar` (app/plan/board/CrearTareaModal.tsx), extraída para
// que el plan y el chat de MaKo del teléfono (app/m/mako/Composer.tsx) usen LA MISMA y no
// haya dos. El botón de cada uno es suyo; esto sólo decide qué hace el micrófono.
//
//   · Con `SpeechRecognition` (Chrome, Safari): dicta en vivo, palabra por palabra, al campo.
//   · Sin él (Firefox, o un navegador que no lo trae): graba con MediaRecorder y sube el
//     audio a /api/plan-dictado, que lo transcribe.
//
// ⚠️ El texto se PEGA en el campo, nunca se usa para crear nada: lo que transcribe un modelo
// se lee antes de que valga.
// ⚠️ /api/plan-dictado devuelve el fallo de transcripción con status 200 y `ok:false`: se lee
// `j.ok`, nunca `res.ok`.
// =============================================================================

import { useRef, useState } from 'react';
import { useVoiceRecorder } from '@/app/whatsapp/_shared/VoiceRecorder';
import { useDictadoVivo, unirDictado } from '@/app/plan/board/dictado-vivo';

export type ResultadoTranscripcion = { ok: true; texto: string } | { ok: false; error: string };

/**
 * Sube una nota de voz a /api/plan-dictado y devuelve el texto. No tira: todo fallo vuelve
 * como `{ ok:false, error }` con una frase para la persona.
 */
export async function transcribirNota(blob: Blob, timeoutMs = 90_000): Promise<ResultadoTranscripcion> {
  try {
    const fd = new FormData();
    fd.append('audio', blob, blob.type.includes('mp4') ? 'nota.mp4' : 'nota.webm');
    // ⚠️ CON SEÑAL DE CORTE (AGENTS.md): un `fetch` sin `signal` con la conexión caída no
    // resuelve NUNCA, y el botón quedaba deshabilitado para siempre.
    const j = await fetch('/api/plan-dictado', { method: 'POST', body: fd, signal: AbortSignal.timeout(timeoutMs) })
      .then((r) => r.json())
      .catch((e: unknown) => { throw e; });
    if (!j?.ok) return { ok: false, error: String(j?.error || 'No pude transcribir el audio.') };
    return { ok: true, texto: String(j.texto ?? '') };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error && e.name === 'TimeoutError'
        ? 'La transcripción tardó demasiado. Escríbelo a mano o prueba de nuevo.'
        : e instanceof Error ? e.message : String(e),
    };
  }
}

export type Dictar = {
  /** ¿dicta en vivo? false = el camino de grabar y transcribir. */
  enVivo: boolean;
  /** el micrófono está abierto (dictando o grabando) */
  escuchando: boolean;
  /** subiendo la grabación a transcribir (sólo el camino sin dictado en vivo) */
  subiendo: boolean;
  /** segundos grabados (sólo el camino sin dictado en vivo) */
  segundos: number;
  /** tocar el micrófono: arranca o termina */
  alternar: () => void;
};

/**
 * @param valor   lo que hay escrito AHORA: lo dictado se pega atrás, no lo reemplaza
 * @param onValor el campo entero, con lo dictado pegado
 */
export function useDictar(valor: string, onValor: (v: string) => void, onError: (m: string) => void): Dictar {
  const [subiendo, setSubiendo] = useState(false);
  // El texto que había ANTES de arrancar a dictar. Cada parcial reescribe el campo entero
  // con `base + loDictado`, porque el reconocedor corrige lo que ya dijo: acumular los
  // parciales duplicaría media frase cada vez que cambia de opinión.
  const base = useRef('');
  const vivo = useDictadoVivo(
    (texto) => onValor(unirDictado(base.current, texto)),
    onError,
  );

  const rec = useVoiceRecorder(async (blob) => {
    setSubiendo(true);
    try {
      const r = await transcribirNota(blob);
      if (!r.ok) { onError(r.error); return; }
      if (r.texto) onValor(unirDictado(valor, r.texto));
    } finally { setSubiendo(false); }
  }, onError);

  const escuchando = vivo.soportado ? vivo.escuchando : rec.recording;
  const alternar = () => {
    if (vivo.soportado) {
      if (vivo.escuchando) vivo.parar();
      else { base.current = valor; vivo.arrancar(); }
      return;
    }
    if (rec.recording) rec.stop(false); else void rec.start();
  };

  return { enVivo: vivo.soportado, escuchando, subiendo, segundos: rec.secs, alternar };
}
