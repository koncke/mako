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
//
// ── «PARA LEER» (#748, «guion con IA gratis») ─────────────────────────────────
// Mientras se graba, arriba del grabador va lo que hay que decir: el texto del
// mensaje (el wizard lo pasa en `guion`) o el que escribe MaKo con «Escríbeme el
// guion». Ese botón sólo se dibuja si quien monta pasa `paraGuion`: es lo que MaKo
// necesita saber de la secuencia, y sin eso no tiene de dónde escribir.
//
// El guion de MaKo vive en el estado de ESTE control y no se guarda en ningún lado:
// es material para leer en voz alta, no parte del mensaje. Por eso quien lo monta
// sobre varios pasos con la MISMA posición (el editor del lienzo) le pone `key`: si
// no, el guion de un mensaje se quedaría dibujado al abrir el siguiente.

import { useCallback, useState, type CSSProperties } from 'react';
import { useGrabacionVoz, BarraGrabacion } from '../whatsapp/_shared/VoiceRecorder';
import { Dropdown } from '../components/Dropdown';
import { Icon } from '@/app/_components/icons';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import { Spinner } from '@/app/_ui';
import { guionVigente } from '@/lib/guion-audio';
import type { AudioSetting } from './ChatAgentApp';
import { AudioPlay } from '@/app/whatsapp/_shared/AudioPlay';

const btn: CSSProperties = { padding: '7px 13px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: "'Geist', sans-serif", fontSize: 12.5, fontWeight: 600, cursor: 'pointer' };
const btnOn: CSSProperties = { ...btn, border: 'none', background: 'var(--ink)', color: 'var(--on-ink)' };

/** La ruta del guion: la misma que escribe el del onboarding (una cosa, un lugar). */
const RUTA_GUION = '/api/chat-agent/onboarding/guion-audio';
/** La ruta corta a los 60 s (`maxDuration`); el navegador espera un poco más y no para siempre. */
const ESPERA_GUION_MS = 65_000;

export function PasoAudioControl({ orden, audios, audioId, onElegir, onGrabado, onError, disabled, guion, paraGuion }: {
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
  /** El texto del mensaje, para leer mientras se graba. */
  guion?: string;
  /** Lo que MaKo necesita para escribir el guion. Sin esto, no hay botón. */
  paraGuion?: { objetivo?: string | null; gancho?: string | null; preguntas?: string[]; pie?: string };
}) {
  const [grabando, setGrabando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [fase, setFase] = useState<string | null>(null);
  // El guion de MaKo y el texto del que salió. Se dibuja sólo mientras ese texto siga
  // siendo el del mensaje: el wizard reusa este control al «↻ Reescribir» (sus filas van
  // por índice) y al editar el texto, y sin el `de` quedaba a la vista el guion de un
  // mensaje que ya no es éste.
  const [guionIA, setGuionIA] = useState<{ texto: string; de: string } | null>(null);
  const [pidiendo, setPidiendo] = useState(false);

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

  // La sesión de voz de la casa (sexta tanda, WhatsApp 7): ✓ termina, se escucha, y la ➤ lo guarda.
  const voz = useGrabacionVoz(subir, onError);
  const audio = audioId ? audios.find((a) => a.id === audioId) ?? null : null;
  // El guion de MaKo se ata al TEXTO del mensaje (`guion`), no a la transcripción del
  // audio: ésa cambia con cada grabación, y el guion se tiene que poder volver a leer
  // para grabar otra vez.
  const delMensaje = guion?.trim() ?? '';
  const deMaKo = guionVigente(guionIA, delMensaje);
  const paraLeer = (deMaKo ?? guion ?? '').trim();

  // Siempre desde el texto del MENSAJE (o lo que dice hoy su audio), nunca desde la
  // versión anterior de MaKo: pedir otra sobre la otra la va alejando del mensaje.
  async function pedirGuion() {
    if (!paraGuion || pidiendo) return;
    setPidiendo(true);
    const de = delMensaje;
    try {
      const r = await fetch(RUTA_GUION, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paso: {
          texto: guion?.trim() || audio?.transcript?.trim() || '',
          pie: paraGuion.pie ?? '',
          objetivo: paraGuion.objetivo ?? '',
          gancho: paraGuion.gancho ?? '',
          preguntas: paraGuion.preguntas ?? [],
        } }),
        signal: AbortSignal.timeout(ESPERA_GUION_MS),
      });
      const j = await r.json().catch(() => null) as { ok?: boolean; guion?: string; error?: string } | null;
      if (!j?.ok || !j.guion) { onError(j?.error || 'MaKo no pudo escribir el guion.'); return; }
      setGuionIA({ texto: j.guion, de });
    } catch (e) {
      onError(e instanceof Error && e.name === 'TimeoutError' ? 'MaKo tardó demasiado. Prueba de nuevo.' : 'Sin conexión. Prueba de nuevo.');
    } finally { setPidiendo(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        {/* Íconos de línea del set, no emojis (sexta tanda, general 10). */}
        <button type="button" disabled={disabled} onClick={() => { onElegir(null); setGrabando(false); }}
          style={{ ...(audioId ? btn : btnOn), display: 'inline-flex', alignItems: 'center', gap: 6 }}><IconoMenu nombre="nota" size={15} /> Texto</button>
        <button type="button" disabled={disabled} onClick={() => setGrabando(true)}
          style={{ ...(audioId || grabando ? btnOn : btn), display: 'inline-flex', alignItems: 'center', gap: 6 }}><IconoMenu nombre="audio" size={15} /> Nota de voz</button>
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
              // Íconos del set y no un emoji pegado al nombre (sexta tanda, general 10).
              options={[{ value: '', label: 'Grabar uno nuevo…', icono: 'agregar' }, ...audios.map((a) => ({ value: String(a.id), label: a.titulo, icono: 'audio' }))]}
            />
          )}

          {/* ARRIBA del grabador, y afuera del ternario de abajo: se tiene que ver
              MIENTRAS se graba, que es cuando se lee. */}
          {(paraLeer || paraGuion) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '10px 12px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border-strong)' }}>
              {paraLeer && (
                <>
                  <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)' }}>Para leer</div>
                  <div style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{paraLeer}</div>
                </>
              )}
              {paraGuion && (
                <button type="button" disabled={disabled || pidiendo} onClick={() => void pedirGuion()}
                  style={{ ...btn, alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--mako-ink)' }}>
                  {pidiendo ? <><Spinner size={12} /> Escribiendo…</> : deMaKo ? '✦ Otra versión' : '✦ Escríbeme el guion'}
                </button>
              )}
            </div>
          )}

          {voz.fase !== 'quieta' ? (
            <BarraGrabacion voz={voz} ocupado={subiendo} rotuloEnviar="Usar este audio" />
          ) : subiendo ? (
            <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>{fase ?? 'Guardando…'}</div>
          ) : audio ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
              {audio.url && <AudioPlay src={audio.url} duracion={audio.duracion_s} style={{ flex: 1, minWidth: 180, width: 'auto' }} />}
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
