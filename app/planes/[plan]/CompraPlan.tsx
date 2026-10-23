'use client';

// El formulario del checkout de un plan: nombre, email, con qué pagar (si hay dos pasarelas) y a la pasarela. Postea a
// /api/planes/comprar (nunca una server action: la página es pública) y redirige al link /pagar/<token> que devuelve.

import { useState } from 'react';
import type { Pasarela } from '@/lib/cobros-tipos';
import type { OrigenCompra } from '@/lib/compra-plan-reglas';

const NOMBRE: Record<Pasarela, string> = { stripe: 'Tarjeta (Stripe)', mercadopago: 'Mercado Pago' };

export function CompraPlan(p: {
  plan: string;
  pasarelas: Array<{ pasarela: Pasarela; moneda: string; monto: number }>;
  origen: OrigenCompra | null;
  refCodigo: string | null;
}) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [web, setWeb] = useState('');
  const [pasarela, setPasarela] = useState<Pasarela | null>(p.pasarelas.length === 1 ? p.pasarelas[0].pasarela : null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    if (p.pasarelas.length > 1 && !pasarela) { setError('Elige con qué quieres pagar.'); return; }
    setEnviando(true);
    setError(null);
    try {
      const r = await fetch('/api/planes/comprar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: p.plan, nombre, email, pasarela, origen: p.origen, ref: p.refCodigo, web }),
      });
      const j = (await r.json().catch(() => ({}))) as { link?: string; error?: string };
      if (r.ok && j.link) { window.location.href = j.link; return; }
      setError(j.error ?? 'No pudimos abrir el pago. Prueba otra vez.');
    } catch {
      setError('No pudimos conectarnos. Revisa tu internet y prueba otra vez.');
    }
    setEnviando(false);
  }

  return (
    <form onSubmit={enviar} noValidate>
      <label htmlFor="cp-nombre">Tu nombre</label>
      <input id="cp-nombre" type="text" autoComplete="name" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
      <label htmlFor="cp-email">Tu email</label>
      <input id="cp-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <div className="planes-trampa" aria-hidden="true">
        <label htmlFor="cp-web">Web</label>
        <input id="cp-web" type="text" tabIndex={-1} autoComplete="off" value={web} onChange={(e) => setWeb(e.target.value)} />
      </div>
      {p.pasarelas.length > 1 && (
        <>
          <label>¿Con qué pagas?</label>
          {p.pasarelas.map((x) => (
            <label key={x.pasarela} className="planes-opcion">
              <input type="radio" name="pasarela" checked={pasarela === x.pasarela} onChange={() => setPasarela(x.pasarela)} />
              {NOMBRE[x.pasarela]}
            </label>
          ))}
        </>
      )}
      <button className="planes-btn" type="submit" disabled={enviando}>{enviando ? 'Abriendo el pago…' : 'Ir a pagar'}</button>
      {/* role="status" y no "alert": /planes es pública y sin sesión, así que «Reportar a soporte» no serviría acá. */}
      {error && <p className="planes-error" role="status" aria-live="polite">{error}</p>}
      <p className="planes-nota">Con ese email entras a MaKo: te llega el acceso apenas se confirme el pago.</p>
    </form>
  );
}
