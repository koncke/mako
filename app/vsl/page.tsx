import type { Metadata } from 'next';
import Landing from './Landing';

// Landing de venta de MaKo — ruta pública, NO listada en el sidebar (no figura
// en app/_components/nav.ts). Se accede solo por la URL directa /vsl.
export const metadata: Metadata = {
  title: 'MaKo — el Marketing OS con IA que piensa con tus números',
  description:
    'MaKo junta tus ads, tu CRM, tu funnel y tus cobranzas en un solo lugar, con una IA que conoce tus números y te dice qué hacer hoy. Agendá tu demo.',
};

export default function VslLandingPage() {
  return <Landing />;
}
