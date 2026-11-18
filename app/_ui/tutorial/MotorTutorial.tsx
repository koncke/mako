'use client';
// =============================================================================
// <MotorTutorial> — los tutoriales de las pestañas y las marcas del onboarding, sobre la página de verdad (18/11/2026)
// =============================================================================
// Se monta UNA vez en app/layout.tsx, sólo para quien ve el onboarding V2 (lib/onboarding-v2/revision.ts). Dibuja lo que pide
// el store (./store.ts): el tutorial de una pestaña (lib/tutoriales) o una marca de un solo lugar. Y la PRIMERA vez que la persona
// entra a una pestaña con tutorial, lo arranca solo (<TutorialDeLaRuta>), con lo visto guardado por persona en /api/recorridos
// (el mismo `useRecorrido` de app/_ui/Recorrido.tsx, con el id `tutorial-<pestaña>`).
//
// Reusa la geometría pura de lib/recorridos.ts (dónde va el recorte, dónde la tarjeta, cuándo scrollear) y la hoja del recorrido de
// siempre (`cssRecorrido()`): se ve igual que los recorridos que ya tiene la app. Lo que agrega:
//   · `sel` es un selector libre (lib/tutoriales usa `data-recorrido="tour-…"`, `aria-label`, `href`): vale el PRIMERO con cajas;
//   · `antes`: se toca antes de marcar el paso (abrir un menú, «Mostrar más»); si no está, se sigue;
//   · un paso cuyo lugar no aparece en 3 s se saltea (nunca una flecha a la nada); en el teléfono, sin los `soloComputadora`;
//   · el último paso con `clic` (y una marca) espera el clic de la persona en lo marcado: «Haz clic en…». El clic NO se frena;
//   · el video chico de Martín, abajo a la derecha, del manifiesto de public/tutoriales (lib/tutoriales/videos.ts). Sin video para
//     esa pestaña, ningún video (nunca otro en su lugar); en la revisión, el lugar marcado «Tu video de esta pestaña».
// =============================================================================
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { Button } from '../Button';
import { cssRecorrido, useRecorrido } from '../Recorrido';
import { Z_PISO_RECORRIDO, necesitaScroll, posicionTarjeta, recorteDe, type Caja, type Medida, type PosicionTarjeta } from '@/lib/recorridos';
import { pasosPara, tutorialDeRuta, type PasoTutorial, type TutorialPestana } from '@/lib/tutoriales';
import { RUTA_MANIFIESTO, videoDe, type VideoTutorial } from '@/lib/tutoriales/videos';
import { motorPresente, mostrarTutorial, senalAhora, terminar, useSenal, type Senal } from './store';

/** Cuánto se espera a que aparezca lo de un paso antes de saltearlo. */
const ESPERA_PASO_MS = 3000;
/** MaKo Mobile: por debajo de esto la pestaña es la del teléfono (los pasos `soloComputadora` no van). */
const ANCHO_TELEFONO = 768;

const ventanaActual = (): Medida => ({ ancho: window.innerWidth, alto: window.innerHeight });
const cajaDe = (r: DOMRect): Caja => ({ x: r.left, y: r.top, ancho: r.width, alto: r.height });
const menosMovimiento = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Lo marcado por un selector libre: el primero que tiene cajas. Un selector inválido es «no está». */
function lugarDe(sel: string): HTMLElement | null {
  try {
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) if (el.getClientRects().length > 0) return el;
  } catch { /* selector inválido */ }
  return null;
}

// ── El manifiesto de los videos (una vez por visita) ─────────────────────────────────────────────────────────────────
let manifiesto: Promise<unknown> | null = null;
function useVideo(key: string | null): VideoTutorial | null {
  const [v, setV] = useState<{ key: string; video: VideoTutorial | null } | null>(null);
  useEffect(() => {
    if (!key) return;
    let vivo = true;
    manifiesto ??= fetch(RUTA_MANIFIESTO, { cache: 'force-cache' }).then((r) => (r.ok ? r.json() : [])).catch(() => []);
    void manifiesto.then((m) => { if (vivo) setV({ key, video: videoDe(m, key) }); });
    return () => { vivo = false; };
  }, [key]);
  return v && v.key === key ? v.video : null;
}

