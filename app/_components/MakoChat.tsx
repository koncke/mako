'use client';

// =============================================================================
// MakoChat — chat con MaKo (Claude) con sesiones, reutilizable
// =============================================================================
// Sesiones (New Chat + renombrar/pinear/archivar/borrar), gráfico fijo arriba
// (colapsable) con scroll de mensajes independiente, sugerencias en una línea.
//
// CON LAS PIEZAS DEL OPS CENTER (22/10/2026, TB3; Martín: «quiero que todos los chats de MaKo en las tabs sean el del Ops
// Center»): el hilo es `HiloMako` y la caja es `CajaChat` (app/_chat/), con la estrella de MaKo al lado de lo que contesta.
// El motor sigue siendo el suyo (/api/chart-insights, o el `endpoint` que le pasen). Lo usan el Ads Manager y Marketing
// (`ChartIA`) y el Diagnóstico del Web Generator; el Dashboard ya no: sus gráficos le preguntan a la estrella de la tab
// (app/dashboard/pregunta-grafico.ts).

import '@/app/admin/operaciones/centro.css';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { fmtDDMMYYYY } from '@/lib/date-utils';
import { ASPECTO_MAKO } from '@/lib/centro-munecos';
import { CajaChat } from '@/app/_chat/CajaChat';
import { HiloMako } from '@/app/_chat/HiloMako';
import type { ItemHilo } from '@/app/m/mako/chat-ui';
import { ChatItemMenu } from './ChatItemMenu';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

// Preguntas sugeridas por defecto: si un gráfico no trae las suyas, igual
// SIEMPRE aparecen sugerencias (en todos los gráficos).
const DEFAULT_SUGERENCIAS = [
  '¿Qué es lo más importante aquí?',
  '¿Qué está fallando?',
  '¿Qué hago esta semana?',
  '¿Cómo lo mejoro?',
];

type Msg = { role: 'user' | 'assistant'; content: string; created_at?: string };
type Session = { id: number; titulo: string | null; updated_at: string; pinned?: boolean };

/** Quien contesta en el hilo: MaKo, con su estrella. */
const MAKO = { nombre: 'MaKo', aspecto: ASPECTO_MAKO };
const nada = () => {};

/** Los mensajes de la sesión como filas del hilo (`HiloMako`): sin id en la base, la posición es el id. */
function itemsDe(messages: readonly Msg[]): ItemHilo[] {
  return messages.map((m, i) => ({ k: 'msg', id: `c${i}`, role: m.role, texto: m.content, at: m.created_at ?? null }));
}

