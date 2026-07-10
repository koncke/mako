'use client';

// =============================================================================
// EmpresaInbox — inbox del WhatsApp NO oficial (Evolution), leído del espejo en
// nuestra DB (/api/whatsapp/evolution/mensajes). Autocontenido: lista de chats +
// hilo. Es el "respaldo total" del PDF hecho vista: aunque banean el número, el
// historial vive acá. Se muestra en la tab WhatsApp con el toggle de canal.
// =============================================================================

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';

type Conv = {
  chatJid: string; telefono: string | null; nombre: string; leadId: number | null;
  ultimoTexto: string | null; ultimoTipo: string | null; ultimaFecha: string | null;
  ultimoEntrante: boolean; total: number;
};
type Msg = { id: number; fromMe: boolean; tipo: string | null; texto: string | null; mediaUrl: string | null; mediaMime: string | null; fecha: string | null };
type Borr = { id: number; leadId: number | null; telefono: string; texto: string; origen: string; leadNombre: string | null; createdAt: string };

async function jget<T>(url: string): Promise<T> { const r = await fetch(url, { cache: 'no-store' }); return r.json() as Promise<T>; }
async function jpost<T>(url: string, body: unknown): Promise<T> { const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return r.json() as Promise<T>; }

function fmtHora(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}
function fmtDia(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' });
}
function preview(c: Conv): string {
  if (c.ultimoTexto) return c.ultimoTexto;
  switch (c.ultimoTipo) { case 'image': return '📷 Foto'; case 'audio': return '🎙 Audio'; case 'video': return '🎬 Video'; case 'document': return '📄 Documento'; case 'sticker': return '🎨 Sticker'; default: return '—'; }
}

