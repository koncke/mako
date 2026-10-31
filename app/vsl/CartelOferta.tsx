'use client';

// =============================================================================
// CartelOferta — «Te ganaste un 50% de descuento», con su reloj, arriba de la landing de venta
// =============================================================================
// docs/estrategia-lanzamiento-low-to-high.md §3. Las reglas y por qué el reloj no miente: lib/oferta-entrada-reglas.ts.
//   · El tiempo lo da el servidor y acá se cuenta con `performance.now()`: cambiar la hora del teléfono no le regala minutos a nadie.
//   · En cero se va. Al volver a entrar, el servidor contesta que ya no hay oferta y no se dibuja.
//   · Mientras la consulta no contesta o falla, no hay cartel: la landing se vende igual a precio normal.
//   · Va en el flujo y `sticky` arriba, una sola franja en el teléfono: no flota sobre el botón de comprar. «Ver planes» lleva a
//     `#precios` con `scroll-margin`, para que la franja no le tape el título a los precios.
// =============================================================================

import { useEffect, useState } from 'react';
import { OFERTA_ENTRADA, precioPrimerMes, textoReloj, textoUsd, type EstadoOferta } from '@/lib/oferta-entrada-reglas';

const CSS = `
.mk-oferta { position: sticky; top: 0; z-index: 60; display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 4px 14px;
  box-sizing: border-box; padding: 8px 16px; background: #12151B; color: #fff; font-size: 15px; line-height: 1.3; }
.mk-oferta-titulo { font-weight: 700; }
.mk-oferta-precios { color: #C8CEDA; font-size: 14px; }
.mk-oferta-reloj { font-variant-numeric: tabular-nums; font-weight: 800; color: #FFD400; }
.mk-oferta-ir { flex: none; padding: 5px 14px; border-radius: 999px; background: #2F6FED; color: #fff; font-size: 14px; font-weight: 700; text-decoration: none; }
.mk-oferta-ir:hover { background: #1F5AD0; }
.mk-oferta-ir:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
#precios { scroll-margin-top: 72px; }
@media (max-width: 640px) {
  .mk-oferta { flex-wrap: nowrap; justify-content: space-between; gap: 8px; padding: 6px 12px; font-size: 13px; }
  .mk-oferta-precios { display: none; }
  .mk-oferta-texto { min-width: 0; }
  .mk-oferta-ir { padding: 5px 10px; font-size: 13px; white-space: nowrap; }
}
`;

export function CartelOferta({ planes }: { planes: ReadonlyArray<{ id: string; nombre: string; precioUsd: number }> }) {
  const [fin, setFin] = useState<number | null>(null);
  const [ahora, setAhora] = useState(0);

  useEffect(() => {
    let vivo = true;
    fetch('/api/oferta-entrada', { method: 'POST' })
      .then((r) => r.json() as Promise<EstadoOferta>)
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

  const conOferta = planes.filter((p) => OFERTA_ENTRADA.planes.includes(p.id));
  if (fin === null || fin - ahora <= 0 || !conOferta.length) return null;

  return (
    <div className="mk-oferta" role="region" aria-label="Oferta del primer mes">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <span className="mk-oferta-texto">
        <span className="mk-oferta-titulo">Te ganaste un {OFERTA_ENTRADA.pct}% en tu primer mes</span>{' '}
        <span className="mk-oferta-reloj" aria-label="Tiempo que queda">{textoReloj(fin - ahora)}</span>
      </span>
      <span className="mk-oferta-precios">
        {conOferta.map((p) => `${p.nombre} US$ ${textoUsd(precioPrimerMes(p.precioUsd))}`).join(' · ')} · después, el precio de siempre
      </span>
      <a className="mk-oferta-ir" href="#precios">Ver planes</a>
    </div>
  );
}
