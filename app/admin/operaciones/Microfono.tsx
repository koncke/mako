'use client';

// =============================================================================
// El micrófono de la caja del Centro (16/10/2026)
// =============================================================================
// Martín: «Agrega la funcionalidad de dictar con audio, como ya lo hacemos en otros lados». La lógica es LA de la
// casa, sin copia: app/_components/useDictar.ts (en vivo con SpeechRecognition; si el navegador no lo tiene, graba y
// transcribe con /api/plan-dictado), la misma del alta del Plan y del chat de MaKo del teléfono. El botón es de acá,
// con la forma del de mandar.
//
// ⚠️ DESDE EL 24/10/2026 LA CAJA YA NO DICTA (Martín: «en chats o en los chats de MaKo que se grabe el audio y se envíe
// directamente»): sin nada escrito, el botón de toda caja de chat GRABA una nota de voz (app/_chat/CajaChat.tsx y
// app/_chat/nota-que-se-manda.ts), y este botón queda como la flecha. Lo transcrito SALE sin esperar en el campo (antes se
// pegaba para que Martín lo leyera); en el Ops Center se sigue FIRMANDO en su dispositivo, y el audio sigue sin viajar a la
// PC: lo que se manda es el texto. El dictado de acá (`Microfono`, y la rama del micrófono de `BotonMandar`) queda para una
// caja que no grabe; docs/diseno-chats-de-mako.md dice dónde queda el dictado.

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

/**
 * El micrófono que GRABA, al lado de la flecha: lo adjuntado sin nada escrito (`micAlLadoDeLaFlecha`, ticket #51). `onGrabar` arranca
 * la sesión de la nota que sale con lo adjuntado (CajaChat.tsx).
 */
export function BotonGrabar({ onGrabar, apagado }: { onGrabar: () => void; apagado?: boolean }) {
  return (
    <button type="button" className="co-enviar co-enviar--mic" onClick={onGrabar} disabled={apagado} aria-label="Grabar una nota de voz" title="Grabar una nota de voz">
      <Icon name="mic" size={18} />
    </button>
  );
}

/**
 * EL BOTÓN DE LA CAJA ES UNO, COMO EN WHATSAPP (17/10/2026; Martín: «el botón de audio y el de enviar son UNO»): el micrófono
 * cuando no hay nada para mandar, y la flecha apenas hay texto o un adjunto. Mientras dicta sigue siendo el micrófono (lo
 * dictado va entrando en la caja y la flecha le sacaría el botón de terminar); al terminar, pasa a la flecha.
 * WhatsApp graba una nota de voz manteniendo apretado; acá se DICTA con un toque y el texto queda en la caja para leerlo
 * antes de mandarlo (la regla de arriba: nada transcrito sale sin que Martín lo vea).
 */
export function BotonMandar({ valor, onValor, onError, apagado, enviando, ocupado = false, hayQueMandar, onMandar, titulo = 'Firmar y mandar' }: {
  valor: string;
  onValor: (v: string) => void;
  onError: (m: string) => void;
  /** La caja no deja hacer nada (se está mandando). */
  apagado?: boolean;
  enviando: boolean;
  /** MaKo está trabajando (revisión del 21/10/2026): la flecha espera girando, pero se puede DICTAR el siguiente, y quien
   *  ya dictaba no pierde el botón de terminar (antes desaparecía y el dictado seguía escribiendo en la caja). */
  ocupado?: boolean;
  /** Hay texto o un adjunto: el botón es la flecha. */
  hayQueMandar: boolean;
  onMandar: () => void;
  titulo?: string;
}) {
  const d = useDictar(valor, onValor, onError);
  if (enviando || (ocupado && hayQueMandar && !d.escuchando && !d.subiendo)) return <button type="button" className="co-enviar" disabled aria-label="Mandando"><span className="co-enviar__giro" aria-hidden /></button>;
  if (hayQueMandar && !d.escuchando && !d.subiendo) {
    return (
      <button type="button" className="co-enviar" onClick={onMandar} disabled={apagado} aria-label={titulo} title={titulo}>
        <Icon name="flecha" size={18} />
      </button>
    );
  }
  const rotulo = d.subiendo ? 'Transcribiendo…' : d.escuchando ? 'Te escucho: toca para terminar' : 'Dictar';
  return (
    <button type="button" className="co-enviar co-enviar--mic" data-escuchando={d.escuchando ? '' : undefined} onClick={d.alternar}
      disabled={apagado || d.subiendo} title={rotulo} aria-label={d.escuchando ? 'Terminar de dictar' : 'Dictar'} aria-pressed={d.escuchando}>
      {d.subiendo ? <span className="co-mic__txt">…</span>
        : d.escuchando && !d.enVivo ? <span className="co-mic__txt">{`${d.segundos}s`}</span>
          : <Icon name="mic" size={18} />}
    </button>
  );
}
