'use client';

// =============================================================================
// BajasDeCuenta — «Pidieron eliminar su cuenta»: la marca que ve el super admin (3/11/2026)
// =============================================================================
// Va arriba de Admin › Accounts, con las dos reglas de «Quieren entrar» (PedidosDeIngreso.tsx):
//   · NO SE DIBUJA SI NO HAY NADIE;
//   · UN ERROR DE LECTURA NO ES «NO HAY NADIE»: lo dice. Desaparecer dejaría vencer un plazo que le prometimos a alguien.
// Apple y Play piden que se borre de verdad, y le dijimos a la persona una fecha: la que venció se ve en rojo.
// El negocio entero se borra con «Eliminar…» de su fila, con el nombre escrito a mano. Esta lista no lo ejecuta.

import { useCallback, useEffect, useState } from 'react';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { diasQueQuedan, fechaDeLaBaja } from '@/lib/baja-cuenta-reglas';
import type { FilaBaja } from '@/lib/baja-cuenta';

const texto = (extra: object) => ({ fontSize: 13, lineHeight: 1.45, ...extra });

export function BajasDeCuenta({ vuelta }: {
  /** Cambia cuando se borra un cliente: la lista se vuelve a leer. */
  vuelta: number;
}) {
  const [bajas, setBajas] = useState<FilaBaja[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    try {
      const j = await (await fetch('/api/admin/bajas-cuenta')).json();
      if (!j?.ok) { setError(j?.error ?? 'No pude leer quién pidió eliminar su cuenta.'); return; }
      setError(null);
      setBajas((j.bajas ?? []) as FilaBaja[]);
    } catch {
      setError('No pude leer quién pidió eliminar su cuenta.');
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar, vuelta]);

  const accion = async (b: FilaBaja, que: 'cancelar' | 'eliminar-persona' | 'terminar') => {
    setOcupado(b.id);
    try {
      const j = await (await fetch('/api/admin/bajas-cuenta', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: b.id, accion: que }),
      })).json();
      if (!j?.ok) { setError(j?.error ?? 'No se pudo.'); return; }
      await cargar();
    } catch {
      setError('No se pudo.');
    } finally { setOcupado(null); }
  };

  if (!error && bajas.length === 0) return null;
  const ahora = Date.now();
  return (
    <section style={{ margin: '0 0 14px', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)' }}>
      <div style={{ fontSize: 14, fontWeight: 650, color: 'var(--ink)', marginBottom: 8 }}>Pidieron eliminar su cuenta</div>
      {error && <p role="alert" style={texto({ margin: '0 0 8px', color: 'var(--bad)' })}>{error}<ReportarASoporte /></p>}
      {bajas.map((b) => {
        const dias = diasQueQuedan(b.vence_at, ahora);
        return (
          <div key={b.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 0', borderTop: '1px solid var(--border)' }}>
            <div style={{ minWidth: 0 }}>
              <div style={texto({ fontWeight: 600, color: 'var(--ink)' })}>
                {b.alcance === 'negocio' ? `El negocio entero: ${b.negocio ?? `#${b.negocio_id}`}` : b.email}{b.prueba ? ' · de prueba' : ''}
              </div>
              <div style={texto({ color: dias < 0 ? 'var(--bad)' : 'var(--dim)' })}>
                {b.alcance === 'negocio' && b.email ? `${b.email} · ` : ''}
                {dias < 0 ? `Se pasó del plazo: era el ${fechaDeLaBaja(b.vence_at)}` : `Hasta el ${fechaDeLaBaja(b.vence_at)} (${dias} ${dias === 1 ? 'día' : 'días'})`}
              </div>
              {b.notas && <div style={texto({ color: 'var(--bad)' })}>{b.notas}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {b.alcance === 'negocio' && b.notas?.startsWith('Se borró') && (
                <button type="button" className="mk-btn mk-btn--primary mk-btn--sm" disabled={ocupado === b.id} onClick={() => void accion(b, 'terminar')}>Ya está: avisarle</button>
              )}
              {b.alcance === 'persona' && !b.prueba && (
                <button type="button" className="mk-btn mk-btn--danger mk-btn--sm" disabled={ocupado === b.id} onClick={() => void accion(b, 'eliminar-persona')}>Eliminar</button>
              )}
              <button type="button" className="mk-btn mk-btn--tertiary mk-btn--sm" disabled={ocupado === b.id} onClick={() => void accion(b, 'cancelar')}>Cancelar pedido</button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
