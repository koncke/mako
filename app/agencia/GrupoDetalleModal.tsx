'use client';

// =============================================================================
// GrupoDetalleModal — el "detalle del grupo" (como en WhatsApp): editar foto,
// nombre, descripción y participantes. Se abre desde la topbar del chat.
// =============================================================================

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { MakoStar } from '../_components/MakoBrand';

type Info = { jid: string; subject: string; descripcion: string; foto: string | null; participantes: Array<{ numero: string; admin: boolean }> };

async function post(body: unknown): Promise<boolean> {
  try { const j = await (await fetch('/api/admin/mako-chats/grupo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json(); return !!j.ok; } catch { return false; }
}
const btn: React.CSSProperties = { padding: '8px 15px', borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const btnGhost: React.CSSProperties = { ...btn, background: 'transparent', color: 'var(--dim)', border: '1px solid var(--border-strong)' };
const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontSize: 13.5, fontFamily: "'Geist', sans-serif", outline: 'none' };

export function GrupoDetalleModal({ jid, onClose, onCambio }: { jid: string; onClose: () => void; onCambio?: () => void }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [subject, setSubject] = useState('');
  const [desc, setDesc] = useState('');
  const [nuevoNum, setNuevoNum] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const cargar = useCallback(async () => {
    try {
      const j = await (await fetch(`/api/admin/mako-chats/grupo?jid=${encodeURIComponent(jid)}`)).json();
      if (j.ok) { setInfo(j.info as Info); setSubject(j.info.subject); setDesc(j.info.descripcion); }
    } catch { /* noop */ }
  }, [jid]);
  useEffect(() => { cargar(); }, [cargar]);

  const flashOk = (m: string) => { setFlash(m); setTimeout(() => setFlash(null), 2200); };
  const guardarNombre = async () => { setBusy('nombre'); if (await post({ jid, action: 'nombre', subject })) { flashOk('Nombre actualizado ✓'); onCambio?.(); } setBusy(null); };
  const guardarDesc = async () => { setBusy('desc'); if (await post({ jid, action: 'descripcion', descripcion: desc })) flashOk('Descripción actualizada ✓'); setBusy(null); };
  const agregar = async () => { const n = nuevoNum.replace(/\D/g, ''); if (!n) return; setBusy('add'); if (await post({ jid, action: 'add', numeros: [n] })) { setNuevoNum(''); await cargar(); flashOk('Número agregado ✓'); } else flashOk('No se pudo agregar'); setBusy(null); };
  const quitar = async (num: string) => { setBusy('rm' + num); if (await post({ jid, action: 'remove', numeros: [num] })) await cargar(); setBusy(null); };
  const cambiarFoto = async (f: File | null) => {
    if (!f) return;
    setBusy('foto');
    try {
      const b64 = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f); });
      if (await post({ jid, action: 'foto', base64: b64 })) { flashOk('Foto actualizada ✓'); onCambio?.(); await cargar(); }
    } finally { setBusy(null); }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1400, padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, maxHeight: '86vh', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 18, padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>Detalle del grupo</div>
          <button onClick={onClose} title="Cerrar" style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--faint)', cursor: 'pointer' }}>✕</button>
        </div>

        {/* Foto + nombre */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <button onClick={() => fileRef.current?.click()} disabled={busy === 'foto'} title="Cambiar foto"
            style={{ width: 72, height: 72, borderRadius: 18, flex: 'none', background: '#171511', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid var(--border)', cursor: 'pointer', position: 'relative' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {info?.foto ? <img src={info.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <MakoStar size={30} />}
            <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,.55)', color: '#fff', fontSize: 9, fontWeight: 600, padding: '2px 0' }}>{busy === 'foto' ? '…' : 'Editar'}</span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e: ChangeEvent<HTMLInputElement>) => { cambiarFoto(e.target.files?.[0] ?? null); e.target.value = ''; }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Nombre del grupo" style={inp} />
            <div style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={guardarNombre} disabled={busy === 'nombre' || subject === info?.subject} style={{ ...btnGhost, opacity: busy === 'nombre' || subject === info?.subject ? 0.5 : 1 }}>Guardar nombre</button>
            </div>
          </div>
        </div>

        {/* Descripción */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 6 }}>Descripción</div>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="Descripción del grupo…" style={{ ...inp, resize: 'none' }} />
          <div style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={guardarDesc} disabled={busy === 'desc' || desc === info?.descripcion} style={{ ...btnGhost, opacity: busy === 'desc' || desc === info?.descripcion ? 0.5 : 1 }}>Guardar descripción</button>
          </div>
        </div>

        {/* Participantes */}
        <div>
          <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 8 }}>Participantes {info ? `· ${info.participantes.length}` : ''}</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input value={nuevoNum} onChange={(e) => setNuevoNum(e.target.value)} inputMode="tel" placeholder="+54 9 …" style={inp} />
            <button onClick={agregar} disabled={busy === 'add' || !nuevoNum.replace(/\D/g, '')} style={{ ...btn, flex: 'none', opacity: busy === 'add' ? 0.5 : 1 }}>Agregar</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {info?.participantes.map((p) => (
              <div key={p.numero} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 9, background: 'var(--surface-2)' }}>
                <span style={{ fontSize: 13.5, color: 'var(--ink)', fontFamily: "'Geist Mono', monospace" }}>+{p.numero}</span>
                {p.admin && <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 5, padding: '1px 5px' }}>admin</span>}
                <button onClick={() => quitar(p.numero)} disabled={busy === 'rm' + p.numero} title="Quitar" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--bad)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Quitar</button>
              </div>
            ))}
            {info && info.participantes.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--faint)' }}>Sin participantes listados.</div>}
          </div>
        </div>

        {flash && <div style={{ marginTop: 14, fontSize: 13, fontWeight: 600, color: 'var(--good)' }}>{flash}</div>}
      </div>
    </div>
  );
}
