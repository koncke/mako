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
  recurrente: { label: 'Se repite', emoji: '⟳' },
};
// Orden en que se muestran los grupos por origen (los no listados van al final).
const ORIGEN_ORDER = ['whatsapp', 'fathom', 'mako', 'archivo', 'experimento', 'retro', 'claude-code', 'manual'];

// Logo real de WhatsApp para el header del grupo (el resto usa su emoji). Inline para
// no depender de BrandDefs (que solo se monta en Integraciones).
function OrigenIcon({ tipo, size = 16 }: { tipo: string; size?: number }) {
  if (tipo === 'whatsapp') return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden style={{ flex: 'none' }}>
      <rect width="24" height="24" rx="6" fill="#25D366" />
      <path fill="#fff" d="M12 5a7 7 0 0 0-5.98 10.62L5 19l3.46-.9A7 7 0 1 0 12 5zm4.06 9.86c-.17.48-1 .92-1.39.95-.38.04-.74.17-2.5-.52-2.1-.83-3.42-2.94-3.52-3.08-.1-.14-.84-1.11-.84-2.12s.53-1.5.72-1.71c.19-.2.41-.25.55-.25h.4c.13 0 .3-.05.46.36l.57 1.37c.05.1.08.22.02.34l-.26.4-.27.3c-.09.09-.18.18-.08.36.1.18.46.76 1 1.23.68.6 1.25.79 1.43.88.18.1.28.08.39-.05l.54-.62c.14-.17.28-.13.47-.07l1.3.62c.19.09.32.14.36.21.05.08.05.44-.12.92z" />
    </svg>
  );
  return <span style={{ fontSize: size - 1, lineHeight: 1 }}>{FUENTE_INFO[tipo]?.emoji ?? '•'}</span>;
}

// Agrupa por origen (sección con 1 header), ordenando por score DESC dentro de cada grupo.
function agrupar<T extends { score: number }>(items: T[], tipoDe: (x: T) => string): Array<{ tipo: string; label: string; items: T[] }> {
  const map = new Map<string, T[]>();
  for (const it of items) { const t = tipoDe(it); (map.get(t) ?? map.set(t, []).get(t)!).push(it); }
  const ord = (t: string) => { const i = ORIGEN_ORDER.indexOf(t); return i < 0 ? 99 : i; };
  return [...map.entries()]
    .sort((a, b) => ord(a[0]) - ord(b[0]) || b[1].length - a[1].length)
    .map(([tipo, arr]) => ({ tipo, label: FUENTE_INFO[tipo]?.label ?? tipo, items: arr.slice().sort((x, y) => y.score - x.score) }));
}

export function TareasCreadasModal({ tasks, projects, proyNuevoIds, renderTaskCard, renderProjCard, onClose }: {
  tasks: BoardTask[];
  projects: Label[];
  /** ids de los proyectos que se CREARON en esta carga (el resto se REUTILIZÓ). */
  proyNuevoIds?: Set<string>;
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

  // Proyectos: se agrupan en NUEVOS vs REUTILIZADOS (lo que pidió Martín), no por
  // origen — así se ve de una qué creó MaKo y a qué proyecto EXISTENTE le sumó tareas.
  // Tareas: por origen (WhatsApp/MaKo/…), ordenadas por prioridad dentro de cada grupo.
  const porScore = (a: { score: number }, b: { score: number }) => b.score - a.score;
  const grupos: Array<{ tipo: string; label: string; items: Array<BoardTask | Label> }> = verProy
    ? [
        { tipo: 'nuevos', label: 'Proyectos nuevos', items: projects.filter((l) => proyNuevoIds?.has(l.id)).slice().sort(porScore) },
        { tipo: 'reutilizados', label: 'Reutilizó (le sumó tareas)', items: projects.filter((l) => !proyNuevoIds?.has(l.id)).slice().sort(porScore) },
      ].filter((g) => g.items.length > 0)
    : agrupar<BoardTask>(tasks, (t) => fuenteEfectiva(t).tipo);

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
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 14px' }}>
          {grupos.map((g) => (
            <div key={g.tipo} style={{ marginBottom: 14 }}>
              {/* Proyectos: header "Nuevos" ✨ / "Reutilizó" ♻️. Tareas: por origen (con logo). */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '2px 4px 9px' }}>
                {verProy
                  ? <span style={{ fontSize: 13 }}>{g.tipo === 'nuevos' ? '✨' : '♻️'}</span>
                  : <OrigenIcon tipo={g.tipo} />}
                <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '.03em', color: g.tipo === 'reutilizados' ? 'var(--dim)' : 'var(--primary)' }}>{verProy ? g.label : `desde ${g.label}`}</span>
                <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>· {g.items.length}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: verProy ? 'repeat(auto-fill, minmax(240px, 1fr))' : 'repeat(auto-fill, minmax(258px, 1fr))', gap: 12, alignContent: 'start', alignItems: 'start' }}>
                {verProy
                  ? (g.items as Label[]).map((l) => <div key={l.id} style={{ minWidth: 0 }}>{renderProjCard(l)}</div>)
                  : (g.items as BoardTask[]).map((t) => <div key={t.id} style={{ minWidth: 0 }}>{renderTaskCard(t)}</div>)}
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '12px 20px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTop: '1px solid var(--border)' }}>
          <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>Toca {verProy ? 'un proyecto' : 'una tarea'} para abrirla</span>
          <button type="button" onClick={onClose} style={{ padding: '9px 18px', borderRadius: 9, border: 'none', background: 'var(--ink)', color: 'var(--surface)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>Listo</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
