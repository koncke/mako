'use client';
// =============================================================================
// EL VIDEO EN LA ESQUINA, CON EL REPRODUCTOR DE LA MAQUETA (20/11/2026, la verificación de F2 de los videos)
// =============================================================================
// Un video de un chat que sale de la vista (o el de la lista de videos de un chat, sin su mensaje a la vista) sigue abajo a la
// derecha (./store.ts → reproducirFlotante). Era el `<video controls>` del navegador con una cabecera «Martín · MaKo»; la maqueta
// (C:/dev/artefactos-onboarding/cuerpo.html → `pipHtml`, `.mq-pip`) lo pasa con SU reproductor (el de ./VideoDelMomento.tsx: la
// portada con su play, la barra con play, tiempo, avance y velocidad) y dos botones arriba a la derecha: «Agrandar/Achicar» (⤢/⤡) y
// la X. Chico (230 px) mientras está quieto, grande (380 px) mientras corre; el botón lo fija a mano.
// =============================================================================
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/app/_components/icons';
import { Z_PISO_RECORRIDO } from '@/lib/recorridos';
import { anotarTiempoFlotante, terminar, type Senal } from './store';
import { useVideoTutorial } from './useVideoTutorial';
import { CSS_REPRODUCTOR } from './VideoDelMomento';

const VELOCIDADES = [1, 1.25, 1.5, 2] as const;
const mmss = (s: number) => { const t = Math.max(0, Math.round(s || 0)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

/** ¿Chico? El que fijó la persona con el botón; si no, chico mientras no corre (la maqueta, `pipHtml`). */
export const pipChico = (manual: 'chico' | 'grande' | null, corre: boolean): boolean => (manual ? manual === 'chico' : !corre);

export function VideoEnLaEsquina({ senal }: { senal: Extract<Senal, { tipo: 'video' }> }) {
  const v = useVideoTutorial(senal.clave);
  const ref = useRef<HTMLVideoElement>(null);
  const [corre, setCorre] = useState(false);
  const [t, setT] = useState(senal.desde);
  const [durLeida, setDur] = useState(0);
  const [vel, setVel] = useState<number>(1);
  const [manual, setManual] = useState<'chico' | 'grande' | null>(null);
  const dur = durLeida || v?.duracion_s || 0;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const arrancar = () => { try { el.currentTime = senal.desde; } catch { /* */ } el.play().catch(() => { el.muted = true; el.play().catch(() => {}); }); };
    if (el.readyState >= 1) arrancar(); else el.addEventListener('loadedmetadata', arrancar, { once: true });
  }, [v?.archivo, senal.desde]);
  // EL HILO LE DEJA LUGAR (20/11, la auditoría de chats, videos-6): en el teléfono el video ocupa todo el ancho abajo y tapaba los últimos
  // mensajes. Mientras flota, su alto queda en <html> (`--alto-esquina`) y el hilo suma ese aire abajo (el CSS de abajo, < 640 px).
  const raizPip = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = raizPip.current;
    const html = document.documentElement;
    if (!el) return;
    const medir = () => html.style.setProperty('--alto-esquina', `${Math.round(el.getBoundingClientRect().height)}px`);
    html.setAttribute('data-video-esquina', '');
    medir();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
    ro?.observe(el);
    return () => { ro?.disconnect(); html.removeAttribute('data-video-esquina'); html.style.removeProperty('--alto-esquina'); };
  }, [v]);
  if (!v || typeof document === 'undefined') return null;
  const chico = pipChico(manual, corre);
  const alternar = () => { const x = ref.current; if (!x) return; if (x.paused || x.ended) void x.play().catch(() => {}); else x.pause(); };
  const ir = (e: MouseEvent<HTMLDivElement>) => {
    const x = ref.current; if (!x || !dur) return;
    const r = e.currentTarget.getBoundingClientRect();
    x.currentTime = Math.min(dur, Math.max(0, ((e.clientX - r.left) / r.width) * dur));
  };
  const cambiarVel = () => {
    const sig = VELOCIDADES[(VELOCIDADES.indexOf(vel as (typeof VELOCIDADES)[number]) + 1) % VELOCIDADES.length];
    setVel(sig);
    if (ref.current) ref.current.playbackRate = sig;
  };
  return createPortal(
    <div ref={raizPip} className="mk-pip" data-chico={chico ? '' : undefined} role="complementary" aria-label={`El video: ${senal.titulo}`} style={{ zIndex: Z_PISO_RECORRIDO }}>
      <style>{CSS_REPRODUCTOR}{CSS}</style>
      <div className="mk-vmom" data-clave={senal.clave} data-estado={corre ? 'reproduciendo' : 'pausado'}>
        <div className="mk-vmom__pantalla" onClick={alternar}>
          <video ref={ref} className="mk-vmom__video" src={v.archivo} poster={v.poster} playsInline preload="metadata"
            onPlay={() => setCorre(true)} onPause={() => setCorre(false)} onEnded={() => terminar(senal.id, 'fin')}
            onTimeUpdate={(e) => { setT(e.currentTarget.currentTime); anotarTiempoFlotante(e.currentTarget.currentTime); }}
            onLoadedMetadata={(e) => { if (Number.isFinite(e.currentTarget.duration)) setDur(e.currentTarget.duration); }} />
          {!corre && (
            <button type="button" className="mk-vmom__play" onClick={(e) => { e.stopPropagation(); alternar(); }} aria-label={`Reproducir: ${senal.titulo}`}>
              <Icon name="play" size={chico ? 20 : 28} />
            </button>
          )}
        </div>
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
      </div>
      <div className="mk-pip__btns">
        <button type="button" className="mk-pip__btn" onClick={() => setManual(chico ? 'grande' : 'chico')}
          aria-label={chico ? 'Agrandar el video' : 'Achicar el video'} title={chico ? 'Agrandar' : 'Achicar'}>{chico ? '⤢' : '⤡'}</button>
        <button type="button" className="mk-pip__btn" onClick={() => terminar(senal.id, 'omitido')} aria-label="Cerrar el video" title="Cerrar el video">
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
        </button>
      </div>
    </div>,
    document.body,
  );
}

