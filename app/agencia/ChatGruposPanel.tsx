'use client';

// =============================================================================
// ChatGruposPanel — el chat de MaKo: SOLO los grupos (SuperAdmin + clientes + prueba)
// =============================================================================
// Reusa el hilo REAL del cliente (ChatHilo): mismas burbujas, media y composer
// (emoji + adjuntar + nota de voz). Lee de /api/admin/mako-chats (store de
// Evolution de la instancia de voz). Arriba, la tira del CANAL (estado + QR)
// fusionada acá (ya no es un tab aparte).

import { useCallback, useEffect, useRef, useState } from 'react';
import { MakoStar } from '../_components/MakoBrand';
import { ChatHilo, type HiloMsg } from '../whatsapp/_shared/ChatHilo';
import { CanalMaKoPanel } from './CanalMaKoPanel';

type Grupo = { jid: string; nombre: string; foto: string | null; ultimo: string; ultimoAt: number };
type Msg = { id: string; fromMe: boolean; autor: string; texto: string; at: number; tipo: string | null; mediaMime: string | null; mediaUrl: string | null };
type Canal = { estado: string; numero: string | null; perfil: string | null; esVozActiva: boolean };

const COLOR: Record<string, string> = { conectado: 'var(--good)', conectando: 'var(--warn)', desconectado: 'var(--faint)', error: 'var(--bad)' };
const LABEL: Record<string, string> = { conectado: 'Canal conectado', conectando: 'Esperando escaneo…', desconectado: 'Canal desconectado', error: 'Canal con error' };

export function ChatGruposPanel() {
  const [grupos, setGrupos] = useState<Grupo[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [cargandoMsgs, setCargandoMsgs] = useState(false);
  const [canal, setCanal] = useState<Canal | null>(null);
  const [canalOpen, setCanalOpen] = useState(false);
  const selRef = useRef<string | null>(null);

  const cargarGrupos = useCallback(async () => {
    try { const j = await (await fetch('/api/admin/mako-chats')).json(); if (j.ok) setGrupos(j.grupos as Grupo[]); } catch { setGrupos([]); }
  }, []);
  const cargarMsgs = useCallback(async (jid: string) => {
    try { const j = await (await fetch(`/api/admin/mako-chats?jid=${encodeURIComponent(jid)}`)).json(); if (j.ok && selRef.current === jid) setMsgs(j.mensajes as Msg[]); }
    catch { /* noop */ } finally { if (selRef.current === jid) setCargandoMsgs(false); }
  }, []);
  const cargarCanal = useCallback(async () => {
    try { const j = await (await fetch('/api/admin/mako-canal')).json(); if (j.ok) setCanal(j as Canal); } catch { /* noop */ }
  }, []);

  useEffect(() => { cargarGrupos(); cargarCanal(); const t = setInterval(cargarGrupos, 15000); return () => clearInterval(t); }, [cargarGrupos, cargarCanal]);
  // Auto-abrir el primer grupo al entrar (como el chat del cliente) — sin pisar
  // una elección manual.
  useEffect(() => { if (sel == null && grupos && grupos.length) setSel(grupos[0].jid); }, [grupos, sel]);
  useEffect(() => {
    selRef.current = sel;
    if (!sel) { setMsgs([]); return; }
    setCargandoMsgs(true); cargarMsgs(sel);
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
  const estado = canal?.estado ?? 'desconectado';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Tira del CANAL (fusionada) */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: COLOR[estado], flex: 'none' }} />
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{LABEL[estado] ?? 'Canal'}</span>
          {canal?.numero && <span style={{ fontSize: 12, color: 'var(--dim)', fontFamily: "'Geist Mono', monospace" }}>· {canal.perfil ? `${canal.perfil} · ` : ''}+{canal.numero}</span>}
          {estado === 'conectado' && canal?.esVozActiva && <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 999, background: 'var(--good-bg)', color: 'var(--good)' }}>voz activa</span>}
          <button onClick={() => setCanalOpen((v) => !v)} style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {canalOpen ? 'Ocultar' : estado === 'conectado' ? 'Gestionar canal' : 'Conectar por QR'}
          </button>
        </div>
        {canalOpen && <div style={{ borderTop: '1px solid var(--border)', padding: 16 }}><CanalMaKoPanel onCambio={cargarCanal} /></div>}
      </div>

      {/* Chat: lista de grupos + hilo REAL (ChatHilo) */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 12, height: 600 }}>
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
                  <div style={{ width: 40, height: 40, borderRadius: 10, flex: 'none', background: '#171511', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {g.foto ? <img src={g.foto} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <MakoStar size={17} />}
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

        {sel && selGrupo ? (
          <ChatHilo
            mensajes={hilo}
            cargando={cargandoMsgs}
            accent="var(--accent-soft)"
            accentBubble="var(--wa-noof-bubble)"
            placeholder="Escribí como MaKo…"
            header={(
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, flex: 'none', background: '#171511', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {selGrupo.foto ? <img src={selGrupo.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <MakoStar size={16} />}
                </div>
                <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{selGrupo.nombre}</div>
              </div>
            )}
            onEnviarTexto={onEnviarTexto}
            onEnviarArchivo={onEnviarArchivo}
          />
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)', fontSize: 14 }}>Elegí un grupo para ver la conversación.</div>
        )}
      </div>
    </div>
  );
}
