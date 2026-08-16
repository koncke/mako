'use client';

// =============================================================================
// Una tarjeta del paso "Tus audios": guion + grabar acá mismo + escuchar/borrar
// =============================================================================
// Antes este paso era texto muerto: mostraba un guion en viñetas y mandaba a
// grabar a otra sub-tab. Irse a otra pantalla a mitad de un onboarding es la
// forma más rápida de no volver, y el paso no tenía manera de saber si el audio
// se había grabado — así que dejaba avanzar igual.
//
// Ahora la grabación vive acá: se graba, se escucha para comprobar que salió
// bien, y se puede rehacer o borrar sin salir del paso.
//
// El guion tiene dos capas y las dos importan:
//   · las VIÑETAS son el contrato (qué tiene que decir, en orden);
//   · el EJEMPLO es esa misma consigna ya escrita en la voz del dueño, para leer
//     en voz alta. Traducir "saluda y di tu nombre" a una frase propia mientras
//     se sostiene el micrófono es justo donde la gente se traba.

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useVoiceRecorder, VoiceRecorderBar } from '../whatsapp/_shared/VoiceRecorder';
import { Icon } from '@/app/_components/icons';
import type { AudioPasoDef } from '@/lib/audios-paso';
import { AudioPlay } from '@/app/whatsapp/_shared/AudioPlay';

const MONO = "'Geist Mono', monospace";

const btn: CSSProperties = { padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const btnDark: CSSProperties = { ...btn, border: 'none', background: 'var(--ink)', color: 'var(--on-ink)' };

export type AudioGrabado = { id: number; titulo: string; url: string | null; duracion_s: number | null };

export function GrabadorAudioPaso({ def, grabado, abierto, onToggle, onGrabado, onBorrado, onError }: {
  def: AudioPasoDef;
  grabado: AudioGrabado | null;
  abierto: boolean;
  onToggle: () => void;
  onGrabado: (a: AudioGrabado, porClave: Record<string, number>) => void;
  onBorrado: (id: number) => void;
  onError: (m: string) => void;
}) {
  const [guion, setGuion] = useState<{ bullets: string[]; ejemplo: string } | null>(null);
  const [cargandoGuion, setCargandoGuion] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [fase, setFase] = useState<string | null>(null);

  // El guion se pide al desplegar la tarjeta, no al montar las tres: son tres
  // llamadas a la IA y solo se necesita la de la que se está por grabar.
  useEffect(() => {
    if (!abierto || guion || cargandoGuion) return;
    setCargandoGuion(true);
    void (async () => {
      try {
        const j = await (await fetch('/api/chat-agent/onboarding/guion-audio', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clave: def.clave }),
        })).json();
        if (j.ok) setGuion({ bullets: j.bullets ?? def.guion, ejemplo: j.ejemplo ?? '' });
        else setGuion({ bullets: def.guion, ejemplo: '' });
      } catch {
        // Sin IA el paso sigue siendo usable: quedan las viñetas del catálogo.
        setGuion({ bullets: def.guion, ejemplo: '' });
      } finally { setCargandoGuion(false); }
    })();
  }, [abierto, guion, cargandoGuion, def]);

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
        body: JSON.stringify({ titulo: def.titulo, base64: btoa(bin), mime: 'audio/mpeg', duracionS: secs, clave: def.clave }),
      })).json();
      if (!j.ok) { onError(j.error || 'No se pudo guardar el audio.'); return; }
      onGrabado(j.audio as AudioGrabado, (j.porClave ?? {}) as Record<string, number>);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'No se pudo procesar el audio.');
    } finally { setSubiendo(false); setFase(null); }
  }, [def, onGrabado, onError]);

  const voz = useVoiceRecorder(subir, onError);
  // La duración se lee del hook en el momento de soltar: el propio hook la
  // entrega como segundo argumento de onSend, porque su estado ya se reseteó.
  const secsRef = useRef(0);
  secsRef.current = voz.secs;

  async function borrar() {
    if (!grabado) return;
    try {
      const j = await (await fetch(`/api/chat-agent/audios?id=${grabado.id}`, { method: 'DELETE' })).json();
      if (j.ok) onBorrado(grabado.id); else onError(j.error || 'No se pudo borrar.');
    } catch { onError('Sin conexión — vuelve a intentarlo.'); }
  }

  const listo = !!grabado;

  return (
    <div style={{ border: '1px solid ' + (listo ? 'var(--good)' : 'var(--border)'), borderRadius: 12, background: listo ? 'var(--good-bg)' : 'var(--surface-2)', overflow: 'hidden' }}>
      <button
        type="button" onClick={onToggle}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
      >
        <span aria-hidden style={{ flex: 'none', width: 22, height: 22, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, fontFamily: MONO, background: listo ? 'var(--good)' : 'var(--border)', color: listo ? '#fff' : 'var(--dim)' }}>
          {listo ? '✓' : def.n}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{def.titulo}</span>
          <span style={{ display: 'block', fontSize: 11.5, color: 'var(--faint)', marginTop: 1 }}>{def.situacion}</span>
        </span>
        <span aria-hidden style={{ flex: 'none', color: 'var(--faint)', fontSize: 11, transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
      </button>

      {abierto && (
        <div style={{ padding: '0 13px 13px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {cargandoGuion && !guion ? (
            <div style={{ fontSize: 12.5, color: 'var(--faint)' }}>Preparando el guion…</div>
          ) : guion && (
            <>
              <div style={{ padding: '11px 13px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 6 }}>Qué tiene que decir</div>
                <ol style={{ margin: 0, paddingLeft: 17, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {guion.bullets.map((b, i) => (
                    <li key={i} style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.55 }}>{b}</li>
                  ))}
                </ol>
              </div>

              {guion.ejemplo && (
                <div style={{ padding: '11px 13px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border-strong)' }}>
                  <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 6 }}>Ejemplo en tu voz · léelo tal cual</div>
                  <div style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.65 }}>{guion.ejemplo}</div>
                </div>
              )}
            </>
          )}

          {/* Grabar · escuchar · rehacer · borrar, sin salir del paso */}
          {voz.recording ? (
            <VoiceRecorderBar
              paused={voz.paused} secs={voz.secs} sending={subiendo}
              onCancel={() => voz.stop(true)}
              onTogglePause={() => (voz.paused ? voz.resume() : voz.pause())}
              onSend={() => voz.stop(false)}
            />
          ) : subiendo ? (
            <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>{fase ?? 'Guardando…'}</div>
          ) : grabado ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {grabado.url && <AudioPlay src={grabado.url} style={{ flex: 1, minWidth: 200, height: 36 }} />}
              <button type="button" onClick={() => void voz.start()} style={btn}>Grabar de nuevo</button>
              <button
                type="button" onClick={() => void borrar()}
                title="Borrar este audio" aria-label={`Borrar el audio de ${def.titulo}`}
                style={{ ...btn, border: '1px solid transparent', background: 'transparent', color: 'var(--bad)', padding: '7px 9px' }}
              >
                <Icon name="trash" size={15} />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => void voz.start()} style={{ ...btnDark, alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span aria-hidden style={{ display: 'inline-flex' }}><Icon name="mic" size={15} /></span>
              Grabar este audio
            </button>
          )}
        </div>
      )}
    </div>
  );
}
