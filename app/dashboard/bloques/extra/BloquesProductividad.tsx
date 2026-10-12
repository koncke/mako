'use client';

// =============================================================================
// BloquesProductividad — los bloques de la plantilla «Productividad»
// =============================================================================
// La matriz impacto × esfuerzo, la pirámide de prioridad y «lo que huele mal» de Productivity Analyst
// (app/plan/board/Graphics.tsx), con los números de lib/productividad-metricas.ts —la misma función que
// usa la tab— y los colores con los tokens de la app.
//
// Por qué son bloques: la matriz tiene una cruz fija en 50/50 con sus cuatro cuadrantes; la pirámide va en
// el orden FIJO de las bandas (el agregador ordena por valor y borra la banda en cero); y las listas son
// tareas sueltas con un umbral (7 días quieta, 2 movidas del deadline).

import { useState } from 'react';
import { PLABEL, prioFromScore, type Prio } from '@/app/plan/board/types';
import { CUADRANTE_ROTULO, cuadranteDe, proyectosDelFiltro, type Cuadrante, type DoneFilter } from '@/lib/productividad-metricas';
import type { DatosAtencion, DatosMatriz, DatosPiramide, TareaAtencion } from '@/lib/graficos-bloques-extra-catalogo';
import { NO_ARRASTRAR } from '../piezas';
import { COLOR_PRIO, MONO, Subtitulo, Vacio, suave } from './piezas-extra';

const COLOR_CUADRANTE: Record<Cuadrante, string> = { quick: 'var(--good)', apuesta: 'var(--primary)', relleno: 'var(--faint)', trampa: 'var(--bad)' };

const W = 620, H = 360, ML = 44, MR = 16, MT = 16, MB = 40;
const PW = W - ML - MR, PH = H - MT - MB;
const px = (e: number) => ML + (e / 100) * PW;
const py = (i: number) => MT + (1 - i / 100) * PH;

export function BloqueMatriz({ d }: { d: DatosMatriz }) {
  const [filtro, setFiltro] = useState<DoneFilter>('activos');
  const [hov, setHov] = useState<string | null>(null);
  const proyectos = proyectosDelFiltro(d.proyectos ?? [], filtro);
  const pts = proyectos.filter((p) => p.impacto != null && p.esfuerzo != null);
  const maxT = Math.max(1, ...pts.map((p) => p.tareas));
  const r = (t: number) => 5 + (t / maxT) * 16;
  const hp = pts.find((p) => p.id === hov) ?? null;
  const pildoras = (
    <div className={`bx-pildoras ${NO_ARRASTRAR}`} role="group" aria-label="Mostrar" style={{ alignSelf: 'flex-start' }}>
      {([['activos', 'Activos'], ['completados', 'Completados'], ['todos', 'Todos']] as const).map(([k, l]) => (
        <button key={k} type="button" className="bx-pildora" aria-pressed={filtro === k} onClick={() => setFiltro(k)}>{l}</button>
      ))}
    </div>
  );
  if (!pts.length) {
    return <>{pildoras}<Vacio>Sin impacto ni esfuerzo cargados todavía. Se completan en la próxima priorización.</Vacio></>;
  }
  return (
    <>
      {pildoras}
      <svg className="bx-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Impacto contra esfuerzo, por proyecto">
        <line x1={ML} y1={MT} x2={ML} y2={MT + PH} stroke="var(--border)" />
        <line x1={ML} y1={MT + PH} x2={ML + PW} y2={MT + PH} stroke="var(--border)" />
        <line x1={px(50)} y1={MT} x2={px(50)} y2={MT + PH} stroke="var(--border-strong)" strokeDasharray="4 4" />
        <line x1={ML} y1={py(50)} x2={ML + PW} y2={py(50)} stroke="var(--border-strong)" strokeDasharray="4 4" />
        <text x={ML + 5} y={MT + 12} fontSize={10} fontWeight={700} fill="var(--faint)">QUICK WINS</text>
        <text x={ML + PW - 5} y={MT + 12} fontSize={10} fontWeight={700} fill="var(--faint)" textAnchor="end">APUESTAS</text>
        <text x={ML + 5} y={MT + PH - 6} fontSize={10} fontWeight={700} fill="var(--faint)">RELLENO</text>
        <text x={ML + PW - 5} y={MT + PH - 6} fontSize={10} fontWeight={700} fill="var(--faint)" textAnchor="end">TRAMPAS</text>
        {[0, 50, 100].map((v) => <text key={`x${v}`} x={px(v)} y={MT + PH + 16} fontSize={9.5} fill="var(--faint)" textAnchor="middle">{v}</text>)}
        {[0, 50, 100].map((v) => <text key={`y${v}`} x={ML - 6} y={py(v) + 3} fontSize={9.5} fill="var(--faint)" textAnchor="end">{v}</text>)}
        <text x={ML + PW / 2} y={MT + PH + 32} fontSize={10.5} fill="var(--dim)" textAnchor="middle">Esfuerzo →</text>
        <text x={12} y={MT + PH / 2} fontSize={10.5} fill="var(--dim)" textAnchor="middle" transform={`rotate(-90 12 ${MT + PH / 2})`}>Impacto →</text>
        {pts.map((p) => {
          const c = COLOR_CUADRANTE[cuadranteDe(p.impacto!, p.esfuerzo!)];
          const on = hov === p.id;
          return <circle key={p.id} cx={px(p.esfuerzo!)} cy={py(p.impacto!)} r={r(p.tareas)} fill={c} fillOpacity={on ? 0.85 : 0.45} stroke={c} strokeWidth={on ? 2 : 1.2}
            style={{ cursor: 'pointer' }} onMouseEnter={() => setHov(p.id)} onMouseLeave={() => setHov(null)} />;
        })}
      </svg>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 11.5, color: 'var(--faint)' }}>
        {(Object.keys(COLOR_CUADRANTE) as Cuadrante[]).map((k) => (
          <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: COLOR_CUADRANTE[k] }} />{CUADRANTE_ROTULO[k]}</span>
        ))}
        <span>· tamaño = tareas</span>
      </div>
      <div style={{ minHeight: 20, fontSize: 12.5, color: hp ? 'var(--ink)' : 'var(--faint)' }}>
        {hp ? <span>{hp.emoji} <b style={{ fontWeight: 600 }}>{hp.nombre}</b> — impacto {hp.impacto}, esfuerzo {hp.esfuerzo}, {hp.tareas} tareas</span> : 'Pasa el cursor por una burbuja para ver el proyecto.'}
      </div>
    </>
  );
}

