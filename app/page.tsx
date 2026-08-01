import type { Metadata } from 'next';
import Landing from './vsl/Landing';

// La raíz es la landing de venta (antes vivía en /vsl). La ve CUALQUIERA, con
// sesión o sin ella: es la cara pública de makodigital.app y tener que desloguearse
// para mirar el VSL no tiene sentido. El repartidor por rol —lo que antes vivía
// acá— se mudó a /inicio, que es a donde va el login y el "Entrar" del header.
export const metadata: Metadata = {
  title: 'MaKo — El mejor software para vender High Ticket con VSL Funnel',
  description:
    'Una sola plataforma para todo tu negocio: del primer clic en tu anuncio al cliente que paga. Menos herramientas, menos adivinanza, más cierres. Agenda tu llamada.',
};

export default function Home() {
  return <Landing />;
}
