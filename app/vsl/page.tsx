import type { Metadata } from 'next';
import Landing from './Landing';

// Landing de venta de MaKo — ruta pública, NO listada en el sidebar (no figura
// en app/_components/nav.ts). Se accede solo por la URL directa /vsl.
export const metadata: Metadata = {
  title: 'MaKo — El mejor software para vender High Ticket con VSL Funnel',
  description:
    'Una sola plataforma para todo tu negocio: del primer clic en tu anuncio al cliente que paga. Menos herramientas, menos adivinanza, más cierres. Agenda tu llamada.',
};

export default function VslLandingPage() {
  return <Landing />;
}
