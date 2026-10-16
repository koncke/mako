'use client';

// =============================================================================
// VistaTiempo — Día, 4 días y Semana de Google Calendar: la franja de todo el día arriba y la grilla de horas abajo
// =============================================================================
// Copiado de la web de Google Calendar: 48 px por hora, la hora a la izquierda («10 a.m.»), la línea roja de ahora en
// la columna de hoy, los eventos llenos del color de su calendario repartidos en columnas cuando se pisan
// (`columnasDelDia`), y lo de todo el día o de varios días como barras arriba (`barrasDeLaFila`).
//
// LOS GESTOS, como en Google (pointer events, no drag-and-drop de HTML5: acá no se transporta nada, se mueve un valor):
//   · Arrastrar en un hueco marca un rango y abre «crear» con ese rango; un clic solo abre «crear» de una hora.
//   · Arrastrar un evento que se puede mover lo cambia de hora o de día; el borde de abajo le cambia el fin.
//   · Un clic en un evento abre su tarjeta.
// ⚠️ `setPointerCapture` RETARGETEA el pointerup al elemento que capturó: lo que se tocó se anota en el pointerdown
//    (AGENTS.md, «el gesto de un lienzo»). Y el cambio se manda AL SOLTAR, una vez: arrastrar no escribe nada en el medio.
// ⚠️ Mientras se arrastra, la posición se escribe en el estado del gesto (un solo componente se redibuja), no en el de
//    toda la pantalla.

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react';
import {
  DIAS_CORTOS, barrasDeLaFila, columnasDelDia, diaDe, diaDeLaSemana, horaGoogle, minutosDelDia, vaArriba,
  type ItemCalendario,
} from '@/lib/calendario-modelo';
import { HORA_PX } from './gc-css';
import { colorDe, rangoGoogle, sePuedeMover, tituloDe } from './comun';

// `rangoGoogle` y `tituloDe` viven en ./comun (puro) desde el 15/10/2026: también los usa el teléfono.
export { rangoGoogle, tituloDe };

const PASO = 15;
const snap = (min: number) => Math.max(0, Math.min(24 * 60, Math.round(min / PASO) * PASO));
const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** «GMT-07»: la zona de la columna de las horas, como la rotula Google. */
export function rotuloZona(tz: string, cuando: Date = new Date()): string {
  try {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(cuando);
    const v = p.find((x) => x.type === 'timeZoneName')?.value ?? 'GMT';
    const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(v);
    if (!m) return 'GMT';
    return `GMT${m[1]}${m[2].padStart(2, '0')}${m[3] ? `:${m[3]}` : ''}`;
  } catch { return 'GMT'; }
}

type Gesto =
  | { t: 'crear'; dia: string; ancla: number; desde: number; hasta: number; movido: boolean }
  | { t: 'mover'; item: ItemCalendario; dia: string; ini: number; dur: number; offset: number; movido: boolean; x0: number; y0: number }
  | { t: 'estirar'; item: ItemCalendario; dia: string; ini: number; fin: number; movido: boolean };

export type NuevoRango = { fecha: string; ini: number | null; fin: number | null };

