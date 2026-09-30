'use client';

// =============================================================================
// Lienzo — un grafo que se panea, se acerca, y se edita tocando un nodo
// =============================================================================
// El chrome de una pantalla tipo flujo, sin saber NADA de lo que dibuja. Lo usan
// los dos flujos del producto y el día que haya un tercero lo hereda gratis:
//
//   · `app/chatbot/FlujoLienzo.tsx`  — la conversación con un lead
//   · `app/agencia/FlujoAviso.tsx`   — lo que MaKo te dice a vos
//
// Nació genérico el 30/09/2026, el mismo día que el segundo: la primera versión
// tenía las burbujas de WhatsApp adentro del paneo, y copiarla habría dejado dos
// lienzos que se separan en la primera edición — que es la razón escrita por la
// que se borró el editor de diagramas del funnel.
//
// Quien lo usa pone TRES cosas: el grafo, cómo se dibuja cada nodo y qué se edita
// al tocarlo. Todo lo demás —el gesto, el encuadre, las curvas, el panel— es de acá.
//
// ── LAS CUATRO TRAMPAS DE UN LIENZO, TODAS MEDIDAS EN EL NAVEGADOR ─────────
// 1. El alto sale del VIEWPORT, nunca de un `aspect-ratio`: con proporción, el
//    lienzo medía 1444×1083 sobre un viewport de 900 — crecía justo en el monitor
//    donde más espacio hay. Y el padre estira con flex + `minHeight: 0`, porque
//    `height: 100%` contra un padre con `flex: 1` devuelve CERO en Safari.
// 2. `setPointerCapture` RETARGETEA todo lo que sigue al elemento que capturó, así
//    que en el `pointerup` el `e.target` es el CONTENEDOR: el nodo del clic se
//    anota en el `pointerdown`. Y el `release` puede tirar y llevarse el clic.
// 3. El movimiento se escribe con `transform` sobre un REF adentro del handler,
//    nunca con `setState`: un setState por `pointermove` redibuja el grafo entero
//    60 veces por segundo.
// 4. `touch-action: none` es obligatorio para el pellizco y ATRAPA el scroll de la
//    página: por eso el alto tiene tope y el lienzo no ocupa todo el largo.

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  curvaEntre, medioDeCurva,
  type GrafoFlujo, type NodoFlujo, type TonoArista,
} from '@/lib/lienzo-grafo';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

/** Cuánto se puede alejar y acercar. Los mismos topes que el mapa del segundo
 *  cerebro, que es el otro lienzo de la casa. */
const K_MIN = 0.4;
const K_MAX = 2.4;
/** Umbral de arrastre al cuadrado: por debajo de esto, el gesto fue un CLIC.
 *  Va al cuadrado para no sacar una raíz por cada `pointermove`. */
const ARRASTRE2 = 25;
/** Ancho del panel de edición, y el margen con el que se despega del borde. */
const PANEL_ANCHO = 328;
const PANEL_MARGEN = 12;

export const COLOR_TONO: Record<TonoArista, string> = {
  normal: 'var(--border-strong)',
  buena: 'var(--good)',
  mala: 'var(--bad)',
  condicional: 'var(--primary)',
};

