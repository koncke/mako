'use client';
// =============================================================================
// LA LLEGADA AL OPS CENTER: EL PRIMER MENSAJE DEL CHAT «RETO DE 7 DÍAS» (20/11/2026)
// =============================================================================
// Martín, en producción (memoria onboarding-16-11-decisiones, «20/11, ~13:00 UTC»): al «Entrar a MaKo» el Ops Center abre con el chat
// «Reto de 7 días» ya elegido, y la llegada es SIEMPRE su primer mensaje (antes vivía en un chat «Onboarding» aparte). Es esta pieza:
// la pantalla se oscurece, MaKo escribe (los tres puntitos) y manda el video del recorrido general con «Te doy la bienvenida a tu Ops
// Center, {nombre}. Dale play: te muestro dónde está cada cosa.». Su play arranca el recorrido (el motor, con su video al costado:
// app/_ui/tutorial/MotorTutorial.tsx), con su «dale play» mientras el video se ve. Lo de después (el video del reto y sus mensajes,
// uno por uno) lo pone el chat del reto (app/second-brain/reto/ChatDelReto.tsx), que la monta así:
//
//     <LlegadaAlReto nombre={nombre} listo={hiloCargado} onMostrada={() => …sigue el reto…} />
//
// · El mensaje está SIEMPRE (también con el recorrido visto: su play lo vuelve a mostrar).
// · El velo y los puntitos, sólo la PRIMERA vez de la persona (lo recuerda por persona en este navegador, con la huella de
//   /api/recorridos; ops-center-3 de la auditoría: al recargar o al volver ya no se repiten) y mientras no vio el recorrido.
// · Arranca con el hilo ya cargado (`listo`) y mide su lugar de nuevo cuando el hilo cambia o se mueve (ops-center-2).
// · Los puntitos duran lo de la cola de salida (`msEscribiendo`, app/_chat/useColaDeSalida.ts), no 1,8 s fijos.
// · La barra lateral, oculta mientras no vio el recorrido (la saca «Tu panel»); el motor no arranca el recorrido solo mientras está
//   (`chatPresentaRecorrido`).
// El velo va en un PORTAL: el panel vive dentro de los contextos de apilado del layout, y ahí un velo fijo no tapa la lista de chats.
// =============================================================================
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRecorrido } from '@/app/_ui/Recorrido';
import { marcarVistoEnEnsayo, useEnsayo, vistoEnEnsayo } from '@/app/_ui/tutorial/desde-cero';
import { chatPresentaRecorrido, mostrarTutorial, senalAhora, terminar, useSenal } from '@/app/_ui/tutorial/store';
import { CSS_REPRODUCTOR } from '@/app/_ui/tutorial/VideoDelMomento';
import { esconderLaBarra, mostrarLaBarra } from '@/app/_ui/tutorial/barra-oculta';
import { avisarMensajeNuevo } from '@/app/_chat/useBajarAlUltimo';
import { msEscribiendo } from '@/app/_chat/useColaDeSalida';
import { barrer } from '@/app/_ui/tutorial/iris';
import { useVideoTutorial } from '@/app/_ui/tutorial/useVideoTutorial';
import { useDalePlay } from '@/app/_ui/tutorial/useDalePlay';
import { videoDibujado } from '@/app/_ui/tutorial/entrada';
import { TUTORIAL_RECORRIDO } from '@/lib/onboarding-v2/recorrido';
import { Muneco } from '@/app/admin/operaciones/Muneco';
import { ASPECTO_RETO } from '@/lib/centro-munecos';
import { Icon } from '@/app/_components/icons';
import { Markdown } from '@/app/_components/Markdown';
import { ID_RECORRIDO, textoLlegada } from '@/lib/onboarding-v2/llegada';

