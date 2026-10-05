'use client';

// =============================================================================
// ChatAnalystVista — la cáscara cliente del dashboard de secuencias
// =============================================================================
// Existe sólo para que el gráfico (recharts, cliente) reciba los datos que el server ya
// resolvió, y para armar la etiqueta de cada etapa con las del funnel del workspace.
//
// ⚠️ NO DUPLICA EL DASHBOARD: monta el MISMO `DashboardChatAgent` que vivía en la cuarta
// pestaña de /chatbot. Dos pantallas del mismo dato divergen, y la que se queda vieja es
// la que menos se abre — es la lección del editor de diagramas del funnel.

import { useCallback } from 'react';
import { DashboardChatAgent } from '@/app/chatbot/DashboardChatAgent';
import type { SecuenciaDto, Opcion } from '@/app/chatbot/ChatAgentApp';
import type { PuntoSerie } from '@/lib/setting-metricas';

// Las mismas etiquetas legacy que el Chatbot: una secuencia vieja cuelga de `nutri` o
// `postagenda`, que no son stage keys del funnel de nadie.
const ETAPA_LABEL: Record<string, string> = {
  nutri: 'No Agenda', postagenda: 'Post-agenda', noshow: 'No Show', nopaga: 'No Paga', manual: 'Manual',
  noshow_r1: 'No Show R1', noshow_r2: 'No Show R2', noshow_r3: 'No Show R3',
  nocompro: 'No Compró', nutridiaria: 'Nutrición diaria', reactivacion: 'Reactivación',
  reunion_excepcional: 'Reunión excepcional',
};

export function ChatAnalystVista({ secuencias, serie, etapas }: {
  secuencias: SecuenciaDto[];
  serie: PuntoSerie[];
  etapas: Opcion[];
}) {
  const etiquetaEtapa = useCallback(
    (key: string) => etapas.find((e) => e.value === key)?.label ?? ETAPA_LABEL[key] ?? key,
    [etapas],
  );

  if (!secuencias.length) {
    return (
      <div style={{ background: 'var(--surface)', border: '1px dashed var(--border-strong)', borderRadius: 14, padding: '28px 24px', color: 'var(--dim)', fontSize: 14 }}>
        Todavía no hay secuencias de mensajes que medir.
      </div>
    );
  }
  return <DashboardChatAgent secuencias={secuencias} serie={serie} etiquetaEtapa={etiquetaEtapa} />;
}