// ── El motor ──────────────────────────────────────────────────────────────────────────────────────────────────────────
export function MotorTutorial({ revision }: { revision: boolean }) {
  useEffect(() => {
    motorPresente(true, (ruta) => !!tutorialDeRuta(ruta));
    return () => motorPresente(false);
  }, []);
  const senal = useSenal();
  return (
    <>
      <TutorialDeLaRuta />
      {senal && <Capa key={senal.id} senal={senal} revision={revision} />}
    </>
  );
}

/** La primera vez en una pestaña con tutorial: lo arranca solo, cuando su primer paso ya está en la pantalla. */
function TutorialDeLaRuta() {
  const ruta = usePathname() ?? '/';
  const t = tutorialDeRuta(ruta);
  return t ? <PrimeraVez key={t.pestana} t={t} /> : null;
}
function PrimeraVez({ t }: { t: TutorialPestana }) {
  const r = useRecorrido(`tutorial-${t.pestana}`);
  const pedido = useRef(false);
  const { abierto, onCerrar } = r;
  useEffect(() => {
    if (!abierto || pedido.current || senalAhora()) return;
    // Espera a que la pestaña pinte su primer paso (los datos llegan después del montaje), hasta 6 s.
    const telefono = window.innerWidth < ANCHO_TELEFONO;
    const pasos = pasosPara(t, telefono);
    if (!pasos.length) return;
    let vivo = true;
    const desde = Date.now();
    const mirar = () => {
      if (!vivo || pedido.current || senalAhora()) return;
      if (lugarDe(pasos[0].sel) || Date.now() - desde > 6000) { pedido.current = true; mostrarTutorial(t, { alTerminar: onCerrar }); return; }
      window.setTimeout(mirar, 250);
    };
    const id = window.setTimeout(mirar, 600);
    return () => { vivo = false; window.clearTimeout(id); };
  }, [abierto, onCerrar, t]);
  return null;
}

type Geo = { hueco: Caja | null; tarjeta: PosicionTarjeta | null };

