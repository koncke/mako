'use client';

// =============================================================================
// comun — lo que comparten los bloques de General: la cabecera, el placeholder y el estilo
// =============================================================================
// Martín, 14/10/2026: «Diseña nuevamente todos los "Bloque general", la mayoría son solamente texto... Si no hay datos
// aún, se debería ver el placeholder siempre». El placeholder es EL MISMO BLOQUE dibujado con datos de ejemplo
// (./muestras.ts), apagado, con una frase y la acción que lo llena encima: quien lo ve entiende qué va a aparecer ahí y
// cómo conseguirlo. Un texto suelto («Todavía no hay objetivos») no dice ninguna de las dos cosas.
//
// ⚠️ «No pude leer» NO es un placeholder: es un fallo nuestro y se dice (`Fallo`). El placeholder es «todavía no hay».
// ⚠️ LO QUE DEPENDE DE LA HORA SE DIBUJA DESPUÉS DE MONTAR (`useAhora`, y la muestra de un placeholder): el bloque se
//    dibuja también en el server, y una hora o una fecha de ejemplo que cambie entre los dos rompe la hidratación.
// ⚠️ Las clases llevan el prefijo `gb-` y la hoja se monta UNA vez (`CSS_BLOQUES`, la pone ./ProveedorGeneral.tsx).
// =============================================================================

import { useEffect, useState, type ReactNode } from 'react';
import Link from '@/app/_ui/Link';

export const CSS_BLOQUES = `
.gb{display:flex;flex-direction:column;min-width:0;min-height:0;flex:1}
.gb-cab{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:16px;min-width:0}
.gb-cab h2{margin:0;font-size:22px;font-weight:600;letter-spacing:-.015em;color:var(--ink);line-height:1.2}
.gb-cab-extra{font-size:13px;color:var(--dim)}
.gb-cab-link{margin-left:auto;font-size:13px;font-weight:600;color:var(--primary);text-decoration:none;white-space:nowrap}
.gb-cab-link:hover{text-decoration:underline}
.gb-fallo{font-size:14px;color:var(--dim)}
.gb-ph{position:relative;flex:1;min-height:120px;display:flex;flex-direction:column}
.gb-ph-fondo{flex:1;opacity:.32;filter:grayscale(.35);pointer-events:none;user-select:none;overflow:hidden;
  -webkit-mask-image:linear-gradient(180deg,#000 55%,transparent);mask-image:linear-gradient(180deg,#000 55%,transparent)}
.gb-ph-encima{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:12px}
.gb-ph-caja{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;max-width:320px;padding:16px 20px;
  background:var(--surface);border:1px solid var(--border);border-radius:14px;box-shadow:0 8px 24px rgba(18,21,27,.10)}
.gb-ph-txt{font-size:14.5px;font-weight:600;color:var(--ink);line-height:1.35}
.gb-boton{display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 14px;border-radius:10px;border:1px solid var(--primary);
  background:var(--primary);color:var(--on-primary,#fff);font:inherit;font-size:13.5px;font-weight:600;cursor:pointer;text-decoration:none;white-space:nowrap}
.gb-boton:hover{filter:brightness(1.06)}
.gb-boton--sec{background:var(--surface);color:var(--ink);border-color:var(--border-strong)}
.gb-chip{display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 8px;border-radius:999px;font-size:11.5px;font-weight:600;
  white-space:nowrap;background:var(--surface-2);color:var(--dim);border:1px solid var(--border)}
.gb-num{font-variant-numeric:tabular-nums}
`;

/** El título de un bloque, con lo que dice al lado y su link. El primer h2 del bloque: si la tarjeta lleva título propio, se esconde. */
export function Cabeza({ titulo, extra, href, link }: { titulo: string; extra?: ReactNode; href?: string; link?: string }) {
  return (
    <div className="gb-cab">
      <h2>{titulo}</h2>
      {extra != null && extra !== '' && <span className="gb-cab-extra">{extra}</span>}
      {href && link && <Link href={href} className="gb-cab-link">{link} →</Link>}
    </div>
  );
}

/** Una lectura caída: lo dice (es nuestro, no «todavía no hay»). */
export function Fallo({ titulo, error }: { titulo: string; error: string }) {
  return (
    <div className="gb">
      <Cabeza titulo={titulo} />
      <span className="gb-fallo">{error}</span>
    </div>
  );
}

/**
 * El bloque vacío: el mismo bloque con datos de ejemplo, apagado, y encima la frase y la acción. `accion` es un link
 * (`href`) o un botón (un nodo ya armado, como el disparador de un modal).
 */
/** El instante de ahora, SÓLO en el navegador (null en el server y en el primer dibujo: los dos iguales). */
export function useAhora(): string | null {
  const [ahora, setAhora] = useState<string | null>(null);
  useEffect(() => {
    setAhora(new Date().toISOString());
    const t = setInterval(() => setAhora(new Date().toISOString()), 60_000);
    return () => clearInterval(t);
  }, []);
  return ahora;
}

export function Placeholder({ muestra, texto, accion }: {
  muestra: ReactNode;
  texto: string;
  accion?: { href: string; rotulo: string } | ReactNode;
}) {
  // La muestra se dibuja recién montado: sus fechas salen de hoy y de la zona del navegador.
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  const esLink = !!accion && typeof accion === 'object' && 'href' in (accion as object) && 'rotulo' in (accion as object);
  return (
    <div className="gb-ph" data-placeholder="">
      <div className="gb-ph-fondo" aria-hidden>{montado ? muestra : null}</div>
      <div className="gb-ph-encima">
        <div className="gb-ph-caja">
          <span className="gb-ph-txt">{texto}</span>
          {esLink
            ? <Link href={(accion as { href: string }).href} className="gb-boton">{(accion as { rotulo: string }).rotulo}</Link>
            : (accion as ReactNode) ?? null}
        </div>
      </div>
    </div>
  );
}

/** «Hoy», «Mañana» o «jue 16». */
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export function diaCorto(fecha: string, hoy: string, manana: string): string {
  if (fecha === hoy) return 'Hoy';
  if (fecha === manana) return 'Mañana';
  const [y, m, d] = fecha.split('-').map(Number);
  return `${DIAS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d}`;
}
export function diaDeSemana(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number);
  return DIAS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** Las iniciales de un nombre (el avatar de una fila). */
export const iniciales = (n: string): string => n.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '·';
