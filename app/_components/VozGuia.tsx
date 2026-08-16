'use client';

// =============================================================================
// VozGuia — "MaKo aprende tu voz" (F3.1). Chip + modal para destilar/editar la
// guía de voz del negocio (de sus anuncios + perfil de marca). La guía alimenta
// el generador de nutrición (F3.2). Autocontenido; admin-only (GET da 403 al
// resto → se oculta).
// =============================================================================

import { useCallback, useEffect, useState, type CSSProperties } from 'react';

async function jget<T>(url: string): Promise<{ status: number; body: T }> {
  const r = await fetch(url, { cache: 'no-store' });
  return { status: r.status, body: (await r.json()) as T };
}
async function jpost<T>(url: string, b: unknown): Promise<T> {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
  return r.json() as Promise<T>;
}

const btnGhost: CSSProperties = { padding: '8px 14px', borderRadius: '10px', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: "'Geist', sans-serif", fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' };

export function VozGuia() {
  const [visible, setVisible] = useState(false);
  const [guia, setGuia] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState('');
  const [busy, setBusy] = useState<'destilar' | 'save' | null>(null);
  const [msg, setMsg] = useState<{ t: 'ok' | 'err'; x: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const { status, body } = await jget<{ ok: boolean; guia: string | null }>('/api/mako/voz');
      if (status === 403) { setVisible(false); return; }
      setVisible(true);
      if (body.ok) { setGuia(body.guia); setEdit(body.guia ?? ''); }
    } catch { /* red → sin chip, no molesta */ }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function destilar() {
    setBusy('destilar'); setMsg(null);
    try {
      const j = await jpost<{ ok: boolean; error?: string; guia: string; fuentes: number }>('/api/mako/voz', { action: 'destilar' });
      if (!j.ok) throw new Error(j.error || 'No se pudo destilar');
      setGuia(j.guia); setEdit(j.guia);
      setMsg({ t: 'ok', x: `Voz aprendida${j.fuentes ? ` de ${j.fuentes} anuncio${j.fuentes > 1 ? 's' : ''}` : ''}. Revisala y ajustala si hace falta.` });
    } catch (e) { setMsg({ t: 'err', x: e instanceof Error ? e.message : String(e) }); }
    finally { setBusy(null); }
  }

  async function guardar() {
    setBusy('save'); setMsg(null);
    try {
      const j = await jpost<{ ok: boolean; error?: string; guia: string }>('/api/mako/voz', { action: 'save', texto: edit });
      if (!j.ok) throw new Error(j.error || 'No se pudo guardar');
      setGuia(j.guia); setMsg({ t: 'ok', x: 'Guardada.' });
    } catch (e) { setMsg({ t: 'err', x: e instanceof Error ? e.message : String(e) }); }
    finally { setBusy(null); }
  }

  if (!visible) return null;

  return (
    <>
      <button onClick={() => { setOpen(true); setMsg(null); }} style={{ ...btnGhost, display: 'inline-flex', alignItems: 'center', gap: '6px', border: '1px solid ' + (guia ? 'var(--good)' : 'var(--border-strong)'), color: guia ? 'var(--good)' : 'var(--dim)' }}
        title={guia ? 'MaKo ya aprendió la voz de tu negocio' : 'Enseñale a MaKo cómo comunica tu negocio'}>
        🗣️ Voz {guia ? '✓' : ''}
      </button>

      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: '16px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <div style={{ fontSize: '19px', fontWeight: 600, color: 'var(--ink)' }}>La voz de tu negocio</div>
              <button onClick={() => setOpen(false)} title="Cerrar" style={{ background: 'none', border: 'none', fontSize: '20px', color: 'var(--faint)', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ fontSize: '13.5px', color: 'var(--dim)', lineHeight: 1.5, marginBottom: '16px' }}>
              MaKo aprende cómo comunicás — de las transcripciones de tus anuncios y de tu perfil de marca — y con eso escribe tu nutrición para que suene a vos, no a un bot. Revisala y ajustá lo que quieras.
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <button onClick={() => void destilar()} disabled={busy !== null} style={{ padding: '9px 16px', borderRadius: '10px', border: 'none', background: 'var(--accent-soft)', color: '#171511', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
                {busy === 'destilar' ? 'Aprendiendo…' : guia ? '✨ Volver a aprender' : '✨ MaKo aprende mi voz'}
              </button>
            </div>

            {msg && <div style={{ marginBottom: '12px', padding: '9px 12px', borderRadius: '9px', fontSize: '13px', border: '1px solid ' + (msg.t === 'ok' ? 'var(--good)' : 'var(--bad)'), background: msg.t === 'ok' ? 'var(--good-bg)' : 'var(--bad-bg)', color: msg.t === 'ok' ? 'var(--good)' : 'var(--bad)' }}>{msg.x}</div>}

            <textarea value={edit} onChange={(e) => setEdit(e.target.value)} placeholder="Todavía no aprendí tu voz. Tocá «MaKo aprende mi voz» — o escribila vos a mano." rows={14}
              style={{ width: '100%', resize: 'vertical', padding: '12px 14px', borderRadius: '11px', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', lineHeight: 1.55, outline: 'none' }} />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
              <button onClick={() => setOpen(false)} style={btnGhost}>Cerrar</button>
              <button onClick={() => void guardar()} disabled={busy !== null || !edit.trim() || edit.trim() === (guia ?? '')} style={{ padding: '9px 16px', borderRadius: '10px', border: 'none', background: 'var(--ink)', color: 'var(--on-ink)', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', opacity: busy || !edit.trim() || edit.trim() === (guia ?? '') ? 0.5 : 1 }}>{busy === 'save' ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
