'use client';

// =============================================================================
// Presentar — el modo presentación de Gamma: una sección por vez, a pantalla completa
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma». Diseño:
// docs/diseno-editor-landing.md (D8: «pantalla completa, una sección por vez, flechas, Esc,
// "Destacar" (S) y notas del orador»). Lo que se copia (relevo gamma-ui §6.3 y §7):
//   · la sección ocupa el centro sobre el fondo del tema, con una barra de progreso fina abajo;
//   · ←/→ (y espacio) pasan de sección, Esc sale, R reinicia;
//   · «Destacar» (S o el botón): el bloque actual resaltado, los vistos atenuados y los que
//     vienen desvanecidos; con Destacar, las flechas pasan de BLOQUE y un clic destaca el bloque;
//   · la barra de presentación aparece al mover el mouse: Destacar, Notas del orador, Salir;
//   · la vista del presentador (N) con las notas y «Iniciar temporizador».
// Lo que no: zoom manual, «Compartir» y «Seguir» (presentar a otros en vivo) y la edición rápida
// (E). La vista del presentador de Gamma es otra ventana; acá es un panel al costado.
//
// Cada sección sale del render público (`htmlDeTarjeta`, modo 'exportar': los desplegables
// abiertos) dentro de su `.gm-doc` con el tema, escalada a la pantalla: la hoja mide todo en em
// de `--gm-base`, así que la escala es UN número (ancho / 68.5, achicado si la sección no entra
// de alto).
//
// UNA PRESENTACIÓN (T3, tanda 2) se presenta con la FORMA de su diapositiva (`config.proporcion`:
// 16:9 o 4:3): el envoltorio de cada raíz lleva `data-formato`/`data-proporcion` (css.ts lee el
// formato también del padre directo de un .gm-doc suelto, porque `htmlDeTarjeta` no conoce la
// configuración), la escala sale del cuadro de la diapositiva (ancho y alto a la vez) y la
// diapositiva tiene ALTO FIJO: si el contenido no entra, se achica la letra del cuerpo hasta que
// entre (el «Adapta el contenido» de Gamma), con un piso; lo que igual no entra queda recortado
// por la diapositiva y se ve en el editor con la guía de desbordamiento. Una página (o una
// presentación «Fluida») se presenta como antes: la sección entera, achicada si no entra de alto.
//
// ⚠️ LAS SECCIONES SALEN DEL DOCUMENTO VIVO (`editor.getJSON()`), no de lo guardado: se presenta
//    lo que se ve en el editor aunque el autoguardado no haya llegado. Las ocultas no se presentan
//    (el render las devuelve vacías sin `incluirOcultas`).
// ⚠️ ESC EN PANTALLA COMPLETA NO LLEGA A LA PÁGINA: el navegador lo usa para salir de la pantalla
//    completa. Por eso salir del modo es escuchar `fullscreenchange`, y el Escape del teclado sólo
//    vale cuando la pantalla completa no se pudo pedir (el navegador la negó).
// ⚠️ LAS TECLAS SE ATAJAN EN CAPTURA Y CON `stopImmediatePropagation`: detrás sigue el editor, y una
//    «S» llegaría a escribirse en la sección que tenía el cursor.
// =============================================================================

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { useCapaModal } from '@/app/_components/pila-modales';
import { useEditorLanding } from './contexto';
import { htmlDeTarjeta } from '@/lib/editor-landing/render';
import { esPresentacion, proporcionDe, relacionDe, terminoTarjeta } from '@/lib/editor-landing/api-tipos';
import { EstilosContenido, EstilosPanelesB, Ico } from './paneles/PanelAgente';
import { idDe, tarjetasDelDoc, tituloVisible } from './diff-tarjetas';

type Diapo = { id: string; titulo: string; html: string; notas: string };

/** Los bloques de una sección: los hijos directos del cuerpo (una columna o un diseño optimizado es UNO). */
const SEL_BLOQUES = '.gm-tarjeta > .gm-tarjeta-cuerpo > *';
/** Cuánto se queda quieta la barra antes de esconderse. */
const BARRA_MS = 2500;
/** El ancho de una diapositiva en em de la letra base (la tarjeta de css.ts) y el aire alrededor. */
const ANCHO_EM = 64.5;
/** El piso del achique del contenido de una diapositiva fija (más chico ya no se lee). */
const ESCALA_MIN = 0.55;

