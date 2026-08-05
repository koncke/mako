'use client';

// =============================================================================
// ExportarModal — bajarse el tablero, de a UNA pregunta
// =============================================================================
// Antes era un menú desplegable con tres salidas fijas: o te llevabas TODO o nada,
// y el archivo salía sin el ID del proyecto, sin la justificación de prioridad y sin
// las notas — que es justo lo que uno quiere cuando se lleva el plan a otro lado.
//
// Ahora es el mismo formulario que el resto de la app (WizardShell, una pregunta por
// pantalla, siempre con opciones para tocar):
//   1. ¿Qué te llevás?      tareas · proyectos · todo
//   2. ¿De qué proyectos?   todos, o los que elijas (con su P#)
//   3. ¿Qué tareas?         las abiertas · todas · solo las de arriba
//   4. ¿Qué datos?          multi: descripciones, por qué esa prioridad, notas…
//   5. ¿En qué formato?     planilla (CSV) o documento (Markdown)
// Cada paso muestra CUÁNTAS filas van a salir: es la única forma de darse cuenta
// antes de descargar de que el filtro dejó afuera media lista.
// =============================================================================

import { useMemo, useState } from 'react';
import { WizardShell } from '../../_components/WizardShell';
import type { BoardTask, Label } from './types';
import { tareasACSV, proyectosACSV, tableroAMarkdown, descargar, nombreArchivo, CAMPOS_EXTRA, type CampoExtra } from './exportar';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

type Que = 'tareas' | 'proyectos' | 'todo';
type Cuales = 'abiertas' | 'todas' | 'altas';
type Formato = 'csv' | 'md';

/** Una opción clickeable: el mismo botón que usan todos los pasos de la app. */
function Opcion({ on, titulo, sub, onClick, multi = false }: { on: boolean; titulo: string; sub?: string; onClick: () => void; multi?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      style={{ width: '100%', padding: '12px 15px', borderRadius: 12, textAlign: 'left', fontFamily: SANS, display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer', transition: 'border-color .12s, background .12s', border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary-bg)' : 'var(--surface-2)', color: on ? 'var(--primary)' : 'var(--ink)' }}>
      <span style={{ width: 18, height: 18, flex: 'none', borderRadius: multi ? 6 : '50%', border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'transparent', color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{on ? '✓' : ''}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14.5, fontWeight: on ? 700 : 600 }}>{titulo}</span>
        {sub && <span style={{ display: 'block', fontSize: 12, color: 'var(--faint)', marginTop: 1 }}>{sub}</span>}
      </span>
    </button>
  );
}

