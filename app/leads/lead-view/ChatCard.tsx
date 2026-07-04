'use client';

// =============================================================================
// ChatCard — hilo de WhatsApp del lead dentro de la ficha (solo lectura)
// =============================================================================
// Lee /api/whatsapp/lead/<id> (contacto resuelto por teléfono, mensajes
// mergeados). Para RESPONDER se abre /whatsapp?lead=<id>: ahí vive la lógica
// de ventana de 24h, plantillas y adjuntos. Acá solo se lee el hilo.

import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties } from 'react';

const MONO = "'Geist Mono', monospace";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };

type Mensaje = {
  id: number;
  texto: string | null;
  saliente: boolean;
  fecha: number | null;      // unix seconds
  template: string | null;
  status: string | null;
  error: string | null;
  adjuntos: Array<{ tipo: string; url: string; ext: string | null }>;
  /** 0 entrante · 1 saliente · 2 actividad de sistema · 3 plantilla (saliente). */
  messageType?: number;
};

type Estado =
  | { fase: 'cargando' }
  | { fase: 'error' }
  | { fase: 'sin-telefono' }
  | { fase: 'sin-chat' }
  | { fase: 'ok'; contactId: number; mensajes: Mensaje[] };

const TZ = 'America/Tijuana';
const fmtDia = (ts: number) =>
  new Date(ts * 1000).toLocaleDateString('es-MX', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtHora = (ts: number) =>
  new Date(ts * 1000).toLocaleTimeString('es-MX', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });

export function ChatCard({ leadId }: { leadId: number }) {
  const [estado, setEstado] = useState<Estado>({ fase: 'cargando' });
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const res = await fetch(`/api/whatsapp/lead/${leadId}`);
        const j = await res.json();
        if (!vivo) return;
        if (!j.ok) { setEstado({ fase: 'error' }); return; }
        if (j.sinTelefono) { setEstado({ fase: 'sin-telefono' }); return; }
        if (!j.contactId) { setEstado({ fase: 'sin-chat' }); return; }
        // Las actividades de sistema de Chatwoot ("conversación resuelta") no
        // son parte del hilo; las plantillas (type 3) son mensajes NUESTROS.
        const mensajes = ((j.mensajes ?? []) as Mensaje[])
          .filter((m) => m.messageType !== 2)
          .map((m) => (m.messageType === 3 ? { ...m, saliente: true } : m));
        setEstado({ fase: 'ok', contactId: j.contactId, mensajes });
      } catch {
        if (vivo) setEstado({ fase: 'error' });
      }
    })();
    return () => { vivo = false; };
  }, [leadId]);

  // Al cargar el hilo, arrancar abajo (lo último que se dijo).
  useEffect(() => {
    if (estado.fase === 'ok' && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [estado]);

  const abrirBtn: CSSProperties = { display: 'inline-block', fontSize: 13, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' };

  if (estado.fase === 'cargando') {
    return (
      <section style={card} aria-busy="true">
        <div style={{ ...sectLabel, marginBottom: 14 }}>Chat de WhatsApp</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[64, 44, 56].map((w, i) => (
            <div key={i} style={{ height: 38, width: `${w}%`, borderRadius: 12, background: 'var(--surface-2)', alignSelf: i === 1 ? 'flex-end' : 'flex-start' }} />
          ))}
        </div>
      </section>
    );
  }

  if (estado.fase === 'sin-telefono') {
    return (
      <section style={card}>
        <div style={{ ...sectLabel, marginBottom: 10 }}>Chat de WhatsApp</div>
        <p style={{ fontSize: 14, color: 'var(--faint)' }}>Este lead no tiene teléfono cargado — sin teléfono no hay chat. Cargalo con Editar y el hilo aparece acá.</p>
      </section>
    );
  }

  if (estado.fase === 'sin-chat' || estado.fase === 'error') {
    return (
      <section style={card}>
        <div style={{ ...sectLabel, marginBottom: 10 }}>Chat de WhatsApp</div>
        <p style={{ fontSize: 14, color: 'var(--faint)' }}>
          {estado.fase === 'error'
            ? 'No se pudo cargar el chat. Reintentá en un momento.'
            : 'Todavía no hay chat de WhatsApp para este número. Los leads nuevos ya entran con su chat creado; a este podés escribirle desde WhatsApp y el hilo aparece acá.'}
        </p>
      </section>
    );
  }

  const { mensajes } = estado;

  return (
    <section style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
        <div style={sectLabel}>Chat de WhatsApp</div>
        <Link href={`/whatsapp?lead=${leadId}`} style={abrirBtn}>Responder en WhatsApp →</Link>
      </div>

      {mensajes.length === 0 ? (
        <p style={{ fontSize: 14, color: 'var(--faint)' }}>El chat existe pero todavía no tiene mensajes. Escribile desde el botón de arriba.</p>
      ) : (
        <div ref={scrollRef} style={{ maxHeight: 480, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
          {mensajes.map((m, i) => {
            const dia = m.fecha ? fmtDia(m.fecha) : '';
            const anterior = mensajes[i - 1];
            const diaAnterior = anterior?.fecha ? fmtDia(anterior.fecha) : '';
            const conSeparador = !!dia && dia !== diaAnterior;
            return (
              <div key={m.id} style={{ display: 'flex', flexDirection: 'column' }}>
                {conSeparador && (
                  <div style={{ alignSelf: 'center', fontFamily: MONO, fontSize: 11, color: 'var(--faint)', padding: '8px 0 6px' }}>{dia}</div>
                )}
                <div style={{ alignSelf: m.saliente ? 'flex-end' : 'flex-start', maxWidth: '78%', padding: '9px 13px', borderRadius: 13, background: m.saliente ? 'var(--primary)' : 'var(--surface-2)', color: m.saliente ? '#fff' : 'var(--ink)', border: m.saliente ? 'none' : '1px solid var(--border)' }}>
                  {m.template && (
                    <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.05em', opacity: 0.75, marginBottom: 3 }}>Plantilla · {m.template}</div>
                  )}
                  {m.texto && <div style={{ fontSize: 13.5, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.texto}</div>}
                  {m.adjuntos.map((a, i) => (
                    <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginTop: m.texto ? 6 : 0, color: m.saliente ? '#fff' : 'var(--primary)', textDecoration: 'underline' }}>
                      📎 {a.tipo}{a.ext ? ` (.${a.ext})` : ''}
                    </a>
                  ))}
                  <div style={{ fontSize: 10.5, opacity: 0.7, marginTop: 4, textAlign: 'right', fontFamily: MONO }}>
                    {m.fecha ? fmtHora(m.fecha) : ''}
                    {m.saliente && m.status === 'failed' && <span style={{ marginLeft: 6, fontWeight: 700 }}>✕ no llegó</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