const ORDEN: Prio[] = ['alta', 'media', 'baja', 'futuro'];

export function BloquePiramide({ d }: { d: DatosPiramide }) {
  const pir = d.piramide ?? { alta: 0, media: 0, baja: 0, futuro: 0 };
  if (!d.activas) return <Vacio>No hay tareas activas.</Vacio>;
  const max = Math.max(1, ...ORDEN.map((p) => pir[p] ?? 0));
  const altaPct = Math.round(((pir.alta ?? 0) / d.activas) * 100);
  return (
    <>
      <div className="bx-lista" style={{ gap: 10 }}>
        {ORDEN.map((p) => (
          <div key={p} className="bx-fila">
            <span style={{ width: 70, flex: 'none', fontSize: 12.5, fontWeight: 600, color: COLOR_PRIO[p] }}>{PLABEL[p]}</span>
            <span className="bx-carril" style={{ height: 18 }}><span style={{ width: `${((pir[p] ?? 0) / max) * 100}%`, background: COLOR_PRIO[p], minWidth: pir[p] ? 3 : 0 }} /></span>
            <span className="bx-num" style={{ width: 32, textAlign: 'right', fontWeight: 700, color: 'var(--ink)' }}>{pir[p] ?? 0}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12.5, color: altaPct > 18 ? 'var(--warn)' : 'var(--faint)' }}>
        {altaPct > 18 ? `⚠ ${altaPct}% en Alta: puede estar inflada. Una pirámide sana tiene pocas arriba.` : `${altaPct}% en Alta: foco sano.`}
      </div>
      <span className="bx-linea">{d.activas} tareas activas, sin las que se repiten</span>
    </>
  );
}

function Lista({ titulo, items, vacio, tope, chip }: { titulo: string; items: Array<TareaAtencion & { n?: number }>; vacio: string; tope: number; chip?: (t: TareaAtencion & { n?: number }) => string }) {
  return (
    <div style={{ display: 'grid', gap: 8, alignContent: 'start', minWidth: 0 }}>
      <Subtitulo>{titulo} <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--faint)', fontWeight: 500 }}>{items.length}</span></Subtitulo>
      {!items.length ? <Vacio>{vacio}</Vacio> : (
        <div className="bx-lista">
          {items.slice(0, tope).map((t) => {
            const c = COLOR_PRIO[prioFromScore(t.score)];
            return (
              <div key={t.id} className="bx-fila">
                {chip
                  ? <span className="bx-chip" style={{ color: 'var(--warn)', background: suave('var(--warn)', 14) }}>{chip(t)}</span>
                  : <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: c, flex: 'none' }}>{t.score}</span>}
                <span className="bx-crece" title={t.titulo}>{t.titulo}</span>
                {t.extra && <span className="bx-num">{t.extra}</span>}
              </div>
            );
          })}
          {items.length > tope && <span className="bx-linea">+{items.length - tope} más</span>}
        </div>
      )}
    </div>
  );
}

export function BloqueAtencion({ d }: { d: DatosAtencion }) {
  return (
    <>
      <div className="bx-cols">
        <Lista titulo="Estancadas" items={d.estancadas ?? []} vacio="Nada estancado: todo con actividad reciente." tope={12} />
        <Lista titulo="Alta sin deadline" items={d.altaSinDeadline ?? []} vacio="Toda tarea Alta tiene deadline." tope={12} />
        <Lista titulo="Deadlines que corriste" items={d.corridos ?? []} vacio="Todavía no moviste un deadline dos veces." tope={6} chip={(t) => `${t.n ?? 0}×`} />
      </div>
      {(d.proyectosSinDeadline > 0 || d.tareasSinDeadline > 0) && (
        <span className="bx-linea">{d.proyectosSinDeadline} {d.proyectosSinDeadline === 1 ? 'proyecto' : 'proyectos'} sin deadline · {d.tareasSinDeadline} tareas activas sin fecha</span>
      )}
    </>
  );
}
