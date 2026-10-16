'use client';

// =============================================================================
// Las piezas del Calendario del teléfono: la tira de la semana, el mes chico, la Agenda, el Día y el evento
// =============================================================================
// Copiadas de la app de Google Calendar para el teléfono:
//   · LA TIRA: los siete días de la semana con la inicial (las de escritorio, `INICIALES_DIAS`), el número en un
//     círculo azul el que se mira, en azul el de hoy, y un punto debajo de los días con algo.
//   · EL MES CHICO: se abre tocando el mes, como el «Octubre ▾» de Google; un toque en un día lleva a ese día.
//   · LA AGENDA (la Programación de Google): a la izquierda el día («Mié» y el número; hoy, en el círculo azul), a la
//     derecha sus eventos; cuando empieza otro mes, su nombre como banda.
//   · EL DÍA: lo de todo el día arriba (tres, y «N más»), y la grilla de horas con los eventos en su lugar y la línea
//     de ahora. Un toque en una hora vacía crea ahí, como en Google.
//   · EL EVENTO: la tarjeta teñida del color de su calendario con la franja a la izquierda (el prototipo v3), el título
//     y la hora; lo hecho, tachado y más claro (como en escritorio).
// =============================================================================

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  DIAS_CORTOS, INICIALES_DIAS, diaDeLaSemana, fechaLarga, horaGoogle, minutosDelDia, semanasDelMes,
  type ItemCalendario,
} from '@/lib/calendario-modelo';
import { colorDe, tituloDe } from '@/app/calendario/comun';
import { HORA_PX, diaEnGrilla, enRango, lineaDelEvento, type GrupoAgenda, type RangoM } from './modelo';

const conColor = (it: ItemCalendario, extra?: CSSProperties): CSSProperties => ({ '--c': colorDe(it), ...extra } as CSSProperties);

// ── El evento ───────────────────────────────────────────────────────────────────────────────────────────────────────

export function EventoM({ item, tz, onAbrir, compacto = false }: {
  item: ItemCalendario;
  tz: string;
  onAbrir: (it: ItemCalendario) => void;
  /** Una línea (lo de todo el día, arriba del Día). */
  compacto?: boolean;
}) {
  const titulo = tituloDe(item, tz);
  const linea = lineaDelEvento(item, tz);
  return (
    <button type="button" className="m-calendario-ev" style={conColor(item)} aria-label={`${titulo}, ${linea}`}
      data-compacto={compacto ? '' : undefined} data-hecho={item.hecho ? '' : undefined}
      data-tachado={item.hecho || item.google?.rechazado ? '' : undefined} onClick={() => onAbrir(item)}>
      <span className="m-calendario-ev__t">{titulo}</span>
      {!compacto && <span className="m-calendario-ev__c">{linea}</span>}
    </button>
  );
}

// ── La tira de la semana ────────────────────────────────────────────────────────────────────────────────────────────

export function SemanaM({ dias, hoy, elegido, conAlgo, rango, onDia }: {
  dias: string[];
  hoy: string;
  /** El día en el círculo azul (el que se mira; en la Agenda, hoy). */
  elegido: string | null;
  conAlgo: ReadonlySet<string>;
  /** Lo leído: fuera de eso no hay puntos que afirmar, y el día se ve apagado. */
  rango: RangoM;
  onDia: (d: string) => void;
}) {
  return (
    <div className="m-calendario-semana" role="group" aria-label="Semana">
      {dias.map((d) => (
        <button key={d} type="button" className="m-calendario-semana__dia" onClick={() => onDia(d)}
          aria-current={d === elegido ? 'date' : undefined} data-hoy={d === hoy ? '' : undefined}
          data-fuera={enRango(d, rango) ? undefined : ''} aria-label={`${fechaLarga(d)}${conAlgo.has(d) ? ', con eventos' : ''}`}>
          <span className="m-calendario-semana__ini" aria-hidden>{INICIALES_DIAS[diaDeLaSemana(d)]}</span>
          <span className="m-calendario-semana__num" aria-hidden>{Number(d.slice(8))}</span>
          <span className="m-calendario-semana__punto" data-hay={conAlgo.has(d) ? '' : undefined} aria-hidden />
        </button>
      ))}
    </div>
  );
}

// ── El mes chico ────────────────────────────────────────────────────────────────────────────────────────────────────

