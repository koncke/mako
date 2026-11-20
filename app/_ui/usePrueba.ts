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

// Por negocio de la pestaña (`?ws=`, 20/11/2026): la API contesta el negocio que se MIRA (el de un cliente, mirando como
// administrador), y pasar de un cliente a otro dentro de los 30 s mostraba la prueba del anterior.
const enCurso = new Map<string, Promise<PruebaViva | null>>();

function leer(): Promise<PruebaViva | null> {
  const clave = new URLSearchParams(window.location.search).get('ws') ?? '';
  let p = enCurso.get(clave);
  if (!p) {
    p = fetch('/api/plan/prueba', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j: ResumenPrueba) => (j && j.enPrueba ? j : null))
      .catch(() => null);
    enCurso.set(clave, p);
    // La memoria dura lo que una carga: al volver a la pestaña se relee (los usos cambian al crear algo).
    setTimeout(() => { enCurso.delete(clave); }, 30_000);
  }
  return p;
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