function Capa({ senal, revision }: { senal: Senal; revision: boolean }) {
  const telefono = typeof window !== 'undefined' && window.innerWidth < ANCHO_TELEFONO;
  const pasos: PasoTutorial[] = senal.tipo === 'tutorial' ? pasosPara(senal.tutorial, telefono) : [senal.paso];
  // -1 = la presentación de la pestaña (su `intro`), antes del primer paso. Una marca va directo a su lugar.
  const [i, setI] = useState(senal.tipo === 'tutorial' && senal.tutorial.intro ? -1 : 0);
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [geo, setGeo] = useState<Geo>({ hueco: null, tarjeta: null });
  const [videoArriba, setVideoArriba] = useState(false);
  const tarjetaRef = useRef<HTMLDivElement>(null);
  const paso = i >= 0 ? pasos[i] : null;
  const ultimo = i === pasos.length - 1;
  const esperaClic = senal.tipo === 'marca' ? !senal.listo : !!(paso?.clic && ultimo);

  const fin = useCallback((como: 'fin' | 'omitido' | 'hecho') => terminar(senal.id, como), [senal.id]);
  const siguiente = useCallback(() => {
    if (i >= pasos.length - 1) { fin(senal.tipo === 'marca' ? 'hecho' : 'fin'); return; }
    setEl(null); setGeo({ hueco: null, tarjeta: null }); setI(i + 1);
  }, [i, pasos.length, fin, senal.tipo]);
  const atras = () => { if (i > 0) { setEl(null); setGeo({ hueco: null, tarjeta: null }); setI(i - 1); } };

  // 1. Cada paso: lo de `antes`, y esperar a que aparezca lo marcado (hasta 3 s; una marca espera siempre).
  useEffect(() => {
    if (!paso) return;
    let vivo = true;
    if (paso.antes) { const a = lugarDe(paso.antes); if (a) a.click(); }
    const desde = Date.now();
    let cuadro = 0;
    const buscar = () => {
      cuadro = 0;
      if (!vivo) return;
      const x = lugarDe(paso.sel);
      if (x) {
        obs.disconnect();
        const { scroll, bloque } = necesitaScroll(cajaDe(x.getBoundingClientRect()), ventanaActual());
        if (scroll) x.scrollIntoView({ block: bloque, inline: 'nearest', behavior: menosMovimiento() ? 'auto' : 'smooth' });
        setEl(x);
        return;
      }
      if (senal.tipo === 'tutorial' && Date.now() - desde > ESPERA_PASO_MS) { obs.disconnect(); siguiente(); }
    };
    const obs = new MutationObserver(() => { if (!cuadro) cuadro = requestAnimationFrame(buscar); });
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-recorrido', 'hidden', 'style', 'class', 'aria-expanded'] });
    const reloj = window.setInterval(buscar, 300);
    cuadro = requestAnimationFrame(buscar);
    return () => { vivo = false; obs.disconnect(); window.clearInterval(reloj); if (cuadro) cancelAnimationFrame(cuadro); };
  }, [paso, senal.tipo, siguiente]);

  // 2. Medir el recorte y la tarjeta; de nuevo con el scroll, el tamaño y los cambios de la página.
  const medir = useCallback(() => {
    const v = ventanaActual();
    const t = tarjetaRef.current?.getBoundingClientRect();
    const tam = { ancho: t?.width || 340, alto: t?.height || 170 };
    if (!paso) { setGeo({ hueco: null, tarjeta: { x: Math.max(12, (v.ancho - tam.ancho) / 2), y: Math.max(12, (v.alto - tam.alto) / 2), lado: 'abajo', flecha: null } }); return; }
    if (!el || !el.isConnected || !el.getClientRects().length) { setGeo({ hueco: null, tarjeta: null }); if (el) setEl(lugarDe(paso.sel)); return; }
    const hueco = recorteDe(cajaDe(el.getBoundingClientRect()), v);
    setGeo({ hueco, tarjeta: posicionTarjeta({ objetivo: hueco, tarjeta: tam, ventana: v, lado: paso.lado }) });
  }, [paso, el]);
  useLayoutEffect(() => {
    medir();
    let cuadro = 0;
    const pedir = () => { if (!cuadro) cuadro = requestAnimationFrame(() => { cuadro = 0; medir(); }); };
    window.addEventListener('resize', pedir);
    document.addEventListener('scroll', pedir, { capture: true, passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(pedir) : null;
    if (ro && el) ro.observe(el);
    if (ro && tarjetaRef.current) ro.observe(tarjetaRef.current);
    const mo = new MutationObserver(pedir);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { window.removeEventListener('resize', pedir); document.removeEventListener('scroll', pedir, { capture: true }); ro?.disconnect(); mo.disconnect(); if (cuadro) cancelAnimationFrame(cuadro); };
  }, [medir, el]);

  // 2b. El video chico nunca tapa la tarjeta (en el teléfono se cruzan): si abajo a la derecha la tocaría, va arriba.
  useEffect(() => {
    const t = tarjetaRef.current?.getBoundingClientRect();
    const v = document.querySelector<HTMLElement>('.mk-tuto__video');
    if (!t || !v || !geo.tarjeta) return;
    const alto = v.offsetHeight, ancho = v.offsetWidth, vw = window.innerWidth, vh = window.innerHeight;
    const abajo = { x: vw - ancho - 16, y: vh - alto - 16 };
    const seCruzan = t.left < abajo.x + ancho && t.right > abajo.x && t.top < abajo.y + alto && t.bottom > abajo.y;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVideoArriba(seCruzan);
  }, [geo]);

  // 3. El clic de la persona en lo marcado (en captura, sin frenarlo: el clic hace lo suyo).
  useEffect(() => {
    if (!el || !esperaClic) return;
    // En la VENTANA y también con `pointerdown`: un manejador de la página que frene el clic en captura no lo esconde del motor.
    const alTocar = (e: Event) => { if (e.target instanceof Node && el.contains(e.target)) window.setTimeout(() => fin(senal.tipo === 'marca' ? 'hecho' : 'fin'), 0); };
    window.addEventListener('pointerdown', alTocar, true);
    window.addEventListener('click', alTocar, true);
    return () => { window.removeEventListener('pointerdown', alTocar, true); window.removeEventListener('click', alTocar, true); };
  }, [el, esperaClic, fin, senal.tipo]);

  // 4. Escape: omitir el tutorial (una marca sólo si se puede dejar para después).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (senal.tipo === 'marca' && !senal.alOmitir) return;
      e.preventDefault(); e.stopImmediatePropagation(); fin('omitido');
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [fin, senal]);

  if (typeof document === 'undefined') return null;
  const t = geo.tarjeta;
  const visible = !!t && (!paso || !!geo.hueco);
  const estiloFlecha: CSSProperties | null = paso && t && t.flecha != null ? (t.lado === 'abajo' || t.lado === 'arriba' ? { left: t.flecha - 6 } : { top: t.flecha - 6 }) : null;
  const titulo = paso ? paso.titulo : senal.tipo === 'tutorial' ? `Cómo funciona ${senal.tutorial.nombre}` : '';
  const texto = paso ? paso.texto : senal.tipo === 'tutorial' ? senal.tutorial.intro : '';
  const haz = esperaClic ? (paso?.haz ?? (senal.tipo === 'marca' ? senal.paso.haz : null)) : null;
  const total = senal.tipo === 'tutorial' ? pasos.length : 1;

  return createPortal(
    <div className="mk-rec mk-tuto" data-tutorial={senal.tipo === 'tutorial' ? senal.tutorial.pestana : 'marca'} style={{ zIndex: Z_PISO_RECORRIDO }}>
      <style>{cssRecorrido() + CSS_TUTORIAL}</style>
      {senal.tipo === 'tutorial' && <VideoChico tutorial={senal.tutorial} sub={paso?.sub ?? senal.tutorial.intro} revision={revision} arriba={videoArriba} />}
      {geo.hueco
        ? <>
            <div className="mk-rec__hueco" style={{ left: geo.hueco.x, top: geo.hueco.y, width: geo.hueco.ancho, height: geo.hueco.alto }} aria-hidden />
            <Tapas h={geo.hueco} />
          </>
        : <div className="mk-rec__velo" aria-hidden />}
      <div ref={tarjetaRef} className="mk-rec__tarjeta" role="dialog" aria-modal="false" aria-label={titulo} tabIndex={-1}
        style={{ left: t?.x ?? 0, top: t?.y ?? 0, visibility: visible ? 'visible' : 'hidden' }}>
        {estiloFlecha && t && <span className="mk-rec__flecha" data-lado={t.lado} style={estiloFlecha} aria-hidden />}
        <div key={i} className="mk-rec__cuerpo">
          {paso && total > 1 && <div className="mk-rec__cont">{i + 1} de {total}</div>}
          <h2 className="mk-rec__tit">{titulo}</h2>
          {texto && <p className="mk-rec__txt">{texto}</p>}
          {haz && <p className="mk-tuto__haz"><span aria-hidden className="mk-tuto__punto" />{haz}</p>}
        </div>
        <Pie senal={senal} paso={paso} ultimo={ultimo} esperaClic={esperaClic} hayAnterior={i > 0} siguiente={siguiente} atras={atras} fin={fin} />
      </div>
    </div>,
    document.body,
  );
}

/**
 * Lo único que se toca es lo marcado: cuatro tapas transparentes alrededor del hueco se quedan con los clics de afuera (el
 * contenedor del motor deja pasar los clics: si no, el del hueco no llegaba nunca a la página).
 */
function Tapas({ h }: { h: Caja }) {
  const b = h.y + h.alto, d = h.x + h.ancho;
  return (
    <>
      <div className="mk-tuto__tapa" style={{ left: 0, top: 0, right: 0, height: Math.max(0, h.y) }} aria-hidden />
      <div className="mk-tuto__tapa" style={{ left: 0, top: b, right: 0, bottom: 0 }} aria-hidden />
      <div className="mk-tuto__tapa" style={{ left: 0, top: h.y, width: Math.max(0, h.x), height: h.alto }} aria-hidden />
      <div className="mk-tuto__tapa" style={{ left: d, top: h.y, right: 0, height: h.alto }} aria-hidden />
    </>
  );
}

function Pie({ senal, paso, ultimo, esperaClic, hayAnterior, siguiente, atras, fin }: {
  senal: Senal; paso: PasoTutorial | null; ultimo: boolean; esperaClic: boolean; hayAnterior: boolean;
  siguiente: () => void; atras: () => void; fin: (c: 'fin' | 'omitido' | 'hecho') => void;
}) {
  if (senal.tipo === 'marca') {
    if (!senal.listo && !senal.alOmitir) return null;
    return (
      <div className="mk-rec__pie">
        {senal.alOmitir && <Button variant="tertiary" size="sm" onClick={() => fin('omitido')}>Lo hago después</Button>}
        <span className="mk-rec__aire" />
        {senal.listo && <Button variant="primary" size="sm" onClick={() => fin('hecho')}>{senal.listo}</Button>}
      </div>
    );
  }
  return (
    <div className="mk-rec__pie">
      {/* «Omitir recorrido» abajo a la izquierda, siempre (Martín, 16/11: «en lugar de la X… un mensajito abajo a la izquierda»). */}
      <Button variant="tertiary" size="sm" onClick={() => fin('omitido')}>Omitir recorrido</Button>
      <span className="mk-rec__aire" />
      {hayAnterior && <Button variant="secondary" size="sm" onClick={atras}>Atrás</Button>}
      {!esperaClic && <Button variant="primary" size="sm" onClick={siguiente}>{!paso ? 'Empezar' : ultimo ? 'Listo' : 'Siguiente'}</Button>}
    </div>
  );
}

/** El video chico de Martín de ESTA pestaña, abajo a la derecha. Sin video, nada (en la revisión, su lugar marcado). */
function VideoChico({ tutorial, sub, revision, arriba }: { tutorial: TutorialPestana; sub: string; revision: boolean; arriba: boolean }) {
  const video = useVideo(tutorial.pestana);
  const [cerrado, setCerrado] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    // Con sonido si el navegador deja (ya hubo un clic en la página); si no, en silencio, con sus controles.
    v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
  }, [video?.archivo]);
  if (cerrado || (!video && !revision)) return null;
  return (
    <aside className="mk-tuto__video" data-arriba={arriba ? '' : undefined} aria-label={`El video de ${tutorial.nombre}`}>
      <header className="mk-tuto__vcab"><span className="mk-tuto__vfoto" aria-hidden>M</span><b>Martín · MaKo</b>
        <button type="button" className="mk-tuto__vx" aria-label="Cerrar el video" onClick={() => setCerrado(true)}>×</button></header>
      {video
        ? <video ref={ref} className="mk-tuto__vid" src={video.archivo} poster={video.poster} controls playsInline preload="metadata" />
        : <div className="mk-tuto__lugar" role="note"><b>Tu video de esta pestaña</b><span>Todavía no está grabado: va acá.</span></div>}
      {!video && sub && <p className="mk-tuto__sub">{sub}</p>}
    </aside>
  );
}

