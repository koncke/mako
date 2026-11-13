'use client';

// =============================================================================
// Marketing CoPilot — «Oferta y comunicación» en la app (12/11/2026, la vuelta 19 de la maqueta)
// =============================================================================
// Tres partes con UN molde (Martín, vuelta 18): Oferta, Ángulos y Tu voz.
//   · EL ANÁLISIS: «Nota por nota» (las barras del 1 al 10, cada una con su porqué y «Mejorar»), la nota y «Lo que leí».
//   · LA ACCIÓN: el chat de MaKo a la izquierda y, a la derecha, los desplegables. Cada desplegable es UNA caja (vuelta 19: abierto
//     «está como todo suelto, flotando»), sin explicaciones («texto innecesario»), y cada cosa con su check (como las tareas de Web):
//     lo que falta en rojo, lo que hay que confirmar en ámbar, lo listo en verde, y lo que sabe MaKo con su fuente. Sin nota.
//   · El POPUP de cada cosa: qué es, lo que sé (con la fuente), marcarlo o hablarlo en el chat.
// ⚠️ Nunca cambia el alto de las secciones (chat incluido) al cambiar de parte o abrir un desplegable (Martín, vuelta 18): el bloque
//    tiene el alto del chat y lo de adentro se desplaza (copiloto-css.ts → .frn-trabajo--oferta).
// Los datos: /api/copiloto/comunicacion (lib/copiloto/comunicacion-store.ts). La oferta son las piezas de Offer; Ángulos y Tu voz, lo
// que MaKo leyó del negocio y lo que la persona confirmó.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ConversacionCerebro } from '@/app/_chat/MakoEnLaTab';
import {
  ETIQUETA_ESTADO_OC, OC, PARTES_OC, estadoDeGrupoOC, grupoParaAbrirOC, nombreCriterioOC, nombreItemOC,
  type CosaOC, type ParteOC,
} from '@/lib/copiloto/comunicacion';
import type { EstadoComunicacion } from '@/lib/copiloto/comunicacion-store';
import { Chevron, IconoFuente, Medialuna, Tilde } from './iconos';

// ── Los datos ────────────────────────────────────────────────────────────────

type Respuesta = { ok: boolean; estado?: EstadoComunicacion; error?: string };
async function llamar(body: Record<string, unknown> | null, sesion: number | null): Promise<Respuesta> {
  try {
    const r = body
      ? await fetch('/api/copiloto/comunicacion', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...body, sesion }) })
      : await fetch(`/api/copiloto/comunicacion${sesion != null ? `?sesion=${sesion}` : ''}`, { cache: 'no-store' });
    return (await r.json()) as Respuesta;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No pude conectarme.' };
  }
}

