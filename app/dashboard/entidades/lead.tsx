'use client';

// =============================================================================
// entidades/lead — la ficha RESUMIDA de un lead, en piezas (tanda v5, I3 del contrato)
// =============================================================================
// Adentro del pop-up de un lead (una tabla de leads por «Lead», el detalle de una cobranza): lo esencial para
// decidir sin salir de la hoja, y «Abrir la ficha» para todo lo demás. Lee con el lector que ya existe
// (`getLeadFullAction`, la MISMA de la ficha del CRM que abre el detalle de un número): nada nuevo del server.
//
// Las piezas (PIEZAS_ENTIDAD.lead): `resumen` (nombre, empresa, etapa, closer, lo vendido), `pagos` (las cuotas,
// cobradas o no) y `completo` (las dos, con el botón a la ficha entera).
//
// ⚠️ «Abrir la ficha» es un LINK a la ficha del CRM, en otra pestaña (`ButtonLink`, que lleva el `?ws=`), y no la
//    ficha encima: LeadEditModal vive en z 80 y la pila de modales arranca en 130, así que adentro de un pop-up
//    quedaría DEBAJO de él (el mismo motivo por el que el detalle de un número la dibuja en su lugar).

import { useEffect, useState } from 'react';
import { ButtonLink, Spinner } from '@/app/_ui';
import { getLeadFullAction, type LeadFullData } from '@/app/crm/actions';
import { etiquetaTiempo, fmtValor } from '@/lib/graficos-agregar';

const usd = (n: number | null | undefined) => fmtValor(n ?? null, 'usd');
const fecha = (iso: string | null | undefined) => (iso ? etiquetaTiempo('dia', iso.slice(0, 10)) : '—');

/** La ficha del lead (la server action de siempre; se encolan de a una, así que se pide UNA vez por pieza). */
function useLead(id: number) {
  const [l, setL] = useState<{ id: number; datos: LeadFullData | null; error: string | null } | null>(null);
  useEffect(() => {
    let vivo = true;
    getLeadFullAction(id)
      .then((d) => { if (vivo) setL({ id, datos: d, error: d ? null : 'Ese lead ya no está.' }); })
      .catch(() => { if (vivo) setL({ id, datos: null, error: 'No pude leer el lead.' }); });
    return () => { vivo = false; };
  }, [id]);
  const actual = l && l.id === id ? l : null;
  return { datos: actual?.datos ?? null, error: actual?.error ?? null, cargando: !actual };
}

function Resumen({ d }: { d: LeadFullData }) {
  const l = d.lead;
  const etapa = d.stages.find((s) => s.key === l.pipeline_stage)?.label ?? l.estado_lead ?? '—';
  const filas: Array<[string, string]> = [
    ['Etapa', etapa], ['Closer', l.closer || '—'], ['Primera reunión', fecha(l.fecha_junta_1)], ['Vendido', usd(l.monto_cierre_usd)],
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)' }}>{l.nombre}</div>
        {l.empresa && <div style={{ fontSize: 13.5, color: 'var(--dim)' }}>{l.empresa}</div>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
        {filas.map(([k, v]) => (
          <div key={k}><div style={{ fontSize: 12.5, color: 'var(--dim)' }}>{k}</div><div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{v}</div></div>
        ))}
      </div>
    </div>
  );
}

function Pagos({ d }: { d: LeadFullData }) {
  const ps = [...d.pagos].sort((a, b) => a.numero - b.numero);
  if (!ps.length) return <p style={{ margin: 0, fontSize: 13, color: 'var(--faint)' }}>Sin pagos cargados.</p>;
  return (
    <div role="list">
      {ps.map((p) => (
        <div key={p.id} role="listitem" style={{ display: 'flex', gap: 12, alignItems: 'baseline', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13.5 }}>
          <span style={{ flex: 1, color: 'var(--ink)' }}>{p.numero === 0 ? 'Pago inicial' : `Cuota ${p.numero}`}</span>
          <span style={{ color: p.pagado ? 'var(--good)' : 'var(--dim)' }}>{p.pagado ? `Cobrado ${fecha(p.fecha_pago)}` : `Vence ${fecha(p.fecha_esperada)}`}</span>
          <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>{usd(p.monto_usd)}</span>
        </div>
      ))}
    </div>
  );
}

/** Una pieza de la ficha del lead `leadId` (PIEZAS_ENTIDAD.lead). */
export default function PiezaLead({ leadId, pieza }: { leadId: number; pieza: string }) {
  const { datos, error, cargando } = useLead(leadId);
  if (cargando) return <div style={{ display: 'grid', placeItems: 'center', minHeight: 60 }}><Spinner size={16} /></div>;
  if (!datos) return <p style={{ margin: 0, fontSize: 13, color: 'var(--bad)' }}>{error ?? 'No pude leer el lead.'}</p>;
  if (pieza === 'resumen') return <Resumen d={datos} />;
  if (pieza === 'pagos') return <Pagos d={datos} />;
  if (pieza !== 'completo') return <p style={{ margin: 0, fontSize: 13, color: 'var(--faint)' }}>Esta pieza ya no existe.</p>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Resumen d={datos} />
      <Pagos d={datos} />
      <div><ButtonLink href={`/crm/${leadId}`} newTab size="sm" variant="secondary">Abrir la ficha</ButtonLink></div>
    </div>
  );
}
