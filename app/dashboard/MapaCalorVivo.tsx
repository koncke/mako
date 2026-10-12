'use client';
// =============================================================================
// El mapa de calor sobre la página EN VIVO, adentro de un celular o de una compu
// =============================================================================
// Decisión de Martín (12/10/2026): la landing de hoy, «exactamente igual» que la página, con el calor encima, y
// un cartel donde hay un video u otro marco que el mapa no midió. Aceptó el costo: abrir el mapa le cuenta un
// PageView al Pixel de Meta del cliente. Cómo se habla con la página (y por qué no se puede sin un puente):
// lib/landing-mapa-puente.ts.
//
// CÓMO SE ARMA:
//   · un iframe del tamaño de la pantalla del aparato (390×844 / 1440×900) con la página y `?mko_test=mapa-…`
//     (nuestra visita queda marcada como prueba y el beacon le sirve el puente, no el grabador);
//   · encima, una capa del tamaño del DOCUMENTO corrida con el scroll que manda el puente (el calor, los carteles
//     de los marcos y la caja de lo resaltado), y otra del tamaño de la PANTALLA para los toques de un elemento
//     fijo (se mueven con la ventana, no con la página);
//   · y arriba de todo, una tapa transparente que recibe la rueda y el arrastre y se los pasa al puente: la
//     página se recorre, pero NO se toca. Un clic en «Agendar» adentro del mapa sería una reserva de verdad en la
//     agenda del cliente.
//
// ⚠️ SIN PUENTE NO HAY MAPA EN VIVO, y no se finge: si el puente no contesta en el plazo (la página no se deja
// meter en un marco, o su Pixel no baja el r.js), `onSinPuente` y la pantalla pasa a la FOTO
// (app/dashboard/MapaCalorFoto.tsx). Un calor dibujado sobre posiciones adivinadas en una página que no se puede
// medir se ve exactamente igual de plausible que uno bien puesto.
//
// ⚠️ EL SANDBOX: `allow-scripts allow-same-origin` y nada más. La página es de OTRO origen (la del cliente;
// nuestra nunca entra acá: MapaCalor.tsx la manda a la foto), así que los dos permisos juntos no le sacan el
// sandbox. Sin `allow-top-navigation` no se lleva la pestaña de MaKo, sin `allow-popups` no abre ventanas, sin
// `allow-forms` no manda formularios.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Spinner } from '@/app/_ui';
import type { Dispositivo, ToqueMapa } from '@/lib/landing-mapa';
import {
  PANTALLAS, huecosEnDoc, leerMensajeDelPuente, nuevaPruebaDelMapa, origenDe, pedidoAlPuente, puntosEnVivo,
  scrollAlPuente, scrollMaximo, selectoresDe, urlEnVivo, type EstadoPuente,
} from '@/lib/landing-mapa-puente';
import { rotuloDeHueco } from '@/lib/landing-mapa-foto';
import { MarcoDispositivo, type Tamano } from './MapaCalorMarco';
import { pintarCalor } from './MapaCalorPiezas';

/** Cuánto se espera al puente después de que la página cargó (bajar r.js es un pedido más). */
const PLAZO_TRAS_CARGA_MS = 12_000;
/** Y cuánto en total, por si la página no termina de cargar nunca. */
const PLAZO_TOTAL_MS = 30_000;
/** Cada cuánto se vuelve a pedir mientras el puente no contesta (el primer «listo» se puede perder). */
const REPEDIR_MS = 1_500;
/** El canvas más alto que se pinta: más que esto es una página interminable, y el navegador no lo dibuja. */
const ALTO_MAX_CANVAS = 16_000;

