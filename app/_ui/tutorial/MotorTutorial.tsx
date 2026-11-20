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
//   · EL VIDEO Y LA MARCA JUNTOS (Martín, 18/11): si el video trae sus frases con marca, apenas está (arranca solo) los pasos los pone el
//     video. Al llegar una frase con `sel`, marca ese lugar (con el texto y el lado del paso de lib/tutoriales que marca lo mismo) y,
//     si `espera_clic`, PAUSA hasta que tocan lo marcado o «Siguiente». Si `cierra_despues`, cierra el panel que se abrió antes de
//     marcar lo siguiente. Una marca que no está en la página no frena nada. Al terminar el video, el cierre es el CTA del tutorial.
// =============================================================================
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { Button } from '../Button';
import { cssRecorrido, useRecorrido } from '../Recorrido';
import { Z_PISO_RECORRIDO, necesitaScroll, posicionTarjeta, recorteDe, type Caja, type Medida, type PosicionTarjeta } from '@/lib/recorridos';
import { pasosPara, tutorialDeRuta, type PasoTutorial, type TutorialPestana } from '@/lib/tutoriales';
import { motorPresente, mostrarTutorial, senalAhora, terminar, useSenal, type MotivoFin, type Senal } from './store';
import { useVideoTutorial } from './useVideoTutorial';
import { fraseParaMarcar, hazDeFrase, mismoLugar, nombreDeFrase, sigueLosPasos, type FraseVideo, type VideoTutorial } from '@/lib/tutoriales/videos';
import { TUTORIAL_RECORRIDO } from '@/lib/onboarding-v2/recorrido';
import { marcarVistoEnEnsayo, salirDelEnsayo, useEnsayo, vistoEnEnsayo } from './desde-cero';
import { mostrarLaBarra, presentaLaBarra } from './barra-oculta';

/**
 * Los tutoriales cuyo video tiene que seguir SUS pasos, en su orden (`sigueLosPasos`): el recorrido aprobado. El «recorrido» de la
 * mañana del 18/11 marcaba Funnel Coach, Uso, la Ticketera y el reto, y se perdió el recorrido de Martín («el video sigue al
 * recorrido, nunca al revés»). Si el video no es fiel, el tutorial va sin él.
 */
const VIDEO_FIEL = new Set(['recorrido']);
/** Cuánto se espera a que aparezca lo de un paso antes de saltearlo. */
const ESPERA_PASO_MS = 3000;
/** Cuánto se espera a que el video del tutorial traiga sus frases antes de arrancar con el primer paso (el manifiesto llega rápido). */
const ESPERA_VIDEO_MS = 1500;
/** Cuánto queda escondida la barra sin que arranque un tutorial que la presente. */
const ESPERA_BARRA_MS = 9000;
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

/**
 * El z-index que necesita el motor para quedar ENCIMA de la capa de lo marcado. La ficha rápida del CRM (app/_ui/TarjetaKanban.tsx)
 * tiene su velo en 1200: con el motor en 400, «Mover a…» quedaba marcado DEBAJO (sin anillo, sin tarjeta, con el video pausado).
 */
function zParaMarcar(el: HTMLElement | null): number {
  const zDe = (desde: Element | null) => {
    let z = Z_PISO_RECORRIDO;
    for (let x: Element | null = desde; x && x !== document.body; x = x.parentElement) {
      const cs = getComputedStyle(x);
      const n = parseInt(cs.zIndex, 10);
      if (cs.position !== 'static' && Number.isFinite(n)) z = Math.max(z, n + 1);
    }
    return z;
  };
  // También encima de un panel modal abierto (la ficha que abrió «Ver info»): si no, el video chico queda bajo su velo.
  let z = zDe(el);
  for (const d of Array.from(document.querySelectorAll('[aria-modal="true"]'))) if (!d.closest('.mk-tuto') && d.getClientRects().length) z = Math.max(z, zDe(d));
  return z;
}

/** El paso que marca una frase del video: el de lib/tutoriales que marca lo mismo (su título, su texto y su lado) o, si no hay, la frase. */
function pasoDeFrase(f: FraseVideo, pasos: readonly PasoTutorial[]): PasoTutorial {
  const sel = f.sel ?? '';
  const mismo = sel ? pasos.find((p) => mismoLugar(p.sel, sel)) : undefined;
  return {
    sel: mismo?.sel ?? sel,
    titulo: mismo?.titulo ?? nombreDeFrase(f.texto) ?? (f.espera_clic ? 'Toca aquí' : 'Mira aquí'),
    texto: mismo?.texto ?? f.texto,
    lado: mismo?.lado,
    ...(f.espera_clic ? { clic: true as const, haz: mismo?.haz ?? hazDeFrase(f.texto) ?? 'Haz clic en lo marcado' } : {}),
  };
}

