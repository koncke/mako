import type { Metadata } from 'next';
import { Portada } from './vsl/Portada';
import { metadataPortada } from './vsl/portada-metadata';
import { disenoDeLanding, landingMako } from '@/lib/editor-landing/landing-mako';

// La raíz es la landing de venta (antes vivía en /vsl). La ve CUALQUIERA, con
// sesión o sin ella: es la cara pública del dominio y tener que desloguearse
// para mirar el VSL no tiene sentido. El repartidor por rol —lo que antes vivía
// acá— se mudó a /inicio, que es a donde va el login y el "Entrar" del header.
// La metadata vive en app/vsl/portada-metadata.ts (la importa también el test, sin server-only).
export const metadata: Metadata = metadataPortada;


// La portada se arma con la landing de Web Generator PUBLICADA (lib/editor-landing/landing-mako.ts), con
// caché de 5 minutos que «Publicar» vence al momento. Sin documento publicado, la de siempre.
export const revalidate = 300;

export default async function Home() {
  const diseno = disenoDeLanding(await landingMako(null));
  return <Portada diseno={diseno} />;
}
