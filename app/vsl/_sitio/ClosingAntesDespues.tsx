// =============================================================================
// El «antes y después» de Closing, con dos llamadas de venta REALES de Mauricio (16/11/2026)
// =============================================================================
// Martín: «prefiero la de antes y después… utiliza de las que tenemos grabadas ahí con Mauricio… no debería tener tanto texto esa
// animación». Dos análisis del Closing Analyst (./closing-mauricio.ts): la nota de septiembre y la de octubre, y por cada dimensión
// la barra gris de septiembre con, en verde, lo que subió en octubre. Sin nombres ni frases de los prospectos.
// Server component, sin JavaScript: la animación es CSS (las barras crecen, se quedan y vuelven a empezar). Todo en unidades del
// contenedor (cqw), así entra igual en la fila de la computadora y en la del teléfono. `data-tema-fijo`: el sol y la luna no lo toca
// (es una pantalla de la app, blanca en los dos modos, como las grabaciones de las otras filas).
import type { CSSProperties } from 'react';
import { CLOSING_MAURICIO } from './closing-mauricio';

const coma = (n: number) => (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');
const sinCero = (s: string) => s.replace(/,0$/, '');

const CSS = `
.s-cad{container-type:inline-size;position:absolute;inset:0;background:#fff;color:#12151B;font-family:inherit}
.s-cad-in{display:flex;flex-direction:column;height:100%;padding:4cqw 5cqw;gap:2.2cqw}
.s-cad-cab{display:flex;align-items:flex-end;gap:3cqw}
.s-cad-nota{display:flex;flex-direction:column;gap:.6cqw}
.s-cad-mes{font-size:2cqw;line-height:1.2;font-weight:600;color:#6B7280}
.s-cad-n{font-size:7cqw;line-height:1;font-weight:800;letter-spacing:-.03em}
.s-cad-n-antes{color:#9CA3AF}
.s-cad-n-despues{color:#2F6FED;animation:s-cad-aparece 9s infinite}
.s-cad-flecha{align-self:center;color:#C7CDD8}
.s-cad-flecha svg{display:block;width:4.4cqw;height:4.4cqw}
.s-cad-sube{margin-left:auto;align-self:center;padding:1cqw 2cqw;border-radius:999px;background:#E8F7EE;color:#15803D;font-size:2.6cqw;font-weight:800;animation:s-cad-aparece 9s infinite}
.s-cad-dims{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;justify-content:space-between;flex:1}
.s-cad-dim{display:grid;grid-template-columns:30cqw 1fr 5cqw;align-items:center;gap:2cqw}
.s-cad-dl{font-size:2.1cqw;line-height:1.2;font-weight:600;color:#374151;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.s-cad-pista{position:relative;height:2.6cqw;border-radius:99px;background:#F1F3F7;overflow:hidden}
.s-cad-b{position:absolute;top:0;bottom:0;border-radius:99px}
.s-cad-ba{left:0;width:var(--a);background:#C7CDD8;animation:s-cad-a 9s infinite;animation-delay:calc(var(--i) * .06s)}
.s-cad-bd{left:var(--a);width:var(--d);background:linear-gradient(90deg,#34D399,#16A34A);border-radius:0 99px 99px 0;animation:s-cad-d 9s infinite;animation-delay:calc(var(--i) * .06s)}
.s-cad-delta{font-size:2.1cqw;font-weight:800;color:#15803D;text-align:right;animation:s-cad-aparece 9s infinite}
@keyframes s-cad-a{0%{width:0}12%,90%{width:var(--a)}97%,100%{width:0}}
@keyframes s-cad-d{0%,30%{width:0}46%,90%{width:var(--d)}97%,100%{width:0}}
@keyframes s-cad-aparece{0%,34%{opacity:0}46%,90%{opacity:1}97%,100%{opacity:0}}
@media (prefers-reduced-motion:reduce){.s-cad-ba,.s-cad-bd,.s-cad-n-despues,.s-cad-sube,.s-cad-delta{animation:none}}
/* En una caja chica (el teléfono), las 7 filas no entran legibles: van sólo las 3 que más subieron, más grandes. */
@container (max-width:480px){.s-cad-dim:not([data-top]){display:none}.s-cad-dims{justify-content:space-evenly}.s-cad-dim{grid-template-columns:48cqw 1fr 9cqw}.s-cad-dl,.s-cad-delta{font-size:3.4cqw}.s-cad-pista{height:3.8cqw}.s-cad-n{font-size:10cqw}.s-cad-mes{font-size:3.4cqw}.s-cad-sube{font-size:3.8cqw}.s-cad-flecha svg{width:6cqw;height:6cqw}}
`;

export function ClosingAntesDespues() {
  const { antes, despues } = CLOSING_MAURICIO;
  const filas = antes.dimensiones.map((d) => {
    const luego = despues.dimensiones.find((x) => x.dimension === d.dimension)?.nota ?? d.nota;
    return { dimension: d.dimension, a: d.nota, b: Math.max(luego, d.nota) };
  });
  // Las 3 que más subieron: las únicas que quedan en una caja chica (el teléfono).
  const top = new Set([...filas].sort((x, y) => (y.b - y.a) - (x.b - x.a)).slice(0, 3).map((f) => f.dimension));
  return (
    <div className="s-cad" data-tema-fijo="" role="img"
      aria-label={`Dos llamadas de venta de Mauricio analizadas por MaKo: ${coma(antes.nota)} en ${antes.mes.toLowerCase()} y ${coma(despues.nota)} en ${despues.mes.toLowerCase()}`}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="s-cad-in">
        <div className="s-cad-cab">
          <div className="s-cad-nota"><span className="s-cad-mes">{antes.mes}</span><span className="s-cad-n s-cad-n-antes">{coma(antes.nota)}</span></div>
          <span className="s-cad-flecha" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
          <div className="s-cad-nota"><span className="s-cad-mes">{despues.mes}</span><span className="s-cad-n s-cad-n-despues">{coma(despues.nota)}</span></div>
          <span className="s-cad-sube">+{coma(despues.nota - antes.nota)}</span>
        </div>
        <ul className="s-cad-dims">
          {filas.map((f, i) => (
            <li key={f.dimension} className="s-cad-dim" data-top={top.has(f.dimension) ? '' : undefined} style={{ '--a': `${f.a * 10}%`, '--d': `${(f.b - f.a) * 10}%`, '--i': i } as CSSProperties}>
              <span className="s-cad-dl">{f.dimension}</span>
              <span className="s-cad-pista"><span className="s-cad-b s-cad-ba" /><span className="s-cad-b s-cad-bd" /></span>
              <span className="s-cad-delta">{f.b > f.a ? `+${sinCero(coma(f.b - f.a))}` : ''}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
