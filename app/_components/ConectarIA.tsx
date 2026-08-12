'use client';

// =============================================================================
// ConectarIA — "se quedó sin cuota" ofrece TODAS las salidas, no una sola
// =============================================================================
// Cuando una generación falla por la IA, el cuadro de abajo del error hardcodeaba
// `servicioKey="gemini"`: le ofrecía pegar la key de Gemini a alguien que ya la
// tenía pegada y agotada. Las tres salidas reales son:
//
//   1. Sumar OTRA CUENTA del proveedor que se agotó (el free tier se agota por
//      cuenta, no por proveedor) → lo resuelve el propio ServicioConfigForm.
//   2. Conectar OTRA IA GRATIS que todavía no tenga → es lo que faltaba, y es la
//      más efectiva: son cinco proveedores gratis y casi nadie tiene los cinco.
//   3. Esperar a que la cuota se reinicie (lo dice el texto del error).
//
// Muestra el estado real de cada IA gratis (cuántas cuentas y si le queda cuota
// HOY) y arranca abierto en la que más ayuda: la primera SIN conectar.
//
// Estado VIVO, no recordado: el estado sale de /api/ia/proveedores en cada
// apertura, no de un flag guardado — una key puede haber sido borrada o haberse
// quedado sin cuota desde la última vez que alguien miró.

import { useCallback, useEffect, useState } from 'react';
import ServicioConfigForm from '../integraciones/ServicioConfigForm';

const MONO = "'Geist Mono', monospace";

type Prov = { key: string; nombre: string; paraQue: string; cuentas: number; max: number; pct: number; agotado: boolean };

/** Qué le queda a esta IA, en una línea. Es lo que decide dónde conviene pegar. */
function estado(p: Prov): { texto: string; color: string } {
  if (!p.cuentas) return { texto: 'sin conectar', color: 'var(--faint)' };
  const cuentas = p.cuentas === 1 ? '1 cuenta' : `${p.cuentas} cuentas`;
  if (p.agotado) return { texto: `${cuentas} · sin cuota hoy`, color: 'var(--bad)' };
  return { texto: `${cuentas} · con cuota`, color: 'var(--good)' };
}

export default function ConectarIA({ onConectada }: {
  /** Se conectó (o se sumó) una key: el caller puede limpiar el error y reintentar. */
  onConectada?: () => void;
}) {
  const [provs, setProvs] = useState<Prov[] | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const j = await fetch('/api/ia/proveedores').then((r) => r.json());
      if (!j.ok || !Array.isArray(j.provs)) { setProvs([]); return; }
      const lista = j.provs as Prov[];
      setProvs(lista);
      // Abre sola la que más resuelve: la primera SIN conectar. Si están todas,
      // la primera que todavía tenga cuota (para sumarle otra cuenta).
      setAbierto((a) => a ?? (lista.find((p) => !p.cuentas) ?? lista.find((p) => !p.agotado) ?? lista[0])?.key ?? null);
    } catch { setProvs([]); }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  if (provs === null) {
    return <div style={{ fontFamily: MONO, fontSize: 12, color: 'var(--faint)' }}>Viendo qué IA tenés conectadas…</div>;
  }
  if (!provs.length) {
    // Sin sesión o sin catálogo: no dejamos el hueco mudo, pero tampoco inventamos.
    return <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>Conectá una IA desde Integraciones y volvé a intentar.</div>;
  }

  const sinConectar = provs.filter((p) => !p.cuentas).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {sinConectar > 0 && (
        <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>
          Te {sinConectar === 1 ? 'queda' : 'quedan'} {sinConectar} IA gratis sin conectar. Cada una suma su propia cuota, y MaKo pasa
          de una a la otra sola cuando la primera se queda sin nafta.
        </div>
      )}

      {/* Una fila por proveedor: nombre, estado real y la segunda capa adentro.
          El que está abierto muestra su formulario debajo — nunca dos a la vez,
          porque pegar dos keys al mismo tiempo no es lo que nadie viene a hacer. */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {provs.map((p, i) => {
          const est = estado(p);
          const esteAbierto = abierto === p.key;
          return (
            <div key={p.key} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
              <button type="button" onClick={() => setAbierto(esteAbierto ? null : p.key)}
                aria-expanded={esteAbierto}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 2px',
                  border: 0, background: 'none', cursor: 'pointer', textAlign: 'left', font: 'inherit',
                }}>
                <span aria-hidden style={{ flex: 'none', width: 7, height: 7, borderRadius: 999, background: est.color }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.nombre}
                </span>
                <span style={{ flex: 'none', fontFamily: MONO, fontSize: 10.5, color: est.color, whiteSpace: 'nowrap' }}>{est.texto}</span>
                <span aria-hidden style={{ flex: 'none', fontSize: 11, color: 'var(--faint)' }}>{esteAbierto ? '▾' : '▸'}</span>
              </button>
              {esteAbierto && (
                <div style={{ padding: '2px 0 14px' }}>
                  {/* `onGuardado` y no `onEstado`: sumar la segunda cuenta de un
                      proveedor YA conectado no cambia el conectado/no conectado,
                      y es exactamente el caso que trae acá al usuario. */}
                  <ServicioConfigForm servicioKey={p.key} onGuardado={() => { onConectada?.(); void cargar(); }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
