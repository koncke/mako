'use client';

// =============================================================================
// MesDelPeriodo — «El mes» de General con el período que eligió la hoja, pedido desde el navegador
// =============================================================================
// El período de la hoja cambia sin volver al servidor: elegir otro en su control de arriba (mirando o editando) o pasar a
// otra hoja. Los datos de los bloques (./datos.ts) se leen UNA vez con la página, con el período de la hoja con que se abrió
// (`mesDelPeriodo`); para los demás, el bloque lo pide a la acción `mes-general` de /api/graficos y lo guarda acá por
// período, así volver a uno ya visto no vuelve a leer. ./periodo-de-la-hoja.ts explica qué bloque sigue el período.
//
// ⚠️ UN `router.refresh()` TIRA LO GUARDADO (marcar una cuota cobrada, completar una tarea): lo cobrado del período pudo
//    cambiar. La página trae `mesDelPeriodo` nuevo y cada bloque vuelve a pedir el suyo. Una respuesta pedida ANTES del
//    refresco que llega después no se guarda: sería un número viejo con cara de nuevo.
// ⚠️ El `fetch` va con `signal` (la ruta corta a los 60 s): sin él, una conexión caída deja el bloque cargando para siempre.
// =============================================================================

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Skeleton, Spinner } from '@/app/_ui/Feedback';
import type { OpcionesElegidas } from '@/lib/general-piezas';
import { claveDePeriodo, tituloDelPeriodo, type PeriodoDeBloques } from './periodo-de-la-hoja';
import type { MesDeGeneral, MesDelPeriodo } from './mes-del-periodo';
import type { Leido } from './datos-tipos';
import { BloqueMes } from './bloques/Negocio';
import { Cabeza } from './bloques/comun';

type Contexto = {
  /** Lo leído para ese período (null = todavía no). */
  leido: (clave: string) => Leido<MesDeGeneral> | null;
  /** Lo pide, si no está ya en camino. */
  pedir: (p: { desde: string; hasta: string }) => void;
};

const Ctx = createContext<Contexto | null>(null);

const NO_PUDE: Leido<MesDeGeneral> = { ok: false, error: 'No pude leer el resumen del período.' };

const semilla = (inicial: MesDelPeriodo | null | undefined): Record<string, Leido<MesDeGeneral>> =>
  (inicial ? { [claveDePeriodo(inicial)]: { ok: true, d: inicial.mes } } : {});

/** Lo que contestó la ruta tiene la forma de un `Leido`. Cualquier otra cosa es «no pude». */
function comoLeido(x: unknown): Leido<MesDeGeneral> {
  if (!x || typeof x !== 'object') return NO_PUDE;
  const o = x as { ok?: unknown; d?: unknown; error?: unknown };
  if (o.ok === true && o.d && typeof o.d === 'object' && 'desgloses' in o.d) return { ok: true, d: o.d as MesDeGeneral };
  if (o.ok === false && typeof o.error === 'string' && o.error) return { ok: false, error: o.error };
  return NO_PUDE;
}

/** Lo monta app/general/ProveedorGeneral.tsx con lo que trajo la página. */
export function ProveedorMesDelPeriodo({ inicial, children }: { inicial: MesDelPeriodo | null | undefined; children: ReactNode }) {
  const [estado, setEstado] = useState(() => ({ base: inicial, leidos: semilla(inicial) }));
  // Datos nuevos de la página (un refresco): lo guardado se tira. Se ajusta en el render, como un estado derivado de props.
  let actual = estado;
  if (estado.base !== inicial) {
    actual = { base: inicial, leidos: semilla(inicial) };
    setEstado(actual);
  }
  const base = useRef(inicial);
  const enCamino = useRef(new Set<string>());
  // Antes que los efectos de los bloques (que piden): un pedido nuevo sale ya con la base de ahora.
  useLayoutEffect(() => {
    base.current = inicial;
    enCamino.current = new Set();
  }, [inicial]);

  const pedir = useCallback((p: { desde: string; hasta: string }) => {
    const clave = claveDePeriodo(p);
    if (enCamino.current.has(clave)) return;
    enCamino.current.add(clave);
    const desdeLaBase = base.current;
    fetch('/api/graficos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ accion: 'mes-general', desde: p.desde, hasta: p.hasta }),
      signal: AbortSignal.timeout(65_000),
    })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((j: { mes?: unknown } | null) => {
        enCamino.current.delete(clave);
        if (base.current !== desdeLaBase) return; // llegó después de un refresco: lo vuelve a pedir el bloque
        const mes = comoLeido(j?.mes);
        setEstado((s) => (s.base !== desdeLaBase ? s : { ...s, leidos: { ...s.leidos, [clave]: mes } }));
      });
  }, []);

  const leidos = actual.leidos;
  const leido = useCallback((clave: string) => leidos[clave] ?? null, [leidos]);
  return <Ctx.Provider value={{ leido, pedir }}>{children}</Ctx.Provider>;
}

/** «El mes» del período de la hoja: lo leído, o la cabecera girando mientras llega. */
export function BloqueMesDelPeriodo({ periodo, op }: { periodo: PeriodoDeBloques; op?: OpcionesElegidas }) {
  const ctx = useContext(Ctx);
  const clave = claveDePeriodo(periodo);
  const leido = ctx?.leido(clave) ?? null;
  const falta = !leido;
  const { desde, hasta } = periodo;
  const pedir = ctx?.pedir;
  useEffect(() => {
    if (falta) pedir?.({ desde, hasta });
  }, [falta, desde, hasta, pedir]);
  const titulo = tituloDelPeriodo(periodo);
  if (!ctx) return <BloqueMes d={NO_PUDE} op={op} titulo={titulo} />;
  if (!leido) {
    return (
      <div className="gb" aria-busy>
        <Cabeza titulo={titulo} extra={<Spinner size={14} />} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 'clamp(10px, 1.6cqi, 16px)' }}>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} h={96} radius={16} />)}
        </div>
      </div>
    );
  }
  return <BloqueMes d={leido} op={op} titulo={titulo} />;
}
