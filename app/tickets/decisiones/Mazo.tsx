'use client';

// =============================================================================
// La Ticketera: las decisiones de a una, para deslizar (/tickets/decisiones, compu y teléfono)
// =============================================================================
// Derecha = manda la respuesta marcada · izquierda = después (no contesta) · «Resuelta» la saca
// sin elegir · en el medio se marca la respuesta · «Ver detalle» abre el porqué, qué destraba y
// el link. Lo que decide vive en ./reglas.ts (puro, con test); acá el gesto y el dibujo.
//
// Lo dibujan DOS páginas —app/tickets/decisiones (compu) y app/m/tickets/decisiones (teléfono,
// misma URL)— y contesta con la MISMA acción que la lista: no hay un segundo almacén.
//
// ⚠️ EL GESTO NO SE ESCRIBE A MANO (Martín, 14/10/2026: el primero «funciona bastante mal», «que
// no lo inventes… copiá esa funcionalidad»). Lo hace `motion` (Framer Motion, ya en el repo): sigue
// al dedo, mide la velocidad, bloquea la dirección para no pelear con el scroll vertical
// (`dragDirectionLock`, y `touch-action: pan-y`), y vuelve con rebote cuando no alcanzó
// (`dragConstraints` en 0 con `dragElastic` 1: la tarjeta sigue al dedo entero y al soltar la
// devuelve el resorte). Encima va la receta conocida del mazo tipo Tinder: la rotación sale de la
// posición (`useTransform`), los sellos también, y al soltar decide distancia O velocidad
// (`veredictoGesto`). Se descartó react-tinder-card: hace `preventDefault` en `touchstart`, que
// mata el scroll de una tarjeta larga y los toques en las opciones.
//
// Lo que cuida, además:
//   · El arrastre arranca a mano (`useDragControls`) para no tomarlo sobre un campo de texto o un
//     link, ni en los bordes de la pantalla (ahí vive el «volver» del sistema).
//   · El click que sigue a un arrastre se come: si no, soltar encima de una opción la marcaba.
//   · Cada gesto tiene su botón (✕ / Resuelta / ✓) y su tecla (← / →): un gesto sin control visible
//     es una función que sólo encuentra el que ya la conoce.

import { useCallback, useEffect, useRef, useState, type MouseEventHandler, type RefObject } from 'react';
import {
  animate, motion, useDragControls, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform,
  type MotionValue, type PanInfo,
} from 'motion/react';
import Link from '@/app/_ui/Link';
import {
  OTRA, RESUELTA, esHrefExterno, esHrefInterno,
  type AccionResponder, type Decision, type LecturaDecisiones,
} from '@/app/admin/runway/decisiones';
import { alFrente, colaInicial, marcadaInicial, porDecidir, puedeMandar, rotuloMandar, sinLa, veredictoGesto, TICKETERA_LISTA } from './reglas';
import { CambioVista } from './CambioVista';

const URGENCIA_CORTA: Record<Decision['urgencia'], string> = {
  bloquea: 'Frena un chat',
  cuesta: 'Cuesta dinero',
  criterio: 'Criterio',
  aviso: 'Para saber',
};

type Salida = 'derecha' | 'izquierda' | 'arriba';
type Manejo = { volar: (s: Salida, velocidad?: number) => Promise<void> };
type Toast = { texto: string; error?: boolean; volver?: Decision };

type PropsMazo = {
  responder: AccionResponder;
};

/** Lo que montan las dos páginas: el mazo, o por qué no se pudo leer (sin hooks: decide y delega). */
export function MazoDecisiones({ lectura, ...p }: PropsMazo & { lectura: LecturaDecisiones }) {
  if (!lectura.ok) {
    return (
      <p className="mazo-falla" role="alert">
        {lectura.faltaTabla ? 'Falta crear la tabla de decisiones (migración 0277).' : 'No se pudieron leer las decisiones. Prueba de nuevo en un rato.'}
      </p>
    );
  }
  return <Mazo decisiones={lectura.decisiones} {...p} />;
}

