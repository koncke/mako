'use client';

// =============================================================================
// El mazo: las decisiones de a una, para deslizar (/tickets/decisiones, compu y teléfono)
// =============================================================================
// Derecha = manda la respuesta marcada · izquierda = después (no contesta) · en el medio se
// marca la respuesta · «Ver detalle» abre el porqué, qué destraba y el link. La lógica que
// decide vive en ./reglas.ts (pura, con test); acá sólo el gesto y el dibujo.
//
// Lo dibujan DOS páginas —app/tickets/decisiones (compu) y app/m/tickets/decisiones (el
// teléfono, misma URL)— y contesta con la MISMA acción que /admin/runway: no hay un segundo
// almacén ni una segunda regla.
//
// El gesto (y lo que ya mordió en esta casa, AGENTS.md → «el gesto de un lienzo»):
//   · Pointer events, no HTML5 drag-and-drop: acá no se transporta nada, se mueve un valor.
//   · El transform se escribe sobre un REF, nunca con setState: un render por `pointermove` son
//     sesenta por segundo.
//   · `touch-action: pan-y`: el scroll vertical de la tarjeta sigue siendo del navegador; el
//     arrastre arranca sólo si el dedo va más de costado que para arriba.
//   · No arranca en los bordes de la pantalla (el gesto de volver del sistema) ni sobre un campo
//     de texto o un link. Y el click que sigue a un arrastre se come: si no, soltar encima de una
//     opción la marcaba.
//   · Cada gesto tiene su botón (✕ / ✓) y su tecla (← / →): un gesto sin control visible es una
//     función que sólo encuentra el que ya la conoce.

import { useCallback, useEffect, useRef, useState, type MouseEventHandler, type PointerEvent as EventoPuntero, type PointerEventHandler, type Ref } from 'react';
import Link from '@/app/_ui/Link';
import { OTRA, esHrefExterno, esHrefInterno, type AccionResponder, type Decision, type LecturaDecisiones } from '@/app/admin/runway/decisiones';
import { alFrente, colaInicial, marcadaInicial, puedeMandar, rotuloMandar, sinLa, veredictoGesto } from './reglas';

const URGENCIA_CORTA: Record<Decision['urgencia'], string> = {
  bloquea: 'Frena un chat',
  cuesta: 'Cuesta dinero',
  criterio: 'Criterio',
  aviso: 'Para saber',
};

type Toast = { texto: string; error?: boolean; volver?: Decision };
type Gesto = { id: number; x0: number; y0: number; dx: number; t: number; vx: number; estado: 'posible' | 'arrastra' | 'nada' };

const reducido = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

