'use client';

// =============================================================================
// PreciosPlanesMp — el precio de cada plan en la moneda de la Mercado Pago de MaKo (23/10/2026)
// =============================================================================
// La revisión del lanzamiento: con sólo Mercado Pago conectada, /planes no vendía, porque MP cobra en la moneda de su
// sitio (ARS, MXN…) y el precio de cada plan en esa moneda no tenía dónde cargarse. MaKo no inventa una tasa: lo pone
// Martín acá. Sin precio, ese plan no se ofrece por Mercado Pago (sí por Stripe, en dólares). El molde es
// PrecioClienteAgencia, la tarjeta de al lado. Las reglas, en lib/compra-plan.ts (`guardarPrecioLocal`).

import { useState, useTransition } from 'react';
import { Button, Toast, useToast } from '@/app/_ui';
import { formatoMonto } from '@/lib/pasarela-moneda';
import { guardarPrecioLocalAction, type PrecioLocalPlan } from './actions';

export default function PreciosPlanesMp({ moneda, planes }: { moneda: string; planes: PrecioLocalPlan[] }) {
  const [valores, setValores] = useState<Record<string, string>>(() => Object.fromEntries(planes.map((p) => [p.id, p.local != null ? String(p.local) : ''])));
  const [guardando, setGuardando] = useState<string | null>(null);
  const [, start] = useTransition();
  const { toast, show, clear } = useToast();
  // «130.000» y «130.000,50» son pesos con punto de miles (revisión del diff, 23/10/2026: el input numérico lo leía como 130).
  const n = (s: string): number | null => { const x = Number(s.replace(/[\s.]/g, '').replace(',', '.')); return s.trim() && Number.isFinite(x) && x > 0 ? x : null; };

  const guardar = (id: string) => start(async () => {
    const texto = (valores[id] ?? '').trim();
    // Un valor que no se entiende NO borra el precio: se dice. Vacío sí lo saca (a propósito).
    if (texto && n(texto) == null) { show('Ese precio no se entiende: escribe sólo el número', undefined, 'bad'); return; }
    setGuardando(id);
    const r = await guardarPrecioLocalAction(id, n(texto));
    setGuardando(null);
    if (!r.ok) { show(r.error, undefined, 'bad'); return; }
    show('Precio guardado');
  });

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)', marginBottom: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <strong style={{ fontSize: 15, color: 'var(--ink)' }}>Planes en Mercado Pago</strong>
        <span style={{ fontSize: 13, color: 'var(--dim)' }}>Su precio por mes en {moneda}. Sin precio, ese plan sólo se paga con tarjeta, en dólares.</span>
      </div>
      {planes.filter((p) => p.activo).map((p) => (
        <div key={p.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 10 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, color: 'var(--dim)', flex: '1 1 180px' }}>
            {p.nombre} · {formatoMonto(p.precioUsd, 'USD')}
            <input className="mk-input" type="text" inputMode="decimal" placeholder="Sin cargar" value={valores[p.id] ?? ''}
              onChange={(e) => setValores((v) => ({ ...v, [p.id]: e.target.value }))} />
          </label>
          <Button variant="secondary" size="sm" onClick={() => guardar(p.id)} loading={guardando === p.id}>Guardar</Button>
        </div>
      ))}
      <Toast state={toast} onClose={clear} />
    </section>
  );
}