export function MiniMesM({ mes, hoy, elegido, conAlgo, onDia }: {
  /** Un día del mes que se muestra. */
  mes: string;
  hoy: string;
  elegido: string | null;
  conAlgo: ReadonlySet<string>;
  onDia: (d: string) => void;
}) {
  const ym = mes.slice(0, 7);
  // Las semanas que tocan el mes (de 4 a 6): una fila entera del mes siguiente no aporta nada.
  const semanas = useMemo(() => semanasDelMes(mes).filter((s) => s.some((d) => d.slice(0, 7) === ym)), [mes, ym]);
  return (
    <div className="m-calendario-minimes">
      <div className="m-calendario-minimes__ini" aria-hidden>
        {INICIALES_DIAS.map((x, i) => <span key={i}>{x}</span>)}
      </div>
      {semanas.map((s) => (
        <div key={s[0]} className="m-calendario-minimes__fila">
          {s.map((d) => (
            <button key={d} type="button" className="m-calendario-minimes__dia" onClick={() => onDia(d)}
              aria-current={d === elegido ? 'date' : undefined} data-hoy={d === hoy ? '' : undefined}
              data-afuera={d.slice(0, 7) !== ym ? '' : undefined} aria-label={`${fechaLarga(d)}${conAlgo.has(d) ? ', con eventos' : ''}`}>
              <span className="m-calendario-minimes__num" aria-hidden>{Number(d.slice(8))}</span>
              <span className="m-calendario-semana__punto" data-hay={conAlgo.has(d) ? '' : undefined} aria-hidden />
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── La Agenda ───────────────────────────────────────────────────────────────────────────────────────────────────────

export function AgendaM({ grupos, hoy, tz, onAbrir, onDia }: {
  grupos: GrupoAgenda[];
  hoy: string;
  tz: string;
  onAbrir: (it: ItemCalendario) => void;
  onDia: (d: string) => void;
}) {
  return (
    <div className="m-calendario-agenda">
      {grupos.map((g) => (
        <section key={g.dia} aria-label={fechaLarga(g.dia)}>
          {g.mes && <h2 className="m-calendario-banda">{g.mes}</h2>}
          <div className="m-calendario-grupo" data-hoy={g.dia === hoy ? '' : undefined}>
            <button type="button" className="m-calendario-grupo__dia" onClick={() => onDia(g.dia)} aria-label={`Ver el día: ${fechaLarga(g.dia)}`}>
              <span className="m-calendario-grupo__sem">{DIAS_CORTOS[diaDeLaSemana(g.dia)]}</span>
              <span className="m-calendario-grupo__num">{Number(g.dia.slice(8))}</span>
            </button>
            <div className="m-calendario-grupo__eventos">
              {g.items.map((it) => <EventoM key={it.id} item={it} tz={tz} onAbrir={onAbrir} />)}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}

// ── El Día ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/** El ancho de la columna de las horas (el «9 a.m.» y su margen). */
const COL_HORAS = 52;
/** Lo que asoma arriba de la primera línea: el rótulo de la primera hora no se corta. */
const ARRIBA = 10;
/** Cuántos de todo el día se ven antes del «N más». */
const TOPE_ARRIBA = 3;

const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

/**
 * Los minutos de ahora en la zona del negocio, sólo si el día es hoy. Se calculan DESPUÉS de montar: el server tiene
 * otra hora que el teléfono y el HTML no tiene que llevar una línea que el cliente movería al hidratar.
 */
function useAhoraMin(tz: string, activo: boolean): number | null {
  const [min, setMin] = useState<number | null>(null);
  useEffect(() => {
    // (Un día que no es hoy nunca la tuvo: DiaM se monta de nuevo con cada día, y arranca en null.)
    if (!activo) return;
    const leer = () => setMin(minutosDelDia(new Date().toISOString(), tz));
    const primera = window.setTimeout(leer, 0);
    const t = window.setInterval(leer, 60_000);
    return () => { window.clearTimeout(primera); window.clearInterval(t); };
  }, [tz, activo]);
  return min;
}

export function DiaM({ dia, items, hoy, tz, onAbrir, onCrearEn }: {
  dia: string;
  items: ItemCalendario[];
  hoy: string;
  tz: string;
  onAbrir: (it: ItemCalendario) => void;
  /** Un toque en una hora vacía: crear ahí (minutos desde la medianoche). */
  onCrearEn: (min: number) => void;
}) {
  const ahora = useAhoraMin(tz, dia === hoy);
  const g = useMemo(() => diaEnGrilla(items, dia, tz, ahora), [items, dia, tz, ahora]);
  const [todos, setTodos] = useState(false);
  const arriba = todos || g.arriba.length <= TOPE_ARRIBA ? g.arriba : g.arriba.slice(0, TOPE_ARRIBA - 1);
  const horas = Array.from({ length: g.hasta - g.desde }, (_, i) => g.desde + i);
  const alto = horas.length * HORA_PX + ARRIBA * 2;
  const enVentana = ahora != null && ahora >= g.desde * 60 && ahora < g.hasta * 60;

  return (
    <>
      {g.arriba.length > 0 && (
        <div className="m-calendario-todo">
          {arriba.map((it) => <EventoM key={it.id} item={it} tz={tz} onAbrir={onAbrir} compacto />)}
          {arriba.length < g.arriba.length && (
            <button type="button" className="m-lnk m-calendario-mas" onClick={() => setTodos(true)}>
              {`${g.arriba.length - arriba.length} más`}
            </button>
          )}
        </div>
      )}
      <div className="m-calendario-grilla" style={{ height: alto }}>
        {horas.map((h, i) => (
          <button key={h} type="button" className="m-calendario-hora" style={{ top: ARRIBA + i * HORA_PX, height: HORA_PX }}
            aria-label={`Crear a las ${horaGoogle(hh(h), false)}`} onClick={() => onCrearEn(h * 60)}>
            <span className="m-calendario-hora__rot" aria-hidden>{horaGoogle(hh(h), false)}</span>
          </button>
        ))}
        {g.bloques.map((b) => {
          const titulo = tituloDe(b.item, tz);
          return (
            <button key={b.item.id} type="button" className="m-calendario-ev m-calendario-bloque" onClick={() => onAbrir(b.item)}
              data-hecho={b.item.hecho ? '' : undefined} data-tachado={b.item.hecho || b.item.google?.rechazado ? '' : undefined}
              aria-label={`${titulo}, ${b.rango}`}
              style={conColor(b.item, {
                top: ARRIBA + b.top + 1, height: b.alto - 2,
                left: `calc(${COL_HORAS}px + (100% - ${COL_HORAS}px) * ${b.col / b.cols})`,
                width: `calc((100% - ${COL_HORAS}px) / ${b.cols} - 3px)`,
              })}>
              <span className="m-calendario-ev__t">{titulo}</span>
              <span className="m-calendario-ev__c">{b.rango}</span>
            </button>
          );
        })}
        {enVentana && (
          <div className="m-calendario-ahora" style={{ top: ARRIBA + ((ahora! - g.desde * 60) / 60) * HORA_PX }} aria-hidden />
        )}
      </div>
    </>
  );
}
