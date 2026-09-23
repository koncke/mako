'use client';

// =============================================================================
// CrearProyectoModal — UNA pregunta, y MaKo arma el resto
// =============================================================================
// Era un wizard de CINCO pasos: intro, de qué se trata, qué prioridad (un slider del 1 al
// 100 comparando contra los 70 que ya hay), por qué importa, y una pantalla de confirmación
// para releer lo que acababas de escribir. El reporte, textual (23/09/2026): «la opción de
// crear nuevo proyecto sigue con fricción, revisalo».
//
// Quedó en una pantalla. Lo único obligatorio es de qué se trata; «por qué importa» está
// plegado al lado, porque mejora lo que MaKo escribe pero no hace falta para empezar.
//
// ⚠️ Y LA PRIORIDAD YA NO SE PREGUNTA. Pedirle a alguien que puntúe del 1 al 100 un proyecto
// que todavía no existe es la fricción de la que habla el reporte, y encima es la pregunta
// que peor se contesta: el número sólo significa algo comparado con los otros 70. La pone el
// Perro en la misma corrida en la que escribe el detalle — y si se equivoca, se cambia con
// el lápiz del panel.
//
// Lo que NO cambió: MaKo propone nombre, emoji y detalle, y esa pantalla es EDITABLE. Un
// «¿confirmás?» sobre un texto que no se puede tocar obliga a aceptar lo que está mal y
// arreglarlo después.
// ==============================================================================

import { useEffect, useState, type CSSProperties } from 'react';
import { textareaStyle, inputStyle } from './guardian-form';
import { GuardianIcon } from './GuardianIcon';
import { EmojiPickerMini } from './EmojiPicker';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";
const DRAFT_KEY = 'mako_draft_proyecto';

