'use client';

// =============================================================================
// FranjaPrueba — «Usaste 1 de 3 videos armados de la prueba», arriba de cada pantalla con tope (25/10/2026)
// =============================================================================
// Copiada de la franja del AI Marketer de Madgicx (docs/media-buyer/referencias/madgicx/prueba-limitada/LEEME.md): de lado a
// lado, arriba del contenido, con el contador de lo usado, una línea con lo que se cobra después y el botón para pasar al plan
// ya. En Madgicx lo que limita la prueba es la CANTIDAD, no qué pantallas se ven: acá igual (lib/topes-plan.ts,
// `TOPES_PRUEBA`). Celeste claro con el título en azul, como allá, con los colores de MaKo (cambian con el tema oscuro).
// `cosas`: qué topes cuenta esta pantalla. Sin prueba, no se dibuja.
// =============================================================================

import type { CSSProperties } from 'react';
import { RUTA_EMPEZAR_PLAN, usadoDePrueba, type TopePrueba } from '@/lib/topes-plan';
import { usePrueba } from './usePrueba';

const CSS = `
.fp-franja { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 10px 16px; margin: 0 0 14px; border-radius: 12px;
  background: color-mix(in srgb, var(--primary) 9%, var(--surface)); border: 1px solid color-mix(in srgb, var(--primary) 22%, var(--surface)); }
.fp-texto { flex: 1; min-width: 220px; }
.fp-titulo { color: var(--primary-strong, var(--primary)); font-weight: 700; font-size: 14px; line-height: 1.35; }
.fp-linea { margin: 2px 0 0; color: var(--dim); font-size: 12.5px; line-height: 1.4; }
.fp-boton { flex: none; padding: 8px 14px; border-radius: 10px; background: var(--primary); color: var(--on-primary, #fff) !important;
  font-weight: 700; font-size: 13px; text-decoration: none; white-space: nowrap; }
`;

type CosaConUso = Exclude<TopePrueba, 'prueba.exportar'>;

/** `style`: para una pantalla de borde a borde (el margen que la separa de los costados). */
export function FranjaPrueba({ cosas, style }: { cosas: readonly CosaConUso[]; style?: CSSProperties }) {
  const prueba = usePrueba();
  if (!prueba) return null;
  const usos = prueba.usos.filter((u) => cosas.includes(u.tope));
  if (!usos.length) return null;
  const partes = usos.map((u) => usadoDePrueba(u.tope, u.usado, u.de));
  const lista = partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}`;
  return (
    <div className="fp-franja" role="status" style={style}>
      <style>{CSS}</style>
      <div className="fp-texto">
        <div className="fp-titulo">Usaste {lista} de la prueba.</div>
        <p className="fp-linea">Al pasar al plan se van los topes de la prueba{prueba.despues ? `: ${prueba.plan}, ${prueba.despues}` : ''}.</p>
      </div>
      <a className="fp-boton" href={RUTA_EMPEZAR_PLAN}>Pasar al plan ya</a>
    </div>
  );
}
