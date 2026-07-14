'use client';

// =============================================================================
// ChatGruposPanel — el chat de MaKo: SOLO los grupos (SuperAdmin + clientes + prueba)
// =============================================================================
// Reusa el hilo REAL del cliente (ChatHilo): burbujas + media + composer +
// borrador POR grupo. Caché a nivel módulo (aparece al instante). Buscador de
// grupos. La topbar abre el DETALLE del grupo, que cubre todo el chat (inline).

import { useCallback, useEffect, useRef, useState } from 'react';
import { MakoStar } from '../_components/MakoBrand';
import { ChatHilo, type HiloMsg } from '../whatsapp/_shared/ChatHilo';
import { GrupoDetalleModal } from './GrupoDetalleModal';

type Grupo = { jid: string; nombre: string; foto: string | null; ultimo: string; ultimoAt: number };
type Msg = { id: string; fromMe: boolean; autor: string; texto: string; at: number; tipo: string | null; mediaMime: string | null; mediaUrl: string | null };

let gruposCache: Grupo[] = [];
const msgsCache = new Map<string, Msg[]>();

// Avatar redondo (como WhatsApp): foto o estrella de MaKo.
function Avatar({ foto, size }: { foto: string | null; size: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flex: 'none', background: '#171511', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {foto ? <img src={foto} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <MakoStar size={Math.round(size * 0.42)} />}
    </div>
  );
}

