// =============================================================================
// La guía de Image: qué se puede señalar y qué se enseña (PURO; 9/11/2026)
// =============================================================================
// El catálogo de la tab (docs/mako-iniciativa/guia.md §6), al lado de su pantalla: lo junta lib/guia/catalogo.ts. Nació con el
// guiado de los carruseles (docs/relevo/nube-carruseles-guiado.md): Martín pidió que al replicar MaKo pregunte «con el tutorial
// que se opaca la pantalla, que le vaya señalando la pregunta». Ése es `image-editor-pregunta`, que el chat del guiado
// (./carruseles/ReplicarGuiado.tsx) señala con el velo de la casa (app/_ui/guia/VeloGuia.tsx) cada vez que MaKo pregunta.
// Las anclas son `data-recorrido` puestos con `ancla()`. Los ids NO se renombran: son la clave de lo visto.
// Sin `'use client'`, sin React: lo importan la pantalla, el server y los tests.

import type { GuiaDeTab } from '@/lib/guia/tipos';

export const GUIA_IMAGE = {
  key: 'image-editor',
  nombre: 'Image',
  href: '/image-editor',
  anclas: [
    { id: 'image-editor-outliers', nombre: 'Los outliers', para: 'Los carruseles que mejor rindieron: elige uno.', pregunta: '¿De dónde copio uno?' },
    { id: 'image-editor-replicar', nombre: 'Replicar', para: 'Toca aquí para hacer tu versión de este.' },
    { id: 'image-editor-pregunta', nombre: 'La pregunta de MaKo', para: 'Contesta aquí para seguir.', enElChat: true },
  ],
  objetivos: [
    { id: 'replicar', titulo: 'Replicar un carrusel', pasos: [{ ancla: 'image-editor-outliers' }, { ancla: 'image-editor-replicar' }] },
    { id: 'contestar', titulo: 'Contestarle a MaKo', pasos: [{ ancla: 'image-editor-pregunta' }] },
  ],
} as const satisfies GuiaDeTab;
