'use client';

// =============================================================================
// TemplateDetalleModal — detalle + edición de una plantilla de aviso
// =============================================================================
// Explica CUÁNDO se envía el mensaje (diagrama de flujo) y deja EDITAR el texto
// (override guardado en app_settings, que usa emitirDelCatalogo). Si el aviso
// espera respuesta, el flujo continúa (respuesta del dueño → acción de MaKo).

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { MakoStar } from '../_components/MakoBrand';
import { EMOJI_CATEGORIA, type AvisoCatalogo, type CategoriaAviso } from '@/lib/avisos-catalogo';

const LABEL: Record<CategoriaAviso, string> = { reporte: 'Reporte', aviso: 'Aviso', accion: 'Acción', pregunta: 'Pregunta' };
const IMPL: Record<string, { t: string; c: string }> = { si: { t: 'activo', c: 'var(--good)' }, parcial: { t: 'parcial', c: 'var(--warn)' }, no: { t: 'por venir', c: 'var(--faint)' } };
const btn: CSSProperties = { padding: '9px 16px', borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const btnGhost: CSSProperties = { ...btn, background: 'transparent', color: 'var(--dim)', border: '1px solid var(--border-strong)' };

// Un paso del diagrama de flujo.
function Paso({ icono, titulo, detalle, tono = 'neutro' }: { icono: string; titulo: string; detalle?: string; tono?: 'neutro' | 'mako' | 'dueno' }) {
  const bg = tono === 'mako' ? 'var(--primary-bg)' : tono === 'dueno' ? 'var(--surface-2)' : 'var(--surface-2)';
  const bd = tono === 'mako' ? 'var(--primary-weak)' : 'var(--border)';
  return (
    <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start', padding: '11px 13px', borderRadius: 12, background: bg, border: `1px solid ${bd}` }}>
      <span style={{ fontSize: 18, flex: 'none', lineHeight: 1.2 }}>{icono}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)' }}>{titulo}</div>
        {detalle && <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 2, lineHeight: 1.45 }}>{detalle}</div>}
      </div>
    </div>
  );
}
const Flecha = () => <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--faint)', fontSize: 14, margin: '2px 0' }}>↓</div>;

export function TemplateDetalleModal({ aviso, onClose }: { aviso: AvisoCatalogo; onClose: () => void }) {
  const [texto, setTexto] = useState('');
  const [orig, setOrig] = useState('');
  const [esOverride, setEsOverride] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try { const j = await (await fetch(`/api/admin/plantillas?id=${encodeURIComponent(aviso.id)}`)).json(); if (j.ok) { setTexto(j.texto); setOrig(j.texto); setEsOverride(!!j.esOverride); } } catch { /* noop */ }
  }, [aviso.id]);
  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async () => {
    setBusy(true);
    try { const j = await (await fetch('/api/admin/plantillas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: aviso.id, texto }) })).json(); if (j.ok) { setOrig(texto); setEsOverride(true); setFlash('Guardado ✓'); setTimeout(() => setFlash(null), 2200); } }
    finally { setBusy(false); }
  };
  const resetear = async () => {
    setBusy(true);
    try { const j = await (await fetch('/api/admin/plantillas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: aviso.id, reset: true }) })).json(); if (j.ok) { setTexto(j.texto); setOrig(j.texto); setEsOverride(false); setFlash('Volvió al ejemplo ✓'); setTimeout(() => setFlash(null), 2200); } }
    finally { setBusy(false); }
  };
  const impl = IMPL[aviso.yaImplementado] ?? IMPL.no;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1400, padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, maxHeight: '88vh', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 18, padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 11, alignItems: 'center', minWidth: 0 }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, flex: 'none', background: '#171511', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MakoStar size={18} /></div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{aviso.titulo}</div>
              <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>{EMOJI_CATEGORIA[aviso.categoria]} {LABEL[aviso.categoria]} · <span style={{ color: impl.c }}>{impl.t}</span></div>
            </div>
          </div>
          <button onClick={onClose} title="Cerrar" style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--faint)', cursor: 'pointer', flex: 'none' }}>✕</button>
        </div>

        {/* Diagrama: cuándo se envía */}
        <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 10 }}>¿Cuándo se dispara?</div>
        <div style={{ marginBottom: 20 }}>
          <Paso icono="⚡" titulo="Se dispara cuando…" detalle={aviso.disparador} />
          <Flecha />
          <Paso icono="🧠" titulo="MaKo lo detecta" detalle="El motor de avisos arma el mensaje con los datos reales del evento (nombre, fecha, monto, etc.)." tono="mako" />
          <Flecha />
          <Paso icono="💬" titulo={`MaKo te manda el mensaje${aviso.semaforo !== 'na' ? ` (semáforo ${aviso.semaforo})` : ''}`} detalle="Llega a este grupo de WhatsApp + al feed in-app." tono="mako" />
          {aviso.requiereRespuesta && (
            <>
              <Flecha />
              <Paso icono="🙋" titulo="Vos respondés" detalle="El aviso espera tu OK (o tu respuesta) para seguir." tono="dueno" />
              <Flecha />
              <Paso icono="✅" titulo="MaKo actúa y te confirma" detalle={aviso.categoria === 'accion' ? 'Ejecuta la acción sugerida y te avisa cuando está.' : 'Sigue el flujo según lo que le digas.'} tono="mako" />
            </>
          )}
        </div>

        {/* Editar el mensaje */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)' }}>El mensaje</span>
          {esOverride && <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 5, padding: '1px 6px' }}>editado</span>}
        </div>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={7}
          style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: '11px 13px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontSize: 13.5, fontFamily: "'Geist', sans-serif", lineHeight: 1.5, outline: 'none' }} />
        <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 6, lineHeight: 1.4 }}>
          Es la base con la que MaKo escribe. Los datos de muestra (nombres, montos, fechas) se reemplazan por los reales al dispararse.
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
          {flash && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--good)', marginRight: 'auto' }}>{flash}</span>}
          {esOverride && <button onClick={resetear} disabled={busy} style={{ ...btnGhost, opacity: busy ? 0.5 : 1 }}>Volver al ejemplo</button>}
          <button onClick={guardar} disabled={busy || texto === orig} style={{ ...btn, opacity: busy || texto === orig ? 0.5 : 1 }}>Guardar</button>
        </div>
      </div>
    </div>
  );
}
