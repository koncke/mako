'use client';

// =============================================================================
// usePrueba — la prueba gratis del negocio, UNA lectura por página (25/10/2026)
// =============================================================================
// El cartel de la barra lateral y la franja de la pantalla piden lo mismo (/api/plan/prueba): la primera lectura queda en
// memoria y la segunda la reusa, así no van dos pedidos por carga. Fuera de la prueba (o sin poder leer), `null`.
// =============================================================================

import { useEffect, useState } from 'react';
import type { ResumenPrueba } from '@/lib/prueba-uso';

export type PruebaViva = Extract<ResumenPrueba, { enPrueba: true }>;

let enCurso: Promise<PruebaViva | null> | null = null;

function leer(): Promise<PruebaViva | null> {
  if (!enCurso) {
    enCurso = fetch('/api/plan/prueba', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j: ResumenPrueba) => (j && j.enPrueba ? j : null))
      .catch(() => null);
    // La memoria dura lo que una carga: al volver a la pestaña se relee (los usos cambian al crear algo).
    setTimeout(() => { enCurso = null; }, 30_000);
  }
  return enCurso;
}

export function usePrueba(): PruebaViva | null {
  const [prueba, setPrueba] = useState<PruebaViva | null>(null);
  useEffect(() => {
    let vivo = true;
    void leer().then((p) => { if (vivo) setPrueba(p); });
    return () => { vivo = false; };
  }, []);
  return prueba;
}
