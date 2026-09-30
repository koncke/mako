'use client';

// =============================================================================
// FlujoLienzo — la conversación como un flujo, y se edita tocando un nodo
// =============================================================================
// El pedido, textual: «Quiero que los editables del flujo de conversación sea
// como el editable de Manychat, que tiene una pantalla tipo flujo, y ahí se edita
// todo», con la captura del Flow Builder al lado.
//
// ── QUÉ SE COPIA DE MANYCHAT Y QUÉ NO ──────────────────────────────────────
// Lo que se copia, que es lo que hace que ese editor no se sienta una maraña:
//   · El nodo MUESTRA EL MENSAJE tal cual le llega a la persona — la misma
//     burbuja de WhatsApp del resto del producto, no un resumen de campos. Sin
//     esto el lienzo es un diagrama, no un editor.
//   · Tocar un nodo abre su editor ENCIMA del lienzo, con los controles que ya
//     existían. En ManyChat es literal: «When you click on a step, a window will
//     pop up allowing you to edit it». No hay panel de propiedades.
//   · Las ramas se leen SIN abrir nada: cada salida lleva su nombre en la flecha.
//
// Lo que NO se copia, y es una decisión, no una carencia:
//   · El drag-to-connect. Este repo ya lo construyó (el mapa de transiciones del
//     funnel: 14 etapas, 24 flechas) y el dueño lo descartó por REBUSCADO, con el
//     criterio escrito: «así se evita que el usuario tenga que configurar
//     flechas». Acá las flechas salen del dato — el porqué, en lib/flujo-conversacion.ts.
//   · Mover los nodos a mano. La secuencia más grande de toda la base tiene TRES
//     pasos: acomodar siete cajas es ceremonia, y guardar posiciones sería un
//     campo nuevo que `setSecuenciaPasos` descarta por no conocerlo.
//
// ── LO QUE ESTE LIENZO REEMPLAZA ───────────────────────────────────────────
// A las tres sub-tabs del perfil (Estrategia / Mensajes / Variantes), no se suma
// a ellas. Es la lección del editor de diagramas que murió hace dos días: dos
// editores del mismo dato divergen, y el segundo se queda viejo.
//
// ── LAS CUATRO TRAMPAS DE UN LIENZO, YA PAGADAS EN ESTA CASA ───────────────
// 1. El alto sale del VIEWPORT, nunca de un aspect-ratio: con `aspect-ratio` el
//    lienzo medía 1444×1083 sobre un viewport de 900 — crecía justo en el monitor
//    donde más espacio hay. Y el padre estira con flex + `minHeight: 0`, porque
//    `height: 100%` contra un padre con `flex: 1` devuelve CERO en Safari.
// 2. El gesto va por POINTER EVENTS, no por HTML5 drag-and-drop: acá no se
//    transporta nada, se mueve un valor continuo. Y `setPointerCapture` va sobre
//    el CONTENEDOR, no sobre `e.target` — captura retargetea todo lo que sigue, y
//    el primer re-render de React reemplaza el nodo y la captura se pierde.
// 3. El movimiento se escribe con `transform` sobre un REF adentro de un rAF,
//    nunca con `setState` por evento: un setState por `pointermove` redibuja el
//    grafo entero 60 veces por segundo, que es el bug clásico de esta familia.
// 4. `touch-action: none` es obligatorio para el pellizco y ATRAPA el scroll de
//    la página: por eso el alto tiene tope y el lienzo no ocupa todo el largo.

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Dropdown } from '../components/Dropdown';
import { AudioPlay } from '@/app/whatsapp/_shared/AudioPlay';
import { BURBUJA_SALIENTE } from '@/app/whatsapp/_shared/BurbujaMaKo';
import { PasoAudioControl } from './PasoAudioControl';
import {
  grafoDeSecuencia, curvaEntre, medioDeCurva, CONDICION_TXT, CONDICIONES_VIVAS,
  type NodoFlujo, type GrafoFlujo, type PasoParaGrafo, type EstrategiaParaGrafo,
} from '@/lib/flujo-conversacion';
import type { AudioSetting, PasoSecuenciaDto } from './ChatAgentApp';
import type { Desenlace, ModoRespuesta } from '@/lib/setting-estrategia';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

/** Cuánto se puede alejar y acercar, relativo al encuadre inicial. Los mismos
 *  topes que el mapa del segundo cerebro, que es el otro lienzo de la casa. */