/**
 * Cierra lo que abrió lo tocado (un panel, otra vista) antes de marcar lo siguiente, para que no lo tape: un Escape y, si sigue
 * abierto, su botón de cerrar. El Escape del motor NO omite el tutorial (el manejador de abajo sólo oye los de la persona).
 */
function cerrarLoAbierto(): void {
  const foco = document.activeElement;
  const destino = foco instanceof HTMLElement && foco !== document.body && !foco.closest('.mk-tuto') ? foco : document.body;
  destino.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
  window.setTimeout(() => {
    for (const d of Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"], [aria-modal="true"]'))) {
      if (d.closest('.mk-tuto') || !d.getClientRects().length) continue;
      d.querySelector<HTMLElement>('[aria-label^="Cerrar"], [aria-label^="cerrar"], [data-cerrar]')?.click();
    }
  }, 120);
}

// ── El motor ──────────────────────────────────────────────────────────────────────────────────────────────────────────
export function MotorTutorial({ revision }: { revision: boolean }) {
  useEffect(() => {
    motorPresente(true, (ruta) => !!tutorialDeRuta(ruta));
    return () => motorPresente(false);
  }, []);
  const senal = useSenal();
  const ensayo = useEnsayo();
  // La barra escondida al entrar (./barra-oculta.ts) nunca queda sin salida: si en un rato no arrancó ningún tutorial, vuelve.
  useEffect(() => { if (senal) return; const t = window.setTimeout(mostrarLaBarra, ESPERA_BARRA_MS); return () => window.clearTimeout(t); }, [senal]);
  return (
    <>
      {ensayo.activo && (
        <div className="mk-tuto-ensayo" role="status">
          <style>{CSS_ENSAYO}</style>
          <span>Viendo el onboarding desde cero: no se guarda nada.</span>
          <button type="button" onClick={salirDelEnsayo}>Salir del ensayo</button>
        </div>
      )}
      <TutorialDeLaRuta />
      {senal && senal.tipo === 'video' && <VideoFlotante key={senal.id} senal={senal} />}
      {senal && senal.tipo !== 'video' && <Capa key={senal.id} senal={senal} revision={revision} />}
    </>
  );
}

/** La primera vez en una pestaña con tutorial: lo arranca solo, cuando su primer paso ya está en la pantalla. */
function TutorialDeLaRuta() {
  const ruta = usePathname() ?? '/';
  const t = tutorialDeRuta(ruta);
  return t ? <><PrimeraVez key={t.pestana} t={t} /><BotonDelVideo t={t} /></> : null;
}

/** El «?» de cada pestaña con tutorial (Martín, 18/11: «el botoncito de pregunta… si el usuario cerró el video, pueda volver a
 *  abrirlo»): abajo a la derecha, mientras no corre nada; vuelve a abrir el video de la pestaña, directo y con sus marcas. */