async function proponer(descripcion: string): Promise<{ nombre: string; emoji: string; detalle: string }> {
  try {
    const j = await fetch('/api/checklist-coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'proyecto', descripcion }) }).then((r) => r.json());
    return j.ok ? { nombre: String(j.nombre || ''), emoji: String(j.emoji || '🏷'), detalle: String(j.detalle || '') } : { nombre: '', emoji: '🏷', detalle: '' };
  } catch { return { nombre: '', emoji: '🏷', detalle: '' }; }
}

export function CrearProyectoModal({ onCrear, onClose }: { onCrear: (nombre: string, emoji: string, detalle: string, score: number) => void; onClose: () => void }) {
  const [desc, setDesc] = useState('');
  // Ya no se pregunta, pero el prompt lo sigue aceptando: si algún día vuelve a haber una
  // fuente para esto (una reunión, un audio), entra por acá sin tocar `generar`.
  const porque = '';
  // El número lo pone el Perro después de crearlo (ver `crearProyecto` en BoardShell): acá
  // nace en el medio de la escala para no inventar una posición.
  const score = 50;
  const [fase, setFase] = useState<'form' | 'generando' | 'result'>('form');
  const [nombre, setNombre] = useState('');
  const [emoji, setEmoji] = useState('🏷');
  const [detalle, setDetalle] = useState('');
  const [restored, setRestored] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try { const raw = localStorage.getItem(DRAFT_KEY); if (raw) { const d = JSON.parse(raw) as { desc?: string }; setDesc(d.desc || ''); } } catch { /* no-op */ }
    setRestored(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!restored) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ desc })); } catch { /* no-op */ }
  }, [restored, desc]);
  const limpiar = () => { try { localStorage.removeItem(DRAFT_KEY); } catch { /* no-op */ } };

  const generar = async () => {
    setFase('generando');
    const descripcion = `${desc.trim()}${porque.trim() ? `\n\nPor qué importa / qué tareas viven aquí: ${porque.trim()}` : ''}`;
    const p = await proponer(descripcion);
    setNombre(p.nombre || desc.trim().slice(0, 30)); setEmoji(p.emoji || '🏷'); setDetalle(p.detalle || desc.trim());
    setFase('result');
  };
  const crear = () => { if (nombre.trim()) onCrear(nombre.trim(), emoji, detalle.trim(), score); limpiar(); onClose(); };


  // ── generando / resultado editable ──
  if (fase !== 'form') {
    return (
      <Shell onClose={onClose}>
        <div style={{ padding: '22px 20px 14px' }}>
          {fase === 'generando'
            ? <div style={{ padding: '34px 0', textAlign: 'center', color: 'var(--dim)', fontSize: 14 }}><div style={{ display: 'flex', justifyContent: 'center' }}><GuardianIcon size={44} /></div><div style={{ marginTop: 12 }}>MaKo está armando el proyecto…</div></div>
            : <>
                <div style={{ textAlign: 'center', marginBottom: 14 }}><div style={{ display: 'flex', justifyContent: 'center' }}><GuardianIcon size={44} /></div><div style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 8, fontFamily: MONO }}>propuesto por MaKo · edita lo que quieras</div></div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <EmojiPickerMini value={emoji} onPick={setEmoji} />
                  <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del proyecto" style={{ ...inputStyle, maxWidth: 320, textAlign: 'center', fontWeight: 600 }} />
                </div>
                <textarea value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder="Detalle del proyecto…" style={{ ...textareaStyle, minHeight: 110 }} />
              </>}
        </div>
        {fase === 'result' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '0 20px 18px' }}>
            <button type="button" onClick={() => setFase('form')} style={ghostBtn}>← Volver</button>
            <button type="button" onClick={crear} disabled={!nombre.trim()} style={{ ...primaryBtn, whiteSpace: 'nowrap', opacity: nombre.trim() ? 1 : 0.5 }}>Crear proyecto</button>
          </div>
        )}
      </Shell>
    );
  }

  // ⚠️ EL MISMO MOLDE QUE «Nueva tarea», HASTA EL PÍXEL. «Revisa el diseño de nuevo
  // proyecto, está mal, en relación al diseño de tarea está feo» (23/09/2026). Eran dos
  // pantallas que hacen exactamente lo mismo —una pregunta y dos botones— dibujadas con dos
  // moldes distintos: header con borde vs sin borde, textarea con caja vs campo con línea
  // abajo, y un pie de dos renglones que aplastaba el botón hasta partirlo en TRES líneas
  // («Armarlo / con / MaKo →»). Mismo header, mismo campo, mismo pie, mismo rótulo.
  return (
    <Shell onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px 0' }}>
        <GuardianIcon size={20} />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Nuevo proyecto</span>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={onClose} aria-label="Cerrar" style={{ border: 'none', background: 'transparent', color: 'var(--faint)', fontSize: 20, lineHeight: 1, cursor: 'pointer', padding: '2px 4px' }}>×</button>
      </div>

      {/* UNA PREGUNTA. Y NADA MÁS: «no quiero la opción de agregar detalles, ni en proyecto
          ni en tareas» (23/09/2026). Lo que MaKo escribe se revisa y se edita en la pantalla
          siguiente, que es donde de verdad se mira. */}
      <div style={{ padding: '14px 20px 18px' }}>
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} autoFocus rows={2}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && desc.trim()) { e.preventDefault(); void generar(); } }}
          placeholder="¿De qué se trata el proyecto?"
          style={{ width: '100%', padding: '11px 0', border: 'none', borderBottom: '2px solid var(--border)', borderRadius: 0, background: 'transparent', color: 'var(--ink)', fontSize: 19, lineHeight: 1.4, outline: 'none', fontFamily: SANS, resize: 'none' }}
          onFocus={(e) => { e.currentTarget.style.borderBottomColor = 'var(--primary)'; }}
          onBlur={(e) => { e.currentTarget.style.borderBottomColor = 'var(--border)'; }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '0 20px 18px' }}>
        <span style={{ fontSize: 12, color: 'var(--faint)' }}>MaKo le pone nombre, emoji, prioridad y detalle.</span>
        <div style={{ display: 'flex', gap: 9, flex: 'none' }}>
          <button type="button" onClick={onClose} style={ghostBtn}>Cancelar</button>
          <button type="button" onClick={() => void generar()} disabled={!desc.trim()}
            style={{ ...primaryBtn, whiteSpace: 'nowrap', opacity: desc.trim() ? 1 : 0.55, cursor: desc.trim() ? 'pointer' : 'default' }}>
            Crear proyecto
          </button>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 130, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: SANS }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden' }}>{children}</div>
    </div>
  );
}

const primaryBtn: CSSProperties = { padding: '11px 22px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: SANS };
const ghostBtn: CSSProperties = { padding: '11px 18px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: SANS };
