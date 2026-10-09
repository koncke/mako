'use client';

// =============================================================================
// VistaMensajeSocial — la tarjeta INSTAGRAM / MESSENGER del lienzo, como llega
// =============================================================================
// La cara de la tarjeta (sexta tanda, CRON 5: «que tenga sus colores»). Copia la regla que Martín
// pidió para la de WhatsApp en la misma tanda (WhatsApp 12): «muestre solo el primer mensaje, y abajo a
// la derecha sutil "+1 mensaje...". Y si el mensaje es muy largo, que termine con "..."».
//
// ⚠️ EL ALTO LO ESTIMA `altoDeMensaje` (lib/flujo-conversacion.ts) ANTES de pintar, y la tarjeta tiene
// alto fijo: lo que no entra se corta. Por eso el texto va con `WebkitLineClamp` y «…», nunca crece.
// ⚠️ LAS VARIABLES CON LA FUNCIÓN DEL MOTOR (`aplicarVariables`): si la tarjeta resolviera un token que
// el envío no conoce, se vería perfecto acá y al lead le llegarían las llaves (AGENTS.md).

import type { ReactNode } from 'react';
import type { PasoSecuenciaDto } from './ChatAgentApp';
import type { AdjuntoDto } from '@/lib/setting-adjuntos-reglas';
import { aplicarVariables } from '@/lib/template-vars';
import { partesDe } from '@/lib/mensaje-partes';
import type { CanalSocial } from '@/lib/canal-social';
import { BurbujaSocial, ArchivoSocial, SimbolosSociales } from './social-ui';

export function VistaMensajeSocial({ paso, canal, negocio, adjuntos }: {
  paso: PasoSecuenciaDto;
  canal: CanalSocial;
  negocio: string;
  /** La biblioteca ya leída por el lienzo (null = no se pidió o no llegó: se dice «Archivo»). */
  adjuntos?: AdjuntoDto[] | null;
}) {
  const n = negocio.trim();
  const conNegocio = (t: string) => aplicarVariables(t, n ? { negocio: n } : {});
  const partes = partesDe(paso);
  const primera = partes[0];
  const mas = partes.length - 1;
  let cuerpo: ReactNode;
  if (!primera) cuerpo = <span style={{ fontSize: 12, color: 'var(--faint)' }}>Sin escribir</span>;
  else if (primera.tipo === 'media') {
    const adj = adjuntos?.find((a) => a.id === primera.media_id) ?? null;
    cuerpo = (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <ArchivoSocial canal={canal} compacta url={adj?.url ?? null} mime={adj?.media_mime ?? null} nombre={adj?.nombre_archivo ?? adj?.titulo ?? null} />
        {primera.cuerpo?.trim() && <BurbujaSocial canal={canal} compacta lineas={2}>{conNegocio(primera.cuerpo)}</BurbujaSocial>}
      </div>
    );
  } else if (primera.tipo === 'audio') {
    // Instagram no recibe las notas de voz de la biblioteca (lib/canal-social.ts): se dice, no se dibuja un reproductor.
    cuerpo = <span style={{ fontSize: 12, color: 'var(--warn)' }}>Nota de voz: no sale por aquí</span>;
  } else {
    cuerpo = <BurbujaSocial canal={canal} compacta lineas={5}>{conNegocio(primera.cuerpo)}</BurbujaSocial>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 0 }}>
      <SimbolosSociales />
      {cuerpo}
      {mas > 0 && (
        <div style={{ marginTop: 4, alignSelf: 'flex-end', fontSize: 11, lineHeight: '16px', color: 'var(--dim)', fontWeight: 600 }}>
          +{mas} {mas === 1 ? 'mensaje' : 'mensajes'}…
        </div>
      )}
    </div>
  );
}
