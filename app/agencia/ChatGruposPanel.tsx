'use client';

// =============================================================================
// ChatGruposPanel — el chat de MaKo: SOLO los grupos (SuperAdmin + clientes + prueba)
// =============================================================================
// Lista los grupos de la línea de MaKo y muestra/manda mensajes en cada uno.
// Lee de /api/admin/mako-chats (store de Evolution de la instancia de voz).

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { MakoStar } from '../_components/MakoBrand';

const MONO = "'Geist Mono', monospace";
type Grupo = { jid: string; nombre: string; foto: string | null; ultimo: string; ultimoAt: number };
type Msg = { id: string; fromMe: boolean; autor: string; texto: string; at: number };

const hora = (at: number) => {
  if (!at) return '';
  try { return new Date(at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
};

export function ChatGruposPanel() {
  const [grupos, setGrupos] = useState<Grupo[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState('');
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement | null>(null);

  const cargarGrupos = useCallback(async () => {
    try { const j = await (await fetch('/api/admin/mako-chats')).json(); if (j.ok) setGrupos(j.grupos as Grupo[]); } catch { setGrupos([]); }
  }, []);
  const cargarMsgs = useCallback(async (jid: string) => {
    try { const j = await (await fetch(`/api/admin/mako-chats?jid=${encodeURIComponent(jid)}`)).json(); if (j.ok) setMsgs(j.mensajes as Msg[]); } catch { /* noop */ }
  }, []);

  useEffect(() => { cargarGrupos(); }, [cargarGrupos]);
  useEffect(() => {
    if (!sel) return;
    cargarMsgs(sel);
    const t = setInterval(() => cargarMsgs(sel), 5000);
    return () => clearInterval(t);
  }, [sel, cargarMsgs]);
  useEffect(() => { if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight; }, [msgs]);

  const enviar = async () => {
    if (!sel || !texto.trim() || busy) return;
    setBusy(true);
    const t = texto; setTexto('');
    try {
      await fetch('/api/admin/mako-chats', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jid: sel, texto: t }) });
      setTimeout(() => cargarMsgs(sel), 1200);
    } finally { setBusy(false); }
  };

  const selGrupo = grupos?.find((g) => g.jid === sel) ?? null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 0, height: 620, border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', background: 'var(--surface)' }}>
      {/* Lista de grupos */}
      <div style={{ borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' }}>
          Grupos de MaKo {grupos ? `· ${grupos.length}` : ''}
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {grupos === null && <div style={{ padding: 16, color: 'var(--faint)', fontSize: 13 }}>Cargando…</div>}
          {grupos?.length === 0 && <div style={{ padding: 16, color: 'var(--faint)', fontSize: 13, lineHeight: 1.5 }}>Todavía no hay grupos en esta línea. Conectá el canal y creá grupos (SuperAdmin, clientes o prueba).</div>}
          {grupos?.map((g) => {
            const on = g.jid === sel;
            return (
              <button key={g.jid} type="button" onClick={() => setSel(g.jid)}
                style={{ width: '100%', textAlign: 'left', display: 'flex', gap: 11, alignItems: 'center', padding: '11px 14px', border: 'none', borderBottom: '1px solid var(--border)', background: on ? 'var(--primary-bg)' : 'transparent', cursor: 'pointer' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, flex: 'none', background: '#171511', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {g.foto ? <img src={g.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <MakoStar size={17} />}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.nombre}</div>
                  <div style={{ fontSize: 12, color: 'var(--faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.ultimo || '—'}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Conversación */}
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {!sel && <div style={{ margin: 'auto', color: 'var(--faint)', fontSize: 14, textAlign: 'center', padding: 24 }}>Elegí un grupo para ver la conversación.</div>}
        {sel && (
          <>
            <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 15 }}>{selGrupo?.nombre ?? 'Grupo'}</div>
            <div ref={scroller} style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--surface-2)' }}>
              {msgs.length === 0 && <div style={{ margin: 'auto', color: 'var(--faint)', fontSize: 13 }}>Sin mensajes todavía.</div>}
              {msgs.map((m) => (
                <div key={m.id} style={{ alignSelf: m.fromMe ? 'flex-end' : 'flex-start', maxWidth: '76%' }}>
                  <div style={{ background: m.fromMe ? 'var(--primary)' : 'var(--surface)', color: m.fromMe ? '#fff' : 'var(--ink)', border: m.fromMe ? 'none' : '1px solid var(--border)', borderRadius: 12, padding: '8px 12px', fontSize: 13.5, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {!m.fromMe && <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary-strong)', marginBottom: 2 }}>{m.autor}</div>}
                    {m.texto}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--faint)', textAlign: m.fromMe ? 'right' : 'left', marginTop: 2 }}>{hora(m.at)}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--border)' }}>
              <input value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                placeholder="Escribí como MaKo…" disabled={busy}
                style={{ flex: 1, padding: '10px 13px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, fontFamily: 'inherit' }} />
              <button type="button" onClick={enviar} disabled={busy || !texto.trim()} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: busy || !texto.trim() ? 0.5 : 1 }}>Enviar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
