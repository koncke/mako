'use client';
// =============================================================================
// LA LLEGADA AL OPS CENTER, EN EL CHAT «ONBOARDING» (20/11/2026, OD-05: la maqueta m-12 y m-13)
// =============================================================================
// Lo acordado (memoria onboarding-16-11-decisiones, :62, :73, :110; la maqueta, b-entra): después de «Entrar a MaKo», en el chat
// «Onboarding» la pantalla se oscurece, MaKo escribe (los tres puntitos) y manda el video del recorrido con «Te doy la bienvenida a
// tu Ops Center, {nombre}. Dale play: te muestro dónde está cada cosa.». El play arranca el recorrido aprobado (el motor, con su
// video al costado: app/_ui/tutorial/MotorTutorial.tsx). Antes, el recorrido arrancaba solo, sin mensaje ni velo.
// Sale sólo mientras la persona NO vio el recorrido (el mismo `tutorial-ops-center` que anota el motor). Mientras está, el motor no
// arranca el recorrido solo (`chatPresentaRecorrido`, ./../_ui/tutorial/store.ts): lo arranca este play.
// El velo va en un PORTAL: el panel vive dentro de los contextos de apilado del layout, y ahí un velo fijo no tapa la lista de chats.
// La fila con MaKo escribiendo se copia encima del velo, en el mismo lugar que la de verdad.
// =============================================================================
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRecorrido } from '@/app/_ui/Recorrido';
import { marcarVistoEnEnsayo, useEnsayo, vistoEnEnsayo } from '@/app/_ui/tutorial/desde-cero';
import { chatPresentaRecorrido, mostrarTutorial } from '@/app/_ui/tutorial/store';
import { useVideoTutorial } from '@/app/_ui/tutorial/useVideoTutorial';
import { useDalePlay } from '@/app/_ui/tutorial/useDalePlay';
import { TUTORIAL_RECORRIDO } from '@/lib/onboarding-v2/recorrido';
import { CriaturaMako } from '@/app/onboarding/CriaturaMako';
import { Icon } from '@/app/_components/icons';
import { ID_RECORRIDO, MS_ESCRIBE_LLEGADA, textoLlegada } from '@/lib/onboarding-v2/llegada';


