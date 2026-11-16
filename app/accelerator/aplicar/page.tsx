// =============================================================================
// /accelerator/aplicar — la aplicación a MaKo Accelerator (16/11/2026)
// =============================================================================
// Martín, 16/11/2026: «yo no pondría el botón de agendar llamada, sino justamente el botón de aplicar ahora. Y ahí pondría
// justamente un formulario… muy similar [al de Mastery Haus]». Adonde lleva el «Aplica ahora» de /accelerator (`RUTA_APLICAR`).
// El formulario es ./FormularioAplicacion.tsx (las preguntas y quién califica: lib/aplicacion-accelerator.ts) y postea a
// /api/accelerator/aplicar. Arriba, la barra del programa (app/accelerator/Barra.tsx): la marca y «El programa» vuelven a la landing.
// SIN EL PIE DEL SITIO NI EL WHATSAPP QUE FLOTA (16/11/2026, Martín: «durante el formulario no debería salir la bottom bar»): un
// paso no se abandona por un link del pie, y el botón que flota pisaba el «Siguiente» en el teléfono (revisión, hallazgo 7). El
// WhatsApp que flota lo dibuja el pie (`PieGlobal`), así que se va con él. Los legales siguen en la landing.
//
// ⚠️ PÚBLICA (lib/rutas-publicas.ts, por el prefijo /accelerator): sólo GET, no lee cookies, sin <Suspense>. La campaña que trajo
//    la URL (landing, utm_*, fbclid) viaja en el cuerpo del POST (./origen.ts). No se indexa: es un paso, no una página.
// ⚠️ LEE UN SOLO ENCABEZADO: el país de la IP (`x-vercel-ip-country`), para que el WhatsApp arranque con el código de país de quien
//    aplica, como el checkout (app/planes/[plan]/page.tsx). No es la sesión ni una cookie: es lo que Vercel deduce de la IP, y la
//    persona lo cambia en el selector. tests/aplicacion-accelerator.test.ts lo fija (sólo ése).
// =============================================================================

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { unstable_rethrow } from 'next/navigation';
import { PROGRAMA_ACELERADOR, rutaDelPlan } from '@/lib/planes-mako';
import { paisDelVisitante } from '@/lib/compra-plan-reglas';
import { ladaDelPais } from '@/lib/paises';
import { CSS_ACELERADOR, FUENTES_ACELERADOR } from '../estilo';
import { BarraAccelerator, CSS_BARRA_ACCELERATOR, MARCA_AL_PROGRAMA } from '../Barra';
import { CSS_APLICAR } from './estilo';
import { CLAVES_ORIGEN, origenDeLaUrl } from './origen';
import { FormularioAplicacion } from './FormularioAplicacion';

const TITULO = `Aplica a ${PROGRAMA_ACELERADOR.nombre}`;
/**
 * El paso siguiente de la pantalla final: la prueba gratuita es la de MaKo Pro, su checkout de siempre (Martín: «iniciar tu prueba
 * gratuita de 7 días en MaKo»); el formulario le suma la campaña. «Entrar a MaKo» y «Ya hice la prueba gratuita», el login.
 */
const RUTA_PRUEBA = `/planes/${rutaDelPlan('pro')}`;
const RUTA_ENTRAR = '/login';
const DESCRIPCION = 'Cuéntame de tu negocio en unos 5 minutos. Leo cada aplicación personalmente.';

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  robots: { index: false, follow: false },
  // Completa, porque el `openGraph` de una página REEMPLAZA al del layout (como en /accelerator).
  openGraph: {
    type: 'website',
    siteName: 'MaKo',
    title: TITULO,
    description: DESCRIPCION,
    images: [{ url: '/og-mako.jpg', width: 1200, height: 630, alt: 'MaKo' }],
  },
  twitter: { card: 'summary_large_image', images: ['/og-mako.jpg'] },
};
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * La lada de donde está quien aplica (`ladaDelPais`, la de siempre si Vercel no lo ubica). Fuera de un pedido no hay encabezados
 * (`headers()` tira: un test que dibuja la página): la de siempre. Lo de Next (una página que se vuelve dinámica) sigue de largo.
 */
async function ladaDeLaVisita(): Promise<string> {
  let pais: string | null = null;
  try {
    pais = paisDelVisitante((await headers()).get('x-vercel-ip-country'));
  } catch (e) {
    unstable_rethrow(e);
  }
  return ladaDelPais(pais);
}

export default async function AplicarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const origen = origenDeLaUrl(await searchParams);
  const ladaInicial = await ladaDeLaVisita();
  return (
    <div className="acl-root apl-root">
      <style dangerouslySetInnerHTML={{ __html: CSS_ACELERADOR + CSS_BARRA_ACCELERATOR + CSS_APLICAR }} />
      <link rel="stylesheet" href={FUENTES_ACELERADOR} precedence="default" />
      {/* «El programa» y no «Ver el programa»: con el nombre del programa al lado, de 320 a 430 px no entraba en un renglón
          (medido el 16/11/2026). Vuelve a la landing; con borde, para que no compita con el formulario (./estilo.ts). La marca
          también vuelve a la landing (`MARCA_AL_PROGRAMA`). */}
      <BarraAccelerator boton={{ href: MARCA_AL_PROGRAMA.href, texto: 'El programa' }} marca={MARCA_AL_PROGRAMA} />
      <main className="apl-main">
        <noscript><p className="apl-sinjs">Para enviar tu aplicación, activa JavaScript en tu navegador.</p></noscript>
        <FormularioAplicacion origen={origen} clavesOrigen={CLAVES_ORIGEN} rutaPrueba={RUTA_PRUEBA} rutaEntrar={RUTA_ENTRAR} ladaInicial={ladaInicial} />
      </main>
    </div>
  );
}