const K_MIN = 0.4;
const K_MAX = 2.4;
/** Umbral de arrastre al cuadrado: por debajo de esto, el gesto fue un CLIC.
 *  Va al cuadrado para no sacar una raíz por cada `pointermove`. */
const ARRASTRE2 = 25;
/** Ancho del panel de edición, y el margen con el que se despega del borde. */
const PANEL_ANCHO = 328;
const PANEL_MARGEN = 12;

const inp: CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8,
  border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)',
  fontSize: 13, fontFamily: SANS, outline: 'none',
};
const rotulo: CSSProperties = {
  fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase',
  color: 'var(--dim)', display: 'block', marginBottom: 6,
};

const COLOR_TONO: Record<string, string> = {
  normal: 'var(--border-strong)',
  buena: 'var(--good)',
  mala: 'var(--bad)',
  condicional: 'var(--primary)',
};

export function FlujoLienzo({
  pasos, estrategia, etiquetaEtapa, secuencias, audios, negocio, rolAdmin, busy,
  onEditarPaso, onAgregarPaso, onQuitarPaso, onAudio, onAudioNuevo, onError,
  onEditarVariante, onQuitarVariante,
  onModo, onDesenlace, onAntiguedad, onAbrirSecuencia,
}: {
  pasos: PasoSecuenciaDto[];
  estrategia: EstrategiaParaGrafo;
  etiquetaEtapa: string;
  /** Las del workspace, para resolver a qué apunta un «Sigue con». */
  secuencias: ReadonlyArray<{ clave: string; nombre: string }>;
  audios: AudioSetting[];
  negocio: string;
  rolAdmin: boolean;
  busy: boolean;
  onEditarPaso: (orden: number, campo: 'cuerpo' | 'asunto' | 'delay_horas', val: string | number) => void;
  onAgregarPaso: () => void;
  onQuitarPaso: (orden: number) => void;
  onAudio: (orden: number, audioId: number | null) => void;
  onAudioNuevo: (a: AudioSetting) => void;
  onError: (m: string) => void;
  onEditarVariante: (orden: number, i: number, val: string) => void;
  onQuitarVariante: (orden: number, i: number) => void;
  onModo: (m: ModoRespuesta) => void;
  onDesenlace: (d: Desenlace) => void;
  onAntiguedad: (h: number | null) => void;
  /** Abrir OTRA secuencia: es el «Go To», y tiene que llevar de verdad. */
  onAbrirSecuencia: (clave: string) => void;
}) {
  const caja = useRef<HTMLDivElement | null>(null);
  const capa = useRef<HTMLDivElement | null>(null);
  const vista = useRef({ k: 1, tx: 0, ty: 0 });
  const gesto = useRef<{ activo: boolean; x0: number; y0: number; tx0: number; ty0: number; movido: number; nodo: string | null } | null>(null);
  const [zoomTxt, setZoomTxt] = useState(100);
  /** La última forma encuadrada: grafo + caja. Ver `encuadrar`. */
  const encuadrado = useRef('');
  const [sel, setSel] = useState<string | null>(null);

  const grafo: GrafoFlujo = grafoDeSecuencia(
    pasos as PasoParaGrafo[], estrategia, etiquetaEtapa, secuencias,
  );

  /** Escribe la vista en el DOM. NUNCA pasa por setState: ver la trampa 3. */
  const pintar = useCallback(() => {
    const v = vista.current;
    if (capa.current) capa.current.style.transform = `translate(${v.tx}px, ${v.ty}px) scale(${v.k})`;
  }, []);

  /** Encuadra el grafo entero en la caja. Se llama al montar, al cambiar el
   *  tamaño de la caja y cuando el grafo cambia de forma (un paso más, una rama
   *  nueva): si no, agregar un mensaje lo deja dibujado fuera de la vista. */
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
    vista.current = {
      k,
      tx: (w - grafo.ancho * k) / 2,
      ty: (h - grafo.alto * k) / 2,
    };
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
      activo: true, x0: e.clientX, y0: e.clientY, tx0: v.tx, ty0: v.ty, movido: 0,
      nodo: (e.target as HTMLElement).closest('[data-nodo]')?.getAttribute('data-nodo') ?? null,
    };
    try { caja.current?.setPointerCapture(e.pointerId); } catch { /* el gesto sigue sin captura */ }
  }

  function onPointerMove(e: React.PointerEvent) {
    const g = gesto.current;
    if (!g?.activo) return;
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
    if (g.movido <= ARRASTRE2) {
      setSel((prev) => (g.nodo && prev === g.nodo ? null : g.nodo));
    }
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
    if (!sel || !caja.current) return;
    const n = grafo.nodos.find((x) => x.id === sel);
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
  }, [sel]);

  const nodoSel = grafo.nodos.find((n) => n.id === sel) ?? null;
  const pasoSel = nodoSel?.orden != null ? pasos.find((p) => p.orden === nodoSel.orden) ?? null : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      {/* La barra: lo que no es el lienzo va afuera del lienzo, o el pan se lo lleva. */}
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--faint)', marginRight: 'auto' }}>
          Toca un paso para editarlo.
        </span>
        <BotonChico onClick={() => { const v = vista.current; const k = Math.max(K_MIN, v.k / 1.2); vista.current = { ...v, k }; setZoomTxt(Math.round(k * 100)); pintar(); }} rotulo="Alejar">−</BotonChico>
        <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--dim)', minWidth: 38, textAlign: 'center' }}>{zoomTxt}%</span>
        <BotonChico onClick={() => { const v = vista.current; const k = Math.min(K_MAX, v.k * 1.2); vista.current = { ...v, k }; setZoomTxt(Math.round(k * 100)); pintar(); }} rotulo="Acercar">＋</BotonChico>
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
          position: 'relative', flex: 1, minHeight: 'min(54svh, 460px)', overflow: 'hidden',
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
              {(['normal', 'buena', 'mala', 'condicional'] as const).map((t) => (
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

          {grafo.nodos.map((n) => (
            <TarjetaNodo
              key={n.id} nodo={n} activo={sel === n.id}
              paso={n.orden != null ? pasos.find((p) => p.orden === n.orden) ?? null : null}
              audios={audios} negocio={negocio}
            />
          ))}
        </div>

        {/* ＋ MENSAJE: fuera de la capa transformada, o se achica con el zoom. */}
        {rolAdmin && (
          <button
            data-no-pan onClick={onAgregarPaso} disabled={busy}
            style={{
              position: 'absolute', right: 12, bottom: 12, padding: '9px 14px', borderRadius: 10,
              border: '1px dashed var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)',
              fontFamily: SANS, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
            }}
          >＋ Mensaje</button>
        )}

        {/* EL EDITOR. Va acá adentro y en coordenadas de PANTALLA: si viviera en la
            capa transformada, el zoom le cambiaría el tamaño a los inputs. */}
        {nodoSel && (
          <div
            data-no-pan
            style={{
              position: 'absolute', left: PANEL_MARGEN, bottom: PANEL_MARGEN, width: PANEL_ANCHO, maxHeight: 'calc(100% - 24px)',
              overflowY: 'auto', padding: 14, borderRadius: 14,
              background: 'var(--surface)', border: '1px solid var(--border-strong)',
              boxShadow: '0 12px 32px rgba(0,0,0,.14)', cursor: 'default',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 15 }}>{nodoSel.icono}</span>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', flex: 1, minWidth: 0 }}>{nodoSel.titulo}</div>
              <button onClick={() => setSel(null)} aria-label="Cerrar el editor"
                style={{ background: 'none', border: 'none', color: 'var(--faint)', fontSize: 15, cursor: 'pointer', padding: 0 }}>✕</button>
            </div>
            <EditorDeNodo
              nodo={nodoSel} paso={pasoSel} estrategia={estrategia} secuencias={secuencias}
              audios={audios} rolAdmin={rolAdmin} busy={busy}
              onEditarPaso={onEditarPaso} onQuitarPaso={(o) => { onQuitarPaso(o); setSel(null); }}
              onAudio={onAudio} onAudioNuevo={onAudioNuevo} onError={onError}
              onEditarVariante={onEditarVariante} onQuitarVariante={onQuitarVariante}
              onModo={onModo} onDesenlace={onDesenlace} onAntiguedad={onAntiguedad}
              onAbrirSecuencia={onAbrirSecuencia}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function BotonChico({ children, onClick, rotulo }: { children: ReactNode; onClick: () => void; rotulo: string }) {
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

// ── El nodo ─────────────────────────────────────────────────────────────────

function TarjetaNodo({ nodo, activo, paso, audios, negocio }: {
  nodo: NodoFlujo; activo: boolean; paso: PasoSecuenciaDto | null;
  audios: AudioSetting[]; negocio: string;
}) {
  const roto = nodo.tipo === 'ir-a' && nodo.destinoExiste === false;
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: nodo.tipo === 'mensaje' ? 8 : 5 }}>
        <span style={{ fontSize: 13 }}>{nodo.icono}</span>
        <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--dim)' }}>
          {nodo.titulo}
        </span>
        {nodo.tipo === 'mensaje' && paso?.requiere && !CONDICIONES_VIVAS.has(paso.requiere) && (
          <span title="El motor todavía no filtra por esta condición: el mensaje sale igual."
            style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--warn)' }}>⚠</span>
        )}
      </div>

      {nodo.tipo === 'mensaje' && paso
        ? <VistaMensaje paso={paso} audios={audios} negocio={negocio} />
        : <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.45 }}>{nodo.detalle}</div>}
    </div>
  );
}

