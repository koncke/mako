'use client';

// MakoProyectoModal — "MaKo te ayuda" para PROYECTOS: toma el proyecto actual y MaKo
// propone un nombre + emoji + detalle mejores (editables), que se aplican. Mismo
// patrón que el resultado de crear proyecto. onApply(nombre, emoji, detalle).

import { useEffect, useState, type CSSProperties } from 'react';
import { textareaStyle, inputStyle } from './guardian-form';
import { GuardianIcon } from './GuardianIcon';
import { EmojiPickerMini } from './EmojiPicker';
import { stripHtml } from './RichText';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

async function proponer(descripcion: string): Promise<{ nombre: string; emoji: string; detalle: string }> {
  try {
    const j = await fetch('/api/checklist-coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'proyecto', descripcion, uso: 'MaKo: mejorar proyecto' }) }).then((r) => r.json());
    return j.ok ? { nombre: String(j.nombre || ''), emoji: String(j.emoji || '🏷'), detalle: String(j.detalle || '') } : { nombre: '', emoji: '🏷', detalle: '' };
  } catch { return { nombre: '', emoji: '🏷', detalle: '' }; }
}

export function MakoProyectoModal({ proj, onApply, onClose }: {
  proj: { name: string; emoji: string; detalle: string };
  onApply: (nombre: string, emoji: string, detalle: string) => void; onClose: () => void;
}) {
  const [fase, setFase] = useState<'generando' | 'result'>('generando');
  const [nombre, setNombre] = useState(proj.name);
  const [emoji, setEmoji] = useState(proj.emoji);
  const [detalle, setDetalle] = useState('');

  useEffect(() => {
    let vivo = true;
    (async () => {
      const desc = `Mejorá y completá este proyecto (nombre más claro si hace falta, y un detalle bien escrito). Nombre actual: ${proj.name}. Detalle actual: ${stripHtml(proj.detalle) || '(vacío)'}`;
      const p = await proponer(desc);
      if (!vivo) return;
      setNombre(p.nombre || proj.name); setEmoji(p.emoji || proj.emoji); setDetalle(p.detalle || stripHtml(proj.detalle));
      setFase('result');
    })();
    return () => { vivo = false; };
  }, [proj.name, proj.emoji, proj.detalle]);

  const aplicar = () => { if (nombre.trim()) onApply(nombre.trim(), emoji, detalle.trim()); onClose(); };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 130, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: SANS }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden' }}>
        <div style={{ padding: '26px 26px 10px' }}>
          {fase === 'generando'
            ? <div style={{ padding: '34px 0', textAlign: 'center', color: 'var(--dim)', fontSize: 14 }}><GuardianIcon size={44} /><div style={{ marginTop: 12 }}>MaKo está mejorando el proyecto…</div></div>
            : <>
                <div style={{ textAlign: 'center', marginBottom: 14 }}><GuardianIcon size={44} /><div style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 8, fontFamily: MONO }}>propuesto por MaKo · editá lo que quieras</div></div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <EmojiPickerMini value={emoji} onPick={setEmoji} />
                  <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del proyecto" style={{ ...inputStyle, maxWidth: 320, textAlign: 'center', fontWeight: 600 }} />
                </div>
                <textarea value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder="Detalle del proyecto…" style={{ ...textareaStyle, minHeight: 120 }} />
              </>}
        </div>
        {fase === 'result' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 22px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <button type="button" onClick={onClose} style={ghostBtn}>Cancelar</button>
            <button type="button" onClick={aplicar} disabled={!nombre.trim()} style={{ ...primaryBtn, opacity: nombre.trim() ? 1 : 0.5 }}>Aplicar →</button>
          </div>
        )}
      </div>
    </div>
  );
}

const primaryBtn: CSSProperties = { padding: '11px 22px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: SANS };
const ghostBtn: CSSProperties = { padding: '11px 18px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: SANS };
