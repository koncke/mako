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
//   1. ¿Qué querés descargar?  tareas · proyectos · ambos
//   2. ¿De qué proyectos?      con buscador, orden y "Todos" como CONTROL de barra
//   3. ¿Qué tareas?            las que faltan · todas · solo las prioritarias · a mano
//   3b. (si "a mano")          la lista completa, buscable
//   4. ¿Qué datos?             lo normal arriba; el resto detrás de "Avanzado"
//   5. ¿En qué formato?        planilla (CSV) o documento (Markdown)
// Cada paso muestra CUÁNTAS filas van a salir: es la única forma de darse cuenta
// antes de descargar de que el filtro dejó afuera media lista.
// =============================================================================

import { useMemo, useState } from 'react';
import { WizardShell } from '../../_components/WizardShell';
import { ListaElegible, type ItemElegible } from './ListaElegible';
import type { BoardTask, Label } from './types';
import { tareasACSV, proyectosACSV, tableroAMarkdown, descargar, nombreArchivo, CAMPOS_EXTRA, CAMPOS_HABITUALES, type CampoExtra } from './exportar';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

type Que = 'tareas' | 'proyectos' | 'ambos';
type Cuales = 'abiertas' | 'todas' | 'altas' | 'mano';
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
  const [que, setQue] = useState<Que>('ambos');
  const [proys, setProys] = useState<Set<string>>(new Set(labels.map((l) => l.id)));
  const [cuales, setCuales] = useState<Cuales>('abiertas');
  const [aMano, setAMano] = useState<Set<string>>(new Set());
  const [campos, setCampos] = useState<Set<CampoExtra>>(new Set(CAMPOS_HABITUALES));
  const [verAvanzado, setVerAvanzado] = useState(false);
  const [formato, setFormato] = useState<Formato>('csv');

  // Lo que de verdad va a salir, recalculado en cada paso: el contador del footer es
  // la única señal de que un filtro dejó afuera media lista.
  const { tareasOut, proyectosOut, enProyecto } = useMemo(() => {
    const enProy = (t: BoardTask) => t.labels.some((id) => proys.has(id)) || (t.labels.length === 0 && proys.size === labels.length);
    const candidatas = tasks.filter(enProy);
    const ts = cuales === 'mano'
      ? candidatas.filter((t) => aMano.has(t.id))
      : candidatas.filter((t) => (cuales === 'todas' ? true : cuales === 'abiertas' ? t.progress < 100 : t.progress < 100 && t.score >= 75));
    return { tareasOut: ts, proyectosOut: labels.filter((l) => proys.has(l.id)), enProyecto: candidatas };
  }, [tasks, labels, proys, cuales, aMano]);

  // Los pasos que de verdad aplican. "¿Qué tareas?" no existe si solo van proyectos, y
  // la lista a mano solo aparece si la pediste.
  const pasos = useMemo(() => {
    const p: Array<'que' | 'proyectos' | 'cuales' | 'mano' | 'campos' | 'formato'> = ['que', 'proyectos'];
    if (que !== 'proyectos') { p.push('cuales'); if (cuales === 'mano') p.push('mano'); }
    p.push('campos', 'formato');
    return p;
  }, [que, cuales]);
  const actual = pasos[Math.min(paso, pasos.length - 1)];
  const enUltimo = paso >= pasos.length - 1;

  // Qué se eligió, en dos o tres palabras, para que el archivo se distinga en Descargas:
  // «anuncios», «anuncios-y-2-mas», «12-tareas», «prioritarias».
  const queElegi = useMemo((): string => {
    const nProy = proys.size;
    const todosLosProy = nProy === 0 || nProy === labels.length;
    const partes: string[] = [];
    if (!todosLosProy) {
      const primero = labels.find((l) => proys.has(l.id))?.name ?? '';
      partes.push(nProy === 1 ? primero : `${primero} y ${nProy - 1} mas`);
    }
    if (cuales === 'altas') partes.push('prioritarias');
    else if (cuales === 'abiertas') partes.push('pendientes');
    else if (cuales === 'mano') partes.push(`${aMano.size} elegidas`);
    if (!partes.length) partes.push('todo');
    return partes.join('-');
  }, [proys, labels, cuales, aMano]);

  const bajar = () => {
    const cs = [...campos];
    if (formato === 'md') {
      descargar(nombreArchivo(titulo, 'completo', 'md', queElegi), tableroAMarkdown(tareasOut, proyectosOut, titulo, cs), 'text/markdown');
    } else if (que === 'proyectos') {
      descargar(nombreArchivo(titulo, 'proyectos', 'csv', queElegi), proyectosACSV(proyectosOut, tasks, cs), 'text/csv');
    } else if (que === 'tareas') {
      descargar(nombreArchivo(titulo, 'tareas', 'csv', queElegi), tareasACSV(tareasOut, labels, cs), 'text/csv');
    } else {
      // "Ambos" en planilla son DOS archivos: una hoja con tareas y proyectos mezclados
      // no se puede filtrar ni sumar, que es para lo único que sirve un CSV.
      descargar(nombreArchivo(titulo, 'tareas', 'csv', queElegi), tareasACSV(tareasOut, labels, cs), 'text/csv');
      setTimeout(() => descargar(nombreArchivo(titulo, 'proyectos', 'csv', queElegi), proyectosACSV(proyectosOut, tasks, cs), 'text/csv'), 400);
    }
    onClose();
  };

  const toggleCampo = (c: CampoExtra) => { const s = new Set(campos); if (s.has(c)) s.delete(c); else s.add(c); setCampos(s); };
  const nombreProy = (t: BoardTask) => t.labels.map((id) => labels.find((l) => l.id === id)?.name).filter(Boolean).join(' · ');

  const cuerpo = () => {
    if (actual === 'que') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <Opcion on={que === 'tareas'} titulo="Tareas" sub={`${tasks.length} tarjetas, una por fila`} onClick={() => setQue('tareas')} />
        <Opcion on={que === 'proyectos'} titulo="Proyectos" sub={`${labels.length} con su avance y su prioridad`} onClick={() => setQue('proyectos')} />
        <Opcion on={que === 'ambos'} titulo="Ambos" sub="los proyectos y sus tareas" onClick={() => setQue('ambos')} />
      </div>
    );

    if (actual === 'proyectos') {
      const items: ItemElegible[] = [...labels].map((l) => {
        const n = tasks.filter((t) => t.labels.includes(l.id) && t.progress < 100).length;
        return { id: l.id, titulo: `${l.emoji} ${l.name}`, sub: `${l.pid ? `${l.pid} · ` : ''}${n} pendiente${n === 1 ? '' : 's'}`, buscarPor: `${l.pid ?? ''} ${(l.pid ?? '').replace(/^P/i, '')}`, peso: l.score };
      });
      return <ListaElegible items={items} sel={proys} onSel={setProys} placeholder="Buscar proyecto o P#…" altura={320} />;
    }

    if (actual === 'cuales') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <Opcion on={cuales === 'abiertas'} titulo="Las que faltan" sub="sin las que ya están terminadas" onClick={() => setCuales('abiertas')} />
        <Opcion on={cuales === 'todas'} titulo="Todas" sub="incluidas las hechas, para tener el registro" onClick={() => setCuales('todas')} />
        <Opcion on={cuales === 'altas'} titulo="Solo las prioritarias" sub="score 75 o más: lo que el Perro puso primero" onClick={() => setCuales('altas')} />
        <Opcion on={cuales === 'mano'} titulo="Las elijo a mano" sub="te muestro la lista y marcas las que quieras" onClick={() => { setCuales('mano'); if (!aMano.size) setAMano(new Set(enProyecto.filter((t) => t.progress < 100).map((t) => t.id))); }} />
      </div>
    );

    if (actual === 'mano') {
      const items: ItemElegible[] = enProyecto.map((t) => ({
        id: t.id,
        titulo: `#${t.num} ${t.title}`,
        sub: `${nombreProy(t) || 'sin proyecto'} · ${t.progress >= 100 ? 'hecha' : `${t.score}`}`,
        buscarPor: `${t.num} ${t.detalle ?? ''}`,
        peso: t.score,
      }));
      return <ListaElegible items={items} sel={aMano} onSel={setAMano} placeholder="Buscar tarea o #número…" altura={340} />;
    }

    if (actual === 'campos') {
      const habituales = CAMPOS_EXTRA.filter((c) => CAMPOS_HABITUALES.includes(c.id));
      const resto = CAMPOS_EXTRA.filter((c) => !CAMPOS_HABITUALES.includes(c.id));
      const todosOn = CAMPOS_EXTRA.every((c) => campos.has(c.id));
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setCampos(todosOn ? new Set() : new Set(CAMPOS_EXTRA.map((c) => c.id)))}
              style={{ flex: 'none', padding: '7px 11px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: todosOn ? 'var(--primary)' : 'var(--dim)', fontFamily: MONO, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              {todosOn ? 'Ninguno' : 'Todos'}
            </button>
          </div>
          {habituales.map((c) => <Opcion key={c.id} multi on={campos.has(c.id)} titulo={c.label} sub={c.sub} onClick={() => toggleCampo(c.id)} />)}
          {/* Lo que casi nadie necesita, plegado. Con los ocho a la vista el paso se
              leía como una lista de configuración y no como una pregunta. */}
          <button type="button" onClick={() => setVerAvanzado((v) => !v)}
            style={{ alignSelf: 'flex-start', border: 'none', background: 'transparent', color: 'var(--dim)', fontFamily: MONO, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', padding: '4px 0' }}>
            {verAvanzado ? '▾ Avanzado' : `▸ Avanzado (${resto.length})`}
          </button>
          {verAvanzado && resto.map((c) => <Opcion key={c.id} multi on={campos.has(c.id)} titulo={c.label} sub={c.sub} onClick={() => toggleCampo(c.id)} />)}
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <Opcion on={formato === 'csv'} titulo="Planilla (CSV)" sub="para filtrar, ordenar y sumar en Excel o Sheets" onClick={() => setFormato('csv')} />
        <Opcion on={formato === 'md'} titulo="Documento (Markdown)" sub="para leerlo, mandarlo por chat o pegarlo en un doc" onClick={() => setFormato('md')} />
      </div>
    );
  };

  const pregunta = actual === 'que' ? '¿Qué quieres descargar?'
    : actual === 'proyectos' ? '¿De qué proyectos?'
      : actual === 'cuales' ? '¿Qué tareas?'
        : actual === 'mano' ? '¿Cuáles te llevas?'
          : actual === 'campos' ? '¿Qué datos lleva cada fila?'
            : '¿En qué formato?';
  const sub = actual === 'campos' ? 'El número, el título, el proyecto y el estado van siempre. Esto es lo demás.'
    : actual === 'formato' && que === 'ambos' && formato === 'csv' ? 'Van a bajar dos archivos: uno de tareas y otro de proyectos.'
      : undefined;

  const resumen = que === 'proyectos'
    ? `${proyectosOut.length} proyecto${proyectosOut.length === 1 ? '' : 's'}`
    : `${tareasOut.length} tarea${tareasOut.length === 1 ? '' : 's'}${que === 'ambos' ? ` · ${proyectosOut.length} proyecto${proyectosOut.length === 1 ? '' : 's'}` : ''}`;
  const hayAlgo = que === 'proyectos' ? proyectosOut.length > 0 : tareasOut.length > 0;

  return (
    <WizardShell
      titulo={`Exportar ${titulo} · ${resumen}`}
      total={pasos.length} idx={Math.min(paso, pasos.length - 1)}
      pregunta={pregunta} sub={sub}
      // Más ancho que el default: los pasos de lista muestran títulos largos y con
      // 560 se cortaban a la mitad.
      ancho={760}
      puedeAvanzar={!enUltimo || hayAlgo}
      enUltimo={enUltimo}
      confirmLabel={hayAlgo ? 'Descargar ↓' : 'No hay nada para bajar'}
      atrasLabel={paso === 0 ? 'Cancelar' : 'Atrás'}
      onAtras={() => (paso === 0 ? onClose() : setPaso((p) => p - 1))}
      onSiguiente={() => setPaso((p) => Math.min(p + 1, pasos.length - 1))}
      onConfirmar={() => { if (hayAlgo) bajar(); }}
      onClose={onClose}
      extraFooter={<span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>{resumen}</span>}
    >
      {cuerpo()}
    </WizardShell>
  );
}
