'use client';

// =============================================================================
// AskAgent — el popover ✨ de UNA sección («Ask Agent» de Gamma 5)
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma». Diseño:
// docs/diseno-editor-landing.md (paquete I2). Lo que se copia (relevo gamma-ui §5.8):
//   · la tarjeta blanca de ~370 px anclada a la sección, con el ✨ gris, el input y el botón
//     redondo azul → abajo a la derecha; borde azul (#2c88f7) con el foco;
//   · las acciones del clásico «Editar módulo con IA»: Escribir (Mejorar la escritura ·
//     Corregir la ortografía y la gramática · Traducir · Alargar · Acortar · Simplificar el
//     lenguaje · Sé más específico) y Diseño (Hazlo más visual · Añadir una imagen · Agregar
//     un gráfico · Probar nuevo diseño), con los nombres del catálogo de Gamma en español;
//   · «Probar nuevo diseño» muestra hasta 3 opciones para elegir;
//   · lo que vuelve se revisa con «Original | Modificado» y se acepta o se descarta, con el
//     MISMO flujo del panel del agente (`aceptarPropuesta`, paneles/PanelAgente.tsx: guarda la
//     versión «Antes de un cambio de IA» ANTES de aplicar).
// El input dice «Pídele algo a MaKo» (Gamma: «Ask Agent»): la IA del producto es MaKo.
//
// Quien lo abre (el NodeView de la sección, o la barra de abajo de una sección con su ✦) le
// pasa la sección, el ancla y `modo`: 'editar' (el default), 'disenos' (arranca directo en
// «Probar nuevo diseño») o 'agregar' (crea una sección NUEVA después de ésa).
//
// ⚠️ ES UNA CAPA: se registra en la pila de modales (`anidada`: no apaga lo de atrás) y su
//    Escape frena con `stopImmediatePropagation` — los Escape de la casa viven en `document`
//    y en captura, y `stopPropagation` no frena a los listeners hermanos (AGENTS.md, «Montar una
//    PANTALLA adentro de un modal»). Se portalea al body: adentro de la sección la recortaría
//    cualquier `overflow` del lienzo.
// ⚠️ MIENTRAS PIENSA O HAY ALGO PARA REVISAR, UN CLIC AFUERA NO LO CIERRA: se perdería la
//    respuesta. Ahí se cierra con la ✕ o con Escape (que además corta el pedido).
// =============================================================================

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useCapaModal } from '@/app/_components/pila-modales';
import { useEditorLanding } from './contexto';
import { formatoDe, terminoTarjeta } from '@/lib/editor-landing/api-tipos';
import type { JsonNodo } from '@/lib/editor-landing/doc';
import {
  EstilosContenido, EstilosPanelesB, Ico, Miniatura, RevisionPropuesta, aceptarPropuesta, cortadoPorUsuario, pedirIA, tituloVivo,
  type EstadoPropuesta, type Propuesta,
} from './paneles/PanelAgente';
import { comoSeccionesNuevas, idDe, tarjetasDelDoc, tituloVisible } from './diff-tarjetas';

export type ModoAskAgent = 'editar' | 'disenos' | 'agregar';
/** El elemento al que se ancla (el botón ✨), o un rectángulo de la ventana. */
export type AnclaAskAgent = HTMLElement | DOMRect | { left: number; top: number; right: number; bottom: number } | null;

export type PropsAskAgent = {
  tarjetaId: string;
  ancla: AnclaAskAgent;
  onCerrar: () => void;
  modo?: ModoAskAgent;
};

type Opciones = { original: JsonNodo; opciones: JsonNodo[] };
type Fase =
  | { f: 'pedir' }
  | { f: 'corriendo' }
  | { f: 'opciones'; op: Opciones }
  | { f: 'revisar'; propuesta: Propuesta; estado: EstadoPropuesta; aviso?: string; op?: Opciones }
  | { f: 'mensaje'; texto: string; error: boolean };

type Accion = { rotulo: string; ico: string; instruccion?: string; traducir?: true; disenos?: true };

