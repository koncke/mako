'use client';

// =============================================================================
// useValoresCampo — los valores de un campo, para las casillas de una lista desplegable
// =============================================================================
// Pide `{ accion: 'valores', campo, desde, hasta, fuentes? }` y devuelve `{ valor, filas }` de más filas a
// menos. A DÓNDE lo pide lo decide el contrato de lectura (./lectura-compartida.ts, `pedidoDeLectura`):
//   · con sesión (el admin, el closer), a /api/graficos, con el cuerpo de siempre;
//   · en un informe COMPARTIDO (el link sin sesión), a /api/compartido/graficos con el token, la hoja y el
//     control (y el componente, si el control es de una tarjeta): el server del link reconstruye la lista
//     desde el control GUARDADO y no cree el campo que viaja.
// Hasta v5 el segundo camino era una copia de este hook adentro de ./BarraControles.tsx
// (`useValoresCompartidos`), porque éste no aceptaba otra ruta: dos copias del mismo pedido, con el tope y el
// abort escritos dos veces. Ahora es UNO (hallazgos-graficos, «Lo que quedó sin hacer»).
//
// Tres cosas que no se ven en la firma:
//   · CACHÉ POR CLAVE (campo + período + fuentes, y en un link también token + hoja + control + componente),
//     dos minutos. Abrir y cerrar la misma lista no vuelve a leer, y dos listas iguales abiertas a la vez
//     hacen UNA lectura: el pedido en vuelo se comparte. En un link la clave lleva el control porque el
//     server responde POR CONTROL (dos controles sobre el mismo campo pueden tener permisos distintos).
//   · ABORT: si el último que esperaba un pedido se va (se cerró el desplegable, cambió el período), el
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
import { pedidoDeLectura, type Compartido } from './lectura-compartida';

const TTL_MS = 120_000;
const TOPE_MS = 65_000;

/**
 * De dónde lee una lista en un informe COMPARTIDO: el link, la hoja y el control (y la tarjeta, si el control
 * es de un gráfico). Sin esto (null), la lectura con sesión de siempre.
 */
export type LecturaLink = { compartido: Compartido; hojaId: string; controlId: string; componenteId?: string };

type Vuelo = { promesa: Promise<ValorDeCampo[]>; ctrl: AbortController; usuarios: number };
const cache = new Map<string, { t: number; valores: ValorDeCampo[] }>();
const enVuelo = new Map<string, Vuelo>();

/** La clave de la caché: el orden de las fuentes no cambia la pregunta; el link y el control, sí. */
export function claveValores(campo: string, desde: string, hasta: string, fuentes?: readonly string[], link?: LecturaLink | null): string {
  const base = [campo, desde, hasta, fuentes && fuentes.length ? [...new Set(fuentes)].sort().join(',') : '*'];
  if (link) base.push(`link:${link.compartido.token}`, link.hojaId, link.controlId, link.componenteId ?? '');
  return base.join('|');
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

function pedir(clave: string, campo: string, desde: string, hasta: string, fuentes: readonly string[] | undefined, link: LecturaLink | null): Vuelo {
  const ctrl = new AbortController();
  const corte = setTimeout(() => ctrl.abort(), TOPE_MS);
  const vuelo: Vuelo = { ctrl, usuarios: 0, promesa: Promise.resolve([]) };
  // Sin link, `pedidoDeLectura` devuelve el cuerpo de SIEMPRE (la hoja y el control no viajan): el closer pasa
  // por `closerPuedePedir`, que mira el cuerpo entero.
  const { ruta, cuerpo } = pedidoDeLectura(
    { accion: 'valores', hojaId: link?.hojaId ?? '', controlId: link?.controlId ?? '', componenteId: link?.componenteId, campo, desde, hasta, fuentes },
    link?.compartido ?? null,
  );
  vuelo.promesa = (async () => {
    try {
      const res = await fetch(ruta, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
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
 * Los valores de `campo` en el período, contados en `fuentes` (sin fuentes: en todos los conjuntos donde el
 * campo significa lo mismo). Con `campo` null no pide nada. `link`: en un informe compartido, de dónde (ver
 * `LecturaLink`); null o ausente, la lectura con sesión.
 */
export function useValoresCampo(campo: string | null, desde: string, hasta: string, fuentes?: readonly string[], link?: LecturaLink | null): EstadoValores {
  const clave = campo ? claveValores(campo, desde, hasta, fuentes, link) : '';
  const [res, setRes] = useState<{ clave: string; intento: number; valores?: ValorDeCampo[]; error?: string } | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!campo || leerCache(clave)) return;
    let vivo = true;
    let vuelo = enVuelo.get(clave);
    if (!vuelo) { vuelo = pedir(clave, campo, desde, hasta, fuentes, link ?? null); enVuelo.set(clave, vuelo); }
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
    // `fuentes` y `link` entran por `clave` (un objeto nuevo por render no es un cambio de pregunta).
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
