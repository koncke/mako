'use client';

// =============================================================================
// TareasCreadasModal — "MaKo cargó tareas al plan" (bienvenida al entrar)
// =============================================================================
// Preview de lo que MaKo creó, en DOS tabs: Tareas (cards estilo kanban) y Proyectos
// (cards estilo vista Proyectos, más alargadas). Cada card muestra lo importante: la
// descripción, POR QUÉ esa prioridad (razón del Perro) y la checklist. Tocar una abre
// su detalle; BoardShell mantiene este modal detrás → al cerrar el detalle, vuelve acá.

import { createPortal } from 'react-dom';
import { useEffect, useState, type CSSProperties } from 'react';
import { MakoStar } from '../../_components/MakoBrand';
import { fuenteEfectiva, prioFromScore, PCOLOR, PLABEL, pidDe, type BoardTask, type Label } from './types';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";
const stripHtml = (s: string) => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const FUENTE_INFO: Record<string, { label: string; emoji: string }> = {
  whatsapp: { label: 'WhatsApp', emoji: '💬' }, fathom: { label: 'Reunión · Fathom', emoji: '🎙️' },
  mako: { label: 'MaKo', emoji: '✨' }, archivo: { label: 'Archivo', emoji: '📄' },
  'claude-code': { label: 'Claude Code', emoji: '⌨️' }, retro: { label: 'Retro', emoji: '🔁' },
  experimento: { label: 'Experimento', emoji: '🧪' }, manual: { label: 'Manual', emoji: '✍️' },
};

function PrioBadge({ score }: { score: number }) {
  const p = prioFromScore(score);
  return <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: PCOLOR[p], background: PCOLOR[p] + '18', border: `1px solid ${PCOLOR[p]}44`, borderRadius: 6, padding: '1px 7px', flex: 'none' }}>{PLABEL[p]} · {score}</span>;
}

const razon: CSSProperties = { fontSize: 11.5, color: 'var(--faint)', fontStyle: 'italic', lineHeight: 1.45 };
const desc: CSSProperties = { fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 };
const cardBtn: CSSProperties = { textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 7, fontFamily: SANS, width: '100%' };

function TaskCard({ t, onOpen }: { t: BoardTask; onOpen: () => void }) {
  const f = fuenteEfectiva(t);
  const info = FUENTE_INFO[f.tipo] ?? { label: f.tipo, emoji: '•' };
  const clDone = t.checklist.filter((c) => c.done).length;
  return (
    <button onClick={onOpen} style={{ ...cardBtn, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 11, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ fontSize: 16, lineHeight: 1 }}>{t.emoji || '📌'}</span>
        <span style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)' }}>#{t.num}</span>
        <span style={{ flex: 1 }} />
        <PrioBadge score={t.score} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>{t.title}</div>
      {t.detalle && <div style={desc}>{stripHtml(t.detalle)}</div>}
      {t.scoreRazon && <div style={razon}>🐕 {t.scoreRazon}</div>}
      {t.checklist.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 1 }}>
          <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 700 }}>Checklist {clDone}/{t.checklist.length}</span>
          {t.checklist.slice(0, 6).map((c) => <div key={c.id} style={{ fontSize: 12, color: c.done ? 'var(--faint)' : 'var(--dim)', display: 'flex', gap: 6 }}><span>{c.done ? '☑' : '☐'}</span><span style={{ textDecoration: c.done ? 'line-through' : 'none' }}>{c.text}</span></div>)}
          {t.checklist.length > 6 && <span style={{ fontSize: 11, color: 'var(--faint)' }}>+{t.checklist.length - 6} más</span>}
        </div>
      )}
      <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: 'var(--primary)', border: '1px solid var(--primary-weak)', borderRadius: 5, padding: '1px 6px', alignSelf: 'flex-start', marginTop: 2 }}>desde {info.label}{f.etiqueta ? ` · ${f.etiqueta}` : ''}</span>
    </button>
  );
}

function ProjCard({ l, i, onOpen }: { l: Label; i: number; onOpen: () => void }) {
  return (
    <button onClick={onOpen} style={{ ...cardBtn, background: 'var(--surface)', border: '1px solid var(--border)', borderTop: `3px solid ${l.color}`, borderRadius: 14, padding: '15px 16px', minHeight: 190 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 22, lineHeight: 1 }}>{l.emoji || '📁'}</span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>{pidDe(l, i)}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 700, color: l.color, background: l.color + '18', border: `1px solid ${l.color}44`, borderRadius: 6, padding: '1px 7px' }}>{l.score}/100</span>
      </div>
      <div style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>{l.name}</div>
      {l.detalle && <div style={desc}>{stripHtml(l.detalle)}</div>}
      {l.scoreRazon && <div style={razon}>🐕 {l.scoreRazon}</div>}
    </button>
  );
}

export function TareasCreadasModal({ tasks, projects, onOpenTask, onOpenProj, onClose }: {
  tasks: BoardTask[];
  projects: Label[];
  onOpenTask: (id: string) => void;
  onOpenProj: (id: string) => void;
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

  const tabBtn = (activo: boolean): CSSProperties => ({ padding: '7px 14px', borderRadius: 9, border: 'none', background: activo ? 'var(--primary-bg)' : 'transparent', color: activo ? 'var(--primary)' : 'var(--dim)', fontSize: 13, fontWeight: activo ? 700 : 500, cursor: 'pointer', fontFamily: SANS });

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 140, background: 'rgba(18,21,27,.44)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Lo que cargó MaKo"
        style={{ width: 660, maxWidth: '100%', maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 24px 60px rgba(20,22,27,.24)', overflow: 'hidden' }}>
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
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 10px', display: 'grid', gridTemplateColumns: verProy ? 'repeat(auto-fill, minmax(280px, 1fr))' : 'repeat(auto-fill, minmax(258px, 1fr))', gap: 12, alignContent: 'start' }}>
          {verProy
            ? projects.map((l, i) => <ProjCard key={l.id} l={l} i={i} onOpen={() => onOpenProj(l.id)} />)
            : tasks.map((t) => <TaskCard key={t.id} t={t} onOpen={() => onOpenTask(t.id)} />)}
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
