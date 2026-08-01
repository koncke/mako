import { permanentRedirect } from 'next/navigation';

// La landing se mudó a la raíz (app/page.tsx). /vsl queda como redirect
// permanente porque hay anuncios, links y material viejo apuntando acá. Los
// detalles por feature siguen viviendo en /vsl/<slug>: solo se movió el índice.
export default function VslLandingPage() {
  permanentRedirect('/');
}
