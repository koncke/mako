'use client';

// =============================================================================
// El micrófono de la caja del Centro (16/10/2026)
// =============================================================================
// Martín: «Agrega la funcionalidad de dictar con audio, como ya lo hacemos en otros lados». La lógica es LA de la
// casa, sin copia: app/_components/useDictar.ts (en vivo con SpeechRecognition; si el navegador no lo tiene, graba y
// transcribe con /api/plan-dictado), la misma del alta del Plan y del chat de MaKo del teléfono. El botón es de acá,
// con la forma del de mandar.
//
// ⚠️ EL TEXTO SE PEGA EN LA CAJA, NO SE MANDA. Martín lo lee, lo corrige si hace falta, y al mandar se FIRMA en su
// dispositivo como cualquier otro trabajo: el audio nunca viaja a la PC, y nada transcrito por una máquina sale sin que
// él lo haya visto.

import { useDictar } from '@/app/_components/useDictar';
import { Icon } from '@/app/_components/icons';

export function Microfono({ valor, onValor, onError, apagado }: {
  /** Lo que hay escrito AHORA: lo dictado se pega atrás. */
  valor: string;
  onValor: (v: string) => void;
  onError: (m: string) => void;
  apagado?: boolean;
}) {
  const d = useDictar(valor, onValor, onError);
  const titulo = d.subiendo ? 'Transcribiendo…' : d.escuchando ? 'Te escucho: toca para terminar' : 'Dictar';
  return (
    <button type="button" className="co-mic" data-escuchando={d.escuchando ? '' : undefined} onClick={d.alternar}
      disabled={apagado || d.subiendo} title={titulo} aria-label={d.escuchando ? 'Terminar de dictar' : 'Dictar'} aria-pressed={d.escuchando}>
      {d.subiendo ? <span className="co-mic__txt">…</span>
        : d.escuchando && !d.enVivo ? <span className="co-mic__txt">{`${d.segundos}s`}</span>
          : <Icon name="mic" size={18} />}
    </button>
  );
}
