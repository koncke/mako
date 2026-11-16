import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { PortadaSitio } from './vsl/_sitio/Portada';
import { metadataPortada } from './vsl/portada-metadata';
import { CLAVES_A_PLANES, sufijoDesdeUrl } from './vsl/sufijo-a-planes';
import { planesParaLanding } from '@/lib/compra-plan';
import { entornoPromo, promoVigente } from '@/lib/promo-entrada';
import { COOKIE_PROMO } from '@/lib/promo-entrada-reglas';

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

/**
 * LAS COLUMNAS DE PRECIOS, CON LO MISMO QUE /planes (15/11/2026, Martín: «en la landing principal se tiene que repetir exactamente lo
 * mismo que en precios»). Como app/planes/page.tsx: el origen de la campaña y el código de partner de la URL pasan a los botones de
 * cada plan (las mismas claves, `CLAVES_A_PLANES`), y el «Tu primer mes» del 50 % se dice mientras el reloj de este navegador sigue
 * vivo (la cookie firmada: sólo se LEE, el reloj lo arranca la landing). La página ya se arma en cada visita: el layout raíz lee la
 * cookie de sesión (medido el 15/11/2026, la nota en app/vsl/_sitio/Cuenta.tsx).
 * ⚠️ LO QUE FALTA PARA QUE SEA IGUAL DE VERDAD (16/11/2026): /planes decide si un plan se cobra en línea POR EL PAÍS de quien mira
 * (`ofertasDeLosPlanes(paisDelVisitante(x-vercel-ip-country))`) y planesParaLanding() no mira el país. Para un visitante cuyo país
 * no tiene pasarela, /planes dice «Quiero MaKo Pro» y estas columnas «Pruébalo gratis» (botonDelPlan). Cambiarlo acá rompe
 * tests/planes-sin-pasarela.test.ts, que pide `planesParaLanding()` en este archivo: va con quien tiene /planes.
 */
export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const k of CLAVES_A_PLANES) {
    const v = sp[k];
    if (typeof v === 'string') qs.set(k, v);
  }
  const [planes, galletas] = await Promise.all([planesParaLanding(), cookies()]);
  const promo = promoVigente(galletas.get(COOKIE_PROMO)?.value, Date.now(), entornoPromo());
  return <PortadaSitio planes={planes} sufijo={sufijoDesdeUrl(qs.toString(), null)} promoVigente={promo} />;
}
