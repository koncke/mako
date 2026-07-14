'use client';

// =============================================================================
// ChatGruposPanel — el chat de MaKo: SOLO los grupos (SuperAdmin + clientes + prueba)
// =============================================================================
// Reusa el hilo REAL del cliente (ChatHilo): burbujas + media (imagen/audio/PDF)
// + composer (emoji/adjuntar/nota de voz) + borrador POR grupo. Caché a nivel
// módulo (como el inbox del cliente): al volver, la lista y el hilo aparecen al
// instante y se refrescan en 2º plano. La topbar abre el detalle del grupo.

import { useCallback, useEffect, useRef, useState } from 'react';
import { MakoStar } from '../_components/MakoBrand';
import { ChatHilo, type HiloMsg } from '../whatsapp/_shared/ChatHilo';
import { GrupoDetalleModal } from './GrupoDetalleModal';

type Grupo = { jid: string; nombre: string; foto: string | null; ultimo: string; ultimoAt: number };
type Msg = { id: string; fromMe: boolean; autor: string; texto: string; at: number; tipo: string | null; mediaMime: string | null; mediaUrl: string | null };

// Caché a nivel módulo: sobrevive el salto entre tabs (aparece al instante).
let gruposCache: Grupo[] = [];
const msgsCache = new Map<string, Msg[]>();

export function ChatGruposPanel() {
  const [grupos, setGrupos] = useState<Grupo[] | null>(gruposCache.length ? gruposCache : null);
  const [sel, setSel] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [cargandoMsgs, setCargandoMsgs] = useState(false);
  const [detalleOpen, setDetalleOpen] = useState(false);
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
  // Auto-abrir el primer grupo (como el chat del cliente), sin pisar elección manual.
  useEffect(() => { if (sel == null && grupos && grupos.length) setSel(grupos[0].jid); }, [grupos, sel]);
  useEffect(() => {
    selRef.current = sel;
    if (!sel) { setMsgs([]); return; }
    const cached = msgsCache.get(sel);
    setMsgs(cached ?? []);          // pinta el cache al instante
    setCargandoMsgs(!cached);       // loader solo si no hay cache
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

  const selGrupo = grupos?.find((g) => g.jid === sel) ?? null;
  const avatar = (foto: string | null, size: number) => (
    <div style={{ width: size, height: size, borderRadius: Math.round(size / 3.6), flex: 'none', background: '#171511', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {foto ? <img src={foto} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <MakoStar size={Math.round(size * 0.42)} />}
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 12, height: 620 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--border)', fontFamily: "'Geist Mono', monospace", fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' }}>
          Grupos de MaKo {grupos ? `· ${grupos.length}` : ''}
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: 8 }}>
          {grupos === null && <div style={{ padding: 14, color: 'var(--faint)', fontSize: 13 }}>Cargando…</div>}
          {grupos?.length === 0 && <div style={{ padding: 14, color: 'var(--faint)', fontSize: 13, lineHeight: 1.5 }}>Todavía no hay grupos de MaKo en esta línea.</div>}
          {grupos?.map((g) => {
            const on = g.jid === sel;
            return (
              <button key={g.jid} type="button" onClick={() => setSel(g.jid)}
                style={{ width: '100%', textAlign: 'left', display: 'flex', gap: 11, alignItems: 'center', padding: '10px 12px', borderRadius: 12, border: '1px solid ' + (on ? 'var(--border-strong)' : 'transparent'), background: on ? 'var(--surface-2)' : 'transparent', cursor: 'pointer', marginBottom: 2 }}>
                {avatar(g.foto, 40)}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.nombre}</div>
                  <div style={{ fontSize: 12, color: 'var(--faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.ultimo || '—'}</div>
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
          accent="var(--accent-soft)"
          accentBubble="var(--wa-noof-bubble)"
          placeholder="Escribí como MaKo…"
          header={(
            <button type="button" onClick={() => setDetalleOpen(true)} title="Ver detalle del grupo"
              style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
              {avatar(selGrupo.foto, 38)}
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

      {detalleOpen && sel && <GrupoDetalleModal jid={sel} onClose={() => setDetalleOpen(false)} onCambio={cargarGrupos} />}
    </div>
  );
}
