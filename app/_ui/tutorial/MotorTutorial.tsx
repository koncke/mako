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
//     si `espera_clic`, PAUSA en su t_fin hasta que tocan lo marcado o «Siguiente» (que hace el mismo clic). Si `cierra_despues`,
//     cierra el panel que se abrió antes de marcar lo siguiente. Al terminar el video, el cierre es el CTA del tutorial.
//   · CUÁNDO PAUSA (20/11, ./pausas.ts): nunca en el t_inicio de una frase; una marca que no está no frena el video (se busca
//     mientras dura su voz). Después de un clic que navega o abre algo, el video se queda quieto en el silencio de la frase tocada
//     hasta que aparece la marca siguiente (con tope).
// =============================================================================
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useSearchParams } from 'next/navigation';
import { Button } from '../Button';
import { cssRecorrido, useRecorrido } from '../Recorrido';
import { Z_PISO_RECORRIDO, cajaVisible, necesitaScroll, posicionTarjeta, recorteDe, seVeEntero, type Caja, type Medida, type PosicionTarjeta } from '@/lib/recorridos';
import { pasosPara, tutorialDeRuta, type PasoTutorial, type TutorialPestana } from '@/lib/tutoriales';
import { anotarPasoDelMotor, anotarRevision, elChatPresentaElRecorrido, motorPresente, mostrarTutorial, senalAhora, terminar, useSenal, type MotivoFin, type Senal } from './store';
import { useManifiestoListo, useVideoTutorial } from './useVideoTutorial';
import { barrer, tocaIris } from './iris';
import { VideoEnLaEsquina } from './VideoEnLaEsquina';
import { cierraYa, fraseParaMarcar, hazDeFrase, mismoLugar, nombreDeFrase, sigueLosPasos, type FraseVideo, type VideoTutorial } from '@/lib/tutoriales/videos';
import { marcarVistoEnEnsayo, salirDelEnsayo, useEnsayo, vistoEnEnsayo } from './desde-cero';
import { barraEntera, mostrarLaBarra, presentaLaBarra } from './barra-oculta';
import { useLugarALaVista } from './lugarDelVideo';
import { BarraDelVideo, alternarVideo } from './BarraDelVideo';
import { CSS_REPRODUCTOR } from './VideoDelMomento';
import { instalarUnVideoALaVez } from './un-video-a-la-vez';
import { esDelRecorrido, tomarSalto } from '@/lib/onboarding-v2/salto-pendiente';
import { ID_RECORRIDO } from '@/lib/onboarding-v2/llegada';
import { TOPE_CADENA_MS, TOPE_CARGA_MS, alFinSinMarca, arrancaLaPrimeraVez, fraseQueSuena, retenerAlFin, comoCadena, navegaA, pasoDeLaCadena, saltarSinMarca, siguienteConMarca, soloEnComputadora, soltarRetencion, type Retencion } from './pausas';

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
/** Lo que tarda en cerrarse lo que abrió una frase (`cierra_despues`): hasta ahí no se marca nada encima. */
const MS_CIERRE = 300;
/** MaKo Mobile: por debajo de esto la pestaña es la del teléfono (los pasos `soloComputadora` no van). */
const ANCHO_TELEFONO = 768;

const ventanaActual = (): Medida => ({ ancho: window.innerWidth, alto: window.innerHeight });
const cajaDe = (r: DOMRect): Caja => ({ x: r.left, y: r.top, ancho: r.width, alto: r.height });
const menosMovimiento = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Lo marcado por un selector libre: el primero que tiene cajas. Un selector inválido es «no está». */
/** Las cajas de los contenedores que recortan a `el` (un hilo con scroll, una tarjeta con `overflow`): lo que queda afuera no se ve. */
function contenedoresDe(el: HTMLElement): Caja[] {
  const out: Caja[] = [];
  for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
    const cs = getComputedStyle(p);
    if (/(auto|scroll|hidden|clip)/.test(`${cs.overflowX} ${cs.overflowY}`)) out.push(cajaDe(p.getBoundingClientRect()));
  }
  return out;
}

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

/**
 * El paso que marca una frase del video: el de lib/tutoriales que marca lo mismo (su título, su texto, su lado, su `antes` y si es
 * `libre`) o, si no hay, la frase. El `antes` se perdía aquí (20/11): «Siguiente» en la frase del Second Brain dejaba el grafo sin
 * abrir, y la ficha del CRM, el modal del calendario o los editores de Classroom no se abrían nunca en el modo video.
 */
function pasoDeFrase(f: FraseVideo, pasos: readonly PasoTutorial[]): PasoTutorial {
  const sel = f.sel ?? '';
  const mismo = sel ? pasos.find((p) => mismoLugar(p.sel, sel)) : undefined;
  return {
    sel: mismo?.sel ?? sel,
    titulo: mismo?.titulo ?? nombreDeFrase(f.texto) ?? (f.espera_clic ? 'Toca aquí' : 'Mira aquí'),
    texto: mismo?.texto ?? f.texto,
    lado: mismo?.lado,
    ...(mismo?.antes ? { antes: mismo.antes } : {}),
    ...(mismo?.libre ? { libre: true as const } : {}),
    ...(f.espera_clic ? { clic: true as const, haz: mismo?.haz ?? hazDeFrase(f.texto) ?? 'Haz clic en lo marcado' } : {}),
  };
}

/** ¿La página está cargando? El loader de MaKo (CargandoMako, `.cm-carga`) o una pantalla de carga grande con `aria-busy`. */
function cargandoAhora(): boolean {
  for (const x of Array.from(document.querySelectorAll<HTMLElement>('.cm-carga, [aria-busy="true"]'))) {
    if (x.closest('.mk-tuto')) continue;
    const r = x.getBoundingClientRect();
    if (r.width > 0 && r.height >= (x.classList.contains('cm-carga') ? 1 : 200)) return true;
  }
  return false;
}
const urlAhora = () => window.location.href;
/** ¿Tocar esto lleva a otra página? (el link marcado, o el link adentro de lo marcado). */
function navegaAlTocar(el: HTMLElement): boolean {
  const a = el.closest<HTMLAnchorElement>('a[href]') ?? el.querySelector<HTMLAnchorElement>('a[href]');
  return !!a && navegaA(a.getAttribute('href'), urlAhora(), a.getAttribute('target'));
}

/**
 * Toca el `antes` de un paso. Uno solo, como siempre. Una CADENA (20/11: «Canal › Conectar un canal», «las hojas › Nueva hoja»):
 * desde el último eslabón que ya está a la vista (./pausas.ts → pasoDeLaCadena), y cada uno espera al siguiente hasta
 * TOPE_CADENA_MS. Si el siguiente no aparece (un rol sin esa opción), cierra lo abierto: nunca deja un menú colgado.
 */