/** El mensaje COMO LLEGA. Es la pieza que hace que esto sea un editor y no un
 *  diagrama: la misma burbuja que el resto del producto (`BURBUJA_SALIENTE`), no
 *  una tarjeta con el texto recortado. */
function VistaMensaje({ paso, audios, negocio }: { paso: PasoSecuenciaDto; audios: AudioSetting[]; negocio: string }) {
  if (paso.tipo === 'audio') {
    const a = audios.find((x) => x.id === paso.audio_id);
    return (
      <div style={{ ...BURBUJA_SALIENTE, padding: '9px 11px', fontSize: 12.5, maxWidth: '100%', minWidth: 0, overflow: 'hidden' }}>
        {a?.url
          ? <AudioPlay src={a.url} style={{ maxWidth: '100%' }} />
          : <span style={{ color: 'var(--faint)' }}>Sin audio elegido</span>}
        {a?.titulo && <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 5 }}>{a.titulo}{a.duracion_s ? ` · ${Math.round(a.duracion_s)}s` : ''}</div>}
      </div>
    );
  }
  const texto = (paso.cuerpo || '').replace(/\{\{\s*negocio\s*\}\}/g, negocio);
  return (
    <>
      {paso.canal === 'email' && paso.asunto && (
        <div style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 5 }}>Asunto: {paso.asunto}</div>
      )}
      <div style={{ ...BURBUJA_SALIENTE, padding: '9px 11px', fontSize: 12.5, whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
        {texto.trim() || <span style={{ color: 'var(--faint)' }}>Sin escribir</span>}
      </div>
    </>
  );
}

