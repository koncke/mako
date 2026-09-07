// =============================================================================
// El norte, en UNA línea
// =============================================================================
// Dos reescrituras y conviene que las dos queden anotadas, porque el error fue
// distinto cada vez.
//
// v1 era `HeroGoal`: un bloque oscuro de 38 px de padding con un contador de
// 108 px, cuarenta bloquecitos de «1 bloque = 1 cierre» y dos tarjetas abajo.
// Ocupaba medio alto útil para decir un número sobre el que nadie puede actuar.
//
// v2 lo encogió a una tira, pero la dejó como TARJETA con rótulos en monospace
// (`CAPACIDAD`). Dos vetos: «cards are the lazy container» y «monospace as a
// costume». Encoger no alcanzaba: el problema era el chrome, no el tamaño.
//
// v3 es esto: una línea, sin caja, con una barra que ES el dato. La estructura se
// siente, no se ve — que es literal de Linear y lo que el documento de rediseño
// eligió como dirección.
// =============================================================================

import { EditarObjetivo, EditarCapacidad } from './EditarObjetivo';
import type { ObjectiveConAvance, CapacidadLeida } from '@/lib/objectives';
import type { ProgresoQuarter } from '@/lib/objectives-modelo';

const fmtValor = (n: number | null, unidad: string): string => {
  if (n === null) return '—';
  if (unidad === 'usd') {
    return n >= 1000 ? `US$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `US$${Math.round(n)}`;
  }
  return String(Math.round(n));
};

/** Un botón que no se ve como botón: el texto es el control. */
const invisible = { background: 'none', border: 'none', padding: 0, font: 'inherit', textAlign: 'left' as const, cursor: 'pointer' };

export function TiraQ({ progreso, objetivos, capacidad, anio, quarter }: {
  progreso: ProgresoQuarter;
  objetivos: ObjectiveConAvance[];
  capacidad: CapacidadLeida;
  anio: number;
  quarter: number;
}) {
  const principal = objetivos[0] ?? null;
  const pct = principal?.pct ?? null;
  const alDia = principal?.ritmo?.alDia ?? true;

  return (
    <section style={{
      display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap',
      paddingBottom: 20, borderBottom: '1px solid var(--border)',
      fontSize: 13.5, color: 'var(--dim)',
    }}>
      <span style={{ flex: 'none', color: 'var(--ink)', fontWeight: 600 }}>Q{quarter} {anio}</span>
      <span style={{ flex: 'none' }}>
        {progreso.diasRestantes === 0 ? 'último día' : `${progreso.diasRestantes} días`}
      </span>

      {/* El objetivo: la barra es el dato, y el texto al lado es el número exacto. */}
      <div style={{ flex: '1 1 260px', minWidth: 220, display: 'flex', alignItems: 'center', gap: 12 }}>
        <EditarObjetivo
          objetivo={principal ? {
            id: principal.id, titulo: principal.titulo, metrica: principal.metrica,
            metaValor: principal.metaValor, quarter: principal.quarter, avanceManual: principal.avanceManual,
          } : null}
          anio={anio}
          quarter={quarter}
          disparador={
            <span style={{ ...invisible, display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
              {principal ? (
                <>
                  {/* ⚠️ El carril recorta al 100%: un valor por encima de la meta
                      no desborda la barra, desborda la PÁGINA. Ya pasó acá. */}
                  <span style={{ flex: 1, minWidth: 90, height: 6, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
                    <span style={{
                      display: 'block', height: '100%', borderRadius: 999,
                      width: `${Math.min(100, pct ?? 0)}%`,
                      background: principal.actual === null ? 'var(--faint)' : alDia ? 'var(--good)' : 'var(--warn-fill)',
                    }} />
                  </span>
                  <span style={{ flex: 'none', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtValor(principal.actual, principal.unidad)}<span style={{ color: 'var(--faint)' }}> / {fmtValor(principal.metaValor, principal.unidad)}</span>
                  </span>
                </>
              ) : (
                <span style={{ color: 'var(--primary)', fontWeight: 500 }}>Define el objetivo del trimestre →</span>
              )}
            </span>
          }
        />
      </div>

      {/* La capacidad. Tres estados y ninguno miente: sin cupo no se afirma nada,
          sin poder contar se dice, y con los dos va el número. */}
      <EditarCapacidad
        cupo={capacidad.cupo}
        mesesEntrega={capacidad.mesesEntrega}
        disparador={
          <span style={{ ...invisible, flex: 'none', display: 'inline-block' }}>
            {capacidad.error ? (
              <span style={{ color: 'var(--faint)' }}>clientes: no pude contarlos</span>
            ) : capacidad.cupo === null ? (
              <span>{capacidad.activos} clientes · <span style={{ color: 'var(--primary)' }}>define tu cupo →</span></span>
            ) : (
              <span style={{ color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                {capacidad.activos}<span style={{ color: 'var(--faint)' }}>/{capacidad.cupo}</span>
                <span style={{ color: capacidad.libres === 0 ? 'var(--warn)' : 'var(--dim)', fontWeight: 400 }}>
                  {capacidad.libres === 0 ? ' sin lugar' : ` · ${capacidad.libres} libres`}
                </span>
              </span>
            )}
          </span>
        }
      />
    </section>
  );
}