function tocarAntes(antes: string | readonly string[], vivo: () => boolean): void {
  const cadena = comoCadena(antes);
  const i = pasoDeLaCadena(cadena.map((s) => !!lugarDe(s)));
  if (i < 0) return;
  lugarDe(cadena[i])?.click();
  const resto = cadena.slice(i + 1);
  if (!resto.length) return;
  const desde = Date.now();
  const mirar = () => {
    if (!vivo()) return;
    if (lugarDe(resto[0])) { tocarAntes(resto, vivo); return; }
    if (Date.now() - desde > TOPE_CADENA_MS) { cerrarLoAbierto(); return; }
    window.setTimeout(mirar, 100);
  };
  window.setTimeout(mirar, 100);
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
  // Para las placas de la revisión fuera del motor (los coaches, el reto): ./store.ts → useEsRevision.
  useEffect(() => { anotarRevision(revision); }, [revision]);
  // UN SOLO VIDEO A LA VEZ (21/11/2026, Martín): un play pausa a los demás, y en la esquina queda sólo el último (./un-video-a-la-vez.ts).
  useEffect(() => instalarUnVideoALaVez(document), []);
  useEffect(() => {
    motorPresente(true, (ruta) => !!tutorialDeRuta(ruta));
    return () => motorPresente(false);
  }, []);
  const senal = useSenal();
  const ensayo = useEnsayo();
  // La barra escondida al entrar (./barra-oculta.ts) nunca queda sin salida: si en un rato no arrancó ningún tutorial, vuelve.
  // Salvo mientras el chat «Onboarding» presenta el recorrido (20/11, la verificación de OD-03): ahí la saca «Tu panel», y su play sigue
  // en el chat.
  useEffect(() => {
    if (senal) return;
    const t = window.setTimeout(() => { if (!elChatPresentaElRecorrido()) mostrarLaBarra(); }, ESPERA_BARRA_MS);
    return () => window.clearTimeout(t);
  }, [senal]);
  return (
    <>
      {ensayo.activo && (
        <div className="mk-tuto-ensayo" role="status">
          <style>{CSS_ENSAYO}</style>
          <span>Viendo el onboarding desde cero: no se guarda nada.</span>
          <button type="button" onClick={salirDelEnsayo}>Salir del ensayo</button>
        </div>
      )}
      {/* useSearchParams en el layout: con su Suspense (si no, el build no prerenderiza las páginas estáticas). */}
      <Suspense fallback={null}><TutorialDeLaRuta /></Suspense>
      <SaltoDelRecorrido />
      {senal && senal.tipo === 'video' && <VideoFlotante key={senal.id} senal={senal} />}
      {senal && senal.tipo !== 'video' && <Capa key={senal.id} senal={senal} revision={revision} />}
    </>
  );
}

/**
 * «IR A UN PASO» DEL RECORRIDO (21/11/2026, la revisión: «para ir exactamente al paso que quiere»): el salto lo dejó la barra
 * (lib/onboarding-v2/salto-pendiente.ts); al llegar, en cuanto su lugar (o lo que lo abre) está en la pantalla, el recorrido arranca
 * en ESE paso. Si en 12 s no aparece, no arranca (nunca una marca a la nada). Al terminarlo (u omitirlo) queda VISTO, como cualquier
 * recorrido (21/11, el Cerebro): el mismo `onCerrar` que la llegada (app/second-brain/LlegadaAlReto.tsx).
 */
function SaltoDelRecorrido() {
  const [s, setS] = useState<{ recorrido: number } | null>(null);
  useEffect(() => { setS(tomarSalto(esDelRecorrido)); }, []);
  // Lo visto se pregunta SÓLO con un salto: el motor va en todas las pantallas.
  return s ? <CorrerElSalto s={s} /> : null;
}

function CorrerElSalto({ s }: { s: { recorrido: number } }) {
  const r = useRecorrido(ID_RECORRIDO, { autoabrir: false });
  const cerrar = useRef(r.onCerrar);
  useEffect(() => { cerrar.current = r.onCerrar; });
  useEffect(() => {
    let vivo = true, t = 0;
    // El recorrido se trae SÓLO con un salto: el motor va en todas las pantallas y no carga el texto del reto por las dudas.
    void import('@/lib/onboarding-v2/recorrido').then(({ TUTORIAL_RECORRIDO }) => {
      const paso = TUTORIAL_RECORRIDO.pasos[s.recorrido];
      if (!vivo || !paso) return;
      const lugares = [paso.sel, ...(typeof paso.antes === 'string' ? [paso.antes] : paso.antes ?? [])];
      const desde = Date.now();
      const mirar = () => {
        if (!vivo) return;
        if (lugares.some((x) => !!lugarDe(x))) { mostrarTutorial(TUTORIAL_RECORRIDO, { desde: s.recorrido, alTerminar: (m) => cerrar.current(m) }); return; }
        if (Date.now() - desde < 12_000) t = window.setTimeout(mirar, 150);
      };
      mirar();
    });
    return () => { vivo = false; window.clearTimeout(t); };
  }, [s]);
  return null;
}

/** La primera vez en una pestaña con tutorial: lo arranca solo, cuando su primer paso ya está en la pantalla. */
function TutorialDeLaRuta() {
  // CON LA CONSULTA (20/11, ticketera-5): la Ticketera vive en /second-brain?ticketera=tickets, y con sólo el pathname su «?» abría
  // el video del Ops Center. tutorialDeRuta (lib/tutoriales) ya elige por la consulta cuando el tutorial la pide.
  const consulta = useSearchParams()?.toString() ?? '';
  const ruta = (usePathname() ?? '/') + (consulta ? `?${consulta}` : '');
  const t = useVariante(tutorialDeRuta(ruta));
  return t ? <><PrimeraVez key={t.pestana} t={t} /><BotonDelVideo t={t} /></> : null;
}

/**
 * EL TUTORIAL DEL ESTADO DE LA PANTALLA (20/11: Chats vacío). Si el de la ruta trae `variante` y su marca está en la pantalla (la
 * pantalla ya pintó: se mira cuando cambia), corre ése, con su video y su «visto» propios. Sin variante, el de la ruta tal cual.
 */