/**
 * La letra base que hace entrar una diapositiva de `relacion` (ancho / alto) en un escenario de
 * W × H, con el 4 % de aire a los lados y el 6 % arriba y abajo.
 */
function baseDiapositiva(W: number, H: number, relacion: number): number {
  const porAncho = (W * 0.96) / ANCHO_EM;
  const porAlto = (H * 0.94 * relacion) / ANCHO_EM;
  return Math.max(4, Math.min(porAncho, porAlto, 60));
}

/**
 * Achica la letra del cuerpo de una diapositiva de alto fijo hasta que su contenido entre (de a
 * 5 %, hasta ESCALA_MIN). Devuelve la escala que quedó. El cuerpo pisa su `font-size` con el
 * mismo cálculo de css.ts (`--gm-escala-cuerpo` del tema) multiplicado por la escala.
 */
function encajar(sec: HTMLElement): number {
  const cuerpo = sec.querySelector<HTMLElement>(':scope > .gm-tarjeta-cuerpo');
  if (!cuerpo) return 1;
  cuerpo.style.fontSize = '';
  let k = 1;
  while (sec.scrollHeight > sec.clientHeight + 1 && k > ESCALA_MIN) {
    k = Math.round((k - 0.05) * 100) / 100;
    cuerpo.style.fontSize = `calc(${k}em * var(--gm-escala-cuerpo, 1))`;
  }
  return k;
}

