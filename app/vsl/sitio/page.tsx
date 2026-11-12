// =============================================================================
// /vsl/sitio — VISTA PREVIA de la portada nueva de MaKo, copiada de https://www.beehiiv.com/ (12/11/2026)
// =============================================================================
// Pedido de Martín (12/11/2026): que la portada deje de ser una landing y sea un sitio como el de los grandes SaaS, con la
// barra de soluciones desplegables (las landings de cada función), Industrias (los avatares), Comparaciones y Precios. Copia
// la portada de beehiiv sección por sección: el porqué de cada cambio vive en app/vsl/_sitio/Portada.tsx.
// La portada de hoy (app/page.tsx) NO se toca: esto es una vista previa, fuera de los buscadores hasta que Martín la apruebe.
// Los planes salen de planesParaLanding() (lib/compra-plan.ts), como en la portada de hoy, con la misma caché de 5 minutos.
// =============================================================================

import type { Metadata } from 'next';
import { planesParaLanding } from '@/lib/compra-plan';
import { PortadaSitio } from '../_sitio/Portada';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'MaKo · Ventas, marketing y contenido en una sola app',
  description: 'La app con IA para vender High Ticket, de punta a punta: del primer clic en tu anuncio al cliente que paga.',
  robots: { index: false, follow: false },
};

export default async function SitioPage() {
  const planes = await planesParaLanding();
  return <PortadaSitio planes={planes} />;
}
