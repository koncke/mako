'use client';

// =============================================================================
// QuienesDeMetricas — «¿quiénes son?», arriba de las Métricas (31/10/2026)
// =============================================================================
// Leila (30/10): que «respondieron 8» sea clicable y muestre quiénes, para seguirlos. Los números los dibuja el editor del Dashboard, que no sabe
// de leads: se ofrece al lado, con el mismo criterio y los mismos 30 días con que abre la hoja (lib/automatizacion-quienes.ts).
// =============================================================================

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Modal } from '@/app/_ui/Modal';
import { BarraCargando } from '@/app/_ui/CargandoMako';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';

type Cual = 'respondieron' | 'en_curso' | 'entraron';
type Fila = { leadId: number; nombre: string; telefono: string | null; cuando: string | null };
const OPCIONES: ReadonlyArray<{ id: Cual; texto: string; titulo: string; vacio: string }> = [
  { id: 'respondieron', texto: 'Respondieron', titulo: 'Quiénes respondieron', vacio: 'Nadie respondió en estos 30 días.' },
  { id: 'en_curso', texto: 'Siguen', titulo: 'Quiénes siguen en el flujo', vacio: 'Nadie sigue en el flujo.' },
  { id: 'entraron', texto: 'Entraron', titulo: 'Quiénes entraron', vacio: 'Nadie entró en estos 30 días.' },
];
const boton: CSSProperties = { appearance: 'none', border: 0, background: 'none', padding: 0, font: 'inherit', fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' };
const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' }) : '');

export function QuienesDeMetricas({ secuenciaId }: { secuenciaId: number }) {
  const [cual, setCual] = useState<Cual | null>(null);
  const [lista, setLista] = useState<{ total: number; filas: Fila[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cerrar = useCallback(() => setCual(null), []);

  useEffect(() => {
    if (!cual) return;
    let vivo = true;
    setLista(null); setError(null);
    fetch(`/api/automations/metricas?id=${secuenciaId}&quienes=${cual}`)
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!vivo) return;
        if (!r.ok || !j?.ok) { setError(j?.error ?? 'No pude leer quiénes son.'); return; }
        setLista({ total: j.total, filas: j.filas });
      })
      .catch(() => { if (vivo) setError('Sin conexión — prueba de nuevo.'); });
    return () => { vivo = false; };
  }, [cual, secuenciaId]);

  const op = OPCIONES.find((o) => o.id === cual);
  return (
    <span data-metricas-quienes style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '2px 10px' }}>
      <span>Ver quiénes:</span>
      {OPCIONES.map((o) => <button key={o.id} type="button" style={boton} onClick={() => setCual(o.id)}>{o.texto}</button>)}
      {op && (
        <Modal titulo={op.titulo} ancho={560} alto="min(80vh, 620px)" onCerrar={cerrar}>
          {error && <p role="alert" style={{ margin: 0, color: 'var(--bad)', fontSize: 13.5 }}>{error}<ReportarASoporte /></p>}
          {!lista && !error && <BarraCargando que="quiénes son" />}
          {lista && lista.filas.length === 0 && <p style={{ margin: 0, color: 'var(--dim)', fontSize: 13.5 }}>{op.vacio}</p>}
          {lista && lista.filas.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <p style={{ margin: '0 0 8px', color: 'var(--dim)', fontSize: 13 }}>
                {lista.total} en los últimos 30 días{lista.total > lista.filas.length ? `: se ven los últimos ${lista.filas.length}` : ''}
              </p>
              {lista.filas.map((f) => (
                <a key={f.leadId} href={`/crm/${f.leadId}`} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '9px 2px', borderTop: '1px solid var(--border)', color: 'var(--ink)', textDecoration: 'none', fontSize: 14 }}>
                  <span style={{ flex: 1, minWidth: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.nombre}</span>
                  {f.telefono && <span style={{ flex: 'none', color: 'var(--dim)', fontSize: 12.5 }}>{f.telefono}</span>}
                  <span style={{ flex: 'none', color: 'var(--faint)', fontSize: 12.5 }}>{fecha(f.cuando)}</span>
                </a>
              ))}
            </div>
          )}
        </Modal>
      )}
    </span>
  );
}