export function MakoChat({
  chartKey, titulo, contexto = '', sugerencias = [], chart, initialSessionId, sidebar = false,
  endpoint = '/api/chart-insights',
}: {
  chartKey: string; titulo: string; contexto?: string; sugerencias?: string[]; chart?: ReactNode; initialSessionId?: number; sidebar?: boolean;
  // Ruta del backend de chat. Default = insights por gráfico; el "doer" pasa
  // '/api/mako-doer' (mismo contrato, pero MaKo corre con herramientas).
  endpoint?: string;
}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(initialSessionId ?? null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [pensando, setPensando] = useState(false);
  const [input, setInput] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [verChats, setVerChats] = useState(false);
  const [chartAbierto, setChartAbierto] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [editVal, setEditVal] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  // Mientras MaKo piensa, los segundos (el «Trabajando…» del hilo los usa para avisar que puede tardar).
  const [desde, setDesde] = useState<number | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    if (!pensando) { setDesde(null); return; }
    setDesde(Date.now());
    setAhora(Date.now());
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [pensando]);
  const items = useMemo(() => itemsDe(messages), [messages]);
  // Sugerencias efectivas: las del gráfico, o el set por defecto si no trae.
  const sugs = sugerencias.length ? sugerencias : DEFAULT_SUGERENCIAS;

  const refrescarSesiones = async () => {
    const j = await fetch(`${endpoint}?chartKey=${encodeURIComponent(chartKey)}`).then((r) => r.json());
    setSessions(j.sessions ?? []);
    return (j.sessions ?? []) as Session[];
  };

  useEffect(() => {
    let alive = true;
    setErr(null);
    (async () => {
      try {
        if (initialSessionId) {
          const [mRes, sRes] = await Promise.all([
            fetch(`${endpoint}?sessionId=${initialSessionId}`).then((r) => r.json()),
            fetch(`${endpoint}?chartKey=${encodeURIComponent(chartKey)}`).then((r) => r.json()),
          ]);
          if (!alive) return;
          setMessages(mRes.messages ?? []); setSessions(sRes.sessions ?? []); setSessionId(initialSessionId);
        } else {
          setPensando(true);
          const j = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'open', chartKey, titulo, contexto }) }).then((r) => r.json());
          if (!alive) return;
          if (j.error) setErr(j.error); else { setSessions(j.sessions ?? []); setSessionId(j.session?.id ?? null); setMessages(j.messages ?? []); }
        }
      } catch (e) { if (alive) setErr(String(e)); } finally { if (alive) setPensando(false); }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartKey, initialSessionId]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, pensando]);

  const nuevoChat = async () => {
    if (pensando) return;
    setPensando(true); setErr(null); setVerChats(false); setMessages([]);
    try {
      const j = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'new', chartKey, titulo, contexto }) }).then((r) => r.json());
      if (j.error) setErr(j.error); else { setSessions(j.sessions ?? []); setSessionId(j.session?.id ?? null); setMessages(j.messages ?? []); }
    } catch (e) { setErr(String(e)); } finally { setPensando(false); }
  };

  const abrirSesion = async (id: number) => {
    setVerChats(false);
    if (id === sessionId) return;
    setPensando(true); setErr(null);
    try {
      const j = await fetch(`${endpoint}?sessionId=${id}`).then((r) => r.json());
      if (j.error) setErr(j.error); else { setMessages(j.messages ?? []); setSessionId(id); }
    } catch (e) { setErr(String(e)); } finally { setPensando(false); }
  };

  const accion = async (a: 'pin' | 'archive' | 'delete' | 'rename', id: number, extra: { valor?: boolean; titulo?: string } = {}) => {
    await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: a, sessionId: id, ...extra }) });
    const lista = await refrescarSesiones();
    if (a === 'delete' && id === sessionId) {
      const otra = lista[0];
      if (otra) abrirSesion(otra.id); else nuevoChat();
    }
  };

  const enviar = async (texto?: string) => {
    const txt = (texto ?? input).trim();
    if (!txt || pensando || !sessionId) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: txt }]);
    setPensando(true); setErr(null);
    try {
      const j = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send', sessionId, mensaje: txt }) }).then((r) => r.json());
      if (j.error) setErr(j.error); else { setMessages(j.messages ?? []); refrescarSesiones(); }
    } catch (e) { setErr(String(e)); } finally { setPensando(false); }
  };

  // Una fila de sesión (clara para el dropdown de la tab; oscura para el sidebar del modal).
  const sessionItem = (s: Session, dark: boolean) => {
    const activo = s.id === sessionId;
    return (
      <div key={s.id} style={{ padding: dark ? '8px 10px' : '9px 12px', borderRadius: dark ? 9 : 0, borderBottom: dark ? 'none' : '1px solid var(--border)', background: activo ? (dark ? 'var(--sidebar-2)' : 'var(--surface-2)') : 'transparent' }}>
        {editId === s.id ? (
          <input autoFocus value={editVal} onChange={(e) => setEditVal(e.target.value)} onBlur={() => { if (editVal.trim()) accion('rename', s.id, { titulo: editVal.trim() }); setEditId(null); }} onKeyDown={(e) => { if (e.key === 'Enter') { if (editVal.trim()) accion('rename', s.id, { titulo: editVal.trim() }); setEditId(null); } if (e.key === 'Escape') setEditId(null); }} style={{ width: '100%', padding: '6px 8px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13, outline: 'none' }} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <button type="button" onClick={() => abrirSesion(s.id)} style={{ display: 'block', flex: 1, minWidth: 0, textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontFamily: SANS }}>
              <div style={{ fontSize: 13, color: dark ? 'var(--on-sidebar)' : 'var(--ink)', fontWeight: activo ? 600 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.pinned && <span style={{ color: 'var(--accent-soft)', fontWeight: 600 }}>Fijado · </span>}{s.titulo || 'Chat'}</div>
              <div style={{ fontFamily: MONO, fontSize: 10.5, color: dark ? 'var(--sidebar-text)' : 'var(--faint)', marginTop: 2 }}>{fmtDDMMYYYY(s.updated_at.slice(0, 10))}</div>
            </button>
            <ChatItemMenu
              dark={dark}
              pinned={s.pinned}
              onRename={() => { setEditId(s.id); setEditVal(s.titulo || ''); }}
              onPin={() => accion('pin', s.id, { valor: !s.pinned })}
              onArchive={() => accion('archive', s.id, { valor: true })}
              onDelete={() => accion('delete', s.id)}
            />
          </div>
        )}
      </div>
    );
  };

  const chartToggleBtn = chart ? (
    <button type="button" onClick={() => setChartAbierto((v) => !v)} style={{ padding: '6px 11px', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', fontFamily: SANS, fontSize: 12.5, cursor: 'pointer' }}>{chartAbierto ? 'Ocultar gráfico' : 'Ver gráfico'}</button>
  ) : null;

  const chartPane = chart && chartAbierto ? (
    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', flex: 'none', maxHeight: '40vh', overflowY: 'auto' }}>{chart}</div>
  ) : null;

  // El hilo del Ops Center (`.co-hilo` scrollea; la columna centra lo leído).
  const mensajesPane = (
    <div ref={scrollRef} className="co-hilo" style={{ padding: '16px 20px' }}>
      <div className="co-hilo__col">
        <HiloMako items={items} quien={MAKO} ahora={ahora} escribiendo={pensando ? { segs: desde != null ? Math.max(0, Math.round((ahora - desde) / 1000)) : 0 } : null}
          tarjeta={null} onTarjeta={nada} onReintentar={nada} onRecargar={nada} />
        {err && <p className="co-nota co-nota--mal" role="alert">{err}</p>}
      </div>
    </div>
  );

  // La caja única (app/_chat/CajaChat.tsx), con las sugerencias del gráfico arriba en una línea.
  const inputPane = (
    <div style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-2)', flex: 'none' }}>
      {sugs.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', overflowX: 'auto', padding: '12px 20px 0' }}>
          {sugs.map((s) => <button key={s} type="button" onClick={() => enviar(s)} disabled={pensando} style={{ flex: 'none', whiteSpace: 'nowrap', padding: '6px 12px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 12.5, cursor: pensando ? 'default' : 'pointer', opacity: pensando ? 0.55 : 1 }}>{s}</button>)}
        </div>
      )}
      <div style={{ padding: '12px 20px 14px' }}>
        <div className="co-caja">
          <CajaChat texto={input} onTexto={setInput} onMandar={() => { void enviar(); }} ocupado={pensando} apagado={!sessionId}
            placeholder="Pregúntale a MaKo…" tituloMandar="Enviar" enterManda />
        </div>
      </div>
    </div>
  );

  // Modal (ChartIA): sidebar negro a la izquierda con los chats — sin dropdown encimado.
  if (sidebar) {
    return (
      <div style={{ display: 'flex', height: '100%', minHeight: 0, fontFamily: SANS }}>
        <aside style={{ width: 212, flex: 'none', background: 'var(--sidebar)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: 12, flex: 'none' }}>
            <button type="button" onClick={nuevoChat} disabled={pensando} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: pensando ? 'default' : 'pointer', opacity: pensando ? 0.6 : 1 }}>+ Nuevo chat</button>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 8px 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>
            {sessions.length === 0 ? <div style={{ padding: '10px 12px', fontSize: 12.5, color: 'var(--sidebar-text)' }}>Sin chats previos.</div> : sessions.map((s) => sessionItem(s, true))}
          </div>
        </aside>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {chart && <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 16px', borderBottom: '1px solid var(--border)', flex: 'none' }}>{chartToggleBtn}</div>}
          {chartPane}
          {mensajesPane}
          {inputPane}
        </div>
      </div>
    );
  }

  // Tab "Preguntale a MaKo": barra arriba con el dropdown de chats (la lista grande la pone la tab).
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, fontFamily: SANS }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--border)', flex: 'none', position: 'relative' }}>
        <button type="button" onClick={() => setVerChats((v) => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, cursor: 'pointer' }}>Chats <span style={{ color: 'var(--faint)' }}>({sessions.length})</span> <span style={{ fontSize: 10 }}>▾</span></button>
        <button type="button" onClick={nuevoChat} disabled={pensando} style={{ padding: '6px 11px', borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: pensando ? 'default' : 'pointer', opacity: pensando ? 0.6 : 1 }}>+ Nuevo chat</button>
        {chartToggleBtn && <div style={{ marginLeft: 'auto' }}>{chartToggleBtn}</div>}
        {verChats && (
          <>
            <div onClick={() => setVerChats(false)} style={{ position: 'fixed', inset: 0, zIndex: 1 }} aria-hidden />
            <div style={{ position: 'absolute', top: 46, left: 16, zIndex: 2, width: 330, maxWidth: '88vw', maxHeight: '54vh', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 18px 44px rgba(18,21,27,.2)' }}>
              {sessions.length === 0 ? <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--faint)' }}>Sin chats previos.</div> : sessions.map((s) => sessionItem(s, false))}
            </div>
          </>
        )}
      </div>
      {chartPane}
      {mensajesPane}
      {inputPane}
    </div>
  );
}
