'use client';

// =============================================================================
// FechaFiltroGlobal — filtro de fecha global (Fase C)
// =============================================================================
// Un solo botón arriba a la derecha del header que despliega un popover con
// presets + rango personalizado, al estilo del filtro de Meta Ads. El rango
// vive en la URL (?desde=YYYY-MM-DD&hasta=YYYY-MM-DD) y, gracias a que
// DashboardTabs propaga esos params, se MANTIENE al navegar entre tabs.
//
// Reemplaza al viejo FechaSelector (la franja-sección dentro de la página).
// =============================================================================

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { diasAntes, lunesDeFecha, primerDiaDelMesDeFecha, fmtDDMMYYYY } from '@/lib/date-utils';

type Preset = { key: string; label: string; desde: string; hasta: string };

// Fecha mínima para "Máximo": cubre todo el histórico (la operación arrancó
// en dic-2025; 2025-01-01 deja margen de sobra sin recortar datos reales).
const FECHA_MINIMA = '2025-11-01';

// Construye los 12 presets relativos a `hoy` (pasado por el server en zona
// Tijuana, para no depender del reloj del navegador).
export function presetsDeFecha(hoy: string): Preset[] {
  const lunesEstaSemana = lunesDeFecha(hoy);
  const lunesSemanaPasada = diasAntes(lunesEstaSemana, 7);
  const finSemanaPasada = diasAntes(lunesEstaSemana, 1);
  const primerDiaMes = primerDiaDelMesDeFecha(hoy);
  const finMesPasado = diasAntes(primerDiaMes, 1);
  const primerDiaMesPasado = primerDiaDelMesDeFecha(finMesPasado);
  const ayer = diasAntes(hoy, 1);
  return [
    { key: 'hoy', label: 'Hoy', desde: hoy, hasta: hoy },
    { key: 'ayer', label: 'Ayer', desde: ayer, hasta: ayer },
    { key: '7d', label: 'Últimos 7 días', desde: diasAntes(hoy, 6), hasta: hoy },
    { key: '14d', label: 'Últimos 14 días', desde: diasAntes(hoy, 13), hasta: hoy },
    { key: '28d', label: 'Últimos 28 días', desde: diasAntes(hoy, 27), hasta: hoy },
    { key: '30d', label: 'Últimos 30 días', desde: diasAntes(hoy, 29), hasta: hoy },
    { key: 'estaSemana', label: 'Esta semana', desde: lunesEstaSemana, hasta: hoy },
    { key: 'semanaPasada', label: 'Semana pasada', desde: lunesSemanaPasada, hasta: finSemanaPasada },
    { key: 'esteMes', label: 'Este mes', desde: primerDiaMes, hasta: hoy },
    { key: 'mesPasado', label: 'Mes pasado', desde: primerDiaMesPasado, hasta: finMesPasado },
    { key: 'maximo', label: 'Máximo', desde: FECHA_MINIMA, hasta: hoy },
  ];
}

function fmtCorta(iso: string): string {
  // Convención del proyecto: fechas en pantalla → dd/mm/aaaa.
  return fmtDDMMYYYY(iso);
}

export function FechaFiltroGlobal({ hoyReal }: { hoyReal: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const desdeUrl = searchParams.get('desde') ?? '';
  const hastaUrl = searchParams.get('hasta') ?? '';
  const activo = !!(desdeUrl && hastaUrl);

  const presets = presetsDeFecha(hoyReal);
  const presetActivo = activo
    ? presets.find((p) => p.desde === desdeUrl && p.hasta === hastaUrl)
    : undefined;

  // Rango personalizado (estado local del popover)
  const [customDesde, setCustomDesde] = useState(desdeUrl);
  const [customHasta, setCustomHasta] = useState(hastaUrl);

  // Navega preservando los demás params de la URL (ej: ?pendientes).
  const navegar = (d: string, h: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (d && h) {
      params.set('desde', d);
      params.set('hasta', h);
    } else {
      params.delete('desde');
      params.delete('hasta');
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
    setOpen(false);
  };

  const etiquetaBoton = !activo
    ? 'Todo el periodo'
    : presetActivo
      ? presetActivo.label
      : `${fmtCorta(desdeUrl)} – ${fmtCorta(hastaUrl)}`;

  const customValido = !!(customDesde && customHasta && customDesde <= customHasta);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-4 py-3 rounded-lg border text-base font-medium whitespace-nowrap"
        style={{
          background: activo ? '#1a1a1a' : 'transparent',
          borderColor: activo ? 'var(--accent-yellow)' : 'var(--card-border)',
          color: activo ? 'var(--accent-yellow)' : 'var(--text-dim)',
        }}
        aria-expanded={open}
      >
        <span aria-hidden>📅</span>
        <span>{etiquetaBoton}</span>
        <span aria-hidden style={{ fontSize: 10 }}>
          ▾
        </span>
      </button>

      {open && (
        <>
          {/* Backdrop: clic afuera cierra el popover */}
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            className="absolute right-0 mt-2 z-40 w-80 max-w-[88vw] rounded-xl border p-3 shadow-xl"
            style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
          >
            {/* Presets */}
            <div className="grid grid-cols-2 gap-1.5">
              {presets.map((p) => {
                const sel = presetActivo?.key === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => navegar(p.desde, p.hasta)}
                    className="px-3 py-2 rounded-lg border text-sm text-left"
                    style={{
                      borderColor: sel ? 'var(--accent-yellow)' : 'var(--card-border)',
                      color: sel ? 'var(--accent-yellow)' : 'var(--text)',
                      background: sel ? '#1a1a1a' : 'transparent',
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            {/* Rango personalizado */}
            <div
              className="mt-3 pt-3 border-t"
              style={{ borderColor: 'var(--card-border)' }}
            >
              <div
                className="text-xs uppercase tracking-wider mb-2"
                style={{ color: 'var(--text-dim)' }}
              >
                Personalizado
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customDesde}
                  max={customHasta || hoyReal}
                  onChange={(e) => setCustomDesde(e.target.value)}
                  className="flex-1 min-w-0 px-2 py-2 rounded border text-sm"
                  style={{
                    background: '#0a0a0a',
                    borderColor: 'var(--card-border)',
                    color: 'var(--text)',
                    colorScheme: 'dark',
                  }}
                />
                <span style={{ color: 'var(--text-dim)' }}>→</span>
                <input
                  type="date"
                  value={customHasta}
                  min={customDesde || undefined}
                  max={hoyReal}
                  onChange={(e) => setCustomHasta(e.target.value)}
                  className="flex-1 min-w-0 px-2 py-2 rounded border text-sm"
                  style={{
                    background: '#0a0a0a',
                    borderColor: 'var(--card-border)',
                    color: 'var(--text)',
                    colorScheme: 'dark',
                  }}
                />
              </div>
              <button
                type="button"
                disabled={!customValido}
                onClick={() => navegar(customDesde, customHasta)}
                className="mt-2 w-full px-3 py-2 rounded-lg text-sm font-medium"
                style={{
                  background: 'var(--accent-yellow)',
                  color: '#000',
                  opacity: customValido ? 1 : 0.4,
                  cursor: customValido ? 'pointer' : 'not-allowed',
                }}
              >
                Aplicar rango
              </button>
            </div>

            {activo && (
              <button
                type="button"
                onClick={() => navegar('', '')}
                className="mt-2 w-full px-3 py-2 rounded-lg border text-sm"
                style={{
                  borderColor: 'var(--accent-orange)',
                  color: 'var(--accent-orange)',
                }}
              >
                ✕ Quitar filtro
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
