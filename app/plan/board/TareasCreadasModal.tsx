'use client';

// =============================================================================
// TareasCreadasModal — "MaKo cargó tareas al plan" (bienvenida al entrar)
// =============================================================================
// Preview en DOS tabs: Tareas y Proyectos. Las cards son EXACTAMENTE las mismas del
// kanban (CardTile) y de la vista Proyectos (ProyectoCardTile) — BoardShell las pasa
// como render props, así no hay dos diseños distintos. Los proyectos van con
// verDetalle=true (muestran descripción + razón del Perro). Tocás una y se abre su
// detalle; BoardShell mantiene el modal detrás → al cerrarlo, volvés acá.

import { createPortal } from 'react-dom';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { MakoStar } from '../../_components/MakoBrand';
import { fuenteEfectiva, type BoardTask, type Label } from './types';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

const FUENTE_INFO: Record<string, { label: string; emoji: string }> = {
  whatsapp: { label: 'WhatsApp', emoji: '💬' }, fathom: { label: 'Reunión · Fathom', emoji: '🎙️' },
  mako: { label: 'MaKo', emoji: '✨' }, archivo: { label: 'Archivo', emoji: '📄' },
  'claude-code': { label: 'Claude Code', emoji: '⌨️' }, retro: { label: 'Retro', emoji: '🔁' },
  experimento: { label: 'Experimento', emoji: '🧪' }, manual: { label: 'Manual', emoji: '✍️' },
};

export function TareasCreadasModal({ tasks, projects, renderTaskCard, renderProjCard, onClose }: {
  tasks: BoardTask[];
  projects: Label[];
  renderTaskCard: (t: BoardTask) => ReactNode; // CardTile real (kanban), lo pasa BoardShell
  renderProjCard: (l: Label) => ReactNode;      // ProyectoCardTile real, lo pasa BoardShell
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'tareas' | 'proyectos'>('tareas');
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);

  const porFuente = new Map<string, number>();
  for (const t of tasks) { const f = fuenteEfectiva(t).tipo; porFuente.set(f, (porFuente.get(f) ?? 0) + 1); }
  const resumen = [...porFuente.entries()].map(([f, n]) => `${n} ${FUENTE_INFO[f]?.label ?? f}`).join(' · ');
  const hayProy = projects.length > 0;
  const verProy = tab === 'proyectos' && hayProy;

  const chip: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '.03em', color: 'var(--primary)', border: '1px solid var(--primary-weak)', borderRadius: 6, padding: '2px 7px', marginBottom: 6 };
  const tabBtn = (activo: boolean): CSSProperties => ({ padding: '7px 14px', borderRadius: 9, border: 'none', background: activo ? 'var(--primary-bg)' : 'transparent', color: activo ? 'var(--primary)' : 'var(--dim)', fontSize: 13, fontWeight: activo ? 700 : 500, cursor: 'pointer', fontFamily: SANS });

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 140, background: 'rgba(18,21,27,.44)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Lo que cargó MaKo"
        style={{ width: 680, maxWidth: '100%', maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 24px 60px rgba(20,22,27,.24)', overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <MakoStar size={22} color="var(--primary)" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16.5, fontWeight: 700, color: 'var(--ink)' }}>MaKo cargó {tasks.length} tarea{tasks.length === 1 ? '' : 's'}{hayProy ? ` en ${projects.length} proyecto${projects.length === 1 ? '' : 's'}` : ''}</div>
            <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 2 }}>{resumen}</div>
          </div>
        </div>
        {hayProy && (
          <div style={{ display: 'flex', gap: 6, padding: '0 20px 10px' }}>
            <button onClick={() => setTab('tareas')} style={tabBtn(tab === 'tareas')}>Tareas · {tasks.length}</button>
            <button onClick={() => setTab('proyectos')} style={tabBtn(tab === 'proyectos')}>Proyectos · {projects.length}</button>
          </div>
        )}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 10px', display: 'grid', gridTemplateColumns: verProy ? 'repeat(auto-fill, minmax(240px, 1fr))' : 'repeat(auto-fill, minmax(258px, 1fr))', gap: 12, alignContent: 'start', alignItems: 'start' }}>
          {verProy
            ? projects.map((l) => <div key={l.id}>{renderProjCard(l)}</div>)
            : tasks.map((t) => {
                const f = fuenteEfectiva(t);
                const info = FUENTE_INFO[f.tipo] ?? { label: f.tipo, emoji: '•' };
                return (
                  <div key={t.id} style={{ minWidth: 0 }}>
                    <span style={chip}>{info.emoji} desde {info.label}{f.etiqueta ? ` · ${f.etiqueta}` : ''}</span>
                    {renderTaskCard(t)}
                  </div>
                );
              })}
        </div>
        <div style={{ padding: '12px 20px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTop: '1px solid var(--border)' }}>
          <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>Tocá {verProy ? 'un proyecto' : 'una tarea'} para abrirla</span>
          <button type="button" onClick={onClose} style={{ padding: '9px 18px', borderRadius: 9, border: 'none', background: 'var(--ink)', color: 'var(--surface)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>Listo</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
