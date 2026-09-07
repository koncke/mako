// =============================================================================
// La tira del Q — el norte, en UNA línea
// =============================================================================
// ⚠️ ACÁ ESTÁ LA INVERSIÓN QUE DEFINE EL REDISEÑO, y conviene que quede escrita.
//
// Esto reemplaza a `HeroGoal`: un bloque oscuro de 38 px de padding con un
// contador de 108 px («Camino a los 20 cierres»), cuarenta bloquecitos de «1
// bloque = 1 cierre» y dos tarjetas abajo. Ocupaba la mitad del alto útil de la
// pantalla de entrada para decir un número sobre el que nadie puede actuar hoy.
//
// Si `/general` es FOCUS, el espacio grande se lo lleva la ACCIÓN. El norte no
// desaparece —hace falta para saber si vas bien— pero se encoge a esto.
//
// Y lleva la capacidad instalada al lado, que es la otra mitad de la pregunta:
// «¿vamos bien?» sin «¿podemos entregarlo?» es cómo se vende lo que después no se
// puede cumplir.
// =============================================================================

import { EditarObjetivo, EditarCapacidad } from './EditarObjetivo';
import type { ObjectiveConAvance } from '@/lib/objectives';
import type { CapacidadLeida } from '@/lib/objectives';
import type { ProgresoQuarter } from '@/lib/objectives-modelo';

const MONO = "'Geist Mono', monospace";

const fmtValor = (n: number | null, unidad: string): string => {
  if (n === null) return '—';
  return unidad === 'usd' ? `US$${Math.round(n).toLocaleString('es-MX')}` : String(Math.round(n));
};

/** dd/mm/aaaa. Nunca el ISO crudo: nadie lee `2026-11-14` como una fecha. */
function fmtDMY(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function TiraQ({ progreso, objetivos, capacidad, anio, quarter }: {
  progreso: ProgresoQuarter;
  objetivos: ObjectiveConAvance[];
  capacidad: CapacidadLeida;
  anio: number;
  quarter: number;
}) {
  const principal = objetivos[0] ?? null;

  return (
    <section style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18,
      padding: '18px 22px',
      display: 'flex', alignItems: 'center', gap: 26, flexWrap: 'wrap',
    }}>
      {/* ── El período ── */}
      <div style={{ flex: 'none' }}>
        <div style={{ fontWeight: 600, fontSize: 17, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
          Q{quarter} {anio}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 2 }}>
          {progreso.diasRestantes === 0
            ? 'último día'
            : `faltan ${progreso.diasRestantes} ${progreso.diasRestantes === 1 ? 'día' : 'días'}`}
        </div>
      </div>

      <span aria-hidden style={{ flex: 'none', width: 1, alignSelf: 'stretch', background: 'var(--border)' }} />

      {/* ── El objetivo principal ── */}
      <div style={{ flex: 1, minWidth: 260 }}>
        <EditarObjetivo
          objetivo={principal ? {
            id: principal.id, titulo: principal.titulo, metrica: principal.metrica,
            metaValor: principal.metaValor, quarter: principal.quarter, avanceManual: principal.avanceManual,
          } : null}
          anio={anio}
          quarter={quarter}
          disparador={
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>
                  {principal ? principal.titulo : 'Define el objetivo del trimestre'}
                </span>
                {principal && (
                  <span style={{ fontSize: 14, color: 'var(--dim)', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtValor(principal.actual, principal.unidad)} / {fmtValor(principal.metaValor, principal.unidad)}
                    {principal.pct !== null && <> · {Math.round(principal.pct)}%</>}
                  </span>
                )}
              </div>

              {principal && (
                <>
                  <div style={{ width: '100%', height: 8, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden', margin: '8px 0 6px' }}>
                    {/* ⚠️ La barra se recorta al 100% y el carril tiene overflow
                        hidden: un `width: 148%` no desborda la barra, desborda la
                        PÁGINA. Ya pasó en este repo con un gráfico de precios. */}
                    <div style={{
                      width: `${Math.min(100, principal.pct ?? 0)}%`, height: '100%', borderRadius: 999,
                      background: principal.ritmo?.alDia ? 'var(--good)' : 'var(--warn-fill)',
                    }} />
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>
                    {/* ⚠️ Si la métrica no se pudo leer NO se dice «vas atrasado»:
                        se dice que no se pudo leer. Un error de lectura no es un
                        dato del negocio. */}
                    {principal.actual === null
                      ? (principal.error ?? 'no pude leer esta métrica')
                      : principal.ritmo
                        ? <>A este ritmo llegas el <strong style={{ color: 'var(--ink)' }}>{fmtDMY(principal.ritmo.llegadaEstimada)}</strong>{principal.ritmo.llegadaEstimada === null ? '' : principal.ritmo.alDia ? ' · al día' : ' · atrasado'}</>
                        : 'sin ritmo todavía'}
                  </div>
                </>
              )}
            </div>
          }
        />
      </div>

      <span aria-hidden style={{ flex: 'none', width: 1, alignSelf: 'stretch', background: 'var(--border)' }} />

      {/* ── La capacidad ── */}
      <div style={{ flex: 'none', minWidth: 150 }}>
        <EditarCapacidad
          cupo={capacidad.cupo}
          mesesEntrega={capacidad.mesesEntrega}
          disparador={
            <div>
              <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 4 }}>
                Capacidad
              </div>
              {/* Tres estados, y ninguno miente:
                  · sin cupo cargado → no se afirma nada, se invita a cargarlo
                  · no se pudo contar → se dice, en vez de mostrar «0 activos»
                  · con los dos → el número y cuánto lugar queda */}
              {capacidad.error ? (
                <div style={{ fontSize: 13.5, color: 'var(--dim)' }}>No pude contar tus clientes</div>
              ) : capacidad.cupo === null ? (
                <div style={{ fontSize: 13.5, color: 'var(--dim)' }}>
                  {capacidad.activos} {capacidad.activos === 1 ? 'cliente activo' : 'clientes activos'}
                  <span style={{ display: 'block', color: 'var(--faint)', fontSize: 12.5 }}>define tu cupo →</span>
                </div>
              ) : (
                <>
                  <div style={{ fontWeight: 600, fontSize: 17, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                    {capacidad.activos} / {capacidad.cupo}
                  </div>
                  <div style={{ fontSize: 12.5, color: capacidad.libres === 0 ? 'var(--warn)' : 'var(--dim)', marginTop: 2 }}>
                    {capacidad.libres === 0
                      ? 'sin lugar libre'
                      : `lugar para ${capacidad.libres} más`}
                  </div>
                </>
              )}
            </div>
          }
        />
      </div>
    </section>
  );
}
