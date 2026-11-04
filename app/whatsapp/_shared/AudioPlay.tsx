'use client';

// =============================================================================
// AudioPlay — el reproductor de una nota de voz, con la cara de WhatsApp
// =============================================================================
// Es UNO para todo el producto: las burbujas (BurbujaHilo: el hilo, /whatsapp, el editor del lienzo y
// la tarjeta), la barra que deja escuchar lo recién grabado (BarraGrabacion) y los grabadores del
// onboarding. Un ▶, la barra de avance (que se arrastra) y el tiempo.
//
// ⚠️ EL AUDIO «QUE NO SE PODÍA ESCUCHAR» (sexta tanda del Chatbot, WhatsApp 1 y 8; la #350 del plan) NO
//    ERA EL AUDIO. Medido el 09/10/2026, en orden (AGENTS.md, datos → server → navegador):
//      · los datos: `wa_mensajes` 89057 (ws1, el audio que Martín se mandó desde /whatsapp) tiene su
//        `media_path`, y el archivo es un MP3 válido (cabecera `fffb`, 30.528 bytes);
//      · el server: la URL firmada contesta 206 con `audio/mpeg`;
//      · el navegador: el MISMO archivo en un `<audio controls>` de 240 px dura 2,544 s y suena. En la
//        burbuja, el `<audio>` medía **43 px** en /whatsapp (sólo se veían el «—» del volumen y el «⋮»:
//        la captura de Martín) y **0 px** en el editor del lienzo («no aparece nada»).
//    La causa es CSS: la burbuja se ajusta a su contenido (flex, `max-width: 78%`) y el `<audio>` tenía
//    `width: min(240px, 100%)`. Ese 100% es CÍCLICO —de una caja que mide lo que mide él—, y para un
//    elemento reemplazado el navegador lo resuelve contra CERO al calcular el ancho de la burbuja. En
//    /whatsapp la hora y las palomitas le daban 45 px a la burbuja; en el editor no había nada más.
//    El diagnóstico obvio (el MP3 sin cabecera Xing, la #350) era el equivocado: ése ya lo resolvía el
//    truco de la duración, y el archivo sonaba en cuanto tenía ancho.
// ⚠️ POR ESO ESTE REPRODUCTOR TIENE ANCHO PROPIO Y NO ES EL NATIVO: un `<div>` con un ancho en px es
//    un número que la burbuja SÍ puede sumar, y los controles nativos de Chrome se esconden de a uno
//    cuando no entran (el play es el primero que se va). Quien lo monta adentro de algo que se ajusta
//    a su contenido le pasa un ancho en px; adentro de una caja de ancho conocido, `100%`.
// ⚠️ LA DURACIÓN: los MP3 que codifica la app (lamejs, app/whatsapp/audio.ts) y los webm de MediaRecorder
//    no traen cuánto duran, y el navegador dice `Infinity`. El truco de siempre: un salto absurdo lo
//    obliga a recorrer el archivo, ahí sabe la duración, y se vuelve al principio. Mientras tanto, la que
//    trae la biblioteca (`duracion`).

// ⚠️ LA VELOCIDAD (ticket #50 de Leandro, 4/11/2026: «no puedo aumentar la velocidad de los audios de WhatsApp»): en el iPhone el
//    `<audio controls>` nativo no la ofrece, y el teléfono usaba ése. El botón da la vuelta 1× · 1,5× · 2×, como WhatsApp, y lo elegido
//    vale para el próximo audio (`velocidadElegida`, mientras la app siga abierta). La compacta no lo lleva: no entra.
// ⚠️ UN AUDIO NO SE CORTA PORQUE LE RENOVARON LA FIRMA. `/m/chats` y /chats releen el hilo cada 15 s, y cada lectura firma de nuevo la URL
//    del Storage: el mismo archivo con otro `?token=`. Tomarlo como otro audio paraba lo que estaba sonando. Si la firma guardada vence (1 h),
//    el error prueba con la última que llegó (`mismoArchivo`).

import { useEffect, useRef, useState, type CSSProperties } from 'react';