type PropsMazo = {
  responder: AccionResponder;
  /** A dónde lleva «Ver el tablero» (la lista entera, con las contestadas). */
  tablero: string;
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

function Mazo({ decisiones, responder, tablero }: PropsMazo & { decisiones: Decision[] }) {
  // El mazo se arma UNA vez con lo que mandó el server: después de cada respuesta la página se
  // revalida y llegan props nuevas, y rearmar la cola ahí haría volver a una «después».
  const [cola, setCola] = useState<Decision[]>(() => colaInicial(decisiones));
  const [luego, setLuego] = useState<Decision[]>([]);
  const [total] = useState(() => colaInicial(decisiones).length);
  const [hechas, setHechas] = useState(0);
  const [marcadas, setMarcadas] = useState<Record<number, string | null>>({});
  const [textos, setTextos] = useState<Record<number, string>>({});
  const [detalle, setDetalle] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [pista, setPista] = useState<string | null>(null);

  const actual = cola[0] ?? null;
  const siguiente = cola[1] ?? null;
  const marcadaDe = (d: Decision) => (d.id in marcadas ? marcadas[d.id] : marcadaInicial(d));
  const marcada = actual ? marcadaDe(actual) : null;
  const texto = actual ? textos[actual.id] ?? (actual.respuesta === OTRA ? actual.respuestaTexto ?? '' : '') : '';
  const sePuede = actual ? puedeMandar(actual, marcada, texto) : false;

  const cartaRef = useRef<HTMLElement>(null);
  const pilaRef = useRef<HTMLDivElement>(null);
  const gesto = useRef<Gesto | null>(null);
  const arrastro = useRef(false);
  const ocupado = useRef(false);

  // Cada tarjeta nueva arranca derecha, cerrada y sin pista.
  useEffect(() => {
    const el = cartaRef.current;
    if (el) { el.style.transition = ''; el.style.transform = ''; el.style.opacity = ''; el.style.setProperty('--mazo-p', '0'); }
    pilaRef.current?.style.setProperty('--mazo-a', '0');
    setDetalle(false);
    setPista(null);
    ocupado.current = false;
  }, [actual?.id]);

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

  // ── Dibujar el arrastre (sobre el ref) ──────────────────────────────────
  const pintar = useCallback((dx: number) => {
    const el = cartaRef.current;
    if (!el) return;
    const w = el.offsetWidth || 360;
    const p = Math.max(-1, Math.min(1, dx / Math.max(96, w * 0.28)));
    el.style.transform = `translateX(${dx}px) rotate(${(dx / w) * 9}deg)`;
    el.style.setProperty('--mazo-p', p.toFixed(3));
    pilaRef.current?.style.setProperty('--mazo-a', Math.abs(p).toFixed(3));
  }, []);

  const devolver = useCallback(() => {
    const el = cartaRef.current;
    if (!el) return;
    el.style.transition = 'transform 220ms cubic-bezier(.2,.8,.3,1)';
    el.style.transform = '';
    el.style.setProperty('--mazo-p', '0');
    pilaRef.current?.style.setProperty('--mazo-a', '0');
    window.setTimeout(() => { if (cartaRef.current) cartaRef.current.style.transition = ''; }, 240);
  }, []);

  /** La tarjeta sale volando hacia un lado; `listo` corre cuando ya no se ve. */
  const volar = useCallback((lado: 'derecha' | 'izquierda', listo: () => void) => {
    const el = cartaRef.current;
    ocupado.current = true;
    if (!el || reducido()) { listo(); return; }
    const w = window.innerWidth;
    el.style.transition = 'transform 240ms cubic-bezier(.3,.7,.4,1), opacity 240ms ease-out';
    el.style.transform = `translateX(${lado === 'derecha' ? w : -w}px) rotate(${lado === 'derecha' ? 16 : -16}deg)`;
    el.style.opacity = '0';
    pilaRef.current?.style.setProperty('--mazo-a', '1');
    window.setTimeout(listo, 230);
  }, []);

  // ── Las dos salidas ─────────────────────────────────────────────────────
  const mandar = useCallback(() => {
    if (!actual || ocupado.current) return;
    if (!sePuede || !marcada) {
      devolver();
      setPista(marcada === OTRA ? 'Escribe tu respuesta' : 'Elige una opción');
      return;
    }
    const d = actual;
    const clave = marcada;
    const txt = clave === OTRA ? texto : '';
    try { navigator.vibrate?.(8); } catch { /* sin vibración */ }
    const fd = new FormData();
    fd.set('id', String(d.id));
    fd.set('clave', clave);
    fd.set('texto', txt);
    // El pedido sale YA y la tarjeta se va mientras tanto. Lo que dice el server se aplica DESPUÉS
    // de que terminó de irse: un rechazo rápido (antes de los 230 ms) que la devolviera al frente
    // quedaba pisado por la salida, y la tarjeta desaparecía sin estar contestada.
    const pedido = responder({ error: null, ok: false }, fd).catch(() => ({ error: 'No se pudo guardar', ok: false }));
    const salida = new Promise<void>((listo) => volar('derecha', () => {
      setCola((c) => sinLa(c, d.id));
      setHechas((n) => n + 1);
      listo();
    }));
    void Promise.all([pedido, salida]).then(([r]) => {
      if (r.ok) {
        setToast({ texto: `Respondida · ${clave === OTRA ? 'escrita' : clave}`, volver: { ...d, respuesta: clave, respuestaTexto: txt || null } });
        return;
      }
      setCola((c) => alFrente(c, d));
      setHechas((n) => Math.max(0, n - 1));
      setToast({ texto: r.error ?? 'No se pudo guardar', error: true });
    });
  }, [actual, sePuede, marcada, texto, responder, volar, devolver]);

  const despues = useCallback(() => {
    if (!actual || ocupado.current) return;
    const d = actual;
    volar('izquierda', () => {
      setCola((c) => sinLa(c, d.id));
      setLuego((l) => [...sinLa(l, d.id), d]);
    });
  }, [actual, volar]);

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

  // ── El gesto ────────────────────────────────────────────────────────────
  const onPointerDown = (e: EventoPuntero<HTMLElement>) => {
    arrastro.current = false;
    if (ocupado.current || !actual) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const t = e.target as HTMLElement;
    if (t.closest('textarea, input, a, select, [data-mazo-sin-gesto]')) return;
    // Los bordes son del sistema (volver atrás en iOS y Android).
    if (e.pointerType === 'touch' && (e.clientX < 24 || e.clientX > window.innerWidth - 24)) return;
    gesto.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, t: e.timeStamp, vx: 0, estado: 'posible' };
  };

  const onPointerMove = (e: EventoPuntero<HTMLElement>) => {
    const g = gesto.current;
    if (!g || g.id !== e.pointerId || g.estado === 'nada') return;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    if (g.estado === 'posible') {
      if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) { g.estado = 'nada'; return; }
      if (Math.abs(dx) <= 8 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      g.estado = 'arrastra';
      try { cartaRef.current?.setPointerCapture(e.pointerId); } catch { /* ya no está */ }
      if (cartaRef.current) cartaRef.current.style.transition = 'none';
    }
    const dt = e.timeStamp - g.t;
    if (dt > 0) g.vx = (dx - g.dx) / dt;
    g.dx = dx;
    g.t = e.timeStamp;
    pintar(dx);
  };

  const terminar = (e: EventoPuntero<HTMLElement>, cancelado: boolean) => {
    const g = gesto.current;
    gesto.current = null;
    if (!g || g.id !== e.pointerId || g.estado !== 'arrastra') return;
    arrastro.current = true;
    try { cartaRef.current?.releasePointerCapture(e.pointerId); } catch { /* ya la soltó */ }
    // Un tirón viejo no cuenta: si el dedo se quedó quieto antes de soltar, la velocidad es 0.
    const vx = e.timeStamp - g.t > 80 ? 0 : g.vx;
    const v = cancelado ? null : veredictoGesto({ dx: g.dx, vx, ancho: cartaRef.current?.offsetWidth ?? 360 });
    if (v === 'derecha') mandar();
    else if (v === 'izquierda') despues();
    else devolver();
  };

  // Las teclas, en la compu: ← después · → mandar · 1-4 marcar. No mientras se escribe.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.metaKey || e.ctrlKey || e.altKey || !actual) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); mandar(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); despues(); }
      else if (/^[1-4]$/.test(e.key)) {
        const o = actual.opciones[Number(e.key) - 1];
        if (o) { e.preventDefault(); setMarcadas((m) => ({ ...m, [actual.id]: o.clave })); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actual, mandar, despues]);

  // ── Lo que se dibuja ────────────────────────────────────────────────────
  const progreso = total ? Math.min(1, hechas / total) : 1;

  return (
    <section className="mazo" aria-label="Decisiones de a una">
      {/* Arriba, el progreso; y en su lugar, lo que acaba de pasar. «Cambiar» se usa poco: puede
          vivir lejos del pulgar, y así el aviso no tapa las opciones de la tarjeta que sigue. */}
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
          <>
            {total > 0 && <div className="mazo-barra" aria-hidden><span style={{ transform: `scaleX(${progreso})` }} /></div>}
            <p className="mazo-cuenta">
              {cola.length ? <><b>{cola.length}</b> por decidir</> : hechas ? <><b>{hechas}</b> respondidas</> : null}
            </p>
          </>
        )}
      </div>

      <div className="mazo-pila" ref={pilaRef}>
        {siguiente && <Carta key={siguiente.id} d={siguiente} atras marcada={marcadaDe(siguiente)} />}
        {actual ? (
          <Carta
            key={actual.id}
            refCarta={cartaRef}
            d={actual}
            marcada={marcada}
            texto={texto}
            detalle={detalle}
            selloSi={rotuloMandar(actual, marcada)}
            sePuede={sePuede}
            onDetalle={() => setDetalle((v) => !v)}
            onMarcar={marcar}
            onTexto={(v) => setTextos((t) => ({ ...t, [actual.id]: v }))}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={(e) => terminar(e, false)}
            onPointerCancel={(e) => terminar(e, true)}
            onClickCapture={(e) => {
              if (!arrastro.current) return;
              arrastro.current = false;
              e.preventDefault();
              e.stopPropagation();
            }}
          />
        ) : (
          <Vacio
            luego={luego.length}
            hechas={hechas}
            tablero={tablero}
            onDeNuevo={() => { setCola(luego); setLuego([]); }}
          />
        )}
      </div>

      <div className="mazo-abajo">
        {actual && (
          <div className="mazo-acciones">
            <button type="button" className="mazo-btn mazo-btn--no" onClick={despues} aria-label="Después: la dejo para más tarde (←)">
              <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
              <span>Después</span>
            </button>
            <button type="button" className="mazo-btn mazo-btn--si" onClick={mandar} aria-disabled={!sePuede}
              aria-label={`${rotuloMandar(actual, marcada)} (→)`}>
              <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
              <span>{rotuloMandar(actual, marcada)}</span>
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

// =============================================================================
// Una tarjeta
// =============================================================================
function Carta(p: {
  d: Decision;
  marcada: string | null;
  atras?: boolean;
  refCarta?: Ref<HTMLElement>;
  texto?: string;
  detalle?: boolean;
  selloSi?: string;
  sePuede?: boolean;
  onDetalle?: () => void;
  onMarcar?: (clave: string) => void;
  onTexto?: (v: string) => void;
  onPointerDown?: PointerEventHandler<HTMLElement>;
  onPointerMove?: PointerEventHandler<HTMLElement>;
  onPointerUp?: PointerEventHandler<HTMLElement>;
  onPointerCancel?: PointerEventHandler<HTMLElement>;
  onClickCapture?: MouseEventHandler<HTMLElement>;
}) {
  const { d, marcada, atras } = p;
  const tieneDetalle = !!(d.contexto || d.destraba || d.href);
  return (
    <article
      ref={p.refCarta}
      className={`mazo-carta mazo-carta--${d.urgencia}${atras ? ' mazo-carta--atras' : ''}`}
      aria-hidden={atras || undefined}
      inert={atras || undefined}
      onPointerDown={p.onPointerDown}
      onPointerMove={p.onPointerMove}
      onPointerUp={p.onPointerUp}
      onPointerCancel={p.onPointerCancel}
      onClickCapture={p.onClickCapture}
    >
      {!atras && (
        <>
          <span className={`mazo-sello mazo-sello--si${p.sePuede ? '' : ' mazo-sello--apagado'}`} aria-hidden>{p.selloSi}</span>
          <span className="mazo-sello mazo-sello--no" aria-hidden>Después</span>
        </>
      )}
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
          {d.opciones.length > 0 && !atras && (
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
    </article>
  );
}

// =============================================================================
// Cuando no queda ninguna
// =============================================================================
function Vacio({ luego, hechas, tablero, onDeNuevo }: { luego: number; hechas: number; tablero: string; onDeNuevo: () => void }) {
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
          <p>Lo nuevo aparece acá.</p>
        </>
      )}
      <Link href={tablero} className="mazo-link">Ver el tablero</Link>
    </div>
  );
}
