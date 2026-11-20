'use client';
// =============================================================================
// EL VIDEO DE UN MOMENTO DEL ONBOARDING (18/11/2026)
// =============================================================================
// Martín pidió videos del estilo de los tutoriales (el Martín en cubos, su voz) para cada momento del onboarding y cada día del
// reto. Los hace el chat «Tutoriales animados con voz» en public/tutoriales/<clave>.mp4, con su línea en el manifiesto
// (lib/tutoriales/videos.ts). Las claves de los momentos, acordadas con ese chat:
//   onboarding-bienvenida (el primer mensaje del chat de bienvenida), onboarding-whatsapp (escribirle a MaKo con el código),
//   onboarding-seguir-pc (el teléfono: «Sigamos en tu computadora»), offer-coach y funnel-coach (la entrada a cada coach).
// Sin video para esa clave, NADA (nunca otro en su lugar). En la revisión de Martín, su lugar marcado: así ve dónde va.
//
// EL REPRODUCTOR DE LA MAQUETA (19/11/2026). Martín, probándolo en producción: «se ve mal el recuadro del video. Evidentemente no
// debería verse así». Era el `<video controls>` del navegador con un ancho en porcentaje: el globo del chat tomaba el ancho natural
// del video (1920) y quedaba ENORME, con el video a la izquierda y un hueco; al terminar quedaba el último cuadro con los controles
// encima. Ahora es el de la maqueta (C:/dev/artefactos-onboarding/cuerpo.html → `reproductor`): un ancho FIJO (así el globo mide lo
// que el video), la portada con el botón de play grande, su barra (play, tiempo, avance, velocidad) y, al terminar, otra vez la
// portada con su play. La portada de verdad ya trae su título: la maqueta le escribía «Martín · MaKo» y el título encima porque la
// suya era un fondo liso, y sobre la de verdad no se leían.
// =============================================================================
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Icon } from '@/app/_components/icons';
import { useManifiestoListo, useVideoTutorial } from './useVideoTutorial';
import { senalarDondeTocar, soltarSenal, useSenal, type MotivoFin } from './store';
import { BANDERA_FLOTA, pausaPorFlotar, useVideoQueFlota } from './useVideoQueFlota';
import { fraseEnElTiempo, type FraseVideo } from '@/lib/tutoriales/videos';
import { useDalePlay } from './useDalePlay';
import { cerrarDalePlay } from './entrada';

