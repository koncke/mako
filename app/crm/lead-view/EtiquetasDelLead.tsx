'use client';

// =============================================================================
// EtiquetasDelLead — las etiquetas del lead en su ficha: chips con ×, y «+ Etiqueta»
// =============================================================================
// Pedido de Martín (08/10/2026, punto 12): «Deberías agregar todo un sistema de ETIQUETAS...».
// El molde es ManyChat: en la ficha del contacto las etiquetas son chips, se saca una con su ×
// y se agrega con «Add Tag» — una existente o una nueva, en el mismo selector.
//
// Actúa al toque, sin «¿estás seguro?»: el chip que aparece o se va ES la confirmación, y una
// etiqueta se vuelve a poner con un clic. No hay «Deshacer» a propósito: volver a poner una que
// se sacó DISPARARÍA de nuevo las automatizaciones de esa etiqueta, y un deshacer que manda un
// mensaje no es un deshacer.
//
// La escritura va por POST /api/crm/etiquetas → lib/etiquetas.ts (la única puerta: historial,
// espejo con la etapa, disparo y WhatsApp). Si la etiqueta está vinculada a una etapa, ponerla
// puede mover al lead: por eso después de escribir se relee la ficha con `useRefrescarFicha()`
// —nunca `router.refresh()` suelto: la ficha del tablero es una foto (ficha-cambio.tsx)—.
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import { useRefrescarFicha } from './ficha-cambio';
import { ChipEtiqueta, SelectorEtiqueta, type Etiqueta } from '@/app/_components/etiquetas-cliente';

type EtiquetaDelLead = Etiqueta & { puesta_at: string; puesta_por: string };
type Resultado = { ok?: boolean; error?: string; yaEstaba?: boolean; movio?: boolean; sync?: Array<{ destino: string; ok: boolean }> };

/**
 * La `version` con la que se releen los chips: cambia cuando cambia la ETAPA del lead en
 * cualquiera de sus productos. `updated_at` de la fila sube con todo lo que escribe la casa (la
 * etapa, las fechas que la derivan, el desenlace) y las etapas de los productos agregados cubren
 * lo que se mueve en `lead_funnel`, que no toca la fila del lead. Es un CÁLCULO sobre lo que la
 * ficha ya tiene, no un contador que cada camino tenga que acordarse de subir (AGENTS.md).
 */
export function versionDeEtiquetas(actualizado: string | null | undefined, productos: ReadonlyArray<{ id: number; etapa: string | null }> | null | undefined): string {
  return `${actualizado ?? ''}|${(productos ?? []).map((p) => `${p.id}:${p.etapa ?? ''}`).join(',')}`;
}

/**
 * `version`: ver `versionDeEtiquetas`. Revisión del 08/10/2026 (etiquetas-5): mover al lead de
 * etapa desde otro control ponía y sacaba sus etiquetas vinculadas (el espejo), la cabecera
 * cambiaba y estos chips seguían mostrando las de antes — leían sólo al montarse, y ni el `releer`
 * de la ficha ni el `router.refresh()` de la ruta los remontan.
 */
export function EtiquetasDelLead({ leadId, version }: { leadId: number; version?: string | number }) {
  const refrescarFicha = useRefrescarFicha();
  const [suyas, setSuyas] = useState<EtiquetaDelLead[] | null>(null);
  const [ocupada, setOcupada] = useState<number | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const leer = useCallback(async () => {
    try {
      const r = await fetch(`/api/crm/etiquetas?leadId=${leadId}`, { cache: 'no-store' });
      const j = await r.json() as { ok?: boolean; delLead?: EtiquetaDelLead[]; error?: string };
      if (!j.ok) throw new Error(j.error || 'No se pudieron leer.');
      setSuyas(j.delLead ?? []);
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se pudieron leer.');
      setSuyas((s) => s ?? []);
    }
  }, [leadId]);

  useEffect(() => { void leer(); }, [leer, version]);

  const escribir = async (action: 'poner' | 'sacar', e: Etiqueta) => {
    if (ocupada != null) return;
    setOcupada(e.id);
    setAviso(null);
    try {
      const r = await fetch('/api/crm/etiquetas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, leadId, etiquetaId: e.id }),
      });
      const j = await r.json() as Resultado;
      if (!j.ok) { setAviso(j.error || 'No se pudo.'); return; }
      const mal = (j.sync ?? []).filter((x) => !x.ok).map((x) => x.destino);
      if (mal.length) setAviso(`No se pasó a ${mal.join(' ni ')}`);
      await leer();
      // Ponerla pudo moverlo de etapa: la cabecera y el tablero se releen.
      refrescarFicha();
    } catch {
      setAviso('No se pudo.');
    } finally {
      setOcupada(null);
    }
  };

  const puestas = new Set((suyas ?? []).map((e) => e.id));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, minWidth: 0 }}>
        {(suyas ?? []).map((e) => (
          <ChipEtiqueta key={e.id} e={e} ocupado={ocupada === e.id} onSacar={() => void escribir('sacar', e)} />
        ))}
        {/* «Agregar», no «Ponerle» (sexta tanda, TAG 1: «se formal escribiendo siempre... "Agregar" y
            "Eliminar"»). */}
        <SelectorEtiqueta value={null} accion editable placeholder="Etiqueta" ariaLabel="Agregar una etiqueta"
          excluir={puestas} disabled={suyas == null || ocupada != null} width={150}
          icono={<span aria-hidden style={{ color: 'var(--dim)', fontWeight: 600 }}>＋</span>}
          buttonStyle={{ height: 30, padding: '0 10px', borderRadius: 999, fontSize: 12.5 }}
          onElegir={(e) => void escribir('poner', e)} />
      </div>
      {aviso && <span role="status" style={{ fontSize: 12, color: 'var(--bad)' }}>{aviso}</span>}
    </div>
  );
}
