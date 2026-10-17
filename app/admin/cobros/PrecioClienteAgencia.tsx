'use client';

// =============================================================================
// PrecioClienteAgencia — lo que MaKo le cobra a una agencia por cada cliente (#866, 17/10/2026)
// =============================================================================
// Martín, en la llamada con Código Inmobiliario (16/10, «Revisión de MaKo»): 47 dólares por cliente. La Mercado Pago de
// MaKo cobra en pesos, así que el monto en pesos lo pone él acá: MaKo no inventa una tasa de cambio. Sin ese monto, abrirle
// la cuenta a un cliente de agencia queda como siempre (espera la aprobación) y no sale el link del primer mes.
// Las reglas, en lib/agencia-cobro-reglas.ts.

import { useState, useTransition } from 'react';
import { Button, Toast, useToast } from '@/app/_ui';
import type { PrecioClienteAgencia as Precio } from '@/lib/agencia-cobro-reglas';
import { guardarPrecioClienteAgenciaAction } from './actions';

export default function PrecioClienteAgencia({ inicial, conMercadoPago }: { inicial: Precio; conMercadoPago: boolean }) {
  const [usd, setUsd] = useState(String(inicial.usd));
  const [monto, setMonto] = useState(inicial.mp ? String(inicial.mp.monto) : '');
  const [moneda, setMoneda] = useState(inicial.mp?.moneda ?? 'ARS');
  const [pending, start] = useTransition();
  const { toast, show, clear } = useToast();
  const n = (s: string): number | null => { const x = Number(s.replace(',', '.')); return s.trim() && Number.isFinite(x) && x > 0 ? x : null; };

  const guardar = () => start(async () => {
    const u = n(usd);
    if (u == null) { show('El precio en dólares tiene que ser mayor a cero', undefined, 'bad'); return; }
    const r = await guardarPrecioClienteAgenciaAction({ usd: u, moneda, monto: n(monto) });
    if (!r.ok) { show(r.error, undefined, 'bad'); return; }
    show('Precio guardado');
  });

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)', marginBottom: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <strong style={{ fontSize: 15, color: 'var(--ink)' }}>Cliente de agencia</strong>
        <span style={{ fontSize: 13, color: 'var(--dim)' }}>
          Lo que paga una agencia por cada cliente, cada mes. {conMercadoPago ? 'Se cobra con tu Mercado Pago.' : 'Conecta Mercado Pago para cobrarlo.'}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, color: 'var(--dim)' }}>
          Por mes (USD)
          <input className="mk-input" type="number" inputMode="decimal" min={0} value={usd} onChange={(e) => setUsd(e.target.value)} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, color: 'var(--dim)' }}>
          En Mercado Pago ({moneda})
          <input className="mk-input" type="number" inputMode="decimal" min={0} value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="Sin cargar" />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, color: 'var(--dim)' }}>
          Moneda
          <input className="mk-input" maxLength={3} value={moneda} onChange={(e) => setMoneda(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))} />
        </label>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="primary" size="sm" onClick={guardar} loading={pending}>Guardar el precio</Button>
      </div>
      <Toast state={toast} onClose={clear} />
    </section>
  );
}