export function Lienzo({
  grafo, seleccion, onSeleccion, renderNodo, renderEditor, tituloEditor, accion, ayuda, alto = 'min(54svh, 460px)',
}: {
  grafo: GrafoFlujo;
  /** El nodo abierto. Va CONTROLADO: quien lo usa tiene que poder cerrarlo al
   *  borrar un paso, o el panel queda abierto sobre un nodo que ya no existe. */
  seleccion: string | null;
  onSeleccion: (id: string | null) => void;
  renderNodo: (nodo: NodoFlujo, activo: boolean) => ReactNode;
  renderEditor: (nodo: NodoFlujo) => ReactNode;
  /** La cabecera del panel. Por default, el ícono y el título del nodo. */
  tituloEditor?: (nodo: NodoFlujo) => ReactNode;
  /** El botón flotante de abajo a la derecha («＋ Mensaje»). */
  accion?: ReactNode;
  ayuda?: string;
  alto?: string;
}) {
  const caja = useRef<HTMLDivElement | null>(null);
  const capa = useRef<HTMLDivElement | null>(null);
  const vista = useRef({ k: 1, tx: 0, ty: 0 });
  const gesto = useRef<{ x0: number; y0: number; tx0: number; ty0: number; movido: number; nodo: string | null } | null>(null);
  const [zoomTxt, setZoomTxt] = useState(100);
  /** La última forma encuadrada: grafo + caja. Ver `encuadrar`. */
  const encuadrado = useRef('');

  /** Escribe la vista en el DOM. NUNCA pasa por setState: ver la trampa 3. */
  const pintar = useCallback(() => {
    const v = vista.current;
    if (capa.current) capa.current.style.transform = `translate(${v.tx}px, ${v.ty}px) scale(${v.k})`;
  }, []);

  /** Encuadra el grafo entero en la caja. */
  const encuadrar = useCallback((forzar = false) => {
    const c = caja.current;
    if (!c) return;
    const w = c.clientWidth, h = c.clientHeight;
    if (w === 0 || h === 0) return;
    // ⚠️ SÓLO SE REENCUADRA SI CAMBIÓ LA FORMA, o si lo pidió el botón «Centrar».
    // Sin esta guarda, cualquier cosa que reinstale el ResizeObserver —y `observe()`
    // dispara al suscribirse— vuelve a centrar la vista: medido en el navegador,
    // tocar un nodo devolvía el lienzo a su posición inicial y deshacía el paneo que
    // la persona acababa de hacer. El síntoma no se lee como un bug del encuadre:
    // se lee como que el lienzo «rebota solo».
    const firma = `${Math.round(grafo.ancho)}x${Math.round(grafo.alto)}@${w}x${h}`;
    if (!forzar && encuadrado.current === firma) return;
    encuadrado.current = firma;
    const k = Math.min(1, Math.min(w / grafo.ancho, h / grafo.alto));
    vista.current = { k, tx: (w - grafo.ancho * k) / 2, ty: (h - grafo.alto * k) / 2 };
    setZoomTxt(Math.round(k * 100));
    pintar();
  }, [grafo.ancho, grafo.alto, pintar]);

  useEffect(() => { encuadrar(); }, [encuadrar]);

  useEffect(() => {
    const c = caja.current;
    if (!c) return;
    const ro = new ResizeObserver(() => encuadrar());
    ro.observe(c);
    return () => ro.disconnect();
  }, [encuadrar]);

  // La rueda va con un listener NO PASIVO puesto a mano: React los registra
  // pasivos, así que un `onWheel` de JSX no puede llamar a preventDefault y la
  // página scrollea detrás del zoom.
  useEffect(() => {
    const c = caja.current;
    if (!c) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = c.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top;
      const v = vista.current;
      const kNuevo = Math.max(K_MIN, Math.min(K_MAX, v.k * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
      // Zoom ANCLADO AL CURSOR: sin esto el dibujo se escapa de la vista y hay
      // que volver a encuadrar en cada rueda.
      vista.current = {
        k: kNuevo,
        tx: px - (px - v.tx) * (kNuevo / v.k),
        ty: py - (py - v.ty) * (kNuevo / v.k),
      };
      setZoomTxt(Math.round(kNuevo * 100));
      pintar();
    };
    c.addEventListener('wheel', onWheel, { passive: false });
    return () => c.removeEventListener('wheel', onWheel);
  }, [pintar]);

  function onPointerDown(e: React.PointerEvent) {
    // Los controles de adentro del editor no arrastran el lienzo.
    if ((e.target as HTMLElement).closest('[data-no-pan]')) return;
    const v = vista.current;
    // ⚠️ EL NODO SE ANOTA ACÁ, EN EL POINTERDOWN, Y NO AL SOLTAR. `setPointerCapture`
    // RETARGETEA todos los eventos siguientes al elemento que capturó: en el
    // `pointerup` el `e.target` ya es el contenedor, así que buscar el nodo ahí
    // devuelve null SIEMPRE. Medido en el navegador: tocar un paso no abría nada, y
    // el handler se leía perfecto.
    gesto.current = {
      x0: e.clientX, y0: e.clientY, tx0: v.tx, ty0: v.ty, movido: 0,
      nodo: (e.target as HTMLElement).closest('[data-nodo]')?.getAttribute('data-nodo') ?? null,
    };
    try { caja.current?.setPointerCapture(e.pointerId); } catch { /* el gesto sigue sin captura */ }
  }

  function onPointerMove(e: React.PointerEvent) {
    const g = gesto.current;
    if (!g) return;
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    g.movido = Math.max(g.movido, dx * dx + dy * dy);
    vista.current = { ...vista.current, tx: g.tx0 + dx, ty: g.ty0 + dy };
    pintar();
  }

  function onPointerUp(e: React.PointerEvent) {
    const g = gesto.current;
    gesto.current = null;
    // ⚠️ EL RELEASE VA ADENTRO DE UN try, Y DESPUÉS DE RESOLVER EL CLIC. Tirar acá
    // —`InvalidPointerId` si la captura no llegó a tomarse— abortaba el handler y
    // el nodo no se abría, con el código leyéndose perfecto.
    if (!g) return;
    // El CLIC se resuelve acá y no en un onClick del nodo: con la captura puesta,
    // los eventos siguientes van al contenedor y el onClick del hijo no dispara.
    if (g.movido <= ARRASTRE2) onSeleccion(g.nodo && seleccion === g.nodo ? null : g.nodo);
    try { caja.current?.releasePointerCapture(e.pointerId); } catch { /* ya se soltó */ }
  }

  // ⚠️ EL PANEL NO PUEDE TAPAR EL NODO QUE SE ESTÁ EDITANDO. Está anclado abajo a
  // la izquierda —donde siempre entra, sin la matemática de un popover que se da
  // vuelta contra el borde— y por eso los nodos de la primera columna quedaban
  // detrás: se escribía a ciegas sobre una burbuja que no se veía.
  //
  // Se corre el LIENZO, no el panel: mover el panel lo llevaría a tapar otra cosa,
  // y correr la vista es lo que la persona haría a mano. Sólo cuando hace falta, y
  // nunca al revés — si el nodo ya se ve, no se toca nada.
  useEffect(() => {
    if (!seleccion || !caja.current) return;
    const n = grafo.nodos.find((x) => x.id === seleccion);
    if (!n) return;
    const v = vista.current;
    const izquierdaEnPantalla = v.tx + n.x * v.k;
    const libre = PANEL_ANCHO + PANEL_MARGEN * 2;
    if (izquierdaEnPantalla >= libre) return;
    vista.current = { ...v, tx: v.tx + (libre - izquierdaEnPantalla) };
    pintar();
    // `grafo.nodos` cambia en cada tecla del editor; la dependencia es el NODO
    // elegido, o esto volvería a correr la vista mientras se escribe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccion]);

  const nodoSel = grafo.nodos.find((n) => n.id === seleccion) ?? null;
  const zoom = (f: number) => {
    const v = vista.current;
    const k = Math.max(K_MIN, Math.min(K_MAX, v.k * f));
    vista.current = { ...v, k };
    setZoomTxt(Math.round(k * 100));
    pintar();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      {/* La barra: lo que no es el lienzo va afuera del lienzo, o el pan se lo lleva. */}
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        {ayuda && <span style={{ fontSize: 12, color: 'var(--faint)', marginRight: 'auto' }}>{ayuda}</span>}
        <BotonChico onClick={() => zoom(1 / 1.2)} rotulo="Alejar">−</BotonChico>
        <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--dim)', minWidth: 38, textAlign: 'center' }}>{zoomTxt}%</span>
        <BotonChico onClick={() => zoom(1.2)} rotulo="Acercar">＋</BotonChico>
        <BotonChico onClick={() => encuadrar(true)} rotulo="Centrar">⤢</BotonChico>
      </div>

      <div
        ref={caja}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        // ⚠️ `overflow: hidden` NO impide que el contenedor se scrollee POR CÓDIGO, y
        // eso desincroniza el dibujo de la vista: el `transform` sigue diciendo una
        // cosa y en pantalla todo está corrido. Pasa solo — al enfocar un input de un
        // nodo que quedó fuera de cuadro, con el buscar-en-página del navegador, o con
        // cualquier `scrollIntoView`. Medido acá: un nodo a 1652 px se «movió» 330 px
        // con el transform intacto. La vista la gobierna el transform y nada más.
        onScroll={(e) => { e.currentTarget.scrollLeft = 0; e.currentTarget.scrollTop = 0; }}
        style={{
          position: 'relative', flex: 1, minHeight: alto, overflow: 'hidden',
          borderRadius: 14, border: '1px solid var(--border)',
          background: 'var(--surface-2)',
          // El punteado hace que el paneo se SIENTA: sin un fondo con textura,
          // arrastrar un lienzo vacío parece que no hizo nada.
          backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          touchAction: 'none', cursor: 'grab', userSelect: 'none',
        }}
      >
        <div ref={capa} style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', willChange: 'transform' }}>
          <svg width={grafo.ancho} height={grafo.alto} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}>
            <defs>
              {(Object.keys(COLOR_TONO) as TonoArista[]).map((t) => (
                <marker key={t} id={`punta-${t}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                  <path d="M0,0 L8,4 L0,8 z" fill={COLOR_TONO[t]} />
                </marker>
              ))}
            </defs>
            {grafo.aristas.map((a, i) => {
              const d = grafo.nodos.find((n) => n.id === a.desde);
              const h = grafo.nodos.find((n) => n.id === a.hasta);
              if (!d || !h) return null;
              return (
                <path key={i} d={curvaEntre(d, h)} fill="none" stroke={COLOR_TONO[a.tono]}
                  strokeWidth={1.6} strokeDasharray={a.tono === 'condicional' ? '5 4' : undefined}
                  markerEnd={`url(#punta-${a.tono})`} opacity={0.85} />
              );
            })}
          </svg>

          {/* Las etiquetas de las flechas son HTML, no <text>: llevan fondo, radio
              y el tipo de la casa, y un <text> de SVG no hereda nada de eso. */}
          {grafo.aristas.map((a, i) => {
            if (!a.etiqueta) return null;
            const d = grafo.nodos.find((n) => n.id === a.desde);
            const h = grafo.nodos.find((n) => n.id === a.hasta);
            if (!d || !h) return null;
            const m = medioDeCurva(d, h);
            return (
              <div key={`et-${i}`} style={{
                position: 'absolute', left: m.x, top: m.y, transform: 'translate(-50%, -50%)',
                padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap',
                background: 'var(--surface)', border: `1px solid ${COLOR_TONO[a.tono]}`,
                fontSize: 10.5, color: 'var(--dim)', fontFamily: SANS, pointerEvents: 'none',
              }}>{a.etiqueta}</div>
            );
          })}

          {grafo.nodos.map((n) => renderNodo(n, seleccion === n.id))}
        </div>

        {/* La acción va FUERA de la capa transformada, o se achica con el zoom. */}
        {accion && <div data-no-pan style={{ position: 'absolute', right: 12, bottom: 12 }}>{accion}</div>}

        {/* EL EDITOR. Va acá adentro y en coordenadas de PANTALLA: si viviera en la
            capa transformada, el zoom le cambiaría el tamaño a los inputs. */}
        {nodoSel && (
          <div
            data-no-pan
            style={{
              position: 'absolute', left: PANEL_MARGEN, bottom: PANEL_MARGEN, width: PANEL_ANCHO,
              maxHeight: 'calc(100% - 24px)', overflowY: 'auto', padding: 14, borderRadius: 14,
              background: 'var(--surface)', border: '1px solid var(--border-strong)',
              boxShadow: '0 12px 32px rgba(0,0,0,.14)', cursor: 'default',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              {tituloEditor ? tituloEditor(nodoSel) : (
                <>
                  <span style={{ fontSize: 15 }}>{nodoSel.icono}</span>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', flex: 1, minWidth: 0 }}>{nodoSel.titulo}</div>
                </>
              )}
              <button onClick={() => onSeleccion(null)} aria-label="Cerrar el editor"
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--faint)', fontSize: 15, cursor: 'pointer', padding: 0 }}>✕</button>
            </div>
            {renderEditor(nodoSel)}
          </div>
        )}
      </div>
    </div>
  );
}

/** La tarjeta de un nodo. La forma es del lienzo; el CONTENIDO lo pone quien lo usa. */
export function TarjetaNodo({ nodo, activo, roto, children }: {
  nodo: NodoFlujo; activo: boolean; roto?: boolean; children: ReactNode;
}) {
  const borde = activo ? 'var(--primary)' : roto ? 'var(--bad)' : 'var(--border)';
  return (
    <div
      data-nodo={nodo.id}
      role="button" tabIndex={0} aria-pressed={activo}
      style={{
        position: 'absolute', left: nodo.x, top: nodo.y, width: nodo.ancho, minHeight: nodo.alto,
        borderRadius: 13, background: 'var(--surface)', border: `1.5px solid ${borde}`,
        boxShadow: activo ? '0 0 0 3px var(--primary-bg)' : '0 1px 2px rgba(0,0,0,.05)',
        padding: 11, boxSizing: 'border-box', cursor: 'pointer', fontFamily: SANS,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
        <span style={{ fontSize: 13 }}>{nodo.icono}</span>
        <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--dim)' }}>
          {nodo.titulo}
        </span>
        {nodo.advertencia && (
          <span title={nodo.advertencia} style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--warn)' }}>⚠</span>
        )}
      </div>
      {children}
    </div>
  );
}

export function BotonChico({ children, onClick, rotulo }: { children: ReactNode; onClick: () => void; rotulo: string }) {
  return (
    <button data-no-pan onClick={onClick} title={rotulo} aria-label={rotulo}
      style={{
        width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border-strong)',
        background: 'var(--surface)', color: 'var(--dim)', cursor: 'pointer',
        fontFamily: SANS, fontSize: 13, lineHeight: 1, display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center',
      }}>{children}</button>
  );
}

/** El estilo de un input adentro del panel. Vive acá para que los dos lienzos no
 *  lo copien: un editor que se ve distinto según qué flujo abriste es el olor de
 *  dos piezas que ya empezaron a separarse. */
export const inpLienzo: CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8,
  border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)',
  fontSize: 13, fontFamily: SANS, outline: 'none',
};

export const rotuloLienzo: CSSProperties = {
  fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase',
  color: 'var(--dim)', display: 'block', marginBottom: 6,
};
