'use client';

// =============================================================================
// «Si el lead contesta», POR CAMINO, en el panel del CRON (14/10/2026)
// =============================================================================
// Era una regla escondida del motor: cualquier mensaje del lead frenaba todo lo que tenía por delante
// (`pausarPorRespuesta`, lib/nutricion.ts), y así no salió la bienvenida del bug 5 (el lead le contestó a
// Mauricio un mensaje a mano). Martín, 14/10/2026: «jamás que "mako" haga cosas que no están en el flujo», y
// eligió «Opción en cada camino, sigue de fábrica». Un camino = una flecha del CRON (`caminosDeSalida`). Lo que
// se elige acá lo leen el motor (`alResponder`, `seMueveEnLaCorrida`) y «Probar» (`pausarPorRespuesta` del
// simulador) con la MISMA función, `siContestaDe`.
// =============================================================================

import { Dropdown } from '@/app/components/Dropdown';
import { caminosDeSalida, siContestaDe, type PasoGrafo, type SiContesta } from '@/lib/flujo-grafo';
import { nombreDeTarjeta } from '@/lib/flujo-conversacion';

const OPCIONES: Array<{ value: SiContesta; label: string }> = [
  { value: 'sigue', label: 'Sigue' },
  { value: 'corta', label: 'Se corta' },
];

export function SiContestaCaminos({ pasos, onFijar, editable }: {
  pasos: readonly PasoGrafo[];
  onFijar: (clave: string, valor: SiContesta) => void;
  editable: boolean;
}) {
  const caminos = caminosDeSalida(pasos);
  if (!caminos.length) return null;
  return (
    <div data-si-contesta style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--dim)' }}>Si el lead contesta</div>
      {caminos.map((c, k) => {
        const valor = siContestaDe(pasos, c.clave);
        const tarjeta = nombreDeTarjeta(pasos, c.raiz);
        const nombre = caminos.length > 1 ? `Camino ${k + 1} · ${tarjeta}` : tarjeta;
        return (
          <div key={c.clave} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div title={nombre} style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {nombre}
            </div>
            {editable ? (
              <Dropdown
                value={valor}
                options={OPCIONES}
                onChange={(v) => onFijar(c.clave, v === 'corta' ? 'corta' : 'sigue')}
                ariaLabel={`Si el lead contesta, ${nombre}`}
                width={118}
              />
            ) : (
              <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>{valor === 'sigue' ? 'Sigue' : 'Se corta'}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
