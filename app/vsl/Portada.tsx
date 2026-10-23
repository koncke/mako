// =============================================================================
// La portada de hola-mako.com: los datos del negocio, y la landing en su propio Suspense
// =============================================================================
// Era el cuerpo de app/page.tsx. Desde el 23/10/2026 la página lee la landing de Web Generator publicada
// (lib/editor-landing/landing-mako.ts, server-only) y se la pasa a esto: así la portada se sigue pudiendo
// renderizar en un test (tests/razon-social-sitio.test.ts) sin la base.
// =============================================================================

import { Suspense } from 'react';
import Landing, { type DisenoLanding } from './Landing';
import { PortadaSinJs } from './PortadaSinJs';
import { EMAIL_MAKO, APP_BASE_URL } from '@/lib/app-url';
import { RAZON_SOCIAL_MAKO } from '@/lib/titular-mako';

/**
 * Quién está detrás del sitio, en datos estructurados (schema.org Organization).
 *
 * ⚠️ POR QUÉ: Meta rechazó DOS veces la verificación del negocio con «la razón social
 * de la empresa debe aparecer en el sitio web» (08/10/2026). La razón social ya está
 * visible en el pie (`PieLegal`, app/vsl/Landing.tsx), pero el pie cae al final de
 * ~200 KB de HTML; esto la pone al PRINCIPIO del body y en el campo que el estándar
 * define para eso (`legalName`), para cualquier lector que no llegue al final o que
 * busque el dato estructurado. No reemplaza al texto visible: lo acompaña.
 */
const NEGOCIO = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'MaKo',
  legalName: RAZON_SOCIAL_MAKO,
  url: APP_BASE_URL,
  email: EMAIL_MAKO,
};

/** `diseno` null = la landing de siempre (landing-html.ts). `conSuspense` false: sin el fallback (las de cada funnel). */
export function Portada({ diseno, conSuspense = true }: { diseno: DisenoLanding | null; conSuspense?: boolean }) {
  if (!conSuspense) {
    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(NEGOCIO) }} />
        <Landing diseno={diseno} />
      </>
    );
  }
  return (
    <>
      {/* JSON.stringify de strings propios, sin «<»: no hay HTML que escapar. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(NEGOCIO) }} />
      {/* ⚠️ LA LANDING VA EN SU PROPIO SUSPENSE, con un fallback que se ve. Nació el
          08/10/2026 para esquivar el Suspense que envolvía la app entera en el layout:
          con él, toda la portada viajaba OCULTA hasta que corre JavaScript, y el
          verificador de Meta —que no lo ejecuta— rechazaba la verificación del negocio.

          Desde el 10/10/2026 ese Suspense del layout ya no existe, así que ESTE es el
          único que esconde la landing: sin él, quien no ejecuta JS leería la landing
          entera (con la razón social en el pie) en vez de PortadaSinJs. Se dejó a
          propósito: es la vista con la que Meta aprobó el negocio, y cambiarla con una
          verificación de Meta todavía abierta es un riesgo que no compra nada. Sacarlo
          es una línea, y obliga a ajustar tests/razon-social-sitio.test.ts. */}
      <Suspense fallback={<PortadaSinJs />}>
        <Landing diseno={diseno} />
      </Suspense>
    </>
  );
}
