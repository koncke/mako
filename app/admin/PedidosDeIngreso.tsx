'use client';

// =============================================================================
// PedidosDeIngreso — «Quieren entrar»: quien pidió entrar a MaKo y todavía no tiene cuenta (30/10/2026)
// =============================================================================
// Va arriba de Admin › Accounts, junto a lo que espera la firma de las agencias, y con sus mismas dos reglas (el cartel de
// app/customers/page.tsx lo avisa desde las otras pestañas):
//   · NO SE DIBUJA SI NO HAY NADIE.
//   · UN ERROR DE LECTURA NO ES «NO HAY NADIE»: lo dice. Desaparecer dejaría a una persona esperando sin que nadie lo sepa.
// «Dar de alta» NO crea nada: abre el «Nuevo cliente» de siempre ya cargado, para elegir el plan y mirar el correo antes. Al
// crearse la cuenta, la persona sale sola de acá (lib/pedidos-ingreso.ts). Los datos los escribe quien pidió: se muestran como texto.

import { useCallback, useEffect, useState } from 'react';
import { altaDelPedido, detalleDelPedido, type FilaPedido } from '@/lib/pedidos-ingreso-reglas';

export function PedidosDeIngreso({ onDarDeAlta, vuelta }: {
  onDarDeAlta: (alta: ReturnType<typeof altaDelPedido>) => void;
  /** Cambia cuando se crea un cliente: la lista se vuelve a leer. */
  vuelta: number;
}) {
  const [pedidos, setPedidos] = useState<FilaPedido[]>([]);
  const [hayMas, setHayMas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    try {
      const j = await (await fetch('/api/admin/pedidos-ingreso')).json();
      if (!j?.ok) { setError(j?.error ?? 'No pude leer quién quiere entrar.'); return; }
      setError(null);
      setPedidos((j.pedidos ?? []) as FilaPedido[]);
      setHayMas(j.hayMas === true);
    } catch {
      setError('No pude leer quién quiere entrar.');
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar, vuelta]);

  const descartar = async (p: FilaPedido) => {
    setOcupado(p.id);
    try {
      const j = await (await fetch('/api/admin/pedidos-ingreso', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: p.id }),
      })).json();
      if (!j?.ok) { setError(j?.error ?? 'No se pudo descartar.'); return; }
      await cargar();
    } catch {
      setError('No se pudo descartar.');
    } finally { setOcupado(null); }
  };

  if (!pedidos.length && !error) return null;
  return (
    <section aria-labelledby="pi-titulo" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)' }}>
      <h2 id="pi-titulo" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Quieren entrar</h2>
      {error && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600 }}>{error}</div>}
      {pedidos.map((p) => (
        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 11, background: 'var(--surface-2)' }}>
          <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 14, color: 'var(--ink)', overflowWrap: 'anywhere' }}>{p.nombre ? <><b>{p.nombre}</b> · {p.email}</> : <b>{p.email}</b>}</span>
            <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>{detalleDelPedido(p)}</span>
          </span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button type="button" disabled={ocupado === p.id} onClick={() => void descartar(p)} style={btn('var(--border-strong)', 'var(--dim)')}>
              {ocupado === p.id ? 'Descartando…' : 'Descartar'}
            </button>
            <button type="button" onClick={() => onDarDeAlta(altaDelPedido(p))} style={btn('var(--primary)', 'var(--primary)')}>Dar de alta</button>
          </span>
        </div>
      ))}
      {hayMas && <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>Se ven los 50 más recientes.</div>}
    </section>
  );
}

const btn = (borde: string, tinta: string) => ({
  border: `1px solid ${borde}`, background: 'transparent', color: tinta, borderRadius: 9, padding: '7px 12px',
  font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' as const,
});
