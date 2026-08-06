'use client';

// =============================================================================
// ExportarLeadsModal — bajarse los leads, de a UNA pregunta
// =============================================================================
// Mismo formulario que el export del plan (WizardShell, una pregunta por pantalla,
// siempre con opciones para tocar), en vez del botón que bajaba TODO con columnas
// fijas y sin avisar cuántas filas salían:
//   1. ¿Qué leads?    todos · activos · ganados · en nutrición
//   2. ¿Qué datos?    lo habitual arriba; el resto detrás de "Avanzado"
//   3. ¿Qué formato?  planilla (CSV) o documento (Markdown)
// El footer muestra SIEMPRE cuántos leads van a salir: es la única forma de notar
// que el alcance dejó afuera media base.
// =============================================================================

import { useEffect, useState } from 'react';
import { WizardShell } from '../_components/WizardShell';
import { descargar, nombreArchivo } from '../plan/board/exportar';
import { contarLeadsExportAction, exportLeadsAction } from './actions';
import {
  ALCANCES, CAMPOS_LEAD, CAMPOS_LEAD_HABITUALES,
  type AlcanceLeads, type CampoLead, type FormatoLeads,
} from './leads-exportar';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

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

export function ExportarLeadsModal({ onClose }: { onClose: () => void }) {
  const [paso, setPaso] = useState(0);
  const [alcance, setAlcance] = useState<AlcanceLeads>('todos');
  const [campos, setCampos] = useState<Set<CampoLead>>(new Set(CAMPOS_LEAD_HABITUALES));
  const [verAvanzado, setVerAvanzado] = useState(false);
  const [formato, setFormato] = useState<FormatoLeads>('csv');
  const [cuantos, setCuantos] = useState<number | null>(null);
  const [bajando, setBajando] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // El contador se recalcula al cambiar el alcance (lo cuenta el server, no la UI).
  useEffect(() => {
    let vivo = true;
    setCuantos(null);
    contarLeadsExportAction(alcance).then((n) => { if (vivo) setCuantos(n); }).catch(() => { if (vivo) setCuantos(null); });
    return () => { vivo = false; };
  }, [alcance]);

  const PASOS: Array<'alcance' | 'campos' | 'formato'> = ['alcance', 'campos', 'formato'];
  const actual = PASOS[Math.min(paso, PASOS.length - 1)];
  const enUltimo = paso >= PASOS.length - 1;

  const toggleCampo = (c: CampoLead) => { const s = new Set(campos); if (s.has(c)) s.delete(c); else s.add(c); setCampos(s); };

  const bajar = () => {
    setBajando(true);
    setErr(null);
    exportLeadsAction({ alcance, campos: [...campos], formato })
      .then((contenido) => {
        descargar(nombreArchivo('Leads', alcance, formato === 'md' ? 'md' : 'csv'), contenido, formato === 'md' ? 'text/markdown' : 'text/csv');
        onClose();
      })
      .catch((e) => { setErr(e instanceof Error ? e.message : 'No se pudo exportar'); setBajando(false); });
  };

  const cuerpo = () => {
    if (actual === 'alcance') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {ALCANCES.map((a) => <Opcion key={a.id} on={alcance === a.id} titulo={a.label} sub={a.sub} onClick={() => setAlcance(a.id)} />)}
      </div>
    );

    if (actual === 'campos') {
      const habituales = CAMPOS_LEAD.filter((c) => CAMPOS_LEAD_HABITUALES.includes(c.id));
      const resto = CAMPOS_LEAD.filter((c) => !CAMPOS_LEAD_HABITUALES.includes(c.id));
      const todosOn = CAMPOS_LEAD.every((c) => campos.has(c.id));
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setCampos(todosOn ? new Set() : new Set(CAMPOS_LEAD.map((c) => c.id)))}
              style={{ flex: 'none', padding: '7px 11px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: todosOn ? 'var(--primary)' : 'var(--dim)', fontFamily: MONO, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              {todosOn ? 'Ninguno' : 'Todos'}
            </button>
          </div>
          {habituales.map((c) => <Opcion key={c.id} multi on={campos.has(c.id)} titulo={c.label} sub={c.sub} onClick={() => toggleCampo(c.id)} />)}
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

  const pregunta = actual === 'alcance' ? '¿Qué leads querés bajar?'
    : actual === 'campos' ? '¿Qué datos lleva cada fila?'
      : '¿En qué formato?';
  const sub = actual === 'campos' ? 'El ID y el nombre van siempre. Esto es lo demás.' : undefined;
  const resumen = cuantos == null ? 'contando…' : `${cuantos} lead${cuantos === 1 ? '' : 's'}`;
  const hayAlgo = (cuantos ?? 0) > 0;

  return (
    <WizardShell
      titulo={`Exportar leads · ${resumen}`}
      total={PASOS.length} idx={Math.min(paso, PASOS.length - 1)}
      pregunta={pregunta} sub={sub}
      error={err}
      pending={bajando}
      puedeAvanzar={!enUltimo || hayAlgo}
      enUltimo={enUltimo}
      confirmLabel={hayAlgo ? 'Descargar ↓' : 'No hay nada para bajar'}
      atrasLabel={paso === 0 ? 'Cancelar' : 'Atrás'}
      onAtras={() => (paso === 0 ? onClose() : setPaso((p) => p - 1))}
      onSiguiente={() => setPaso((p) => Math.min(p + 1, PASOS.length - 1))}
      onConfirmar={() => { if (hayAlgo && !bajando) bajar(); }}
      onClose={onClose}
      extraFooter={<span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>{resumen}</span>}
    >
      {cuerpo()}
    </WizardShell>
  );
}