/** Escribir (Gamma: «Edit card with AI» → Escribir). Lo que se pide es sobre la sección entera. */
const ESCRIBIR: Accion[] = [
  { rotulo: 'Mejorar la escritura', ico: 'lapiz', instruccion: 'Mejora la escritura de esta sección. Conserva lo que dice y su estructura.' },
  { rotulo: 'Corregir la ortografía y la gramática', ico: 'check', instruccion: 'Corrige la ortografía y la gramática de esta sección. No cambies nada más.' },
  { rotulo: 'Traducir', ico: 'traducir', traducir: true },
  { rotulo: 'Alargar', ico: 'mas', instruccion: 'Alarga el texto de esta sección con más detalle útil, sin inventar datos ni cifras.' },
  { rotulo: 'Acortar', ico: 'menos', instruccion: 'Acorta el texto de esta sección a lo esencial.' },
  { rotulo: 'Simplificar el lenguaje', ico: 'texto-aa', instruccion: 'Simplifica el lenguaje de esta sección: frases cortas y palabras simples.' },
  { rotulo: 'Sé más específico', ico: 'objetivo', instruccion: 'Haz esta sección más específica y concreta, sin inventar datos ni cifras.' },
];

/** Diseño. */
const DISENO: Accion[] = [
  { rotulo: 'Hazlo más visual', ico: 'destellos', instruccion: 'Haz esta sección más visual: usa un diseño optimizado, íconos o una imagen donde ayuden. Conserva el texto.' },
  { rotulo: 'Añadir una imagen', ico: 'imagen', instruccion: 'Agrega una imagen a esta sección que acompañe lo que dice.' },
  { rotulo: 'Agregar un gráfico', ico: 'grafico-barras', instruccion: 'Agrega un gráfico a esta sección con los números que ya tiene. No inventes números.' },
  { rotulo: 'Probar nuevo diseño', ico: 'diseno', disenos: true },
];

const IDIOMAS: { rotulo: string; al: string }[] = [
  { rotulo: 'Inglés', al: 'al inglés' },
  { rotulo: 'Español', al: 'al español' },
  { rotulo: 'Portugués', al: 'al portugués' },
  { rotulo: 'Francés', al: 'al francés' },
  { rotulo: 'Alemán', al: 'al alemán' },
  { rotulo: 'Italiano', al: 'al italiano' },
];

/** Ideas para «agregar una sección» (el pedido que se manda es la frase de al lado). */
const IDEAS_AGREGAR: { rotulo: string; pedido: string }[] = [
  { rotulo: 'Preguntas frecuentes', pedido: 'Preguntas frecuentes, con un desplegable por pregunta.' },
  { rotulo: 'Testimonios', pedido: 'Testimonios de clientes. Sin inventar nombres ni frases: deja los lugares para completarlos.' },
  { rotulo: 'Beneficios', pedido: 'Los beneficios principales, con íconos.' },
  { rotulo: 'Cómo funciona', pedido: 'Cómo funciona, paso a paso.' },
  { rotulo: 'Llamado a la acción', pedido: 'Un cierre con un llamado a la acción y su botón.' },
];

const ANCHO = 380;

function rectDe(a: AnclaAskAgent): { left: number; top: number; right: number; bottom: number } | null {
  if (!a) return null;
  if (typeof Element !== 'undefined' && a instanceof Element) return a.isConnected ? a.getBoundingClientRect() : null;
  return a as { left: number; top: number; right: number; bottom: number };
}

/** La instrucción de «agregar»: la sección mandada es CONTEXTO (ver `comoSeccionesNuevas`). */
function instruccionCrear(original: JsonNodo, pedido: string): string {
  return `Crea UNA sección nueva para ir justo después de la sección «${tituloVisible(original)}». La sección que te paso es contexto: no la modifiques. La sección nueva: ${pedido}`;
}

