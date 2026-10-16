'use client';

// =============================================================================
// ficha/resumen/duplicados y notas — otras fichas que parecen la misma persona, y las notas del lead
// =============================================================================
// `posibles-duplicados` (§3 del diseño): hasta hoy un duplicado sólo se veía al dar de alta. Lo lee al montarse
// (`duplicadosDelLeadAction`, la comparación de siempre, `duplicadosDeLead`) y sin ninguno se calla. Sólo se ABRE la
// otra ficha: unirlas no existe todavía (docs/hallazgos-crm.md).
// `notas`: son las MISMAS que ve Customer Success (NotasCard: escribir con adjunto, emojis y dictado; editar y borrar).
// Los diseños «Últimas 3» y «La última» muestran menos y guardan la caja detrás de «Agregar nota».
// =============================================================================

import { useEffect, useState } from 'react';
import Link from '@/app/_ui/Link';
import { NotasCard } from '../../NotasCard';
import type { PropsBloque } from '../tipos';
import { duplicadosDelLeadAction, type FichaParecida } from './bloques-actions';
import { Bloque } from './piezas';

export function PosiblesDuplicados({ ctx, titulo, diseno, epico }: PropsBloque) {
  const [lista, setLista] = useState<FichaParecida[] | null>(null);
  useEffect(() => {
    let vivo = true;
    void duplicadosDelLeadAction(ctx.lead.id).then((r) => { if (vivo) setLista(r ?? []); }).catch(() => { if (vivo) setLista([]); });
    return () => { vivo = false; };
  }, [ctx.lead.id, ctx.lead.email, ctx.lead.telefono]);
  if (!lista?.length) return null;
  const n = lista.length;
  const frase = n === 1 ? 'Hay otra ficha parecida' : `Hay ${n} fichas parecidas`;
  const links = lista.map((x) => (
    <Link key={x.id} href={`/crm/${x.id}`} className="fr-chip" title={x.porque}>{x.nombre}</Link>
  ));
  if (diseno === 'lista' && !epico) {
    return (
      <Bloque titulo={titulo} epico={false}>
        <div className="fr-props">
          {lista.map((x) => (
            <div key={x.id} className="fr-prop">
              <span className="fr-k">{x.porque}</span>
              <span className="fr-v"><Link href={`/crm/${x.id}`} className="fr-link">{x.nombre}</Link></span>
              <span />
            </div>
          ))}
        </div>
      </Bloque>
    );
  }
  return (
    <Bloque titulo={titulo} epico={epico} tono="warn">
      {epico ? <p className="fr-frase">{frase}</p> : <span style={{ fontSize: 15, fontWeight: 650 }}>{frase}</span>}
      <div className="fr-chips">{links}</div>
    </Bloque>
  );
}

export function Notas({ ctx, titulo, diseno, epico }: PropsBloque) {
  return (
    <NotasCard leadId={ctx.lead.id} titulo={titulo} epico={epico}
      limite={diseno === 'ultima' ? 1 : diseno === 'tres' ? 3 : undefined} plegada={diseno === 'ultima' || diseno === 'tres'} />
  );
}
