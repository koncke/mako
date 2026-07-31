'use client';

// =============================================================================
// SimuladorWhatsApp — teléfono simulado de la tab /setting
// =============================================================================
// Dos cosas en el mismo chat: (1) "ver la secuencia en vivo" — los pasos de
// WhatsApp de la jugada aparecen uno a uno como burbujas salientes, con su
// timing anotado; (2) conversación: el dueño escribe COMO EL LEAD y MaKo
// responde en el rol de setter (POST /api/setting/simulador). Sandbox puro.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { JugadaDto } from './SettingApp';

type Burbuja =
  | { tipo: 'paso'; texto: string; timing: string }
  | { tipo: 'negocio'; texto: string }
  | { tipo: 'lead'; texto: string }
  | { tipo: 'nota'; texto: string };

// Variables de plantilla → valores de un lead de prueba (solo visual).
function conVars(s: string): string {
  return s
    .replace(/\{\{\s*nombre\s*\}\}/gi, 'Juan')
    .replace(/\{\{\s*apellido\s*\}\}/gi, 'Pérez')
    .replace(/\{\{\s*empresa\s*\}\}/gi, 'Acme SRL');
}

function fmtTiming(p: { delay_horas: number; ancla?: 'reunion' }): string {
  const h = p.delay_horas;
  if (p.ancla === 'reunion') return h <= 1 ? '1h antes de la reunión' : h < 24 ? `${h}h antes de la reunión` : `${Math.round(h / 24)} día(s) antes de la reunión`;
  if (h <= 1) return 'al entrar a la etapa';
  if (h < 24) return `a las ${h}h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'al día siguiente' : `a los ${d} días`;
}

export function SimuladorWhatsApp({ jugada, nombreNegocio }: { jugada: JugadaDto | null; nombreNegocio: string }) {
  const [burbujas, setBurbujas] = useState<Burbuja[]>([]);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  // Reset al cambiar de jugada + limpiar timers pendientes al desmontar.
  useEffect(() => {
    setBurbujas([]); setErr(null); setReproduciendo(false);
    const t = timers.current;
    return () => { for (const id of t) window.clearTimeout(id); timers.current = []; };
  }, [jugada?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [burbujas, pensando]);

  const pasosWa = (jugada?.pasos ?? []).filter((p) => p.canal === 'whatsapp');

  function simularSecuencia() {
    if (!jugada || reproduciendo) return;
    setErr(null); setReproduciendo(true);
    setBurbujas([{ tipo: 'nota', texto: `Así le llega la secuencia a un lead que entra a la etapa` }]);
    pasosWa.forEach((p, i) => {
      const id = window.setTimeout(() => {
        setBurbujas((prev) => [...prev, { tipo: 'paso', texto: conVars(p.cuerpo), timing: fmtTiming(p) }]);
        if (i === pasosWa.length - 1) {
          setBurbujas((prev) => [...prev, { tipo: 'nota', texto: 'Fin de la secuencia — ahora escribí abajo como si fueras el lead y mirá cómo responde MaKo' }]);
          setReproduciendo(false);
        }
      }, 700 * (i + 1));
      timers.current.push(id);
    });
    if (pasosWa.length === 0) {
      setBurbujas((prev) => [...prev, { tipo: 'nota', texto: 'Esta jugada no tiene pasos de WhatsApp — igual podés chatear: escribí abajo como el lead' }]);
      setReproduciendo(false);
    }
  }

  async function enviar() {
    const t = texto.trim();
    if (!jugada || !t || pensando) return;
    setTexto(''); setErr(null);
    const nuevas: Burbuja[] = [...burbujas, { tipo: 'lead', texto: t }];
    setBurbujas(nuevas);
    setPensando(true);
    try {
      // El historial del simulador: pasos y respuestas del negocio = 'negocio'.
      const historial = nuevas
        .filter((b): b is Exclude<Burbuja, { tipo: 'nota' }> => b.tipo !== 'nota')
        .map((b) => ({ de: b.tipo === 'lead' ? 'lead' : 'negocio', texto: b.texto }));
      const r = await fetch('/api/setting/simulador', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secuenciaId: jugada.id, historial }),
      });
      const j = await r.json();
      if (!j.ok) { setErr(j.error || 'MaKo no pudo responder.'); return; }
      setBurbujas((prev) => [...prev, { tipo: 'negocio', texto: j.respuesta }]);
    } catch {
      setErr('Sin conexión — probá de nuevo.');
    } finally {
      setPensando(false);
    }
  }

  const burLead: CSSProperties = { alignSelf: 'flex-start', maxWidth: '78%', padding: '9px 13px', borderRadius: '14px 14px 14px 4px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)', fontSize: '13.5px', lineHeight: 1.5, whiteSpace: 'pre-wrap' };
  const burNegocio: CSSProperties = { alignSelf: 'flex-end', maxWidth: '78%', padding: '9px 13px', borderRadius: '14px 14px 4px 14px', background: 'var(--wa-bubble)', border: '1px solid var(--wa)', color: 'var(--ink)', fontSize: '13.5px', lineHeight: 1.5, whiteSpace: 'pre-wrap' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: 430, height: 640, borderRadius: 26, border: '1px solid var(--border-strong)', background: 'var(--surface)', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
      {/* Header estilo WhatsApp */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 16px', background: 'var(--wa)', color: '#fff' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15 }}>
          {(nombreNegocio || 'M').slice(0, 1).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombreNegocio || 'Tu negocio'}</div>
          <div style={{ fontSize: 11.5, opacity: 0.85 }}>{pensando ? 'escribiendo…' : 'en línea'}</div>
        </div>
        <button onClick={simularSecuencia} disabled={!jugada || reproduciendo}
          style={{ padding: '6px 12px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.15)', color: '#fff', fontFamily: "'Geist', sans-serif", fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: !jugada || reproduciendo ? 0.5 : 1 }}>
          ▶ Simular secuencia
        </button>
      </div>

      {/* Chat */}
      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--surface-2)' }}>
        {burbujas.length === 0 && (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--faint)', fontSize: 13, lineHeight: 1.6, maxWidth: 280 }}>
            {jugada
              ? <>Tocá <strong style={{ color: 'var(--dim)' }}>▶ Simular secuencia</strong> para ver los mensajes salir en vivo, o escribí abajo como si fueras el lead.</>
              : 'Elegí una jugada arriba para simularla.'}
          </div>
        )}
        {burbujas.map((b, i) => {
          if (b.tipo === 'nota') return (
            <div key={i} style={{ alignSelf: 'center', padding: '5px 12px', borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--faint)', fontSize: 11 }}>{b.texto}</div>
          );
          if (b.tipo === 'lead') return <div key={i} style={burLead}>{b.texto}</div>;
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
              {b.tipo === 'paso' && <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>⏱ {b.timing}</span>}
              <div style={burNegocio}>{b.texto}</div>
            </div>
          );
        })}
        {pensando && <div style={{ ...burNegocio, color: 'var(--faint)' }}>···</div>}
      </div>

      {err && <div style={{ padding: '8px 14px', fontSize: 12, color: 'var(--bad)', background: 'var(--bad-bg)' }}>{err}</div>}

      {/* Input del lead */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void enviar(); }}
          placeholder={jugada ? 'Escribí como el lead…' : 'Elegí una jugada primero'}
          disabled={!jugada || pensando}
          style={{ flex: 1, padding: '10px 14px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: 13.5, outline: 'none' }}
        />
        <button onClick={() => void enviar()} disabled={!jugada || pensando || !texto.trim()}
          style={{ width: 42, height: 42, borderRadius: '50%', border: 'none', background: 'var(--wa)', color: '#fff', fontSize: 16, cursor: 'pointer', opacity: !jugada || pensando || !texto.trim() ? 0.5 : 1 }}>➤</button>
      </div>
    </div>
  );
}
