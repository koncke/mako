'use client';

// =============================================================================
// TareasCreadasModal — "MaKo cargó tareas al plan" (bienvenida al entrar)
// =============================================================================
// Cuando MaKo/WhatsApp/Fathom crean tareas y el dueño entra al Plan, este modal
// se las muestra CON SU ORIGEN (de dónde salió cada una) ANTES que nada. Se marca
// "visto" por device (no reaparece). Clave cuando se automatiza la carga por Fathom.
// Va coordinado con el DatosModal de deadline (BoardShell lo gatea: no se apilan).

import { createPortal } from 'react-dom';
import { useEffect, type CSSProperties } from 'react';
import { MakoStar } from '../../_components/MakoBrand';
import { fuenteEfectiva, type BoardTask, type Label } from './types';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

// Etiqueta + emoji por tipo de fuente (de dónde salió la tarea).
const FUENTE_INFO: Record<string, { label: string; emoji: string }> = {
  whatsapp: { label: 'WhatsApp', emoji: '💬' },
  fathom: { label: 'Reunión · Fathom', emoji: '🎙️' },
  mako: { label: 'MaKo', emoji: '✨' },
  archivo: { label: 'Archivo', emoji: '📄' },
  'claude-code': { label: 'Claude Code', emoji: '⌨️' },
  retro: { label: 'Retro', emoji: '🔁' },
  experimento: { label: 'Experimento', emoji: '🧪' },
  manual: { label: 'Manual', emoji: '✍️' },
};

export function TareasCreadasModal({ tasks, labelById, onOpen, onClose }: {
  tasks: BoardTask[];
  labelById: (id: string) => Label | null | undefined;
  onOpen: (id: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);

  // Subtítulo: "2 WhatsApp · 1 Reunión · Fathom".
  const porFuente = new Map<string, number>();
  for (const t of tasks) { const f = fuenteEfectiva(t).tipo; porFuente.set(f, (porFuente.get(f) ?? 0) + 1); }
  const resumen = [...porFuente.entries()].map(([f, n]) => `${n} ${FUENTE_INFO[f]?.label ?? f}`).join(' · ');

  const row: CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 11, padding: '11px 13px', borderRadius: 11, border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: SANS };

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 140, background: 'rgba(18,21,27,.44)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Tareas creadas por MaKo"
        style={{ width: 470, maxWidth: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 24px 60px rgba(20,22,27,.24)', animation: 'mkPop .2s cubic-bezier(.2,.7,.3,1)', overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <MakoStar size={22} color="var(--primary)" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16.5, fontWeight: 700, color: 'var(--ink)' }}>MaKo cargó {tasks.length} tarea{tasks.length === 1 ? '' : 's'} al plan</div>
            <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 2 }}>{resumen}</div>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tasks.map((t) => {
            const f = fuenteEfectiva(t);
            const info = FUENTE_INFO[f.tipo] ?? { label: f.tipo, emoji: '•' };
            const proj = t.labels[0] ? labelById(t.labels[0]) : undefined;
            return (
              <button key={t.id} type="button" onClick={() => onOpen(t.id)} style={row}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}>
                <span style={{ fontSize: 17, lineHeight: 1.2, flex: 'none' }}>{info.emoji}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{t.title}</span>
                  <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 7, marginTop: 4 }}>
                    <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '.03em', color: 'var(--primary)', border: '1px solid var(--primary-weak)', borderRadius: 5, padding: '1px 6px' }}>desde {info.label}{f.etiqueta ? ` · ${f.etiqueta}` : ''}</span>
                    {proj && <span style={{ fontSize: 11, fontWeight: 600, color: proj.color, background: proj.color + '14', border: `1px solid ${proj.color}33`, borderRadius: 6, padding: '1px 7px' }}>{proj.emoji} {proj.name}</span>}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <div style={{ padding: '12px 20px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTop: '1px solid var(--border)' }}>
          <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>Tocá una tarea para abrirla</span>
          <button type="button" onClick={onClose} style={{ padding: '9px 18px', borderRadius: 9, border: 'none', background: 'var(--ink)', color: 'var(--surface)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>Listo</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