type Estado = 'quieto' | 'reproduciendo' | 'pausado' | 'terminado';
const VELOCIDADES = [1, 1.25, 1.5, 2] as const;
const mmss = (s: number) => { const t = Math.max(0, Math.round(s || 0)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
const conMayuscula = (s: string) => (s ? s.charAt(0).toLocaleUpperCase('es') + s.slice(1) : s);

/**
 * `onTermina`: cuando el video llegó al final (el onboarding V2 suelta ahí su primera pregunta); `onPausa`, cuando la persona lo pausa
 * (20/11, la verificación de OA-02: también la suelta); `onEmpieza`, cuando arranca. `dalePlay`: mientras está quieto, el
 * motor lo marca con «{título}: dale play» (V5, ./useDalePlay.ts): el video con el que abre un chat (los coaches, el reto, la bienvenida).
 * LO QUE AVISA PARA LOS CHATS (20/11, la auditoría de chats, videos-1, 3 y 5; las piezas compartidas):
 *   · `onPausa` sólo con una pausa de la persona: pasar a la esquina no cuenta (`pausaPorFlotar`, ./useVideoQueFlota.ts);
 *   · `onTiempo(t)` en cada avance, `onError()` si el archivo no carga;
 *   · `onFrase(f)` al empezar cada frase del manifiesto (para que un mensaje salga cuando la voz llega ahí), y con `marcarFrases`, la
 *     frase que tiene lugar (`sel`) se marca mientras suena, sin tapar nada (se suelta en la frase siguiente);
 *   · mientras llega el manifiesto, su recuadro (16:9 y la barra) queda RESERVADO: antes no dibujaba nada y después unos 270 px, con el
 *     chat ya bajado.
 * El fin en la esquina lo avisa `onTerminaFuera` (no `onTermina`: el reto pasa el mismo manejador a los dos).
 */
export function VideoDelMomento({ clave, titulo, revision, onTermina, onPausa, onEmpieza, onTerminaFuera, onTiempo, onError, onFrase, marcarFrases = false, dalePlay = false }: {
  clave: string; titulo: string; revision: boolean; onTermina?: () => void; onPausa?: () => void; onEmpieza?: () => void; dalePlay?: boolean;
  /** Terminó (o lo cerraron con su X) en la esquina, después de salir de la vista (20/11, D1-03: el reto del día 1). */
  onTerminaFuera?: (m: MotivoFin) => void;
  onTiempo?: (t: number) => void;
  onError?: () => void;
  onFrase?: (f: FraseVideo) => void;
  marcarFrases?: boolean;
}) {
  const v = useVideoTutorial(clave);
  const listo = useManifiestoListo();
  const senal = useSenal();
  const flotando = senal?.tipo === 'video' && senal.clave === clave;
  const ref = useRef<HTMLVideoElement>(null);
  // Si sale de la vista corriendo (o se navega), sigue abajo a la derecha (Martín, 18/11).
  useVideoQueFlota(ref, v ? clave : null, titulo, onTerminaFuera);
  const [estado, setEstado] = useState<Estado>('quieto');
  const [t, setT] = useState(0);
  // La duración: la del archivo cuando la lee el navegador; hasta entonces, la del manifiesto (nunca «0:00»).
  const [durLeida, setDur] = useState(0);
  const [vel, setVel] = useState<number>(1);
  const dur = durLeida || v?.duracion_s || 0;
  const raiz = useRef<HTMLDivElement>(null);
  useDalePlay(raiz, { clave, titulo, activo: dalePlay && !!v && estado === 'quieto' && !flotando });
  // La frase que suena, y la marca de la que tiene lugar (videos-5).
  const fraseAhora = useRef<string | null>(null);
  const marca = useRef(0);
  const soltarMarca = () => { if (marca.current) { soltarSenal(marca.current); marca.current = 0; } };
  useEffect(() => () => { if (marca.current) soltarSenal(marca.current); }, []);
  const alTiempo = (tt: number) => {
    setT(tt);
    onTiempo?.(tt);
    const f = fraseEnElTiempo(v?.frases ?? [], tt);
    if ((f?.id ?? null) === fraseAhora.current) return;
    fraseAhora.current = f?.id ?? null;
    soltarMarca();
    if (!f) return;
    onFrase?.(f);
    if (marcarFrases && f.sel && typeof document !== 'undefined' && document.querySelector(f.sel)) {
      const fuera = () => { marca.current = 0; };
      marca.current = senalarDondeTocar({ sel: f.sel, titulo, texto: f.texto, haz: '' }, fuera, { alOmitir: fuera, libre: true });
    }
  };

  // Mientras llega el manifiesto, su lugar reservado (videos-3); leído, la placa en la revisión (F1) o nada.
  if (!v) {
    if (!listo) return <><style>{CSS}</style><div className="mk-vmom mk-vmom--reserva" data-clave={clave} aria-hidden="true" /></>;
    return revision
      ? <><style>{CSS}</style><div className="mk-vmom mk-vmom--lugar" data-clave={clave} role="note"><b>Tu video: {titulo}</b><span>Todavía no está grabado: va aquí.</span></div></>
      : null;
  }
  const video = () => ref.current;
  const reproducir = () => { const x = video(); if (!x) return; if (x.ended) x.currentTime = 0; void x.play().catch(() => {}); };
  const alternar = () => { const x = video(); if (!x) return; if (x.paused || x.ended) reproducir(); else x.pause(); };
  const ir = (e: MouseEvent<HTMLDivElement>) => {
    const x = video(); if (!x || !dur) return;
    const r = e.currentTarget.getBoundingClientRect();
    x.currentTime = Math.min(dur, Math.max(0, ((e.clientX - r.left) / r.width) * dur));
  };
  const cambiarVel = () => {
    const sig = VELOCIDADES[(VELOCIDADES.indexOf(vel as (typeof VELOCIDADES)[number]) + 1) % VELOCIDADES.length];
    setVel(sig);
    const x = video(); if (x) x.playbackRate = sig;
  };
  const corre = estado === 'reproduciendo';
  const terminado = estado === 'terminado';
  return (
    <div ref={raiz} className="mk-vmom" data-clave={clave} data-estado={estado}>
      <style>{CSS}</style>
      <div className={`mk-vmom__pantalla${v.play === 'abajo-derecha' ? ' mk-vmom__pantalla--abajo-derecha' : ''}`} onClick={alternar}>
        <video ref={ref} className="mk-vmom__video" src={v.archivo} poster={v.poster} playsInline preload="metadata"
          onPlay={(e) => { delete e.currentTarget.dataset[BANDERA_FLOTA]; setEstado('reproduciendo'); if (dalePlay) cerrarDalePlay(clave); onEmpieza?.(); }}
          onPause={(e) => { if (e.currentTarget.ended) return; setEstado('pausado'); soltarMarca(); if (!pausaPorFlotar(e.currentTarget)) onPausa?.(); }}
          onEnded={() => { setEstado('terminado'); soltarMarca(); onTermina?.(); }} onTimeUpdate={(e) => alTiempo(e.currentTarget.currentTime)}
          onError={() => onError?.()}
          onLoadedMetadata={(e) => { if (Number.isFinite(e.currentTarget.duration)) setDur(e.currentTarget.duration); }} />
        {/* Mientras flota abajo a la derecha, su lugar lo dice (20/11, F2): vuelve solo cuando el mensaje se ve otra vez. */}
        {flotando && <span className="mk-vmom__esquina" role="status">Se está viendo en la esquina ↘</span>}
        {/* Al terminar, otra vez la portada: nunca el último cuadro con los controles encima. */}
        {terminado && v.poster && <img className="mk-vmom__portada" src={v.poster} alt="" />}
        {/* La portada de verdad ya trae su título (el personaje y «¡Hola! Soy Martín…»): encima, sólo el play. */}
        {!corre && (
          <button type="button" className="mk-vmom__play" onClick={(e) => { e.stopPropagation(); reproducir(); }}
            aria-label={terminado ? `Ver otra vez: ${titulo}` : `Reproducir: ${titulo}`} title={terminado ? 'Ver otra vez' : conMayuscula(titulo)}>
            <Icon name="play" size={28} />
          </button>
        )}
      </div>
      <div className="mk-vmom__ctrl">
        <button type="button" className="mk-vmom__btn" onClick={alternar} aria-label={corre ? 'Pausar' : 'Reproducir'}>
          <Icon name={corre ? 'pausa' : 'play'} size={16} />
        </button>
        <span className="mk-vmom__tiempo">{mmss(terminado ? dur : t)} / {mmss(dur)}</span>
        <div className="mk-vmom__pista" role="progressbar" aria-label="Avance del video" aria-valuemin={0} aria-valuemax={Math.round(dur)} aria-valuenow={Math.round(t)} onClick={ir}>
          <span className="mk-vmom__hecho" style={{ width: `${dur ? Math.min(100, ((terminado ? dur : t) / dur) * 100) : 0}%` }} />
        </div>
        <button type="button" className="mk-vmom__vel" onClick={cambiarVel} title="Velocidad">{vel}×</button>
      </div>
    </div>
  );
}

// ⚠️ SIN COMILLAS INVERTIDAS ADENTRO (es un template literal: AGENTS.md). El reproductor, el de la maqueta (`.mq-video`). Lo usa
// también el video de la esquina (./VideoEnLaEsquina.tsx).
const CSS = `
.mk-vmom { width: 400px; max-width: 100%; box-sizing: border-box; border-radius: 14px; overflow: hidden; background: #0E1219; color: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.12); margin: 2px 0 4px; }
.mk-vmom__pantalla { position: relative; aspect-ratio: 16 / 9; display: grid; place-items: center; background: #000; overflow: hidden; cursor: pointer; }
.mk-vmom__esquina { position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%); z-index: 3; padding: 6px 12px; border-radius: 999px; background: rgba(0,0,0,.72); color: #fff; font-size: 13px; font-weight: 600; white-space: nowrap; pointer-events: none; }
/* El play en otra esquina de la portada, cuando el centro no está vacío (lo dice el campo play del manifiesto). */
.mk-vmom__pantalla--abajo-derecha { place-items: end end; padding: 12px; box-sizing: border-box; }
.mk-vmom__video, .mk-vmom__portada { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; display: block; background: #000; }
.mk-vmom__play { position: relative; z-index: 1; width: 64px; height: 64px; border-radius: 50%; border: 0; background: rgba(0,0,0,.45); color: #fff; display: grid; place-items: center; cursor: pointer; transition: transform .15s ease, background .15s ease; }
.mk-vmom__play:hover { background: rgba(0,0,0,.6); transform: scale(1.04); }
.mk-vmom__ctrl { display: flex; align-items: center; gap: 8px; padding: 7px 10px; background: #151A24; }
.mk-vmom__btn { width: 30px; height: 30px; flex: none; border-radius: 8px; border: 0; background: transparent; color: #fff; display: grid; place-items: center; cursor: pointer; }
.mk-vmom__btn:hover { background: rgba(255,255,255,.1); }
.mk-vmom__tiempo { flex: none; font: 600 12px/1 'Geist', system-ui, sans-serif; font-variant-numeric: tabular-nums; color: rgba(255,255,255,.82); white-space: nowrap; }
.mk-vmom__pista { position: relative; flex: 1; min-width: 40px; height: 6px; border-radius: 999px; background: rgba(255,255,255,.2); cursor: pointer; }
.mk-vmom__hecho { position: absolute; left: 0; top: 0; bottom: 0; border-radius: inherit; background: #2F6FED; }
.mk-vmom__vel { flex: none; font: 700 11px/1 'Geist', system-ui, sans-serif; color: #fff; background: rgba(255,255,255,.12); border: 0; border-radius: 6px; padding: 6px 7px; cursor: pointer; }
.mk-vmom :focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
/* Reservado mientras llega el manifiesto: el mismo alto que el reproductor (16:9 y su barra). */
.mk-vmom--reserva::before { content: ''; display: block; aspect-ratio: 16 / 9; background: #000; }
.mk-vmom--reserva::after { content: ''; display: block; height: 44px; background: #151A24; }
.mk-vmom--lugar { background: var(--surface); color: var(--ink); border: 1.5px dashed var(--border-strong); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; text-align: center; padding: 10px; aspect-ratio: 16 / 9; }
.mk-vmom--lugar b { font-size: var(--fs-sm); color: var(--ink); }
.mk-vmom--lugar span { font-size: var(--fs-meta); color: var(--dim); }
@media (prefers-reduced-motion: reduce) { .mk-vmom__play { transition: none; } }
`;

export const CSS_REPRODUCTOR = CSS;
