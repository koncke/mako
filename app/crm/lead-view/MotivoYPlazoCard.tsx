// =============================================================================
// Motivo de salida y plazo de la nutrición manual — los dos campos sueltos
// =============================================================================
// Son los dos que quedaban SOLO dentro del formulario de «Editar lead →» y que
// no tenían dónde leerse en la ficha: el motivo se dibujaba de solo lectura en el
// modal (y en la ruta ni eso), y la fecha límite de la nutrición manual no se
// veía en ninguna de las dos.
//
// ⚠️ VIVEN EN UN SOLO ARCHIVO Y LAS DOS FICHAS MONTAN LO MISMO. Es la MISMA ficha
// por dos puertas (`app/crm/LeadSheet.tsx` y `app/crm/[id]/page.tsx`) y ya se pagó
// tres veces que una se quedara con la versión anterior.
//
// Sin directiva `'use client'`: lo único interactivo es el campo, que ya la trae
// (`./CampoEditable`). Así la tarjeta la puede renderizar el server.

import type { CSSProperties } from 'react';
import { CajaCampo, TextoEditable, FechaEditable } from './CampoEditable';

const MONO = "'Geist Mono', monospace";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };

/** ¿Este lead salió del embudo? Es la condición del motivo, y la misma que aplica `updateLead`. */
export function leadSalio(estado: string | null | undefined): boolean {
  return estado === 'perdido' || estado === 'descalificado';
}

/**
 * Por qué se perdió o se descalificó, corregible en el lugar.
 *
 * ⚠️ SE DIBUJA AUNQUE ESTÉ VACÍO. Antes la tarjeta pedía `isLost && motivo`, o sea
 * que el lead perdido SIN motivo —justo el que hay que completar— no mostraba nada
 * y el único camino era el formulario. Ahora el hueco es el campo.
 *
 * ⚠️ Y NO LLEVA LOS CHIPS de «Precio / Timing / No calificado / Fantasma / Otro»
 * que tenía el formulario: ésos siguen vivos donde se decide la salida (el wizard
 * de etapa, `app/crm/StageMoveDialog.tsx`), que es cuando se elige el motivo. Acá
 * se CORRIGE uno ya escrito, y una fila de cinco botones para eso es la caja que
 * este cambio vino a sacar.
 */
export function MotivoCard({ leadId, motivo }: { leadId: number; motivo: string | null }) {
  return (
    <section style={card}>
      <div style={{ ...sectLabel, marginBottom: 12 }}>Motivo de salida</div>
      {/* Toda la tarjeta abre el campo (punto 7, 12/10/2026): `CajaCampo`. */}
      <CajaCampo style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.5 }}>
        <TextoEditable leadId={leadId} campo="motivo_perdida" valor={motivo} titulo="Motivo de salida" placeholder="Por qué se perdió" />
      </CajaCampo>
    </section>
  );
}

/**
 * La fecha límite de «Nutrición - Manual».
 *
 * ⚠️ NO SE PUEDE VACIAR, y el candado está en el server (`valorDeCampo`), no acá:
 * de esa fecha cuelga el aviso de nutrición vencida (`lib/crm-auto-plan.ts`), así
 * que borrarla saca al lead del radar sin decir nada. Era la única validación de
 * campo que el formulario tenía de verdad y se conserva.
 */
export function PlazoNutricionCard({ leadId, deadline }: { leadId: number; deadline: string | null }) {
  return (
    <section style={card}>
      <div style={{ ...sectLabel, marginBottom: 12 }}>Nutrición manual</div>
      <CajaCampo style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13.5, color: 'var(--dim)' }}>Fecha límite</span>
        <FechaEditable
          leadId={leadId}
          campo="nutricion_manual_deadline"
          valor={deadline}
          titulo="Fecha límite de la nutrición manual"
          vacio="sin plazo"
          estilo={{ fontSize: 15, fontWeight: 700, color: deadline ? 'var(--ink)' : 'var(--bad)' }}
        />
      </CajaCampo>
      <p style={{ fontSize: 12.5, color: 'var(--faint)', margin: '10px 0 0', lineHeight: 1.5 }}>Si vence sin que el lead avance, vuelve a la lista de datos sin marcar.</p>
    </section>
  );
}
