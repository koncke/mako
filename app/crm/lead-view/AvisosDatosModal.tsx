'use client';

// =============================================================================
// AvisosDatosModal — de qué datos sin marcar te avisa MaKo
// =============================================================================
// Martín (13/10/2026): «es importante poder configurar que datos quiero que MaKo me notifique
// que estan sin marcar, para eso, en el título del desplegable como en los 3 puntos de la tab
// CRM una opción para configurar esto, donde el usuario pueda elegir que datos le parecen
// importante que MaKo le notifique».
//
// Cada interruptor se guarda al tocarlo: no hay «Guardar» que olvidarse de apretar. Lo decide el
// admin y cambia el worklist, «A revisar» y los avisos de todo el equipo. La asistencia a una
// reunión que ya pasó no se puede apagar (lib/datos-aviso.ts → NO_IGNORABLES).
//
// ⚠️ DESDE LA FICHA DE UN LEAD VA CON `funnelId` (su casa; null = el producto del negocio). Desde el
// 14/10/2026 los avisos son POR FUNNEL (decisión 1 de docs/diseno-ficha-bloques.md) y el lead cuenta
// los de SU funnel, que arranca con los de su plantilla. Sin `funnelId` el modal lee y guarda los del
// NEGOCIO, el respaldo de todos los funnels: abierto así desde la ficha, en un funnel de Prospección
// mostraba «¿Era lead calificado?» prendido mientras la plantilla lo tenía apagado, y no había cómo
// prenderlo (medido en producción, ws9, 15/10/2026). «A revisar» mezcla funnels: ahí va sin él.
// =============================================================================

import { useEffect, useState } from 'react';
import { Modal } from '@/app/_ui/Modal';
import { Switch } from '@/app/_ui/Toggle';
import { DATOS_AVISABLES, NO_IGNORABLES } from '@/lib/datos-aviso';
import type { StepId } from '@/lib/stage-requirements';
import { avisosDatosAction, guardarAvisosDatosAction } from '../datos-sin-marcar-actions';

const GRUPOS = ['Reuniones', 'Venta', 'Equipo y contacto'] as const;

export function AvisosDatosModal({ funnelId, onCerrar, onGuardado }: {
  /** La casa del lead (null = el producto del negocio). Sin él (undefined), los del negocio. */
  funnelId?: number | null;
  onCerrar: () => void;
  onGuardado?: () => void;
}) {
  const [apagados, setApagados] = useState<StepId[] | null>(null);
  const [puede, setPuede] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const delFunnel = funnelId !== undefined;

  useEffect(() => {
    let vivo = true;
    // Sin argumento y no `undefined`: el undefined de las actions distingue «el negocio» de «el
    // funnel del negocio» (null), y así no depende de cómo viaje un undefined al server.
    void (delFunnel ? avisosDatosAction(funnelId) : avisosDatosAction())
      .then((r) => { if (vivo) { setApagados(r.apagados); setPuede(r.puedeEditar); } })
      .catch(() => { if (vivo) setErr('No se pudo leer.'); });
    return () => { vivo = false; };
  }, [delFunnel, funnelId]);

  const cambiar = (id: StepId, avisa: boolean) => {
    if (!apagados) return;
    const antes = apagados;
    const nuevos = avisa ? apagados.filter((x) => x !== id) : [...apagados, id];
    setApagados(nuevos);
    setErr(null);
    void (delFunnel ? guardarAvisosDatosAction(nuevos, funnelId) : guardarAvisosDatosAction(nuevos)).then((r) => {
      if (!r.ok) { setApagados(antes); setErr(r.error); return; }
      onGuardado?.();
    }).catch(() => { setApagados(antes); setErr('No se pudo guardar.'); });
  };

  return (
    <Modal titulo="Avisos de datos sin marcar" onCerrar={onCerrar} ancho={460}>
      <div>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--dim)' }}>
          {!puede ? 'Solo el administrador puede cambiarlo.'
            : delFunnel ? 'En este funnel, MaKo te avisa de los prendidos.'
            : 'En todos los funnels, salvo lo que cambie cada uno.'}
        </p>
        {err && <p role="alert" style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--bad)', fontWeight: 600 }}>{err}</p>}
        {!apagados ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--faint)' }}>{err ? '' : 'Cargando…'}</p>
        ) : GRUPOS.map((g) => (
          <div key={g} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)', fontFamily: "'Geist Mono', monospace", marginBottom: 6 }}>{g}</div>
            {DATOS_AVISABLES.filter((d) => d.grupo === g).map((d) => {
              const fijo = NO_IGNORABLES.has(d.id);
              return (
                <div key={d.id} style={{ padding: '6px 0', borderTop: '1px solid var(--border)' }}
                  title={fijo ? 'Una reunión que ya pasó siempre avisa: falta decir qué ocurrió.' : undefined}>
                  <Switch label={d.label} checked={fijo || !apagados.includes(d.id)} disabled={fijo || !puede}
                    onChange={(v) => cambiar(d.id, v)} />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Modal>
  );
}