const menosMovimiento = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** El lugar del video del recorrido en este mensaje: el motor lo dibuja ahí mientras se ve (app/_ui/tutorial/lugarDelVideo.ts). */
export const LUGAR_VIDEO_LLEGADA = '[data-video-lugar="recorrido"]';
const mmss = (s: number) => { const t = Math.max(0, Math.round(s || 0)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

/**
 * YA SE MOSTRÓ (ops-center-3): por persona, en este navegador (`quien`, la huella que manda /api/recorridos), y en el módulo para lo que
 * dure la página aunque el servidor no conteste (la segunda verificación de OD-05: al volver del Second Brain se redibujaba el velo en
 * medio del recorrido).
 */
let llegadaEscrita = false;
const claveMostrada = (quien: string | null) => (quien ? `mk-llegada-mostrada:${quien}` : null);
const yaMostrada = (quien: string | null): boolean => {
  if (llegadaEscrita) return true;
  const k = claveMostrada(quien);
  try { return !!k && typeof localStorage !== 'undefined' && localStorage.getItem(k) === '1'; } catch { return false; }
};
const anotarMostrada = (quien: string | null): void => {
  llegadaEscrita = true;
  const k = claveMostrada(quien);
  try { if (k) localStorage.setItem(k, '1'); } catch { /* sin storage: queda la página */ }
};

export function LlegadaAlReto({ nombre, listo = true, onMostrada }: {
  nombre: string;
  /** El hilo del reto ya se cargó y bajó: recién ahí se mide y se oscurece (ops-center-2). */
  listo?: boolean;
  /** El mensaje ya está a la vista (después de los puntitos, o enseguida): el reto sigue con lo suyo. */
  onMostrada?: () => void;
}) {
  const r = useRecorrido(ID_RECORRIDO, { autoabrir: false });
  // En el ensayo «desde cero» (como lo revisa Martín), lo visto vive en el navegador (app/_ui/tutorial/desde-cero.ts).
  const ensayo = useEnsayo();
  const toca = ensayo.activo ? !vistoEnEnsayo(ID_RECORRIDO) : r.visto === false;
  const sabe = ensayo.activo || r.visto !== null;
  const alTerminar = ensayo.activo ? () => marcarVistoEnEnsayo(ID_RECORRIDO) : r.onCerrar;
  // 'espera': todavía no se sabe (el recorrido o el hilo); 'escribe': el velo y los puntitos; 'listo': el mensaje.
  const [fase, setFase] = useState<'espera' | 'escribe' | 'listo'>(() => (llegadaEscrita || senalAhora() ? 'listo' : 'espera'));
  useEffect(() => {
    if (fase !== 'espera' || !sabe || !listo) return;
    // Ya la vio (o vio el recorrido, o hay un tutorial andando): de una, sin velo.
    setFase(toca && !yaMostrada(r.quien) && !senalAhora() ? 'escribe' : 'listo');
  }, [fase, sabe, listo, toca, r.quien]);
  useEffect(() => {
    if (fase !== 'escribe') return;
    const t = window.setTimeout(() => setFase('listo'), msEscribiendo(textoLlegada(nombre)));
    return () => window.clearTimeout(t);
  }, [fase, nombre]);
  const avisada = useRef(false);
  useEffect(() => {
    if (fase !== 'listo' || avisada.current) return;
    avisada.current = true;
    if (toca) anotarMostrada(r.quien);
    onMostrada?.();
  }, [fase, toca, r.quien, onMostrada]);
  const video = useVideoTutorial('recorrido');
  // LA BARRA, OCULTA MIENTRAS EL RECORRIDO NO SE VIO (OD-03): al recargar la esconde el servidor (app/layout.tsx); esto, al volver por
  // dentro de la app. Nunca con un tutorial andando: el recorrido ya la mostró en «Tu panel».
  useLayoutEffect(() => { if (toca && !senalAhora()) esconderLaBarra(); }, [toca]);
  // Mientras el chat presenta el recorrido, el motor no lo arranca solo.
  useEffect(() => {
    if (!toca) return;
    chatPresentaRecorrido(true);
    return () => chatPresentaRecorrido(false);
  }, [toca]);

  // La fila de MaKo escribiendo, medida para copiarla encima del velo. Se vuelve a medir cuando el hilo cambia de alto o se mueve
  // (ops-center-2: medida con el hilo vacío, la copia quedaba arriba, sobre mensajes viejos, y la fila de verdad abajo y oscura).
  const fila = useRef<HTMLDivElement>(null);
  const [caja, setCaja] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    if (fase !== 'escribe') return;
    const medir = () => {
      const el = fila.current;
      if (!el) return;
      const b = el.getBoundingClientRect();
      setCaja((c) => (c && c.x === b.left && c.y === b.top && c.w === b.width && c.h === b.height ? c : { x: b.left, y: b.top, w: b.width, h: b.height }));
    };
    medir();
    const hiloDe = fila.current?.closest('.co-hilo') ?? null;
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
    if (hiloDe) { ro?.observe(hiloDe); for (const c of Array.from(hiloDe.children)) ro?.observe(c); }
    // Cualquier scroll (21/11, producción: el hueco quedaba arriba a la izquierda): el que mueve el hilo puede ser otro contenedor.
    document.addEventListener('scroll', medir, { capture: true, passive: true });
    window.addEventListener('resize', medir);
    return () => { ro?.disconnect(); document.removeEventListener('scroll', medir, { capture: true }); window.removeEventListener('resize', medir); };
  }, [fase]);

  // EL VELO ENTRA CON EL BARRIDO (OD-F2: la maqueta, b-entra pasa por `iris()`). El velo es la sombra de un hueco con la forma de la
  // píldora de MaKo escribiendo (la copia de arriba del velo), como el del motor; `barrer` lo cierra hacia ella en 720 ms. Medido sobre
  // la PÍLDORA y no sobre la fila: la fila se estira al ancho del chat y dejaba una franja clara de 712 px arriba.
  const hueco = useRef<HTMLDivElement>(null);
  const pildora = useRef<HTMLDivElement>(null);
  const [hc, setHc] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = pildora.current;
    if (!caja || !el) { setHc(null); return; }
    const b = el.getBoundingClientRect();
    setHc({ x: b.left, y: b.top, w: b.width, h: b.height });
  }, [caja]);
  const hayHueco = hc != null;
  useLayoutEffect(() => {
    const nodo = hueco.current;
    if (!hayHueco || !nodo || menosMovimiento()) return;
    return barrer(nodo);
  }, [hayHueco]);

  // Los puntitos y el mensaje son mensajes NUEVOS del chat: lo bajan al último (app/_chat/useBajarAlUltimo.ts).
  useEffect(() => { if (fase !== 'espera') avisarMensajeNuevo(); }, [fase]);

  // Quieto, «Tu recorrido por MaKo: dale play» (V5; la maqueta, r4-invita). Su play arranca el recorrido, que toma el motor.
  // RECIÉN CON EL VIDEO DIBUJADO (20/11/2026, el Cerebro en producción): con el arranque en frío la tarjeta salía sobre el cuadro
  // vacío, con el manifiesto o el póster en camino. Espera a que SU póster cargue (entrada.ts → videoDibujado).
  const play = useRef<HTMLDivElement>(null);
  const poster = video?.poster ?? null;
  const [posterCargado, setPosterCargado] = useState<string | null>(null);
  const imgPoster = useRef<HTMLImageElement>(null);
  // Un póster en la caché del navegador puede cargar antes de que React escuche el `load`: se mira al dibujarlo.
  useLayoutEffect(() => {
    const el = imgPoster.current;
    if (poster && el?.complete && el.naturalWidth > 0) setPosterCargado(poster);
  }, [poster, fase]);
  // Su X (20/11/2026, el inventario de botones): cerraba la invitación para siempre y el reto quedaba FRENADO, con el recorrido sin ver y
  // la barra escondida. Ahora es «Omitir recorrido»: queda visto y la barra vuelve.
  useDalePlay(play, { clave: 'recorrido', titulo: 'Tu recorrido por MaKo', activo: toca && fase === 'listo' && videoDibujado({ poster, posterCargado }),
    alCerrar: () => { mostrarLaBarra(); alTerminar('omitido'); } });
  // ¿Corre el recorrido? Mientras corre, su video lo dibuja el motor ENCIMA de este lugar (o en la esquina, si el mensaje no se ve).
  const senal = useSenal();
  const corre = senal?.tipo === 'tutorial' && senal.tutorial === TUTORIAL_RECORRIDO;

  if (fase === 'espera') return null;
  // El avatar del reto, no la criatura (20/11, la llamada con Leila: la criatura queda sólo para el Ops Center).
  const estrella = <span className="sbl-foto" aria-hidden="true"><Muneco titulo="MaKo" aspecto={ASPECTO_RETO} animo="despierto" size={26} /></span>;
  const puntitos = <span role="status" aria-label="MaKo está escribiendo" className="sbl-escribe"><i /><i /><i /></span>;
  // EN EL CHAT (20/11/2026, Martín: «debería haberse reproducido directamente ahí en el chat»): con su `lugar`, el motor dibuja el
  // video del recorrido encima del reproductor de este mensaje mientras se ve, y en la esquina sólo si el mensaje sale de la vista o se
  // cambia de pantalla (el recorrido lleva a Second Brain); al volver, vuelve aquí. Sin `lugar` iba a la esquina siempre.
  const empezar = () => mostrarTutorial(TUTORIAL_RECORRIDO, { alTerminar, lugar: LUGAR_VIDEO_LLEGADA });
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
              {/* El video ARRIBA y el texto debajo (F4: en la maqueta es un mensaje de video, onboarding.html b-entra). Es el reproductor
                  ENTERO (pantalla y barra, como el del día del reto): el lugar que el motor tapa con el video mientras corre. */}
              <div ref={play} className="mk-vmom sbl-vlugar" data-video-lugar="recorrido" data-recorrido="sb-llegada-play" data-estado={corre ? 'reproduciendo' : 'quieto'}>
                <style>{CSS_REPRODUCTOR}</style>
                {/* El play abajo a la derecha: en el centro tapaba el título de la portada («¡Hola de nuevo!»). */}
                <div className="mk-vmom__pantalla mk-vmom__pantalla--abajo-derecha" onClick={corre ? undefined : empezar}>
                  {poster ? <img ref={imgPoster} className="mk-vmom__portada" src={poster} alt="" onLoad={() => setPosterCargado(poster)} /> : <span className="sbl-video__vacio" />}
                  {!corre && (
                    <button type="button" className="mk-vmom__play" onClick={(e) => { e.stopPropagation(); empezar(); }} aria-label="Ver el recorrido por MaKo" title="Ver el recorrido por MaKo">
                      <Icon name="play" size={28} />
                    </button>
                  )}
                </div>
                <div className="mk-vmom__ctrl">
                  <button type="button" className="mk-vmom__btn" onClick={empezar} disabled={corre} aria-label="Reproducir"><Icon name="play" size={16} /></button>
                  <span className="mk-vmom__tiempo">0:00 / {mmss(video?.duracion_s ?? 0)}</span>
                  <div className="mk-vmom__pista" aria-hidden><span className="mk-vmom__hecho" style={{ width: 0 }} /></div>
                  <button type="button" className="mk-vmom__vel" disabled title="Velocidad">1×</button>
                </div>
              </div>
              {/* Con el video en el mensaje, el motor no muestra «Omitir recorrido» entre paso y paso (sólo en la esquina): va aquí. */}
              {corre && senal && <button type="button" className="sbl-omitir" onClick={() => terminar(senal.id, 'omitido')}>Omitir recorrido</button>}
              <div className="ch-md"><Markdown text={textoLlegada(nombre)} /></div>
            </div>
          </div>
        </div>
      )}
      {fase === 'escribe' && typeof document !== 'undefined' && createPortal(
        <div className="sbl-capa" aria-hidden="true">
          <style>{CSS}</style>
          {caja && (
            <>
              {hc && <div ref={hueco} className="sbl-velo" style={{ left: hc.x, top: hc.y, width: hc.w, height: hc.h }} />}
              <div className="sbl-copia" style={{ left: caja.x, top: caja.y, width: caja.w, height: caja.h }}>
                <div ref={pildora} className="co-el">{estrella}<div className="co-el__cuerpo">{puntitos}</div></div>
              </div>
            </>
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
.sbl-velo { position: fixed; border-radius: 999px; box-shadow: 0 0 0 200vmax rgba(18, 21, 27, .62); pointer-events: none; }
.sbl-copia { position: fixed; display: flex; align-items: center; }
.sbl-copia .co-el { display: flex; gap: 8px; align-items: flex-start; padding: 6px 12px 6px 8px; border-radius: 999px; background: var(--bg); box-shadow: 0 0 0 2px var(--ink), 0 10px 30px rgba(0, 0, 0, .25); }
.sbl-fila { visibility: visible; }
/* El reproductor del mensaje (el de VideoDelMomento, CSS_REPRODUCTOR), quieto hasta el play: el lugar que el motor tapa con el video.
   El play abajo a la derecha (20/11): en el centro tapaba el título de la portada y abajo a la izquierda el logo «MaKo». */
.mk-vmom.sbl-vlugar { margin: 2px 0 8px; }
.sbl-vlugar .mk-vmom__pantalla { cursor: pointer; }
.sbl-vlugar .mk-vmom__btn:disabled, .sbl-vlugar .mk-vmom__vel:disabled { opacity: .6; cursor: default; }
.sbl-video__vacio { position: absolute; inset: 0; background: #000; }
.sbl-omitir { align-self: flex-start; margin: 0 0 6px; padding: 2px 0; border: 0; background: none; color: var(--dim); font: inherit; font-size: var(--fs-meta); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
@media (prefers-reduced-motion: reduce) { .sbl-velo, .sbl-escribe i { animation: none; } }
`;