export function MapaCalorVivo({ url, disp, toques, resaltado, caja, onSinPuente }: {
  url: string;
  disp: Dispositivo;
  toques: readonly ToqueMapa[];
  resaltado: string | null;
  caja: Tamano;
  onSinPuente: () => void;
}) {
  const pantalla = PANTALLAS[disp];
  const [prueba] = useState(() => nuevaPruebaDelMapa());
  const src = useMemo(() => urlEnVivo(url, prueba), [url, prueba]);
  // ⚠️ EL ORIGEN ESPERADO ES EL DE LA PÁGINA QUE EMBEBIMOS, y se compara exacto (`leerMensajeDelPuente`).
  const origen = useMemo(() => origenDe(src), [src]);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [estado, setEstado] = useState<EstadoPuente | null>(null);
  const sels = useMemo(() => selectoresDe(toques), [toques]);
  const estadoRef = useRef<EstadoPuente | null>(null);
  useEffect(() => { estadoRef.current = estado; }, [estado]);
  const pedido = useRef(0);
  const cargo = useRef(false);
  const avisado = useRef(false);
  const sinPuente = useRef(onSinPuente);
  useEffect(() => { sinPuente.current = onSinPuente; }, [onSinPuente]);

  const rendirse = useCallback(() => {
    if (avisado.current) return;
    avisado.current = true;
    sinPuente.current();
  }, []);
  // Una dirección que no se puede meter en el marco (no es https): directo a la foto.
  useEffect(() => { if (!src || !origen) rendirse(); }, [src, origen, rendirse]);

  /** Le pide al puente las cajas de los elementos tocados. A ESE origen y a ninguno más. */
  const pedir = useCallback(() => {
    const w = iframeRef.current?.contentWindow;
    if (!w || !origen) return;
    pedido.current += 1;
    try { w.postMessage(pedidoAlPuente(pedido.current, sels), origen); } catch { /* el marco ya no está */ }
  }, [origen, sels]);

  // ── Lo que contesta el puente ─────────────────────────────────────────────────────────
  useEffect(() => {
    const alMensaje = (ev: MessageEvent) => {
      const m = leerMensajeDelPuente(ev, { origen, ventana: iframeRef.current?.contentWindow ?? null });
      if (!m) return;
      if (m.tipo === 'listo') { pedir(); return; }
      setEstado(m);
    };
    window.addEventListener('message', alMensaje);
    return () => window.removeEventListener('message', alMensaje);
  }, [origen, pedir]);

  // Con los elementos cambiados (otro período, otro filtro), se vuelven a pedir.
  useEffect(() => { if (estado) pedir(); }, [sels]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Los plazos: sin puente, a la foto ─────────────────────────────────────────────────
  const conectado = estado != null;
  useEffect(() => {
    if (conectado) return;
    const total = window.setTimeout(rendirse, PLAZO_TOTAL_MS);
    const repetir = window.setInterval(() => { if (cargo.current) pedir(); }, REPEDIR_MS);
    return () => { window.clearTimeout(total); window.clearInterval(repetir); };
  }, [conectado, pedir, rendirse]);
  const plazoCarga = useRef<number | null>(null);
  useEffect(() => () => { if (plazoCarga.current != null) window.clearTimeout(plazoCarga.current); }, []);
  const alCargar = () => {
    cargo.current = true;
    pedir();
    if (plazoCarga.current != null) window.clearTimeout(plazoCarga.current);
    plazoCarga.current = window.setTimeout(() => { if (!estadoRef.current) rendirse(); }, PLAZO_TRAS_CARGA_MS);
  };

  // ── El calor ──────────────────────────────────────────────────────────────────────────
  const puntos = useMemo(() => (estado ? puntosEnVivo(toques, sels, estado, disp) : null), [estado, toques, sels, disp]);
  const escalaCanvas = disp === 'escritorio' ? 0.5 : 1;
  const radio = disp === 'movil' ? 22 : 30;
  const W = estado?.ancho ?? pantalla.ancho;
  const H = Math.min(estado?.alto ?? pantalla.alto, ALTO_MAX_CANVAS);
  const docRef = useRef<HTMLCanvasElement>(null);
  const pantRef = useRef<HTMLCanvasElement>(null);
  // ⚠️ La capa del documento se repinta sólo si cambió DÓNDE va algo, no en cada scroll: los toques de un
  // elemento que no es fijo quedan en el mismo lugar del documento, y teñir una página entera 20 veces por
  // segundo traba la pantalla.
  const firmaDoc = useMemo(() => (puntos ? `${W}x${H}|${puntos.doc.map((p) => `${Math.round(p.x / 2)},${Math.round(p.y / 2)}`).join(';')}` : ''), [puntos, W, H]);
  useEffect(() => {
    const c = docRef.current;
    if (!c || !puntos) return;
    c.width = Math.max(1, Math.round(W * escalaCanvas));
    c.height = Math.max(1, Math.round(H * escalaCanvas));
    pintarCalor(c, puntos.doc.filter((p) => p.y <= H), radio, escalaCanvas);
  }, [firmaDoc]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const c = pantRef.current;
    if (!c || !puntos) return;
    c.width = pantalla.ancho; c.height = pantalla.alto;
    pintarCalor(c, puntos.pantalla, radio, 1);
  }, [puntos, pantalla.ancho, pantalla.alto, radio]);

  // ── La rueda y el arrastre: se le pasan al puente, la página no recibe clics ─────────────
  const tapaRef = useRef<HTMLDivElement>(null);
  // Hasta dónde se pidió scrollear: varias rueditas seguidas suman sobre lo pedido, no sobre el último estado
  // (que llega un cuadro tarde). Un pedido viejo deja de contar: si la página no pudo llegar, manda la página.
  const objetivo = useRef<{ y: number; t: number } | null>(null);
  const mover = useCallback((dy: number) => {
    const e = estadoRef.current;
    const w = iframeRef.current?.contentWindow;
    if (!e || !w || !origen) return;
    const ahora = Date.now();
    const desde = objetivo.current && ahora - objetivo.current.t < 400 ? objetivo.current.y : e.sy;
    const y = Math.max(0, Math.min(scrollMaximo(e), desde + dy));
    objetivo.current = { y, t: ahora };
    try { w.postMessage(scrollAlPuente(y), origen); } catch { /* el marco ya no está */ }
  }, [origen]);
  useEffect(() => {
    const t = tapaRef.current;
    if (!t) return;
    // ⚠️ La rueda va con un listener PROPIO y `passive: false`: el `onWheel` de React es pasivo y no puede
    // frenar que la rueda scrollee la hoja de atrás.
    const rueda = (ev: WheelEvent) => {
      ev.preventDefault();
      const dy = ev.deltaMode === 1 ? ev.deltaY * 40 : ev.deltaMode === 2 ? ev.deltaY * pantalla.alto : ev.deltaY;
      mover(dy);
    };
    t.addEventListener('wheel', rueda, { passive: false });
    return () => t.removeEventListener('wheel', rueda);
  }, [mover, pantalla.alto]);
  const arrastre = useRef<{ y: number; id: number } | null>(null);

  // ── Lo que se dibuja encima ───────────────────────────────────────────────────────────
  const huecos = useMemo(() => (estado ? huecosEnDoc(estado) : []), [estado]);
  const cajaResaltada = useMemo(() => {
    if (!estado || !resaltado) return null;
    const i = sels.indexOf(resaltado);
    const r = i >= 0 ? estado.rects[i] : null;
    return r && r.w > 0 ? { left: r.x, top: r.y + estado.sy, width: r.w, height: r.h } : null;
  }, [estado, resaltado, sels]);
  const sy = estado?.sy ?? 0;

  if (!src || !origen) return null;
  const capa: CSSProperties = { position: 'absolute', left: 0, top: 0, pointerEvents: 'none' };

  return (
    <MarcoDispositivo disp={disp} pantalla={pantalla} url={url} caja={caja}>
      <iframe ref={iframeRef} src={src} title="La página, en vivo" tabIndex={-1} onLoad={alCargar}
        sandbox="allow-scripts allow-same-origin" referrerPolicy="strict-origin-when-cross-origin"
        style={{ position: 'absolute', left: 0, top: 0, width: pantalla.ancho, height: pantalla.alto, border: 'none', opacity: conectado ? 1 : 0, background: '#ffffff' }} />
      {conectado && (
        <>
          <div style={{ ...capa, width: W, height: H, transform: `translateY(${-sy}px)` }}>
            <canvas ref={docRef} aria-hidden style={{ position: 'absolute', left: 0, top: 0, width: W, height: H }} />
            {huecos.map((h, i) => (
              <div key={i} style={{ position: 'absolute', left: h.x, top: h.y, width: h.w, height: h.h, boxSizing: 'border-box', border: '2px dashed rgba(255,255,255,.85)', borderRadius: 6, background: 'rgba(20,22,27,.62)', display: 'grid', placeItems: 'center', color: '#ffffff', font: '600 15px/1.3 system-ui, sans-serif', textAlign: 'center', padding: 8 }}>
                {rotuloDeHueco(h.src, h.tipo)}
              </div>
            ))}
            {cajaResaltada && <div aria-hidden style={{ position: 'absolute', left: cajaResaltada.left - 4, top: cajaResaltada.top - 4, width: cajaResaltada.width + 8, height: cajaResaltada.height + 8, border: '3px solid var(--primary)', borderRadius: 8 }} />}
          </div>
          <canvas ref={pantRef} aria-hidden style={{ ...capa, width: pantalla.ancho, height: pantalla.alto }} />
        </>
      )}
      <div ref={tapaRef} className="lk-no-arrastrar" title="Arrastra para recorrer la página"
        style={{ position: 'absolute', inset: 0, cursor: conectado ? 'grab' : 'default', touchAction: 'none', zIndex: 2 }}
        onPointerDown={(e) => { if (!conectado) return; arrastre.current = { y: e.clientY, id: e.pointerId }; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* sin captura */ } }}
        onPointerMove={(e) => {
          const a = arrastre.current;
          if (!a || a.id !== e.pointerId) return;
          // El arrastre se mide en px de la pantalla de MaKo y la página está achicada: se divide por la escala.
          const k = e.currentTarget.getBoundingClientRect().height / pantalla.alto || 1;
          mover((a.y - e.clientY) / k);
          arrastre.current = { y: e.clientY, id: a.id };
        }}
        onPointerUp={() => { arrastre.current = null; }}
        onPointerCancel={() => { arrastre.current = null; }} />
      {!conectado && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', alignContent: 'center', gap: 10, color: 'var(--faint)', fontSize: 15, zIndex: 1 }}>
          <Spinner size={22} />
          <span>Abriendo la página…</span>
        </div>
      )}
    </MarcoDispositivo>
  );
}
