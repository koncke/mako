'use client';

// «Lo quiero» sin pasarela (24/10/2026, sin Calendly): nombre, email y WhatsApp. Postea a /api/planes/comprar con
// `quiero: true` (lib/compra-plan.ts, `pedirPlanSinPasarela`): queda el pedido en el CRM de MaKo con el plan, de dónde vino
// y el código de partner, y el equipo escribe por WhatsApp para dar el alta. Nunca dice «pagaste» ni abre un pago.

import { useState } from 'react';
import type { OrigenCompra } from '@/lib/compra-plan-reglas';

export function QuieroPlan(p: { plan: string; nombrePlan: string; origen: OrigenCompra | null; refCodigo: string | null }) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [web, setWeb] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const r = await fetch('/api/planes/comprar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: p.plan, nombre, email, whatsapp, quiero: true, origen: p.origen, ref: p.refCodigo, web }),
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (r.ok && j.ok) { setListo(true); setEnviando(false); return; }
      setError(j.error ?? 'No pudimos registrar tu pedido. Prueba otra vez.');
    } catch {
      setError('No pudimos conectarnos. Revisa tu internet y prueba otra vez.');
    }
    setEnviando(false);
  }

  if (listo) {
    return (
      <div role="status" aria-live="polite">
        <p className="planes-sub" style={{ marginBottom: 6, color: '#12151B', fontWeight: 600 }}>¡Listo! Recibimos tu pedido de {p.nombrePlan}.</p>
        <p className="planes-sub">Te escribimos por WhatsApp para darte de alta. Con tu email entras a MaKo.</p>
      </div>
    );
  }
  return (
    <form onSubmit={enviar} noValidate>
      <label htmlFor="qp-nombre">Tu nombre</label>
      <input id="qp-nombre" type="text" autoComplete="name" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
      <label htmlFor="qp-email">Tu email</label>
      <input id="qp-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <label htmlFor="qp-wa">Tu WhatsApp, con el código de país</label>
      <input id="qp-wa" type="tel" autoComplete="tel" inputMode="tel" placeholder="+54 9 11 1234 5678" value={whatsapp}
        onChange={(e) => setWhatsapp(e.target.value)} required />
      <div className="planes-trampa" aria-hidden="true">
        <label htmlFor="qp-web">Web</label>
        <input id="qp-web" type="text" tabIndex={-1} autoComplete="off" value={web} onChange={(e) => setWeb(e.target.value)} />
      </div>
      <button className="planes-btn" type="submit" disabled={enviando}>{enviando ? 'Enviando…' : `Quiero ${p.nombrePlan}`}</button>
      {error && <p className="planes-error" role="status" aria-live="polite">{error}</p>}
      <p className="planes-nota">No se te cobra nada ahora: te escribimos para darte de alta.</p>
    </form>
  );
}