export function EmpresaInbox() {
  const [convs, setConvs] = useState<Conv[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [errMsgs, setErrMsgs] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [borradores, setBorradores] = useState<Borr[]>([]);
  const [showBorr, setShowBorr] = useState(false);
  const [borrBusy, setBorrBusy] = useState<number | null>(null);
  const [borrErr, setBorrErr] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const selRef = useRef<string | null>(null);   // chat objetivo (anti-race del poll)
  const stickRef = useRef(true);                 // ¿el user está pegado al fondo?

  const loadConvs = useCallback(async () => {
    try {
      const j = await jget<{ ok: boolean; error?: string; conversaciones: Conv[] }>('/api/whatsapp/evolution/mensajes');
      if (!j.ok) throw new Error(j.error || 'No se pudieron cargar las conversaciones');
      setConvs(j.conversaciones); setErr(null);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setLoadingConvs(false); }
  }, []);

  useEffect(() => { void loadConvs(); const t = setInterval(() => void loadConvs(), 15000); return () => clearInterval(t); }, [loadConvs]);

  const loadBorr = useCallback(async () => {
    const j = await jget<{ ok: boolean; borradores: Borr[] }>('/api/whatsapp/evolution/borradores');
    if (j.ok) setBorradores(j.borradores);
  }, []);
  useEffect(() => { void loadBorr(); const t = setInterval(() => void loadBorr(), 20000); return () => clearInterval(t); }, [loadBorr]);

  async function accionBorrador(id: number, action: 'enviar' | 'descartar') {
    setBorrBusy(id); setBorrErr(null);
    try {
      const j = await jpost<{ ok: boolean; error?: string }>('/api/whatsapp/evolution/borradores', { id, action });
      if (j.ok) {
        await loadBorr();
        if (action === 'enviar') { await loadConvs(); if (selRef.current) await loadMsgs(selRef.current); }
      } else setBorrErr(j.error || 'No se pudo completar');
    } finally { setBorrBusy(null); }
  }

  async function enviarManual() {
    const sc = convs.find((c) => c.chatJid === sel);
    if (!sc || !draft.trim()) return;
    setSending(true);
    try {
      const j = await jpost<{ ok: boolean; error?: string }>('/api/whatsapp/evolution/mensajes', { telefono: sc.telefono, chat: sc.chatJid, texto: draft.trim() });
      if (j.ok) { setDraft(''); stickRef.current = true; await loadMsgs(sc.chatJid); }
      else setErrMsgs(j.error || 'No se pudo enviar');
    } finally { setSending(false); }
  }

  const loadMsgs = useCallback(async (chat: string) => {
    setLoadingMsgs(true);
    try {
      const j = await jget<{ ok: boolean; error?: string; mensajes: Msg[] }>(`/api/whatsapp/evolution/mensajes?chat=${encodeURIComponent(chat)}`);
      if (selRef.current !== chat) return; // el user cambió de chat mientras cargaba → descartar
      if (!j.ok) { setErrMsgs(j.error || 'No se pudieron cargar los mensajes'); return; }
      setErrMsgs(null);
      // Anti-parpadeo: conservamos la URL firmada ya cargada de cada mensaje (las
      // firmas cambian por poll; re-firmar recargaría la media). Solo los nuevos
      // estrenan URL.
      setMsgs((prev) => {
        const urlPorId = new Map(prev.filter((m) => m.mediaUrl).map((m) => [m.id, m.mediaUrl] as const));
        return j.mensajes.map((m) => (m.mediaUrl && urlPorId.has(m.id) ? { ...m, mediaUrl: urlPorId.get(m.id)! } : m));
      });
    } catch { if (selRef.current === chat) setErrMsgs('Error de red al cargar los mensajes'); }
    finally { if (selRef.current === chat) setLoadingMsgs(false); }
  }, []);

  useEffect(() => {
    selRef.current = sel;
    if (!sel) { setMsgs([]); return; }
    stickRef.current = true;       // al abrir un chat, arrancamos pegados al fondo
    setMsgs([]); setErrMsgs(null);
    void loadMsgs(sel);
    const t = setInterval(() => void loadMsgs(sel), 8000);
    return () => clearInterval(t);
  }, [sel, loadMsgs]);

  // Autoscroll SOLO si el user ya estaba pegado al fondo (no lo arrancamos de
  // leer historial arriba en cada poll).
  useEffect(() => { const el = scrollRef.current; if (el && stickRef.current) el.scrollTop = el.scrollHeight; }, [msgs]);
  const onScrollHilo = () => { const el = scrollRef.current; if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60; };

  const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' };
  const selConv = convs.find((c) => c.chatJid === sel) ?? null;

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '340px 1fr', gap: '16px' }}>
      {/* LISTA */}
      <div style={card}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '10.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' }}>API no Oficial</span>
          {borradores.length > 0 && (
            <button onClick={() => setShowBorr(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '999px', border: '1px solid var(--warn-fill)', background: 'var(--warn-bg)', color: 'var(--warn)', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Geist', sans-serif" }} title="Mensajes que MaKo dejó listos para que los mandes con 1 clic">📝 {borradores.length} borrador{borradores.length > 1 ? 'es' : ''}</button>
          )}
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px' }}>
          {loadingConvs && convs.length === 0 && <div style={{ padding: '18px', color: 'var(--dim)', fontSize: '13.5px' }}>Cargando…</div>}
          {!loadingConvs && convs.length === 0 && !err && (
            <div style={{ padding: '18px', color: 'var(--faint)', fontSize: '13px', lineHeight: 1.5 }}>Todavía no hay mensajes en el número no oficial. Conectá el número (chip API no Oficial, arriba) y las conversaciones van a aparecer acá a medida que entren.</div>
          )}
          {err && <div style={{ margin: '10px', padding: '9px 12px', borderRadius: '9px', border: '1px solid var(--bad)', background: 'var(--bad-bg)', color: 'var(--bad)', fontSize: '12.5px' }}>{err}</div>}
          {convs.map((c) => {
            const active = c.chatJid === sel;
            return (
              <div key={c.chatJid} role="button" tabIndex={0} onClick={() => setSel(c.chatJid)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(c.chatJid); } }}
                style={{ display: 'flex', gap: '11px', padding: '11px 12px', borderRadius: '12px', cursor: 'pointer', background: active ? 'var(--surface-2)' : 'transparent', border: '1px solid ' + (active ? 'var(--border-strong)' : 'transparent'), alignItems: 'center' }}>
                <div style={{ width: '38px', height: '38px', flex: 'none', borderRadius: '50%', background: 'var(--wa-bubble)', color: 'var(--wa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px' }}>{(c.nombre[0] || '·').toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px' }}>
                    <span style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nombre}</span>
                    <span style={{ fontSize: '11px', color: 'var(--faint)', flex: 'none' }}>{fmtDia(c.ultimaFecha)}</span>
                  </div>
                  <div style={{ fontSize: '12.5px', color: c.ultimoEntrante ? 'var(--ink)' : 'var(--faint)', fontWeight: c.ultimoEntrante ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.ultimoEntrante ? '' : '↩ '}{preview(c)}</div>
                </div>
                {c.leadId && <span title="Lead del CRM" style={{ width: '7px', height: '7px', flex: 'none', borderRadius: '50%', background: 'var(--accent)' }} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* HILO */}
      <div style={card}>
        {!selConv ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)', fontSize: '14px' }}>Elegí una conversación</div>
        ) : (
          <>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ fontWeight: 600, fontSize: '16px', color: 'var(--ink)' }}>{selConv.nombre}</div>
              {selConv.telefono && <span style={{ fontSize: '12.5px', color: 'var(--faint)', fontFamily: "'Geist Mono', monospace" }}>{selConv.telefono}</span>}
              <span style={{ marginLeft: 'auto', fontSize: '11.5px', color: 'var(--wa)', fontWeight: 600 }}>no oficial</span>
            </div>
            <div ref={scrollRef} onScroll={onScrollHilo} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--surface-2)' }}>
              {loadingMsgs && msgs.length === 0 && !errMsgs && <div style={{ color: 'var(--faint)', fontSize: '13px', textAlign: 'center' }}>Cargando…</div>}
              {errMsgs && (
                <div style={{ margin: 'auto', textAlign: 'center' }}>
                  <div style={{ padding: '9px 12px', borderRadius: '9px', border: '1px solid var(--bad)', background: 'var(--bad-bg)', color: 'var(--bad)', fontSize: '12.5px', marginBottom: '10px' }}>{errMsgs}</div>
                  <button onClick={() => sel && void loadMsgs(sel)} style={{ padding: '7px 14px', borderRadius: '9px', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Reintentar</button>
                </div>
              )}
              {msgs.map((m) => (
                <div key={m.id} style={{ display: 'flex', justifyContent: m.fromMe ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '78%', padding: '9px 12px', borderRadius: m.fromMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: m.fromMe ? 'var(--wa-bubble)' : 'var(--surface)', border: '1px solid ' + (m.fromMe ? 'rgba(28,138,84,.30)' : 'var(--border)') }}>
                    {m.mediaUrl && m.tipo === 'image' && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.mediaUrl} alt="imagen" style={{ maxWidth: '240px', borderRadius: '10px', display: 'block', marginBottom: m.texto ? '6px' : 0 }} />
                    )}
                    {m.mediaUrl && m.tipo === 'audio' && <audio controls src={m.mediaUrl} style={{ width: '240px' }} />}
                    {m.mediaUrl && m.tipo === 'video' && <video controls src={m.mediaUrl} style={{ maxWidth: '240px', borderRadius: '10px' }} />}
                    {m.mediaUrl && m.tipo === 'document' && <a href={m.mediaUrl} target="_blank" rel="noreferrer" style={{ fontSize: '13px', color: 'var(--accent)' }}>📄 {m.texto || 'Documento'}</a>}
                    {!m.mediaUrl && (m.tipo === 'image' || m.tipo === 'audio' || m.tipo === 'video' || m.tipo === 'document') && <span style={{ fontSize: '13px', color: 'var(--faint)', fontStyle: 'italic' }}>📎 {m.texto || m.tipo} (no disponible)</span>}
                    {m.texto && m.tipo !== 'document' && <div style={{ fontSize: '14px', lineHeight: 1.45, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{m.texto}</div>}
                    <div style={{ fontSize: '10.5px', color: 'var(--faint)', marginTop: '3px', textAlign: 'right' }}>{fmtHora(m.fecha)}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void enviarManual(); } }}
                placeholder="Escribí un mensaje… (sale por el número de empresa, con anti-baneo)" rows={1}
                style={{ flex: 1, minHeight: '40px', maxHeight: '120px', resize: 'none', padding: '10px 14px', borderRadius: '21px', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '14px', lineHeight: 1.35, outline: 'none' }} />
              <button onClick={() => void enviarManual()} disabled={sending || !draft.trim()} title="Enviar por el número de empresa"
                style={{ flex: 'none', width: '42px', height: '42px', borderRadius: '50%', border: 'none', background: 'var(--wa)', color: '#fff', cursor: sending || !draft.trim() ? 'default' : 'pointer', opacity: sending || !draft.trim() ? 0.5 : 1, fontSize: '17px' }}>➤</button>
            </div>
          </>
        )}
      </div>

      {/* Panel de borradores: mensajes listos para mandar con 1 clic (leads calientes) */}
      {showBorr && (
        <div onClick={() => setShowBorr(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '560px', maxHeight: '85vh', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: '16px', padding: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink)' }}>Borradores por enviar</div>
              <button onClick={() => setShowBorr(false)} title="Cerrar" style={{ background: 'none', border: 'none', fontSize: '20px', color: 'var(--faint)', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--dim)', marginBottom: '14px', lineHeight: 1.5 }}>A leads calientes el sistema no manda solo (anti-baneo). Revisá y enviá con 1 clic — o descartá.</div>
            {borrErr && <div style={{ marginBottom: '12px', padding: '9px 12px', borderRadius: '9px', border: '1px solid var(--bad)', background: 'var(--bad-bg)', color: 'var(--bad)', fontSize: '12.5px' }}>{borrErr}</div>}
            {borradores.length === 0 && <div style={{ color: 'var(--faint)', fontSize: '13px', padding: '10px 0' }}>No hay borradores pendientes.</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {borradores.map((b) => (
                <div key={b.id} style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 14px', background: 'var(--surface-2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--ink)' }}>{b.leadNombre || b.telefono}</span>
                    <span style={{ fontSize: '11px', color: 'var(--faint)', fontFamily: "'Geist Mono', monospace" }}>{b.origen}</span>
                  </div>
                  <div style={{ fontSize: '13.5px', color: 'var(--ink)', lineHeight: 1.5, whiteSpace: 'pre-wrap', marginBottom: '10px' }}>{b.texto}</div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button onClick={() => void accionBorrador(b.id, 'descartar')} disabled={borrBusy === b.id} style={{ padding: '7px 14px', borderRadius: '9px', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: "'Geist', sans-serif", fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Descartar</button>
                    <button onClick={() => void accionBorrador(b.id, 'enviar')} disabled={borrBusy === b.id} style={{ padding: '7px 16px', borderRadius: '9px', border: 'none', background: 'var(--wa)', color: '#fff', fontFamily: "'Geist', sans-serif", fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: borrBusy === b.id ? 0.6 : 1 }}>{borrBusy === b.id ? 'Enviando…' : 'Enviar ✓'}</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