function BotonDelVideo({ t }: { t: TutorialPestana }) {
  const senal = useSenal();
  if (senal) return null;
  return (
    <button type="button" className="mk-tuto-ayuda" aria-label={`Ver el video de ${t.nombre}`} title="Ver el video de esta pestaña"
      onClick={() => mostrarTutorial(t, { directo: true })}>
      <style>{CSS_AYUDA}</style>
      <span aria-hidden>?</span>
    </button>
  );
}
// ⚠️ SIN COMILLAS INVERTIDAS ADENTRO (es un template literal: AGENTS.md).
const CSS_AYUDA = `
.mk-tuto-ayuda { position: fixed; right: max(16px, env(safe-area-inset-right, 0px)); bottom: calc(16px + env(safe-area-inset-bottom, 0px)); z-index: 900; width: 34px; height: 34px; border-radius: 50%; border: 1px solid var(--border); background: var(--surface); color: var(--ink); font: inherit; font-weight: 700; font-size: 16px; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,.14); padding: 0; }
.mk-tuto-ayuda:hover { background: var(--surface-2, rgba(0,0,0,.05)); }
@media (max-width: 640px) { .mk-tuto-ayuda { bottom: calc(84px + env(safe-area-inset-bottom, 0px)); } }
`;
function PrimeraVez({ t }: { t: TutorialPestana }) {
  // En el ensayo «desde cero» (./desde-cero.ts), lo visto vive en el navegador y no se le escribe al server.
  const ensayo = useEnsayo();
  const id = `tutorial-${t.pestana}`;
  const r = useRecorrido(id, { autoabrir: !ensayo.activo });
  const pedido = useRef(false);
  const abierto = ensayo.activo ? !vistoEnEnsayo(id) : r.abierto;
  const cerrarDeVerdad = r.onCerrar;
  const onCerrar = useCallback((m: MotivoFin) => { if (ensayo.activo) marcarVistoEnEnsayo(id); else cerrarDeVerdad(m); }, [ensayo.activo, id, cerrarDeVerdad]);
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
      // La PRIMERA vez en el Ops Center (recién salida del onboarding), el video del recorrido en lugar del de la pestaña: presenta
      // a los coaches, Uso, la Ticketera y termina mandando al chat del reto (acordado con el chat de los videos, 18/11).
      // La PRIMERA vez en el Ops Center, el RECORRIDO APROBADO (lib/onboarding-v2/recorrido.ts) en lugar del tutorial de la pestaña:
      // el reto, la barra, el Second Brain, la Ticketera. Lo visto se anota como el del Ops Center, así sale una vez.
      // Martín, 18/11, noche: «no es necesario que cada vez que entro en una pestaña me diga cómo funciona… omitir recorrido y
      // empezar… solamente que esté el video abajo a la derecha». Una pestaña abre DIRECTO su video (con sus marcas); el recorrido
      // aprobado del Ops Center sigue con su presentación.
      if (lugarDe(pasos[0].sel) || Date.now() - desde > 6000) { pedido.current = true; mostrarTutorial(t.pestana === 'ops-center' ? TUTORIAL_RECORRIDO : t, { alTerminar: onCerrar, ...(t.pestana === 'ops-center' ? {} : { directo: true }) }); return; }
      window.setTimeout(mirar, 250);
    };
    const id = window.setTimeout(mirar, 600);
    return () => { vivo = false; window.clearTimeout(id); };
  }, [abierto, onCerrar, t]);
  return null;
}

type Geo = { hueco: Caja | null; tarjeta: PosicionTarjeta | null };

/** Un video que salió de su lugar: abajo a la derecha, desde donde iba, con su ✕. Termina solo al terminar el video. */
function VideoFlotante({ senal }: { senal: Extract<Senal, { tipo: 'video' }> }) {
  const v = useVideoTutorial(senal.clave);
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const arrancar = () => { try { el.currentTime = senal.desde; } catch { /* */ } el.play().catch(() => { el.muted = true; el.play().catch(() => {}); }); };
    if (el.readyState >= 1) arrancar(); else el.addEventListener('loadedmetadata', arrancar, { once: true });
  }, [v?.archivo, senal.desde]);
  if (!v || typeof document === 'undefined') return null;
  return createPortal(
    <div className="mk-tuto" style={{ zIndex: Z_PISO_RECORRIDO }}>
      <style>{CSS_TUTORIAL}</style>
      <div role="complementary" className="mk-tuto__video" aria-label={`El video: ${senal.titulo}`}>
        <header className="mk-tuto__vcab"><span className="mk-tuto__vfoto" aria-hidden>M</span><b>Martín · MaKo</b>
          <button type="button" className="mk-tuto__vx" aria-label="Cerrar el video" onClick={() => terminar(senal.id, 'omitido')}>
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
          </button></header>
        <video ref={ref} className="mk-tuto__vid" src={v.archivo} poster={v.poster} controls playsInline preload="metadata" onEnded={() => terminar(senal.id, 'fin')} />
      </div>
    </div>,
    document.body,
  );
}