// ⚠️ SIN COMILLAS INVERTIDAS ADENTRO (es un template literal: AGENTS.md). La maqueta, `.mq-pip`.
const CSS = `
.mk-pip { position: fixed; right: max(16px, env(safe-area-inset-right, 0px)); bottom: max(16px, env(safe-area-inset-bottom, 0px)); width: 380px; max-width: calc(100vw - 32px); border-radius: 14px; overflow: hidden; box-shadow: 0 18px 44px rgba(0,0,0,.45); transition: width .35s cubic-bezier(.16,.84,.34,1); }
.mk-pip[data-chico] { width: 230px; }
.mk-pip .mk-vmom { width: 100%; margin: 0; border-radius: 0; box-shadow: none; }
.mk-pip[data-chico] .mk-vmom__vel, .mk-pip[data-chico] .mk-vmom__tiempo { display: none; }
.mk-pip[data-chico] .mk-vmom__play { width: 44px; height: 44px; }
.mk-pip__btns { position: absolute; top: 8px; right: 8px; z-index: 2; display: flex; gap: 6px; }
.mk-pip__btn { width: 28px; height: 28px; border-radius: 8px; border: 0; background: rgba(0,0,0,.5); color: #fff; display: grid; place-items: center; cursor: pointer; font-size: 14px; line-height: 1; }
.mk-pip__btn:hover { background: rgba(0,0,0,.7); }
.mk-pip__btn:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
@media (max-width: 640px) { .mk-pip { right: 10px; bottom: 10px; width: calc(100% - 20px); } .mk-pip[data-chico] { width: 190px; }
  html[data-video-esquina] .co-hilo, html[data-video-esquina] .m-operaciones-hilo { padding-bottom: calc(var(--alto-esquina, 0px) + 16px); } }
@media (prefers-reduced-motion: reduce) { .mk-pip { transition: none; } }
`;
