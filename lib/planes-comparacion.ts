// =============================================================================
// planes-comparacion — la tabla «Compara los planes» de /planes (24/10/2026)
// =============================================================================
// Puro: lo usan app/planes/page.tsx y tests/planes-tres-bloques.test.ts.
//
// Los números NO se escriben a mano: salen de los topes que el código hace cumplir (lib/topes-plan.ts, `TOPES`), así la
// vitrina no puede prometer 3 automatizaciones si el producto frena en 2. Lo que es sólo de Pro sale de `TABS_SOLO_PRO`.
// El Acelerador trae MaKo Pro (docs/ofertas-mako.md §3): sus topes son los de Pro, y suma lo del programa.
//
// SIN LENGUAJE INTERNO (24/10/2026, noche, Martín: «las personas no saben que es "Ops Center" y muchas otras cosas»): cada
// fila dice lo que la persona CONSIGUE, nunca el nombre de una tab, y van por grupos, como el «Compare features» de Kajabi
// (kajabi.com/pricing, mirado el 24/10). La guarda está en tests/planes-tres-bloques.test.ts.
// =============================================================================

import { TOPES, TABS_SOLO_PRO, type Tope } from './topes-plan';

/** true = incluido, false = no incluido, texto = el tope. */
export type Celda = boolean | string;
export type FilaComparacion = { grupo: string; que: string; esencial: Celda; pro: Celda; acelerador: Celda };

const cantidad = (n: number | null, prefijo = ''): string => (n == null ? 'Sin tope' : `${prefijo}${n.toLocaleString('es-AR')}`);

/** Una fila de tope: Esencial es la capa `completo`; Pro y el Acelerador, `agencia`. */
const filaDeTope = (grupo: string, que: string, t: Tope, prefijo = ''): FilaComparacion => ({
  grupo,
  que,
  esencial: cantidad(TOPES.completo[t], prefijo),
  pro: cantidad(TOPES.agencia[t], prefijo),
  acelerador: cantidad(TOPES.agencia[t], prefijo),
});

/** Las tabs que son sólo de Pro, con lo que consigue quien no conoce MaKo (nunca el nombre de la tab). */
export const NOMBRE_TAB_PRO: Readonly<Record<(typeof TABS_SOLO_PRO)[number], string>> = {
  'ads-manager': 'Anuncios de Meta: crear campañas y medir cuáles venden',
  'closing-analyst': 'Análisis de tus llamadas de venta con IA',
  'image-editor': 'Editor de imágenes con IA',
  'video-editor': 'Editor de video',
  'ai-avatar': 'Videos con un avatar de IA',
};

export const GRUPOS_COMPARACION = ['Tu asistente', 'Vender', 'Atender', 'Anuncios y contenido', 'Equipo', 'Acompañamiento'] as const;

export function filasDeComparacion(): FilaComparacion[] {
  const [asistente, vender, atender, anuncios, equipo, acompanamiento] = GRUPOS_COMPARACION;
  return [
    { grupo: asistente, que: 'MaKo, tu asistente con IA, con tu propia cuenta de IA', esencial: true, pro: true, acelerador: true },
    filaDeTope(vender, 'Embudos de venta en tu CRM', 'crm.funnels'),
    filaDeTope(vender, 'Contactos en tu CRM', 'crm.leads', 'Hasta '),
    filaDeTope(vender, 'Páginas de venta publicadas', 'web.landings_publicadas'),
    filaDeTope(vender, 'Automatizaciones de mensajes activas', 'automations.activas'),
    filaDeTope(atender, 'Números de WhatsApp, más Instagram', 'chats.lineas_whatsapp'),
    ...TABS_SOLO_PRO.map((t): FilaComparacion => ({ grupo: anuncios, que: NOMBRE_TAB_PRO[t], esencial: false, pro: true, acelerador: true })),
    filaDeTope(equipo, 'Personas de tu equipo', 'equipo.usuarios'),
    { grupo: equipo, que: 'Los negocios de tus clientes, si eres agencia', esencial: false, pro: true, acelerador: true },
    { grupo: acompanamiento, que: 'Tu embudo armado en la primera semana', esencial: false, pro: false, acelerador: true },
    { grupo: acompanamiento, que: 'La asesoría grupal en vivo con Martín, cada semana', esencial: false, pro: false, acelerador: true },
    { grupo: acompanamiento, que: 'Plantillas probadas de páginas, mensajes y guiones', esencial: false, pro: false, acelerador: true },
    { grupo: acompanamiento, que: 'Un grupo de WhatsApp con respuestas de Martín', esencial: false, pro: false, acelerador: true },
  ];
}
