'use client';
// =============================================================================
// LA BARRA DEL REPRODUCTOR DE LA MAQUETA, PARA EL VIDEO DEL MOTOR (20/11/2026, V4 y R57-21)
// =============================================================================
// El video del día del reto corre en su mensaje con el reproductor de la maqueta (el de ./VideoDelMomento.tsx: play, tiempo, avance y
// velocidad), no con el `<video controls>` del navegador. Ese video es el del motor (MotorTutorial → VideoChico, ./lugarDelVideo.ts):
// esta barra lo maneja por su ref, sin ser dueña del <video>. Usa las clases de CSS_REPRODUCTOR (las pone quien la dibuja).
// =============================================================================
import { useEffect, useState, type MouseEvent, type RefObject } from 'react';
import { Icon } from '@/app/_components/icons';

const VELOCIDADES = [1, 1.25, 1.5, 2] as const;
const mmss = (s: number) => { const t = Math.max(0, Math.round(s || 0)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

export function BarraDelVideo({ vidRef, archivo, durManifiesto = 0 }: { vidRef: RefObject<HTMLVideoElement | null>; archivo: string; durManifiesto?: number }) {
  const [corre, setCorre] = useState(false);
  const [t, setT] = useState(0);
  const [durLeida, setDur] = useState(0);
  const [vel, setVel] = useState<number>(1);
  const dur = durLeida || durManifiesto;
  useEffect(() => {
    const v = vidRef.current;
    if (!v) return;
    const alPlay = () => setCorre(true), alPausa = () => setCorre(false);
    const alAvance = () => setT(v.currentTime);
    const alDur = () => { if (Number.isFinite(v.duration)) setDur(v.duration); };
    v.addEventListener('play', alPlay); v.addEventListener('pause', alPausa); v.addEventListener('ended', alPausa);
    v.addEventListener('timeupdate', alAvance); v.addEventListener('loadedmetadata', alDur);
    alDur(); setCorre(!v.paused && !v.ended);
    return () => {
      v.removeEventListener('play', alPlay); v.removeEventListener('pause', alPausa); v.removeEventListener('ended', alPausa);
      v.removeEventListener('timeupdate', alAvance); v.removeEventListener('loadedmetadata', alDur);
    };
  }, [vidRef, archivo]);
  const alternar = () => { const x = vidRef.current; if (!x) return; if (x.paused || x.ended) void x.play().catch(() => {}); else x.pause(); };
  const ir = (e: MouseEvent<HTMLDivElement>) => {
    const x = vidRef.current; if (!x || !dur) return;
    const r = e.currentTarget.getBoundingClientRect();
    x.currentTime = Math.min(dur, Math.max(0, ((e.clientX - r.left) / r.width) * dur));
  };
  const cambiarVel = () => {
    const sig = VELOCIDADES[(VELOCIDADES.indexOf(vel as (typeof VELOCIDADES)[number]) + 1) % VELOCIDADES.length];
    setVel(sig);
    if (vidRef.current) vidRef.current.playbackRate = sig;
  };
  return (
    <div className="mk-vmom__ctrl">
      <button type="button" className="mk-vmom__btn" onClick={alternar} aria-label={corre ? 'Pausar' : 'Reproducir'}>
        <Icon name={corre ? 'pausa' : 'play'} size={16} />
      </button>
      <span className="mk-vmom__tiempo">{mmss(t)} / {mmss(dur)}</span>
      <div className="mk-vmom__pista" role="progressbar" aria-label="Avance del video" aria-valuemin={0} aria-valuemax={Math.round(dur)} aria-valuenow={Math.round(t)} onClick={ir}>
        <span className="mk-vmom__hecho" style={{ width: `${dur ? Math.min(100, (t / dur) * 100) : 0}%` }} />
      </div>
      <button type="button" className="mk-vmom__vel" onClick={cambiarVel} title="Velocidad">{vel}×</button>
    </div>
  );
}