export function ChatGruposPanel() {
  const [grupos, setGrupos] = useState<Grupo[] | null>(gruposCache.length ? gruposCache : null);
  const [sel, setSel] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [cargandoMsgs, setCargandoMsgs] = useState(false);
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [busq, setBusq] = useState('');
  const [draftsMap, setDraftsMap] = useState<Record<string, boolean>>({});
  const selRef = useRef<string | null>(null);

  const cargarGrupos = useCallback(async () => {
    try { const j = await (await fetch('/api/admin/mako-chats')).json(); if (j.ok) { gruposCache = j.grupos as Grupo[]; setGrupos(gruposCache); } } catch { if (!gruposCache.length) setGrupos([]); }
  }, []);
  const cargarMsgs = useCallback(async (jid: string) => {
    try {
      const j = await (await fetch(`/api/admin/mako-chats?jid=${encodeURIComponent(jid)}`)).json();
      if (j.ok && selRef.current === jid) { msgsCache.set(jid, j.mensajes as Msg[]); setMsgs(j.mensajes as Msg[]); }
    } catch { /* noop */ } finally { if (selRef.current === jid) setCargandoMsgs(false); }
  }, []);

  useEffect(() => { cargarGrupos(); const t = setInterval(cargarGrupos, 15000); return () => clearInterval(t); }, [cargarGrupos]);
  useEffect(() => { if (sel == null && grupos && grupos.length) setSel(grupos[0].jid); }, [grupos, sel]);
  useEffect(() => {
    selRef.current = sel;
    if (!sel) { setMsgs([]); return; }
    const cached = msgsCache.get(sel);
    setMsgs(cached ?? []);
    setCargandoMsgs(!cached);
    cargarMsgs(sel);
    const t = setInterval(() => cargarMsgs(sel), 6000);
    return () => clearInterval(t);
  }, [sel, cargarMsgs]);

  const hilo: HiloMsg[] = msgs.map((m) => ({
    id: m.id || `${m.at}-${m.autor}`, fromMe: m.fromMe, texto: m.texto,
    tipo: m.tipo, mediaUrl: m.mediaUrl, mediaMime: m.mediaMime,
    autor: m.fromMe ? null : m.autor, fecha: m.at ? new Date(m.at).toISOString() : null,
  }));

  const onEnviarTexto = async (texto: string): Promise<boolean> => {
    if (!sel) return false;
    const j = await (await fetch('/api/admin/mako-chats', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jid: sel, texto }) })).json();
    if (j.ok) setTimeout(() => sel && cargarMsgs(sel), 1500);
    return !!j.ok;
  };
  const onEnviarArchivo = async (blob: Blob, tipo: '' | 'audio', fileName: string, caption?: string): Promise<boolean> => {
    if (!sel) return false;
    const fd = new FormData();
    fd.append('chat', sel); fd.append('tipo', tipo); fd.append('archivo', blob, fileName);
    if (caption) fd.append('caption', caption);
    const j = await (await fetch('/api/admin/mako-chats', { method: 'POST', body: fd })).json();
    if (j.ok) setTimeout(() => sel && cargarMsgs(sel), 1800);
    return !!j.ok;
  };

  // Loader limpio en la primera carga (en vez del esqueleto vacío de 2 columnas).
  if (grupos === null) {
    return (
      <div style={{ height: 620, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{'@keyframes mako-spin{to{transform:rotate(360deg)}}'}</style>
        <span style={{ width: 30, height: 30, border: '3px solid var(--border)', borderTopColor: 'var(--accent-soft)', borderRadius: '50%', display: 'inline-block', animation: 'mako-spin .8s linear infinite' }} />
      </div>
    );
  }

  // Detalle del grupo: cubre TODO el chat (inline), con botón para volver.
  if (detalleOpen && sel) {
    return <GrupoDetalleModal jid={sel} onClose={() => setDetalleOpen(false)} onCambio={cargarGrupos} />;
  }

  const selGrupo = grupos.find((g) => g.jid === sel) ?? null;
  const q = busq.trim().toLowerCase();
  const visibles = (q ? grupos.filter((g) => g.nombre.toLowerCase().includes(q)) : grupos.slice())
    .sort((a, b) => {
      const da = draftsMap[a.jid] ? 1 : 0, db = draftsMap[b.jid] ? 1 : 0;
      if (da !== db) return db - da;            // los que tienen borrador, primero
      return (b.ultimoAt || 0) - (a.ultimoAt || 0);
    });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 12, height: 620 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <div style={{ padding: '13px 16px 11px', borderBottom: '1px solid var(--border)' }}>
          <input value={busq} onChange={(e) => setBusq(e.target.value)} placeholder="Buscar grupo…"
            style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: 13.5, outline: 'none' }} />
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: 8 }}>
          {grupos.length === 0 && <div style={{ padding: 14, color: 'var(--faint)', fontSize: 13, lineHeight: 1.5 }}>Todavía no hay grupos de MaKo en esta línea.</div>}
          {visibles.length === 0 && grupos.length > 0 && <div style={{ padding: 14, color: 'var(--faint)', fontSize: 13 }}>Ningún grupo coincide.</div>}
          {visibles.map((g) => {
            const on = g.jid === sel;
            return (
              <button key={g.jid} type="button" onClick={() => setSel(g.jid)}
                style={{ width: '100%', textAlign: 'left', display: 'flex', gap: 11, alignItems: 'center', padding: '10px 12px', borderRadius: 12, border: '1px solid ' + (on ? 'var(--border-strong)' : 'transparent'), background: on ? 'var(--surface-2)' : 'transparent', cursor: 'pointer', marginBottom: 2 }}>
                <Avatar foto={g.foto} size={40} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.nombre}</div>
                  <div style={{ fontSize: 12, color: draftsMap[g.jid] ? 'var(--bad)' : 'var(--faint)', fontWeight: draftsMap[g.jid] ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{draftsMap[g.jid] ? 'Borrador' : (g.ultimo || '—')}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {sel && selGrupo ? (
        <ChatHilo
          mensajes={hilo}
          cargando={cargandoMsgs}
          draftKey={sel}
          onDraftChange={(jid, has) => setDraftsMap((m) => (m[jid] === has ? m : { ...m, [jid]: has }))}
          accent="var(--accent-soft)"
          accentBubble="var(--wa-noof-bubble)"
          placeholder="Escribí como MaKo…"
          header={(
            <button type="button" onClick={() => setDetalleOpen(true)} title="Ver detalle del grupo"
              style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
              <Avatar foto={selGrupo.foto} size={38} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{selGrupo.nombre}</div>
                <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>Toca para ver el detalle</div>
              </div>
            </button>
          )}
          onEnviarTexto={onEnviarTexto}
          onEnviarArchivo={onEnviarArchivo}
        />
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)', fontSize: 14 }}>Elegí un grupo para ver la conversación.</div>
      )}
    </div>
  );
}
