'use client';
// =============================================================================
// MetricasAutomatizacion — la pestaña «Métricas» de una automatización: lo que reemplaza al lienzo
// =============================================================================
// Martín, 23/10/2026: «un botón al lado del botón de configuraciones. Cuando se apreta, todo el lienzo se reemplaza por
// el dashboard de esas métricas... Por defecto MaKo lo debe armar solo... se debe poder personalizar al igual que en
// Dashboard y un botón para llevar esas métricas como nueva hoja a la tab de dashboard». Lo de adentro es el EDITOR DEL
// DASHBOARD (`EditorInforme`) con el informe `automatizacion:<id>` (lib/automatizacion-metricas.ts): se edita igual que una
// hoja del Dashboard, y se autoguarda en su propio informe.
//
//   · El editor entra con `next/dynamic` y SIN server: es pesado y se monta recién al tocar «Métricas» (AGENTS.md: lo que
//     se ve al abrir la app no va con `ssr:false`; esto no se ve al abrir).
//   · «Llevar al Dashboard» (POST /api/automations/metricas) crea una hoja NUEVA en el Dashboard de quien mira, filtrada a
//     esta automatización, y deja el link para abrirla. Lleva la primera hoja de las Métricas (la de MaKo, o la que la
//     persona dejó primera).
// =============================================================================
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { Button } from '@/app/_ui';
import type { Tablero } from '@/lib/graficos-catalogo';
import type { DatosGrafico } from '@/lib/graficos-datos';
import { informeDeAutomatizacion } from '@/lib/informe-automatizacion';

const EditorInforme = dynamic(() => import('@/app/dashboard/EditorInforme').then((m) => m.EditorInforme), {
  ssr: false,
  loading: () => <Cargando />,
});

type Lectura = {
  tablero: Tablero; version: string | null; deMaKo: boolean; lecturaFallo: boolean;
  datos: Record<string, DatosGrafico>; hoy: string; automatizacion: { id: number; nombre: string };
};

function Cargando() {
  return <div role="status" style={{ padding: 32, color: 'var(--dim)', fontSize: 13.5, fontFamily: "'Geist', sans-serif" }}>Armando las métricas…</div>;
}

export function MetricasAutomatizacion({ secuenciaId }: { secuenciaId: number }) {
  const [l, setL] = useState<Lectura | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [llevando, setLlevando] = useState(false);
  const [llevada, setLlevada] = useState<{ hojaId: string; nombre: string } | null>(null);
  const [errLlevar, setErrLlevar] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setL(null); setError(null); setLlevada(null); setErrLlevar(null);
    fetch(`/api/automations/metricas?id=${secuenciaId}`)
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!vivo) return;
        if (!r.ok || !j?.ok) { setError(j?.error ?? 'No pude leer las métricas.'); return; }
        setL(j as Lectura);
      })
      .catch(() => { if (vivo) setError('Sin conexión — prueba de nuevo.'); });
    return () => { vivo = false; };
  }, [secuenciaId]);

  const llevar = async () => {
    if (!l || llevando) return;
    setLlevando(true); setErrLlevar(null);
    try {
      const r = await fetch('/api/automations/metricas', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ accion: 'llevar', id: secuenciaId, hojaId: l.tablero.hojas[0]?.id ?? null }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) setErrLlevar(j?.error ?? 'No pude llevarla al Dashboard.');
      else setLlevada({ hojaId: j.hojaId, nombre: j.nombre });
    } catch { setErrLlevar('Sin conexión — prueba de nuevo.'); } finally { setLlevando(false); }
  };

  if (error) return <div role="alert" style={{ padding: 32, color: 'var(--bad)', fontSize: 13.5 }}>{error}</div>;
  if (!l) return <Cargando />;
  const hoja = l.tablero.hojas[0];
  if (!hoja) return <div style={{ padding: 32, color: 'var(--dim)', fontSize: 13.5 }}>Esta automatización todavía no tiene métricas.</div>;

  return (
    <div data-metricas-automatizacion={secuenciaId} style={{ position: 'absolute', inset: 0, overflowY: 'auto', overflowX: 'hidden', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8, padding: '10px 16px 0' }}>
        {errLlevar && <span role="alert" style={{ fontSize: 12.5, color: 'var(--bad)' }}>{errLlevar}</span>}
        {llevada
          ? <a href={`/dashboard?hoja=${encodeURIComponent(llevada.hojaId)}`} data-metricas-llevada style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>Abrir «{llevada.nombre}» en el Dashboard →</a>
          : <Button variant="secondary" size="sm" disabled={llevando} onClick={() => void llevar()} data-metricas-llevar>{llevando ? 'Llevando…' : 'Llevar al Dashboard'}</Button>}
      </div>
      <EditorInforme
        key={`automatizacion-${secuenciaId}`}
        inicial={l.tablero}
        datosIniciales={l.datos}
        lecturaFallo={l.lecturaFallo}
        hoy={l.hoy}
        hojaInicial={hoja.id}
        versionInicial={l.version}
        informe={informeDeAutomatizacion(secuenciaId)}
        unido={null}
      />
    </div>
  );
}
