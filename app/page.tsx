import type { Metadata } from 'next';
import { PortadaSitio } from './vsl/_sitio/Portada';
import { metadataPortada } from './vsl/portada-metadata';
import { planesParaLanding } from '@/lib/compra-plan';

// La raíz es la PORTADA NUEVA (el sitio tipo SaaS copiado de beehiiv, app/vsl/_sitio/Portada.tsx).
// Vivía en /vsl/sitio como vista previa; Martín la aprobó el 14/11/2026 y pidió que pase a ser la
// principal: «está mal la ruta de la landing nueva… tendría que estar en la ruta principal».
// /vsl/sitio quedó como redirect permanente a acá, porque él tiene ese link a mano.
//
// La ve CUALQUIERA, con sesión o sin ella: es la cara pública del dominio. El repartidor por rol
// vive en /inicio, que es a donde va el login y el «Entrar» del header.
//
// ⚠️ La portada anterior (app/vsl/Portada.tsx) se armaba con el documento PUBLICADO de Web Generator
// (lib/editor-landing/landing-mako.ts). La nueva NO: su contenido vive en el código. Mientras la raíz
// sea ésta, «Publicar» desde Web Generator no cambia hola-mako.com. El componente viejo sigue en el
// repo: volver atrás es cambiar este import.
//
// La metadata vive en app/vsl/portada-metadata.ts (la importa también el test, sin server-only).
export const metadata: Metadata = metadataPortada;

// Los planes salen de planesParaLanding() (lib/compra-plan.ts), con caché de 5 minutos.
export const revalidate = 300;

export default async function Home() {
  const planes = await planesParaLanding();
  return <PortadaSitio planes={planes} />;
}