type SenalConCapa = Exclude<Senal, { tipo: 'video' }>;
function Capa({ senal, revision }: { senal: SenalConCapa; revision: boolean }) {
  const telefono = typeof window !== 'undefined' && window.innerWidth < ANCHO_TELEFONO;
  const pasos: PasoTutorial[] = useMemo(() => (senal.tipo === 'tutorial' ? pasosPara(senal.tutorial, telefono) : [senal.paso]), [senal, telefono]);
  // -1 = la presentación de la pestaña (su `intro`), antes del primer paso. Una marca va directo a su lugar.
  const [i, setI] = useState(senal.tipo === 'tutorial' && senal.tutorial.intro ? -1 : 0);
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [geo, setGeo] = useState<Geo>({ hueco: null, tarjeta: null });
  const [videoArriba, setVideoArriba] = useState(false);
  const tarjetaRef = useRef<HTMLDivElement>(null);

  // El video de la pestaña y, si trae frases con marca, el modo en que el video manda (arranca solo apenas está).
  const videoPedido = useVideoTutorial(senal.tipo === 'tutorial' ? senal.video ?? null : null);
  const videoPropio = useVideoTutorial(senal.tipo === 'tutorial' ? senal.tutorial.pestana : null);
  const videoAlgun = videoPedido ?? videoPropio;
  const video = videoAlgun && senal.tipo === 'tutorial' && VIDEO_FIEL.has(senal.tutorial.pestana) && !sigueLosPasos(videoAlgun.frases ?? [], senal.tutorial.pasos) ? null : videoAlgun;
  // Con otro video que el de la pestaña (el recorrido), su cierre es SU último lugar marcado («toca aquí, en Reto de 7 días»), no el
  // último paso del tutorial de la pestaña.
  const conVideoPedido = !!videoPedido;
  const frases = useMemo(() => video?.frases ?? [], [video]);
  const conFrases = senal.tipo === 'tutorial' && frases.some((f) => f.sel);
  const vidRef = useRef<HTMLVideoElement>(null);
  const [modoVideo, setModoVideo] = useState(false);
  const [frase, setFrase] = useState<FraseVideo | null>(null);
  const [cierre, setCierre] = useState(false);
  const [cierreFrase, setCierreFrase] = useState<FraseVideo | null>(null);
  const hechas = useRef(new Set<string>());
  /** La frase cuyo lugar todavía no está (se acaba de navegar): se la espera un poco, con el video quieto. */
  const esperando = useRef<{ id: string; desde: number } | null>(null);
  // Las que la persona TOCÓ (no las que sólo se mostraron o pasó con «Siguiente»): el cierre no repite un CTA ya tocado.
  const tocadas = useRef(new Set<string>());
  const porCerrar = useRef(false);
  const pasoFrase = useMemo(() => (frase ? pasoDeFrase(frase, pasos) : null), [frase, pasos]);
  const ultimoPaso = pasos[pasos.length - 1] ?? null;

  const pasoCierre = useMemo(() => {
    if (!cierreFrase) return ultimoPaso;
    const p = pasoDeFrase(cierreFrase, pasos);
    return { ...p, clic: true as const, haz: p.haz ?? hazDeFrase(cierreFrase.texto) ?? 'Haz clic en lo marcado' };
  }, [cierreFrase, ultimoPaso, pasos]);
  const paso = modoVideo ? (cierre ? pasoCierre : pasoFrase) : i >= 0 ? pasos[i] : null;
  const ultimo = modoVideo ? cierre : i === pasos.length - 1;
  const esperaClic = senal.tipo === 'marca' ? !senal.listo : modoVideo ? (cierre ? !!pasoCierre?.clic : !!frase?.espera_clic) : !!(paso?.clic && ultimo);
  // Entre una frase con marca y la siguiente, sólo el video: ni velo ni tarjeta (la página sigue usable).
  const soloVideo = modoVideo && !paso;

  // Al terminar (también salteado), la barra escondida al entrar vuelve (./barra-oculta.ts).
  const fin = useCallback((como: 'fin' | 'omitido' | 'hecho') => { mostrarLaBarra(); terminar(senal.id, como); }, [senal.id]);
  /** Terminó el video: el cierre es el CTA del tutorial (su último paso, con «Haz clic en…»), si no se tocó ya con el video. */
  const irAlCierre = useCallback(() => {
    const decidir = () => {
      if (conVideoPedido) {
        // El cierre del video pedido: su último lugar marcado, si no lo tocó ya y está en la página.
        const f = [...frases].reverse().find((x) => !!x.sel);
        if (f && !tocadas.current.has(f.id) && lugarDe(pasoDeFrase(f, pasos).sel)) { setCierreFrase(f); setCierre(true); }
        else fin('fin');
        return;
      }
      const u = pasos[pasos.length - 1];
      const yaTocado = !!u && frases.some((f) => !!f.sel && tocadas.current.has(f.id) && mismoLugar(u.sel, f.sel));
      if (u?.clic && !yaTocado && lugarDe(u.sel)) setCierre(true);
      else fin('fin');
    };
    if (porCerrar.current) { porCerrar.current = false; cerrarLoAbierto(); window.setTimeout(decidir, 300); } else decidir();
  }, [pasos, frases, fin, conVideoPedido]);
  /** La frase marcada ya está (la tocaron, «Siguiente», o pasó su tiempo): el video sigue. */
  const seguirVideo = useCallback((porClic = false) => {
    if (frase) {
      hechas.current.add(frase.id);
      if (porClic) { tocadas.current.add(frase.id); if (senal.tipo === 'tutorial' && frase.sel) senal.alTocar?.(pasoFrase?.sel ?? frase.sel); }
      if (frase.cierra_despues) porCerrar.current = true;
    }
    setFrase(null); setEl(null); setGeo({ hueco: null, tarjeta: null });
    const v = vidRef.current;
    if (!v || v.ended) irAlCierre(); else void v.play().catch(() => {});
  }, [frase, irAlCierre, senal, pasoFrase]);
  const siguiente = useCallback(() => {
    if (modoVideo) { if (cierre) fin('fin'); else seguirVideo(); return; }
    // Al arrancar, con un video que trae sus frases: desde aquí manda el video (con sonido si el navegador deja; si no, en silencio).
    if (i === -1 && conFrases && vidRef.current) {
      const v = vidRef.current;
      setModoVideo(true);
      v.muted = false; v.currentTime = 0;
      void v.play().catch(() => { v.muted = true; void v.play().catch(() => {}); });
      return;
    }
    if (i >= pasos.length - 1) { fin(senal.tipo === 'marca' ? 'hecho' : 'fin'); return; }
    setEl(null); setGeo({ hueco: null, tarjeta: null }); setI(i + 1);
  }, [modoVideo, cierre, seguirVideo, i, conFrases, pasos.length, fin, senal.tipo]);
  // SIN LA PRESENTACIÓN, NUNCA (Martín, 19/11: el cuadro de la presentación, con «Omitir recorrido» y «Empezar»: «no lo quiero ver
  // nunca más en ningún lugar de ninguna tab… muy, muy, muy molesto»). Todo tutorial arranca solo: con un video que trae sus frases,
  // el video manda apenas está; sin él, el primer paso. Para saltearlo, se cierra el video del costado (`VideoChico` → `fin`).
  useEffect(() => { if (conFrases && !modoVideo && i === -1 && vidRef.current) siguiente(); }, [conFrases, modoVideo, i, siguiente]);
  useEffect(() => {
    if (i !== -1 || conFrases || modoVideo) return;
    const t = window.setTimeout(() => { setEl(null); setGeo({ hueco: null, tarjeta: null }); setI(0); }, ESPERA_VIDEO_MS);
    return () => window.clearTimeout(t);
  }, [i, conFrases, modoVideo]);

  // 0b. Lo marcado por una frase desapareció (cerraron el panel tocando afuera, cambió la vista): el video sigue, nunca queda
  // pausado sin salida.
  useEffect(() => {
    if (!modoVideo || !frase || el) return;
    const sel = pasoFrase?.sel;
    const id = window.setTimeout(() => { if (!sel || !lugarDe(sel)) seguirVideo(); }, ESPERA_PASO_MS);
    return () => window.clearTimeout(id);
  }, [modoVideo, frase, el, pasoFrase, seguirVideo]);

  // 0c. La pausa al final de la frase, justa: `timeupdate` llega cada ~250 ms y la pausa caería en la frase siguiente.
  useEffect(() => {
    const v = vidRef.current;
    if (!modoVideo || !frase || !frase.espera_clic || !v) return;
    const fin = frase.t_fin;
    let id = 0;
    const mirar = () => { if (!v.paused && v.currentTime >= fin - 0.05) { v.pause(); return; } id = requestAnimationFrame(mirar); };
    id = requestAnimationFrame(mirar);
    return () => cancelAnimationFrame(id);
  }, [modoVideo, frase]);

  // 0. El video manda: con cada avance, ¿llegó una frase con marca? La marca, y la pausa si espera el clic.
  useEffect(() => {
    const v = vidRef.current;
    if (!modoVideo || cierre || !v) return;
    const alAvanzar = () => {
      const t = v.currentTime;
      // Martín, 18/11: «pausás el video previo a lo que deberías pausar… está narrando todavía lo de Funnel Coach». La marca sale en
      // el t_inicio de su frase y se QUEDA mientras la voz la narra; la pausa (espera_clic) va en su t_fin, en el silencio del final.
      if (frase) { if (t >= frase.t_fin - 0.05) { if (frase.espera_clic) { if (!v.paused) v.pause(); } else seguirVideo(); } return; }
      const f = fraseParaMarcar(frases, t, hechas.current);
      if (!f) return;
      // Lo que abrió la frase anterior se cierra primero; la próxima vuelta (≈250 ms) ya marca.
      if (porCerrar.current) { porCerrar.current = false; cerrarLoAbierto(); return; }
      // La frase que presenta la barra la muestra antes de buscarla (estaba escondida desde «Entrar a MaKo»: ./barra-oculta.ts).
      if (presentaLaBarra(pasoDeFrase(f, pasos).sel)) mostrarLaBarra();
      // Una marca que no está en la página no frena el video; si se acaba de navegar, se la espera hasta 4 s (con el video quieto).
      if (!lugarDe(pasoDeFrase(f, pasos).sel)) {
        if (esperando.current?.id !== f.id) { esperando.current = { id: f.id, desde: Date.now() }; v.pause(); }
        const w = esperando.current;
        const reintentar = () => {
          if (esperando.current !== w) return;
          if (lugarDe(pasoDeFrase(f, pasos).sel)) { esperando.current = null; setFrase(f); void v.play().catch(() => {}); return; }
          if (Date.now() - w.desde > 4000) { esperando.current = null; hechas.current.add(f.id); void v.play().catch(() => {}); return; }
          window.setTimeout(reintentar, 250);
        };
        window.setTimeout(reintentar, 250);
        return;
      }
      setFrase(f);
    };
    // Terminó con una «Mira aquí» marcada: se suelta y va al cierre. Con una que espera el clic, espera (el clic lleva al cierre).
    const alTerminar = () => { if (!frase) irAlCierre(); else if (!frase.espera_clic) seguirVideo(); };
    v.addEventListener('timeupdate', alAvanzar);
    v.addEventListener('ended', alTerminar);
    return () => { v.removeEventListener('timeupdate', alAvanzar); v.removeEventListener('ended', alTerminar); };
  }, [modoVideo, cierre, frase, frases, pasos, seguirVideo, irAlCierre]);
  const atras = () => { if (i > 0) { setEl(null); setGeo({ hueco: null, tarjeta: null }); setI(i - 1); } };

  // 1. Cada paso: lo de `antes`, y esperar a que aparezca lo marcado (hasta 3 s; una marca espera siempre).
  useEffect(() => {
    if (!paso) return;
    // El paso que presenta la barra la muestra (estaba escondida desde «Entrar a MaKo»: ./barra-oculta.ts).
    if (presentaLaBarra(paso.sel)) mostrarLaBarra();
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
    // Una vez (`pointerdown` y `click` llegan los dos): con el video mandando, el video sigue; si no, termina.
    let tocado = false;
    const alTocar = (e: Event) => {
      if (tocado || !(e.target instanceof Node) || !el.contains(e.target)) return;
      tocado = true;
      window.setTimeout(() => (modoVideo && !cierre ? seguirVideo(true) : fin(senal.tipo === 'marca' ? 'hecho' : 'fin')), 0);
    };
    window.addEventListener('pointerdown', alTocar, true);
    window.addEventListener('click', alTocar, true);
    return () => { window.removeEventListener('pointerdown', alTocar, true); window.removeEventListener('click', alTocar, true); };
  }, [el, esperaClic, fin, senal.tipo, modoVideo, cierre, seguirVideo]);

  // 4. Escape: omitir el tutorial (una marca sólo si se puede dejar para después).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Sólo el de la persona: con el Escape del motor se cierra un panel (cerrarLoAbierto), no el tutorial.
      if (!e.isTrusted) return;
      if (senal.tipo === 'marca' && !senal.alOmitir) return;
      e.preventDefault(); e.stopImmediatePropagation(); fin('omitido');
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [fin, senal]);

  if (typeof document === 'undefined') return null;
  const t = geo.tarjeta;
  const visible = !!t && !!paso && !!geo.hueco;
  const z = zParaMarcar(el);
  const estiloFlecha: CSSProperties | null = paso && t && t.flecha != null ? (t.lado === 'abajo' || t.lado === 'arriba' ? { left: t.flecha - 6 } : { top: t.flecha - 6 }) : null;
  const titulo = paso ? paso.titulo : '';
  const texto = paso ? paso.texto : '';
  const haz = esperaClic ? (paso?.haz ?? (senal.tipo === 'marca' ? senal.paso.haz : null)) : null;
  const total = senal.tipo === 'tutorial' ? pasos.length : 1;

  return createPortal(
    <div className="mk-rec mk-tuto" data-tutorial={senal.tipo === 'tutorial' ? senal.tutorial.pestana : 'marca'} style={{ zIndex: z }}>
      <style>{cssRecorrido() + CSS_TUTORIAL}</style>
      {senal.tipo === 'tutorial' && (
        <VideoChico tutorial={senal.tutorial} video={video} vidRef={vidRef} autoplay={!conFrases} manda={soloVideo}
          sub={paso?.sub ?? senal.tutorial.intro} revision={revision} arriba={videoArriba}
          onCerrar={() => fin('omitido')} onOmitir={() => fin('omitido')} />
      )}
      {geo.hueco
        ? <>
            <div className="mk-rec__hueco" style={{ left: geo.hueco.x, top: geo.hueco.y, width: geo.hueco.ancho, height: geo.hueco.alto }} aria-hidden />
            {!(senal.tipo === 'marca' && senal.libre) && <Tapas h={geo.hueco} />}
          </>
        // Sin hueco, nada: un paso que todavía espera su lugar NO tapa nada (si no aparece, la página sigue usable). La presentación
        // con el velo entero ya no existe (19/11).
        : null}
      <div ref={tarjetaRef} className="mk-rec__tarjeta" role="dialog" aria-modal="false" aria-label={titulo} tabIndex={-1}
        style={{ left: t?.x ?? 0, top: t?.y ?? 0, visibility: visible && !soloVideo ? 'visible' : 'hidden' }}>
        {estiloFlecha && t && <span className="mk-rec__flecha" data-lado={t.lado} style={estiloFlecha} aria-hidden />}
        <div key={modoVideo ? (frase?.id ?? (cierre ? 'cierre' : 'video')) : i} className="mk-rec__cuerpo">
          {paso && total > 1 && !modoVideo && <div className="mk-rec__cont">{i + 1} de {total}</div>}
          <h2 className="mk-rec__tit">{titulo}</h2>
          {texto && <p className="mk-rec__txt">{texto}</p>}
          {haz && <p className="mk-tuto__haz"><span aria-hidden className="mk-tuto__punto" />{haz}</p>}
        </div>
        <Pie senal={senal} paso={paso} ultimo={ultimo} esperaClic={esperaClic} hayAnterior={i > 0 && !modoVideo} conVideo={modoVideo && !cierre}
          siguiente={siguiente} atras={atras} fin={fin} />
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

function Pie({ senal, paso, ultimo, esperaClic, hayAnterior, conVideo, siguiente, atras, fin }: {
  senal: SenalConCapa; paso: PasoTutorial | null; ultimo: boolean; esperaClic: boolean; hayAnterior: boolean; conVideo: boolean;
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
      {/* Con el video mandando, «Siguiente» sigue sin tocar lo marcado (Martín: «hasta que toque el botón marcado, o Siguiente»). */}
      {(conVideo || !esperaClic) && <Button variant="primary" size="sm" onClick={siguiente}>{conVideo ? 'Siguiente' : ultimo ? 'Listo' : 'Siguiente'}</Button>}
    </div>
  );
}

/**
 * El video chico de Martín de ESTA pestaña, abajo a la derecha. Sin video, nada (en la revisión, su lugar marcado). Con frases con
 * marca, manda desde que arranca; entre frase y frase (sin tarjeta) lleva «Omitir recorrido» abajo (`manda`). Cerrarlo saltea el tutorial.
 */
function VideoChico({ tutorial, video, vidRef, autoplay, manda, sub, revision, arriba, onCerrar, onOmitir }: {
  tutorial: TutorialPestana; video: VideoTutorial | null; vidRef: RefObject<HTMLVideoElement | null>; autoplay: boolean; manda: boolean;
  sub: string; revision: boolean; arriba: boolean; onCerrar: () => void; onOmitir: () => void;
}) {
  const [cerrado, setCerrado] = useState(false);
  useEffect(() => {
    const v = vidRef.current;
    if (!v || !autoplay) return;
    // Con sonido si el navegador deja (ya hubo un clic en la página); si no, en silencio, con sus controles.
    v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
  }, [video?.archivo, autoplay, vidRef]);
  if (cerrado || (!video && !revision)) return null;
  const cerrar = () => { vidRef.current?.pause(); setCerrado(true); onCerrar(); };
  return (
    <div role="complementary" className="mk-tuto__video" data-arriba={arriba ? '' : undefined} aria-label={`El video de ${tutorial.nombre}`}>
      <header className="mk-tuto__vcab"><span className="mk-tuto__vfoto" aria-hidden>M</span><b>Martín · MaKo</b>
        <button type="button" className="mk-tuto__vx" aria-label="Cerrar el video" onClick={cerrar}>
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
        </button></header>
      {video
        ? <video ref={vidRef} className="mk-tuto__vid" src={video.archivo} poster={video.poster} controls playsInline preload="metadata" />
        : <div className="mk-tuto__lugar" role="note"><b>Tu video de esta pestaña</b><span>Todavía no está grabado: va aquí.</span></div>}
      {!video && sub && <p className="mk-tuto__sub">{sub}</p>}
      {manda && <div className="mk-tuto__vpie"><button type="button" onClick={onOmitir}>Omitir recorrido</button></div>}
    </div>
  );
}

const CSS_ENSAYO = `
.mk-tuto-ensayo { position: fixed; top: max(10px, env(safe-area-inset-top, 0px)); left: 50%; transform: translateX(-50%); z-index: 590; display: flex; align-items: center; gap: 10px; padding: 6px 8px 6px 14px; border-radius: 999px; background: var(--ink); color: var(--surface); font-size: var(--fs-meta); box-shadow: 0 8px 24px rgba(0,0,0,.25); max-width: calc(100vw - 32px); }
.mk-tuto-ensayo button { border: 0; border-radius: 999px; padding: 5px 10px; background: var(--surface); color: var(--ink); font: inherit; font-weight: 700; cursor: pointer; white-space: nowrap; }
.mk-tuto-ensayo span { white-space: nowrap; }
@media (max-width: 640px) { .mk-tuto-ensayo { left: 12px; right: 12px; transform: none; border-radius: 14px; padding: 8px 8px 8px 12px; } .mk-tuto-ensayo span { flex: 1; min-width: 0; white-space: normal; line-height: 1.35; } }
`;

// ⚠️ SIN COMILLAS INVERTIDAS ADENTRO (es un template literal: AGENTS.md).
const CSS_TUTORIAL = `
.mk-tuto { pointer-events: none; }
.mk-tuto .mk-rec__velo, .mk-tuto .mk-rec__tarjeta, .mk-tuto__video, .mk-tuto__tapa { pointer-events: auto; }
.mk-tuto__tapa { position: fixed; }
.mk-tuto .mk-rec__tarjeta { z-index: 3; }
.mk-tuto__haz { display: flex; align-items: center; gap: 8px; margin: 10px 0 0; font-size: var(--fs-sm); font-weight: 650; color: var(--ink); }
.mk-tuto__punto { width: 9px; height: 9px; border-radius: 999px; background: var(--ink); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ink) 18%, transparent); flex: none; }
.mk-tuto__video { position: fixed; z-index: 2; right: max(16px, env(safe-area-inset-right, 0px)); bottom: max(16px, env(safe-area-inset-bottom, 0px)); width: min(300px, calc(100vw - 32px)); background: #0E1219; color: #fff; border-radius: var(--r-lg); box-shadow: 0 18px 44px rgba(0,0,0,.35); overflow: hidden; }
.mk-tuto__video[data-arriba] { bottom: auto; top: max(16px, env(safe-area-inset-top, 0px)); }
.mk-tuto__vcab { display: flex; align-items: center; gap: 8px; padding: 8px 10px; font-size: var(--fs-meta); }
.mk-tuto__vfoto { width: 22px; height: 22px; border-radius: 999px; display: grid; place-items: center; background: #F2B01E; color: #1a1405; font-weight: 800; font-size: 12px; }
.mk-tuto__vx { margin-left: auto; width: 26px; height: 26px; border: 0; border-radius: 8px; background: #E5484D; color: #fff; display: flex; align-items: center; justify-content: center; padding: 0; cursor: pointer; }
.mk-tuto__vx svg { display: block; }
.mk-tuto__vpie { padding: 6px 10px 8px; }
.mk-tuto__vpie button { border: 0; background: none; padding: 2px 0; color: rgba(255,255,255,.8); font: inherit; font-size: var(--fs-meta); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.mk-tuto__vid { display: block; width: 100%; aspect-ratio: 16 / 9; background: #000; }
.mk-tuto__lugar { margin: 0 10px; aspect-ratio: 16 / 9; border: 1.5px dashed rgba(255,255,255,.4); border-radius: var(--r-md); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; text-align: center; padding: 8px; }
.mk-tuto__lugar b { font-size: var(--fs-sm); }
.mk-tuto__lugar span { font-size: var(--fs-meta); opacity: .75; }
.mk-tuto__sub { margin: 8px 12px 12px; font-size: var(--fs-meta); line-height: 1.45; color: rgba(255,255,255,.88); }
@media (max-width: 767px) { .mk-tuto__video { width: min(220px, calc(100vw - 32px)); } }
`;
