'use client';
// =============================================================================
// Ico — un ícono del catálogo de la landing (Phosphor, lib/editor-landing/iconos.ts), del color del texto
// =============================================================================
// Vivía en MiniaturaLanding.tsx, que lo sigue exportando. Salió a su archivo en la decimocuarta tanda de Automations
// (12/10/2026): la caja «¿Qué vas a crear hoy?» (CajaPedido.tsx) la monta también el modal «Nueva automatización», y
// MiniaturaLanding arrastra el render de la landing entera: el lienzo de /automations no tiene por qué cargarlo.

import { useMemo } from 'react';
import { svgIcono } from '@/lib/editor-landing/iconos';

/** Un ícono del catálogo de la landing (Phosphor), del color del texto. */
export function Ico({ n, t = 16 }: { n: string; t?: number }) {
  const html = useMemo(() => svgIcono(n, t), [n, t]);
  return <span className="gp-ico" aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />;
}