export function BienvenidaOpsCenter({ nombre }: { nombre: string }) {
  const r = useRecorrido(ID_RECORRIDO, { autoabrir: false });
  // En el ensayo «desde cero» (como lo revisa Martín), lo visto vive en el navegador (app/_ui/tutorial/desde-cero.ts).
  const ensayo = useEnsayo();
  const toca = ensayo.activo ? !vistoEnEnsayo(ID_RECORRIDO) : r.visto === false;
  const alTerminar = ensayo.activo ? () => marcarVistoEnEnsayo(ID_RECORRIDO) : r.onCerrar;
  const [fase, setFase] = useState<'escribe' | 'listo'>('escribe');
  const video = useVideoTutorial('recorrido');
  // Mientras el chat presenta el recorrido, el motor no lo arranca solo.
  useEffect(() => {
    if (!toca) return;
    chatPresentaRecorrido(true);
    return () => chatPresentaRecorrido(false);
  }, [toca]);
  useEffect(() => {
    if (!toca || fase !== 'escribe') return;
    const t = window.setTimeout(() => setFase('listo'), MS_ESCRIBE_LLEGADA);
    return () => window.clearTimeout(t);
  }, [toca, fase]);

  // La fila de MaKo escribiendo, medida para copiarla encima del velo.
  const fila = useRef<HTMLDivElement>(null);
  const [caja, setCaja] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    if (!toca || fase !== 'escribe') return;
    const medir = () => {
      const el = fila.current;
      if (!el) return;
      const b = el.getBoundingClientRect();
      setCaja({ x: b.left, y: b.top, w: b.width, h: b.height });
    };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [toca, fase]);

  // Quieto, «Tu recorrido por MaKo: dale play» (V5; la maqueta, r4-invita). Su play arranca el recorrido, que toma el motor.
  const play = useRef<HTMLButtonElement>(null);
  useDalePlay(play, { clave: 'recorrido', titulo: 'Tu recorrido por MaKo', activo: toca && fase === 'listo' });

  if (!toca) return null;
  const estrella = <span className="sbl-foto" aria-hidden="true"><CriaturaMako size={26} reaccion="escucha" /></span>;
  const puntitos = <span role="status" aria-label="MaKo está escribiendo" className="sbl-escribe"><i /><i /><i /></span>;
  const empezar = () => mostrarTutorial(TUTORIAL_RECORRIDO, { alTerminar });
  return (
    <>
      <style>{CSS}</style>
      {fase === 'escribe' ? (
        <div ref={fila} className="co-el-wa co-wa sbl-fila" data-llegada="escribe">
          <div className="co-el">{estrella}<div className="co-el__cuerpo">{puntitos}</div></div>
        </div>
      ) : (
        <div className="co-el-wa co-wa" data-llegada="mensaje">
          <div className="co-el">{estrella}
            <div className="co-el__cuerpo">
              <div className="ch-md"><p>{textoLlegada(nombre)}</p></div>
              <button ref={play} type="button" className="sbl-video" onClick={empezar} aria-label="Ver el recorrido por MaKo" data-recorrido="sb-llegada-play">
                {video?.poster ? <img src={video.poster} alt="" /> : <span className="sbl-video__vacio" />}
                <span className="sbl-video__play" aria-hidden="true"><Icon name="play" size={28} /></span>
              </button>
            </div>
          </div>
        </div>
      )}
      {fase === 'escribe' && typeof document !== 'undefined' && createPortal(
        <div className="sbl-capa" aria-hidden="true">
          <style>{CSS}</style>
          <div className="sbl-velo" />
          {caja && (
            <div className="sbl-copia" style={{ left: caja.x, top: caja.y, width: caja.w, height: caja.h }}>
              <div className="co-el">{estrella}<div className="co-el__cuerpo">{puntitos}</div></div>
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

// ⚠️ SIN COMILLAS INVERTIDAS ADENTRO (es un template literal: AGENTS.md).
const CSS = `
.sbl-foto { flex: none; display: inline-flex; width: 26px; height: 26px; margin-top: 4px; }
.sbl-escribe { display: inline-flex; align-items: center; gap: 4px; padding: 4px 2px; color: var(--dim); }
.sbl-escribe i { width: 7px; height: 7px; border-radius: 50%; background: currentColor; animation: sbl-escribe 1.2s ease-in-out infinite; }
.sbl-escribe i:nth-child(2) { animation-delay: .15s; }
.sbl-escribe i:nth-child(3) { animation-delay: .3s; }
@keyframes sbl-escribe { 0%, 60%, 100% { opacity: .3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-3px); } }
.sbl-capa { position: fixed; inset: 0; z-index: 650; pointer-events: none; }
.sbl-velo { position: absolute; inset: 0; background: rgba(18, 21, 27, .62); animation: sbl-velo .45s ease both; }
@keyframes sbl-velo { from { opacity: 0; } to { opacity: 1; } }
.sbl-copia { position: fixed; display: flex; align-items: center; }
.sbl-copia .co-el { display: flex; gap: 8px; align-items: flex-start; padding: 6px 12px 6px 8px; border-radius: 999px; background: var(--bg); box-shadow: 0 0 0 2px var(--ink), 0 10px 30px rgba(0, 0, 0, .25); }
.sbl-fila { visibility: visible; }
/* El play abajo a la izquierda: en el centro tapaba el título de la portada («¡Hola de nuevo!»; el Cerebro, 20/11: el play cae sobre
   un espacio vacío). */
.sbl-video { position: relative; display: grid; place-items: end start; padding: 12px; box-sizing: border-box; width: min(400px, 100%); aspect-ratio: 16 / 9; margin-top: 8px; padding: 0; border: 0; border-radius: 12px; overflow: hidden; background: #000; cursor: pointer; }
.sbl-video img, .sbl-video__vacio { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.sbl-video__play { position: relative; z-index: 1; width: 52px; height: 52px; border-radius: 50%; display: grid; place-items: center; background: rgba(0, 0, 0, .55); color: #fff; }
@media (prefers-reduced-motion: reduce) { .sbl-velo, .sbl-escribe i { animation: none; } }
`;