const fmt = (s: number) => {
  const t = Math.max(0, Math.floor(Number.isFinite(s) ? s : 0));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

/** La duración que se muestra: la del archivo si ya se sabe, si no la que trae la biblioteca. Pura (test). */
export function duracionVisible(delArchivo: number, pista: number | null | undefined): number {
  if (Number.isFinite(delArchivo) && delArchivo > 0) return delArchivo;
  return pista && pista > 0 ? pista : 0;
}

/** El tiempo que dice el reproductor: lo que falta mientras suena (como WhatsApp), el total parado. */
export function tiempoDelReproductor(actual: number, total: number, sonando: boolean): string {
  if (sonando || actual > 0) return fmt(actual);
  return fmt(total);
}

/** Las velocidades que da la vuelta el botón. */
export const VELOCIDADES = [1, 1.5, 2] as const;
export const siguienteVelocidad = (v: number): number => VELOCIDADES[(VELOCIDADES.findIndex((x) => x === v) + 1) % VELOCIDADES.length];
export const rotuloVelocidad = (v: number): string => `${String(v).replace('.', ',')}×`;
/** Lo que eligió la persona: el próximo audio arranca así. */
let velocidadElegida = 1;

/**
 * Pone la velocidad en el `<audio>`. `defaultPlaybackRate` también: Safari vuelve a ésa cada vez que carga el archivo, y en el teléfono carga
 * recién al tocar ▶. Pura con el elemento inyectado (test).
 */
export function aplicarVelocidad(el: Pick<HTMLMediaElement, 'playbackRate' | 'defaultPlaybackRate'>, v: number): void {
  el.defaultPlaybackRate = v;
  el.playbackRate = v;
}

/** ¿Es el mismo archivo con otra firma? Sólo cambia el `token` del Storage. Otra query (`?adjunto=`, `?ws=`) es otro audio. Pura (test). */
export function mismoArchivo(a: string, b: string): boolean {
  if (a === b) return true;
  const sinFirma = (s: string): string | null => {
    try { const u = new URL(s, 'http://x.test'); if (!u.searchParams.has('token')) return null; u.searchParams.delete('token'); return u.href; } catch { return null; }
  };
  const x = sinFirma(a);
  return x != null && x === sinFirma(b);
}

function IconoPlay({ tam }: { tam: number }) {
  return <svg width={tam} height={tam} viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l11-6.8a.8.8 0 0 0 0-1.4l-11-6.8A.8.8 0 0 0 8 5.2z" fill="currentColor" /></svg>;
}
function IconoPausa({ tam }: { tam: number }) {
  return <svg width={tam} height={tam} viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" /><rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" /></svg>;
}

export function AudioPlay({ src: srcQueLlega, style, compacto = false, duracion, color = 'var(--wa)', velocidad: conVelocidad = true }: {
  src: string;
  /** El ancho va acá: en px adentro de algo que se ajusta a su contenido (ver la cabecera). */
  style?: CSSProperties;
  /** La versión chica (la tarjeta del lienzo, 34 px de alto: `ALTO_REPRODUCTOR` de lib/flujo-conversacion.ts). */
  compacto?: boolean;
  /** Segundos que dice la biblioteca, para mostrar algo antes de que el archivo lo diga. */
  duracion?: number | null;
  /** El color del ▶ y del avance (el verde de WhatsApp por default). */
  color?: string;
  /** El botón 1× · 1,5× · 2×. false donde se escucha lo que uno mismo acaba de grabar: la barra del grabador no tiene ancho de sobra. */
  velocidad?: boolean;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  const [sonando, setSonando] = useState(false);
  const [actual, setActual] = useState(0);
  const [total, setTotal] = useState(0);
  const [roto, setRoto] = useState(false);
  // Otro audio en el mismo reproductor: lo de antes no se queda (el patrón de «ajustar el estado
  // cuando cambia una prop», en el render y no en un efecto).
  const [src, setDeSrc] = useState(srcQueLlega);
  if (src !== srcQueLlega && !mismoArchivo(src, srcQueLlega)) { setDeSrc(srcQueLlega); setSonando(false); setActual(0); setTotal(0); setRoto(false); }
  const ultimaFirma = useRef(srcQueLlega);
  ultimaFirma.current = srcQueLlega;
  const [velocidad, setVelocidad] = useState(velocidadElegida);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let escaneando = false;

    const leerTotal = () => { if (Number.isFinite(el.duration) && el.duration > 0) setTotal(el.duration); };
    const alVolver = () => {
      el.removeEventListener('timeupdate', alVolver);
      escaneando = false;
      leerTotal();
      // `currentTime = 0` sobre un elemento recién escaneado puede tirar en Safari: no es fatal.
      try { el.currentTime = 0; } catch { /* queda donde está */ }
      setActual(0);
    };
    const alMetadata = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) { setTotal(el.duration); return; }
      // Sólo cuando de verdad falta: un MP3 con cabecera correcta no se toca.
      escaneando = true;
      el.addEventListener('timeupdate', alVolver);
      try { el.currentTime = 1e101; } catch { escaneando = false; el.removeEventListener('timeupdate', alVolver); }
    };
    const alAvanzar = () => { if (!escaneando) setActual(el.currentTime); };
    const alTerminar = () => { setSonando(false); setActual(0); try { el.currentTime = 0; } catch { /* noop */ } };
    const alPlay = () => { aplicarVelocidad(el, velocidadElegida); setVelocidad(velocidadElegida); setSonando(true); };
    const alPausa = () => setSonando(false);
    const alError = () => {
      setSonando(false);
      // La firma guardada venció y ya llegó otra: se prueba con ésa, una vez (si falla, ya es la misma y queda roto).
      if (ultimaFirma.current !== el.getAttribute('src')) { setDeSrc(ultimaFirma.current); return; }
      setRoto(true);
    };

    el.addEventListener('loadedmetadata', alMetadata);
    el.addEventListener('durationchange', leerTotal);
    el.addEventListener('timeupdate', alAvanzar);
    el.addEventListener('ended', alTerminar);
    el.addEventListener('play', alPlay);
    el.addEventListener('pause', alPausa);
    el.addEventListener('error', alError);
    if (el.readyState >= 1) alMetadata();
    return () => {
      el.removeEventListener('loadedmetadata', alMetadata);
      el.removeEventListener('durationchange', leerTotal);
      el.removeEventListener('timeupdate', alAvanzar);
      el.removeEventListener('timeupdate', alVolver);
      el.removeEventListener('ended', alTerminar);
      el.removeEventListener('play', alPlay);
      el.removeEventListener('pause', alPausa);
      el.removeEventListener('error', alError);
    };
  }, [src]);

  const dur = duracionVisible(total, duracion);
  const alternar = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => setRoto(true));
    else el.pause();
  };
  const saltar = (v: number) => {
    const el = ref.current;
    if (!el || !(dur > 0)) return;
    try { el.currentTime = Math.max(0, Math.min(dur, v)); setActual(el.currentTime); } catch { /* noop */ }
  };

  const cambiarVelocidad = () => {
    velocidadElegida = siguienteVelocidad(velocidad);
    setVelocidad(velocidadElegida);
    if (ref.current) aplicarVelocidad(ref.current, velocidadElegida);
  };

  const boton = compacto ? 26 : 34;
  return (
    <div data-reproductor style={{ display: 'flex', alignItems: 'center', gap: compacto ? 6 : 9, minWidth: 0, width: '100%', height: compacto ? 34 : 40, ...style }}>
      <audio ref={ref} preload="metadata" src={src} style={{ display: 'none' }} />
      <button type="button" data-no-pan onClick={(e) => { e.stopPropagation(); alternar(); }} disabled={roto}
        aria-label={sonando ? 'Pausar audio' : 'Escuchar audio'} title={roto ? 'No se pudo cargar el audio' : sonando ? 'Pausar' : 'Escuchar'}
        style={{ flex: 'none', width: boton, height: boton, borderRadius: '50%', border: 'none', background: roto ? 'var(--border)' : color, color: '#fff', cursor: roto ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
        {sonando ? <IconoPausa tam={compacto ? 14 : 17} /> : <IconoPlay tam={compacto ? 14 : 17} />}
      </button>
      <input type="range" data-no-pan min={0} max={dur > 0 ? dur : 1} step={0.01} value={dur > 0 ? Math.min(actual, dur) : 0}
        onChange={(e) => saltar(Number(e.target.value))} onPointerDown={(e) => e.stopPropagation()} disabled={roto || !(dur > 0)}
        aria-label="Avance del audio"
        style={{ flex: 1, minWidth: 40, margin: 0, accentColor: color, cursor: dur > 0 ? 'pointer' : 'default', height: 4 }} />
      <span style={{ flex: 'none', fontSize: compacto ? 11 : 12, color: 'var(--dim)', fontVariantNumeric: 'tabular-nums', minWidth: compacto ? 28 : 32, textAlign: 'right' }}>
        {roto ? '—' : tiempoDelReproductor(actual, dur, sonando)}
      </span>
      {conVelocidad && !compacto && (
        <button type="button" data-no-pan onClick={(e) => { e.stopPropagation(); cambiarVelocidad(); }} disabled={roto}
          aria-label={`Velocidad del audio: ${rotuloVelocidad(velocidad)}`} title="Cambiar la velocidad"
          style={{ flex: 'none', minWidth: 38, height: 40, padding: 0, border: 'none', background: 'none', color: 'var(--ink)', cursor: roto ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', touchAction: 'manipulation' }}>
          <span style={{ padding: '3px 7px', borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 11.5, fontWeight: 600, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{rotuloVelocidad(velocidad)}</span>
        </button>
      )}
    </div>
  );
}
