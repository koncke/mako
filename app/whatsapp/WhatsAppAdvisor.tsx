'use client';

// =============================================================================
// WhatsAppAdvisor — MaKo en el panel del chat: qué escribirle a este lead
// =============================================================================
// Reemplaza "Plantillas rápidas". Lee la conversación real (en vivo) + la etapa +
// la ventana de 24h y, con la metodología "Levanta Muertos", recomienda mensajes
// listos para usar. Tiene dos modos: Consejo (recomendaciones) y Chat (preguntá).
// El historial del chat se guarda por contacto (en el backend).

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { MakoLoader } from '../_components/MakoLoader';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

type Sugerencia = { angulo: string; tono: string; texto: string; guion_voz?: string };
type Recomendacion = { diagnostico: string; etapa: string; ventana_nota: string; sugerencias: Sugerencia[] };
type Msg = { role: 'user' | 'assistant'; content: string };

export type AdvisorGrupo = { id: string; contacto: string; empresa?: string | null; etapaLabel?: string | null };
type WaMsgLite = { saliente: boolean; texto: string | null };

const SUGS_CHAT = ['Hazlo más corto', 'Dame una versión con nota de voz', '¿Cómo manejo la objeción de precio?', 'Reescribilo más cálido'];

const ANGULO_LABEL: Record<string, string> = {
  valor: 'Valor', curiosidad: 'Curiosidad', prueba_social: 'Prueba social',
  objecion: 'Objeción', cierre_suave: 'Cierre suave', depuracion: 'Depuración', urgencia_suave: 'Urgencia suave',
};
const TONO_LABEL: Record<string, string> = { directo: 'Directo', calido: 'Cálido', con_gancho: 'Con gancho' };

function InlineMd({ text }: { text: string }): ReactNode {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
        /^\*\*[^*]+\*\*$/.test(p) ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>,
      )}
    </>
  );
}

