'use client';
// =============================================================================
// usePruebaAB — el estado de la prueba de la tarjeta «A/B TEST», para el lienzo y su editor (tanda A3, 25/10/2026)
// =============================================================================
// Lo lee de GET /api/chat-agent/pruebas (lib/pruebas/automatizacion.ts `estadoDeLaTarjeta`) sólo si el flujo tiene la
// tarjeta, y lo vuelve a leer al empezar o detener la prueba. Sin respuesta (cargando, sin tablas), null: la tarjeta dice
// «Sin prueba: todos van a A.».
// =============================================================================

import { useCallback, useEffect, useState } from 'react';

export type EstadoPruebaAB = {
  estado: string;
  texto: string;
  filas: Record<string, string>;
  pruebaId: number | null;
  sinTablas?: boolean;
};

export function usePruebaAB(secuenciaId: number | null | undefined, hayTarjeta: boolean) {
  const [prueba, setPrueba] = useState<EstadoPruebaAB | null>(null);
  const recargar = useCallback(async () => {
    if (!secuenciaId || !hayTarjeta) { setPrueba(null); return; }
    try {
      const r = await fetch(`/api/chat-agent/pruebas?secuenciaId=${secuenciaId}`, { cache: 'no-store' });
      const j = (await r.json()) as { ok?: boolean } & Partial<EstadoPruebaAB>;
      if (j.ok && typeof j.texto === 'string') setPrueba({ estado: String(j.estado ?? 'sin_prueba'), texto: j.texto, filas: j.filas ?? {}, pruebaId: j.pruebaId ?? null, sinTablas: j.sinTablas });
    } catch { /* sin red: la tarjeta sigue diciendo lo de antes */ }
  }, [secuenciaId, hayTarjeta]);
  useEffect(() => { void recargar(); }, [recargar]);

  /** Empezar o detener la prueba; vuelve el texto del plan (al empezar) o el error en palabras. */
  const accion = useCallback(async (action: 'empezar' | 'detener', nodoId?: string): Promise<{ ok: boolean; plan?: string; error?: string }> => {
    if (!secuenciaId) return { ok: false, error: 'Guarda la automatización primero.' };
    try {
      const r = await fetch('/api/chat-agent/pruebas', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, secuenciaId, nodoId }),
      });
      const j = (await r.json()) as { ok?: boolean; plan?: string; error?: string } & Partial<EstadoPruebaAB>;
      if (j.ok && typeof j.texto === 'string') setPrueba({ estado: String(j.estado ?? 'sin_prueba'), texto: j.texto, filas: j.filas ?? {}, pruebaId: j.pruebaId ?? null });
      return { ok: !!j.ok, plan: j.plan, error: j.error };
    } catch {
      return { ok: false, error: 'No hay conexión: vuelve a tocar en un rato.' };
    }
  }, [secuenciaId]);

  return { prueba, recargar, accion };
}