export function VistaTiempo({ dias, items, hoy, tz, googleEscribe, onAbrir, onNuevo, onMover, onIrDia }: {
  dias: string[];
  items: ItemCalendario[];
  hoy: string;
  tz: string;
  googleEscribe: boolean;
  onAbrir: (it: ItemCalendario, ancla: DOMRect) => void;
  /** `ini`/`fin` en minutos del día; null = todo el día. */
  onNuevo: (r: NuevoRango, ancla: DOMRect) => void;
  /** Lo movió o lo estiró: el día nuevo, el inicio y el fin (minutos). */
  onMover: (it: ItemCalendario, fecha: string, ini: number, fin: number) => void;
  onIrDia: (dia: string) => void;
}) {
  const n = dias.length;
  const columnas = `72px repeat(${n}, minmax(0, 1fr))`;
  const scrollRef = useRef<HTMLDivElement>(null);
  const colsRef = useRef<Array<HTMLDivElement | null>>([]);
  const [gesto, setGesto] = useState<Gesto | null>(null);
  const gestoRef = useRef<Gesto | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());

  // La línea roja se mueve sola (una vez por minuto).
  useEffect(() => {
    const t = window.setInterval(() => setAhora(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  // Al abrir, la grilla arranca un poco antes de ahora (o a las 7 si hoy no está a la vista), como Google.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const min = dias.includes(hoy) ? minutosDelDia(new Date().toISOString(), tz) : 7 * 60;
    el.scrollTop = Math.max(0, (min / 60 - 1.5) * HORA_PX);
    // Sólo al montar y al cambiar de rango: no se le pisa el scroll a quien está mirando.
  }, [dias, hoy, tz]);

  const arriba = useMemo(() => items.filter((it) => vaArriba(it, tz)), [items, tz]);
  const porDia = useMemo(() => {
    const out = new Map<string, ItemCalendario[]>(dias.map((d) => [d, []]));
    for (const it of items) {
      if (vaArriba(it, tz)) continue;
      out.get(diaDe(it.inicio, tz))?.push(it);
    }
    return out;
  }, [items, dias, tz]);
  const { barras, carriles } = useMemo(() => barrasDeLaFila(arriba, dias, tz), [arriba, dias, tz]);
  const altoTodo = Math.max(1, carriles) * 24 + 6;

  // ── Gestos ──
  const colEn = (x: number): number => {
    for (let i = 0; i < colsRef.current.length; i++) {
      const r = colsRef.current[i]?.getBoundingClientRect();
      if (r && x >= r.left && x < r.right) return i;
    }
    return x < (colsRef.current[0]?.getBoundingClientRect().left ?? 0) ? 0 : n - 1;
  };
  const minEn = (i: number, y: number): number => {
    const r = colsRef.current[i]?.getBoundingClientRect();
    return r ? ((y - r.top) / HORA_PX) * 60 : 0;
  };
  const poner = (g: Gesto | null) => { gestoRef.current = g; setGesto(g); };

  const bajarEnHueco = (e: RPointerEvent<HTMLDivElement>, i: number) => {
    if (e.button !== 0 || e.target !== e.currentTarget) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const m = Math.floor(minEn(i, e.clientY) / 30) * 30;
    poner({ t: 'crear', dia: dias[i], ancla: m, desde: m, hasta: m + 60, movido: false });
  };
  const bajarEnEvento = (e: RPointerEvent<HTMLElement>, it: ItemCalendario, dia: string, ini: number, fin: number) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (!sePuedeMover(it, googleEscribe)) return; // un clic igual abre la tarjeta (onClick)
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const i = dias.indexOf(dia);
    poner({ t: 'mover', item: it, dia, ini, dur: Math.max(PASO, fin - ini), offset: minEn(i, e.clientY) - ini, movido: false, x0: e.clientX, y0: e.clientY });
  };
  const bajarEnTirador = (e: RPointerEvent<HTMLElement>, it: ItemCalendario, dia: string, ini: number, fin: number) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    poner({ t: 'estirar', item: it, dia, ini, fin, movido: false });
  };
  const mover = (e: RPointerEvent<HTMLElement>) => {
    const g = gestoRef.current;
    if (!g) return;
    if (g.t === 'crear') {
      const m = snap(minEn(dias.indexOf(g.dia), e.clientY));
      const desde = Math.min(g.ancla, m), hasta = Math.max(g.ancla + PASO, m);
      if (desde !== g.desde || hasta !== g.hasta) poner({ ...g, desde, hasta, movido: true });
    } else if (g.t === 'mover') {
      if (!g.movido && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < 5) return;
      const i = colEn(e.clientX);
      const ini = Math.min(24 * 60 - g.dur, snap(minEn(i, e.clientY) - g.offset));
      poner({ ...g, dia: dias[i], ini, movido: true });
    } else {
      const fin = Math.max(g.ini + PASO, snap(minEn(dias.indexOf(g.dia), e.clientY)));
      if (fin !== g.fin) poner({ ...g, fin, movido: true });
    }
  };
  const soltar = (e: RPointerEvent<HTMLElement>) => {
    const g = gestoRef.current;
    poner(null);
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ya soltado */ }
    if (!g) return;
    if (g.t === 'crear') {
      const col = colsRef.current[dias.indexOf(g.dia)]?.getBoundingClientRect();
      const top = (col?.top ?? 0) + (g.desde / 60) * HORA_PX;
      const ancla = new DOMRect(col?.left ?? e.clientX, top, col?.width ?? 0, ((g.hasta - g.desde) / 60) * HORA_PX);
      onNuevo({ fecha: g.dia, ini: g.desde, fin: g.hasta }, ancla);
    } else if (g.t === 'mover') {
      if (g.movido) onMover(g.item, g.dia, g.ini, g.ini + g.dur);
      else onAbrir(g.item, (e.currentTarget as HTMLElement).getBoundingClientRect());
    } else if (g.movido) onMover(g.item, g.dia, g.ini, g.fin);
  };

  const ahoraMin = minutosDelDia(new Date(ahora).toISOString(), tz);

  return (
    <>
      <div className="gc-cab" style={{ gridTemplateColumns: columnas }}>
        <div className="gc-zona">{rotuloZona(tz)}</div>
        {dias.map((d) => {
          const clase = ['gc-cab-dia'];
          if (d === hoy) clase.push('gc-cab-dia--hoy');
          else if (d < hoy) clase.push('gc-cab-dia--pasado');
          return (
            <div key={d} className={clase.join(' ')}>
              <span className="gc-cab-sem">{DIAS_CORTOS[diaDeLaSemana(d)]}</span>
              <button type="button" className="gc-cab-num" aria-label={`Ver el ${d}`} onClick={() => onIrDia(d)}>{Number(d.slice(8))}</button>
            </div>
          );
        })}
      </div>

      {/* Todo el día y varios días: barras arriba. Un clic en un hueco crea uno de todo el día. */}
      <div className="gc-todo" style={{ gridTemplateColumns: columnas, height: altoTodo }}>
        <div />
        <div className="gc-todo-capa" style={{ height: altoTodo }}
          onClick={(e) => {
            if (e.target !== e.currentTarget) return;
            const r = e.currentTarget.getBoundingClientRect();
            const i = Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - r.left) / r.width) * n)));
            onNuevo({ fecha: dias[i], ini: null, fin: null }, new DOMRect(r.left + (r.width / n) * i, r.top, r.width / n, altoTodo));
          }}>
          {barras.map((b) => {
            const color = colorDe(b.item);
            const clase = ['gc-barrita'];
            if (b.sigueAntes) clase.push('gc-barrita--antes');
            if (b.sigueDespues) clase.push('gc-barrita--despues');
            const estilo: CSSProperties = {
              left: `calc(${(b.desde / n) * 100}% + 2px)`, width: `calc(${((b.hasta - b.desde + 1) / n) * 100}% - 6px)`,
              top: 3 + b.carril * 24, background: color,
            };
            return (
              <button key={`${b.item.id}-${b.desde}`} type="button" className={clase.join(' ')} style={estilo}
                onClick={(e) => onAbrir(b.item, e.currentTarget.getBoundingClientRect())}>
                {tituloDe(b.item, tz)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="gc-scroll" ref={scrollRef}>
        <div className="gc-grilla" style={{ gridTemplateColumns: columnas }}>
          <div aria-hidden>
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="gc-hora">{h > 0 && <span>{horaGoogle(hhmm(h * 60), false)}</span>}</div>
            ))}
          </div>
          {dias.map((d, i) => {
            const delDia = porDia.get(d) ?? [];
            const eventos = delDia.map((it) => {
              const ini = minutosDelDia(it.inicio, tz);
              const fin = it.fin && diaDe(it.fin, tz) === d ? Math.max(ini + PASO, minutosDelDia(it.fin, tz)) : it.fin ? 24 * 60 : ini + 30;
              return { it, ini, fin };
            });
            const cols = columnasDelDia(eventos.map((e) => ({ id: e.it.id, ini: e.ini, fin: e.fin })));
            return (
              <div key={d} ref={(el) => { colsRef.current[i] = el; }} className={`gc-col${d === hoy ? ' gc-col--hoy' : ''}`} data-dia={d}
                style={{ height: 24 * HORA_PX }}
                onPointerDown={(e) => bajarEnHueco(e, i)} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={() => poner(null)}>
                {eventos.map(({ it, ini, fin }) => {
                  const enGesto = gesto && gesto.t !== 'crear' && gesto.item.id === it.id && gesto.movido;
                  if (enGesto) return null;
                  const c = cols.get(it.id) ?? { col: 0, cols: 1 };
                  const alto = Math.max(18, ((fin - ini) / 60) * HORA_PX - 2);
                  const ancho = 100 / c.cols;
                  const estilo: CSSProperties = {
                    top: (ini / 60) * HORA_PX + 1, height: alto,
                    left: `calc(${c.col * ancho}% + 1px)`, width: `calc(${ancho}% - ${c.cols > 1 ? 2 : 10}px)`,
                    background: colorDe(it), color: it.google?.rechazado ? colorDe(it) : undefined,
                  };
                  const clase = ['gc-ev'];
                  if (alto < 34) clase.push('gc-ev--uno');
                  if (it.hecho) clase.push('gc-ev--hecho');
                  if (it.google?.rechazado) clase.push('gc-ev--rechazado');
                  const rango = rangoGoogle(hhmm(ini), it.fin ? hhmm(fin) : null);
                  return (
                    <div key={it.id} role="button" tabIndex={0} className={clase.join(' ')} style={estilo}
                      aria-label={`${tituloDe(it, tz)}, ${rango}`}
                      onPointerDown={(e) => bajarEnEvento(e, it, d, ini, fin)}
                      onClick={(e) => { if (!sePuedeMover(it, googleEscribe)) onAbrir(it, e.currentTarget.getBoundingClientRect()); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir(it, e.currentTarget.getBoundingClientRect()); } }}>
                      {alto < 34
                        ? <><b>{tituloDe(it, tz)}</b><i>, {horaGoogle(hhmm(ini))}</i></>
                        : <><b>{tituloDe(it, tz)}</b><i>{rango}</i></>}
                      {sePuedeMover(it, googleEscribe) && it.fin && (
                        <span className="gc-ev-tirador" aria-hidden onPointerDown={(e) => bajarEnTirador(e, it, d, ini, fin)} />
                      )}
                    </div>
                  );
                })}

                {/* Lo que se está arrastrando (crear, mover o estirar) cae en esta columna. */}
                {gesto && gesto.dia === d && <Fantasma gesto={gesto} tz={tz} />}

                {d === hoy && <div className="gc-ahora" style={{ top: (ahoraMin / 60) * HORA_PX }} aria-hidden />}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function Fantasma({ gesto, tz }: { gesto: Gesto; tz: string }) {
  if (gesto.t === 'crear') {
    return (
      <div className="gc-fantasma" style={{ top: (gesto.desde / 60) * HORA_PX, height: Math.max(18, ((gesto.hasta - gesto.desde) / 60) * HORA_PX - 2), left: 1, right: 8 }}>
        <b style={{ display: 'block' }}>(Sin título)</b>{rangoGoogle(hhmm(gesto.desde), hhmm(gesto.hasta))}
      </div>
    );
  }
  if (!gesto.movido) return null;
  const ini = gesto.ini;
  const fin = gesto.t === 'mover' ? gesto.ini + gesto.dur : gesto.fin;
  return (
    <div className="gc-ev gc-ev--arrastrando" style={{ top: (ini / 60) * HORA_PX + 1, height: Math.max(18, ((fin - ini) / 60) * HORA_PX - 2), left: 1, right: 8, background: colorDe(gesto.item) }}>
      <b>{tituloDe(gesto.item, tz)}</b><i>{rangoGoogle(hhmm(ini), hhmm(fin))}</i>
    </div>
  );
}