const btnDark: CSSProperties = { padding: '9px 14px', borderRadius: 10, border: 'none', background: '#14161B', color: '#F3F5F8', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const btnGhost: CSSProperties = { padding: '6px 11px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 12, fontWeight: 600, cursor: 'pointer' };
const chip = (bg: string, fg: string): CSSProperties => ({ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: bg, color: fg });

export function WhatsAppAdvisor({
  grupo, mensajes, ventanaAbierta, onUsar, onRedactarPlantilla, quickTemplates,
}: {
  grupo: AdvisorGrupo;
  mensajes: WaMsgLite[];
  ventanaAbierta: boolean;
  onUsar: (texto: string) => void;
  onRedactarPlantilla: (seed?: { objetivo: string; etapa: string }) => void;
  quickTemplates: string[];
}) {
  const [tab, setTab] = useState<'consejo' | 'chat'>('consejo');
  const [rec, setRec] = useState<Recomendacion | null>(null);
  const [analizando, setAnalizando] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  // Chat
  const [chat, setChat] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [pensando, setPensando] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Cache de la última recomendación por contacto → volver a un chat no recomputa.
  const recCacheRef = useRef<Map<string, Recomendacion>>(new Map());
  // Snapshot de los mensajes actuales, para mandarlos en el momento del pedido.
  const mensajesRef = useRef<WaMsgLite[]>(mensajes);
  mensajesRef.current = mensajes;
  // Id del contacto vigente: descarta respuestas de un análisis que quedó viejo
  // porque cambiaste de chat mientras cargaba (no filtra el consejo de A en B).
  const grupoIdRef = useRef(grupo.id);
  grupoIdRef.current = grupo.id;

  const payloadBase = () => ({
    groupId: grupo.id,
    contacto: grupo.contacto,
    empresa: grupo.empresa ?? null,
    etapaLabel: grupo.etapaLabel ?? null,
    ventanaAbierta,
    mensajes: mensajesRef.current.map((m) => ({ saliente: m.saliente, texto: m.texto })),
  });

  // Al cambiar de contacto: recuperar la recomendación cacheada y cargar el chat.
  useEffect(() => {
    setRec(recCacheRef.current.get(grupo.id) ?? null);
    setAnalizando(false); // no arrastrar el loader de un análisis de otro contacto
    setRecError(null); setChatError(null); setInput('');
    let alive = true;
    (async () => {
      try {
        const j = await fetch('/api/whatsapp/advisor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'history', groupId: grupo.id }) }).then((r) => r.json());
        if (alive) setChat(j.ok ? (j.messages ?? []).map((m: Msg) => ({ role: m.role, content: m.content })) : []);
      } catch { if (alive) setChat([]); }
    })();
    return () => { alive = false; };
  }, [grupo.id]);

  useEffect(() => { if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight; }, [chat, pensando, tab]);

  const analizar = async () => {
    if (analizando) return;
    const reqId = grupo.id; // el contacto para el que pedimos este análisis
    setAnalizando(true); setRecError(null);
    try {
      const j = await fetch('/api/whatsapp/advisor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'recommend', ...payloadBase() }) }).then((r) => r.json());
      if (j.ok) recCacheRef.current.set(reqId, j.recomendacion); // cachear siempre, aunque hayas cambiado de chat
      if (grupoIdRef.current !== reqId) return; // cambiaste de contacto: no pises su vista
      if (j.ok) setRec(j.recomendacion);
      else setRecError(j.error || 'No se pudo analizar.');
    } catch (e) { if (grupoIdRef.current === reqId) setRecError(e instanceof Error ? e.message : String(e)); }
    finally { if (grupoIdRef.current === reqId) setAnalizando(false); }
  };

  const enviarChat = async (texto?: string) => {
    const txt = (texto ?? input).trim();
    if (!txt || pensando) return;
    setInput(''); setChatError(null);
    setChat((c) => [...c, { role: 'user', content: txt }]);
    setPensando(true);
    try {
      const j = await fetch('/api/whatsapp/advisor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'chat', mensaje: txt, ...payloadBase() }) }).then((r) => r.json());
      if (j.ok) setChat((j.messages ?? []).map((m: Msg) => ({ role: m.role, content: m.content })));
      else { setChatError(j.error || 'No se pudo responder.'); }
    } catch (e) { setChatError(e instanceof Error ? e.message : String(e)); }
    finally { setPensando(false); }
  };

  const copiar = (texto: string, key: string) => {
    void navigator.clipboard?.writeText(texto);
    setCopiado(key); setTimeout(() => setCopiado((k) => (k === key ? null : k)), 1500);
  };

  const ultimoEntrante = mensajes.length > 0 && !mensajes[mensajes.length - 1].saliente;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
        <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>✨ MaKo — qué escribir</div>
        <div style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 9, padding: 3, gap: 3 }}>
          {(['consejo', 'chat'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '4px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: SANS, fontSize: 11.5, fontWeight: 600, background: tab === t ? 'var(--ink)' : 'transparent', color: tab === t ? 'var(--on-sidebar)' : 'var(--dim)' }}>{t === 'consejo' ? 'Consejo' : 'Chat'}</button>
          ))}
        </div>
      </div>

      {/* ── CONSEJO ── */}
      {tab === 'consejo' && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!rec && !analizando && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>
                {ultimoEntrante ? 'El lead escribió último. Pídele a MaKo qué responder, con la metodología Levanta Muertos.' : 'MaKo lee esta conversación y te sugiere qué escribirle para reactivarlo, sin sonar a seguimiento.'}
              </div>
              <button onClick={analizar} style={{ ...btnDark, width: '100%' }}>✨ Analizar conversación</button>
            </div>
          )}
          {analizando && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
              <MakoLoader width={64} /><span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--faint)' }}>leyendo el chat…</span>
            </div>
          )}
          {recError && <div style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 10, padding: '9px 11px', color: 'var(--bad)', fontSize: 12.5 }}>{recError}</div>}

          {rec && !analizando && (
            <>
              <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '11px 12px' }}>
                <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.5 }}><InlineMd text={rec.diagnostico} /></div>
                {rec.ventana_nota && <div style={{ fontSize: 11.5, color: ventanaAbierta ? 'var(--good)' : 'var(--warn)', marginTop: 7, fontWeight: 600 }}>{ventanaAbierta ? '🟢' : '🔒'} {rec.ventana_nota}</div>}
              </div>

              {rec.sugerencias.map((s, i) => (
                <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '11px 12px', background: 'var(--surface)' }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 7, flexWrap: 'wrap' }}>
                    <span style={chip('var(--accent-soft)', '#14161B')}>{ANGULO_LABEL[s.angulo] ?? s.angulo}</span>
                    <span style={chip('var(--surface-2)', 'var(--dim)')}>{TONO_LABEL[s.tono] ?? s.tono}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{s.texto}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 9 }}>
                    <button onClick={() => onUsar(s.texto)} style={{ ...btnGhost, borderColor: 'var(--good)', color: 'var(--good)' }}>Usar →</button>
                    <button onClick={() => copiar(s.texto, `s${i}`)} style={btnGhost}>{copiado === `s${i}` ? '✓ Copiado' : 'Copiar'}</button>
                  </div>
                  {s.guion_voz && (
                    <details style={{ marginTop: 8 }}>
                      <summary style={{ fontSize: 11.5, color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>🎙️ Guion de nota de voz</summary>
                      <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5, whiteSpace: 'pre-wrap', marginTop: 6 }}>{s.guion_voz}</div>
                      <button onClick={() => copiar(s.guion_voz!, `v${i}`)} style={{ ...btnGhost, marginTop: 6 }}>{copiado === `v${i}` ? '✓ Copiado' : 'Copiar guion'}</button>
                    </details>
                  )}
                </div>
              ))}

              {!ventanaAbierta && (
                <button
                  onClick={() => onRedactarPlantilla({
                    objetivo: `Reactivar a ${grupo.contacto}. ${rec.diagnostico}`,
                    etapa: ['pidio_info', 'vio_propuesta', 'objecion', 'frio', 'depuracion'].includes(rec.etapa) ? rec.etapa : 'frio',
                  })}
                  style={{ ...btnGhost, width: '100%', padding: '9px 12px', borderColor: 'var(--warn)', color: 'var(--warn)' }}
                >🔒 Ventana cerrada → redactar plantilla con MaKo</button>
              )}
              <button onClick={analizar} style={{ ...btnGhost, width: '100%' }}>↻ Volver a analizar</button>
            </>
          )}

          {/* Plantillas rápidas (accesos directos de siempre) */}
          {quickTemplates.length > 0 && (
            <div style={{ marginTop: 4, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 8 }}>Atajos</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {quickTemplates.map((t) => (
                  <button key={t} onClick={() => onUsar(t)} style={{ textAlign: 'left', padding: '8px 11px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--dim)', fontFamily: SANS, fontSize: 12.5, cursor: 'pointer' }}>{t}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CHAT ── */}
      {tab === 'chat' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div ref={chatScrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 9, paddingRight: 2 }}>
            {chat.length === 0 && !pensando && (
              <div style={{ fontSize: 12.5, color: 'var(--faint)', lineHeight: 1.5 }}>Pregúntale a MaKo sobre este lead: cómo responderle, cómo manejar una objeción, o pídele una versión distinta de un mensaje.</div>
            )}
            {chat.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '92%', background: m.role === 'user' ? 'var(--accent-soft)' : 'var(--surface-2)', color: m.role === 'user' ? '#14161B' : 'var(--ink)', border: m.role === 'user' ? 'none' : '1px solid var(--border)', borderRadius: 12, padding: '9px 11px', fontSize: 12.5, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                <InlineMd text={m.content} />
                {m.role === 'assistant' && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 7 }}>
                    <button onClick={() => onUsar(m.content)} style={{ ...btnGhost, padding: '4px 9px', fontSize: 11, borderColor: 'var(--good)', color: 'var(--good)' }}>Usar →</button>
                    <button onClick={() => copiar(m.content, `c${i}`)} style={{ ...btnGhost, padding: '4px 9px', fontSize: 11 }}>{copiado === `c${i}` ? '✓' : 'Copiar'}</button>
                  </div>
                )}
              </div>
            ))}
            {pensando && <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8 }}><MakoLoader width={54} /><span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)' }}>pensando…</span></div>}
            {chatError && <div style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 10, padding: '8px 10px', color: 'var(--bad)', fontSize: 12 }}>{chatError}</div>}
          </div>
          <div style={{ flex: 'none', paddingTop: 8 }}>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8 }}>
              {SUGS_CHAT.map((s) => <button key={s} onClick={() => enviarChat(s)} disabled={pensando} style={{ flex: 'none', whiteSpace: 'nowrap', padding: '5px 10px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 11.5, cursor: pensando ? 'default' : 'pointer', opacity: pensando ? 0.55 : 1 }}>{s}</button>)}
            </div>
            <div style={{ display: 'flex', gap: 7 }}>
              <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void enviarChat(); } }} rows={1} placeholder="Pregúntale a MaKo…" disabled={pensando} style={{ flex: 1, padding: '9px 11px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13, outline: 'none', resize: 'none', minHeight: 40, maxHeight: 110, lineHeight: 1.4 }} />
              <button onClick={() => void enviarChat()} disabled={pensando || !input.trim()} style={{ ...btnDark, opacity: pensando || !input.trim() ? 0.5 : 1 }}>▲</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
