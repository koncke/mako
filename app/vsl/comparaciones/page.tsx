// =============================================================================
// /vsl/comparaciones — VISTA PREVIA: MaKo contra las apps que reemplaza, copiada de https://www.beehiiv.com/comparisons (12/11/2026)
// =============================================================================
// Martín (12/11/2026): «sobre todo la parte de comparaciones, MaKo reemplaza muchísimas apps grandes de la competencia, podemos
// hacer lo mismo». El porqué de cada cambio vive en app/vsl/_sitio/Comparaciones.tsx; las filas salen de los `reemplaza` de
// lib/funciones-mako.ts. Fuera de los buscadores mientras es vista previa.
// =============================================================================

import type { Metadata } from 'next';
import { ComparacionesSitio } from '../_sitio/Comparaciones';
import { filasDeComparacion } from '../_sitio/datos';

const n = filasDeComparacion().length;

export const metadata: Metadata = {
  title: `MaKo · Comparaciones: una sola app en lugar de ${n}`,
  description: `MaKo contra las ${n} apps que reemplaza, trabajo por trabajo: dashboards, chats, cursos, páginas de venta, anuncios, video, imágenes y textos.`,
  robots: { index: false, follow: false },
};

export default function ComparacionesPage() {
  return <ComparacionesSitio />;
}