export function AskAgent({ tarjetaId, ancla, onCerrar, modo = 'editar' }: PropsAskAgent) {
  const ctx = useEditorLanding();
  const ctxRef = useRef(ctx);
  useLayoutEffect(() => { ctxRef.current = ctx; });
  const ctxVivo = useCallback(() => ctxRef.current, []);
  const onCerrarRef = useRef(onCerrar);
  useLayoutEffect(() => { onCerrarRef.current = onCerrar; });

  const capa = useCapaModal(true, { anidada: true });
  const [fase, setFase] = useState<Fase>(modo === 'disenos' ? { f: 'corriendo' } : { f: 'pedir' });
  const [texto, setTexto] = useState('');
  const [traducir, setTraducir] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const cajaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const corteRef = useRef<AbortController | null>(null);
  const vivo = useRef(true);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; corteRef.current?.abort(); }; }, []);

  const faseRef = useRef(fase);
  useLayoutEffect(() => { faseRef.current = fase; });

  const cerrar = useCallback(() => {
    corteRef.current?.abort();
    onCerrarRef.current();
  }, []);

  /** La sección como está AHORA en el documento (no la del momento en que se abrió). */
  const seccion = (): JsonNodo | null => {
    const ed = ctxRef.current.editor;
    if (!ed || ed.isDestroyed) return null;
    return tarjetasDelDoc(ed.getJSON()).find((t) => idDe(t) === tarjetaId) ?? null;
  };
  // El título sale del documento vivo sin `getJSON` (este componente se redibuja con cada tecla).
  const tituloSeccion = tituloVivo(ctx.editor, tarjetaId) ?? '';

  // ── Pedidos ──────────────────────────────────────────────────────────────
  const correrEdicion = async (pedido: string, crear: boolean) => {
    const original = seccion();
    if (!original) { setFase({ f: 'mensaje', texto: `La ${terminoTarjeta(ctxRef.current.config)} ya no está.`, error: true }); return; }
    if (!pedido.trim()) return;
    setFase({ f: 'corriendo' });
    setTraducir(false);
    const corte = new AbortController();
    corteRef.current = corte;
    const r = await pedirIA({ accion: 'editar', instruccion: crear ? instruccionCrear(original, pedido.trim()) : pedido.trim(), tarjetas: [original], alcance: 'seccion', params: { formato: formatoDe(ctxRef.current.config) } }, { signal: corte.signal });
    if (!vivo.current) return;
    if (!r.ok) { setFase(cortadoPorUsuario(r) ? { f: 'pedir' } : { f: 'mensaje', texto: r.error, error: true }); return; }
    if (!('tarjetas' in r)) { setFase({ f: 'mensaje', texto: 'Respuesta inválida', error: true }); return; }
    if (!r.tarjetas.length) { setFase({ f: 'mensaje', texto: r.resumen || 'Sin cambios.', error: false }); return; }
    const tarjetas = crear ? comoSeccionesNuevas(r.tarjetas, original) : r.tarjetas;
    setTexto('');
    setFase({ f: 'revisar', estado: 'pendiente', propuesta: { paginaId: ctxRef.current.paginaActual, enviadas: [original], tarjetas, anclaNuevas: idDe(original) } });
  };

  const correrDisenos = async () => {
    const original = seccion();
    if (!original) { setFase({ f: 'mensaje', texto: `La ${terminoTarjeta(ctxRef.current.config)} ya no está.`, error: true }); return; }
    setFase({ f: 'corriendo' });
    const corte = new AbortController();
    corteRef.current = corte;
    const r = await pedirIA({ accion: 'disenos', tarjeta: original }, { signal: corte.signal });
    // Una corrida vieja (cortada) no pisa a la que la reemplazó: ver el efecto de abajo.
    if (!vivo.current || corteRef.current !== corte) return;
    if (!r.ok) { setFase(cortadoPorUsuario(r) ? { f: 'pedir' } : { f: 'mensaje', texto: r.error, error: true }); return; }
    if (!('opciones' in r) || !r.opciones.length) { setFase({ f: 'mensaje', texto: 'No salió un diseño distinto.', error: false }); return; }
    setFase({ f: 'opciones', op: { original, opciones: r.opciones.slice(0, 3) } });
  };

  // `modo: 'disenos'` arranca solo. Una vez: con StrictMode el efecto corre dos veces.
  const arranco = useRef(false);
  useEffect(() => {
    if (modo !== 'disenos' || arranco.current) return;
    arranco.current = true;
    void correrDisenos();
    // ⚠️ Y si el componente se desmonta (StrictMode lo hace una vez en dev, y React puede hacerlo
    // al ocultar), la limpieza de arriba CORTA el pedido: se suelta la marca para que el próximo
    // montaje lo vuelva a lanzar. Sin esto, en dev «Probar nuevo diseño» abría el menú de
    // acciones y no corría nunca (medido el 11/10/2026: el pedido salía y volvía cortado en 83 ms).
    return () => { arranco.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo]);

  const elegirOpcion = (op: Opciones, t: JsonNodo) => {
    setFase({ f: 'revisar', estado: 'pendiente', op, propuesta: { paginaId: ctxRef.current.paginaActual, enviadas: [op.original], tarjetas: [t], anclaNuevas: idDe(op.original) } });
  };

  const aceptar = async (sinVersion: boolean) => {
    const actual = faseRef.current;
    if (actual.f !== 'revisar') return;
    setFase({ ...actual, estado: 'aplicando', aviso: undefined });
    const r = await aceptarPropuesta(ctxVivo, actual.propuesta, { sinVersion });
    if (!vivo.current) return;
    if (!r.ok) { setFase({ ...actual, estado: r.sinVersion ? 'sin-version' : 'pendiente', aviso: r.error }); return; }
    ctxRef.current.avisar('Cambio aplicado');
    onCerrarRef.current();
  };

  const descartar = () => {
    const actual = faseRef.current;
    if (actual.f === 'revisar' && actual.op) { setFase({ f: 'opciones', op: actual.op }); return; }
    cerrar();
  };

  const enviar = () => {
    if (fase.f !== 'pedir' && fase.f !== 'mensaje') return;
    void correrEdicion(texto, modo === 'agregar');
  };

  const elegirAccion = (a: Accion) => {
    if (a.disenos) { void correrDisenos(); return; }
    if (a.traducir) { setTraducir((v) => !v); return; }
    if (a.instruccion) void correrEdicion(a.instruccion, false);
  };

  // ── Dónde va ─────────────────────────────────────────────────────────────
  const ubicar = useCallback(() => {
    const caja = cajaRef.current;
    if (!caja) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(ANCHO, vw - 16);
    const h = caja.offsetHeight;
    const r = rectDe(ancla);
    let left: number;
    let top: number;
    if (!r) {
      left = (vw - w) / 2;
      top = Math.max(8, (vh - h) / 3);
    } else {
      left = r.right + 8;
      if (left + w > vw - 8) left = r.left - w - 8;
      if (left < 8) left = Math.min(Math.max(8, r.left), vw - w - 8);
      top = r.top;
      if (top + h > vh - 8) top = Math.max(8, vh - h - 8);
    }
    left = Math.round(left);
    top = Math.round(top);
    setPos((p) => (p && p.left === left && p.top === top ? p : { left, top }));
  }, [ancla]);

  // Se vuelve a ubicar cuando cambia lo de adentro (el alto cambia con cada fase).
  useLayoutEffect(() => { ubicar(); }, [ubicar, fase, traducir]);
  useEffect(() => {
    const caja = cajaRef.current;
    const ro = new ResizeObserver(() => ubicar());
    if (caja) ro.observe(caja);
    window.addEventListener('resize', ubicar);
    window.addEventListener('scroll', ubicar, true);
    return () => { ro.disconnect(); window.removeEventListener('resize', ubicar); window.removeEventListener('scroll', ubicar, true); };
  }, [ubicar]);

  // El foco al input, cuando ya se ve (un elemento con `visibility: hidden` no lo recibe).
  const visible = pos !== null;
  useEffect(() => {
    if (visible && modo !== 'disenos') inputRef.current?.focus();
  }, [visible, modo]);

  // ── Escape y clic afuera ─────────────────────────────────────────────────
  // `esElDeArriba` es estable (lee la pila viva): el listener no se re-registra en cada render.
  const arriba = capa.esElDeArriba;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !arriba()) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      cerrar();
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t || cajaRef.current?.contains(t)) return;
      if (typeof Element !== 'undefined' && ancla instanceof Element && ancla.contains(t)) return;
      if (!arriba()) return;
      const f = faseRef.current.f;
      if (f === 'corriendo' || f === 'revisar') return;
      cerrar();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onDown, true);
    return () => { document.removeEventListener('keydown', onKey, true); document.removeEventListener('mousedown', onDown, true); };
  }, [arriba, cerrar, ancla]);

  if (typeof document === 'undefined') return null;

  const ocupado = fase.f === 'corriendo';
  const estilo: CSSProperties = {
    left: pos?.left ?? 0,
    top: pos?.top ?? 0,
    zIndex: capa.z + 1,
    width: Math.min(ANCHO, typeof window !== 'undefined' ? window.innerWidth - 16 : ANCHO),
    visibility: visible ? 'visible' : 'hidden',
    display: capa.visible ? undefined : 'none',
  };

  return createPortal(
    <div ref={cajaRef} className="gma gma-pb gma-ask" style={estilo} role="dialog" aria-label="Pídele algo a MaKo">
      <EstilosPanelesB />
      <EstilosContenido tema={ctx.tema} />
      <style href="gma-ask" precedence="medium">{CSS_ASK}</style>

      <div className="gma-ask-cab">
        <span className="gma-ask-donde" title={tituloSeccion}>{modo === 'agregar' ? 'Después de: ' : ''}{tituloSeccion || terminoTarjeta(ctx.config, { mayuscula: true })}</span>
        <button type="button" className="gma-pb-iconbtn" onClick={cerrar} aria-label="Cerrar" title="Cerrar"><Ico n="cerrar" t={14} /></button>
      </div>

      {(fase.f === 'pedir' || fase.f === 'corriendo' || fase.f === 'mensaje') && (
        <div className="gma-ask-entrada" data-ocupada={ocupado ? '' : undefined}>
          <Ico n="destellos" t={16} />
          <input
            ref={inputRef}
            className="gma-ask-input"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); enviar(); } }}
            placeholder={ocupado ? 'Espera a que la IA termine' : modo === 'agregar' ? `Describe la ${terminoTarjeta(ctx.config)} nueva` : 'Pídele algo a MaKo'}
            disabled={ocupado}
            aria-label="Pídele algo a MaKo"
          />
          {ocupado
            ? <button type="button" className="gma-ask-ir" data-listo="" onClick={() => corteRef.current?.abort()} aria-label="Detener generación" title="Detener generación"><span className="gma-ask-cuadro" /></button>
            : <button type="button" className="gma-ask-ir" data-listo={texto.trim() ? '' : undefined} onClick={enviar} disabled={!texto.trim()} aria-label="Enviar" title="Enviar"><Ico n="flecha-derecha" t={15} /></button>}
        </div>
      )}

      {fase.f === 'corriendo' && <div className="gma-ask-estado"><span className="gma-pb-giro" aria-hidden /> Pensando</div>}

      {fase.f === 'mensaje' && (
        <div className="gma-ask-estado" data-error={fase.error ? '' : undefined} role={fase.error ? 'alert' : undefined}>{fase.texto}</div>
      )}

      {fase.f === 'pedir' && modo !== 'agregar' && (
        <div className="gma-ask-listas">
          <div className="gma-ask-grupo">
            <div className="gma-ask-gtit">Escribir</div>
            {ESCRIBIR.map((a) => (
              <div key={a.rotulo}>
                <button type="button" className="gma-ask-item" aria-expanded={a.traducir ? traducir : undefined} onClick={() => elegirAccion(a)}>
                  <Ico n={a.ico} t={15} /> <span>{a.rotulo}</span>
                  {a.traducir && <span className="gma-ask-chev"><Ico n={traducir ? 'chevron-arriba' : 'chevron-abajo'} t={13} /></span>}
                </button>
                {a.traducir && traducir && (
                  <div className="gma-ask-idiomas">
                    {IDIOMAS.map((i) => (
                      <button key={i.rotulo} type="button" className="gma-ask-pildora" onClick={() => void correrEdicion(`Traduce esta sección ${i.al}.`, false)}>{i.rotulo}</button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="gma-ask-grupo">
            <div className="gma-ask-gtit">Diseño</div>
            {DISENO.map((a) => (
              <button key={a.rotulo} type="button" className="gma-ask-item" onClick={() => elegirAccion(a)}>
                <Ico n={a.ico} t={15} /> <span>{a.rotulo}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {fase.f === 'pedir' && modo === 'agregar' && (
        <div className="gma-ask-ideas">
          {IDEAS_AGREGAR.map((i) => (
            <button key={i.rotulo} type="button" className="gma-ask-pildora" onClick={() => void correrEdicion(i.pedido, true)}>{i.rotulo}</button>
          ))}
        </div>
      )}

      {fase.f === 'opciones' && (
        <div className="gma-ask-opciones">
          <div className="gma-ask-gtit">Elige un diseño</div>
          <div className="gma-ask-grilla">
            {fase.op.opciones.map((t, i) => (
              <button key={i} type="button" className="gma-ask-opcion" onClick={() => elegirOpcion(fase.op, t)} aria-label={`Diseño ${i + 1}`}>
                <Miniatura tarjeta={t} tema={ctx.tema} alto={150} />
              </button>
            ))}
          </div>
          <div className="gma-rv-acciones">
            <button type="button" className="gma-pb-boton" data-v="fantasma" data-t="s" onClick={() => void correrDisenos()}><Ico n="refrescar" t={13} /> Probar otros</button>
          </div>
        </div>
      )}

      {fase.f === 'revisar' && (
        <RevisionPropuesta
          propuesta={fase.propuesta}
          estado={fase.estado}
          aviso={fase.aviso}
          onAceptar={() => void aceptar(false)}
          onAplicarIgual={() => void aceptar(true)}
          onDescartar={descartar}
        />
      )}
    </div>,
    document.body,
  );
}

export default AskAgent;

const CSS_ASK = `
.gma-ask{position:fixed;display:grid;gap:8px;max-height:calc(100vh - 16px);overflow-y:auto;padding:8px;border-radius:16px;background:var(--pb-fondo);box-shadow:var(--pb-sombra),0 0 0 1px var(--pb-borde)}
.gma-ask-cab{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 0 0 6px}
.gma-ask-donde{min-width:0;font-size:12px;font-weight:600;color:var(--pb-suave);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gma-ask-entrada{display:flex;align-items:center;gap:8px;min-height:44px;padding:6px 6px 6px 12px;border-radius:12px;color:var(--pb-suave);box-shadow:0 0 0 1px var(--pb-borde);transition:box-shadow .15s ease}
.gma-ask-entrada:focus-within{box-shadow:0 0 0 1.5px var(--pb-vivo)}
.gma-ask-entrada[data-ocupada]{background:var(--pb-sup)}
.gma-ask-input{flex:1;min-width:0;border:0;outline:none;background:transparent;color:var(--pb-texto);font:inherit;font-size:14px}
.gma-ask-input::placeholder{color:var(--pb-suave)}
.gma-ask-ir{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;flex:none;border:0;border-radius:50%;background:var(--pb-borde);color:var(--pb-fondo);cursor:pointer;transition:background .15s ease}
.gma-ask-ir[data-listo]{background:var(--pb-vivo);color:#ffffff}
.gma-ask-ir:disabled{cursor:default}
.gma-ask-cuadro{display:block;width:10px;height:10px;border-radius:2px;background:currentColor}
.gma-ask-estado{display:flex;align-items:center;gap:8px;padding:4px 8px;font-size:13px;color:var(--pb-tenue)}
.gma-ask-estado[data-error]{color:var(--pb-mal)}
.gma-ask-listas{display:grid;gap:6px}
.gma-ask-grupo{display:grid;gap:1px}
.gma-ask-gtit{padding:6px 8px 4px;font-size:11.5px;font-weight:700;color:var(--pb-suave)}
.gma-ask-item{display:flex;align-items:center;gap:10px;width:100%;height:32px;padding:0 8px;border:0;border-radius:6px;background:transparent;color:var(--pb-texto);font:inherit;font-size:13.5px;font-weight:500;text-align:left;cursor:pointer}
.gma-ask-item>.gma-pb-ico{color:var(--pb-tenue)}
.gma-ask-item:hover{background:var(--pb-sup)}
.gma-ask-chev{margin-left:auto;color:var(--pb-suave)}
.gma-ask-idiomas,.gma-ask-ideas{display:flex;flex-wrap:wrap;gap:6px;padding:4px 8px 6px 34px}
.gma-ask-ideas{padding:2px 4px 4px}
.gma-ask-pildora{padding:5px 11px;border:0;border-radius:999px;background:var(--pb-celeste);color:var(--pb-tinta);font:inherit;font-size:12.5px;font-weight:500;cursor:pointer}
.gma-ask-pildora:hover{background:var(--pb-celeste2)}
.gma-ask-opciones{display:grid;gap:8px}
.gma-ask-grilla{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.gma-ask-opcion{display:block;padding:0;border:0;border-radius:9px;background:transparent;cursor:pointer;transition:box-shadow .15s ease}
.gma-ask-opcion:hover,.gma-ask-opcion:focus-visible{box-shadow:0 0 0 2px var(--pb-vivo);outline:none}
`;
