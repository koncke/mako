import type { Metadata } from 'next';
import Estrategia from './Estrategia';

// Documento INTERNO (oferta + estrategia de marketing) para presentarle al
// consultor. La ruta cae bajo /vsl → es pública por proxy.ts (startsWith
// '/vsl/'), lo que permite compartir el link sin login. noindex para que no lo
// levante ningún buscador: es material interno, no distribuir.
export const metadata: Metadata = {
  title: 'MaKo — Oferta y estrategia de marketing · Interno',
  description:
    'Documento interno: la escalera de oferta de MaKo, la estrategia de prospección y campañas de mensajes, el plan de gasto y las decisiones abiertas.',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <Estrategia />;
}
