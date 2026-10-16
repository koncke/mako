'use client';

import { useState, useTransition } from 'react';
import Link from '@/app/_ui/Link';
import type { SeccionChecklist } from './datos';
import { marcarItemChecklist } from './acciones';

function Seccion({ s, marcados, alternar }: { s: SeccionChecklist; marcados: Set<string>; alternar: (id: string) => void }) {
  const hechos = s.items.filter((i) => marcados.has(i.id)).length;
  return (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px', marginBottom: 12 }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 'var(--fs-md)', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span>{s.titulo}</span>
        <span style={{ color: 'var(--dim)', fontWeight: 500 }}>{hechos}/{s.items.length}</span>
      </h3>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {s.items.map((i) => {
          const ok = marcados.has(i.id);
          return (
            <li key={i.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 0', borderTop: '1px solid var(--border)' }}>
              <input type="checkbox" checked={ok} onChange={() => alternar(i.id)} aria-label={i.t}
                style={{ marginTop: 3, width: 18, height: 18, flex: 'none', cursor: 'pointer' }} />
              <span style={{ flex: 1, lineHeight: 1.45, color: ok ? 'var(--dim)' : 'var(--ink)', textDecoration: ok ? 'line-through' : 'none' }}>
                {i.t}
                {i.ruta ? <> <Link href={i.ruta} style={{ color: 'var(--accent)', whiteSpace: 'nowrap' }}>Abrir</Link></> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function Checklist({ hecho, pendiente, iniciales }: { hecho: SeccionChecklist[]; pendiente: SeccionChecklist[]; iniciales: string[] }) {
  const [marcados, setMarcados] = useState(() => new Set(iniciales));
  const [error, setError] = useState(false);
  const [, iniciar] = useTransition();

  const alternar = (id: string) => {
    const marcar = !marcados.has(id);
    const antes = marcados;
    const sig = new Set(marcados);
    if (marcar) sig.add(id); else sig.delete(id);
    setMarcados(sig);
    setError(false);
    iniciar(async () => {
      const r = await marcarItemChecklist(id, marcar);
      if (!r.ok) { setMarcados(antes); setError(true); return; }
      setMarcados(new Set(r.marcados));
    });
  };

  return (
    <div>
      {error ? <p role="alert" style={{ color: 'var(--bad)', margin: '0 0 12px' }}>No se guardó: vuelve a marcarlo.</p> : null}
      <h2 style={{ fontSize: 'var(--fs-sect)', margin: '8px 0 12px' }}>Lo que se hizo (para revisar)</h2>
      {hecho.map((s) => <Seccion key={s.titulo} s={s} marcados={marcados} alternar={alternar} />)}
      <h2 style={{ fontSize: 'var(--fs-sect)', margin: '20px 0 12px' }}>Lo que queda</h2>
      {pendiente.map((s) => <Seccion key={s.titulo} s={s} marcados={marcados} alternar={alternar} />)}
    </div>
  );
}