function useVariante(t: TutorialPestana | null): TutorialPestana | null {
  const si = t?.variante?.si ?? null;
  const [esta, setEsta] = useState(false);
  useEffect(() => {
    if (!si) return;
    let cuadro = 0;
    const mirar = () => { cuadro = 0; setEsta(!!lugarDe(si)); };
    const pedir = () => { if (!cuadro) cuadro = requestAnimationFrame(mirar); };
    pedir();
    const mo = new MutationObserver(pedir);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { mo.disconnect(); if (cuadro) cancelAnimationFrame(cuadro); setEsta(false); };
  }, [si]);
  return t?.variante && esta ? t.variante.tutorial : t;
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
  // Vuelve a mirar cuando el motor queda libre (20/11, OD-13): con un video flotando al llegar, el recorrido no arrancaba nunca.
  const ocupadoElMotor = !!useSenal();
  const abierto = ensayo.activo ? !vistoEnEnsayo(id) : r.abierto;
  const cerrarDeVerdad = r.onCerrar;
  const onCerrar = useCallback((m: MotivoFin) => { if (ensayo.activo) marcarVistoEnEnsayo(id); else cerrarDeVerdad(m); }, [ensayo.activo, id, cerrarDeVerdad]);
  useEffect(() => {
    if (!abierto || pedido.current || senalAhora()) return;
    // Espera a que la pestaña pinte su primer paso (los datos llegan después del montaje), o lo que lo abre, o la página quieta (abajo).
    const telefono = window.innerWidth < ANCHO_TELEFONO;
    const pasos = pasosPara(t, telefono);
    if (!pasos.length) return;
    let vivo = true;
    const desde = Date.now();
    const mirar = () => {
      if (!vivo || pedido.current || senalAhora()) return;
      // ⚠️ EL RECORRIDO DEL OPS CENTER NUNCA ARRANCA SOLO (20/11/2026, el Cerebro en producción: después de «Entrar a MaKo», con la carga
      // entera, arrancaba antes de que la página estuviera dibujada y marcaba la fila «Reto de 7 días» unos 10 s sobre una pantalla vacía,
      // sin «dale play»). Lo arranca SIEMPRE el «dale play» de la llegada (el primer mensaje del chat del reto, app/second-brain/
      // LlegadaAlReto.tsx), que sale con la página dibujada. Antes esperaba sólo si el chat ya lo presentaba, y recién cargada no estaba.
      if (t.pestana === 'ops-center') return;
      // La PRIMERA vez en el Ops Center (recién salida del onboarding), el video del recorrido en lugar del de la pestaña: presenta
      // a los coaches, Uso, la Ticketera y termina mandando al chat del reto (acordado con el chat de los videos, 18/11).
      // La PRIMERA vez en el Ops Center, el RECORRIDO APROBADO (lib/onboarding-v2/recorrido.ts) en lugar del tutorial de la pestaña:
      // el reto, la barra, el Second Brain, la Ticketera. Lo visto se anota como el del Ops Center, así sale una vez.
      // Martín, 18/11, noche: «no es necesario que cada vez que entro en una pestaña me diga cómo funciona… omitir recorrido y
      // empezar… solamente que esté el video abajo a la derecha». Una pestaña abre DIRECTO su video (con sus marcas); el recorrido
      // aprobado del Ops Center sigue con su presentación.
      // Sin esperas de más (./pausas.ts, `arrancaLaPrimeraVez`; la llamada con Leila: Competitor Spy tardaba 6 s): con el primer lugar,
      // con lo que lo abre a la vista, o con la página quieta un rato. Lo que falta lo marca el video cuando suena (o no lo dice).
      const p0 = pasos[0];
      const abre0 = typeof p0.antes === 'string' ? !!lugarDe(p0.antes) : !!p0.antes?.some((s) => !!lugarDe(s));
      if (arrancaLaPrimeraVez({ marca: !!lugarDe(p0.sel), abre: abre0, cargando: cargandoAhora(), pasadoMs: Date.now() - desde })) { pedido.current = true; mostrarTutorial(t, { alTerminar: onCerrar, directo: true }); return; }
      window.setTimeout(mirar, 250);
    };
    const id = window.setTimeout(mirar, 600);
    return () => { vivo = false; window.clearTimeout(id); };
  }, [abierto, onCerrar, t, ocupadoElMotor]);
  return null;
}

type Geo = { hueco: Caja | null; tarjeta: PosicionTarjeta | null };

/** Un video que salió de su lugar: abajo a la derecha, desde donde iba, con su ✕. Termina solo al terminar el video. */
/** El video de un chat que sigue en la esquina: con el reproductor de la maqueta y «Agrandar/Achicar» (./VideoEnLaEsquina.tsx; 20/11,
 *  la verificación de F2: era el `<video controls>` del navegador). */
function VideoFlotante({ senal }: { senal: Extract<Senal, { tipo: 'video' }> }) {
  return <VideoEnLaEsquina senal={senal} />;
}