// ⚠️ SIN COMILLAS INVERTIDAS ADENTRO (es un template literal: AGENTS.md).
const CSS_TUTORIAL = `
.mk-tuto { pointer-events: none; }
.mk-tuto .mk-rec__velo, .mk-tuto .mk-rec__tarjeta, .mk-tuto__video, .mk-tuto__tapa { pointer-events: auto; }
.mk-tuto__tapa { position: fixed; }
.mk-tuto__haz { display: flex; align-items: center; gap: 8px; margin: 10px 0 0; font-size: var(--fs-sm); font-weight: 650; color: var(--ink); }
.mk-tuto__punto { width: 9px; height: 9px; border-radius: 999px; background: var(--ink); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ink) 18%, transparent); flex: none; }
.mk-tuto__video { position: fixed; right: max(16px, env(safe-area-inset-right, 0px)); bottom: max(16px, env(safe-area-inset-bottom, 0px)); width: min(300px, calc(100vw - 32px)); background: #0E1219; color: #fff; border-radius: var(--r-lg); box-shadow: 0 18px 44px rgba(0,0,0,.35); overflow: hidden; }
.mk-tuto__video[data-arriba] { bottom: auto; top: max(16px, env(safe-area-inset-top, 0px)); }
.mk-tuto__vcab { display: flex; align-items: center; gap: 8px; padding: 8px 10px; font-size: var(--fs-meta); }
.mk-tuto__vfoto { width: 22px; height: 22px; border-radius: 999px; display: grid; place-items: center; background: #F2B01E; color: #1a1405; font-weight: 800; font-size: 12px; }
.mk-tuto__vx { margin-left: auto; width: 26px; height: 26px; border: 0; border-radius: 8px; background: rgba(255,255,255,.12); color: #fff; font-size: 16px; line-height: 1; cursor: pointer; }
.mk-tuto__vid { display: block; width: 100%; aspect-ratio: 16 / 9; background: #000; }
.mk-tuto__lugar { margin: 0 10px; aspect-ratio: 16 / 9; border: 1.5px dashed rgba(255,255,255,.4); border-radius: var(--r-md); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; text-align: center; padding: 8px; }
.mk-tuto__lugar b { font-size: var(--fs-sm); }
.mk-tuto__lugar span { font-size: var(--fs-meta); opacity: .75; }
.mk-tuto__sub { margin: 8px 12px 12px; font-size: var(--fs-meta); line-height: 1.45; color: rgba(255,255,255,.88); }
@media (max-width: 767px) { .mk-tuto__video { width: min(220px, calc(100vw - 32px)); } }
`;
