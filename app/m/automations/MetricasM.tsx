'use client';
// =============================================================================
// MetricasM — las Métricas de una automatización en el teléfono (23/10/2026)
// =============================================================================
// En la computadora, «Métricas» reemplaza al lienzo por el editor del Dashboard (app/automations/MetricasAutomatizacion.tsx).
// El teléfono DESTILA (la regla de MaKo Mobile): la MISMA hoja —la de MaKo o la que la persona armó—, pasada por el
// conversor del Dashboard del teléfono (`hojaPropia`, app/m/dashboard/datos.ts): sus números y su serie, en 30 días.
// Se edita en la computadora. Sin permiso (un setter) o sin red, quedan los números de siempre (`respaldo`).
// =============================================================================
import { useEffect, useState, type ReactNode } from 'react';
import { FilaDatoM, ListaM } from '@/app/m/_ui';
import { GraficoBarrasM } from '@/app/m/dashboard/GraficoBarrasM';
import type { HojaM } from '@/app/m/dashboard/modelo';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';

export function MetricasM({ id, respaldo }: { id: number; respaldo: ReactNode }) {
  const [hoja, setHoja] = useState<HojaM | null>(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    let vivo = true;
    setHoja(null); setFallo(false);
    fetch(`/api/automations/metricas?id=${id}&movil=1`)
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!vivo) return;
        if (r.ok && j?.ok && j.hoja) setHoja(j.hoja as HojaM); else setFallo(true);
      })
      .catch(() => { if (vivo) setFallo(true); });
    return () => { vivo = false; };
  }, [id]);

  if (fallo) return <>{respaldo}</>;
  if (!hoja) return <p className="m-auto-nada" role="status">Armando las métricas…</p>;
  return (
    <div data-metricas-m={id}>
      <h3 className="m-auto-subt">Métricas · últimos 30 días</h3>
      {hoja.grafico && !hoja.graficoError && <GraficoBarrasM g={hoja.grafico} />}
      {hoja.numerosError
        ? <p className="m-auto-error" role="alert">{hoja.numerosError}<ReportarASoporte /></p>
        : (
          <ListaM etiqueta="Métricas">
            {hoja.numeros.map((n) => <FilaDatoM key={n.id} k={n.k} v={n.v} />)}
          </ListaM>
        )}
    </div>
  );
}
