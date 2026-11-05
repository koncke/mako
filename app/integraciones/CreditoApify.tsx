'use client';

// =============================================================================
// CreditoApify — cuánto le queda a cada clave de Apify este mes, en su tarjeta de Integraciones (5/11/2026)
// =============================================================================
// Martín, 5/11/2026: «Dame la opción de tener varias claves de apify» y «dame la opción también en integraciones de cargar más
// api». Con varias claves, la persona tiene que ver cuál se está quedando sin crédito sin ir a Apify: un renglón por clave, con
// su número y el nombre que le puso, y el total libre.
//
// Lo pide al mismo «Probar conexión» de la tarjeta (`verificar`, lib/metodo-verificar.ts → `apify-instagram`), que lee las claves
// GUARDADAS en el servidor y contesta sólo números y nombres: la clave no viaja al navegador. No gasta crédito: pregunta a
// `/users/me` y `/users/me/limits`, que no corren ningún actor. Se vuelve a pedir cuando cambian las claves guardadas (`firma`).
// =============================================================================

import { useEffect, useState } from 'react';
import { SkeletonLines } from '@/app/_ui/Feedback';

type Fact = { k: string; v: string; c?: string };
type Estado = { cargando: true } | { cargando: false; facts: Fact[] } | { cargando: false; error: string };

export default function CreditoApify({ firma }: { firma: string }) {
  const [estado, setEstado] = useState<Estado>({ cargando: true });
  useEffect(() => {
    let vivo = true;
    setEstado({ cargando: true });
    fetch('/api/integraciones/credencial', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verificar', servicio: 'apify-instagram', valores: {} }),
    })
      .then((r) => r.json())
      .then((j: { ok?: boolean; facts?: Fact[]; error?: string }) => {
        if (!vivo) return;
        if (j.ok && Array.isArray(j.facts)) setEstado({ cargando: false, facts: j.facts });
        else setEstado({ cargando: false, error: j.error ?? 'No pude leer el crédito de tus claves.' });
      })
      .catch(() => { if (vivo) setEstado({ cargando: false, error: 'No pude leer el crédito de tus claves. Prueba de nuevo.' }); });
    return () => { vivo = false; };
  }, [firma]);

  return (
    <div data-credito-apify style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 15px', display: 'flex', flexDirection: 'column', gap: 7, fontFamily: "'Geist', sans-serif" }}>
      <span style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--ink)' }}>Crédito de este mes</span>
      {estado.cargando ? (
        // Mientras lee: los renglones que van a venir (la regla de la casa: un loader no es un renglón suelto).
        <div aria-busy="true" aria-label="Leyendo el crédito de tus claves"><SkeletonLines lines={2} gap={7} /></div>
      ) : 'error' in estado ? (
        <span style={{ fontSize: 12.5, color: 'var(--bad)', lineHeight: 1.45 }}>{estado.error}</span>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
          {estado.facts.map((f) => (
            <li key={f.k} style={{ fontSize: 12.5, lineHeight: 1.45, color: f.c ?? 'var(--dim)' }}>
              <b style={{ fontWeight: 650, color: f.c ?? 'var(--ink)' }}>{f.k}:</b> {f.v}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