export function ExportarModal({ tasks, labels, titulo, onClose }: {
  tasks: BoardTask[]; labels: Label[]; titulo: string; onClose: () => void;
}) {
  const [paso, setPaso] = useState(0);
  const [que, setQue] = useState<Que>('todo');
  const [proys, setProys] = useState<string[] | null>(null);   // null = todos
  const [cuales, setCuales] = useState<Cuales>('abiertas');
  const [campos, setCampos] = useState<CampoExtra[]>(['prioridad', 'razonScore', 'detalle', 'deadline', 'checklist']);
  const [formato, setFormato] = useState<Formato>('csv');

  // Lo que de verdad va a salir, recalculado en cada paso: el contador del footer es
  // la única señal de que un filtro dejó afuera media lista.
  const { tareasOut, proyectosOut } = useMemo(() => {
    const enProy = (t: BoardTask) => !proys || t.labels.some((id) => proys.includes(id));
    const pasaEstado = (t: BoardTask) => cuales === 'todas' || (cuales === 'abiertas' ? t.progress < 100 : t.progress < 100 && t.score >= 75);
    const ts = tasks.filter((t) => enProy(t) && pasaEstado(t));
    const ls = labels.filter((l) => !proys || proys.includes(l.id));
    return { tareasOut: ts, proyectosOut: ls };
  }, [tasks, labels, proys, cuales]);

  // El paso de "¿qué tareas?" no tiene sentido si solo se lleva los proyectos.
  const pasos: Array<'que' | 'proyectos' | 'cuales' | 'campos' | 'formato'> =
    que === 'proyectos' ? ['que', 'proyectos', 'campos', 'formato'] : ['que', 'proyectos', 'cuales', 'campos', 'formato'];
  const actual = pasos[Math.min(paso, pasos.length - 1)];
  const enUltimo = paso >= pasos.length - 1;

  const bajar = () => {
    if (formato === 'md') {
      descargar(nombreArchivo(titulo, 'completo', 'md'), tableroAMarkdown(tareasOut, proyectosOut, titulo, campos), 'text/markdown');
    } else if (que === 'proyectos') {
      descargar(nombreArchivo(titulo, 'proyectos', 'csv'), proyectosACSV(proyectosOut, tasks, campos), 'text/csv');
    } else if (que === 'tareas') {
      descargar(nombreArchivo(titulo, 'tareas', 'csv'), tareasACSV(tareasOut, labels, campos), 'text/csv');
    } else {
      // "Todo" en planilla son DOS archivos: una hoja con tareas y proyectos mezclados
      // no se puede filtrar ni sumar, que es para lo único que sirve un CSV.
      descargar(nombreArchivo(titulo, 'tareas', 'csv'), tareasACSV(tareasOut, labels, campos), 'text/csv');
      setTimeout(() => descargar(nombreArchivo(titulo, 'proyectos', 'csv'), proyectosACSV(proyectosOut, tasks, campos), 'text/csv'), 400);
    }
    onClose();
  };

  const toggle = <T,>(arr: T[], v: T): T[] => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const cuerpo = () => {
    if (actual === 'que') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <Opcion on={que === 'todo'} titulo="Todo el plan" sub={`${labels.length} proyectos con sus ${tasks.length} tareas`} onClick={() => setQue('todo')} />
        <Opcion on={que === 'tareas'} titulo="Solo las tareas" sub={`${tasks.length} tarjetas, una por fila`} onClick={() => setQue('tareas')} />
        <Opcion on={que === 'proyectos'} titulo="Solo los proyectos" sub={`${labels.length} con su avance y su prioridad`} onClick={() => setQue('proyectos')} />
      </div>
    );
    if (actual === 'proyectos') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <Opcion on={proys === null} titulo="Todos" sub={`los ${labels.length} proyectos`} onClick={() => setProys(null)} />
        {[...labels].sort((a, b) => b.score - a.score).map((l) => {
          const n = tasks.filter((t) => t.labels.includes(l.id) && t.progress < 100).length;
          return (
            <Opcion key={l.id} multi on={!!proys?.includes(l.id)}
              titulo={`${l.emoji} ${l.name}`}
              sub={`${l.pid ? `${l.pid} · ` : ''}${n} pendiente${n === 1 ? '' : 's'}`}
              onClick={() => setProys((p) => (p === null ? [l.id] : toggle(p, l.id)))} />
          );
        })}
      </div>
    );
    if (actual === 'cuales') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <Opcion on={cuales === 'abiertas'} titulo="Las que faltan" sub="sin las que ya están terminadas" onClick={() => setCuales('abiertas')} />
        <Opcion on={cuales === 'todas'} titulo="Todas" sub="incluidas las hechas, para tener el registro" onClick={() => setCuales('todas')} />
        <Opcion on={cuales === 'altas'} titulo="Solo las de arriba" sub="score 75 o más: lo que el Perro puso primero" onClick={() => setCuales('altas')} />
      </div>
    );
    if (actual === 'campos') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {CAMPOS_EXTRA.map((c) => (
          <Opcion key={c.id} multi on={campos.includes(c.id)} titulo={c.label} sub={c.sub} onClick={() => setCampos((cs) => toggle(cs, c.id))} />
        ))}
      </div>
    );
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <Opcion on={formato === 'csv'} titulo="Planilla (CSV)" sub="para filtrar, ordenar y sumar en Excel o Sheets" onClick={() => setFormato('csv')} />
        <Opcion on={formato === 'md'} titulo="Documento (Markdown)" sub="para leerlo, mandarlo por chat o pegarlo en un doc" onClick={() => setFormato('md')} />
      </div>
    );
  };

  const pregunta = actual === 'que' ? '¿Qué te llevás?'
    : actual === 'proyectos' ? '¿De qué proyectos?'
      : actual === 'cuales' ? '¿Qué tareas?'
        : actual === 'campos' ? '¿Qué datos lleva cada fila?'
          : '¿En qué formato?';
  const sub = actual === 'campos' ? 'El número, el título, el proyecto y el estado van siempre. Esto es lo demás.'
    : actual === 'formato' && que === 'todo' && formato === 'csv' ? 'Van a bajar dos archivos: uno de tareas y otro de proyectos.'
      : undefined;

  // El contador de lo que va a salir, para no descargar a ciegas.
  const resumen = que === 'proyectos'
    ? `${proyectosOut.length} proyecto${proyectosOut.length === 1 ? '' : 's'}`
    : `${tareasOut.length} tarea${tareasOut.length === 1 ? '' : 's'}${que === 'todo' ? ` · ${proyectosOut.length} proyecto${proyectosOut.length === 1 ? '' : 's'}` : ''}`;

  return (
    <WizardShell
      titulo={`Exportar ${titulo} · ${resumen}`}
      total={pasos.length} idx={Math.min(paso, pasos.length - 1)}
      pregunta={pregunta} sub={sub}
      puedeAvanzar={!enUltimo || tareasOut.length + proyectosOut.length > 0}
      enUltimo={enUltimo}
      confirmLabel={tareasOut.length + proyectosOut.length ? 'Descargar ↓' : 'No hay nada para bajar'}
      atrasLabel={paso === 0 ? 'Cancelar' : 'Atrás'}
      onAtras={() => (paso === 0 ? onClose() : setPaso((p) => p - 1))}
      onSiguiente={() => setPaso((p) => Math.min(p + 1, pasos.length - 1))}
      onConfirmar={() => { if (tareasOut.length + proyectosOut.length) bajar(); }}
      onClose={onClose}
      extraFooter={<span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>{resumen}</span>}
    >
      {cuerpo()}
    </WizardShell>
  );
}
