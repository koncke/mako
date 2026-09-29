// =============================================================================
// Las tabs del hub de Onboarding: la lista y cómo se lee de la URL
// =============================================================================
// ⚠️ ESTO VIVE EN UN `.ts` Y NO ADENTRO DE `OnboardingTabs.tsx`, y no es prolijidad:
// es la regla de «`'use client'` es una frontera de DATOS» de AGENTS.md, del lado
// que tira el build.
//
// `tabDeUrl` nació exportada desde `OnboardingTabs.tsx`, que lleva `'use client'`.
// Para quien la importa desde el grafo del SERVER eso no es una función: es una
// REFERENCIA de cliente. No falla al importar — falla al LLAMARLA, y el 29/09/2026
// eso dejó `/onboarding` entero en «Esta pantalla se rompió al dibujarse», en
// producción, con un digest y sin nombrar ni el archivo ni la línea.
//
// Y no lo cazó nada de la red que ya existe: `tsx` IGNORA la directiva, así que el
// typecheck pasó en verde; los tests leen los fuentes como TEXTO, así que también; y
// la verificación en el navegador de esa tanda abrió /crm, no /onboarding. Esto lo
// caza `npm run build`, mirar la pantalla, o nadie.
//
// Un `.ts` sin `'use client'` ni `server-only` lo pueden importar los dos lados.

/** Las once pastillas del hub, en el orden en que se dibujan. */
export type TabKey =
  | 'matriz' | 'diagnostico' | 'archivero' | 'oferta' | 'entregable' | 'persona'
  | 'personalidad' | 'avatares' | 'razones' | 'angulos' | 'funnel';

export const TAB_KEYS: TabKey[] = [
  'matriz', 'diagnostico', 'archivero', 'oferta', 'entregable', 'persona',
  'personalidad', 'avatares', 'razones', 'angulos', 'funnel',
];

/** La tab por defecto: la que se abre sin `?tab=` y a la que cae un valor inventado. */
export const TAB_INICIAL: TabKey = 'matriz';

/**
 * La tab que pide la URL.
 *
 * Existe para poder MANDAR a alguien a una de las once: el panel de tracking que ve el
 * cliente en su landing dice «Activar la landing como entrada de leads», y esa casilla
 * vive en la tarjeta de entradas de «El funnel», la décima. Sin el parámetro, ese botón
 * deja a la persona en «Matriz» buscando algo cuyo nombre no conoce.
 *
 * Un valor que no está en el catálogo no rompe: abre la primera.
 */
export function tabDeUrl(v?: string): TabKey {
  return TAB_KEYS.includes(v as TabKey) ? (v as TabKey) : TAB_INICIAL;
}