type SenalConCapa = Exclude<Senal, { tipo: 'video' }>;
function Capa({ senal, revision }: { senal: SenalConCapa; revision: boolean }) {
  const telefono = typeof window !== 'undefined' && window.innerWidth < ANCHO_TELEFONO;
  const pasos: PasoTutorial[] = useMemo(() => (senal.tipo === 'tutorial' ? pasosPara(senal.tutorial, telefono) : [senal.paso]), [senal, telefono]);
  // -1 = la presentación de la pestaña (su `intro`), antes del primer paso. Una marca va directo a su lugar.
  const [i, setI] = useState(senal.tipo === 'tutorial' && senal.desde ? senal.desde : senal.tipo === 'tutorial' && senal.tutorial.intro ? -1 : 0);
  // En qué paso va, para «Ir a un paso» (21/11): el desplegable sigue al recorrido.
  useEffect(() => { anotarPasoDelMotor(senal.tipo === 'tutorial' ? i : null); }, [senal, i]);
  useEffect(() => () => anotarPasoDelMotor(null), []);
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [geo, setGeo] = useState<Geo>({ hueco: null, tarjeta: null });
  const [videoArriba, setVideoArriba] = useState(false);
  const tarjetaRef = useRef<HTMLDivElement>(null);

  // El video de la pestaña y, si trae frases con marca, el modo en que el video manda (arranca solo apenas está).
  const videoPedido = useVideoTutorial(senal.tipo === 'tutorial' ? senal.video ?? null : null);
  const videoPropio = useVideoTutorial(senal.tipo === 'tutorial' ? senal.tutorial.pestana : null);
  const videoAlgun = videoPedido ?? videoPropio;
  const video = senal.tipo === 'tutorial' && senal.desde ? null : videoAlgun && senal.tipo === 'tutorial' && VIDEO_FIEL.has(senal.tutorial.pestana) && !sigueLosPasos(videoAlgun.frases ?? [], senal.tutorial.pasos) ? null : videoAlgun;
  // Con otro video que el de la pestaña (el recorrido), su cierre es SU último lugar marcado («toca aquí, en Reto de 7 días»), no el
  // último paso del tutorial de la pestaña.
  const conVideoPedido = !!videoPedido;
  // En el teléfono, la frase de un paso `clicSoloComputadora` no espera el clic (20/11, settings-integraciones-4/5).
  const frases = useMemo(() => {
    const fs = video?.frases ?? [];
    if (!telefono || senal.tipo !== 'tutorial') return fs;
    const sinClic = senal.tutorial.pasos.filter((p) => p.clicSoloComputadora);
    if (!sinClic.length) return fs;
    return fs.map((f) => (f.espera_clic && f.sel && sinClic.some((p) => mismoLugar(f.sel!, p.sel)) ? { ...f, espera_clic: false } : f));
  }, [video, telefono, senal]);
  const conFrases = senal.tipo === 'tutorial' && frases.some((f) => f.sel);
  const vidRef = useRef<HTMLVideoElement>(null);
  const [modoVideo, setModoVideo] = useState(false);
  const [frase, setFrase] = useState<FraseVideo | null>(null);
  const [cierre, setCierre] = useState(false);
  const [cierreFrase, setCierreFrase] = useState<FraseVideo | null>(null);
  const hechas = useRef(new Set<string>());
  /** La frase que llegó sin su marca (regla 1 de ./pausas.ts): se la busca mientras dura su voz; `espera`, desde cuándo espera en su t_fin. */
  const pendiente = useRef<{ f: FraseVideo; espera: number | null } | null>(null);
  /** Después de un clic, el video quieto en el silencio de la frase tocada hasta que aparece la marca de la próxima (regla 3). */
  const retenida = useRef<(Retencion & { destino: FraseVideo }) | null>(null);
  // Las que la persona TOCÓ (no las que sólo se mostraron o pasó con «Siguiente»): el cierre no repite un CTA ya tocado.
  const tocadas = useRef(new Set<string>());
  /** Las tocadas por la persona o con «Siguiente» (que hace el clic): el `antes` de la frase que sigue ya no hace falta. */
  const pulsadas = useRef(new Set<string>());
  /** Sin video: el paso que sigue a uno que la persona TOCÓ (20/11, la verificación de OD-10). Su `antes` (de un solo control) es lo que
   *  ella acaba de tocar: tocarlo otra vez, con la pantalla todavía cargando, lo cerraba (el Second Brain alterna). */
  const trasSuClic = useRef<PasoTutorial | null>(null);
  /** El cuadro que espera el t_fin de la frase tocada durante su voz, para retener ahí (regla 3). */
  const alFinDeLaTocada = useRef(0);
  /** La frase con `cierra_despues` que ya pasó: lo que abrió se cierra al empezar la que le sigue (`cierraYa`). */
  const porCerrar = useRef<string | null>(null);
  /** Hasta cuándo se está cerrando (`MS_CIERRE`): la frase siguiente se marca recién con el panel cerrado. */
  const cerrandoHasta = useRef(0);
  /**
   * Los relojes del modo video (la retención, la espera en el t_fin) y el que mira si la página sigue cambiando. Se limpian al
   * desmontar: antes, cerrar el video durante una espera dejaba un play() sobre el <video> desmontado y la voz seguía sola.
   */
  const reloj = useRef(0);
  const observador = useRef<MutationObserver | null>(null);
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; window.clearTimeout(reloj.current); cancelAnimationFrame(alFinDeLaTocada.current); observador.current?.disconnect(); retenida.current = null; pendiente.current = null; };
  }, []);
  /** El video sigue, si todavía hay capa y video (nunca un play() sobre un video cerrado). */
  const reproducir = useCallback(() => {
    const v = vidRef.current;
    if (!vivo.current || !v || !v.isConnected || v.ended) return;
    void v.play().catch(() => {});
  }, []);
  /** Retiene el video después de un clic y lo suelta cuando `soltarRetencion` (./pausas.ts) dice: la marca, la carga, el tope. */
  const retener = useCallback((r: Retencion & { destino: FraseVideo }) => {
    retenida.current = r;
    let cambio = Date.now();
    observador.current?.disconnect();
    const obs = new MutationObserver((ms) => { if (ms.some((m) => !(m.target instanceof Element && m.target.closest('.mk-tuto')))) cambio = Date.now(); });
    observador.current = obs;
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'aria-busy', 'data-recorrido'] });
    const mirar = () => {
      if (!vivo.current || retenida.current !== r) { obs.disconnect(); return; }
      const ahora = Date.now();
      const marca = !!lugarDe(pasoDeFrase(r.destino, pasos).sel);
      if (!soltarRetencion(r, { ms: ahora, url: urlAhora(), marca, cargando: cargandoAhora(), quietoMs: ahora - cambio })) { reloj.current = window.setTimeout(mirar, 150); return; }
      obs.disconnect(); retenida.current = null; reproducir();
    };
    window.clearTimeout(reloj.current);
    reloj.current = window.setTimeout(mirar, 150);
  }, [pasos, reproducir]);
  const pasoFrase = useMemo(() => (frase ? pasoDeFrase(frase, pasos) : null), [frase, pasos]);
  const ultimoPaso = pasos[pasos.length - 1] ?? null;

  const pasoCierre = useMemo(() => {
    if (!cierreFrase) return ultimoPaso;
    const p = pasoDeFrase(cierreFrase, pasos);
    return { ...p, clic: true as const, haz: p.haz ?? hazDeFrase(cierreFrase.texto) ?? 'Haz clic en lo marcado' };
  }, [cierreFrase, ultimoPaso, pasos]);
  const paso = modoVideo ? (cierre ? pasoCierre : pasoFrase) : i >= 0 ? pasos[i] : null;
  const ultimo = modoVideo ? cierre : i === pasos.length - 1;
  // Sin video, espera el clic CUALQUIER paso con `clic` (20/11, OD-10: el Second Brain y la flecha del recorrido), no sólo el último.
  const esperaClic = senal.tipo === 'marca' ? !senal.listo : modoVideo ? (cierre ? !!pasoCierre?.clic : !!frase?.espera_clic) : !!paso?.clic;
  // Entre una frase con marca y la siguiente, sólo el video: ni velo ni tarjeta (la página sigue usable).
  const soloVideo = modoVideo && !paso;

  // Al terminar (también salteado), la barra escondida al entrar vuelve (./barra-oculta.ts).
  // Salvo la marca «{título}: dale play» (20/11, la verificación de OD-03): su play arranca el recorrido, que la muestra en «Tu panel».
  const invita = senal.tipo === 'marca' && !!senal.invita;
  const fin = useCallback((como: 'fin' | 'omitido' | 'hecho') => { if (!invita) mostrarLaBarra(); terminar(senal.id, como); }, [senal.id, invita]);
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
    if (porCerrar.current) { porCerrar.current = null; cerrarLoAbierto(); window.setTimeout(decidir, MS_CIERRE); } else decidir();
  }, [pasos, frases, fin, conVideoPedido]);
  /**
   * La frase marcada ya está (la tocaron, «Siguiente», o pasó su tiempo): el video sigue. Después de un clic (`'persona'`, o
   * `'siguiente'`, que hace el clic), si la marca de la próxima frase todavía no está (el clic navega, abre un menú, el grafo tarda),
   * el video se queda quieto en el silencio de ESTA frase hasta que aparece (regla 3): nunca frena a mitad de la frase siguiente.
   */
  const seguirVideo = useCallback((clic: 'persona' | 'siguiente' | null = null, navega = false, url?: string) => {
    const f = frase;
    if (f) {
      hechas.current.add(f.id);
      if (clic) pulsadas.current.add(f.id);
      if (clic === 'persona') { tocadas.current.add(f.id); if (senal.tipo === 'tutorial' && f.sel) senal.alTocar?.(pasoFrase?.sel ?? f.sel); }
      if (f.cierra_despues) porCerrar.current = f.id;
    }
    setFrase(null); setEl(null); setGeo({ hueco: null, tarjeta: null });
    const v = vidRef.current;
    if (!v || v.ended) { irAlCierre(); return; }
    const destino = f && clic ? siguienteConMarca(frases, f, hechas.current) : null;
    cancelAnimationFrame(alFinDeLaTocada.current);
    if (destino && !lugarDe(pasoDeFrase(destino, pasos).sel)) {
      const desdeUrl = url ?? urlAhora();
      const quieto = () => { if (lugarDe(pasoDeFrase(destino, pasos).sel)) return; v.pause(); retener({ desde: Date.now(), url: desdeUrl, navega, destino }); };
      // Tocado DURANTE su voz (20/11, la verificación de motor-3/c): la frase termina y recién en su t_fin se retiene, en el silencio.
      if (f && retenerAlFin(v.currentTime, f.t_fin)) {
        const tFin = f.t_fin;
        const mirar = () => {
          if (!vivo.current || !v.isConnected || v.ended) return;
          if (!retenerAlFin(v.currentTime, tFin)) { quieto(); return; }
          alFinDeLaTocada.current = requestAnimationFrame(mirar);
        };
        alFinDeLaTocada.current = requestAnimationFrame(mirar);
        reproducir();
        return;
      }
      quieto();
      return;
    }
    reproducir();
  }, [frase, irAlCierre, senal, pasoFrase, frases, pasos, retener, reproducir]);
  const siguiente = useCallback(() => {
    if (modoVideo) {
      if (cierre) { fin('fin'); return; }
      // «Siguiente» hace lo que el clic (20/11): en una frase que espera el clic, toca lo marcado (abre el menú de la foto, el grafo,
      // Settings), así lo que sigue no espera algo que nunca se abrió. No cuenta como tocado por la persona: el reto no lo da por hecho.
      if (frase?.espera_clic && el?.isConnected) { const navega = navegaAlTocar(el), url = urlAhora(); el.click(); seguirVideo('siguiente', navega, url); return; }
      seguirVideo(); return;
    }
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
  }, [modoVideo, cierre, seguirVideo, i, conFrases, pasos.length, fin, senal.tipo, frase, el]);
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

  // 0. El video manda (las reglas de ./pausas.ts). Con cada avance: ¿llegó una frase con marca? Si su marca está, se marca (y si
  // espera el clic, pausa en su t_fin: 0c). Si NO está, NUNCA se pausa en su t_inicio (cortaba la primera sílaba y el video parecía
  // colgado): se la busca mientras dura su voz y, en su t_fin, se espera sólo a una página que está cargando; si no, se saltea sin
  // pausar. Así una «Mira aquí» no pausa jamás, y las frases de una cadena rota (el menú que no abrió, Settings que no cargó) pasan.
  useEffect(() => {
    const v = vidRef.current;
    if (!modoVideo || cierre || !v) return;
    const todos = senal.tipo === 'tutorial' ? senal.tutorial.pasos : [];
    const marcaDe = (f: FraseVideo) => pasoDeFrase(f, pasos).sel;
    /** En el t_fin, con la página cargando: quieto hasta que aparece la marca, termina de cargar o se pasa el tope. */
    const esperarCarga = (p: { f: FraseVideo; espera: number | null }) => {
      const mirar = () => {
        if (!vivo.current || pendiente.current !== p) return;
        if (lugarDe(marcaDe(p.f))) {
          pendiente.current = null;
          // Una «Mira aquí» cuya voz ya pasó no se marca tarde; una que espera el clic se marca y sigue quieta hasta el clic.
          if (p.f.espera_clic) setFrase(p.f); else { hechas.current.add(p.f.id); reproducir(); }
          return;
        }
        if (alFinSinMarca(cargandoAhora(), Date.now() - (p.espera ?? Date.now())) === 'saltear') { pendiente.current = null; hechas.current.add(p.f.id); reproducir(); return; }
        reloj.current = window.setTimeout(mirar, 200);
      };
      window.clearTimeout(reloj.current);
      reloj.current = window.setTimeout(mirar, 200);
    };
    const alAvanzar = () => {
      // Retenido después de un clic (regla 3): quieto hasta que `retener` lo suelte.
      if (retenida.current) { if (!v.paused) v.pause(); return; }
      const t = v.currentTime;
      // Martín, 18/11: «pausás el video previo a lo que deberías pausar… está narrando todavía lo de Funnel Coach». La marca sale en
      // el t_inicio de su frase y se QUEDA mientras la voz la narra; la pausa (espera_clic) va en su t_fin, en el silencio del final.
      if (frase) { if (t >= frase.t_fin - 0.05) { if (frase.espera_clic) { if (!v.paused) v.pause(); } else seguirVideo(); } return; }
      // La frase que llegó sin su marca: se marca apenas aparece, mientras dura su voz. En su t_fin, a lo sumo espera una carga.
      const p = pendiente.current;
      if (p) {
        if (p.espera != null) return;
        if (lugarDe(marcaDe(p.f))) { pendiente.current = null; setFrase(p.f); return; }
        if (t < p.f.t_fin - 0.05) return;
        if (alFinSinMarca(cargandoAhora(), 0) === 'esperar') { p.espera = Date.now(); v.pause(); esperarCarga(p); return; }
        pendiente.current = null; hechas.current.add(p.f.id);
        return;
      }
      // Lo que abrió la frase anterior (`cierra_despues`) se cierra al EMPEZAR la siguiente, tenga o no marca (20/11, tarde: motor-7 y
      // offer-5); la próxima vuelta (≈250 ms) ya marca.
      if (porCerrar.current && cierraYa(frases, porCerrar.current, t)) { porCerrar.current = null; cerrarLoAbierto(); cerrandoHasta.current = Date.now() + MS_CIERRE; return; }
      // Mientras se cierra, nada se marca encima (lo mismo que espera el cierre del video).
      if (Date.now() < cerrandoHasta.current) return;
      // «TOCA AQUÍ» SIEMPRE MARCA (./pausas.ts, `saltarSinMarca`; la llamada con Leila): la frase que manda a tocar algo que no está
      // en la pantalla, y que nada abre, no se dice. Se mira en el silencio de antes de su voz, y el video salta a su t_fin.
      const q = fraseQueSuena(frases, t, hechas.current);
      if (q) {
        const pq = q.sel ? pasoDeFrase(q, pasos) : null;
        const antes = pq?.antes;
        const abre = !!pq && (presentaLaBarra(pq.sel) || (typeof antes === 'string' ? !!lugarDe(antes) : !!antes?.some((s) => !!lugarDe(s))));
        if (saltarSinMarca(q, { marca: !!pq && !!lugarDe(pq.sel), abre, cargando: cargandoAhora() })) { hechas.current.add(q.id); v.currentTime = q.t_fin; return; }
      }
      const f = fraseParaMarcar(frases, t, hechas.current);
      if (!f) return;
      // En el teléfono, la frase de un paso `soloComputadora` ni se busca: su control no existe en MaKo Mobile.
      if (soloEnComputadora(f.sel, todos, telefono, mismoLugar)) { hechas.current.add(f.id); return; }
      const paso = pasoDeFrase(f, pasos);
      // La frase que presenta la barra la muestra antes de buscarla (estaba escondida desde «Entrar a MaKo»: ./barra-oculta.ts).
      if (presentaLaBarra(paso.sel)) mostrarLaBarra();
      if (lugarDe(paso.sel)) { setFrase(f); return; }
      // No está: el video SIGUE. Si el paso trae `antes` (abre lo que falta: el grafo, la ficha, el modal) y la frase anterior no se
      // tocó, se toca una vez; lo que abre se marca apenas aparece.
      const previa = [...frases].reverse().find((x) => !!x.sel && x.t_inicio < f.t_inicio);
      // Una cadena va igual: arranca en su último eslabón a la vista, así que lo que dejó abierto la frase tocada no se cierra.
      if (paso.antes && (typeof paso.antes !== 'string' || !(previa && pulsadas.current.has(previa.id)))) tocarAntes(paso.antes, () => vivo.current);
      pendiente.current = { f, espera: null };
    };
    // Terminó con una «Mira aquí» marcada: se suelta y va al cierre. Con una que espera el clic, espera (el clic lleva al cierre).
    const alTerminar = () => { pendiente.current = null; if (!frase) irAlCierre(); else if (!frase.espera_clic) seguirVideo(); };
    v.addEventListener('timeupdate', alAvanzar);
    v.addEventListener('ended', alTerminar);
    return () => { v.removeEventListener('timeupdate', alAvanzar); v.removeEventListener('ended', alTerminar); };
  }, [modoVideo, cierre, frase, frases, pasos, seguirVideo, irAlCierre, senal, telefono, reproducir]);
  const atras = () => { if (i > 0) { setEl(null); setGeo({ hueco: null, tarjeta: null }); setI(i - 1); } };

  // 1. Cada paso: lo de `antes`, y esperar a que aparezca lo marcado (hasta 3 s; una marca espera siempre).
  useEffect(() => {
    if (!paso) return;
    // El paso que presenta la barra la muestra (estaba escondida desde «Entrar a MaKo»: ./barra-oculta.ts), ENTERA mientras dura
    // el paso, y plegada al pasar (20/11, OD-03).
    if (presentaLaBarra(paso.sel)) mostrarLaBarra();
    const abreLaBarra = presentaLaBarra(paso.sel);
    if (abreLaBarra) barraEntera(true);
    let vivo = true;
    // En el modo video el `antes` lo toca el efecto 0, sólo si la marca falta: aquí la marca ya está, y tocarlo de nuevo cerraría lo abierto.
    // Sólo si la marca falta (20/11): el efecto vuelve a correr apenas la encuentra (cambia `siguiente`), y tocar el `antes` otra vez
    // cerraba el menú que acababa de abrir (con una cadena, lo abría y tocaba dos veces).
    const recienTocado = trasSuClic.current === paso && typeof paso.antes === 'string';
    if (paso.antes && !modoVideo && !lugarDe(paso.sel) && !recienTocado) tocarAntes(paso.antes, () => vivo);
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
      // Mientras la pantalla carga (el grafo del Second Brain tarda ~3 s), espera hasta el tope de la carga (20/11, OD-10).
      const espera = Date.now() - desde;
      if (senal.tipo === 'tutorial' && espera > ESPERA_PASO_MS && !(cargandoAhora() && espera < TOPE_CARGA_MS)) { obs.disconnect(); siguiente(); }
    };
    const obs = new MutationObserver(() => { if (!cuadro) cuadro = requestAnimationFrame(buscar); });
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-recorrido', 'hidden', 'style', 'class', 'aria-expanded'] });
    const reloj = window.setInterval(buscar, 300);
    cuadro = requestAnimationFrame(buscar);
    return () => { vivo = false; obs.disconnect(); window.clearInterval(reloj); if (cuadro) cancelAnimationFrame(cuadro); if (abreLaBarra) barraEntera(false); };
  }, [paso, senal.tipo, siguiente, modoVideo]);

  // 2. Medir el recorte y la tarjeta; de nuevo con el scroll, el tamaño y los cambios de la página.
  const llevado = useRef<HTMLElement | null>(null);
  const medir = useCallback(() => {
    const v = ventanaActual();
    const t = tarjetaRef.current?.getBoundingClientRect();
    const tam = { ancho: t?.width || 340, alto: t?.height || 170 };
    if (!paso) { setGeo({ hueco: null, tarjeta: { x: Math.max(12, (v.ancho - tam.ancho) / 2), y: Math.max(12, (v.alto - tam.alto) / 2), lado: 'abajo', flecha: null } }); return; }
    if (!el || !el.isConnected || !el.getClientRects().length) { setGeo({ hueco: null, tarjeta: null }); if (el) setEl(lugarDe(paso.sel)); return; }
    // LO QUE SE VE, no la caja entera (21/11, producción): un video metido debajo de la cabecera del chat se marcaba sobre la cabecera.
    // Y si el contenedor lo tapa, primero se lleva a la vista (una vez por lugar): la ventana sola no lo detecta.
    const entera = cajaDe(el.getBoundingClientRect());
    const visible = cajaVisible(entera, contenedoresDe(el));
    if (!seVeEntero(entera, visible) && llevado.current !== el) { llevado.current = el; el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' }); }
    const hueco = recorteDe(visible.alto > 0 ? visible : entera, v);
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
    // Y al terminar una animación o una transición (21/11/2026, Martín: «la marca está corrida»): un `transform` no avisa ni al
    // ResizeObserver ni al MutationObserver, y un globo que entra deslizándose se medía a mitad de camino.
    document.addEventListener('animationend', pedir, true);
    document.addEventListener('transitionend', pedir, true);
    return () => {
      window.removeEventListener('resize', pedir); document.removeEventListener('scroll', pedir, { capture: true }); ro?.disconnect(); mo.disconnect();
      document.removeEventListener('animationend', pedir, true); document.removeEventListener('transitionend', pedir, true);
      if (cuadro) cancelAnimationFrame(cuadro);
    };
  }, [medir, el]);

  // 2c. El velo entra con el barrido del sol y la luna (OD-F2, 20/11; las cuentas en ./iris.ts): al APARECER el hueco de una marca
  //     nueva, un círculo claro que se cierra hacia lo marcado en 720 ms. La tarjeta aparece al terminar. Sin barrido con menos
  //     movimiento, ni cuando el mismo lugar se vuelve a medir o parpadea un cuadro.
  const capaRef = useRef<HTMLDivElement>(null);
  const huecoRef = useRef<HTMLDivElement>(null);
  const habiaHueco = useRef(false);
  const barrida = useRef<string | null>(null);
  const claveMarca = paso ? `${modoVideo ? `v${cierre ? 'cierre' : frase?.t_inicio ?? ''}` : i}|${paso.sel}` : null;
  const hayHueco = !!geo.hueco;
  useLayoutEffect(() => {
    const toca = tocaIris({ habia: habiaHueco.current, hay: hayHueco, clave: claveMarca, barrida: barrida.current, menosMovimiento: !!menosMovimiento() });
    habiaHueco.current = hayHueco;
    if (!toca) return;
    barrida.current = claveMarca;
    const nodo = huecoRef.current, capa = capaRef.current;
    if (!nodo || !capa) return;
    capa.setAttribute('data-iris', '');
    // Cortado a mitad (el hueco se fue), nada queda recortado ni la tarjeta escondida.
    return barrer(nodo, () => capa.removeAttribute('data-iris'));
  }, [hayHueco, claveMarca]);

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
      // Sólo el de la persona: el clic de «Siguiente» (el.click(), sintético) ya lo maneja `siguiente` y no cuenta como tocado.
      if (tocado || !e.isTrusted || !(e.target instanceof Node) || !el.contains(e.target)) return;
      // Con el «dale play» puesto, la velocidad, la barra o la pantalla completa del video quieto NO son «tocarlo» (20/11/2026, el
      // inventario de botones): cerraban la invitación para siempre sin reproducir, y el día 1 quedaba visto y marcaba Offer Coach.
      if (senal.tipo === 'marca' && senal.invita && e.target instanceof Element && e.target.closest('.mk-vmom__vel, .mk-vmom__pista, .mk-vmom__completa')) return;
      tocado = true;
      // Adónde lleva y desde dónde, ANTES de que navegue: con eso se retiene el video hasta que llega (regla 3, ./pausas.ts).
      const navega = navegaAlTocar(el), url = urlAhora();
      // Sin video, el clic en un paso del medio pasa al siguiente (`siguiente`); en el último, termina (OD-10).
      if (!modoVideo) trasSuClic.current = pasos[i + 1] ?? null;
      window.setTimeout(() => (modoVideo && !cierre ? seguirVideo('persona', navega, url) : siguiente()), 0);
    };
    window.addEventListener('pointerdown', alTocar, true);
    window.addEventListener('click', alTocar, true);
    // «Pasa el mouse por tu foto» (la maqueta; verificación OD-11): el menú se abre al pasar, y pasar ya cuenta. Si no, quien pasaba el
    // mouse e iba directo a Settings dejaba la marca de la foto esperando un clic que nunca llegaba.
    const pasa = senal.tipo === 'marca' && !!senal.pasar;
    const alPasar = (e: PointerEvent) => { if (tocado || !e.isTrusted) return; tocado = true; window.setTimeout(siguiente, 0); };
    if (pasa) el.addEventListener('pointerenter', alPasar);
    return () => { window.removeEventListener('pointerdown', alTocar, true); window.removeEventListener('click', alTocar, true); if (pasa) el.removeEventListener('pointerenter', alPasar); };
  }, [el, esperaClic, siguiente, modoVideo, cierre, seguirVideo, pasos, i, senal]);

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
    <div ref={capaRef} className="mk-rec mk-tuto" data-tutorial={senal.tipo === 'tutorial' ? senal.tutorial.pestana : 'marca'} style={{ zIndex: z }}>
      <style>{cssRecorrido() + CSS_TUTORIAL}</style>
      {/* Desde un salto («Ir a un paso», «Atrás» a un paso del medio) el recorrido corre con sus tarjetas, sin el video: nunca el cartel
          falso de «todavía no está grabado» (21/11, Martín: «eso no tiene sentido… estás haciendo que no me funcione»). */}
      {senal.tipo === 'tutorial' && !senal.desde && (
        <VideoChico tutorial={senal.tutorial} video={video} vidRef={vidRef} autoplay={!conFrases}
          sub={paso?.sub ?? senal.tutorial.intro} revision={revision} arriba={videoArriba} lugar={senal.lugar}
          onCerrar={() => fin('omitido')} />
      )}
      {geo.hueco
        ? <>
            <div ref={huecoRef} className="mk-rec__hueco" style={{ left: geo.hueco.x, top: geo.hueco.y, width: geo.hueco.ancho, height: geo.hueco.alto }} aria-hidden />
            {/* Sin tapas en una marca o un paso `libre` (el menú de la foto se cierra si el mouse no llega a él: reto día 2, 20/11). */}
            {!(senal.tipo === 'marca' && senal.libre) && !paso?.libre && <Tapas h={geo.hueco} />}
          </>
        // Sin hueco, nada: un paso que todavía espera su lugar NO tapa nada (si no aparece, la página sigue usable). La presentación
        // con el velo entero ya no existe (19/11).
        : null}
      <div ref={tarjetaRef} className="mk-rec__tarjeta" role="dialog" aria-modal="false" aria-label={titulo} tabIndex={-1}
        style={{ left: t?.x ?? 0, top: t?.y ?? 0, visibility: visible && !soloVideo ? 'visible' : 'hidden' }}>
        {estiloFlecha && t && <span className="mk-rec__flecha" data-lado={t.lado} style={estiloFlecha} aria-hidden />}
        <div key={modoVideo ? (frase?.id ?? (cierre ? 'cierre' : 'video')) : i} className="mk-rec__cuerpo">
          {paso && total > 1 && !modoVideo && <div className="mk-rec__cont">{i + 1} de {total}</div>}
          {senal.tipo === 'marca' && senal.invita
            ? (
              <div className="mk-tuto__invita">
                <h2 className="mk-rec__tit">{titulo}</h2>
                <button type="button" className="mk-tuto__vx" aria-label="Cerrar" onClick={() => fin('omitido')}>
                  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
                </button>
              </div>
            )
            : <h2 className="mk-rec__tit">{titulo}</h2>}
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
    if (senal.invita || (!senal.listo && !senal.alOmitir)) return null;
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
      {/* UN PASO QUE PIDE CLIC NO TIENE «SIGUIENTE» (21/11/2026, Martín: «la idea es que el usuario aprenda a cliquear donde debe
          cliquear»): «Haz clic en…» se sigue SÓLO tocando ahí, también con el video mandando (antes, `conVideo || !esperaClic`).
          «Siguiente» sale en las marcas que no piden clic; «Omitir recorrido», siempre. */}
      {!esperaClic && <Button variant="primary" size="sm" onClick={siguiente}>{ultimo && !conVideo ? 'Listo' : 'Siguiente'}</Button>}
    </div>
  );
}