function Mazo({ decisiones, responder }: PropsMazo & { decisiones: Decision[] }) {
  // El mazo se arma UNA vez con lo que mandó el server: después de cada respuesta la página se
  // revalida y llegan props nuevas, y rearmar la cola ahí haría volver a una «después».
  const [cola, setCola] = useState<Decision[]>(() => colaInicial(decisiones));
  const [luego, setLuego] = useState<Decision[]>([]);
  const [total] = useState(() => colaInicial(decisiones).length);
  const [hechas, setHechas] = useState(0);
  const [marcadas, setMarcadas] = useState<Record<number, string | null>>({});
  const [textos, setTextos] = useState<Record<number, string>>({});
  const [toast, setToast] = useState<Toast | null>(null);
  const [pista, setPista] = useState<string | null>(null);

  const actual = cola[0] ?? null;
  const siguiente = cola[1] ?? null;
  const marcadaDe = (d: Decision) => (d.id in marcadas ? marcadas[d.id] : marcadaInicial(d));
  const marcada = actual ? marcadaDe(actual) : null;
  const texto = actual ? textos[actual.id] ?? (actual.respuesta === OTRA ? actual.respuestaTexto ?? '' : '') : '';
  const sePuede = actual ? puedeMandar(actual, marcada, texto) : false;

  // Cuánto se fue la de adelante (0 a 1): con eso crece la de atrás, sin un render por píxel.
  const progreso = useMotionValue(0);
  const manejo = useRef<Manejo | null>(null);
  const ocupado = useRef(false);

  useEffect(() => { ocupado.current = false; setPista(null); }, [actual?.id]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), toast.error ? 6000 : 4500);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!pista) return;
    const t = window.setTimeout(() => setPista(null), 2200);
    return () => window.clearTimeout(t);
  }, [pista]);

  /** La única salida de una tarjeta, venga del gesto, de un botón o de una tecla. */
  const decidir = useCallback((s: Salida, velocidad = 0): boolean => {
    if (!actual || ocupado.current) return false;
    if (s === 'derecha' && (!sePuede || !marcada)) {
      setPista(marcada === OTRA ? 'Escribe tu respuesta' : 'Elige una opción');
      return false; // el gesto vuelve solo, con el resorte de la librería
    }
    ocupado.current = true;
    const d = actual;
    const clave = s === 'derecha' ? marcada! : s === 'arriba' ? RESUELTA : null;
    const txt = clave === OTRA ? texto : '';
    try { navigator.vibrate?.(8); } catch { /* sin vibración */ }
    // El pedido sale YA y la tarjeta se va mientras tanto. Lo que dice el server se aplica DESPUÉS
    // de que terminó de irse: un rechazo rápido que la devolviera al frente quedaba pisado por la
    // salida, y la tarjeta desaparecía sin estar contestada.
    let pedido: Promise<{ error: string | null; ok: boolean }> | null = null;
    if (clave) {
      const fd = new FormData();
      fd.set('id', String(d.id));
      fd.set('clave', clave);
      fd.set('texto', txt);
      pedido = responder({ error: null, ok: false }, fd).catch(() => ({ error: 'No se pudo guardar', ok: false }));
    }
    const salida = (manejo.current?.volar(s, velocidad) ?? Promise.resolve()).then(() => {
      setCola((c) => sinLa(c, d.id));
      if (clave) setHechas((n) => n + 1);
      else setLuego((l) => [...sinLa(l, d.id), d]);
    });
    if (pedido) {
      void Promise.all([pedido, salida]).then(([r]) => {
        if (r.ok) {
          const dicho = clave === RESUELTA ? 'Resuelta' : `Respondida · ${clave === OTRA ? 'escrita' : clave}`;
          setToast({ texto: dicho, volver: { ...d, respuesta: clave, respuestaTexto: txt || null } });
          return;
        }
        setCola((c) => alFrente(c, d));
        setHechas((n) => Math.max(0, n - 1));
        setToast({ texto: r.error ?? 'No se pudo guardar', error: true });
      });
    }
    return true;
  }, [actual, sePuede, marcada, texto, responder]);

  /** «Cambiar»: la que se acaba de contestar vuelve al frente con su respuesta marcada. */
  const cambiar = (d: Decision) => {
    setToast(null);
    setMarcadas((m) => { const n = { ...m }; delete n[d.id]; return n; });
    setTextos((t) => { const n = { ...t }; delete n[d.id]; return n; });
    setCola((c) => alFrente(c, d));
    setHechas((n) => Math.max(0, n - 1));
  };

  const marcar = (clave: string) => {
    if (!actual) return;
    setMarcadas((m) => ({ ...m, [actual.id]: clave }));
    setPista(null);
  };

  // Las teclas, en la compu: ← después · → mandar · 1-4 marcar. No mientras se escribe.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.metaKey || e.ctrlKey || e.altKey || !actual) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); decidir('derecha'); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); decidir('izquierda'); }
      else if (/^[1-4]$/.test(e.key)) {
        const o = actual.opciones[Number(e.key) - 1];
        if (o) { e.preventDefault(); setMarcadas((m) => ({ ...m, [actual.id]: o.clave })); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actual, decidir]);

  const progresoHecho = total ? Math.min(1, hechas / total) : 1;
  const quedan = porDecidir(cola);

  return (
    <section className="mazo" aria-label="Ticketera">
      {/* Arriba, el progreso y el cambio de vista; y en su lugar, lo que acaba de pasar. «Cambiar»
          se usa poco: puede vivir lejos del pulgar, y así el aviso no tapa las opciones. */}
      <div className="mazo-arriba" aria-live="polite">
        {pista || toast ? (
          <div className={`mazo-toast${pista ? ' mazo-toast--pista' : toast?.error ? ' mazo-toast--error' : ''}`}
            role={toast?.error && !pista ? 'alert' : 'status'}>
            <span>{pista ?? toast?.texto}</span>
            {!pista && toast?.volver && (
              <button type="button" onClick={() => cambiar(toast.volver!)}>Cambiar</button>
            )}
          </div>
        ) : (
          <div className="mazo-estado">
            <div className="mazo-estado-txt">
              {total > 0 && <div className="mazo-barra" aria-hidden><span style={{ transform: `scaleX(${progresoHecho})` }} /></div>}
              <p className="mazo-cuenta">
                {quedan ? <><b>{quedan}</b> por decidir</> : cola.length ? 'Para saber' : hechas ? <><b>{hechas}</b> listas</> : null}
              </p>
            </div>
            <CambioVista actual="tarjetas" />
          </div>
        )}
      </div>

      <div className="mazo-pila">
        {siguiente && <CartaAtras key={`atras-${siguiente.id}`} d={siguiente} marcada={marcadaDe(siguiente)} progreso={progreso} />}
        {actual ? (
          <CartaArriba
            key={actual.id}
            d={actual}
            marcada={marcada}
            texto={texto}
            sePuede={sePuede}
            progreso={progreso}
            manejo={manejo}
            onDecidir={decidir}
            onMarcar={marcar}
            onTexto={(v) => setTextos((t) => ({ ...t, [actual.id]: v }))}
          />
        ) : (
          <Vacio luego={luego.length} hechas={hechas} onDeNuevo={() => { setCola(luego); setLuego([]); }} />
        )}
      </div>

      {actual && (
        <div className="mazo-acciones">
          <button type="button" className="mazo-btn mazo-btn--no" onClick={() => decidir('izquierda')} aria-label="Después: la dejo para más tarde (←)">
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
            <span>Después</span>
          </button>
          <button type="button" className="mazo-btn mazo-btn--resuelta" onClick={() => decidir('arriba')} aria-label="Resuelta: sale sin elegir una opción">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden><circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2" fill="none" /><path d="M8.3 12.3l2.5 2.5 4.9-5.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
            <span>Resuelta</span>
          </button>
          <button type="button" className="mazo-btn mazo-btn--si" onClick={() => decidir('derecha')} aria-disabled={!sePuede}
            aria-label={`${rotuloMandar(actual, marcada)} (→)`}>
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
            <span>{rotuloMandar(actual, marcada)}</span>
          </button>
        </div>
      )}
    </section>
  );
}

