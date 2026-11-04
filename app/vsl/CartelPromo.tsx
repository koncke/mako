'use client';

// =============================================================================
// CartelPromo — «Te ganaste un 50% de descuento», con su reloj, arriba de la landing de venta
// =============================================================================
// docs/estrategia-lanzamiento-low-to-high.md §3. Las reglas y por qué el reloj no miente: lib/promo-entrada-reglas.ts.
//   · El tiempo lo da el servidor y acá se cuenta con `performance.now()`: cambiar la hora del teléfono no le regala minutos a nadie.
//   · En cero se va. Al volver a entrar, el servidor contesta que ya no hay promo y no se dibuja.
//   · Mientras la consulta no contesta o falla, no hay cartel: la landing se vende igual a precio normal.
//   · Va en el flujo y `sticky` arriba, una sola franja en el teléfono: no flota sobre el botón de comprar. «Ver planes» lleva a
//     `#precios` con `scroll-margin`, para que la franja no le tape el título a los precios.
//   · Los valores (31/10/2026, docs/diseno/tokens-4-y-cierre.json): el naranja es el `--now` de Fitlo, el color que esa tienda reserva
//     para «esto es ahora». Sobre la tinta llega a 5:1. El reloj es lo ÚNICO del cartel que lo usa: por eso se ve sin buscarlo.
// =============================================================================

import { useEffect, useState } from 'react';
import { PROMO_ENTRADA, precioPrimerMes, textoReloj, textoUsd, type EstadoPromo } from '@/lib/promo-entrada-reglas';

const CSS = `
.mk-promo { position: sticky; top: 0; z-index: 60; display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 4px 14px;
  box-sizing: border-box; padding: 8px 16px; background: #121826; color: #fff; font-size: 15px; line-height: 1.3; }
.mk-promo-titulo { font-weight: 600; }
.mk-promo-precios { color: #c6ccd7; font-size: 14px; }
.mk-promo-reloj { font-variant-numeric: tabular-nums; font-weight: 700; color: #e2603a; }
.mk-promo-ir { flex: none; padding: 5px 14px; border-radius: 999px; background: #1f55d6; color: #fff; font-size: 13.5px; font-weight: 600; text-decoration: none; }
.mk-promo-ir:hover { background: #1946b8; }
.mk-promo-ir:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
#precios { scroll-margin-top: 72px; }
@media (max-width: 640px) {
  .mk-promo { flex-wrap: nowrap; justify-content: space-between; gap: 8px; padding: 6px 12px; font-size: 13px; }
  .mk-promo-precios { display: none; }
  .mk-promo-texto { min-width: 0; }
  .mk-promo-ir { padding: 5px 10px; font-size: 13px; white-space: nowrap; }
}
`;

export function CartelPromo({ planes }: { planes: ReadonlyArray<{ id: string; nombre: string; precioUsd: number }> }) {
  const [fin, setFin] = useState<number | null>(null);
  const [ahora, setAhora] = useState(0);

  useEffect(() => {
    let vivo = true;
    fetch('/api/promo-entrada', { method: 'POST' })
      .then((r) => r.json() as Promise<EstadoPromo>)
      .then((e) => {
        if (!vivo || !e.hay) return;
        const t = performance.now();
        setAhora(t);
        setFin(t + e.restanteMs);
      })
      .catch(() => { /* sin la consulta no hay cartel: la landing se vende igual */ });
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    if (fin === null) return;
    const t = window.setInterval(() => setAhora(performance.now()), 1000);
    return () => window.clearInterval(t);
  }, [fin]);

  const conPromo = planes.filter((p) => PROMO_ENTRADA.planes.includes(p.id));
  if (fin === null || fin - ahora <= 0 || !conPromo.length) return null;

  return (
    <div className="mk-promo" role="region" aria-label="Descuento del primer mes">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <span className="mk-promo-texto">
        <span className="mk-promo-titulo">Te ganaste un {PROMO_ENTRADA.pct}% en tu primer mes</span>{' '}
        <span className="mk-promo-reloj" aria-label="Tiempo que queda">{textoReloj(fin - ahora)}</span>
      </span>
      <span className="mk-promo-precios">
        {conPromo.map((p) => `${p.nombre} US$ ${textoUsd(precioPrimerMes(p.precioUsd))}`).join(' · ')} · después, el precio de siempre
      </span>
      <a className="mk-promo-ir" href="#precios">Ver planes</a>
    </div>
  );
}