/**
 * El video chico de Martín de ESTA pestaña, abajo a la derecha. Sin video, nada (en la revisión, su lugar marcado). Cerrarlo (su X)
 * saltea el tutorial. SIN «Omitir recorrido» (21/11/2026, Martín: en el video flotante la X alcanza; el «Omitir» queda en las marcas).
 */
function VideoChico({ tutorial, video, vidRef, autoplay, sub, revision, arriba, lugar, onCerrar }: {
  tutorial: TutorialPestana; video: VideoTutorial | null; vidRef: RefObject<HTMLVideoElement | null>; autoplay: boolean;
  sub: string; revision: boolean; arriba: boolean; onCerrar: () => void;
  /** El lugar del mensaje donde se ve mientras está a la vista (./lugarDelVideo.ts, V4): ahí, con el reproductor de la maqueta. */
  lugar?: string;
}) {
  const [cerrado, setCerrado] = useState(false);
  const manifiestoListo = useManifiestoListo();
  const enLugar = useLugarALaVista(lugar && video ? lugar : null);
  useEffect(() => {
    const v = vidRef.current;
    if (!v || !autoplay) return;
    // Con sonido si el navegador deja (ya hubo un clic en la página); si no, en silencio, con sus controles.
    v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
  }, [video?.archivo, autoplay, vidRef]);
  // La placa «Todavía no está grabado», sólo con el manifiesto ya leído (20/11, F1): mientras carga, nada.
  if (cerrado || (!video && !(revision && manifiestoListo))) return null;
  const cerrar = () => { vidRef.current?.pause(); setCerrado(true); onCerrar(); };
  // EN SU MENSAJE (20/11, V4 y R57-21): el MISMO <video> (nunca se vuelve a montar: no pierde la frase ni la pausa), dibujado encima
  // del lugar del mensaje y recortado a lo que se ve del hilo; fuera de la vista, en la esquina, con su cabecera y su X.
  if (lugar && video) {
    const r = enLugar?.recorte;
    const estilo: CSSProperties | undefined = enLugar && r ? { left: enLugar.x, top: enLugar.y, width: enLugar.ancho, right: 'auto', bottom: 'auto',
      clipPath: `inset(${r.arriba}px ${r.derecha}px ${r.abajo}px ${r.izquierda}px round 14px)` } : undefined;
    return (
      <div role="complementary" className="mk-tuto__video mk-tuto__video--maqueta" data-en-lugar={enLugar ? '' : undefined} data-arriba={!enLugar && arriba ? '' : undefined}
        style={estilo} aria-label={`El video de ${tutorial.nombre}`} data-clave-lugar={video.key}>
        <style>{CSS_REPRODUCTOR}</style>
        {!enLugar && <header className="mk-tuto__vcab"><span className="mk-tuto__vfoto" aria-hidden>M</span><b>Martín · MaKo</b>
          <button type="button" className="mk-tuto__vx" aria-label="Cerrar el video" onClick={cerrar}>
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
          </button></header>}
        <div className="mk-vmom" data-estado="reproduciendo">
          <div className="mk-vmom__pantalla" onClick={() => alternarVideo(vidRef)}>
            <video ref={vidRef} className="mk-vmom__video" src={video.archivo} poster={video.poster} playsInline preload="metadata" />
          </div>
          <BarraDelVideo vidRef={vidRef} archivo={video.archivo} durManifiesto={video.duracion_s ?? 0} />
        </div>
      </div>
    );
  }
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
.mk-tuto .mk-rec__tarjeta { z-index: 3; transition: opacity .2s ease; }
.mk-tuto[data-iris] .mk-rec__tarjeta { opacity: 0; }
.mk-tuto__invita { display: flex; align-items: center; gap: 14px; }
.mk-tuto__invita .mk-rec__tit { margin: 0; }
.mk-tuto__haz { display: flex; align-items: center; gap: 8px; margin: 10px 0 0; font-size: var(--fs-sm); font-weight: 650; color: var(--ink); }
.mk-tuto__punto { width: 9px; height: 9px; border-radius: 999px; background: var(--ink); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ink) 18%, transparent); flex: none; }
.mk-tuto__video { position: fixed; z-index: 2; right: max(16px, env(safe-area-inset-right, 0px)); bottom: max(16px, env(safe-area-inset-bottom, 0px)); width: min(300px, calc(100vw - 32px)); background: #0E1219; color: #fff; border-radius: var(--r-lg); box-shadow: 0 18px 44px rgba(0,0,0,.35); overflow: hidden; }
.mk-tuto__video[data-arriba] { bottom: auto; top: max(16px, env(safe-area-inset-top, 0px)); }
.mk-tuto__vcab { display: flex; align-items: center; gap: 8px; padding: 8px 10px; font-size: var(--fs-meta); }
.mk-tuto__vfoto { width: 22px; height: 22px; border-radius: 999px; display: grid; place-items: center; background: #F2B01E; color: #1a1405; font-weight: 800; font-size: 12px; }
.mk-tuto__vx { margin-left: auto; width: 26px; height: 26px; border: 0; border-radius: 8px; background: #E5484D; color: #fff; display: flex; align-items: center; justify-content: center; padding: 0; cursor: pointer; }
.mk-tuto__vx svg { display: block; }
.mk-tuto__vid { display: block; width: 100%; aspect-ratio: 16 / 9; background: #000; }
.mk-tuto__video--maqueta .mk-vmom { width: 100%; margin: 0; border-radius: 0; box-shadow: none; }
.mk-tuto__video[data-en-lugar] { border-radius: 14px; box-shadow: 0 1px 2px rgba(0,0,0,.12); }
.mk-tuto__lugar { margin: 0 10px; aspect-ratio: 16 / 9; border: 1.5px dashed rgba(255,255,255,.4); border-radius: var(--r-md); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; text-align: center; padding: 8px; }
.mk-tuto__lugar b { font-size: var(--fs-sm); }
.mk-tuto__lugar span { font-size: var(--fs-meta); opacity: .75; }
.mk-tuto__sub { margin: 8px 12px 12px; font-size: var(--fs-meta); line-height: 1.45; color: rgba(255,255,255,.88); }
@media (max-width: 767px) { .mk-tuto__video { width: min(220px, calc(100vw - 32px)); } }
`;