// =============================================================================
// La tarjeta de adelante: la que se arrastra
// =============================================================================
function CartaArriba(p: {
  d: Decision;
  marcada: string | null;
  texto: string;
  sePuede: boolean;
  progreso: MotionValue<number>;
  manejo: RefObject<Manejo | null>;
  onDecidir: (s: Salida, velocidad?: number) => boolean;
  onMarcar: (clave: string) => void;
  onTexto: (v: string) => void;
}) {
  const { d, progreso } = p;
  const ref = useRef<HTMLElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const opacidad = useMotionValue(1);
  // La receta del mazo: la inclinación y los sellos salen de la posición, no de un estado.
  const rotate = useTransform(x, [-320, 0, 320], [-16, 0, 16]);
  const selloSi = useTransform(x, [24, 110], [0, 1]);
  const selloNo = useTransform(x, [-110, -24], [1, 0]);
  const controles = useDragControls();
  const reducido = useReducedMotion();
  const saliendo = useRef(false);
  const arrastro = useRef(false);
  const [detalle, setDetalle] = useState(false);

  useEffect(() => { progreso.set(0); }, [progreso]);
  useMotionValueEvent(x, 'change', (v) => { if (!saliendo.current) progreso.set(Math.min(1, Math.abs(v) / 160)); });

  // La salida animada, con la velocidad del dedo si viene de un gesto (sigue el movimiento).
  useEffect(() => {
    p.manejo.current = {
      volar: (s, velocidad = 0) => new Promise<void>((listo) => {
        saliendo.current = true;
        progreso.set(1);
        if (reducido) { listo(); return; }
        const ancho = typeof window === 'undefined' ? 800 : window.innerWidth;
        if (s === 'arriba') {
          animate(y, -(typeof window === 'undefined' ? 900 : window.innerHeight), { duration: 0.32, ease: [0.4, 0, 0.6, 1] });
          animate(opacidad, 0, { duration: 0.3, onComplete: () => listo() });
          return;
        }
        const lado = s === 'derecha' ? 1 : -1;
        const destino = lado * (ancho + 240);
        const restante = Math.abs(destino - x.get());
        const rapidez = Math.max(1600, Math.abs(velocidad));
        animate(x, destino, {
          duration: Math.min(0.38, Math.max(0.18, restante / rapidez)),
          ease: [0.2, 0.6, 0.4, 1],
          onComplete: () => listo(),
        });
      }),
    };
  });

  const alSoltar = (_: unknown, info: PanInfo) => {
    const ancho = ref.current?.offsetWidth ?? 360;
    const v = veredictoGesto({ dx: info.offset.x, vx: info.velocity.x, ancho });
    if (v) p.onDecidir(v, info.velocity.x);
    // Si no cuenta (o no se puede mandar), la devuelve el resorte de dragConstraints/dragElastic.
  };

  const comerClick: MouseEventHandler<HTMLElement> = (e) => {
    if (!arrastro.current) return;
    arrastro.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <motion.article
      ref={ref}
      className={`mazo-carta mazo-carta--${d.urgencia}`}
      style={{ x, y, rotate, opacity: opacidad, touchAction: 'pan-y' }}
      drag="x"
      dragControls={controles}
      dragListener={false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={1}
      dragDirectionLock
      dragTransition={{ bounceStiffness: 520, bounceDamping: 26 }}
      onPointerDown={(e) => {
        arrastro.current = false;
        if (saliendo.current) return;
        const t = e.target as HTMLElement;
        if (t.closest('textarea, input, a, select')) return;
        // Los bordes son del sistema (volver atrás en iOS y Android).
        if (e.pointerType === 'touch' && (e.clientX < 24 || e.clientX > window.innerWidth - 24)) return;
        controles.start(e);
      }}
      onDragStart={() => { arrastro.current = true; }}
      onDragEnd={alSoltar}
      onClickCapture={comerClick}
    >
      <motion.span className={`mazo-sello mazo-sello--si${p.sePuede ? '' : ' mazo-sello--apagado'}`} style={{ opacity: selloSi }} aria-hidden>
        {rotuloMandar(d, p.marcada)}
      </motion.span>
      <motion.span className="mazo-sello mazo-sello--no" style={{ opacity: selloNo }} aria-hidden>Después</motion.span>
      <CuerpoCarta d={d} marcada={p.marcada} texto={p.texto} detalle={detalle}
        onDetalle={() => setDetalle((v) => !v)} onMarcar={p.onMarcar} onTexto={p.onTexto} />
    </motion.article>
  );
}

// La de atrás: asoma, y crece a medida que la de adelante se va.
function CartaAtras({ d, marcada, progreso }: { d: Decision; marcada: string | null; progreso: MotionValue<number> }) {
  const scale = useTransform(progreso, [0, 1], [0.94, 1]);
  const y = useTransform(progreso, [0, 1], [14, 0]);
  return (
    <motion.article className={`mazo-carta mazo-carta--${d.urgencia} mazo-carta--atras`} style={{ scale, y }} aria-hidden inert>
      <CuerpoCarta d={d} marcada={marcada} atras />
    </motion.article>
  );
}

function CuerpoCarta(p: {
  d: Decision;
  marcada: string | null;
  atras?: boolean;
  texto?: string;
  detalle?: boolean;
  onDetalle?: () => void;
  onMarcar?: (clave: string) => void;
  onTexto?: (v: string) => void;
}) {
  const { d, marcada, atras } = p;
  const tieneDetalle = !!(d.contexto || d.destraba || d.href);
  return (
    <div className="mazo-cuerpo">
      <div className="mazo-cabeza">
        <span className="mazo-chat">{d.chat}</span>
        <span className="mazo-urgencia">{URGENCIA_CORTA[d.urgencia]}</span>
      </div>
      <h2 className="mazo-pregunta">{d.pregunta}</h2>

      {tieneDetalle && !atras && (
        <div className="mazo-detalle">
          <button type="button" className="mazo-detalle-btn" aria-expanded={!!p.detalle} onClick={p.onDetalle}>
            {p.detalle ? 'Ocultar detalle' : 'Ver detalle'}
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          {p.detalle && (
            <div className="mazo-detalle-cuerpo">
              {d.contexto && <p>{d.contexto}</p>}
              {d.destraba && <p className="mazo-destraba"><b>Destraba</b>{d.destraba}</p>}
              {d.href && esHrefInterno(d.href) && <Link href={d.href} className="mazo-link">Mirarlo antes →</Link>}
              {d.href && esHrefExterno(d.href) && (
                <a href={d.href} target="_blank" rel="noopener noreferrer" className="mazo-link">Ver el prototipo ↗</a>
              )}
            </div>
          )}
        </div>
      )}

      {/* En el medio se carga la respuesta: tocar MARCA, deslizar (o ✓) MANDA. */}
      {d.opciones.length > 0 && (
        <div className="mazo-opciones" role="radiogroup" aria-label="Tu respuesta">
          {d.opciones.map((o) => {
            const si = marcada === o.clave;
            return (
              <button key={o.clave} type="button" role="radio" aria-checked={si}
                className={`mazo-opcion${si ? ' mazo-opcion--marcada' : ''}`}
                onClick={() => p.onMarcar?.(o.clave)}>
                <b>{o.clave}</b>
                <span>
                  {d.recomendada === o.clave && <em>Recomendada</em>}
                  {o.texto}
                </span>
              </button>
            );
          })}
          {!atras && (
            <button type="button" role="radio" aria-checked={marcada === OTRA}
              className={`mazo-opcion mazo-opcion--otra${marcada === OTRA ? ' mazo-opcion--marcada' : ''}`}
              onClick={() => p.onMarcar?.(OTRA)}>
              <b>+</b><span>Otra respuesta</span>
            </button>
          )}
        </div>
      )}
      {!atras && marcada === OTRA && (
        <textarea
          className={`mazo-texto${d.opciones.length ? '' : ' mazo-texto--solo'}`}
          rows={3}
          maxLength={1000}
          placeholder={d.opciones.length ? 'Escribe lo que quieras' : 'Tu respuesta'}
          aria-label="Tu respuesta"
          value={p.texto ?? ''}
          onChange={(e) => p.onTexto?.(e.target.value)}
        />
      )}
    </div>
  );
}

// =============================================================================
// Cuando no queda ninguna
// =============================================================================
function Vacio({ luego, hechas, onDeNuevo }: { luego: number; hechas: number; onDeNuevo: () => void }) {
  return (
    <div className="mazo-vacio">
      <span className="mazo-vacio-ico" aria-hidden>
        <svg viewBox="0 0 24 24" width="34" height="34"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
      </span>
      {luego > 0 ? (
        <>
          <h2>{luego === 1 ? 'Dejaste 1 para después' : `Dejaste ${luego} para después`}</h2>
          <button type="button" className="mazo-vacio-btn" onClick={onDeNuevo}>Verlas de nuevo</button>
        </>
      ) : (
        <>
          <h2>{hechas ? 'Listo por hoy' : 'Nada por decidir'}</h2>
          <p>Lo nuevo aparece aquí.</p>
        </>
      )}
      <Link href={TICKETERA_LISTA} className="mazo-link">Ver la lista</Link>
    </div>
  );
}