/** El estado de Oferta y comunicación y lo que se hace con él (marcar, leer, cambiar de oferta). */
export function useComunicacion(inicial: EstadoComunicacion, avisar: (m: string, tono?: 'bad' | 'good') => void) {
  const [estado, setEstado] = useState(inicial);
  const [leyendo, setLeyendo] = useState<ParteOC | null>(null);
  const sesion = estado.sesion;
  const aplicar = useCallback((r: Respuesta) => {
    if (r.ok && r.estado) setEstado(r.estado);
    else avisar(r.error || 'No se pudo.', 'bad');
    return r.ok;
  }, [avisar]);
  const recargar = useCallback(async (s: number | null = sesion) => aplicar(await llamar(null, s)), [aplicar, sesion]);
  const marcar = useCallback(async (p: ParteOC, k: string, listo: boolean) => {
    // Se ve al instante; si falla, vuelve como estaba.
    setEstado((e) => {
      const c = e.cosas[p][k];
      if (!c || c.estado === 'vacia') return e;
      return { ...e, cosas: { ...e.cosas, [p]: { ...e.cosas[p], [k]: { ...c, estado: listo ? 'confirmada' : 'negocio' } } } };
    });
    const ok = aplicar(await llamar({ op: 'marcar', parte: p, k, listo }, sesion));
    if (!ok) void recargar();
  }, [aplicar, recargar, sesion]);
  const leer = useCallback(async (p: ParteOC) => {
    setLeyendo(p);
    const ok = aplicar(await llamar({ op: 'leer', parte: p }, sesion));
    setLeyendo(null);
    if (ok) avisar(p === 'angulos' ? 'Listo: leí tus ángulos.' : 'Listo: leí tu voz.', 'good');
  }, [aplicar, avisar, sesion]);
  // Lo que se guarda desde el chat (la API de MaKo) no pasa por acá: al volver a la pestaña se relee.
  useEffect(() => {
    const alVolver = () => { if (document.visibilityState === 'visible') void recargar(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [recargar]);
  return { estado, leyendo, marcar, leer, recargar, elegirOferta: (id: number) => recargar(id) };
}

// ── Las piezas comunes ───────────────────────────────────────────────────────

/** El desplegable de la oferta (las conversaciones de Offer), con «Nueva oferta». */
export function SelectorOferta({ estado, onElegir }: { estado: EstadoComunicacion; onElegir: (id: number) => void }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [abierto]);
  const actual = estado.ofertas.find((o) => o.id === estado.sesion);
  return (
    <div className="frn-desp" ref={ref}>
      <button type="button" className="frn-desp__btn" aria-expanded={abierto} onClick={() => setAbierto((v) => !v)}>
        <span>Oferta</span><b>{actual?.titulo ?? 'Ninguna todavía'}</b><Chevron />
      </button>
      {abierto && (
        <div className="frn-desp__menu" role="listbox">
          {estado.ofertas.map((o) => (
            <button key={o.id} type="button" role="option" aria-selected={o.id === estado.sesion} onClick={() => { setAbierto(false); onElegir(o.id); }}>
              <b>{o.titulo}</b>
            </button>
          ))}
          <Link href="/offer" onClick={() => setAbierto(false)} role="option" aria-selected={false}><b>Nueva oferta</b></Link>
        </div>
      )}
    </div>
  );
}

export function SegPartes({ parte, onParte }: { parte: ParteOC; onParte: (p: ParteOC) => void }) {
  return (
    <div className="frn-seg oc-seg" role="tablist" aria-label="Oferta y comunicación">
      {PARTES_OC.map(([k, t]) => <button key={k} type="button" role="tab" aria-pressed={parte === k} aria-selected={parte === k} onClick={() => onParte(k)}>{t}</button>)}
    </div>
  );
}

// ── El análisis ──────────────────────────────────────────────────────────────

const colorNota = (n: number) => (n >= 7 ? 'var(--good)' : n >= 4 ? 'var(--warn)' : 'var(--bad)');
const rellenoNota = (n: number) => (n >= 7 ? 'var(--good)' : n >= 4 ? 'var(--warn-fill, var(--warn))' : 'var(--bad)');

function FilaNota({ nombre, n, porque, onMejorar }: { nombre: string; n: number; porque: string; onMejorar: () => void }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <div>
      <button type="button" className="of-fila" aria-expanded={abierta} onClick={() => setAbierta((v) => !v)}>
        <span className="of-fila__label">{nombre}</span>
        <span className="of-fila__barra" style={{ display: 'block', height: 10, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
          <span style={{ display: 'block', height: 10, width: `${n * 10}%`, background: rellenoNota(n), borderRadius: 999 }} />
        </span>
        <span className="of-fila__nota" style={{ fontSize: 'var(--fs-card)', color: colorNota(n) }}>{n}</span>
        <span className="of-fila__flecha" style={{ visibility: 'visible' }}><Chevron /></span>
      </button>
      {abierta && (
        <div className="mq-abierto">
          {porque && <p>{porque}</p>}
          <div className="mq-acciones"><button type="button" className="mk-btn mk-btn--primary mk-btn--sm" onClick={onMejorar}>Mejorar</button></div>
        </div>
      )}
    </div>
  );
}

const MEJORAR: Record<ParteOC, string> = { oferta: 'Mejorar oferta', angulos: 'Mejorar ángulos', voz: 'Mejorar tu voz' };
const LEER: Record<Exclude<ParteOC, 'oferta'>, [string, string]> = { angulos: ['Todavía no leí tus ángulos', 'Leer mis ángulos'], voz: ['Todavía no leí tu voz', 'Leer mi voz'] };

export function AnalisisOC({ estado, parte, leyendo, onLeer, onMejorar }: {
  estado: EstadoComunicacion; parte: ParteOC; leyendo: ParteOC | null;
  onLeer: (p: ParteOC) => void;
  /** Ir a la acción de esta parte; con un criterio, el chat arranca por él. */
  onMejorar: (p: ParteOC, criterio?: { nombre: string; nota: number; porque: string }) => void;
}) {
  const nota = estado.nota[parte];
  if (!nota) {
    if (parte === 'oferta') {
      return (
        <section className="frn-card frn-rem frn-rem--ancho">
          <p className="frn-rem__h">{estado.sesion == null ? 'Todavía no armaste tu oferta' : 'Todavía no analicé esta oferta'}</p>
          <Link className="frn-btn" href="/offer">{estado.sesion == null ? 'Armarla en Offer' : 'Analizarla en Offer'}</Link>
        </section>
      );
    }
    const [titulo, boton] = LEER[parte];
    return (
      <section className="frn-card frn-rem frn-rem--ancho">
        <p className="frn-rem__h">{leyendo === parte ? 'Leyendo lo que tienes en MaKo…' : titulo}</p>
        <button type="button" className="frn-btn" disabled={leyendo != null} onClick={() => onLeer(parte)}>{leyendo === parte ? 'Leyendo…' : boton}</button>
      </section>
    );
  }
  const flojo = nota.criterios.reduce((a, b) => (b.nota < a.nota ? b : a), nota.criterios[0]);
  return (
    <div className="frn-dos oc-dos">
      <section className="frn-card">
        <h2 className="frn-card__t">Nota por nota</h2>
        <div className="mq-notas mq-notas--frn">
          {nota.criterios.map((c) => (
            <FilaNota key={c.id} nombre={nombreCriterioOC(parte, c.id)} n={c.nota} porque={c.porque}
              onMejorar={() => onMejorar(parte, { nombre: nombreCriterioOC(parte, c.id), nota: c.nota, porque: c.porque })} />
          ))}
        </div>
      </section>
      <div className="frn-col">
        <section className="frn-card frn-progress frn-nota">
          <h2 className="frn-card__t">Tu nota</h2>
          <Medialuna n={nota.total} />
          {flojo && <p className="frn-nota__flojo">Lo más flojo: <b>{nombreCriterioOC(parte, flojo.id).toLowerCase()}</b></p>}
          <button type="button" className="frn-btn frn-btn--primary frn-btn--ancho" onClick={() => onMejorar(parte)}>{MEJORAR[parte]}</button>
        </section>
        {(nota.lei.length > 0 || parte !== 'oferta') && (
          <section className="frn-card">
            <h2 className="frn-card__t">Lo que leí</h2>
            {nota.lei.length > 0 && <dl className="frn-datos">{nota.lei.map((l, i) => <div key={i}><dt>{l.titulo}</dt><dd>{l.texto}</dd></div>)}</dl>}
            {parte !== 'oferta' && (
              <button type="button" className="frn-btn frn-btn--ghost frn-btn--ancho" disabled={leyendo != null} onClick={() => onLeer(parte)}>
                {leyendo === parte ? 'Leyendo…' : 'Volver a leer'}
              </button>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

// ── La acción: los desplegables ──────────────────────────────────────────────

function FilaCosa({ p, k, c, onMarcar, onAbrir }: { p: ParteOC; k: string; c: CosaOC; onMarcar: () => void; onAbrir: () => void }) {
  const nombre = nombreItemOC(p, k);
  const listo = c.estado === 'confirmada';
  return (
    <li className="oci" data-e={c.estado}>
      <button type="button" className="oci__check" aria-pressed={listo} aria-label={listo ? `Desmarcar «${nombre}»` : `Marcar «${nombre}» como listo`}
        onClick={c.estado === 'vacia' ? onAbrir : onMarcar}>{listo ? <Tilde size={13} /> : null}</button>
      <button type="button" className="oci__cuerpo" onClick={onAbrir}>
        <span className="oci__t">{nombre}</span>
        {c.estado !== 'vacia' && <span className="oci__x">{c.valor}</span>}
        {c.estado !== 'vacia' && c.fuente && <span className="oci__ref"><IconoFuente tipo={c.fuente.tipo} />{c.fuente.texto}</span>}
      </button>
      <span className="oci__est" data-e={c.estado}>{ETIQUETA_ESTADO_OC[c.estado]}</span>
    </li>
  );
}

/** Los desplegables de una parte, en el bloque de la derecha. Abre solo el primero al que le falta algo. */
export function BloqueOC({ estado, parte, onParte, onMarcar, onAbrir }: {
  estado: EstadoComunicacion; parte: ParteOC; onParte: (p: ParteOC) => void;
  onMarcar: (p: ParteOC, k: string, listo: boolean) => void; onAbrir: (p: ParteOC, k: string) => void;
}) {
  const cosas = estado.cosas[parte];
  const [abiertos, setAbiertos] = useState<Partial<Record<ParteOC, string | null>>>({});
  const abierto = abiertos[parte] !== undefined ? abiertos[parte] : grupoParaAbrirOC(parte, cosas);
  return (
    <section className="frn-card oc">
      <SegPartes parte={parte} onParte={onParte} />
      <div className="oc-cuerpo">
        <ul className="oc-grupos">
          {OC[parte].grupos.map((g) => {
            const { e, dice, tel } = estadoDeGrupoOC(parte, g, cosas);
            const yo = abierto === g.titulo;
            return (
              <li key={g.titulo} className={`oc-g${yo ? ' oc-g--abierto' : ''}`} data-e={e}>
                <button type="button" className="oc-g__cab" aria-expanded={yo} onClick={() => setAbiertos((a) => ({ ...a, [parte]: yo ? null : g.titulo }))}>
                  <span className="oc-g__t">{g.titulo}</span>
                  <span className="oc-g__e" data-e={e}>{e === 'listo' && <Tilde size={15} />}<span className="oc-g__largo">{dice}</span><span className="oc-g__corto">{tel}</span></span>
                  <Chevron />
                </button>
                {yo && (
                  <ul className="oci-lista">
                    {g.items.map((k) => <FilaCosa key={k} p={parte} k={k} c={cosas[k]} onMarcar={() => onMarcar(parte, k, cosas[k].estado !== 'confirmada')} onAbrir={() => onAbrir(parte, k)} />)}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/** Lo que MaKo pregunta primero en el chat de la acción: la primera cosa que falta de la parte elegida. */
export function primeraQueFalta(estado: EstadoComunicacion, p: ParteOC): string | null {
  return OC[p].grupos.flatMap((g) => g.items).find((k) => estado.cosas[p][k]?.estado === 'vacia') ?? null;
}

const NOMBRE_PARTE: Record<ParteOC, string> = { oferta: 'tu oferta', angulos: 'tus ángulos', voz: 'tu voz' };

/** La acción de Oferta y comunicación: el chat a la izquierda (con la oferta arriba) y los desplegables a la derecha. */
export function AccionOC({ estado, parte, onParte, onMarcar, onAbrir, onElegirOferta, pedido, onMandado }: {
  estado: EstadoComunicacion; parte: ParteOC; onParte: (p: ParteOC) => void;
  onMarcar: (p: ParteOC, k: string, listo: boolean) => void; onAbrir: (p: ParteOC, k: string) => void;
  onElegirOferta: (id: number) => void;
  pedido: { texto: string; vez: number } | null; onMandado: () => void;
}) {
  const falta = primeraQueFalta(estado, parte);
  const oferta = estado.ofertas.find((o) => o.id === estado.sesion);
  const [interno, setInterno] = useState<{ texto: string; vez: number } | null>(null);
  const apertura = (
    <div className="cp-apertura">
      <p>{falta ? `Para ${NOMBRE_PARTE[parte]} me falta «${nombreItemOC(parte, falta)}». ¿Lo completamos?` : `${NOMBRE_PARTE[parte][0].toUpperCase()}${NOMBRE_PARTE[parte].slice(1)} está completa. ¿Qué mejoramos?`}</p>
      {falta && (
        <div className="aa-rapidas" role="group" aria-label="Para empezar">
          <button type="button" className="of-pill" onClick={() => setInterno({ texto: textoCompletar(parte, falta, estado), vez: Date.now() })}>Completar «{nombreItemOC(parte, falta)}»</button>
        </div>
      )}
    </div>
  );
  // Lo que el chat sabe de la pantalla (va con cada mensaje): qué falta, con su clave, y cómo se guarda. Así no hace falta una regla
  // más en el prompt del CoPilot, que tiene su tope (tests/marketing-copilot-agente.test.ts → «el peso»).
  const faltan = OC[parte].grupos.flatMap((g) => g.items).filter((k) => estado.cosas[parte][k]?.estado !== 'confirmada').slice(0, 6)
    .map((k) => `${k} («${nombreItemOC(parte, k)}»${estado.cosas[parte][k]?.estado === 'negocio' ? ', por confirmar' : ''})`);
  const pantalla = `Marketing CoPilot · La acción · Oferta y comunicación · ${PARTES_OC.find(([k]) => k === parte)?.[1]}${oferta ? ` · oferta «${oferta.titulo}»` : ' · todavía sin oferta en Offer'}`
    + (faltan.length ? ` · Le falta: ${faltan.join(', ')}. Pregunta UNA por vez, con un ejemplo corto, y guárdala con guardar_comunicacion_copiloto (parte ${parte}, su clave). Un ángulo nunca se inventa: sale de su cliente y de lo que trae agendas o ventas.` : '');
  return (
    <div className="frn-trabajo frn-trabajo--oferta">
      <section className="frn-card frn-embebido">
        <div className="frn-card__head"><SelectorOferta estado={estado} onElegir={onElegirOferta} /></div>
        <div className="mq-offer cp-chat">
          <div className="cp-chat-cerebro">
            <ConversacionCerebro tab="Marketing CoPilot" titulo="MaKo" apertura={apertura} aperturaHastaEscribir
              pedido={pedido ?? interno} onMandado={() => { setInterno(null); onMandado(); }} pantalla={pantalla} />
          </div>
        </div>
      </section>
      <BloqueOC estado={estado} parte={parte} onParte={onParte} onMarcar={onMarcar} onAbrir={onAbrir} />
    </div>
  );
}

/** Lo que va al chat cuando se pide completar, confirmar o cambiar una cosa. */
export function textoCompletar(p: ParteOC, k: string, estado: EstadoComunicacion): string {
  const c = estado.cosas[p][k];
  const nombre = nombreItemOC(p, k);
  if (!c || c.estado === 'vacia') return `Completemos «${nombre}» de ${NOMBRE_PARTE[p]}.`;
  if (c.estado === 'negocio') return `Confirmemos «${nombre}» de ${NOMBRE_PARTE[p]}: leíste «${c.valor}».`;
  return `Quiero cambiar «${nombre}» de ${NOMBRE_PARTE[p]}: hoy dice «${c.valor}».`;
}

// ── El popup de cada cosa ────────────────────────────────────────────────────

export function ModalCosa({ estado, p, k, onCerrar, onMarcar, onChat }: {
  estado: EstadoComunicacion; p: ParteOC; k: string; onCerrar: () => void;
  onMarcar: (p: ParteOC, k: string, listo: boolean) => void; onChat: (texto: string) => void;
}) {
  const c = estado.cosas[p][k];
  const def = OC[p].items[k];
  const dialogo = useRef<HTMLDivElement>(null);
  useEffect(() => {
    dialogo.current?.focus();
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [onCerrar]);
  const montado = useMontado();
  if (!c || !def || !montado) return null;
  const listo = c.estado === 'confirmada';
  const chat = c.estado === 'vacia' ? 'Completarlo en el chat' : c.estado === 'negocio' ? 'Confirmarlo en el chat' : 'Cambiarlo en el chat';
  return createPortal(
    <div className="mq-modal-fondo cop-fondo" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className="ocm" role="dialog" aria-modal="true" aria-label={def.nombre} tabIndex={-1} ref={dialogo}>
        <header className="ocm__cab">
          <h2>{def.nombre}</h2>
          <span className="ocm__est" data-e={c.estado}>{ETIQUETA_ESTADO_OC[c.estado]}</span>
          <button type="button" className="ocm__x" aria-label="Cerrar" onClick={onCerrar}>×</button>
        </header>
        <section className="ocm__sec"><h3>Qué es</h3><p>{def.que}</p></section>
        <section className="ocm__sec">
          <h3>Lo que sé</h3>
          {c.estado === 'vacia' ? (
            <div className="ocm__sabe" data-e="vacia"><p className="ocm__valor">Todavía no lo sé.</p><p className="ocm__nota">Te lo pregunto en el chat.</p></div>
          ) : (
            <div className="ocm__sabe" data-e={c.estado}>
              <p className="ocm__valor">{c.valor}</p>
              {c.fuente && <div className="ocm__ref"><IconoFuente tipo={c.fuente.tipo} size={16} /><span>{c.fuente.texto}</span></div>}
              {c.estado === 'negocio' && <p className="ocm__nota">Lo leí de lo que tienes en MaKo: confírmalo.</p>}
            </div>
          )}
        </section>
        <footer className="ocm__pie">
          {c.estado !== 'vacia' ? (
            <button type="button" className="ocm__marca" aria-pressed={listo} onClick={() => onMarcar(p, k, !listo)}>
              <span className="ocm__circ" data-listo={listo}>{listo ? <Tilde size={13} /> : null}</span>{listo ? 'Listo' : 'Marcar como listo'}
            </button>
          ) : <span />}
          <button type="button" className="ocm__ir" onClick={() => onChat(textoCompletar(p, k, estado))}>{chat}</button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

/**
 * «Mejorar» (vuelta 20): lo que sé y lo que falta de la parte elegida, con los mismos desplegables, en un popup. Se completa en el
 * chat de MaKo (la oferta se construye en el Ops Center; en CoPilot queda el análisis). Adentro de un `.frn`: los desplegables
 * tienen todo su CSS bajo `.frn` (afuera salían sin estilo, medido en la maqueta).
 */
export function ModalTodoOC({ estado, parte, onParte, onCerrar, onMarcar, onAbrir, onChat }: {
  estado: EstadoComunicacion; parte: ParteOC; onParte: (p: ParteOC) => void; onCerrar: () => void;
  onMarcar: (p: ParteOC, k: string, listo: boolean) => void; onAbrir: (p: ParteOC, k: string) => void; onChat: (texto: string) => void;
}) {
  const dialogo = useRef<HTMLDivElement>(null);
  useEffect(() => {
    dialogo.current?.focus();
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [onCerrar]);
  const montado = useMontado();
  if (!montado) return null;
  const falta = primeraQueFalta(estado, parte);
  const titulo = parte === 'oferta' ? 'Tu oferta' : parte === 'angulos' ? 'Tus ángulos' : 'Tu voz';
  return createPortal(
    <div className="mq-modal-fondo cop-fondo" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className="ocm ocm--todo" role="dialog" aria-modal="true" aria-label={titulo} tabIndex={-1} ref={dialogo}>
        <header className="ocm__cab"><h2>{titulo}</h2><span /><button type="button" className="ocm__x" aria-label="Cerrar" onClick={onCerrar}>×</button></header>
        <div className="frn frn--mono ocm__frn"><BloqueOC estado={estado} parte={parte} onParte={onParte} onMarcar={onMarcar} onAbrir={onAbrir} /></div>
        <footer className="ocm__pie"><span />
          <button type="button" className="ocm__ir" onClick={() => onChat(falta ? textoCompletar(parte, falta, estado) : `Mejoremos ${NOMBRE_PARTE[parte]}.`)}>Completarlo en el chat</button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

function useMontado() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

/** Cuántas cosas te tocan en Oferta y comunicación (lo que falta y lo que hay que confirmar): el número de su tarjeta. */
export function teTocanOC(estado: EstadoComunicacion): number {
  return (['oferta', 'angulos', 'voz'] as const).reduce((n, p) => n + Object.values(estado.cosas[p]).filter((c) => c.estado !== 'confirmada').length, 0);
}

export const useNotaOC = (estado: EstadoComunicacion) => useMemo(() => {
  const ns = (['oferta', 'angulos', 'voz'] as const).map((p) => estado.nota[p]?.total).filter((n): n is number => typeof n === 'number');
  return ns.length ? Math.round(ns.reduce((a, b) => a + b, 0) / ns.length) : null;
}, [estado]);
