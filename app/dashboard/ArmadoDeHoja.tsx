'use client';

// =============================================================================
// ArmadoDeHoja — las tarjetas que MaKo acaba de armar en la hoja aparecen de a una (./armado-hoja.ts explica el porqué)
// =============================================================================
// Lo monta el editor (./EditorInforme.tsx) encima del lienzo, con una `key` por cada armado: así la cuenta arranca de cero
// en cada uno. Usa la cadencia de la pieza compartida (`useRevelado`, app/_ui/ArmadoEnVivo.tsx) y su «Ver todo». Cuando ya
// se ve todo, avisa (`onFin`) y el editor lo desmonta.
// =============================================================================

import { useEffect } from 'react';
import { useRevelado, VerTodoArmado } from '@/app/_ui/ArmadoEnVivo';
import { cssDeArmado } from './armado-hoja';

export function ArmadoDeHoja({ ids, onFin }: { ids: readonly string[]; onFin: () => void }) {
  const { visibles, saltear } = useRevelado(ids.length);
  const fin = visibles >= ids.length;
  useEffect(() => { if (fin) onFin(); }, [fin, onFin]);
  const css = cssDeArmado(ids, visibles);
  return (
    <>
      {css ? <style>{css}</style> : null}
      {!fin && (
        <div style={{ position: 'sticky', top: 8, zIndex: 6, height: 0, display: 'flex', justifyContent: 'flex-end', pointerEvents: 'none' }}>
          <div role="status" aria-live="polite" style={{
            pointerEvents: 'auto', display: 'inline-flex', alignItems: 'center', gap: 10, margin: '0 12px', padding: '4px 4px 4px 12px',
            borderRadius: 9999, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)', fontSize: 13,
            fontVariantNumeric: 'tabular-nums', boxShadow: '0 2px 10px color-mix(in srgb, var(--ink) 10%, transparent)',
          }}>
            <span>{visibles} de {ids.length} {ids.length === 1 ? 'tarjeta' : 'tarjetas'}</span>
            <VerTodoArmado onClick={saltear} />
          </div>
        </div>
      )}
    </>
  );
}
