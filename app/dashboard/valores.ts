'use client';

// =============================================================================
// useValoresCampo — los valores de un campo, para las casillas de una lista desplegable
// =============================================================================
// Pide `POST /api/graficos { accion: 'valores', campo, desde, hasta, fuentes? }` (la misma puerta que
// los datos: admin + la tab en la capa) y devuelve `{ valor, filas }` de más filas a menos.
//
// Tres cosas que no se ven en la firma:
//   · CACHÉ POR CLAVE (campo + período + fuentes), dos minutos. Abrir y cerrar la misma lista no
//     vuelve a leer, y dos listas iguales abiertas a la vez (la de la barra y la de una tarjeta) hacen
//     UNA lectura: el pedido en vuelo se comparte.
//   · ABORT: si el último que esperaba un pedido se va (se cerró el popover, cambió el período), el
//     pedido se corta. Un pedido sin `signal` con la conexión caída no resuelve nunca y deja un giro
//     eterno (AGENTS.md, «Un tope que vive en la RUTA no protege al cliente»): además del abort, un
//     tope de 65 s, el de la ruta (60) más un margen.
//   · «NO LLEGÓ NADA» NO ES «NO HAY»: un error se devuelve como error, con su reintento. ⚠️ Pero la
//     ruta todavía no distingue: `valoresDeCampo` (lib/graficos-datos.ts) se traga el fallo de cada
//     lector y contesta `[]`, así que una lectura caída llega acá como una lista vacía. Por eso la
//     pantalla dice «No llegó ningún valor» y no «No hay valores» (quedó en pendientes).
//
// El `?ws=` lo pega solo el parche de fetch (app/_components/WsFetch.tsx).

import { useEffect, useState } from 'react';
import type { ValorDeCampo } from '@/lib/graficos-datos';

const TTL_MS = 120_000;
const TOPE_MS = 65_000;

type Vuelo = { promesa: Promise<ValorDeCampo[]>; ctrl: AbortController; usuarios: number };
const cache = new Map<string, { t: number; valores: ValorDeCampo[] }>();
const enVuelo = new Map<string, Vuelo>();

/** La clave de la caché: el orden de las fuentes no cambia la pregunta. */
export function claveValores(campo: string, desde: string, hasta: string, fuentes?: readonly string[]): string {
  return [campo, desde, hasta, fuentes && fuentes.length ? [...new Set(fuentes)].sort().join(',') : '*'].join('|');
}

function leerCache(clave: string): ValorDeCampo[] | null {
  const hit = cache.get(clave);
  if (!hit) return null;
  if (Date.now() - hit.t > TTL_MS) { cache.delete(clave); return null; }
  return hit.valores;
}

/** Lo que vino del server, validado: una fila rara se descarta, no rompe la lista. */
function aValores(j: unknown): ValorDeCampo[] {
  const lista = j && typeof j === 'object' && Array.isArray((j as { valores?: unknown }).valores) ? (j as { valores: unknown[] }).valores : null;
  if (!lista) throw new Error('Respuesta inesperada');
  return lista
    .filter((x): x is ValorDeCampo => !!x && typeof x === 'object' && typeof (x as ValorDeCampo).valor === 'string' && Number.isFinite((x as ValorDeCampo).filas))
    .map((x) => ({ valor: x.valor, filas: x.filas }));
}

function pedir(clave: string, campo: string, desde: string, hasta: string, fuentes?: readonly string[]): Vuelo {
  const ctrl = new AbortController();
  const corte = setTimeout(() => ctrl.abort(), TOPE_MS);
  const vuelo: Vuelo = { ctrl, usuarios: 0, promesa: Promise.resolve([]) };
  vuelo.promesa = (async () => {
    try {
      const res = await fetch('/api/graficos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'valores', campo, desde, hasta, ...(fuentes && fuentes.length ? { fuentes: [...fuentes] } : {}) }),
        signal: ctrl.signal,
      });
      const j: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = j && typeof j === 'object' && typeof (j as { error?: unknown }).error === 'string' ? (j as { error: string }).error : `HTTP ${res.status}`;
        throw new Error(msg);
      }
      const valores = aValores(j);
      cache.set(clave, { t: Date.now(), valores });
      return valores;
    } finally {
      clearTimeout(corte);
      if (enVuelo.get(clave) === vuelo) enVuelo.delete(clave);
    }
  })();
  return vuelo;
}

export type EstadoValores = {
  cargando: boolean;
  /** null = no hubo error. Ojo: una lista vacía NO prueba que no haya valores (ver arriba). */
  error: string | null;
  valores: ValorDeCampo[];
  reintentar: () => void;
};

/**
 * Los valores de `campo` en el período, contados en `fuentes` (sin fuentes: en todos los conjuntos
 * donde el campo significa lo mismo). Con `campo` null no pide nada.
 */
export function useValoresCampo(campo: string | null, desde: string, hasta: string, fuentes?: readonly string[]): EstadoValores {
  const clave = campo ? claveValores(campo, desde, hasta, fuentes) : '';
  const [res, setRes] = useState<{ clave: string; intento: number; valores?: ValorDeCampo[]; error?: string } | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!campo || leerCache(clave)) return;
    let vivo = true;
    let vuelo = enVuelo.get(clave);
    if (!vuelo) { vuelo = pedir(clave, campo, desde, hasta, fuentes); enVuelo.set(clave, vuelo); }
    vuelo.usuarios += 1;
    const propio = vuelo;
    propio.promesa.then(
      (valores) => { if (vivo) setRes({ clave, intento, valores }); },
      (e: unknown) => {
        if (!vivo) return;
        const corto = e instanceof DOMException && e.name === 'AbortError';
        setRes({ clave, intento, error: corto ? 'Tardó demasiado' : e instanceof Error ? e.message : 'No se pudo leer' });
      },
    );
    return () => {
      vivo = false;
      propio.usuarios -= 1;
      // El último que esperaba se fue: el pedido se corta (no hay a quién contestarle).
      if (propio.usuarios <= 0 && enVuelo.get(clave) === propio) { propio.ctrl.abort(); enVuelo.delete(clave); }
    };
    // `fuentes` entra por `clave` (un array nuevo por render no es un cambio de pregunta).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, intento]);

  const reintentar = () => { cache.delete(clave); setIntento((i) => i + 1); };
  if (!campo) return { cargando: false, error: null, valores: [], reintentar };
  const fresco = leerCache(clave);
  if (fresco) return { cargando: false, error: null, valores: fresco, reintentar };
  if (res && res.clave === clave && res.intento === intento) {
    return { cargando: false, error: res.error ?? null, valores: res.valores ?? [], reintentar };
  }
  return { cargando: true, error: null, valores: [], reintentar };
}
