'use client';
// =============================================================================
// Las piezas del mapa de calor que comparten la página EN VIVO, la FOTO y la tab vieja
// =============================================================================
// El calor (`pintarCalor`), su escala (`Leyenda`) y «Lo más tocado» (`Ranking`). Vivían adentro de
// app/landing-analyst/MapaDeCalor.tsx; se mudaron acá el 12/10/2026 cuando el Dashboard pasó a dibujar el mapa
// con su propio componente (app/dashboard/MapaCalor.tsx): dos copias del calor son dos rampas que se separan.
// La tab vieja las importa de acá.
// =============================================================================

import { colorDeCalor, type FilaRanking } from '@/lib/landing-mapa';
import { rotuloDe } from '@/lib/landing-mapa-rotulo';

/**
 * El calor: cada toque suma alfa en un círculo difuso, y la suma se pinta con la rampa.
 *
 * `escala` < 1 pinta a menos resolución (el canvas mide `W·escala` y el CSS lo estira): una página de computadora
 * entera son ~9 millones de píxeles, y leerlos todos para teñirlos traba la pantalla.
 */
export function pintarCalor(canvas: HTMLCanvasElement, puntos: ReadonlyArray<{ x: number; y: number }>, radio: number, escala = 1) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!puntos.length) return;
  const r = Math.max(2, radio * escala);
  // La densidad máxima se estima por celdas del tamaño del radio: con ella, la zona
  // más tocada llega al color más intenso sin que un toque aislado se pierda.
  const celdas = new Map<string, number>();
  for (const p of puntos) {
    const k = `${Math.floor((p.x * escala) / r)}:${Math.floor((p.y * escala) / r)}`;
    celdas.set(k, (celdas.get(k) ?? 0) + 1);
  }
  const max = Math.max(1, ...celdas.values());
  const alfa = Math.max(0.08, Math.min(1, 1.2 / max));
  for (const p of puntos) {
    const x = p.x * escala, y = p.y * escala;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alfa;
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (!a) continue;
    const [rr, gg, b, aa] = colorDeCalor(a / 255);
    d[i] = rr; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = Math.round(aa * Math.min(1, (a / 255) * 4));
  }
  ctx.putImageData(img, 0, 0);
}

/** La escala del calor, siempre a la vista (la regla del «calor semántico»: varios tonos sólo con su escala). */
export function Leyenda({ compacta = false }: { compacta?: boolean }) {
  const pasos = Array.from({ length: 12 }, (_, i) => {
    const [r, g, b, a] = colorDeCalor(i / 11);
    return `rgba(${r},${g},${b},${(a / 255).toFixed(2)})`;
  });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--dim)', flex: 'none' }}>
      <span>Pocos</span>
      <span aria-hidden style={{ width: compacta ? 64 : 120, height: 8, borderRadius: 4, background: `linear-gradient(90deg, ${pasos.join(', ')})` }} />
      <span>Muchos{compacta ? '' : ' toques'}</span>
    </div>
  );
}

/** «Lo más tocado»: una fila por lugar, con las personas distintas. Pasar por una fila resalta su elemento. */
export function Ranking({ filas, resto, resaltado, onResaltar, ancho }: {
  filas: FilaRanking[]; resto: number; resaltado: string | null; onResaltar: (sel: string | null) => void; ancho: number;
}) {
  const tipoDe = (f: FilaRanking) => (f.etiqueta.startsWith('vacio') ? 'clic_vacio' as const : 'click' as const);
  return (
    <div style={{ width: ancho, flex: 'none', display: 'grid', gap: 2, alignContent: 'start', minHeight: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 8, fontSize: 13, padding: '2px 8px 6px' }}>
        <span style={{ fontWeight: 600, color: 'var(--ink)' }}>Lo más tocado</span>
        <span style={{ marginLeft: 'auto', color: 'var(--dim)' }}>Personas</span>
      </div>
      {filas.map((f) => {
        const rotulo = rotuloDe({ tipo: tipoDe(f), etiqueta: f.etiqueta });
        const activo = !!resaltado && resaltado === f.sel;
        return (
          <div key={f.clave} onMouseEnter={() => onResaltar(f.sel)} onMouseLeave={() => onResaltar(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, background: activo ? 'var(--primary-bg)' : 'transparent' }}>
            <span style={{ flex: '0 1 auto', minWidth: 0, fontSize: 13, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={rotulo}>{rotulo}</span>
            <span style={{ marginLeft: 'auto', flex: 'none', fontSize: 13, color: 'var(--dim)', fontVariantNumeric: 'tabular-nums' }} title={`${f.toques} ${f.toques === 1 ? 'toque' : 'toques'}`}>
              {f.personas}
            </span>
          </div>
        );
      })}
      {resto > 0 && <span style={{ fontSize: 13, color: 'var(--dim)', padding: '4px 8px' }}>y {resto} más</span>}
    </div>
  );
}
