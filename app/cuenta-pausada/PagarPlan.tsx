'use client';

// El botón de /cuenta-pausada (y de «Tu plan»): pagar lo que quedó pendiente, o reactivar el plan que terminó. Pide el
// link a /api/plan/pagar y va. Si la deuda está paga y falta reactivar, lo dice y ofrece reactivar.

import { useState } from 'react';
import { Button } from '@/app/_ui/Button';

export function PagarPlan(p: { accion: 'deuda' | 'reactivar'; texto: string }) {
  const [accion, setAccion] = useState(p.accion);
  const [texto, setTexto] = useState(p.texto);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function ir() {
    if (enviando) return;
    setEnviando(true);
    setAviso(null);
    try {
      const r = await fetch('/api/plan/pagar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion }) });
      const j = (await r.json().catch(() => ({}))) as { url?: string; texto?: string; error?: string; reactivar?: boolean; deuda?: boolean };
      if (j.url) {
        if (j.texto) setAviso(j.texto);
        window.location.href = j.url;
        return;
      }
      if (j.reactivar) { setAccion('reactivar'); setTexto('Reactivar mi plan'); setAviso('No queda nada pendiente: reactiva tu plan para volver a entrar.'); }
      else if (j.deuda) { setAccion('deuda'); setTexto('Pagar lo pendiente'); setAviso(j.error ?? null); }
      else setAviso(j.error ?? 'No pudimos abrir el pago. Prueba otra vez.');
    } catch {
      setAviso('No pudimos conectarnos. Prueba otra vez.');
    }
    setEnviando(false);
  }

  return (
    <div>
      <Button variant="primary" onClick={ir} disabled={enviando}>{enviando ? 'Abriendo el pago…' : texto}</Button>
      {aviso && <p style={{ margin: '12px 0 0', fontSize: 'var(--fs-sm)', color: 'var(--dim)' }} role="status">{aviso}</p>}
    </div>
  );
}
