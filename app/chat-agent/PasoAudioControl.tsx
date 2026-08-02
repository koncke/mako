'use client';

// =============================================================================
// Un mensaje de la secuencia: ¿texto o nota de voz?
// =============================================================================
// La decisión se toma POR MENSAJE, mientras se arma la secuencia, y si es audio
// se graba en el momento. Antes había una sub-tab «Audios» aparte: había que
// salir del wizard, grabar ahí, volver, y recién entonces colgar el audio del
// paso. Tres pantallas para una sola decisión, y la mitad de la gente no volvía.
//
// La biblioteca sigue existiendo por debajo (setting_audios): un audio grabado
// acá queda disponible para cualquier otra secuencia, y los que ya estén
// grabados aparecen en la lista. Lo que desaparece es tener que ir a buscarla.

import { useCallback, useState, type CSSProperties } from 'react';
import { useVoiceRecorder, VoiceRecorderBar } from '../whatsapp/_shared/VoiceRecorder';
import { Dropdown } from '../components/Dropdown';
import { Icon } from '@/app/_components/icons';
import type { AudioSetting } from './ChatAgentApp';

const btn: CSSProperties = { padding: '7px 13px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: "'Geist', sans-serif", fontSize: 12.5, fontWeight: 600, cursor: 'pointer' };
const btnOn: CSSProperties = { ...btn, border: 'none', background: 'var(--ink)', color: 'var(--on-sidebar)' };

export function PasoAudioControl({ orden, audios, audioId, onElegir, onGrabado, onError, disabled }: {
  /** Para el título por defecto del audio nuevo. */
  orden: number;
  audios: AudioSetting[];
  /** null = este mensaje es de texto. */
  audioId: number | null;
  onElegir: (id: number | null) => void;
  /** Un audio recién grabado: hay que sumarlo a la biblioteca del padre. */
  onGrabado: (a: AudioSetting) => void;
  onError: (m: string) => void;
  disabled?: boolean;
}) {
  const [grabando, setGrabando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [fase, setFase] = useState<string | null>(null);

  const subir = useCallback(async (blob: Blob, secs: number) => {
    setSubiendo(true);
    try {
      setFase('Convirtiendo…');
      const { blobToMp3 } = await import('../whatsapp/audio');
      const mp3 = await blobToMp3(blob);
      const buf = new Uint8Array(await mp3.arrayBuffer());
      let bin = '';
      for (let i = 0; i < buf.length; i += 8192) bin += String.fromCharCode(...buf.subarray(i, i + 8192));
      setFase('Guardando…');
      const j = await (await fetch('/api/chat-agent/audios', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo: `Mensaje ${orden}`, base64: btoa(bin), mime: 'audio/mpeg', duracionS: secs }),
      })).json();
      if (!j.ok) { onError(j.error || 'No se pudo guardar el audio.'); return; }
      onGrabado(j.audio as AudioSetting);
      onElegir((j.audio as AudioSetting).id);
      setGrabando(false);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'No se pudo procesar el audio.');
    } finally { setSubiendo(false); setFase(null); }
  }, [orden, onElegir, onGrabado, onError]);

  const voz = useVoiceRecorder(subir, onError);
  const audio = audioId ? audios.find((a) => a.id === audioId) ?? null : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        <button type="button" disabled={disabled} onClick={() => { onElegir(null); setGrabando(false); }}
          style={audioId ? btn : btnOn}>💬 Texto</button>
        <button type="button" disabled={disabled} onClick={() => setGrabando(true)}
          style={audioId || grabando ? btnOn : btn}>🎙 Nota de voz</button>
      </div>

      {(audioId || grabando) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Los audios ya grabados siguen disponibles: uno grabado para una
              secuencia sirve para otra, y re-grabar lo mismo es trabajo al pedo. */}
          {audios.length > 0 && (
            <Dropdown
              value={audioId ? String(audioId) : ''}
              onChange={(v) => onElegir(v ? Number(v) : null)}
              width="100%" ariaLabel={`Audio del mensaje ${orden}`}
              buttonStyle={{ padding: '7px 11px', fontSize: 12.5 }}
              options={[{ value: '', label: 'Grabar uno nuevo…' }, ...audios.map((a) => ({ value: String(a.id), label: `🎙 ${a.titulo}` }))]}
            />
          )}

          {voz.recording ? (
            <VoiceRecorderBar
              paused={voz.paused} secs={voz.secs} sending={subiendo}
              onCancel={() => voz.stop(true)}
              onTogglePause={() => (voz.paused ? voz.resume() : voz.pause())}
              onSend={() => voz.stop(false)}
            />
          ) : subiendo ? (
            <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>{fase ?? 'Guardando…'}</div>
          ) : audio ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
              {audio.url && <audio controls src={audio.url} style={{ flex: 1, minWidth: 180, height: 34 }} />}
              <button type="button" disabled={disabled} onClick={() => void voz.start()} style={btn}>Grabar otro</button>
            </div>
          ) : (
            <button type="button" disabled={disabled} onClick={() => void voz.start()}
              style={{ ...btn, alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <span aria-hidden style={{ display: 'inline-flex' }}><Icon name="mic" size={14} /></span>
              Grabar este mensaje
            </button>
          )}

          {audio?.transcript && (
            <div style={{ fontSize: 12, color: 'var(--faint)', lineHeight: 1.5 }}>Dice: «{audio.transcript.slice(0, 140)}{audio.transcript.length > 140 ? '…' : ''}»</div>
          )}
        </div>
      )}
    </div>
  );
}
