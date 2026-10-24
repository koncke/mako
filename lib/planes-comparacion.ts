// =============================================================================
// planes-comparacion — la tabla «Compara los planes» de /planes (24/10/2026)
// =============================================================================
// Puro: lo usan app/planes/page.tsx y tests/planes-tres-bloques.test.ts.
//
// Los números NO se escriben a mano: salen de los topes que el código hace cumplir (lib/topes-plan.ts, `TOPES`), así la
// vitrina no puede prometer 3 automatizaciones si el producto frena en 2. Lo que es sólo de Pro sale de `TABS_SOLO_PRO`.
// El Acelerador trae MaKo Pro (docs/ofertas-mako.md §3): sus topes son los de Pro, y suma lo del programa.
// =============================================================================

import { TOPES, TABS_SOLO_PRO, type Tope } from './topes-plan';

/** true = incluido, false = no incluido, texto = el tope. */
export type Celda = boolean | string;
export type FilaComparacion = { que: string; esencial: Celda; pro: Celda; acelerador: Celda };

const cantidad = (n: number | null, prefijo = ''): string => (n == null ? 'Sin tope' : `${prefijo}${n.toLocaleString('es-AR')}`);

/** Una fila de tope: Esencial es la capa `completo`; Pro y el Acelerador, `agencia`. */
const filaDeTope = (que: string, t: Tope, prefijo = ''): FilaComparacion => ({
  que,
  esencial: cantidad(TOPES.completo[t], prefijo),
  pro: cantidad(TOPES.agencia[t], prefijo),
  acelerador: cantidad(TOPES.agencia[t], prefijo),
});

/** Las tabs que son sólo de Pro, con el nombre que se le muestra a un desconocido. */
export const NOMBRE_TAB_PRO: Readonly<Record<(typeof TABS_SOLO_PRO)[number], string>> = {
  'ads-manager': 'Ads Manager',
  'closing-analyst': 'Closing Analyst',
  'image-editor': 'Image Editor',
  'video-editor': 'Video Editor',
  'ai-avatar': 'AI Avatar',
};

export function filasDeComparacion(): FilaComparacion[] {
  return [
    { que: 'Ops Center con MaKo y tu propia IA', esencial: true, pro: true, acelerador: true },
    filaDeTope('Funnels del CRM', 'crm.funnels'),
    filaDeTope('Leads', 'crm.leads', 'Hasta '),
    filaDeTope('Líneas de WhatsApp, más Instagram', 'chats.lineas_whatsapp'),
    filaDeTope('Automatizaciones activas', 'automations.activas'),
    filaDeTope('Landings publicadas', 'web.landings_publicadas'),
    filaDeTope('Usuarios', 'equipo.usuarios'),
    ...TABS_SOLO_PRO.map((t): FilaComparacion => ({ que: NOMBRE_TAB_PRO[t], esencial: false, pro: true, acelerador: true })),
    { que: 'Los negocios de tus clientes (agencia)', esencial: false, pro: true, acelerador: true },
    { que: 'La asesoría grupal de Martín, cada semana', esencial: false, pro: false, acelerador: true },
    { que: 'Tu funnel armado en la primera semana', esencial: false, pro: false, acelerador: true },
  ];
}