// ── El editor del nodo tocado ───────────────────────────────────────────────

function EditorDeNodo({
  nodo, paso, estrategia, secuencias, audios, rolAdmin, busy,
  onEditarPaso, onQuitarPaso, onAudio, onAudioNuevo, onError, onEditarVariante, onQuitarVariante,
  onModo, onDesenlace, onAntiguedad, onAbrirSecuencia,
}: {
  nodo: NodoFlujo; paso: PasoSecuenciaDto | null; estrategia: EstrategiaParaGrafo;
  secuencias: ReadonlyArray<{ clave: string; nombre: string }>;
  audios: AudioSetting[]; rolAdmin: boolean; busy: boolean;
  onEditarPaso: (orden: number, campo: 'cuerpo' | 'asunto' | 'delay_horas', val: string | number) => void;
  onQuitarPaso: (orden: number) => void;
  onAudio: (orden: number, audioId: number | null) => void;
  onAudioNuevo: (a: AudioSetting) => void;
  onError: (m: string) => void;
  onEditarVariante: (orden: number, i: number, val: string) => void;
  onQuitarVariante: (orden: number, i: number) => void;
  onModo: (m: ModoRespuesta) => void;
  onDesenlace: (d: Desenlace) => void;
  onAntiguedad: (h: number | null) => void;
  onAbrirSecuencia: (clave: string) => void;
}) {
  const des = (estrategia?.desenlace ?? {}) as Partial<Desenlace>;
  const cambiarDes = (p: Partial<Desenlace>) => onDesenlace({
    logrado: (des.logrado ?? 'respondio') as Desenlace['logrado'],
    logradoEtapa: des.logradoEtapa ?? null,
    logradoSecuencia: des.logradoSecuencia ?? null,
    falloHoras: des.falloHoras ?? 0,
    falloEtapa: des.falloEtapa ?? null,
    falloSecuencia: des.falloSecuencia ?? null,
    ...p,
  });
  const opcionesSecuencia = [{ value: '', label: 'Ninguna: termina aquí' },
    ...secuencias.map((s) => ({ value: s.clave, label: s.nombre }))];

  // ⚠️ UN SETTER NO EDITA, PERO TIENE QUE PODER LEER. Con `nodo.detalle` a secas,
  // abrir un nodo de MENSAJE le mostraba una caja vacía: los nodos de mensaje no
  // tienen `detalle` —su contenido es el mensaje— así que el panel salía en blanco
  // justo en los nodos que más se abren.
  if (!rolAdmin) {
    return nodo.tipo === 'mensaje' && paso
      ? <div style={{ fontSize: 12.5, color: 'var(--ink)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{paso.cuerpo || 'Sin escribir'}</div>
      : <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>{nodo.detalle}</div>;
  }

  if (nodo.tipo === 'entrada') {
    const h = estrategia?.antiguedad_max_horas ?? null;
    return (
      <>
        <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5, marginBottom: 12 }}>{nodo.detalle}</div>
        <label style={rotulo}>Solo a leads recientes</label>
        <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
          <input
            type="number" min={1} step={1} value={h ?? ''} placeholder="sin límite" disabled={busy}
            onChange={(e) => onAntiguedad(e.target.value.trim() === '' ? null : Math.max(1, Number(e.target.value)))}
            style={{ ...inp, width: 96 }}
          />
          <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>horas</span>
        </div>
        <p style={{ fontSize: 11, color: 'var(--faint)', lineHeight: 1.45, marginTop: 7, marginBottom: 0 }}>
          Vacío: le escribe a cualquiera que esté en la etapa.
        </p>
      </>
    );
  }

  if (nodo.tipo === 'mensaje' && paso) {
    return (
      <>
        {paso.tipo === 'audio' ? (
          <PasoAudioControl
            orden={paso.orden} audios={audios} audioId={paso.audio_id ?? null} disabled={busy}
            onElegir={(id) => onAudio(paso.orden, id)} onGrabado={onAudioNuevo} onError={onError}
          />
        ) : (
          <>
            {paso.canal === 'email' && (
              <>
                <label style={rotulo}>Asunto</label>
                <input value={paso.asunto ?? ''} disabled={busy}
                  onChange={(e) => onEditarPaso(paso.orden, 'asunto', e.target.value)}
                  style={{ ...inp, marginBottom: 10 }} />
              </>
            )}
            <label style={rotulo}>El mensaje</label>
            {/* Un textarea y no el `Autocrece` de la burbuja: aquél crece hasta el
                alto del texto —correcto DENTRO de una burbuja, donde una barra de
                scroll es un cuerpo extraño— y acá el editor tiene alto propio. */}
            <textarea value={paso.cuerpo} disabled={busy} rows={5}
              onChange={(e) => onEditarPaso(paso.orden, 'cuerpo', e.target.value)}
              style={{ ...inp, minHeight: 92, lineHeight: 1.5, resize: 'vertical' }} />
          </>
        )}

        <div style={{ marginTop: 10 }}>
          <label style={rotulo}>Cuándo sale</label>
          <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
            <input type="number" min={0} step={1} value={paso.delay_horas} disabled={busy}
              onChange={(e) => onEditarPaso(paso.orden, 'delay_horas', Math.max(0, Number(e.target.value)))}
              style={{ ...inp, width: 90 }} />
            <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>
              {paso.ancla === 'reunion' ? 'horas antes de la reunión' : 'horas después'}
            </span>
          </div>
        </div>

        {paso.requiere && (
          <p style={{ fontSize: 11, color: CONDICIONES_VIVAS.has(paso.requiere) ? 'var(--faint)' : 'var(--warn)', lineHeight: 1.45, marginTop: 9, marginBottom: 0 }}>
            {CONDICIONES_VIVAS.has(paso.requiere)
              ? `Sale ${CONDICION_TXT[paso.requiere]}.`
              : 'Dice «solo si no contestó», pero hoy sale siempre: el motor todavía no mira esa condición.'}
          </p>
        )}

        {paso.tipo !== 'audio' && (
          <div style={{ marginTop: 12 }}>
            <label style={rotulo}>Otras formas de decirlo</label>
            {(paso.variantes ?? []).length === 0 ? (
              <p style={{ fontSize: 11.5, color: 'var(--faint)', margin: 0, lineHeight: 1.45 }}>
                Sale siempre igual. Mandar el mismo texto a cientos de personas es lo que WhatsApp busca para restringir un número.
              </p>
            ) : (paso.variantes ?? []).map((v, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 6 }}>
                <textarea value={v} rows={2} disabled={busy}
                  onChange={(e) => onEditarVariante(paso.orden, i, e.target.value)}
                  style={{ ...inp, resize: 'vertical', lineHeight: 1.45, flex: 1 }} />
                <button onClick={() => onQuitarVariante(paso.orden, i)} title="Quitar variante"
                  style={{ background: 'none', border: 'none', color: 'var(--faint)', cursor: 'pointer', fontSize: 13, padding: '5px 2px' }}>✕</button>
              </div>
            ))}
          </div>
        )}

        <button onClick={() => onQuitarPaso(paso.orden)} disabled={busy}
          style={{ marginTop: 12, background: 'none', border: 'none', color: 'var(--bad)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: SANS }}>
          Quitar este mensaje
        </button>
      </>
    );
  }

  if (nodo.tipo === 'respuesta') {
    const modo = (estrategia?.modo ?? 'asistido') as ModoRespuesta;
    return (
      <>
        <label style={rotulo}>Si el lead contesta</label>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {([['asistido', 'MaKo deja el borrador'], ['automatico', 'Se frena y sigues tú']] as const).map(([v, t]) => (
            <button key={v} onClick={() => onModo(v)} disabled={busy} aria-pressed={modo === v}
              style={{
                padding: '6px 11px', borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: SANS,
                border: `1px solid ${modo === v ? 'var(--primary)' : 'var(--border-strong)'}`,
                background: modo === v ? 'var(--primary-bg)' : 'var(--surface)',
                color: modo === v ? 'var(--primary)' : 'var(--dim)',
              }}>{modo === v ? '✓ ' : ''}{t}</button>
          ))}
        </div>
      </>
    );
  }

  if (nodo.tipo === 'desenlace') {
    return (
      <>
        <label style={rotulo}>Termina bien cuando</label>
        <Dropdown
          value={String(des.logrado ?? 'respondio')}
          options={[
            { value: 'respondio', label: 'El lead contesta' },
            { value: 'agendo', label: 'El lead agenda' },
            { value: 'pago', label: 'El lead paga' },
            { value: 'ninguno', label: 'No cierra sola' },
          ]}
          onChange={(v) => cambiarDes({ logrado: v as Desenlace['logrado'] })}
          width="100%" ariaLabel="Qué cuenta como objetivo cumplido"
        />
        <div style={{ marginTop: 10 }}>
          <label style={rotulo}>Se da por perdida a las</label>
          <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
            <input type="number" min={0} step={1} value={des.falloHoras ?? 0} disabled={busy}
              onChange={(e) => cambiarDes({ falloHoras: Math.max(0, Number(e.target.value)) })}
              style={{ ...inp, width: 90 }} />
            <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>horas sin respuesta</span>
          </div>
          <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 5, marginBottom: 0 }}>0: no se pierde nunca.</p>
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={rotulo}>✅ Si lo logra, sigue con</label>
          <Dropdown value={des.logradoSecuencia ?? ''} options={opcionesSecuencia}
            onChange={(v) => cambiarDes({ logradoSecuencia: v || null })} width="100%" ariaLabel="Secuencia que sigue si se logra" />
        </div>
        <div style={{ marginTop: 10 }}>
          <label style={rotulo}>🏁 Si se pierde, sigue con</label>
          <Dropdown value={des.falloSecuencia ?? ''} options={opcionesSecuencia}
            onChange={(v) => cambiarDes({ falloSecuencia: v || null })} width="100%" ariaLabel="Secuencia que sigue si se pierde" />
        </div>
      </>
    );
  }

  if (nodo.tipo === 'ir-a' && nodo.claveDestino) {
    return (
      <>
        <div style={{ fontSize: 12.5, color: nodo.destinoExiste ? 'var(--ink)' : 'var(--bad)', lineHeight: 1.5, marginBottom: 10 }}>
          {nodo.destinoExiste
            ? nodo.detalle
            : 'Apunta a una secuencia que ya no existe: el lead se queda sin nada después.'}
        </div>
        {nodo.destinoExiste && (
          <button onClick={() => onAbrirSecuencia(nodo.claveDestino!)}
            style={{ padding: '8px 13px', borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>
            Abrir esta secuencia
          </button>
        )}
      </>
    );
  }

  return <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>{nodo.detalle}</div>;
}
