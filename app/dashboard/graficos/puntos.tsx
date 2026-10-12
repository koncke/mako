'use client';

// Los puntos de una línea del sistema «gordo» (lib/graficos-gordo.ts): con 12 puntos o menos, todos (r 5, con
// un borde de 3 px del color de la tarjeta); con más, sólo el último (r 6). El color va en `style`: un var() en
// un atributo SVG no está garantizado (docs/hallazgos-graficos.md).

import { PUNTOS, puntosVisibles } from '@/lib/graficos-gordo';

type PropsPunto = { cx?: number; cy?: number; index?: number; value?: unknown };

/** El `dot` de una Line/Area de recharts: todos, o sólo el último con valor. */
export function puntosDe(datos: ReadonlyArray<Record<string, unknown>>, clave: string, color: string, halo: string) {
  let ultimo = -1;
  datos.forEach((d, i) => { if (typeof d[clave] === 'number' && Number.isFinite(d[clave] as number)) ultimo = i; });
  const todos = puntosVisibles(datos.length) === 'todos';
  const Punto = ({ cx, cy, index }: PropsPunto) => {
    const k = `p${index ?? 0}`;
    if (cx == null || cy == null || !Number.isFinite(cx) || !Number.isFinite(cy)) return <g key={k} />;
    if (!todos && index !== ultimo) return <g key={k} />;
    const r = index === ultimo && !todos ? PUNTOS.ultimo : PUNTOS.r;
    return <circle key={k} cx={cx} cy={cy} r={r} strokeWidth={PUNTOS.borde} style={{ fill: color, stroke: halo }} />;
  };
  return Punto;
}

/** El punto activo (al pasar el cursor): r 8. */
export function puntoActivo(color: string, halo: string) {
  const Activo = ({ cx, cy }: PropsPunto) => (cx == null || cy == null ? <g /> : <circle cx={cx} cy={cy} r={PUNTOS.activo} strokeWidth={PUNTOS.borde} style={{ fill: color, stroke: halo }} />);
  return Activo;
}
