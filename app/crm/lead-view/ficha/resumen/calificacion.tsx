'use client';

// =============================================================================
// ficha/resumen/calificacion — «¿Era calificado?», lo que aprende Meta (el bloque `calificacion` del Resumen)
// =============================================================================
// Reemplaza a CalificacionCard (16/10/2026: el Resumen nativo). Lo que pidió Martín y no cambia:
//   · 05/10/2026: «esa data tan valiosa que le envía a Meta CAPI... jamás se pueden editar» en un funnel sin reunión:
//     se dibuja SIEMPRE, también sin reunión. Lo único que la bloquea es que CONSTE que no vino a la R1
//     (`calificadoSeDescarta`, la regla compartida): ahí `updateLead` descarta el dato y un control rebotaría.
//   · 13/10/2026: va en el Resumen, no en Tracking.
//   · 14/10/2026: «Meta aprende de esto» SÓLO si le llega; si no, lo dice y lleva a conectarlo AHÍ (`BotonIntegracion`,
//     «para una integración jamás se debe salir de la tab»).
// ⚠️ NO ES UN SEGUNDO CONTROL CON SU PROPIA VERDAD: los tres diseños escriben por el MISMO camino que la tarjeta de
//    Reuniones (`TriEditable` y `TriBotones`, ../../CampoEditable.tsx → `guardarCampoLeadAction` → `updateLead`, el único
//    que dispara Meta CAPI). Este archivo no llama a ninguna acción que escriba: lo fija tests/crm-calificado-sin-reunion.
//
// Diseños (§3): «Tres botones» (los tres a la vista, el de entrada), «Chip» y «Fila». ÉPICO: la respuesta en grande y
// los tres botones grandes; la nota de Meta sólo si NO le llega (es lo único accionable).
// =============================================================================

import { useEffect, useState } from 'react';
import { BotonIntegracion } from '@/app/_components/ConectarIntegracion';
import { adondeVaLaCalificacionAction } from '@/app/crm/calificacion-actions';
import type { AdondeVaLaCalificacion } from '@/lib/meta-capi-payload';
import { calificadoSeDescarta } from '@/lib/calificado-reunion';
import { marcaDato } from '@/lib/datos-aviso';
import { CajaCampo, TriBotones, TriEditable } from '../../CampoEditable';
import type { PropsBloque } from '../tipos';
import { Bloque } from './piezas';

const ESTADO = (v: boolean | null) => (v === true ? 'Calificado' : v === false ? 'No calificado' : 'Sin marcar');

export function Calificacion({ ctx, titulo, diseno, epico }: PropsBloque) {
  const lead = ctx.lead;
  const noVino = calificadoSeDescarta(lead);
  const [adonde, setAdonde] = useState<AdondeVaLaCalificacion | null>(null);
  useEffect(() => {
    let vivo = true;
    void adondeVaLaCalificacionAction().then((r) => { if (vivo) setAdonde(r); }).catch(() => {});
    return () => { vivo = false; };
  }, []);
  const noLlega = adonde === 'sin_pixel' || adonde === 'sin_token';
  const nota = noVino
    ? 'No vino a la reunión 1: no hay nada que calificar.'
    : noLlega
      ? (<>No le llega a Meta: {adonde === 'sin_pixel' ? 'falta el píxel' : 'falta el token'}. <BotonIntegracion servicio="meta" style={{ color: 'var(--primary)', fontWeight: 600 }}>Conectar →</BotonIntegracion></>)
      : 'Meta aprende de esto.';
  const tri = <TriEditable leadId={lead.id} campo="calificado" valor={lead.calificado} si="Calificado" no="No calificado" titulo="¿Era un lead calificado?" bloqueado={noVino} />;
  const botones = <TriBotones leadId={lead.id} campo="calificado" valor={lead.calificado} si="Calificado" no="No calificado" titulo="¿Era un lead calificado?" bloqueado={noVino} marca={marcaDato('calificado')} />;

  if (epico) {
    return (
      <Bloque titulo={titulo} epico>
        <span className="fr-p" style={{ color: lead.calificado === true ? 'var(--good)' : lead.calificado === false ? 'var(--bad)' : 'var(--ink)' }}>{ESTADO(lead.calificado)}</span>
        {botones}
        {(noVino || noLlega) && <span className="fr-sub">{nota}</span>}
      </Bloque>
    );
  }
  if (diseno === 'chip') {
    return (
      <Bloque titulo={titulo} epico={false}>
        <CajaCampo marca={marcaDato('calificado')} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>{tri}</CajaCampo>
        <span className="fr-sub">{nota}</span>
      </Bloque>
    );
  }
  if (diseno === 'fila') {
    return (
      <Bloque titulo={titulo} epico={false}>
        <div className="fr-props">
          <CajaCampo marca={marcaDato('calificado')}>
            <div className="fr-prop"><span className="fr-k">¿Calificado?</span><span className="fr-v">{tri}</span><span /></div>
          </CajaCampo>
        </div>
        <span className="fr-sub">{nota}</span>
      </Bloque>
    );
  }
  return (
    <Bloque titulo={titulo} epico={false}>
      <span style={{ fontSize: 14.5, fontWeight: 600 }}>¿Era un lead calificado?</span>
      {botones}
      <span className="fr-sub">{nota}</span>
    </Bloque>
  );
}
