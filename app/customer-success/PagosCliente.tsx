'use client';

// =============================================================================
// PagosCliente — la tab Pagos de la ficha de un cliente, con los MISMOS bloques que la del CRM (17/10/2026)
// =============================================================================
// Hasta el 17/10/2026 esta tab montaba DealDetailsCard, la tarjeta vieja del deal: decía «Pagado por
// completo» en una mensualidad ACTIVA, pintaba en verde una renovación rechazada, y traía «Editar deal» y
// «✦ Completar con IA», que estaba roto en dos de sus tres entradas (docs/relevo/crm.md §0-Ω11 punto 2;
// docs/relevo/pagos.md punto 4). La tab Pagos del CRM ya se había rehecho en bloques el 16/10, con lo
// cobrado leído por `cobradoDelLead` (lib/cobrado-lead.ts), que no tiene esos dos errores.
//
// ⚠️ LOS MISMOS BLOQUES, NO UNA COPIA: el armador del CRM (`Armador`) con la plantilla FIJA de CS
// (`listaFijaDeCs`, decisión del 14/10: «la ficha de CS usa los mismos bloques con una plantilla fija»;
// docs/diseno-ficha-bloques.md §4, «Cliente en Customer Success»). Sin «Editar»: en la v1 no se personaliza.
// ⚠️ Y EL RESUMEN DE CS SUMA LO SUYO (`DealCliente`): la plantilla pone ahí el estado de cuenta, el servicio
// vendido, la promesa y las obligaciones, que vivían en la tarjeta vieja. El contacto y las notas los sigue
// dibujando la tarjeta de siempre (FichaPestanas.tsx), así que no se repiten.
// ⚠️ LEE LO MISMO QUE LA FICHA DEL CRM (`getLeadFullAction`): los bloques reciben el `CtxFicha` entero, y
// armarlo a mano con otra lectura sería la segunda fuente que hace que las dos fichas digan cosas distintas.
// Se lee al abrir la tab (el `Panel` monta lo abierto), y se relee cuando un bloque escribe.
// =============================================================================

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { getLeadFullAction, type LeadFullData } from '@/app/crm/actions';
import { Armador } from '@/app/crm/lead-view/ficha/Armador';
import { CSS_FICHA } from '@/app/crm/lead-view/ficha/ficha-css';
import { listaFijaDeCs } from '@/app/crm/lead-view/ficha/reglas-cs';
import { FichaCambioProvider } from '@/app/crm/lead-view/ficha-cambio';
import type { CtxFicha } from '@/app/crm/lead-view/ficha/tipos';
import type { BloquePuesto } from '@/lib/ficha/config';
import { Spinner } from '@/app/_ui';
import { deriveStageKey } from '@/lib/pipeline';
import { hoyEnTz } from '@/lib/date-utils';
import { useTzWorkspace } from '@/app/crm/lead-view/useTzWorkspace';
import type { Lead } from '@/lib/leads';

const LISTA = listaFijaDeCs('cs-pagos');
/** Lo del Resumen de CS que no dibuja su tarjeta de siempre (InfoPrincipalCard y NotasCard). */
const LISTA_RESUMEN = listaFijaDeCs('cs-resumen', { sin: ['contacto', 'notas'] });
const nada = () => {};
const AVISO: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0', fontSize: 13.5, color: 'var(--dim)' };

type Props = {
  leadId: number;
  /** Lo que un bloque ya escribió en el lead, para la cabecera de la ficha (que se leyó una vez). */
  onCambio: (patch: Partial<Lead>) => void;
};

export function PagosCliente(p: Props) {
  return <BloquesDeCs {...p} lista={LISTA} que="sus pagos" />;
}

/** El estado de cuenta y el deal (servicio, promesa, obligaciones), debajo del Resumen de CS. */
export function DealCliente(p: Props) {
  return <BloquesDeCs {...p} lista={LISTA_RESUMEN} que="su venta" />;
}

function BloquesDeCs({ leadId, onCambio, lista, que }: Props & { lista: readonly BloquePuesto[]; que: string }) {
  const [data, setData] = useState<LeadFullData | 'cargando' | 'error'>('cargando');
  const hoy = hoyEnTz(useTzWorkspace());
  const leer = useCallback(() => {
    void getLeadFullAction(leadId).then((d) => setData(d ?? 'error'), () => setData('error'));
  }, [leadId]);
  useEffect(() => { leer(); }, [leer]);

  if (data === 'cargando') return <p style={AVISO}><Spinner size={14} /> Leyendo {que}</p>;
  if (data === 'error') return <p style={AVISO}>No pude leer {que}. Vuelve a abrir la ficha.</p>;

  const { lead, stages } = data;
  const etapa = lead.pipeline_stage && stages.some((s) => s.key === lead.pipeline_stage) ? lead.pipeline_stage : deriveStageKey(lead);
  const ctx: CtxFicha = {
    // El día del NEGOCIO, como la ficha del CRM (FichaPorBloques): con el UTC, de noche una cuota de hoy salía vencida.
    data, lead, stages, etapa, hoy,
    rol: data.rol ?? 'otro', esAdmin: data.rol === 'admin', verPrivado: !!data.verPrivado,
    releer: leer,
    parchear: (patch) => {
      setData((d) => (d === 'cargando' || d === 'error' ? d : { ...d, lead: { ...d.lead, ...patch } }));
      onCambio(patch);
      leer();
    },
    // En CS no hay otras hojas a las que ir ni un asistente de «datos sin marcar»: esos botones no hacen nada acá.
    irATab: nada,
    solucionar: nada,
  };
  return (
    <FichaCambioProvider value={leer}>
      <div className="fb">
        <style>{CSS_FICHA}</style>
        <div className="fb-tab">
          <Armador tab="pagos" lista={lista} ctx={ctx} editando={false} sel={null} onSel={nada} onCambio={nada} />
        </div>
      </div>
    </FichaCambioProvider>
  );
}
