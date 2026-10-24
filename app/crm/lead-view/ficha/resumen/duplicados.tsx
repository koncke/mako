'use client';

// =============================================================================
// ficha/resumen/duplicados y notas — otras fichas que parecen la misma persona, y las notas del lead
// =============================================================================
// `posibles-duplicados` (§3 del diseño): hasta hoy un duplicado sólo se veía al dar de alta. Lo lee al montarse
// (`duplicadosDelLeadAction`, la comparación de siempre, `duplicadosDeLead`) y sin ninguno se calla.
//
// 23/10/2026, Martín: «En el CRM si me dice "Hay otra ficha parecida", que me de la opción ahí mismo de unificarlas, y
// ese bloque en el detail requiere más info... ¿En que CRM aparece duplicada? etc...». Por cada ficha parecida:
//   · por qué se parece (mismo teléfono, email, @ o nombre), en qué CRM está (su casa y los que la tienen agregada, con
//     la etapa de cada uno) y desde cuándo existe, con «Abrir»;
//   · «Unificar», ahí mismo: abre ./UnificarFichas.tsx, que dice ANTES qué queda de cada una y qué se mueve, y no se
//     hace sin esa confirmación.
// La referencia: «Merge» de HubSpot (eliges cuál queda, ves los valores de las dos y lo que se lleva) y la ficha de
//   duplicados de Attio («posibles duplicados» con el motivo y el lugar). Documentación oficial; no se entró a las apps.
// `notas`: son las MISMAS que ve Customer Success (NotasCard: escribir con adjunto, emojis y dictado; editar y borrar).
// Los diseños «Últimas 3» y «La última» muestran menos y guardan la caja detrás de «Agregar nota».
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import Link from '@/app/_ui/Link';
import { Button } from '@/app/_ui';
import { NotasCard } from '../../NotasCard';
import type { PropsBloque } from '../tipos';
import { duplicadosDelLeadAction, type FichaParecida } from './bloques-actions';
import { Bloque } from './piezas';
import { useTzWorkspace } from '../../useTzWorkspace';
import { dondeEnUnaLinea, desdeCuando } from './duplicados-logica';
import { UnificarFichas } from './UnificarFichas';

export function PosiblesDuplicados({ ctx, titulo, diseno, epico }: PropsBloque) {
  const tz = useTzWorkspace();
  const [lista, setLista] = useState<FichaParecida[] | null>(null);
  const [version, setVersion] = useState(0);
  const [unificar, setUnificar] = useState<FichaParecida | null>(null);
  useEffect(() => {
    let vivo = true;
    void duplicadosDelLeadAction(ctx.lead.id).then((r) => { if (vivo) setLista(r ?? []); }).catch(() => { if (vivo) setLista([]); });
    return () => { vivo = false; };
  }, [ctx.lead.id, ctx.lead.email, ctx.lead.telefono, ctx.lead.instagram, version]);
  const cerrar = useCallback(() => setUnificar(null), []);
  if (!lista?.length) return null;
  const n = lista.length;
  const frase = n === 1 ? 'Hay otra ficha parecida' : `Hay ${n} fichas parecidas`;

  const fila = (x: FichaParecida) => (
    <div key={x.id} className="fr-dup" data-duplicado={x.id}>
      <div className="fr-cab">
        <Link href={`/crm/${x.id}`} className="fr-link fr-dup-nombre">{x.nombre}</Link>
        <span className="fr-cab-fin">
          <Link href={`/crm/${x.id}`} className="fr-link">Abrir</Link>
          <Button variant="secondary" size="sm" onClick={() => setUnificar(x)}>Unificar</Button>
        </span>
      </div>
      <span className="fr-sub">Se parece: {x.porque}</span>
      {x.donde.length > 0 && <span className="fr-sub">Está en {dondeEnUnaLinea(x.donde)}</span>}
      {x.desde && <span className="fr-sub">{desdeCuando(x.desde, tz)}</span>}
    </div>
  );

  const modal = unificar && (
    <UnificarFichas esta={{ id: ctx.lead.id, nombre: ctx.lead.nombre?.trim() || `Lead ${ctx.lead.id}` }} otra={unificar}
      onCerrar={cerrar} onUnificado={() => { setUnificar(null); setVersion((v) => v + 1); }} />
  );

  if (diseno === 'lista' && !epico) {
    return <><Bloque titulo={titulo} epico={false}><div className="fr-dup-lista">{lista.map(fila)}</div></Bloque>{modal}</>;
  }
  return (
    <>
      <Bloque titulo={titulo} epico={epico} tono="warn">
        {epico ? <p className="fr-frase">{frase}</p> : <span style={{ fontSize: 15, fontWeight: 650 }}>{frase}</span>}
        <div className="fr-dup-lista">{lista.map(fila)}</div>
      </Bloque>
      {modal}
    </>
  );
}

export function Notas({ ctx, titulo, diseno, epico }: PropsBloque) {
  return (
    <NotasCard leadId={ctx.lead.id} titulo={titulo} epico={epico}
      limite={diseno === 'ultima' ? 1 : diseno === 'tres' ? 3 : undefined} plegada={diseno === 'ultima' || diseno === 'tres'} />
  );
}