const reloj = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/** `onSalir` (u `onCerrar`, el mismo): quien lo monta se entera de que terminó; si no, se cierra por el contexto. */
export function Presentar({ onSalir, onCerrar }: { onSalir?: () => void; onCerrar?: () => void } = {}) {
  const ctx = useEditorLanding();
  const ctxRef = useRef(ctx);
  useLayoutEffect(() => { ctxRef.current = ctx; });
  const onSalirRef = useRef(onSalir ?? onCerrar);
  useLayoutEffect(() => { onSalirRef.current = onSalir ?? onCerrar; });
  const { tema } = ctx;
  const capa = useCapaModal(true);
  // La forma, como está AL ENTRAR (igual que las secciones).
  const [forma] = useState(() => ({
    presentacion: esPresentacion(ctx.config),
    proporcion: proporcionDe(ctx.config),
    relacion: relacionDe(ctx.config),
  }));
  const plural = terminoTarjeta(ctx.config, { plural: true });
  const uno = terminoTarjeta(ctx.config);
  const formaRef = useRef(forma.relacion);

  // Las secciones como están AL ENTRAR (presentar no sigue la edición).
  const [diapos] = useState<Diapo[]>(() => {
    const ed = ctx.editor;
    const fuente = ed && !ed.isDestroyed
      ? tarjetasDelDoc(ed.getJSON())
      : tarjetasDelDoc(ctx.paginas.find((p) => p.id === ctx.paginaActual)?.doc);
    return fuente.map((t) => {
      let html = '';
      try { html = htmlDeTarjeta(t, ctx.tema, { modo: 'exportar' }); } catch { html = ''; }
      return { id: idDe(t), titulo: tituloVisible(t), html, notas: typeof t.attrs?.notas === 'string' ? t.attrs.notas : '' };
    }).filter((d) => d.html);
  });
  const n = diapos.length;
  const [i, setI] = useState(() => Math.max(0, diapos.findIndex((d) => d.id === ctx.tarjetaActiva)));
  const [destacar, setDestacar] = useState(false);
  /** El bloque destacado; -1 = el último (se resuelve al dibujar la sección). */
  const [bloque, setBloque] = useState(0);
  const [notas, setNotas] = useState(false);
  const [barra, setBarra] = useState(true);
  const [pantalla, setPantalla] = useState(false);
  const [acumulado, setAcumulado] = useState(0);
  const [desde, setDesde] = useState<number | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());

  const raizRef = useRef<HTMLDivElement>(null);
  const escenarioRef = useRef<HTMLDivElement>(null);
  const lienzoRef = useRef<HTMLDivElement>(null);
  const estado = useRef({ i, destacar, bloque });
  useLayoutEffect(() => { estado.current = { i, destacar, bloque }; });

  // ── Salir ────────────────────────────────────────────────────────────────
  const salio = useRef(false);
  const salir = useCallback(() => {
    if (salio.current) return;
    salio.current = true;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    if (onSalirRef.current) onSalirRef.current();
    else ctxRef.current.setDialogo(null);
  }, []);

  // ── Pantalla completa ────────────────────────────────────────────────────
  const entro = useRef(false);
  const pedirPantalla = useCallback(() => {
    const el = raizRef.current;
    if (!el || document.fullscreenElement || typeof el.requestFullscreen !== 'function') return;
    el.requestFullscreen().catch(() => { /* el navegador la negó: se presenta en la ventana */ });
  }, []);
  useEffect(() => {
    raizRef.current?.focus();
    const onCambio = () => {
      const dentro = !!document.fullscreenElement;
      setPantalla(dentro);
      if (dentro) entro.current = true;
      else if (entro.current) salir();
    };
    document.addEventListener('fullscreenchange', onCambio);
    pedirPantalla();
    const raiz = raizRef.current;
    return () => {
      document.removeEventListener('fullscreenchange', onCambio);
      if (document.fullscreenElement && document.fullscreenElement === raiz) void document.exitFullscreen().catch(() => {});
    };
  }, [salir, pedirPantalla]);

  // ── Navegación ───────────────────────────────────────────────────────────
  const avanzar = useCallback((d: 1 | -1) => {
    const { i: actual, destacar: dest, bloque: b } = estado.current;
    if (dest) {
      const nb = lienzoRef.current?.querySelectorAll(SEL_BLOQUES).length ?? 0;
      const nuevo = b + d;
      if (nuevo >= 0 && nuevo < nb) { setBloque(nuevo); return; }
    }
    const j = actual + d;
    if (j < 0 || j >= n) return;
    setI(j);
    setBloque(d > 0 ? 0 : -1);
  }, [n]);
  const ir = useCallback((j: number) => { if (j >= 0 && j < n) { setI(j); setBloque(0); } }, [n]);

  const arriba = capa.esElDeArriba;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!arriba() || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      let hecho = true;
      if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown' || k === ' ' || k === 'Spacebar') avanzar(1);
      else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp' || k === 'Backspace') avanzar(-1);
      else if (k === 'Home') ir(0);
      else if (k === 'End') ir(n - 1);
      else if (k === 's' || k === 'S') { setDestacar((v) => !v); setBloque(0); }
      else if (k === 'n' || k === 'N') setNotas((v) => !v);
      else if (k === 'r' || k === 'R') ir(0);
      else if (k === 'Escape') salir();
      else hecho = false;
      if (hecho) { e.preventDefault(); e.stopImmediatePropagation(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [arriba, avanzar, ir, n, salir]);

  // ── La escala: la sección entra entera en la pantalla ────────────────────
  const ajustar = useCallback(() => {
    const el = lienzoRef.current;
    const esc = escenarioRef.current;
    if (!el || !esc) return;
    const W = esc.clientWidth;
    const H = esc.clientHeight;
    if (!W || !H) return;
    // Una diapositiva fija: la escala sale del cuadro (ancho y alto) y el contenido se encaja adentro.
    // `--gm-base-movil` también: en una ventana angosta la hoja usa ésa y la diapositiva no entraría.
    const relacion = formaRef.current;
    if (relacion) {
      const base = `${baseDiapositiva(W, H, relacion)}px`;
      el.style.setProperty('--gm-base', base);
      el.style.setProperty('--gm-base-movil', base);
      const sec = el.querySelector<HTMLElement>('.gm-tarjeta');
      if (sec) encajar(sec);
      return;
    }
    let b = Math.min(W / 68.5, 40);
    for (let k = 0; k < 2; k++) {
      el.style.setProperty('--gm-base', `${b}px`);
      const sec = el.querySelector<HTMLElement>('.gm-tarjeta');
      if (!sec) return;
      const h = sec.getBoundingClientRect().height;
      const max = H * 0.92;
      if (h <= max) break;
      b = Math.max(6, (b * max) / h);
    }
    el.style.setProperty('--gm-base', `${b}px`);
  }, []);
  useLayoutEffect(() => { ajustar(); }, [ajustar, i, notas, pantalla]);
  useEffect(() => {
    const esc = escenarioRef.current;
    const lienzo = lienzoRef.current;
    const ro = new ResizeObserver(() => ajustar());
    if (esc) ro.observe(esc);
    const alCargar = () => ajustar();
    lienzo?.addEventListener('load', alCargar, true);
    return () => { ro.disconnect(); lienzo?.removeEventListener('load', alCargar, true); };
  }, [ajustar]);

  // ── Destacar: clases sobre los bloques de la sección dibujada ────────────
  useLayoutEffect(() => {
    const el = lienzoRef.current;
    if (!el) return;
    const bloques = Array.from(el.querySelectorAll<HTMLElement>(SEL_BLOQUES));
    if (destacar && bloque === -1 && bloques.length) { setBloque(bloques.length - 1); return; }
    bloques.forEach((b, k) => {
      if (!destacar) delete b.dataset.gmaFoco;
      else b.dataset.gmaFoco = k < bloque ? 'visto' : k === bloque ? 'foco' : 'futuro';
    });
  }, [destacar, bloque, i]);

  const clicLienzo = (e: MouseEvent<HTMLDivElement>) => {
    const t = e.target as Element | null;
    // Un enlace no saca de la presentación: lo de afuera abre en otra pestaña, lo interno no navega.
    const a = t?.closest('a');
    if (a) {
      e.preventDefault();
      const href = a.getAttribute('href') ?? '';
      if (/^https?:\/\//i.test(href)) window.open(href, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!estado.current.destacar) return;
    const el = lienzoRef.current;
    const b = t?.closest(SEL_BLOQUES);
    if (!el || !b) return;
    const k = Array.from(el.querySelectorAll(SEL_BLOQUES)).indexOf(b);
    if (k >= 0) setBloque(k);
  };

  // ── La barra: aparece al mover el mouse y se va sola ─────────────────────
  const timerBarra = useRef(0);
  const mostrarBarra = useCallback(() => {
    setBarra(true);
    window.clearTimeout(timerBarra.current);
    timerBarra.current = window.setTimeout(() => setBarra(false), BARRA_MS);
  }, []);
  // Al entrar la barra se ve (estado inicial) y se va sola a los BARRA_MS.
  useEffect(() => {
    timerBarra.current = window.setTimeout(() => setBarra(false), BARRA_MS);
    return () => window.clearTimeout(timerBarra.current);
  }, []);

  // ── El temporizador ──────────────────────────────────────────────────────
  useEffect(() => {
    if (desde === null) return;
    const t = window.setInterval(() => setAhora(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [desde]);
  const transcurrido = acumulado + (desde !== null ? Math.max(0, ahora - desde) : 0);
  const alternarReloj = () => {
    if (desde === null) { const t = Date.now(); setDesde(t); setAhora(t); }
    else { setAcumulado((a) => a + Math.max(0, Date.now() - desde)); setDesde(null); }
  };
  const reiniciarReloj = () => { setAcumulado(0); setDesde(desde === null ? null : Date.now()); setAhora(Date.now()); };

  if (typeof document === 'undefined') return null;
  const d = diapos[i];
  const siguiente = diapos[i + 1];

  // Al body: un ancestro con `transform` volvería relativo al `position: fixed` (y lo recortaría).
  return createPortal(
    <div
      ref={raizRef}
      className="gma gma-pb gma-pr"
      style={{ zIndex: Math.max(capa.z, 3000) } as CSSProperties}
      tabIndex={-1}
      role="dialog"
      aria-label="Presentar"
      aria-modal="true"
      onMouseMove={mostrarBarra}
    >
      <EstilosPanelesB />
      <EstilosContenido tema={tema} />
      <style href="gma-presentar" precedence="medium">{CSS_PRESENTAR}</style>

      <div ref={escenarioRef} className="gma-pr-escenario" data-notas={notas ? '' : undefined}>
        {d
          ? <div ref={lienzoRef} className="gma-pr-lienzo" onClick={clicLienzo} onSubmitCapture={(e) => e.preventDefault()}
              data-formato={forma.presentacion ? 'presentacion' : undefined}
              data-proporcion={forma.presentacion ? forma.proporcion : undefined}
              data-fija={forma.relacion ? forma.proporcion : undefined}
              dangerouslySetInnerHTML={{ __html: d.html }} />
          : (
            <div className="gma-pr-vacio">
              <span>No hay {plural} para presentar.</span>
              <button type="button" className="gma-pb-boton" data-v="primario" onClick={salir}>Salir</button>
            </div>
          )}
      </div>

      {notas && (
        <aside className="gma-pr-notas" aria-label="Notas del orador">
          <div className="gma-pr-notas-cab">
            <b>Notas del orador</b>
            <button type="button" className="gma-pb-iconbtn" onClick={() => setNotas(false)} aria-label="Cerrar las notas" title="Cerrar las notas"><Ico n="cerrar" t={15} /></button>
          </div>
          <div className="gma-pr-reloj">
            <span className="gma-pr-tiempo">{reloj(transcurrido)}</span>
            <button type="button" className="gma-pb-boton" data-v="secundario" data-t="s" onClick={alternarReloj}>
              <Ico n={desde === null ? 'play' : 'reloj'} t={13} /> {desde === null ? (transcurrido ? 'Seguir' : 'Iniciar temporizador') : 'Pausar'}
            </button>
            <button type="button" className="gma-pb-iconbtn" onClick={reiniciarReloj} disabled={!transcurrido} aria-label="Reiniciar temporizador" title="Reiniciar temporizador"><Ico n="refrescar" t={15} /></button>
          </div>
          <div className="gma-pr-notas-texto">{d?.notas?.trim() ? d.notas : <span className="gma-pr-tenue">Sin notas</span>}</div>
          {siguiente && <div className="gma-pr-sig"><span>Siguiente</span> {siguiente.titulo}</div>}
        </aside>
      )}

      <div className="gma-pr-barra" data-visible={barra ? '' : undefined} onMouseEnter={() => { window.clearTimeout(timerBarra.current); setBarra(true); }} onMouseLeave={mostrarBarra}>
        <button type="button" className="gma-pb-iconbtn" onClick={() => avanzar(-1)} disabled={i === 0 && (!destacar || bloque <= 0)} aria-label={`${uno[0].toUpperCase()}${uno.slice(1)} anterior`} title={`${uno[0].toUpperCase()}${uno.slice(1)} anterior`}><Ico n="chevron-izquierda" t={16} /></button>
        <span className="gma-pr-cuenta">{n ? i + 1 : 0} / {n}</span>
        <button type="button" className="gma-pb-iconbtn" onClick={() => avanzar(1)} disabled={i >= n - 1 && !destacar} aria-label={`Siguiente ${uno}`} title={`Siguiente ${uno}`}><Ico n="chevron-derecha" t={16} /></button>
        <span className="gma-pr-sep" aria-hidden />
        <button type="button" className="gma-pr-btn" aria-pressed={destacar} onClick={() => { setDestacar((v) => !v); setBloque(0); }} title="Destacar (S)"><Ico n="brillo" t={15} /> Destacar</button>
        <button type="button" className="gma-pr-btn" aria-pressed={notas} onClick={() => setNotas((v) => !v)} title="Notas del orador (N)"><Ico n="notas" t={15} /> Notas del orador</button>
        {!pantalla && <button type="button" className="gma-pb-iconbtn" onClick={pedirPantalla} aria-label="Pantalla completa" title="Pantalla completa"><Ico n="pantalla-completa" t={16} /></button>}
        <button type="button" className="gma-pb-boton" data-v="primario" data-t="s" onClick={salir}><span className="gma-pr-cuadro" aria-hidden /> Salir</button>
      </div>

      <div className="gma-pr-progreso" aria-hidden><div style={{ width: n ? `${((i + 1) / n) * 100}%` : 0 }} /></div>
    </div>,
    document.body,
  );
}

export default Presentar;

const CSS_PRESENTAR = `
.gma-pr{position:fixed;inset:0;background:#000000;outline:none;overflow:hidden}
.gma-pr-escenario{position:absolute;inset:0;overflow:auto}
.gma-pr-escenario[data-notas]{right:340px}
.gma-pr-lienzo{display:flex;min-height:100%}
.gma-pr .gma-pr-lienzo>.gm-doc{flex:1;display:flex;flex-direction:column;min-height:100%}
.gma-pr .gma-pr-lienzo .gm-doc .gm-fondo{flex:1;display:flex;align-items:center;justify-content:center;min-height:100%}
.gma-pr .gma-pr-lienzo .gm-doc .gm-pagina{width:100%;padding:0}
.gma-pr .gma-pr-lienzo .gm-doc .gm-tarjeta{margin:2em auto}
.gma-pr .gma-pr-lienzo .gm-doc .gm-tarjeta[data-ancho="completo"]{margin:0}
.gma-pr .gma-pr-lienzo[data-fija] .gm-doc .gm-tarjeta{width:64.5em;max-width:none;margin:0 auto;min-height:0;overflow:hidden}
.gma-pr .gma-pr-lienzo[data-fija="16:9"] .gm-doc .gm-tarjeta{aspect-ratio:16/9}
.gma-pr .gma-pr-lienzo[data-fija="4:3"] .gm-doc .gm-tarjeta{aspect-ratio:4/3}
.gma-pr [data-gma-foco]{transition:opacity .35s ease,filter .35s ease}
.gma-pr [data-gma-foco="visto"]{opacity:.45}
.gma-pr [data-gma-foco="futuro"]{opacity:.12;filter:blur(3px)}
.gma-pr [data-gma-foco="foco"]{opacity:1}
@media (prefers-reduced-motion:reduce){.gma-pr [data-gma-foco]{transition:none}}
.gma-pr-vacio{position:absolute;inset:0;display:grid;place-content:center;justify-items:center;gap:14px;color:#dfdfe0;font-size:15px}
.gma-pr-barra{position:absolute;top:12px;right:12px;display:flex;align-items:center;gap:6px;padding:6px 6px 6px 8px;border-radius:999px;background:var(--pb-fondo);box-shadow:var(--pb-sombra),0 0 0 1px var(--pb-borde);opacity:0;transform:translateY(-6px);pointer-events:none;transition:opacity .2s ease,transform .2s ease}
.gma-pr-barra[data-visible]{opacity:1;transform:none;pointer-events:auto}
.gma-pr-cuenta{min-width:48px;text-align:center;font-size:12.5px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--pb-tenue)}
.gma-pr-sep{width:1px;height:20px;background:var(--pb-borde);margin:0 2px}
.gma-pr-btn{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 11px;border:0;border-radius:999px;background:transparent;color:var(--pb-texto);font:inherit;font-size:12.5px;font-weight:600;cursor:pointer}
.gma-pr-btn:hover{background:var(--pb-sup)}
.gma-pr-btn[aria-pressed="true"]{background:var(--pb-celeste2);color:var(--pb-tinta)}
.gma-pr-cuadro{display:block;width:9px;height:9px;border-radius:2px;background:currentColor}
.gma-pr-progreso{position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(127,127,127,.25)}
.gma-pr-progreso>div{height:100%;background:#2c88f7;transition:width .3s ease}
.gma-pr-notas{position:absolute;top:0;right:0;bottom:0;width:340px;display:flex;flex-direction:column;gap:14px;padding:16px;background:var(--pb-fondo);border-left:1px solid var(--pb-borde);overflow:hidden}
.gma-pr-notas-cab{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:15px;color:var(--pb-titulo)}
.gma-pr-reloj{display:flex;align-items:center;gap:8px}
.gma-pr-tiempo{font-size:24px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--pb-texto);margin-right:auto}
.gma-pr-notas-texto{flex:1;min-height:0;overflow-y:auto;font-size:16px;line-height:1.55;color:var(--pb-texto);white-space:pre-wrap;overflow-wrap:anywhere}
.gma-pr-tenue{color:var(--pb-suave)}
.gma-pr-sig{padding-top:10px;border-top:1px solid var(--pb-borde);font-size:13px;color:var(--pb-texto);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gma-pr-sig span{margin-right:6px;font-weight:700;color:var(--pb-suave)}
`;
